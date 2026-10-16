use super::{
    calibration::{Calibration, Coverage, Estimate, FREQUENCIES, TOTAL},
    model::Profile,
    personal::{derive, tone},
};
use serde::Serialize;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    pub id: String,
    pub trial_id: String,
    pub answered_trials: usize,
    pub total_trials: usize,
    pub estimates: Vec<Estimate>,
    pub phase: String,
    pub ear: usize,
    pub step: usize,
    pub frequency: u32,
    pub level: i32,
    pub awaiting: bool,
    pub busy_until: u64,
    pub message: String,
    pub strength: f64,
    pub left: [f64; 10],
    pub right: [f64; 10],
}
pub struct Protocol {
    pub replace_id: Option<String>,
    pub view: View,
    calibration: Calibration,
    lease: Instant,
    end: Instant,
    next: Instant,
}
impl Protocol {
    pub fn new() -> Self {
        let now = Instant::now();
        let calibration = Calibration::new();
        Self {
            view: View {
                id: uuid::Uuid::new_v4().to_string(),
                trial_id: uuid::Uuid::new_v4().to_string(),
                answered_trials: 0,
                total_trials: TOTAL,
                estimates: calibration.estimates().to_vec(),
                phase: "test".into(),
                ear: 0,
                step: 0,
                frequency: 1000,
                level: -54,
                awaiting: false,
                busy_until: 0,
                message: String::new(),
                strength: 100.,
                left: [0.; 10],
                right: [0.; 10],
            },
            replace_id: None,
            calibration,
            lease: now + Duration::from_secs(2),
            end: now,
            next: now,
        }
    }
    pub fn alive(&self) -> bool {
        self.view.phase != "cancelled"
            && (self.view.phase == "saved" || Instant::now() < self.lease)
    }
    pub fn heartbeat(&mut self) -> Result<(), String> {
        if !self.alive() {
            self.cancel();
            return Err("Sound setup expired. Start again.".into());
        }
        self.lease = Instant::now() + Duration::from_secs(2);
        Ok(())
    }
    fn check_trial(&self, trial: &str) -> Result<(), String> {
        if trial.is_empty() || trial != self.view.trial_id || self.view.phase != "test" {
            return Err("Stale sound setup trial".into());
        }
        Ok(())
    }
    pub fn pulse(&mut self, trial: &str) -> Result<Vec<f32>, String> {
        self.heartbeat()?;
        self.check_trial(trial)?;
        let now = Instant::now();
        if now < self.next {
            return Err("Wait before playing another tone".into());
        }
        self.end = now + Duration::from_millis(3400);
        self.next = self.end + Duration::from_millis(500);
        self.view.awaiting = true;
        self.view.busy_until = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
            + 3400;
        tone(self.view.frequency, self.view.level, self.view.ear)
    }
    pub fn respond(&mut self, heard: bool, trial: &str) -> Result<(), String> {
        self.heartbeat()?;
        self.check_trial(trial)?;
        if !self.view.awaiting || Instant::now() < self.end {
            return Err("Play the tone and wait for it to finish first".into());
        }
        self.calibration.answer(heard)?;
        self.view.awaiting = false;
        self.view.trial_id = if self.calibration.done() {
            String::new()
        } else {
            uuid::Uuid::new_v4().to_string()
        };
        self.view.answered_trials = self.calibration.answered;
        self.view.estimates = self.calibration.estimates().to_vec();
        self.view.left = derive(self.calibration.values(0));
        self.view.right = derive(self.calibration.values(1));
        if self.calibration.done() {
            self.view.phase = "compare".into();
        } else {
            self.view.ear = self.calibration.ear();
            self.view.step = self.calibration.step();
            self.view.frequency = FREQUENCIES[self.view.step];
            self.view.level = self.calibration.level();
        }
        Ok(())
    }
    pub fn retry(&mut self) -> Result<(), String> {
        self.heartbeat()?;
        let replacement = self.replace_id.clone();
        // Preserve the session identity, invalidate every former trial.
        let id = self.view.id.clone();
        let next = self.next;
        *self = Self::new();
        self.view.id = id;
        self.replace_id = replacement;
        self.next = next;
        Ok(())
    }
    pub fn profile(&self, name: &str) -> Result<Profile, String> {
        if self.view.phase != "compare" || name.trim().is_empty() || name.chars().count() > 60 {
            return Err("Finish setup and provide a name (1-60 characters)".into());
        }
        let metadata = self.calibration.metadata();
        Ok(Profile {
            id: self
                .replace_id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            name: name.trim().into(),
            left: derive(self.calibration.values(0)),
            right: derive(self.calibration.values(1)),
            complete: metadata.coverage.map(|c| c == Coverage::Bracketed),
            calibration: Some(metadata),
        })
    }
    pub fn cancel(&mut self) {
        self.view.phase = "cancelled".into();
        self.view.awaiting = false;
        self.view.trial_id.clear();
        self.discard();
    }
    pub fn discard(&mut self) {
        self.calibration = Calibration::new();
        self.view.estimates.clear();
        self.view.left = [0.; 10];
        self.view.right = [0.; 10];
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn saves_derived_profile_and_discards_session_bounds() {
        let fixtures: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/sound-calibration.json"
        ))
        .unwrap();
        let f = &fixtures["sessions"][3];
        let mut p = Protocol::new();
        p.replace_id = Some("legacy".into());
        for answer in f["answers"].as_array().unwrap() {
            let trial = p.view.trial_id.clone();
            p.next = Instant::now();
            p.pulse(&trial).unwrap();
            p.end = Instant::now();
            p.respond(answer.as_bool().unwrap(), &trial).unwrap();
        }
        let profile = p.profile("Headphones").unwrap();
        assert_eq!(profile.id, "legacy");
        assert_eq!(profile.left[3], 6.);
        assert_eq!(profile.right[3], 0.);
        assert_eq!(
            serde_json::to_value(&profile).unwrap()["calibration"]["coverage"],
            f["coverage"]
        );
        let original = super::super::personal::comparison(profile.clone(), 100., false);
        let personal = super::super::personal::comparison(profile, 100., true);
        let energy =
            |samples: Vec<f32>| samples.into_iter().map(|x| (x as f64).powi(2)).sum::<f64>();
        assert!((energy(original) - energy(personal)).abs() < 1e-5);
        p.view.phase = "saved".into();
        p.discard();
        assert!(p.view.estimates.is_empty());
        assert!(p.view.left.iter().all(|x| *x == 0.));
        assert!(p.profile("Again").is_err());
    }
    #[test]
    fn stale_duplicate_timing_repeat_and_expiry_guards() {
        let mut p = Protocol::new();
        let trial = p.view.trial_id.clone();
        assert!(p.respond(true, &trial).is_err());
        assert!(p.pulse("stale").is_err());
        p.pulse(&trial).unwrap();
        assert!(p.pulse(&trial).is_err());
        assert!(p.respond(true, &trial).is_err());
        p.end = Instant::now();
        p.next = Instant::now();
        p.pulse(&trial).unwrap();
        assert_eq!(p.view.trial_id, trial); // unanswered repeat keeps identity
        p.end = Instant::now();
        p.respond(true, &trial).unwrap();
        assert_eq!(p.view.ear, 1);
        assert!(p.respond(true, &trial).is_err());
        assert!(p.pulse(&trial).is_err());
        p.lease = Instant::now();
        assert!(p.heartbeat().is_err());
        assert!(p.view.estimates.is_empty());
    }
}
