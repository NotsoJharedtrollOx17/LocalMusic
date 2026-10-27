package com.plugin.native_music

import java.io.File
import kotlin.math.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AcousticTest {
    @Test
    fun sharedPcmDescriptors() {
        val cases =
            JSONObject(File("../../../../tests/fixtures/acoustic-analysis.json").readText())
                .getJSONArray("cases")
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val rate = c.getInt("rate")
            val frequencies = c.getJSONArray("frequencies")
            val phases = c.getJSONArray("phases")
            val channels =
                Array(frequencies.length()) { ch ->
                    var seed = 17L
                    FloatArray(16384) { n ->
                        if (frequencies.getDouble(ch) == -1.0) {
                            seed = (seed * 1664525 + 1013904223) and 0xffffffffL
                            return@FloatArray ((seed / 4294967296.0 - .5) * .2).toFloat()
                        }
                        if (frequencies.getDouble(ch) == -2.0)
                            return@FloatArray if (n == 9216) .2f else 0f
                        (phases.getDouble(ch) *
                                .2 *
                                sin(2 * PI * n * frequencies.getDouble(ch) / rate))
                            .toFloat()
                    }
                }
            val a = AcousticAnalysis()
            a.add(channels, rate)
            val actual = a.finish()
            if (c.getString("name") == "silence") {
                assertNull(actual)
                continue
            }
            assertNotNull(actual)
            val bands = actual!!.getJSONArray("bands")
            assertEquals(1.0, (0 until 32).sumOf { bands.getDouble(it) }, 1e-8)
            if (c.has("expectedBands")) {
                val expected = c.getJSONArray("expectedBands")
                for (b in 0 until 32) assertEquals(
                    c.getString("name") + " band " + b,
                    expected.getDouble(b),
                    bands.getDouble(b),
                    1e-7,
                )
            }
        }
    }

    @Test
    fun boundedExcerpts() {
        for (d in listOf(1.0, 24.0, 25.0, 40.0, 300.0)) {
            val ranges = AcousticAnalysis.excerpts(d)
            assertTrue(ranges.sumOf { it.second - it.first } <= 24)
            for (i in ranges.indices) {
                assertTrue(ranges[i].first >= (if (i == 0) 0.0 else ranges[i - 1].second))
                assertTrue(ranges[i].second <= d)
            }
        }
    }
}
