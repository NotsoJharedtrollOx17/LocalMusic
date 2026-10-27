package com.plugin.native_music

import kotlin.math.*
import org.json.JSONArray
import org.json.JSONObject

/** Source descriptors. Independent of the player, EQ, limiter and listening journal. */
class AcousticAnalysis {
    companion object {
        const val N = 2048

        fun excerpts(duration: Double): List<Pair<Double, Double>> {
            if (!duration.isFinite() || duration <= 0) return emptyList()
            if (duration <= 24) return listOf(0.0 to duration)
            val out = mutableListOf<Pair<Double, Double>>()
            for (r in listOf(.15, .5, .85)) {
                val a =
                    (duration * r - 4)
                        .coerceAtLeast(out.lastOrNull()?.second ?: 0.0)
                        .coerceAtMost(duration - 8)
                if (out.isEmpty() || a >= out.last().second) out.add(a to a + 8)
            }
            return out
        }
    }

    private val real = DoubleArray(N)
    private val imag = DoubleArray(N)
    private val window = DoubleArray(N) { .5 - .5 * cos(2 * PI * it / (N - 1)) }
    private val cosine = DoubleArray(N / 2) { cos(2 * PI * it / N) }
    private val sine = DoubleArray(N / 2) { -sin(2 * PI * it / N) }
    private val bands = DoubleArray(32)
    private var seconds = 0.0

    fun add(channels: Array<FloatArray>, rate: Int) {
        if (rate !in 8000..192000 || channels.isEmpty() || channels.size > 8) return
        for (offset in 0 until channels[0].size / N * N step N) {
            for (channel in channels) {
                for (i in 0 until N) {
                    real[i] =
                        (if (channel[offset + i].isFinite()) channel[offset + i].toDouble()
                        else 0.0) * window[i]
                    imag[i] = 0.0
                }
                var j = 0
                for (i in 1 until N) {
                    var bit = N shr 1
                    while (j and bit != 0) {
                        j = j xor bit
                        bit = bit shr 1
                    }
                    j = j xor bit
                    if (i < j) {
                        val x = real[i]
                        real[i] = real[j]
                        real[j] = x
                    }
                }
                var size = 2
                while (size <= N) {
                    for (base in 0 until N step size) for (k in 0 until size / 2) {
                        val a = base + k
                        val b = a + size / 2
                        val c = cosine[k * N / size]
                        val s = sine[k * N / size]
                        val re = c * real[b] - s * imag[b]
                        val im = s * real[b] + c * imag[b]
                        real[b] = real[a] - re
                        imag[b] = imag[a] - im
                        real[a] += re
                        imag[a] += im
                    }
                    size *= 2
                }
                for (k in 1..N / 2) {
                    val hz = k.toDouble() * rate / N
                    if (hz < 40 || hz >= 20000) continue
                    val b = floor(ln(hz / 40) / ln(500.0) * 32).toInt().coerceAtMost(31)
                    bands[b] +=
                        (real[k] * real[k] + imag[k] * imag[k]) / (N * N * channels.size).toDouble()
                }
            }
            seconds += N.toDouble() / rate
        }
    }

    fun finish(): JSONObject? {
        val sum = bands.sum()
        if (seconds < .1 || sum / seconds < 1e-10) return null
        return JSONObject()
            .put("version", 1)
            .put("fingerprint", "")
            .put("seconds", seconds)
            .put("bands", JSONArray(bands.map { it / sum }))
    }
}
