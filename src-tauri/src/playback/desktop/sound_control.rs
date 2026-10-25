use super::*;
use crate::sound::model::Config;
impl DesktopPlayer {
    pub(super) fn check_sound_interruptions(&mut self) {
        if self.sound.route_changed.swap(false, Ordering::AcqRel) {
            self.checkpoint();
            self.finish("output-change");
            self.snapshot.playing = false;
            self.sink.take();
            self.device.take();
            self.sound.available.store(false, Ordering::Relaxed);
            self.persist();
            self.publish();
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
                self.core.lock().unwrap().set_setting("sound-v1", &c)?;
                self.sound.configure(c)?;
            }
            "sound-action" => match v["op"].as_str() {
                Some("retry") => {
                    let config = self.sound.config.lock().unwrap().clone();
                    self.core.lock().unwrap().set_setting("sound-v1", &config)?;
                    self.sound.configure(config)?;
                    self.checkpoint();
                    if self.snapshot.playing {
                        self.finish("output-retry");
                    }
                    self.snapshot.playing = false;
                    self.sink.take();
                    self.device = open_audio_device(self.sound.clone()).ok();
                    self.sound
                        .available
                        .store(self.device.is_some(), Ordering::Relaxed);
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
