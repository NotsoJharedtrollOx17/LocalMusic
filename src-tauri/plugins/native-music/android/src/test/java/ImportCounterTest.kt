package com.plugin.native_music

import org.junit.Assert.*
import org.junit.Test

class ImportCounterTest {
    @Test fun separateChecksAndFailuresWithBoundedUpdates() {
        var now = 0L
        val updates = mutableListOf<Triple<Int, Int, Int>>()
        val count = ImportCounter({ now }) { updates.add(Triple(it.scanned, it.ready, it.failed)) }
        count.total = 4
        count.emit(true)
        count.checked(true)
        count.checked(false)
        assertEquals(1, updates.size)
        now = 250
        count.checked(true)
        assertEquals(Triple(3, 2, 1), updates.last())
        count.checked(false)
        count.emit(true)
        assertEquals(Triple(4, 2, 2), updates.last())
        assertEquals(3, updates.size)
    }

    @Test fun emptyFailedAndCancelledScansRetainHonestCounts() {
        val count = ImportCounter({ 0L }) {}
        assertNull(count.total) // Folder traversal does not know the total in advance.
        assertEquals(0, count.scanned)
        repeat(3) { count.checked(false) }
        count.emit(true) // Final update also used when cancellation interrupts traversal.
        assertEquals(3, count.failed)
        assertEquals(0, count.ready)
        assertEquals(count.scanned, count.ready + count.failed)
    }
}
