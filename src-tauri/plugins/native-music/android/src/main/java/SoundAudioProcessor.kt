package com.plugin.native_music

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteBuffer
import kotlin.math.*

/** Always in the PCM chain, so live toggles never require replacing ExoPlayer. */
class SoundAudioProcessor(private val engine: SoundEngine) : BaseAudioProcessor() {
    private var visualGeneration=0L
    private var positionFrames=0L
    private var positionOffsetMs=0.0
    private var rate=48000
    private var dsp: SoundDsp? = null
    private var generation = -1L
    private var channels = 2
    private var inputChannels = 2
    private var frame = DoubleArray(2)

    override fun onConfigure(format: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (format.encoding != C.ENCODING_PCM_16BIT)
            throw AudioProcessor.UnhandledAudioFormatException(format)
        rate=format.sampleRate
        inputChannels = format.channelCount
        channels = max(2, inputChannels)
        frame = DoubleArray(channels)
        engine.format(format.sampleRate, channels)
        dsp = SoundDsp(engine.prepared, format.sampleRate, channels)
        generation = engine.prepared.generation
        return AudioProcessor.AudioFormat(format.sampleRate, channels, C.ENCODING_PCM_16BIT)
    }

    override fun queueInput(input: ByteBuffer) {
        val output = replaceOutputBuffer(input.remaining() / inputChannels * channels)
        val prepared = engine.prepared
        if (prepared.generation != generation) {
            dsp?.configure(prepared)
            generation = prepared.generation
        }
        while (input.remaining() >= inputChannels * 2) {
            for (ch in 0 until inputChannels) frame[ch] = input.short / 32768.0
            if (inputChannels == 1) frame[1] = frame[0]
            dsp?.process(frame)
            for (ch in frame.indices) {
                val sample=(frame[ch]*32768).roundToInt().coerceIn(-32768,32767).toShort()
                output.putShort(sample)
                frame[ch]=sample/32768.0
            }
            positionFrames++
            engine.visualizer.capture(visualGeneration,frame,positionOffsetMs+positionFrames*1000.0/rate)
        }
        output.flip()
    }

    override fun onFlush(metadata:AudioProcessor.StreamMetadata) {
        positionFrames=0;positionOffsetMs=metadata.positionOffsetUs/1000.0
        visualGeneration=engine.visualizer.reset(rate)
        dsp?.reset()
    }

    override fun onReset() {
        engine.visualizer.invalidate()
        dsp = null
    }
}
