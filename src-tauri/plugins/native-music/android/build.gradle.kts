import org.jetbrains.kotlin.gradle.dsl.JvmTarget
plugins { id("com.android.library"); id("org.jetbrains.kotlin.android") }
android {
 namespace = "com.plugin.native_music"
 compileSdk = 36
 defaultConfig { minSdk = 26; testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }
dependencies {
 implementation("androidx.core:core-ktx:1.18.0")
 implementation("androidx.activity:activity-ktx:1.10.1")
 implementation("androidx.appcompat:appcompat:1.7.1")
 implementation("androidx.media3:media3-exoplayer:1.11.1")
 implementation("androidx.media3:media3-session:1.11.1")
 implementation("androidx.documentfile:documentfile:1.1.0")
 implementation(project(":tauri-android"))
 testImplementation("junit:junit:4.13.2")
 // Use real JSON parsing for JVM settings-migration tests; Android supplies org.json at runtime.
 testImplementation("org.json:json:20240303")
}
