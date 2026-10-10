package com.plugin.native_music

import kotlin.math.*

data class PreparedSound(
    val bank: Array<Array<DoubleArray>>,
    val gain: Double,
    val bypass: Boolean,
    val attenuation: Double,
    val generation: Long,
)

object SoundMath {
    fun coefficients(f: Double, gain: Double, rate: Double): DoubleArray {
        if (gain == 0.0 || f >= rate / 2) return doubleArrayOf(1.0, 0.0, 0.0, 0.0, 0.0)
        val a = 10.0.pow(gain / 40)
        val w = 2 * PI * f / rate
        val alpha = sin(w) / (2 * 1.4)
        val a0 = 1 + alpha / a
        return doubleArrayOf(
            (1 + alpha * a) / a0,
            -2 * cos(w) / a0,
            (1 - alpha * a) / a0,
            -2 * cos(w) / a0,
            (1 - alpha / a) / a0,
        )
    }

    fun bank(curves: Array<DoubleArray>, rate: Double) =
        Array(2) { ch ->
            Array(10) { i -> coefficients(SoundConfiguration.frequencies[i], curves[ch][i], rate) }
        }

    fun response(c: DoubleArray, f: Double, rate: Double): Double {
        val w = 2 * PI * f / rate
        val nr = c[0] + c[1] * cos(w) + c[2] * cos(2 * w)
        val ni = -c[1] * sin(w) - c[2] * sin(2 * w)
        val dr = 1 + c[3] * cos(w) + c[4] * cos(2 * w)
        val di = -c[3] * sin(w) - c[4] * sin(2 * w)
        return 10 * log10((nr * nr + ni * ni) / (dr * dr + di * di))
    }

    fun headroom(bank: Array<Array<DoubleArray>>, rate: Double): Double {
        var peak = 0.0
        for (i in 0 until 4096) {
            val f = 20 * (rate * .499 / 20).pow(i / 4095.0)
            for (ear in bank) peak = max(peak, ear.sumOf { response(it, f, rate) })
        }
        return if (peak > .0001) peak + 1 else 0.0
    }
}

private class SoundFilters(val prepared: PreparedSound, channels: Int) {
    val memory = Array(channels) { Array(10) { DoubleArray(2) } }

    fun process(frame: DoubleArray) {
        if (prepared.bypass) return
        for (ch in frame.indices) {
            var out = frame[ch] * prepared.gain
            for (i in 0..9) {
                val c = prepared.bank[min(ch, 1)][i]
                val s = memory[ch][i]
                val y = c[0] * out + s[0]
                s[0] = c[1] * out - c[3] * y + s[1]
                s[1] = c[2] * out - c[4] * y
                out = y
            }
            frame[ch] = out
        }
    }
}

class SoundDsp(prepared: PreparedSound, private val rate: Int, channels: Int) {
    private var current = SoundFilters(prepared, channels)
    private var old: SoundFilters? = null
    private var remaining = 0
    private val total = max(1, (rate * .02).roundToInt())
    private var limiter = 1.0
    private val release = exp(-1.0 / (rate * .05))
    private val scratch = DoubleArray(channels)

    fun configure(prepared: PreparedSound) {
        old = current
        current = SoundFilters(prepared, scratch.size)
        remaining = total
    }

    fun process(frame: DoubleArray) {
        frame.copyInto(scratch)
        current.process(frame)
        if (remaining > 0) {
            old?.let {
                it.process(scratch)
                val blend = 1 - remaining.toDouble() / total
                for (i in frame.indices) frame[i] = scratch[i] * (1 - blend) + frame[i] * blend
            }
            if (--remaining == 0) old = null
        }
        if (current.prepared.bypass && old == null) return
        val peak = frame.maxOf { abs(it) }
        val target = min(1.0, 10.0.pow(-1.0 / 20) / max(peak, 1e-12))
        limiter = min(target, 1 - (1 - limiter) * release)
        for (i in frame.indices) frame[i] *= limiter
    }

    fun reset() {
        for (ear in current.memory) for (state in ear) state.fill(0.0)
        old = null
        remaining = 0
        limiter = 1.0
    }
}
