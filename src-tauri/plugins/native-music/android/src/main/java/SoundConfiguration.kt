package com.plugin.native_music

import org.json.JSONArray
import org.json.JSONObject

class SoundConfiguration(input: JSONObject) {
    val json = normalize(input)
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
        require(presets.length() <= 101 && profiles.length() <= 100)
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
            if (p.has("calibration") && !p.isNull("calibration")) {
                val metadata = p.getJSONObject("calibration")
                require(metadata.getString("method") == "bounded-3-v1")
                val coverage = metadata.getJSONArray("coverage")
                require(coverage.length() == 12)
                for (j in 0..11) require(coverage.getString(j) in listOf("bracketed", "below-floor", "above-ceiling"))
            }
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
                if (i == 0) 0.0
                else
                    (if (enabled && !bypass && profile == null) gains[i] else 0.0) +
                        (personal?.getDouble(i) ?: 0.0) * strength / 100.0
            }
        }
    }

    companion object {
        val frequencies =
            doubleArrayOf(31.0, 63.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0)

        fun defaults() =
            JSONObject(
                """{"version":1,"enabled":true,"gains":[0,0,0,0,0,0,0,0,0,0],"preamp":0,"presetId":"flat","presets":[],"profiles":[],"profileId":null,"personalEnabled":false,"strength":100}"""
            )

        /** Preserve old named records while upgrading the single Custom slot. */
        fun normalize(input: JSONObject): JSONObject {
            input.getBoolean("enabled")
            val legacyPreamp = input.getDouble("preamp")
            require(legacyPreamp.isFinite() && legacyPreamp in -12.0..12.0)
            val legacyStrength = input.getDouble("strength")
            require(legacyStrength.isFinite() && legacyStrength in 0.0..100.0)
            val presetIds =
                mutableSetOf("flat", "pop", "rock", "jazz", "classical", "bass", "treble", "voice")
            val oldPresets = input.getJSONArray("presets")
            for (i in 0 until oldPresets.length()) {
                val p = oldPresets.getJSONObject(i)
                require(presetIds.add(p.getString("id")))
                curve(p.getJSONArray("gains"), -12.0, 12.0)
                val gain = p.getDouble("preamp")
                require(gain.isFinite() && gain in -12.0..12.0)
            }
            val next = copy(input)
            fun editable(array: JSONArray): JSONArray =
                JSONArray(
                    curve(array, -12.0, 12.0).mapIndexed { i, gain ->
                        if (i == 0) 0.0 else gain.coerceIn(-10.0, 10.0)
                    }
                )
            val gains = editable(next.getJSONArray("gains"))
            next.put("gains", gains).put("enabled", true).put("preamp", 0).put("strength", 100)
            val presets = next.getJSONArray("presets")
            for (i in 0 until presets.length()) {
                val p = presets.getJSONObject(i)
                if (p.getString("id") == "custom")
                    p.put("gains", editable(p.getJSONArray("gains"))).put("preamp", 0)
            }
            val expected =
                when (next.getString("presetId")) {
                    "flat" -> DoubleArray(10)
                    "pop" -> doubleArrayOf(0.0, 0.0, 1.0, 2.0, 2.0, 1.0, 0.0, 0.0, 1.0, 2.0)
                    "rock" -> doubleArrayOf(0.0, 2.0, 1.0, -1.0, -2.0, -1.0, 1.0, 2.0, 3.0, 2.0)
                    "jazz" -> doubleArrayOf(0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 2.0, 2.0, 1.0, 0.0)
                    "classical" -> doubleArrayOf(0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 1.0, 2.0, 2.0)
                    else -> null
                }
            val current = curve(gains, -10.0, 10.0)
            if (expected == null || !expected.contentEquals(current)) {
                next.put("presetId", "custom")
                val saved = JSONArray()
                for (i in 0 until presets.length()) if (
                    presets.getJSONObject(i).getString("id") != "custom"
                )
                    saved.put(presets.getJSONObject(i))
                saved.put(
                    JSONObject()
                        .put("id", "custom")
                        .put("name", "Custom")
                        .put("gains", JSONArray(current.toList()))
                        .put("preamp", 0)
                )
                next.put("presets", saved)
            }
            return next
        }

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
