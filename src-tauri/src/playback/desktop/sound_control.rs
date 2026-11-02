use super::*;
use crate::sound::model::Config;
impl DesktopPlayer {
    pub(super) fn check_sound_interruptions(&mut self) {
        let changed = self.sound.route_changed.swap(false, Ordering::AcqRel);
        if changed
            || (!self.output.physical()
                && self.snapshot.playing
                && self.last_output_retry.elapsed() >= Duration::from_secs(5))
        {
            if let Err(error) = self.reconnect_output(changed) {
                self.snapshot.error = Some(error);
            }
        }
    }
    fn reconnect_output(&mut self, force: bool) -> Result<(), String> {
        let result = self.reconnect_output_inner(force);
        if result.is_err() {
            self.finish("output-source-error");
            if let Some(s) = self.sink.take() {
                s.stop();
            }
        }
        result
    }
    fn reconnect_output_inner(&mut self, force: bool) -> Result<(), String> {
        self.last_output_retry = Instant::now();
        let device = open_audio_device(self.sound.clone());
        if device.is_err() && !force {
            return Ok(());
        }
        self.checkpoint();
        let position = self
            .sink
            .as_ref()
            .map(|s| s.get_pos().as_millis() as u64)
            .unwrap_or(self.snapshot.position_ms);
        let playing = self.snapshot.playing;
        if let Some(s) = self.sink.take() {
            s.stop();
        }
        self.output = device
            .map(Output::Device)
            .unwrap_or_else(|_| Output::silent());
        self.sound
            .available
            .store(self.output.physical(), Ordering::Relaxed);
        if let Some(id) = &self.snapshot.track_id {
            let track = self
                .core
                .lock()
                .map_err(|e| e.to_string())?
                .track(id)?
                .ok_or("Track unavailable")?;
            let source =
                rodio::Decoder::try_from(File::open(&track.source_uri).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            let sink = rodio::Player::connect_new(self.output.mixer());
            sink.pause();
            sink.append(SoundSource::new(source, self.sound.clone()));
            if position > 0 {
                sink.try_seek(Duration::from_millis(position))
                    .map_err(|e| e.to_string())?;
            }
            self.audio_position = position;
            self.snapshot.position_ms = position;
            self.last = Instant::now();
            self.wall = chrono::Utc::now();
            if playing {
                sink.play();
            }
            self.sink = Some(sink);
        }
        Ok(())
    }
    pub(super) fn sound_command(
        &mut self,
        op: &str,
        v: &serde_json::Value,
    ) -> Result<bool, String> {
        match op {
            "sound-config" => {
                let mut c: Config = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
                c.validate()?;
                c = c.normalized();
                self.core.lock().unwrap().set_setting("sound-v1", &c)?;
                self.sound.configure(c)?;
            }
            "sound-action" => match v["op"].as_str() {
                Some("retry") => {
                    let config = self.sound.config.lock().unwrap().clone();
                    self.core.lock().unwrap().set_setting("sound-v1", &config)?;
                    self.sound.configure(config)?;
                    self.reconnect_output(true)?;
                    self.snapshot.error = None;
                }
                Some("bypass") => {
                    let value = v["value"].as_bool().ok_or("Invalid bypass")?;
                    self.sound.bypass.store(value, Ordering::Relaxed);
                    self.sound.prepare();
                }
                _ => return Err("Unknown sound action".into()),
            },
            _ => return Ok(false),
        }
        Ok(true)
    }
}
