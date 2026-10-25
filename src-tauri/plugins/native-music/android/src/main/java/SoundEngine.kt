package com.plugin.native_music

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.Equalizer
import kotlin.math.*
import org.json.JSONArray
import org.json.JSONObject

class SoundEngine(private val context: Context) {
    private val prefs = context.getSharedPreferences("playback", Context.MODE_PRIVATE)
    @Volatile
    private var config =
        SoundConfiguration(
            JSONObject(
                    prefs.getString("sound-v1", null) ?: SoundConfiguration.defaults().toString()
                )
        )
    @Volatile
    var rate = 48000
        private set

    @Volatile
    var channels = 2
        private set

    @Volatile var failed: String? = null
    @Volatile private var bypass = false
    @Volatile
    private var migrationPending = true
    @Volatile
    var prepared = prepare(config)
        private set

    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var generation = 1L

    init {
        if (
            prefs.getBoolean("eqEnabled", false) &&
                !prefs.getBoolean("sound-migration-complete", false)
        )
            prefs
                .edit()
                .putString(
                    "sound-migration-notice",
                    "Previous device preset retained. Play a track to migrate it, or choose a new preset.",
                )
                .apply()
        try {
            check(prefs.edit().putString("sound-v1", config.json.toString()).commit()) { "Could not save equalizer settings" }
            migrationPending = false
            prepared = prepare(config)
        } catch(error: Exception) { failed = error.message ?: "Could not save equalizer settings" }
    }

    private fun prepare(c: SoundConfiguration): PreparedSound {
        val bank = SoundMath.bank(c.curves(bypass, channels), rate.toDouble())
        val attenuation = 0.0
        return PreparedSound(
            bank,
            10.0.pow(
                ((if (!bypass && (c.enabled)) c.preamp
                else 0.0) - attenuation) / 20
            ),
            bypass || migrationPending || !c.enabled,
            attenuation,
            0,
        )
    }

    @Synchronized
    fun format(sampleRate: Int, channelCount: Int) {
        rate = sampleRate
        channels = channelCount
        prepared = prepare(config).copy(generation = ++generation)
    }

    @Synchronized
    fun configure(json: JSONObject) {
        val next = SoundConfiguration(json)
        val persisted = prefs
            .edit()
            .putString("sound-v1", next.json.toString())
            .putBoolean("sound-migration-complete", true)
            .remove("sound-migration-notice")
            .commit()
        check(persisted) { "Could not save equalizer settings" }
        config = next
        if (migrationPending) failed = null
        migrationPending = false
        prepared = prepare(next).copy(generation = ++generation)
    }

    @Synchronized
    fun state(playing: Boolean): JSONObject {
        val inactive = JSONArray()
        for (i in SoundConfiguration.frequencies.indices) if (
            SoundConfiguration.frequencies[i] >= rate / 2.0
        )
            inactive.put(i)
        val available = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).isNotEmpty()
        return JSONObject()
            .put("supported", true)
            .put("config", SoundConfiguration.copy(config.json))
            .put(
                "status",
                if (failed != null) "failed"
                else if (!available) "output-unavailable" else if (playing) "active" else "ready",
            )
            .put("reason", failed ?: JSONObject.NULL)
            .put("sampleRate", rate)
            .put("channels", channels)
            .put("attenuation", prepared.attenuation)
            .put("bypass", bypass)
            .put("inactiveBands", inactive)
            .put("routeMonitoring", false)
            .also {
                prefs.getString("sound-migration-notice", null)?.let { notice ->
                    it.put("migrationNotice", notice)
                }
            }
    }

    @Synchronized
    fun action(json: JSONObject) {
        when (json.getString("op")) {
            "retry" -> {
                if (migrationPending) configure(config.json)
                failed = null
                prepared = prepare(config).copy(generation = ++generation)
            }
            "bypass" -> {
                bypass = json.getBoolean("value")
                prepared = prepare(config).copy(generation = ++generation)
            }
            else -> error("Unknown sound action")
        }
    }

    @Synchronized
    fun migrateLegacy(sessionId: Int) {
        if (
            prefs.getBoolean("sound-migration-complete", false) ||
                !prefs.getBoolean("eqEnabled", false)
        )
            return
        var eq: Equalizer? = null
        try {
            check(sessionId > 0)
            eq = Equalizer(0, sessionId)
            check(eq.hasControl() && eq.numberOfBands > 0)
            if (eq.numberOfPresets > 0)
                eq.usePreset(
                    prefs
                        .getInt("eqPreset", 0)
                        .coerceIn(0, eq.numberOfPresets.toInt() - 1)
                        .toShort()
                )
            val points =
                (0 until eq.numberOfBands.toInt())
                    .map { i ->
                        eq.getCenterFreq(i.toShort()) / 1000.0 to
                            eq.getBandLevel(i.toShort()) / 100.0
                    }
                    .sortedBy { it.first }
            val gains = JSONArray()
            for (f in SoundConfiguration.frequencies) {
                val i = points.indexOfFirst { it.first >= f }
                val gain =
                    if (i < 0) points.last().second
                    else if (i == 0) points.first().second
                    else {
                        val a = points[i - 1]
                        val b = points[i]
                        a.second + (b.second - a.second) * ln(f / a.first) / ln(b.first / a.first)
                    }
                gains.put(gain.coerceIn(-12.0, 12.0))
            }
            val next =
                SoundConfiguration.copy(config.json)
                    .put("enabled", true)
                    .put("gains", gains)
                    .put("presetId", "migrated-device")
            next
                .getJSONArray("presets")
                .put(
                    JSONObject()
                        .put("id", "migrated-device")
                        .put("name", "Previous device preset")
                        .put("gains", gains)
                        .put("preamp", 0)
                )
            configure(next)
        } catch (_: Exception) {
            prefs
                .edit()
                .putString(
                    "sound-migration-notice",
                    "Previous device preset retained. Choose a new preset to use app processing.",
                )
                .apply()
        } finally {
            eq?.release()
        }
    }

    @Synchronized
    fun playbackStarted() { if (!migrationPending) failed = null }
}
