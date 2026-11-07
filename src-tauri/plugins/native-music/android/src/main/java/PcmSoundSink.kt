package com.plugin.native_music

import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.AudioOffloadSupport
import androidx.media3.exoplayer.audio.ForwardingAudioSink

/** Encoded formats must be decoded, even after platform capability rediscovery. */
class PcmSoundSink(private val delegate: AudioSink) : ForwardingAudioSink(delegate) {
    // Kotlin interface delegation does not forward Java default methods. Media3's
    // configure overloads otherwise call each other recursively on this wrapper.
    override fun supportsFormat(format: Format) =
        format.sampleMimeType == MimeTypes.AUDIO_RAW && delegate.supportsFormat(format)

    override fun getFormatSupport(format: Format) =
        if (format.sampleMimeType == MimeTypes.AUDIO_RAW) delegate.getFormatSupport(format)
        else AudioSink.SINK_FORMAT_UNSUPPORTED

    override fun getFormatOffloadSupport(format: Format) = AudioOffloadSupport.DEFAULT_UNSUPPORTED
}
