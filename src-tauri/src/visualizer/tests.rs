use super::*;
#[test]
fn shared_numpy_analysis_fixtures() {
    let fixtures: serde_json::Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/visualizer-analysis.json"
    ))
    .unwrap();
    for f in fixtures.as_array().unwrap() {
        let mut l = vec![0.; N];
        let mut r = vec![0.; N];
        let rate = f["rate"].as_u64().unwrap() as u32;
        let mut seed = 17u32;
        for i in 0..N {
            l[i] = match f["signal"].as_str().unwrap() {
                "tone" => {
                    (i as f64 * 2. * std::f64::consts::PI * f["frequency"].as_f64().unwrap()
                        / rate as f64)
                        .sin()
                        * f["amplitude"].as_f64().unwrap()
                }
                "impulse" => {
                    if i == N / 2 {
                        1.
                    } else {
                        0.
                    }
                }
                "noise" => {
                    seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                    (seed as f64 / 4294967296. - 0.5) * 0.5
                }
                _ => 0.,
            };
            r[i] = l[i]
                * if f["signal"] == "impulse" {
                    -1.
                } else {
                    f["right"].as_f64().unwrap_or(1.)
                };
        }
        let mut analyzer = Analysis::new();
        let actual = analyzer.analyze(&l, &r, rate);
        assert!(
            (actual.rms - f["expected"]["rms"].as_f64().unwrap()).abs() < 1e-9,
            "{}",
            f["name"]
        );
        for i in 0..64 {
            assert!(
                (actual.spectrum[i] - f["expected"]["spectrum"][i].as_f64().unwrap()).abs() < 1e-7,
                "{} band {}",
                f["name"],
                i
            );
        }
        for i in 0..256 {
            assert!(
                (actual.waveform[i] - f["expected"]["waveform"][i].as_f64().unwrap()).abs() < 1e-9
            );
        }
        assert_eq!(analyzer.analyze(&l, &r, rate).onset, 0.);
    }
}
#[test]
fn lease_stop_stale_session_and_transport_generation() {
    let v = Visualizer::new();
    let old = v.start();
    let current = v.start();
    v.stop(&old);
    assert!(v.read(&old).is_err());
    assert!(v.read(&current).is_ok());
    let epoch = v.reset(48000);
    v.clock(60, true);
    for i in 0..4096 {
        v.capture(epoch, &[0.5, -0.5], i as f64 / 48.);
    }
    for _ in 0..30 {
        if v.read(&current).unwrap().is_some() {
            break;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    let f = v.read(&current).unwrap().unwrap();
    assert_eq!(f.generation, epoch);
    assert!(f.rms > 0.49);
    v.reset(44100);
    assert!(v.read(&current).unwrap().is_none());
    v.deadline.store(v.now().saturating_sub(1), Release);
    assert!(v.read(&current).is_err());
    v.stop(&current);
    v.stop(&current);
    assert!(!v.active.load(Acquire));
}
