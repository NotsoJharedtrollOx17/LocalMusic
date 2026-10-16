package com.plugin.native_music

import java.io.File
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class SoundCalibrationTest {
    @Test fun sharedPathsAndSessions() {
        val fixtures = JSONObject(File("../../../../tests/fixtures/sound-calibration.json").readText())
        val paths = fixtures.getJSONArray("paths")
        for (n in 0 until paths.length()) {
            val f = paths.getJSONObject(n); val c = SoundCalibration()
            for (i in 0..2) { assertEquals(f.getJSONArray("levels").getInt(i), c.level)
                val a = f.getJSONArray("answers").getBoolean(i); c.answer(a); c.answer(a) }
            val actual = c.estimates().getJSONObject(0)
            for (field in listOf("status", "estimateDbfs", "lowerDbfs", "upperDbfs")) assertEquals(f.get(field).toString(), actual.get(field).toString().removeSuffix(".0"))
        }
        val sessions = fixtures.getJSONArray("sessions")
        for (n in 0 until sessions.length()) {
            val f = sessions.getJSONObject(n); val c = SoundCalibration()
            for(i in 0..35) {
                assertEquals(f.getJSONArray("ears").getInt(i), c.ear)
                assertEquals(f.getJSONArray("frequencies").getInt(i), SoundCalibration.frequencies[c.step])
                assertEquals(f.getJSONArray("levels").getInt(i), c.level)
                c.answer(f.getJSONArray("answers").getBoolean(i))
            }
            assertTrue(c.done); assertEquals(36, c.answered)
            for(ear in 0..1) {
                val expected = f.getJSONArray(if(ear == 0) "left" else "right")
                assertArrayEquals(DoubleArray(10) { expected.getDouble(it) }, PersonalSoundSession.derive(c.values(ear)), 1e-10)
            }
            assertEquals(f.getJSONArray("coverage").toString(), c.metadata().getJSONArray("coverage").toString())
        }
    }
    @Test fun sessionGuardsAndLegacyRetest() {
        var now = 0L
        val s = PersonalSoundSession("legacy", { now }, { now })
        val trial = s.view.getString("trialId")
        fun rejected(action: () -> Unit) { try {action(); fail("Expected rejection")} catch(e: IllegalStateException) {} }
        rejected { s.pulse("stale") }; rejected { s.respond(true, trial) }
        s.pulse(trial); rejected { s.pulse(trial) }; rejected { s.respond(true, trial) }
        repeat(4) { now += 1000; s.heartbeat() }
        s.pulse(trial); assertEquals(trial, s.view.getString("trialId")); assertEquals(0, s.view.getInt("answeredTrials"))
        repeat(4) { now += 1000; s.heartbeat() }; s.respond(true, trial)
        assertEquals(1, s.view.getInt("ear")); rejected { s.respond(true, trial) }; rejected { s.pulse(trial) }
        now += 2100; rejected { s.heartbeat() }; assertEquals("cancelled", s.view.getString("phase")); assertEquals(0, s.view.getJSONArray("estimates").length())
    }
    @Test fun savesDerivedProfileWithoutRawBounds() {
        var now=0L
        val s=PersonalSoundSession("legacy", {now}, {now})
        val fixture=JSONObject(File("../../../../tests/fixtures/sound-calibration.json").readText()).getJSONArray("sessions").getJSONObject(3)
        repeat(36) { i ->
            val trial=s.view.getString("trialId"); s.pulse(trial)
            repeat(4) { now+=1000; s.heartbeat() }
            s.respond(fixture.getJSONArray("answers").getBoolean(i),trial)
        }
        val profile=s.profile("Headphones")
        assertEquals("legacy",profile.getString("id"))
        assertEquals(6.0,profile.getJSONArray("left").getDouble(3),0.0)
        assertEquals(fixture.getJSONArray("coverage").toString(),profile.getJSONObject("calibration").getJSONArray("coverage").toString())
        assertFalse(profile.has("estimates")); assertFalse(profile.has("responses"))
        s.view.put("phase","saved"); s.discard(); assertEquals(0,s.view.getJSONArray("estimates").length())
    }
}
