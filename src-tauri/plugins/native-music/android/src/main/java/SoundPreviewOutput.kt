package com.plugin.native_music

import android.content.Context
import android.media.*

/** Finite samples, separate from Media3's catalog and listening journal. */
class SoundPreviewOutput(context: Context, private val interrupted: () -> Unit) {
    private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var track: AudioTrack? = null
    private val attributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
    private val focus =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener { change ->
                if (change != AudioManager.AUDIOFOCUS_GAIN) interrupted()
            }
            .build()

    @Synchronized
    fun play(samples: FloatArray) {
        stop()
        check(manager.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            "Audio focus unavailable"
        }
        try {
            val next =
                AudioTrack.Builder()
                    .setAudioAttributes(attributes)
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setSampleRate(48000)
                            .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                            .build()
                    )
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .setBufferSizeInBytes(samples.size * 4)
                    .build()
            check(next.state == AudioTrack.STATE_INITIALIZED) { "Audio output unavailable" }
            track = next
            check(next.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING) == samples.size) {
                "Tone output failed"
            }
            next.play()
        } catch (e: Exception) {
            stop()
            throw e
        }
    }

    @Synchronized
    fun stop() {
        track?.let {
            try {
                it.pause()
                it.flush()
            } catch (_: Exception) {}
            it.release()
        }
        track = null
        manager.abandonAudioFocusRequest(focus)
    }
}
