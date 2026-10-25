package com.plugin.native_music

import org.json.JSONArray
import org.json.JSONObject

class SoundConfiguration(input: JSONObject) {
    val json = normalize(input)
    val enabled = json.getBoolean("enabled")
    val preamp = json.getDouble("preamp")
    val gains = curve(json.getJSONArray("gains"), -12.0, 12.0)

    init {
        require(
            json.getInt("version") == 2 &&
                preamp.isFinite() &&
                preamp in -12.0..12.0
        )
        val presets = json.getJSONArray("presets")
        require(presets.length() <= 101)
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
    }

    fun curves(bypass: Boolean, channels: Int): Array<DoubleArray> = Array(2) {
        DoubleArray(10) { i -> if (i > 0 && enabled && !bypass) gains[i] else 0.0 }
    }

    companion object {
        val frequencies =
            doubleArrayOf(31.0, 63.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0)

        fun defaults() =
            JSONObject(
                """{"version":2,"enabled":true,"gains":[0,0,0,0,0,0,0,0,0,0],"preamp":0,"presetId":"flat","presets":[]}"""
            )

        /** Preserve old named records while upgrading the single Custom slot. */
        fun normalize(input: JSONObject): JSONObject {
            require(input.getInt("version") in listOf(1, 2))
            input.getBoolean("enabled")
            val legacyPreamp = input.getDouble("preamp")
            require(legacyPreamp.isFinite() && legacyPreamp in -12.0..12.0)
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
            val next = JSONObject()
            for (key in listOf("enabled", "gains", "preamp", "presetId", "presets")) next.put(key, copy(input).get(key))
            val retained = JSONArray()
            for (i in 0 until oldPresets.length()) {
                val old = oldPresets.getJSONObject(i)
                val preset = JSONObject()
                for (key in listOf("id", "name", "gains", "preamp")) preset.put(key, old.get(key))
                retained.put(copy(preset))
            }
            next.put("presets", retained).put("version", 2)
            fun editable(array: JSONArray): JSONArray =
                JSONArray(
                    curve(array, -12.0, 12.0).mapIndexed { i, gain ->
                        if (i == 0) 0.0 else gain.coerceIn(-10.0, 10.0)
                    }
                )
            val gains = editable(next.getJSONArray("gains"))
            next.put("gains", gains).put("enabled", true).put("preamp", 0)
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
