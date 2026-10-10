package com.plugin.native_music

import org.json.JSONArray
import org.json.JSONObject

class SoundConfiguration(val json: JSONObject) {
    val enabled = json.getBoolean("enabled")
    val personalEnabled = json.getBoolean("personalEnabled")
    val strength = json.getDouble("strength")
    val preamp = json.getDouble("preamp")
    val gains = curve(json.getJSONArray("gains"), -12.0, 12.0)

    init {
        require(
            json.getInt("version") == 1 &&
                preamp.isFinite() &&
                preamp in -12.0..12.0 &&
                strength.isFinite() &&
                strength in 0.0..100.0
        )
        val presets = json.getJSONArray("presets")
        val profiles = json.getJSONArray("profiles")
        require(presets.length() <= 100 && profiles.length() <= 100)
        val ids =
            mutableSetOf("flat", "pop", "rock", "jazz", "classical", "bass", "treble", "voice")
        for (i in 0 until presets.length()) {
            val p = presets.getJSONObject(i)
            name(p.getString("id"))
            name(p.getString("name"))
            require(ids.add(p.getString("id")))
            curve(p.getJSONArray("gains"), -12.0, 12.0)
            require(p.getDouble("preamp").isFinite() && p.getDouble("preamp") in -12.0..12.0)
        }
        ids.clear()
        for (i in 0 until profiles.length()) {
            val p = profiles.getJSONObject(i)
            name(p.getString("id"))
            name(p.getString("name"))
            require(ids.add(p.getString("id")))
            curve(p.getJSONArray("left"), 0.0, 6.0)
            curve(p.getJSONArray("right"), 0.0, 6.0)
            val complete = p.getJSONArray("complete")
            require(complete.length() == 12)
            for (j in 0..11) complete.getBoolean(j)
        }
        if (!json.isNull("profileId")) require(ids.contains(json.getString("profileId")))
        require(!personalEnabled || !json.isNull("profileId"))
    }

    fun curves(bypass: Boolean, channels: Int): Array<DoubleArray> {
        val profiles = json.getJSONArray("profiles")
        var profile: JSONObject? = null
        if (personalEnabled && !bypass && channels <= 2)
            for (i in 0 until profiles.length()) {
                val p = profiles.getJSONObject(i)
                if (p.getString("id") == json.optString("profileId")) profile = p
            }
        return Array(2) { ch ->
            val personal = profile?.getJSONArray(if (ch == 0) "left" else "right")
            DoubleArray(10) { i ->
                (if (enabled && !bypass && profile == null) gains[i] else 0.0) +
                    (personal?.getDouble(i) ?: 0.0) * strength / 100.0
            }
        }
    }

    companion object {
        val frequencies =
            doubleArrayOf(31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0)

        fun defaults() =
            JSONObject(
                """{"version":1,"enabled":false,"gains":[0,0,0,0,0,0,0,0,0,0],"preamp":0,"presetId":"flat","presets":[],"profiles":[],"profileId":null,"personalEnabled":false,"strength":100}"""
            )

        fun copy(json: JSONObject) = JSONObject(json.toString())

        private fun name(value: String) {
            require(value.trim().isNotEmpty() && value.length <= 60)
        }

        private fun curve(array: JSONArray, min: Double, max: Double): DoubleArray {
            require(array.length() == 10)
            return DoubleArray(10) { i ->
                array.getDouble(i).also { require(it.isFinite() && it in min..max) }
            }
        }
    }
}
