package com.plugin.native_music
import org.junit.Assert.*
import org.junit.Test
class RecapImagesTest {
 private val png=byteArrayOf(137.toByte(),80,78,71,13,10,26,10)
 @Test fun rejectsUntrustedExportBoundary(){for(name in listOf("../x.png","x/y.png","x\\y.png","x.txt","")){assertThrows(IllegalArgumentException::class.java){RecapImages.validate(name,png)}};assertThrows(IllegalArgumentException::class.java){RecapImages.validate("x.png",byteArrayOf(1,2,3))}}
 @Test fun permitsPngAndEnforcesMemoryBound(){RecapImages.validate("your-recap-week-2026-11-16-story.png",png);assertThrows(IllegalArgumentException::class.java){RecapImages.validate("x.png",ByteArray(20*1024*1024+1))}}
}
