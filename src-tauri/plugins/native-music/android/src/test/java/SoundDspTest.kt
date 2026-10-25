package com.plugin.native_music

import java.io.File
import kotlin.math.*
import org.junit.Assert.*
import org.junit.Test

class SoundDspTest {
    @Test
    fun sharedConfigurationNormalization() {
        val cases =
            org.json.JSONArray(
                File("../../../../tests/fixtures/sound-normalization.json").readText()
            )
        for (i in 0 until cases.length()) {
            val case = cases.getJSONObject(i)
            val actual = SoundConfiguration(case.getJSONObject("input")).json
            val expected = case.getJSONObject("expected")
            assertTrue(actual.getBoolean("enabled"))
            assertEquals(0.0, actual.getDouble("preamp"), 0.0)
            assertEquals(expected.getString("presetId"), actual.getString("presetId"))
            for (j in 0..9) assertEquals(
                expected.getJSONArray("gains").getDouble(j),
                actual.getJSONArray("gains").getDouble(j),
                0.0,
            )
            assertEquals(
                expected.getJSONArray("presets").length(),
                actual.getJSONArray("presets").length(),
            )
            assertEquals(2, actual.getInt("version"))
            assertFalse(actual.has("profiles"))
            assertFalse(actual.has("profileId"))
            assertFalse(actual.has("personalEnabled"))
            assertFalse(actual.has("strength"))
            assertEquals(actual.toString(), SoundConfiguration(actual).json.toString())
            val curves = SoundConfiguration(actual).curves(false, 6)
            for (channel in curves) for (j in 0..9) assertEquals(actual.getJSONArray("gains").getDouble(j), channel[j], 0.0)
            for (j in 0 until expected.getJSONArray("presets").length()) {
                val a = actual.getJSONArray("presets").getJSONObject(j)
                val e = expected.getJSONArray("presets").getJSONObject(j)
                assertEquals(e.getString("id"), a.getString("id"))
                assertEquals(e.getDouble("preamp"), a.getDouble("preamp"), 0.0)
                for (k in 0..9) assertEquals(
                    e.getJSONArray("gains").getDouble(k),
                    a.getJSONArray("gains").getDouble(k),
                    0.0,
                )
            }
        }
    }

    @Test
    fun sharedCoefficientFixtures() {
        val file = File("../../../../tests/fixtures/sound-dsp.csv")
        assertTrue("Shared fixture missing: ${file.absolutePath}", file.exists())
        for (row in file.readLines().drop(1)) {
            val v = row.split(',').map { it.toDouble() }
            val actual = SoundMath.coefficients(v[1], v[2], v[0])
            for (i in 0..4) assertEquals(v[i + 3], actual[i], 1e-10)
        }
        assertEquals(
            6.0,
            SoundMath.response(SoundMath.coefficients(1000.0, 6.0, 48000.0), 1000.0, 48000.0),
            1e-8,
        )
    }

    @Test
    fun bypassAndLimiter() {
        val bank = SoundMath.bank(Array(2) { DoubleArray(10) }, 48000.0)
        val flat = PreparedSound(bank, 1.0, true, 0.0, 0)
        val dsp = SoundDsp(flat, 48000, 2)
        val frame = doubleArrayOf(.99, -.8)
        dsp.process(frame)
        assertArrayEquals(doubleArrayOf(.99, -.8), frame, 0.0)
        dsp.configure(flat.copy(gain = 20.0, bypass = false))
        repeat(2000) {
            frame[0] = 1.0
            frame[1] = .5
            dsp.process(frame)
            assertTrue(abs(frame[0]) <= 10.0.pow(-1.0 / 20) + 1e-9)
            assertEquals(2.0, frame[0] / frame[1], 1e-8)
        }
    }

    @Test
    fun rejectsUnsupportedVersion() {
        try { SoundConfiguration(SoundConfiguration.defaults().put("version", 3)); fail("Unsupported version accepted") }
        catch (_: IllegalArgumentException) {}
    }
}
