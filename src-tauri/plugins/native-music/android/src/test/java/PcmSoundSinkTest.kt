package com.plugin.native_music

import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.audio.AudioOffloadSupport
import androidx.media3.exoplayer.audio.AudioSink
import java.lang.reflect.Proxy
import java.nio.ByteBuffer
import org.junit.Assert.*
import org.junit.Test

class PcmSoundSinkTest {
    private class Recorder {
        val calls = mutableListOf<Pair<String, List<Any?>>>()
        val sink = Proxy.newProxyInstance(AudioSink::class.java.classLoader, arrayOf(AudioSink::class.java)) { _, method, args ->
            calls.add(method.name to (args?.toList() ?: emptyList()))
            when (method.name) {
                "supportsFormat", "handleBuffer" -> true
                "getFormatSupport" -> AudioSink.SINK_FORMAT_SUPPORTED_DIRECTLY
                "getFormatOffloadSupport" -> AudioOffloadSupport.Builder().setIsFormatSupported(true).build()
                "getCurrentPositionUs" -> 1234L
                else -> null
            }
        } as AudioSink
    }
    private fun pcm() = Format.Builder().setSampleMimeType(MimeTypes.AUDIO_RAW)
        .setSampleRate(48000).setChannelCount(2).setPcmEncoding(C.ENCODING_PCM_16BIT).build()

    @Test
    @Suppress("DEPRECATION")
    fun bothConfigurationEntryPointsReachTheRealSinkOnce() {
        val recorder = Recorder()
        val wrapper = PcmSoundSink(recorder.sink)
        val format = pcm()
        val config = AudioSink.AudioSinkConfig.Builder(format).build()
        wrapper.configure(config)
        assertEquals(1, recorder.calls.size)
        assertEquals("configure", recorder.calls.single().first)
        assertSame(config, recorder.calls.single().second.single())
        recorder.calls.clear()
        wrapper.configure(format, 4096, intArrayOf(1, 0))
        assertEquals(1, recorder.calls.size)
        assertEquals("configure", recorder.calls.single().first)
        assertTrue(recorder.calls.single().second.single() is AudioSink.AudioSinkConfig)
    }

    @Test
    fun encodedAndOffloadedAudioCannotBypassThePcmProcessor() {
        val recorder = Recorder()
        val wrapper = PcmSoundSink(recorder.sink)
        assertTrue(wrapper.supportsFormat(pcm()))
        assertEquals(AudioSink.SINK_FORMAT_SUPPORTED_DIRECTLY, wrapper.getFormatSupport(pcm()))
        for (mime in listOf(MimeTypes.AUDIO_MPEG, MimeTypes.AUDIO_AAC)) {
            val encoded = Format.Builder().setSampleMimeType(mime).build()
            assertFalse(wrapper.supportsFormat(encoded))
            assertEquals(AudioSink.SINK_FORMAT_UNSUPPORTED, wrapper.getFormatSupport(encoded))
            assertFalse(wrapper.getFormatOffloadSupport(encoded).isFormatSupported)
        }
    }

    @Test
    fun buffersPositionAndTransportContinueToTheDelegate() {
        val recorder = Recorder()
        val wrapper = PcmSoundSink(recorder.sink)
        val buffer = ByteBuffer.allocateDirect(8)
        wrapper.play()
        assertTrue(wrapper.handleBuffer(buffer, 42000L, 1))
        assertSame(buffer, recorder.calls.last().second.first())
        assertEquals(1234L, wrapper.getCurrentPositionUs(false))
        wrapper.pause()
        wrapper.flush()
        wrapper.reset()
        assertEquals(listOf("play", "handleBuffer", "getCurrentPositionUs", "pause", "flush", "reset"), recorder.calls.map { it.first })
    }
}
