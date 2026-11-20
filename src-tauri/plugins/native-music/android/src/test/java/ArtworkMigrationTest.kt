package com.plugin.native_music

import java.io.File
import java.util.Base64
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ArtworkMigrationTest {
    @get:Rule val root = TemporaryFolder()

    @Test fun interruptedMigrationReusesCompleteCoversAndPreservesOtherFiles() {
        val legacy = root.newFolder("legacy")
        val cache = root.newFolder("cache")
        val cover = "ab12cd34-128.png"
        val bytes = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=")
        File(legacy, cover).writeBytes(bytes)
        File(cache, cover).writeBytes(bytes.copyOf(16))
        File(legacy, "other.png").writeBytes(bytes)
        repeat(2) { migrateLegacyArtwork(legacy, cache) }
        assertArrayEquals(bytes, File(cache, cover).readBytes())
        assertFalse(File(legacy, cover).exists())
        assertTrue(File(legacy, "other.png").exists())
        assertTrue(completeCover(File(cache, cover)))
    }
}
