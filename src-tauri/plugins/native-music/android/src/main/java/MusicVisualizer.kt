package com.plugin.native_music

import java.util.concurrent.atomic.AtomicIntegerArray
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicLongArray
import kotlin.math.abs
import kotlin.math.max

/** Single PCM writer and worker. Audio never waits for a visual frame. */
class MusicVisualizer {
    companion object { const val CAP = 131072; const val N = 2048 }
    private val left = AtomicIntegerArray(CAP)
    private val right = AtomicIntegerArray(CAP)
    private val positions = AtomicLongArray(CAP)
    private val epochs = AtomicLongArray(CAP)
    private val tickets = AtomicLongArray(CAP)
    private val cursor = AtomicLong(0)
    private val epoch = AtomicLong(1)
    private val session = AtomicLong(0)
    @Volatile private var active = false
    @Volatile private var deadline = 0L
    @Volatile private var rate = 48000
    @Volatile private var position = 0L
    @Volatile private var playing = false
    @Volatile private var latest: VisualizerFrame? = null
    @Volatile private var failure = false

    private fun now() = System.nanoTime() / 1_000_000
    fun reset(rate: Int): Long { this.rate = rate; return epoch.incrementAndGet() }
    fun invalidate() { epoch.incrementAndGet(); latest = null }

    fun capture(generation: Long, frame: DoubleArray, positionMs: Double) {
        if (!active || epoch.get() != generation) return
        var l = frame[0]
        var r = frame.getOrElse(1) { l }
        // Keep the strongest channel on each side, including surround-only content.
        for (ch in 2 until frame.size) {
            val x = frame[ch]
            if (ch % 2 == 0) { if (abs(x) > abs(l)) l = x }
            else if (abs(x) > abs(r)) r = x
        }
        val count = cursor.get()
        val slot = (count % CAP).toInt()
        tickets.set(slot, 0)
        epochs.set(slot, 0)
        left.set(slot, l.toFloat().toRawBits())
        right.set(slot, r.toFloat().toRawBits())
        positions.set(slot, (positionMs * 1000).toLong())
        epochs.set(slot, generation)
        tickets.set(slot, count + 1)
        cursor.lazySet(count + 1)
    }

    @Synchronized fun start(): String {
        val id = session.incrementAndGet()
        latest = null; failure = false; deadline = now() + 3000; active = true
        Thread({
            try { run(id) }
            catch (error: Exception) {
                if (session.get() == id) { failure = true; active = false }
            }
        }, "music-visualizer").start()
        return id.toString()
    }

    fun clock(positionMs: Long, isPlaying: Boolean) { position = positionMs; playing = isPlaying }
    fun running() = active && now() <= deadline
    fun read(id: String): VisualizerFrame? {
        check(id.toLongOrNull() == session.get() && running() && !failure) { "Audio analysis unavailable" }
        deadline = now() + 3000
        return latest?.takeIf {
            playing && it.generation == epoch.get() && it.positionMs <= position + 25 && position - it.positionMs < 160
        }
    }
    @Synchronized fun stop(id: String) {
        if (id.toLongOrNull() == session.get()) { active = false; latest = null }
    }
    fun stopAll() { active = false; latest = null; session.incrementAndGet() }

    private fun run(id: Long) {
        var analyzer = VisualizerAnalysis()
        val l = DoubleArray(N)
        val r = DoubleArray(N)
        var previous = 0L
        var last = 0L
        var sequence = 0L
        while (active && session.get() == id && now() <= deadline) {
            if (playing) {
                val count = cursor.get()
                val generation = epoch.get()
                val sampleRate = rate
                // Select a window centered on the real Media3 playback position.
                val target = position * 1000 + N * 500000L / sampleRate
                var end = count
                while (end > max(0, count - CAP) && end > 0) {
                    val slot = ((end - 1) % CAP).toInt()
                    if (epochs.get(slot) != generation || positions.get(slot) <= target) break
                    end--
                }
                if (end >= N && end != last) {
                    var valid = true
                    for (i in 0 until N) {
                        val slot = ((end - N + i) % CAP).toInt()
                        val ticket = end - N + i + 1
                        if (epochs.get(slot) != generation || tickets.get(slot) != ticket) { valid = false; break }
                        l[i] = Float.fromBits(left.get(slot)).toDouble()
                        r[i] = Float.fromBits(right.get(slot)).toDouble()
                        if (epochs.get(slot) != generation || tickets.get(slot) != ticket) { valid = false; break }
                    }
                    if (valid && generation == epoch.get()) {
                        if (previous != generation) { analyzer = VisualizerAnalysis(); previous = generation }
                        val result = analyzer.analyze(l, r, sampleRate)
                        result.generation = generation
                        result.sequence = ++sequence
                        result.positionMs = positions.get(((end - 1) % CAP).toInt()) / 1000.0 - N * 500.0 / sampleRate
                        if (active && session.get() == id) latest = result
                        last = end
                    }
                }
            }
            Thread.sleep(34)
        }
        if (session.get() == id) { active = false; latest = null }
    }
}
