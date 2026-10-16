use serde::{Deserialize, Serialize};
pub const FREQUENCIES: [u32; 6] = [1000, 250, 500, 2000, 4000, 8000];
pub const LEVELS: [i32; 7] = [-72, -66, -60, -54, -48, -42, -36];
pub const TOTAL: usize = 36;
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Coverage {
    Untested,
    Estimating,
    Bracketed,
    BelowFloor,
    AboveCeiling,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Estimate {
    pub ear: usize,
    pub frequency: u32,
    pub status: Coverage,
    pub estimate_dbfs: Option<f64>,
    pub lower_dbfs: Option<i32>,
    pub upper_dbfs: Option<i32>,
    pub answered: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_paths_and_sessions() {
        let fixtures: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/sound-calibration.json"
        ))
        .unwrap();
        for f in fixtures["paths"].as_array().unwrap() {
            let mut c = Calibration::new();
            for i in 0..3 {
                assert_eq!(c.level() as i64, f["levels"][i].as_i64().unwrap());
                let answer = f["answers"][i].as_bool().unwrap();
                c.answer(answer).unwrap();
                c.answer(answer).unwrap();
            }
            let actual = serde_json::to_value(&c.estimates()[0]).unwrap();
            for field in ["status", "estimateDbfs", "lowerDbfs", "upperDbfs"] {
                if f[field].is_number() {
                    assert_eq!(actual[field].as_f64(), f[field].as_f64(), "{field}: {f}");
                } else {
                    assert_eq!(actual[field], f[field], "{field}: {f}");
                }
            }
        }
        for f in fixtures["sessions"].as_array().unwrap() {
            let mut c = Calibration::new();
            for (i, a) in f["answers"].as_array().unwrap().iter().enumerate() {
                assert_eq!(c.ear() as u64, f["ears"][i].as_u64().unwrap());
                assert_eq!(
                    FREQUENCIES[c.step()] as u64,
                    f["frequencies"][i].as_u64().unwrap()
                );
                assert_eq!(c.level() as i64, f["levels"][i].as_i64().unwrap());
                c.answer(a.as_bool().unwrap()).unwrap();
            }
            assert!(c.done());
            assert!(c.answer(true).is_err());
            let expected = |name: &str| {
                f[name]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|n| n.as_f64().unwrap())
                    .collect::<Vec<_>>()
            };
            assert_eq!(
                super::super::personal::derive(c.values(0)).to_vec(),
                expected("left")
            );
            assert_eq!(
                super::super::personal::derive(c.values(1)).to_vec(),
                expected("right")
            );
            assert_eq!(
                serde_json::to_value(c.metadata()).unwrap()["coverage"],
                f["coverage"]
            );
        }
    }
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub method: String,
    pub coverage: [Coverage; 12],
}
#[derive(Clone, Copy)]
struct Cell {
    lower: i32,
    upper: i32,
    answered: usize,
}
pub struct Calibration {
    pub answered: usize,
    cells: [Cell; 12],
}
impl Calibration {
    pub fn new() -> Self {
        Self {
            answered: 0,
            cells: [Cell {
                lower: -1,
                upper: 7,
                answered: 0,
            }; 12],
        }
    }
    pub fn ear(&self) -> usize {
        self.answered % 2
    }
    pub fn step(&self) -> usize {
        (self.answered / 6).min(5)
    }
    pub fn done(&self) -> bool {
        self.answered == TOTAL
    }
    pub fn level(&self) -> i32 {
        let c = self.cells[self.ear() * 6 + self.step()];
        -72 + ((c.lower + c.upper) / 2) * 6
    }
    pub fn answer(&mut self, heard: bool) -> Result<(), String> {
        if self.done() {
            return Err("Calibration is complete".into());
        }
        let i = self.ear() * 6 + self.step();
        let c = &mut self.cells[i];
        let index = (c.lower + c.upper) / 2;
        if heard {
            c.upper = index;
        } else {
            c.lower = index;
        }
        c.answered += 1;
        self.answered += 1;
        Ok(())
    }
    pub fn estimates(&self) -> [Estimate; 12] {
        std::array::from_fn(|i| {
            let c = self.cells[i];
            let status = if c.answered == 0 {
                Coverage::Untested
            } else if c.answered < 3 {
                Coverage::Estimating
            } else if c.lower == -1 {
                Coverage::BelowFloor
            } else if c.upper == 7 {
                Coverage::AboveCeiling
            } else {
                Coverage::Bracketed
            };
            Estimate {
                ear: i / 6,
                frequency: FREQUENCIES[i % 6],
                status,
                estimate_dbfs: if matches!(status, Coverage::Estimating | Coverage::Bracketed) {
                    Some((-72. + (c.lower + c.upper) as f64 * 3.).clamp(-72., -36.))
                } else {
                    None
                },
                lower_dbfs: (c.lower >= 0).then_some(-72 + c.lower * 6),
                upper_dbfs: (c.upper <= 6).then_some(-72 + c.upper * 6),
                answered: c.answered,
            }
        })
    }
    pub fn values(&self, ear: usize) -> [Option<f64>; 6] {
        let estimates = self.estimates();
        std::array::from_fn(|i| {
            let e = &estimates[ear * 6 + i];
            if e.status == Coverage::Bracketed {
                e.estimate_dbfs
            } else {
                None
            }
        })
    }
    pub fn metadata(&self) -> Metadata {
        Metadata {
            method: "bounded-3-v1".into(),
            coverage: self.estimates().map(|e| e.status),
        }
    }
}
