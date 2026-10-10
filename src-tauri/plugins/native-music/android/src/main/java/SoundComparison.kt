package com.plugin.native_music

import kotlin.math.*
import org.json.JSONArray
import org.json.JSONObject

object SoundComparison {
    fun render(profile: JSONObject, strength: Double, personal: Boolean): FloatArray {
        val config =
            SoundConfiguration.defaults()
                .put("personalEnabled", true)
                .put("profileId", profile.getString("id"))
                .put("profiles", JSONArray().put(profile))
                .put("strength", strength)
        val bank = SoundMath.bank(SoundConfiguration(config).curves(false, 2), 48000.0)
        val attenuation = SoundMath.headroom(bank, 48000.0)
        val dsp =
            SoundDsp(
                PreparedSound(bank, 10.0.pow(-attenuation / 20), false, attenuation, 0),
                48000,
                2,
            )
        val original = DoubleArray(384000)
        val processed = DoubleArray(384000)
        val notes = doubleArrayOf(220.0, 261.63, 329.63, 293.66)
        val frame = DoubleArray(2)
        var a = 0.0
        var b = 0.0
        for (i in 0 until 192000) {
            val t = i / 48000.0
            val local = t % 1
            val env = min(1.0, min(local / .05, (1 - local) / .1))
            val w = 2 * PI * notes[t.toInt()] * t
            val x = (sin(w) + .3 * sin(2 * w) + .15 * sin(4 * w)) * .025 * env
            frame[0] = x
            frame[1] = x
            dsp.process(frame)
            original[i * 2] = x
            original[i * 2 + 1] = x
            processed[i * 2] = frame[0]
            processed[i * 2 + 1] = frame[1]
            a += 2 * x * x
            b += frame[0] * frame[0] + frame[1] * frame[1]
        }
        val gain = sqrt(min(a, b) / max(if (personal) b else a, 1e-20))
        val source = if (personal) processed else original
        return FloatArray(source.size) { (source[it] * gain).toFloat() }
    }
}
