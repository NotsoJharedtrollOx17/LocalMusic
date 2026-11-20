package com.plugin.native_music

import java.io.File

private val generatedCover = Regex("(?:[0-9a-f]{8}|[0-9a-f]{64})-(?:64|128|256|512)[.]png")

internal fun migrateLegacyArtwork(legacy: File, cache: File) {
    val files = legacy.listFiles() ?: return
    if (!cache.isDirectory && !cache.mkdirs()) return
    for (source in files) {
        if (!source.isFile || !generatedCover.matches(source.name)) continue
        // Both directories are private internal storage. Rename publishes a complete file
        // and leaves the legacy entry available for retry on failure.
        if (source.length() > 0) source.renameTo(File(cache, source.name))
    }
    legacy.delete() // Succeeds only when the directory is empty.
}
