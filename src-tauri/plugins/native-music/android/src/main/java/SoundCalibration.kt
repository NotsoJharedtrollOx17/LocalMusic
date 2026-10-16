package com.plugin.native_music

import org.json.JSONArray
import org.json.JSONObject

/** Original bounded preference search, independent of Android playback and clocks. */
class SoundCalibration {
    private data class Cell(var lower: Int = -1, var upper: Int = 7, var answered: Int = 0)
    private val cells = Array(12) { Cell() }
    var answered = 0
        private set
    val ear get() = answered % 2
    val step get() = (answered / 6).coerceAtMost(5)
    val done get() = answered == 36
    val level: Int get() { val c = cells[ear * 6 + step]; return -72 + Math.floorDiv(c.lower + c.upper, 2) * 6 }
    fun answer(heard: Boolean) {
        check(!done) { "Calibration is complete" }
        val c = cells[ear * 6 + step]
        val index = Math.floorDiv(c.lower + c.upper, 2)
        if (heard) c.upper = index else c.lower = index
        c.answered++
        answered++
    }
    fun status(i: Int): String {
        val c = cells[i]
        return when { c.answered == 0 -> "untested"; c.answered < 3 -> "estimating";
            c.lower == -1 -> "below-floor"; c.upper == 7 -> "above-ceiling"; else -> "bracketed" }
    }
    fun estimates() = JSONArray(cells.mapIndexed { i, c ->
        val status = status(i)
        JSONObject().put("ear", i / 6).put("frequency", frequencies[i % 6]).put("status", status)
            .put("answered", c.answered)
            .put("estimateDbfs", if (status == "estimating" || status == "bracketed")
                (-72.0 + (c.lower + c.upper) * 3.0).coerceIn(-72.0, -36.0) else JSONObject.NULL)
            .put("lowerDbfs", if (c.lower >= 0) -72 + c.lower * 6 else JSONObject.NULL)
            .put("upperDbfs", if (c.upper <= 6) -72 + c.upper * 6 else JSONObject.NULL)
    })
    fun values(ear: Int) = Array<Double?>(6) { i ->
        val c = cells[ear * 6 + i]
        if (status(ear * 6 + i) == "bracketed") -72.0 + (c.lower + c.upper) * 3.0 else null
    }
    fun metadata() = JSONObject().put("method", "bounded-3-v1").put("coverage", JSONArray((0..11).map { status(it) }))
    companion object {
        val frequencies = intArrayOf(1000, 250, 500, 2000, 4000, 8000)
        val levels = intArrayOf(-72, -66, -60, -54, -48, -42, -36)
    }
}
