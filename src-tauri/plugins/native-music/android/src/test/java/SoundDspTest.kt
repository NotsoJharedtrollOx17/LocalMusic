package com.plugin.native_music

import java.io.File
import kotlin.math.*
import org.junit.Assert.*
import org.junit.Test

class SoundDspTest {
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
    fun toneIsolationAndCap() {
        val tone = PersonalSoundSession.tone(1000, -36, 1)
        assertEquals(326400, tone.size)
        for (i in tone.indices step 2) {
            assertEquals(0f, tone[i], 0f)
            assertTrue(abs(tone[i + 1]) <= 10.0.pow(-36.0 / 20) + 1e-6)
        }
    }
}
