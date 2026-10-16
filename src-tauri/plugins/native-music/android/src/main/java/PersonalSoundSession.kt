package com.plugin.native_music

import android.os.SystemClock
import java.util.UUID
import kotlin.math.*
import org.json.JSONArray
import org.json.JSONObject

class PersonalSoundSession(private val replaceId: String? = null,
    private val clock: () -> Long = SystemClock::elapsedRealtime,
    private val wallClock: () -> Long = System::currentTimeMillis) {
    private var calibration = SoundCalibration()
    val view = JSONObject().put("id", UUID.randomUUID().toString()).put("trialId", UUID.randomUUID().toString())
        .put("phase", "test").put("resumePhase", "test").put("ear", 0).put("step", 0).put("frequency", 1000).put("level", -54)
        .put("awaiting", false).put("busyUntil", 0).put("message", "").put("strength", 100)
        .put("answeredTrials", 0).put("totalTrials", 36).put("estimates", calibration.estimates())
        .put("left", JSONArray(List(10) { 0.0 })).put("right", JSONArray(List(10) { 0.0 }))
    private var lease = clock() + 2000
    private var end = 0L
    private var next = 0L
    fun alive() = view.getString("phase") != "cancelled" && (view.getString("phase") in listOf("saved", "paused") || clock() < lease)
    fun heartbeat() {
        if (!alive()) { pause(); check(view.getString("phase") != "cancelled") { "Sound setup is no longer active" } }
        lease = clock() + 2000
    }
    fun pause() {
        if (view.getString("phase") !in listOf("test", "compare", "retry")) return
        view.put("resumePhase", view.getString("phase")).put("phase", "paused")
            .put("awaiting", false).put("busyUntil", 0).put("trialId", UUID.randomUUID().toString())
    }
    fun resume(trial: String) {
        check(view.getString("phase") == "paused" && trial.isNotEmpty() && trial == view.getString("trialId")) { "Stale sound setup pause" }
        view.put("phase", view.getString("resumePhase")).put("trialId", UUID.randomUUID().toString())
            .put("busyUntil", wallClock())
        lease = clock() + 2000
        next = clock() + 500
    }
    private fun checkTrial(trial: String) {
        check(trial.isNotEmpty() && trial == view.getString("trialId") && view.getString("phase") == "test") { "Stale sound setup trial" }
    }
    fun pulse(trial: String): FloatArray {
        heartbeat(); checkTrial(trial)
        val now = clock()
        check(now >= next) { "Wait before playing another tone" }
        end = now + 3400; next = end + 500
        view.put("awaiting", true).put("busyUntil", wallClock() + 3400)
        return tone(view.getInt("frequency"), view.getInt("level"), view.getInt("ear"))
    }
    fun respond(heard: Boolean, trial: String) {
        heartbeat(); checkTrial(trial)
        check(view.getBoolean("awaiting") && clock() >= end) { "Play the tone and wait for it to finish first" }
        calibration.answer(heard)
        view.put("awaiting", false).put("trialId", if (calibration.done) "" else UUID.randomUUID().toString())
            .put("answeredTrials", calibration.answered).put("estimates", calibration.estimates())
        updateCurves()
        if (calibration.done) view.put("phase", "compare") else view.put("ear", calibration.ear)
            .put("step", calibration.step).put("frequency", frequencies[calibration.step]).put("level", calibration.level)
    }
    private fun updateCurves() {
        view.put("left", JSONArray(derive(calibration.values(0)).toList()))
            .put("right", JSONArray(derive(calibration.values(1)).toList()))
    }
    fun retry() {
        heartbeat(); calibration = SoundCalibration(); updateCurves()
        view.put("phase", "test").put("trialId", UUID.randomUUID().toString()).put("answeredTrials", 0)
            .put("ear", 0).put("step", 0).put("frequency", 1000).put("level", -54).put("awaiting", false)
            .put("message", "").put("estimates", calibration.estimates())
    }
    fun profile(name: String): JSONObject {
        check(view.getString("phase") == "compare" && name.trim().isNotEmpty() && name.length <= 60) { "Finish setup and provide a name (1-60 characters)" }
        return JSONObject().put("id", replaceId ?: UUID.randomUUID().toString()).put("name", name.trim())
            .put("left", JSONArray(derive(calibration.values(0)).toList())).put("right", JSONArray(derive(calibration.values(1)).toList()))
            .put("complete", JSONArray((0..11).map { calibration.status(it) == "bracketed" })).put("calibration", calibration.metadata())
    }
    fun cancel() { view.put("phase", "cancelled").put("awaiting", false).put("trialId", ""); discard() }
    fun discard() { calibration = SoundCalibration(); updateCurves(); view.put("estimates", JSONArray()) }

    companion object {
        val frequencies = SoundCalibration.frequencies

        fun derive(values: Array<Double?>): DoubleArray {
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
                    SoundCalibration.levels.contains(level) &&
                    ear in 0..1
            )
            val out = FloatArray(326400)
            for (i in 0 until 163200) {
                val local = i % 62400
                if (local >= 38400) continue
                val fade =
                    min(1.0, min(local / 4800.0, (38399 - local) / 4800.0)).coerceAtLeast(0.0)
                out[i * 2 + ear] =
                    (sin(2 * PI * f * local / 48000) * 10.0.pow(level / 20.0) * fade).toFloat()
            }
            return out
        }
    }
}
