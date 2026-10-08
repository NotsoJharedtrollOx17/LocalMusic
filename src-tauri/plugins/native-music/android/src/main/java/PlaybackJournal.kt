package com.plugin.native_music
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors

// This durable outbox is owned by the foreground service. It never calls the WebView.
class PlaybackJournal(context: Context) {
 private val db = JournalDb(context.applicationContext)
 private val writer = Executors.newSingleThreadExecutor()
 private var session: JSONObject? = null
 private var currentId: String? = null
 private var sequence = 0L
 private var mono: Long? = null
 private var wall = ""
 var excluded = false
  private set

 fun transition(id: String?, playing: Boolean, replay: Boolean = false) {
  if (id != currentId || replay) { finish("transition"); currentId = id }
  setPlaying(playing)
 }
 fun setPlaying(playing: Boolean) {
  checkpoint()
  if (playing && currentId != null) {
   if (session == null) { session = JSONObject().put("id",UUID.randomUUID().toString()).put("trackId",currentId).put("startedAtUtc",Instant.now().toString()).put("playedMs",0L).put("excluded",excluded); sequence=0 }
   mono=SystemClock.elapsedRealtime();wall=Instant.now().toString()
  }
 }
 fun checkpoint() {
  val start = mono ?: return
  val s = session ?: return
  val delta = (SystemClock.elapsedRealtime()-start).coerceAtLeast(0)
  mono=null
  if(delta==0L)return
  s.put("playedMs",s.getLong("playedMs")+delta)
  val interval=JSONObject().put("sessionId",s.getString("id")).put("sequence",sequence++).put("startUtc",wall).put("playedMs",delta)
  enqueue(s,interval)
 }
 fun tick(playing:Boolean){ if(mono != null && SystemClock.elapsedRealtime()-mono!!>=10000)setPlaying(playing) }
 fun finish(reason:String){checkpoint();session?.let{it.put("endReason",reason);enqueue(it,null)};session=null}
 fun setExcluded(value:Boolean,playing:Boolean){checkpoint();excluded=value;session?.let{it.put("excluded",value);enqueue(it,null)};setPlaying(playing)}
 private fun enqueue(s:JSONObject,i:JSONObject?){val value=JSONObject().put("session",JSONObject(s.toString())).put("interval",i?:JSONObject.NULL).toString();writer.execute{db.writableDatabase.execSQL("INSERT INTO outbox(payload) VALUES(?)",arrayOf(value))}}
 fun batch(callback:(JSONArray)->Unit){writer.execute{val result=JSONArray();db.readableDatabase.rawQuery("SELECT id,payload FROM outbox ORDER BY id LIMIT 500",null).use{while(it.moveToNext()){val o=JSONObject(it.getString(1));o.put("id",it.getLong(0));result.put(o)}};callback(result)}}
 fun ack(through:Long,done:()->Unit){writer.execute{db.writableDatabase.execSQL("DELETE FROM outbox WHERE id<=?",arrayOf(through));done()}}
 fun clear(playing:Boolean,done:()->Unit){finish("history-deleted");writer.execute{db.writableDatabase.execSQL("DELETE FROM outbox");done()};setPlaying(playing)}
 fun close(){finish("service-stopped");writer.shutdown()}
 private class JournalDb(context:Context):SQLiteOpenHelper(context,"playback-outbox.sqlite",null,1){
  override fun onConfigure(db:SQLiteDatabase){db.enableWriteAheadLogging();db.execSQL("PRAGMA synchronous=FULL")}
  override fun onCreate(db:SQLiteDatabase){db.execSQL("CREATE TABLE outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,payload TEXT NOT NULL)")}
  override fun onUpgrade(db:SQLiteDatabase,old:Int,new:Int){}
 }
}
