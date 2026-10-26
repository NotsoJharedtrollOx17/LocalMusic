package com.plugin.native_music

import kotlin.math.*
import org.json.JSONArray
import org.json.JSONObject

data class VisualizerFrame(
    val spectrum: DoubleArray, val waveform: DoubleArray, val rms: Double,
    val bass: Double, val mid: Double, val treble: Double, val onset: Double,
    var generation: Long = 0, var sequence: Long = 0,
    var positionMs: Double = 0.0, var sampleRate: Int = 48000,
) {
    fun json() = JSONObject()
        .put("generation", generation).put("sequence", sequence)
        .put("positionMs", positionMs).put("sampleRate", sampleRate)
        .put("spectrum", JSONArray(spectrum.toList())).put("waveform", JSONArray(waveform.toList()))
        .put("rms", rms).put("bass", bass).put("mid", mid).put("treble", treble).put("onset", onset)
}

/** Same Blackman-windowed, channel-power FFT as the Rust and browser workers. */
class VisualizerAnalysis {
    companion object { const val N = 2048 }
    private val real = DoubleArray(N)
    private val imag = DoubleArray(N)
    private val power = DoubleArray(N / 2 + 1)
    private val window = DoubleArray(N) { .42 - .5 * cos(2 * PI * it / (N - 1)) + .08 * cos(4 * PI * it / (N - 1)) }
    private val cosine = DoubleArray(N / 2) { cos(2 * PI * it / N) }
    private val sine = DoubleArray(N / 2) { -sin(2 * PI * it / N) }
    private var previous = 0.0

    fun analyze(left: DoubleArray, right: DoubleArray, rate: Int): VisualizerFrame {
        power.fill(0.0)
        var lp = 0.0
        var rp = 0.0
        for (channel in 0..1) {
            val samples = if (channel == 0) left else right
            for (i in 0 until N) {
                val v = if (samples[i].isFinite()) samples[i] else 0.0
                if (channel == 0) lp += v * v else rp += v * v
                real[i] = v * window[i]; imag[i] = 0.0
            }
            var j = 0
            for (i in 1 until N) {
                var bit = N shr 1
                while (j and bit != 0) { j = j xor bit; bit = bit shr 1 }
                j = j xor bit
                if (i < j) { val v = real[i]; real[i] = real[j]; real[j] = v }
            }
            var size = 2
            while (size <= N) {
                val half = size / 2
                val step = N / size
                for (base in 0 until N step size) for (k in 0 until half) {
                    val a = base + k; val b = a + half
                    val c = cosine[k * step]; val s = sine[k * step]
                    val re = c * real[b] - s * imag[b]
                    val im = s * real[b] + c * imag[b]
                    real[b] = real[a] - re; imag[b] = imag[a] - im
                    real[a] += re; imag[a] += im
                }
                size *= 2
            }
            for (i in 0..N / 2) power[i] += (real[i] * real[i] + imag[i] * imag[i]) / 2
        }
        val upper = min(20000.0, rate / 2.0).coerceAtLeast(41.0)
        val spectrum = DoubleArray(64) { b ->
            val lo = floor(40 * (upper / 40).pow(b / 64.0) * N / rate).toInt().coerceAtLeast(1)
            val hi = ceil(40 * (upper / 40).pow((b + 1) / 64.0) * N / rate).toInt().coerceAtLeast(lo).coerceAtMost(N / 2)
            var peak = 0.0
            for (k in lo..hi) peak = max(peak, power[k])
            val db = 20 * log10(max(1e-12, 2 * sqrt(peak) / (N * .42)))
            ((db + 72) / 72).coerceIn(0.0, 1.0)
        }
        val wave = if (rp > lp) right else left
        val waveform = DoubleArray(256)
        for (i in 0 until 128) {
            var low = 1.0; var high = -1.0
            for (j in i * 16 until (i + 1) * 16) {
                val x = if (wave[j].isFinite()) wave[j] else 0.0
                low = min(low, x); high = max(high, x)
            }
            waveform[i * 2] = max(-1.0, low); waveform[i * 2 + 1] = min(1.0, high)
        }
        val rms = sqrt((lp + rp) / (2 * N))
        val onset = ((rms - previous) * 8).coerceIn(0.0, 1.0)
        previous = rms
        return VisualizerFrame(spectrum, waveform, rms,
            spectrum.take(20).max(), spectrum.slice(20..41).max(), spectrum.drop(42).max(), onset, sampleRate = rate)
    }
}
