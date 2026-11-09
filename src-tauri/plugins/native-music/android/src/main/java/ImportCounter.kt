package com.plugin.native_music

/** File checks are not database imports. Keep them separate and bound IPC to 4 Hz. */
internal class ImportCounter(
    private val clock: () -> Long,
    private val publish: (ImportCounter) -> Unit,
) {
    var scanned = 0; private set
    var ready = 0; private set
    var failed = 0; private set
    var total: Int? = null
    private var last = Long.MIN_VALUE

    fun checked(readable: Boolean) {
        scanned++
        if (readable) ready++ else failed++
        emit()
    }

    fun emit(force: Boolean = false) {
        val now = clock()
        if (force || last == Long.MIN_VALUE || now - last >= 250) {
            last = now
            publish(this)
        }
    }
}
