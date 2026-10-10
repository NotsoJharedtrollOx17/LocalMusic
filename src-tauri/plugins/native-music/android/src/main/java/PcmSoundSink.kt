package com.plugin.native_music

import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.audio.AudioSink

/** Encoded formats must be decoded, even after platform capability rediscovery. */
class PcmSoundSink(private val delegate: AudioSink) : AudioSink by delegate {
    override fun supportsFormat(format: Format) =
        format.sampleMimeType == MimeTypes.AUDIO_RAW && delegate.supportsFormat(format)

    override fun getFormatSupport(format: Format) =
        if (format.sampleMimeType == MimeTypes.AUDIO_RAW) delegate.getFormatSupport(format)
        else AudioSink.SINK_FORMAT_UNSUPPORTED
}
