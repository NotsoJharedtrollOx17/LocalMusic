use super::*;
use crate::sound::{
    model::Config,
    personal::{comparison, Protocol},
};
impl DesktopPlayer {
    pub(super) fn cancel_personal(&mut self) {
        if let Some(t) = self.tone.take() {
            t.stop();
        }
        if let Some(p) = self.sound.session.lock().unwrap().as_mut() {
            p.cancel();
        }
    }
    pub(super) fn check_sound_interruptions(&mut self) {
        if self.sound.route_changed.swap(false, Ordering::AcqRel) {
            self.checkpoint();
            self.finish("output-change");
            self.snapshot.playing = false;
            self.sink.take();
            self.device.take();
            self.sound.available.store(false, Ordering::Relaxed);
            self.cancel_personal();
            let mut c = self.sound.config.lock().unwrap().clone();
            c.personal_enabled = false;
            let _ = self.sound.configure(c.clone());
            let _ = self.core.lock().unwrap().set_setting("sound-v1", &c);
            self.persist();
            self.publish();
        }
        let expired = self
            .sound
            .session
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|p| !p.alive());
        if expired {
            self.cancel_personal();
        }
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
                if c.personal_enabled && !self.sound.config.lock().unwrap().personal_enabled {
                    return Err("Confirm headphones with Use profile first".into());
                }
                self.core.lock().unwrap().set_setting("sound-v1", &c)?;
                self.sound.configure(c)?;
            }
            "sound-action" => match v["op"].as_str() {
                Some("retry") => {
                    self.checkpoint();
                    if self.snapshot.playing {
                        self.finish("output-retry");
                    }
                    self.snapshot.playing = false;
                    self.sink.take();
                    self.cancel_personal();
                    self.device = open_audio_device(self.sound.clone()).ok();
                    self.sound
                        .available
                        .store(self.device.is_some(), Ordering::Relaxed);
                    self.snapshot.error = None;
                }
                Some("profile-use") => {
                    if v["routeGeneration"].as_u64()
                        != Some(self.sound.route_generation.load(Ordering::Acquire) as u64)
                    {
                        return Err("Output changed. Confirm headphones again.".into());
                    }
                    if !self.sound.available.load(Ordering::Relaxed)
                        || self.sound.route_changed.load(Ordering::Acquire)
                    {
                        return Err("Retry audio output and confirm headphones first".into());
                    }
                    let mut c = self.sound.config.lock().unwrap().clone();
                    c.profile_id = Some(v["id"].as_str().ok_or("Missing personal profile")?.into());
                    if self.sound.channels.load(Ordering::Relaxed) > 2 {
                        return Err("Personal sound requires mono or stereo audio".into());
                    }
                    c.personal_enabled = true;
                    c = c.normalized();
                    c.validate()?;
                    self.core.lock().unwrap().set_setting("sound-v1", &c)?;
                    self.sound.configure(c)?;
                }
                Some("bypass") => {
                    let value = v["value"].as_bool().ok_or("Invalid bypass")?;
                    self.sound.bypass.store(value, Ordering::Relaxed);
                    self.sound.prepare();
                }
                _ => return Err("Unknown sound action".into()),
            },
            "personal-action" => {
                let action = v["op"].as_str().ok_or("Missing sound setup action")?;
                if action == "start" {
                    self.cancel_personal();
                    if self.snapshot.playing {
                        self.checkpoint();
                        if let Some(s) = &self.sink {
                            s.pause();
                        }
                        self.snapshot.playing = false;
                    }
                    if self.device.is_none() {
                        return Err(
                            "No audio output device is available. Retry audio output first.".into(),
                        );
                    }
                    let replacement = v["replaceId"].as_str().map(str::to_string);
                    if replacement.as_ref().is_some_and(|id| {
                        !self
                            .sound
                            .config
                            .lock()
                            .unwrap()
                            .profiles
                            .iter()
                            .any(|p| &p.id == id)
                    }) {
                        return Err("Unknown profile to retest".into());
                    }
                    let mut protocol = Protocol::new();
                    protocol.replace_id = replacement;
                    *self.sound.session.lock().unwrap() = Some(protocol);
                    return Ok(true);
                }
                let mut guard = self.sound.session.lock().unwrap();
                let p = guard.as_mut().ok_or("Sound setup is no longer active")?;
                if v["id"].as_str() != Some(p.view.id.as_str()) {
                    return Err("Stale sound setup session".into());
                }
                if action == "cancel" {
                    p.cancel();
                    if let Some(t) = self.tone.take() {
                        t.stop();
                    }
                    return Ok(true);
                }
                p.heartbeat()?;
                let mut samples = None;
                match action {
                    "heartbeat" => {}
                    "pulse" => samples = Some(p.pulse()?),
                    "respond" => p.respond(v["heard"].as_bool().ok_or("Missing tone response")?)?,
                    "retry" => {
                        p.retry()?;
                        if let Some(t) = self.tone.take() {
                            t.stop();
                        }
                    }
                    "preview" => {
                        if p.view.phase != "compare" {
                            return Err("Finish both ears first".into());
                        }
                        let strength = v["strength"]
                            .as_f64()
                            .filter(|s| s.is_finite() && *s >= 0. && *s <= 100.)
                            .ok_or("Invalid profile strength")?;
                        let mode = v["mode"].as_str().ok_or("Missing preview mode")?;
                        if !["original", "personal"].contains(&mode) {
                            return Err("Invalid preview mode".into());
                        }
                        p.view.strength = strength;
                        samples = Some(comparison(
                            p.profile("Preview")?,
                            strength,
                            mode == "personal",
                        ));
                    }
                    "save" => {
                        p.view.strength = v["strength"]
                            .as_f64()
                            .filter(|s| s.is_finite() && *s >= 0. && *s <= 100.)
                            .ok_or("Invalid profile strength")?;
                        let profile = p.profile(v["name"].as_str().unwrap_or(""))?;
                        let mut c = self.sound.config.lock().unwrap().clone();
                        c.profile_id = Some(profile.id.clone());
                        c.profiles.retain(|p| p.id != profile.id);
                        c.profiles.push(profile);
                        c.personal_enabled = true;
                        c = c.normalized();
                        c = c.normalized();
                        c.validate()?;
                        self.core.lock().unwrap().set_setting("sound-v1", &c)?;
                        self.sound.configure(c)?;
                        p.view.phase = "saved".into();
                        p.discard();
                        if let Some(t) = self.tone.take() {
                            t.stop();
                        }
                    }
                    _ => return Err("Unknown sound setup action".into()),
                }
                if let Some(samples) = samples {
                    let device = self.device.as_ref().ok_or("Audio output unavailable")?;
                    if let Some(t) = self.tone.take() {
                        t.stop();
                    }
                    let sink = rodio::Player::connect_new(device.mixer());
                    sink.append(rodio::buffer::SamplesBuffer::new(
                        std::num::NonZero::new(2).unwrap(),
                        std::num::NonZero::new(48000).unwrap(),
                        samples,
                    ));
                    self.tone = Some(sink);
                }
            }
            _ => return Ok(false),
        }
        Ok(true)
    }
}
