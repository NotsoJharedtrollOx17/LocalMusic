package com.plugin.native_music

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING

private val generatedCover = Regex("(?:[0-9a-f]{8}|[0-9a-f]{64})-(?:64|128|256|512)[.]png")

internal fun completeCover(file: File): Boolean {
    if (file.length() < 33) return false
    return try {
        java.io.RandomAccessFile(file, "r").use { input ->
            if (input.readInt() != 0x89504e47.toInt()) return false
            input.seek(input.length() - 8)
            input.readInt() == 0x49454e44 && input.readInt() == 0xae426082.toInt()
        }
    } catch (_: IOException) {
        false
    }
}

internal fun migrateLegacyArtwork(legacy: File, cache: File) {
    val files = legacy.listFiles() ?: return
    if (!cache.isDirectory && !cache.mkdirs()) return
    for (source in files) {
        if (!source.isFile || !generatedCover.matches(source.name)) continue
        // Both directories are private internal storage. Rename publishes a complete file
        // and leaves the legacy entry available for retry on failure.
        val destination = File(cache, source.name)
        if (completeCover(destination)) {
            source.delete()
        } else if (completeCover(source)) {
            try {
                Files.move(source.toPath(), destination.toPath(), ATOMIC_MOVE, REPLACE_EXISTING)
            } catch (_: IOException) {
                // Keep the legacy file for retry if the cache cannot accept it.
            }
        }
    }
    legacy.delete() // Succeeds only when the directory is empty.
}
