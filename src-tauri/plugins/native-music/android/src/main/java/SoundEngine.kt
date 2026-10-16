package com.plugin.native_music

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.audiofx.Equalizer
import android.os.Handler
import android.os.Looper
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
                .put("strength", 100)
        )
    @Volatile
    var rate = 48000
        private set

    @Volatile
    var channels = 2
        private set

    @Volatile var failed: String? = null
    @Volatile private var routeGeneration = 0L
    @Volatile private var bypass = false
    @Volatile
    var prepared = prepare(config)
        private set

    private var session: PersonalSoundSession? = null
    private val output = SoundPreviewOutput(context) { interrupt() }
    private val handler = Handler(Looper.getMainLooper())
    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val devices =
        object : AudioDeviceCallback() {
            override fun onAudioDevicesRemoved(removed: Array<AudioDeviceInfo>) {
                interrupt()
            }

            override fun onAudioDevicesAdded(added: Array<AudioDeviceInfo>) {
                interrupt()
            }
        }
    private var generation = 1L
    private val ticker =
        object : Runnable {
            override fun run() {
                synchronized(this@SoundEngine) {
                    if (session?.alive() == false) {
                        session?.pause()
                        output.stop()
                    }
                }
                handler.postDelayed(this, 100)
            }
        }

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
        audio.registerAudioDeviceCallback(devices, handler)
        handler.postDelayed(ticker, 100)
        prefs.edit().putString("sound-v1", config.json.toString()).apply()
    }

    private fun prepare(c: SoundConfiguration): PreparedSound {
        val bank = SoundMath.bank(c.curves(bypass, channels), rate.toDouble())
        val attenuation = 0.0
        return PreparedSound(
            bank,
            10.0.pow(
                ((if (!bypass && (c.enabled || (c.personalEnabled && channels <= 2))) c.preamp
                else 0.0) - attenuation) / 20
            ),
            bypass || (!c.enabled && !c.personalEnabled) || (!c.enabled && channels > 2),
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
    fun configure(json: JSONObject, authorizePersonal: Boolean = false) {
        val next = SoundConfiguration(SoundConfiguration.copy(json).put("strength", 100))
        check(!next.personalEnabled || config.personalEnabled || authorizePersonal) {
            "Confirm headphones with Use profile first"
        }
        val ready = prepare(next).copy(generation = ++generation)
        config = next
        prepared = ready
        prefs
            .edit()
            .putString("sound-v1", next.json.toString())
            .putBoolean("sound-migration-complete", true)
            .remove("sound-migration-notice")
            .apply()
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
            .put("systemPanel", false)
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
            .put("personalAvailable", channels <= 2)
            .put("routeMonitoring", true)
            .put("routeGeneration", routeGeneration)
            .also {
                prefs.getString("sound-migration-notice", null)?.let { notice ->
                    it.put("migrationNotice", notice)
                }
            }
    }

    @Synchronized
    fun action(json: JSONObject) {
        when (json.getString("op")) {
            "profile-use" -> {
                check(json.getLong("routeGeneration") == routeGeneration) {
                    "Output changed. Confirm headphones again."
                }
                check(channels <= 2)
                configure(
                    SoundConfiguration.copy(config.json)
                        .put("profileId", json.getString("id"))
                        .put("personalEnabled", true),
                    true,
                )
            }
            "retry" -> {
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
    fun cancelSetup() {
        session?.cancel()
        output.stop()
    }

    @Synchronized
    fun interrupt() {
        routeGeneration++
        cancelSetup()
        if (config.personalEnabled) {
            val next = SoundConfiguration.copy(config.json).put("personalEnabled", false)
            configure(next)
        }
    }

    @Synchronized
    fun personal(action: JSONObject): JSONObject {
        val op = action.getString("op")
        if (op == "start") {
            session?.cancel()
            output.stop()
            check(channels <= 2) { "Personal sound requires mono or stereo audio" }
            val replace = if (action.isNull("replaceId")) null else action.getString("replaceId")
            if (replace != null) {
                val profiles = config.json.getJSONArray("profiles")
                check(
                    (0 until profiles.length()).any {
                        profiles.getJSONObject(it).getString("id") == replace
                    }
                )
            }
            session = PersonalSoundSession(replace)
            return SoundConfiguration.copy(session!!.view)
        }
        val s = session ?: error("Sound setup is no longer active")
        check(action.getString("id") == s.view.getString("id")) { "Stale sound setup session" }
        if (op == "cancel") {
            s.cancel()
            output.stop()
            return SoundConfiguration.copy(s.view)
        }
        s.heartbeat()
        if (s.view.getString("phase") == "paused") output.stop()
        when (op) {
            "pause" -> { s.pause(); output.stop() }
            "resume" -> s.resume(action.getString("trialId"))
            "heartbeat" -> {}
            "pulse" -> output.play(s.pulse(action.getString("trialId")))
            "respond" -> s.respond(action.getBoolean("heard"), action.getString("trialId"))
            "retry" -> {
                output.stop()
                s.retry()
            }
            "preview" -> {
                val strength = action.getDouble("strength")
                require(strength.isFinite() && strength in 0.0..100.0)
                val mode = action.getString("mode")
                require(mode == "original" || mode == "personal")
                s.view.put("strength", strength)
                output.play(
                    SoundComparison.render(s.profile("Preview"), strength, mode == "personal")
                )
            }
            "save" -> {
                val strength = action.getDouble("strength")
                require(strength.isFinite() && strength in 0.0..100.0)
                s.view.put("strength", strength)
                val p = s.profile(action.getString("name"))
                val next = SoundConfiguration.copy(config.json)
                val list = next.getJSONArray("profiles")
                val retained = JSONArray()
                for (i in 0 until list.length()) if (
                    list.getJSONObject(i).getString("id") != p.getString("id")
                )
                    retained.put(list.getJSONObject(i))
                next.put("profiles", retained.put(p))
                next
                    .put("profileId", p.getString("id"))
                    .put("personalEnabled", true)
                    .put("strength", s.view.getDouble("strength"))
                configure(next, authorizePersonal = true)
                output.stop()
                s.view.put("phase", "saved")
                s.discard()
            }
            else -> error("Unknown sound setup action")
        }
        return SoundConfiguration.copy(s.view)
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
    fun close() {
        handler.removeCallbacks(ticker)
        audio.unregisterAudioDeviceCallback(devices)
        // Service shutdown is not an output change: retain the saved default.
        session?.cancel()
        output.stop()
    }
}
