use super::{dsp::Processor, engine::Engine};
use rodio::{source::SeekError, ChannelCount, SampleRate, Source};
use std::{
    sync::{atomic::Ordering, Arc},
    time::Duration,
};
pub struct SoundSource<S: Source> {
    inner: S,
    engine: Arc<Engine>,
    dsp: Processor,
    frame: Vec<f64>,
    index: usize,
    channels: usize,
    rate: u32,
    generation: u64,
    blocks: usize,
    visual_epoch: u64,
    position: f64,
}
impl<S: Source> SoundSource<S> {
    pub fn new(inner: S, engine: Arc<Engine>) -> Self {
        let channels = (inner.channels().get() as usize).max(2);
        let rate = inner.sample_rate().get();
        engine.rate.store(rate, Ordering::Relaxed);
        engine.channels.store(channels, Ordering::Relaxed);
        engine.prepare();
        let p = engine.prepared.lock().unwrap().clone();
        let visual_epoch = engine.visualizer.reset(rate);
        Self {
            visual_epoch,
            position: 0.,
            inner,
            engine,
            dsp: Processor::new(&p, rate, channels),
            frame: vec![0.; channels],
            index: channels,
            channels,
            rate,
            generation: p.generation,
            blocks: 0,
        }
    }
}
impl<S: Source> Iterator for SoundSource<S> {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        if self.index == self.channels {
            let input = self.inner.channels().get() as usize;
            for ch in 0..input {
                self.frame[ch] = self.inner.next()? as f64;
            }
            if input == 1 {
                self.frame[1] = self.frame[0];
            }
            if self.blocks % 64 == 0 {
                if let Ok(p) = self.engine.prepared.try_lock() {
                    if p.generation != self.generation {
                        self.dsp.configure(&p);
                        self.generation = p.generation;
                    }
                }
            }
            self.blocks += 1;
            self.dsp.process(&mut self.frame);
            self.position += 1000. / self.rate as f64;
            self.engine
                .visualizer
                .capture(self.visual_epoch, &self.frame, self.position);
            self.index = 0;
        }
        let x = self.frame[self.index] as f32;
        self.index += 1;
        Some(x)
    }
}
impl<S: Source> Source for SoundSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.inner.current_span_len().map(|n| {
            n / self.inner.channels().get() as usize * self.channels + self.channels - self.index
        })
    }
    fn channels(&self) -> ChannelCount {
        ChannelCount::new(self.channels as u16).unwrap()
    }
    fn sample_rate(&self) -> SampleRate {
        SampleRate::new(self.rate).unwrap()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.inner.try_seek(pos)?;
        self.dsp.reset();
        self.position = pos.as_secs_f64() * 1000.;
        self.visual_epoch = self.engine.visualizer.reset(self.rate);
        self.index = self.channels;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn analysis_is_read_only_after_eq_and_limiting() {
        let render = |enabled: bool| {
            let mut config = super::super::model::Config::default();
            config.gains[5] = 10.;
            let engine = Arc::new(Engine::new(config));
            let input = rodio::buffer::SamplesBuffer::new(
                ChannelCount::new(6).unwrap(),
                SampleRate::new(48000).unwrap(),
                (0..48000)
                    .map(|i| ((i / 6) as f32 * 0.13).sin() * 0.8)
                    .collect::<Vec<_>>(),
            );
            let source = SoundSource::new(input, engine.clone());
            let session = if enabled {
                Some(engine.visualizer.start())
            } else {
                None
            };
            let output = source.collect::<Vec<_>>();
            if let Some(id) = session {
                engine.visualizer.stop(&id);
            }
            output
        };
        assert_eq!(render(false), render(true));
    }
    #[test]
    fn mono_is_promoted_without_changing_duration_or_seek() {
        let input = rodio::buffer::SamplesBuffer::new(
            ChannelCount::new(1).unwrap(),
            SampleRate::new(48000).unwrap(),
            vec![0.5, 0.25, 0.1],
        );
        let duration = input.total_duration();
        let engine = Arc::new(Engine::new(Default::default()));
        let mut source = SoundSource::new(input, engine);
        assert_eq!(source.channels().get(), 2);
        assert_eq!(source.total_duration(), duration);
        assert_eq!(source.next(), Some(0.5));
        assert!(source.current_span_len().unwrap() > 0);
        assert_eq!(source.next(), Some(0.5));
        source.try_seek(Duration::ZERO).unwrap();
        assert_eq!(
            source.collect::<Vec<_>>(),
            vec![0.5, 0.5, 0.25, 0.25, 0.1, 0.1]
        );
    }
}
