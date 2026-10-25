mod sound_control;
use crate::sound::{engine::Engine, source::SoundSource};
use music_core::*;
use std::sync::atomic::Ordering;
use std::{
    fs::File,
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
pub struct Request {
    pub op: String,
    pub payload: serde_json::Value,
    pub reply: mpsc::Sender<Result<(), String>>,
}
pub fn launch(
    app: AppHandle,
    core: Arc<Mutex<Store>>,
    state: Arc<Mutex<PlaybackSnapshot>>,
    sound: Arc<Engine>,
) -> mpsc::Sender<Request> {
    let (tx, rx) = mpsc::channel::<Request>();
    std::thread::spawn(move || {
        #[cfg(windows)]
        let _output_monitor = crate::sound::output::monitor(sound.clone()).ok();
        #[cfg(windows)]
        sound
            .route_monitoring
            .store(_output_monitor.is_some(), Ordering::Relaxed);
        let device = open_audio_device(sound.clone());
        sound.available.store(device.is_ok(), Ordering::Relaxed);
        let mut p = DesktopPlayer {
            sound,
            device: device.ok(),
            sink: None,
            core,
            app,
            state,
            snapshot: PlaybackSnapshot {
                repeat: "off".into(),
                ..Default::default()
            },
            visited: std::collections::HashSet::new(),
            session: None,
            sequence: 0,
            audio_position: 0,
            last: Instant::now(),
            wall: chrono::Utc::now(),
        };
        if let Ok(Some(mut s)) = p
            .core
            .lock()
            .unwrap()
            .get_setting::<PlaybackSnapshot>("queue")
        {
            s.playing = false;
            s.error = None;
            p.snapshot = s;
        }
        p.publish();
        loop {
            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(r) => {
                    let result = p.command(&r.op, r.payload);
                    if let Err(e) = &result {
                        p.snapshot.error = Some(e.clone());
                    }
                    let _ = r.reply.send(result);
                    p.persist();
                    p.publish();
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => {
                    p.finish("shutdown");
                    break;
                }
            }
            p.check_sound_interruptions();
            if p.snapshot.playing {
                if p.sink.as_ref().is_some_and(|s| s.empty()) {
                    p.finish("completed");
                    if p.snapshot.repeat == "one" {
                        let _ = p.start(p.snapshot.queue_index, 0);
                    } else if let Some(index) = p.following_index() {
                        if let Err(error) = p.start(index, 0) {
                            p.snapshot.error = Some(error);
                        }
                    } else {
                        p.snapshot.playing = false;
                        p.snapshot.position_ms = p.snapshot.duration_ms;
                    }
                } else if let Some(s) = &p.sink {
                    p.snapshot.position_ms = s.get_pos().as_millis() as u64;
                }
                if p.last.elapsed() >= Duration::from_secs(10) {
                    p.checkpoint();
                    p.persist();
                }
            }
            p.publish();
        }
    });
    tx
}
struct DesktopPlayer {
    sound: Arc<Engine>,
    device: Option<rodio::MixerDeviceSink>,
    sink: Option<rodio::Player>,
    core: Arc<Mutex<Store>>,
    app: AppHandle,
    state: Arc<Mutex<PlaybackSnapshot>>,
    snapshot: PlaybackSnapshot,
    visited: std::collections::HashSet<usize>,
    session: Option<Session>,
    sequence: u64,
    audio_position: u64,
    last: Instant,
    wall: chrono::DateTime<chrono::Utc>,
}
impl DesktopPlayer {
    fn following_index(&mut self) -> Option<usize> {
        if !self.snapshot.shuffle {
            return if self.snapshot.queue_index + 1 < self.snapshot.queue.len() {
                Some(self.snapshot.queue_index + 1)
            } else if self.snapshot.repeat == "all" {
                Some(0)
            } else {
                None
            };
        }
        let mut pool = (0..self.snapshot.queue.len())
            .filter(|i| !self.visited.contains(i))
            .collect::<Vec<_>>();
        if pool.is_empty() && self.snapshot.repeat == "all" {
            self.visited.clear();
            if self.snapshot.queue.len() > 1 {
                self.visited.insert(self.snapshot.queue_index);
            }
            pool = (0..self.snapshot.queue.len())
                .filter(|i| !self.visited.contains(i))
                .collect();
        }
        if pool.is_empty() {
            None
        } else {
            Some(pool[uuid::Uuid::new_v4().as_u128() as usize % pool.len()])
        }
    }
    fn publish(&self) {
        self.sound
            .playing
            .store(self.snapshot.playing, Ordering::Relaxed);
        *self.state.lock().unwrap() = self.snapshot.clone();
        let _ = self.app.emit("playback://snapshot", &self.snapshot);
    }
    fn persist(&self) {
        let _ = self
            .core
            .lock()
            .unwrap()
            .set_setting("queue", &self.snapshot);
    }
    fn checkpoint(&mut self) {
        let now = Instant::now();
        let position = self
            .sink
            .as_ref()
            .map(|s| s.get_pos().as_millis() as u64)
            .unwrap_or(self.audio_position);
        if self.snapshot.playing {
            if let Some(s) = &mut self.session {
                let delta = (now.duration_since(self.last).as_millis() as u64)
                    .min(position.saturating_sub(self.audio_position));
                if delta > 0 {
                    s.played_ms += delta;
                    let i = Interval {
                        session_id: s.id.clone(),
                        sequence: self.sequence,
                        start_utc: self.wall.to_rfc3339(),
                        played_ms: delta,
                    };
                    self.sequence += 1;
                    if let Err(e) = self.core.lock().unwrap().ingest(s, Some(&i)) {
                        self.snapshot.error = Some(e);
                    }
                }
            }
        }
        self.audio_position = position;
        self.last = now;
        self.wall = chrono::Utc::now();
    }
    fn finish(&mut self, reason: &str) {
        self.checkpoint();
        if let Some(mut s) = self.session.take() {
            s.end_reason = Some(reason.into());
            let _ = self.core.lock().unwrap().ingest(&s, None);
        }
        self.snapshot.playing = false;
    }
    fn start(&mut self, index: usize, position: u64) -> Result<(), String> {
        self.finish("transition");
        if let Some(s) = self.sink.take() {
            s.stop();
        }
        let id = self
            .snapshot
            .queue
            .get(index)
            .ok_or("Queue is empty")?
            .clone();
        let track = {
            let mut store = self.core.lock().map_err(|e| e.to_string())?;
            let track = store.track(&id)?.ok_or("Track is unavailable")?;
            crate::catalog::refresh_track(&mut store, track)?
        };
        if !track.available {
            return Err("Track source is unavailable. Import its new location.".into());
        }
        let file = File::open(&track.source_uri).map_err(|e| e.to_string())?;
        let source = rodio::Decoder::try_from(file).map_err(|e| e.to_string())?;
        let device = self
            .device
            .as_ref()
            .ok_or("No audio output device is available")?;
        let sink = rodio::Player::connect_new(device.mixer());
        sink.append(SoundSource::new(source, self.sound.clone()));
        if position > 0 {
            sink.try_seek(Duration::from_millis(position))
                .map_err(|e| e.to_string())?;
        }
        self.snapshot.track_id = Some(id.clone());
        self.snapshot.queue_index = index;
        self.visited.insert(index);
        self.snapshot.duration_ms = track.duration_ms;
        self.snapshot.position_ms = position;
        self.snapshot.playing = true;
        self.snapshot.error = None;
        self.session = Some(Session {
            id: uuid::Uuid::new_v4().to_string(),
            track_id: id,
            started_at_utc: chrono::Utc::now().to_rfc3339(),
            played_ms: 0,
            excluded: self.snapshot.excluded,
            end_reason: None,
        });
        self.sequence = 0;
        self.last = Instant::now();
        self.wall = chrono::Utc::now();
        self.audio_position = sink.get_pos().as_millis() as u64;
        self.sink = Some(sink);
        Ok(())
    }
    fn command(&mut self, op: &str, v: serde_json::Value) -> Result<(), String> {
        if self.sound_command(op, &v)? {
            return Ok(());
        }
        match op {
            "play" => {
                let ids: Vec<String> =
                    serde_json::from_value(v["ids"].clone()).map_err(|e| e.to_string())?;
                let index = v["index"].as_u64().unwrap_or(0) as usize;
                if ids.is_empty() || index >= ids.len() {
                    return Err("Invalid queue".into());
                }
                for id in &ids {
                    if self.core.lock().unwrap().track(id)?.is_none() {
                        return Err("Unknown track".into());
                    }
                }
                self.snapshot.queue = ids;
                self.visited.clear();
                self.start(index, 0)?;
            }
            "toggle" => {
                if self.snapshot.playing {
                    self.checkpoint();
                    if let Some(s) = &self.sink {
                        s.pause();
                    }
                    self.snapshot.playing = false;
                } else if let Some(s) = &self.sink {
                    if s.empty() {
                        self.start(self.snapshot.queue_index, 0)?;
                    } else {
                        s.play();
                        self.snapshot.playing = true;
                        self.last = Instant::now();
                        self.wall = chrono::Utc::now();
                    }
                } else {
                    self.start(self.snapshot.queue_index, self.snapshot.position_ms)?;
                }
            }
            "seek" => {
                self.checkpoint();
                let ms = v["ms"].as_u64().unwrap_or(0).min(self.snapshot.duration_ms);
                if let Some(s) = &self.sink {
                    s.try_seek(Duration::from_millis(ms))
                        .map_err(|e| e.to_string())?;
                }
                self.snapshot.position_ms = ms;
                self.audio_position = ms;
            }
            "next" => {
                if self.snapshot.queue.is_empty() {
                    return Ok(());
                }
                let index = self.following_index().unwrap_or_else(|| {
                    self.visited.clear();
                    0
                });
                self.start(index, 0)?;
            }
            "previous" => {
                if self.snapshot.position_ms > 3000 {
                    self.command("seek", serde_json::json!({"ms":0}))?;
                } else {
                    self.start(self.snapshot.queue_index.saturating_sub(1), 0)?;
                }
            }
            "shuffle" => {
                self.snapshot.shuffle = v["value"].as_bool().unwrap_or(false);
                self.visited.clear();
                self.visited.insert(self.snapshot.queue_index);
            }
            "repeat" => {
                let r = v["value"].as_str().unwrap_or("off");
                if !["off", "all", "one"].contains(&r) {
                    return Err("Invalid repeat mode".into());
                }
                self.snapshot.repeat = r.into();
            }
            "excluded" => {
                self.checkpoint();
                self.snapshot.excluded = v["value"].as_bool().unwrap_or(false);
                if let Some(s) = &mut self.session {
                    s.excluded = self.snapshot.excluded;
                    self.core
                        .lock()
                        .unwrap()
                        .exclude_session(&s.id, s.excluded)?;
                }
            }
            "reorder" => {
                let ids: Vec<String> =
                    serde_json::from_value(v["ids"].clone()).map_err(|e| e.to_string())?;
                let current = self.snapshot.track_id.as_ref().ok_or("No current track")?;
                let index = ids
                    .iter()
                    .position(|id| id == current)
                    .ok_or("Current track must stay in the queue")?;
                for id in &ids {
                    if self.core.lock().unwrap().track(id)?.is_none() {
                        return Err("Unknown track".into());
                    }
                }
                self.snapshot.queue = ids;
                self.visited.clear();
                self.snapshot.queue_index = index;
            }
            "flush" => self.checkpoint(),
            "deleteHistory" => {
                let was_playing = self.snapshot.playing;
                self.finish("history-deleted");
                self.core.lock().unwrap().delete_history()?;
                if was_playing {
                    self.snapshot.playing = true;
                    self.session = Some(Session {
                        id: uuid::Uuid::new_v4().to_string(),
                        track_id: self.snapshot.track_id.clone().unwrap(),
                        started_at_utc: chrono::Utc::now().to_rfc3339(),
                        played_ms: 0,
                        excluded: self.snapshot.excluded,
                        end_reason: None,
                    });
                    self.sequence = 0;
                    self.last = Instant::now();
                    self.wall = chrono::Utc::now();
                }
            }
            _ => return Err("Unknown playback operation".into()),
        }
        Ok(())
    }
}

fn open_audio_device(sound: Arc<Engine>) -> Result<rodio::MixerDeviceSink, String> {
    rodio::DeviceSinkBuilder::from_default_device()
        .map_err(|e| e.to_string())?
        .with_error_callback(move |_| {
            sound.route_changed.store(true, Ordering::Release);
        })
        .open_sink_or_fallback()
        .map_err(|e| e.to_string())
}
