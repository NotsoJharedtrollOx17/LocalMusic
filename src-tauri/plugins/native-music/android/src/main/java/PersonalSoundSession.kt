package com.plugin.native_music

import android.os.SystemClock
import java.util.UUID
import kotlin.math.*
import org.json.JSONArray
import org.json.JSONObject

class PersonalSoundSession(private val replaceId: String? = null) {
    val view =
        JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("phase", "test")
            .put("ear", 0)
            .put("step", 0)
            .put("frequency", 1000)
            .put("level", -54)
            .put("awaiting", false)
            .put("busyUntil", 0)
            .put("message", "")
            .put("strength", 50)
    private val values = Array(2) { arrayOfNulls<Int>(6) }
    private var lease = SystemClock.elapsedRealtime() + 2000
    private var end = 0L
    private var next = 0L

    fun alive() =
        view.getString("phase") != "cancelled" &&
            (view.getString("phase") == "saved" || SystemClock.elapsedRealtime() < lease)

    fun heartbeat() {
        check(alive()) { "Sound setup expired. Start again." }
        lease = SystemClock.elapsedRealtime() + 2000
    }

    fun cancel() {
        view.put("phase", "cancelled").put("awaiting", false)
        discard()
    }

    fun discard() {
        for (v in values) v.fill(null)
    }

    fun pulse(): FloatArray {
        heartbeat()
        val now = SystemClock.elapsedRealtime()
        check(view.getString("phase") == "test" && now >= next) {
            "Wait before playing another tone"
        }
        end = now + 800
        next = end + 500
        view.put("awaiting", true).put("busyUntil", System.currentTimeMillis() + 800)
        return tone(view.getInt("frequency"), view.getInt("level"), view.getInt("ear"))
    }

    fun respond(heard: Boolean) {
        heartbeat()
        check(
            view.getString("phase") == "test" &&
                view.getBoolean("awaiting") &&
                SystemClock.elapsedRealtime() >= end
        ) {
            "Play the tone and wait for it to finish first"
        }
        view.put("awaiting", false)
        val level = view.getInt("level")
        if (!heard && level < -36) {
            view.put("level", level + 6)
            return
        }
        val ear = view.getInt("ear")
        val step = view.getInt("step")
        val value = if (heard) level else null
        if (step == 0 && value == null) {
            view.put("phase", "retry").put("message", "reference-unheard")
            return
        }
        if (step < 6) values[ear][step] = value
        else if (value == null || abs(value - (values[ear][0] ?: 0)) > 6) {
            view.put("phase", "retry").put("message", "reference-inconsistent")
            return
        }
        if (step == 6) {
            if (ear == 1) {
                view.put("phase", "compare")
                return
            }
            view.put("ear", 1).put("step", 0)
        } else view.put("step", step + 1)
        view.put("frequency", frequencies[view.getInt("step")]).put("level", -54)
    }

    fun retry() {
        heartbeat()
        values[view.getInt("ear")].fill(null)
        view
            .put("phase", "test")
            .put("step", 0)
            .put("frequency", 1000)
            .put("level", -54)
            .put("awaiting", false)
            .put("message", "")
    }

    fun profile(name: String): JSONObject {
        check(
            view.getString("phase") == "compare" && name.trim().isNotEmpty() && name.length <= 60
        ) {
            "Finish setup and provide a name (1-60 characters)"
        }
        return JSONObject()
            .put("id", replaceId ?: UUID.randomUUID().toString())
            .put("name", name.trim())
            .put("left", JSONArray(derive(values[0]).toList()))
            .put("right", JSONArray(derive(values[1]).toList()))
            .put("complete", JSONArray(values.flatMap { ear -> ear.map { it != null } }))
    }

    companion object {
        val frequencies = intArrayOf(1000, 250, 500, 2000, 4000, 8000, 1000)

        fun derive(values: Array<Int?>): DoubleArray {
            val fs = doubleArrayOf(250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0)
            val indexes = intArrayOf(1, 2, 0, 3, 4, 5)
            return DoubleArray(10) { n ->
                val f = SoundConfiguration.frequencies[n]
                val ref = values[0]
                if (ref == null || f < 250 || f > 8000) 0.0
                else {
                    val i = fs.indexOfFirst { it >= f }
                    val j = max(0, i - 1)
                    val a = values[indexes[j]]
                    val b = values[indexes[i]]
                    if (f == fs[i]) ((b ?: ref) - ref).toDouble().coerceIn(0.0, 6.0)
                    else if (a == null || b == null) 0.0
                    else {
                        val t = if (i == j) 0.0 else ln(f / fs[j]) / ln(fs[i] / fs[j])
                        (a + (b - a) * t - ref).coerceIn(0.0, 6.0)
                    }
                }
            }
        }

        fun tone(f: Int, level: Int, ear: Int): FloatArray {
            require(
                frequencies.contains(f) &&
                    intArrayOf(-54, -48, -42, -36).contains(level) &&
                    ear in 0..1
            )
            val out = FloatArray(76800)
            for (i in 0 until 38400) {
                val fade = min(1.0, min(i / 4800.0, (38399 - i) / 4800.0)).coerceAtLeast(0.0)
                out[i * 2 + ear] =
                    (sin(2 * PI * f * i / 48000) * 10.0.pow(level / 20.0) * fade).toFloat()
            }
            return out
        }
    }
}
