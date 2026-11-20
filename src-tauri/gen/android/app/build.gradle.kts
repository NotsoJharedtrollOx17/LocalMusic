import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "app.localmusic.year"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "app.localmusic.year"
        minSdk = 26
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    val releaseStore = System.getenv("LOCAL_MUSIC_KEYSTORE")
    val releaseRequested = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
    if (releaseRequested && (releaseStore.isNullOrBlank() || System.getenv("LOCAL_MUSIC_STORE_PASSWORD").isNullOrBlank() || System.getenv("LOCAL_MUSIC_KEY_ALIAS").isNullOrBlank() || System.getenv("LOCAL_MUSIC_KEY_PASSWORD").isNullOrBlank())) {
        throw GradleException("Release signing requires the four LOCAL_MUSIC signing environment variables; see docs/release-process.md")
    }
    signingConfigs {
        create("release") {
            if (!releaseStore.isNullOrBlank()) {
                storeFile = file(releaseStore)
                storePassword = System.getenv("LOCAL_MUSIC_STORE_PASSWORD")
                keyAlias = System.getenv("LOCAL_MUSIC_KEY_ALIAS")
                keyPassword = System.getenv("LOCAL_MUSIC_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            if (System.getenv("LOCAL_MUSIC_ISOLATED_QA") == "1") {
            }
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isDebuggable = false
            isJniDebuggable = false
            // Rust strips the release library; retain its exact bytes for identity verification.
            packaging { jniLibs.keepDebugSymbols.add("*/arm64-v8a/liblocal_music_lib.so") }
            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
