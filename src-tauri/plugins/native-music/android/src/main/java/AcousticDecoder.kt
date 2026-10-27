package com.plugin.native_music

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.SystemClock
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import org.json.JSONObject

object PlaylistScanGate {
    val foreground = AtomicBoolean(true)
    private val deadline = AtomicLong(0)
    private val epoch = AtomicLong(0)
    val playbackRequested = AtomicBoolean(false)

    fun activity(active: Boolean) {
        if (active && foreground.get() && !playbackRequested.get())
            deadline.set(SystemClock.elapsedRealtime() + 4000)
        else stop()
    }

    fun stop() {
        deadline.set(0)
        epoch.incrementAndGet()
    }

    fun token() = epoch.get()

    fun allowed(token: Long) =
        foreground.get() &&
            token == epoch.get() &&
            SystemClock.elapsedRealtime() < deadline.get() &&
            !playbackRequested.get()
}

class AcousticDecoder(private val context: Context) {
    fun fingerprint(uri: Uri): String {
        var size = -1L
        var modified = -1L
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                for (name in listOf("_size", "size")) {
                    val i = c.getColumnIndex(name)
                    if (i >= 0 && !c.isNull(i)) size = c.getLong(i)
                }
                for (name in listOf("last_modified", "date_modified")) {
                    val i = c.getColumnIndex(name)
                    if (i >= 0 && !c.isNull(i)) modified = c.getLong(i)
                }
            }
        }
        require(size >= 0 && modified >= 0) { "Source version unavailable" }
        return "$uri|$size|$modified"
    }

    fun decode(uri: Uri, durationMs: Long): JSONObject? {
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND)
        val token = PlaylistScanGate.token()
        if (!PlaylistScanGate.allowed(token)) return null
        val before = fingerprint(uri)
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            extractor.setDataSource(context, uri, null)
            val index =
                (0 until extractor.trackCount).firstOrNull {
                    extractor
                        .getTrackFormat(it)
                        .getString(MediaFormat.KEY_MIME)
                        ?.startsWith("audio/") == true
                } ?: return null
            extractor.selectTrack(index)
            val format = extractor.getTrackFormat(index)
            val decoder = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
            codec = decoder
            decoder.configure(format, null, null, 0)
            decoder.start()
            val duration =
                if (format.containsKey(MediaFormat.KEY_DURATION))
                    format.getLong(MediaFormat.KEY_DURATION) / 1e6
                else durationMs / 1000.0
            val analysis = AcousticAnalysis()
            val info = MediaCodec.BufferInfo()
            for ((start, end) in AcousticAnalysis.excerpts(duration)) {
                if (!PlaylistScanGate.allowed(token)) return null
                extractor.seekTo((start * 1e6).toLong(), MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
                decoder.flush()
                var inputDone = false
                var outputDone = false
                var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                var count = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                var encoding = android.media.AudioFormat.ENCODING_PCM_16BIT
                var block = Array(count.coerceIn(1, 8)) { FloatArray(AcousticAnalysis.N) }
                var filled = 0
                val limit = SystemClock.elapsedRealtime() + 30000
                while (
                    !outputDone &&
                        PlaylistScanGate.allowed(token) &&
                        SystemClock.elapsedRealtime() < limit
                ) {
                    if (!inputDone) {
                        val i = decoder.dequeueInputBuffer(5000)
                        if (i >= 0) {
                            val buffer = decoder.getInputBuffer(i)!!
                            val time = extractor.sampleTime
                            val n =
                                if (time < 0 || time >= end * 1e6) -1
                                else extractor.readSampleData(buffer, 0)
                            if (n < 0) {
                                decoder.queueInputBuffer(
                                    i,
                                    0,
                                    0,
                                    0,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                                )
                                inputDone = true
                            } else {
                                decoder.queueInputBuffer(i, 0, n, time, 0)
                                extractor.advance()
                            }
                        }
                    }
                    val i = decoder.dequeueOutputBuffer(info, 5000)
                    if (i == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        val f = decoder.outputFormat
                        rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        count = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        encoding =
                            if (f.containsKey(MediaFormat.KEY_PCM_ENCODING))
                                f.getInteger(MediaFormat.KEY_PCM_ENCODING)
                            else android.media.AudioFormat.ENCODING_PCM_16BIT
                        if (
                            count !in 1..8 ||
                                rate !in 8000..192000 ||
                                encoding !in
                                    listOf(
                                        android.media.AudioFormat.ENCODING_PCM_16BIT,
                                        android.media.AudioFormat.ENCODING_PCM_FLOAT,
                                    )
                        )
                            return null
                        block = Array(count) { FloatArray(AcousticAnalysis.N) }
                        filled = 0
                    }
                    if (i >= 0) {
                        val buffer = decoder.getOutputBuffer(i)!!.order(ByteOrder.LITTLE_ENDIAN)
                        buffer.position(info.offset)
                        buffer.limit(info.offset + info.size)
                        val bytes =
                            if (encoding == android.media.AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
                        var frame = 0
                        while (buffer.remaining() >= count * bytes) {
                            val time = info.presentationTimeUs / 1e6 + frame.toDouble() / rate
                            for (c in 0 until count) {
                                val v = if (bytes == 4) buffer.float else buffer.short / 32768f
                                if (time >= start && time < end) block[c][filled] = v
                            }
                            if (time >= start && time < end) {
                                filled++
                                if (filled == AcousticAnalysis.N) {
                                    analysis.add(block, rate)
                                    filled = 0
                                }
                            }
                            frame++
                        }
                        outputDone =
                            info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0 ||
                                info.presentationTimeUs >= end * 1e6
                        decoder.releaseOutputBuffer(i, false)
                    }
                }
                if (!outputDone) return null
            }
            if (!PlaylistScanGate.allowed(token) || fingerprint(uri) != before) return null
            return analysis.finish()
        } finally {
            try {
                codec?.stop()
            } catch (_: Exception) {}
            codec?.release()
            extractor.release()
        }
    }
}
