package com.plugin.native_music
import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject

class PlaybackService:MediaSessionService(){
 lateinit var player:ExoPlayer
 lateinit var journal:PlaybackJournal
 private lateinit var session:MediaSession
 private val handler=Handler(Looper.getMainLooper())
 private val prefs by lazy {getSharedPreferences("playback",Context.MODE_PRIVATE)}
 private var ticks=0
 private val ticker=object:Runnable{override fun run(){journal.tick(player.isPlaying);if(++ticks % 10 == 0)persist();handler.postDelayed(this,1000)}}
 companion object { @Volatile var instance:PlaybackService?=null }
 override fun onCreate(){
  super.onCreate();instance=this
  journal=PlaybackJournal(applicationContext)
  player=ExoPlayer.Builder(this).setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),true).setHandleAudioBecomingNoisy(true).setWakeMode(C.WAKE_MODE_LOCAL).build()
  player.addListener(object:Player.Listener{
   override fun onMediaItemTransition(item:MediaItem?,reason:Int){journal.transition(item?.mediaId,player.isPlaying,reason==Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT);persist()}
   override fun onIsPlayingChanged(playing:Boolean){journal.transition(player.currentMediaItem?.mediaId,playing)}
   override fun onPositionDiscontinuity(old:Player.PositionInfo,new:Player.PositionInfo,reason:Int){journal.setPlaying(player.isPlaying);persist()}
  })
  session=MediaSession.Builder(this,player).setCallback(object:MediaSession.Callback{
   override fun onPlaybackResumption(mediaSession:MediaSession,controller:MediaSession.ControllerInfo,isForPlayback:Boolean):ListenableFuture<MediaSession.MediaItemsWithStartPosition>{
    val saved=JSONObject(prefs.getString("queue","{}")!!)
    val items=itemsFromJson(saved.optJSONArray("items")?:JSONArray())
    val index=saved.optInt("queueIndex",0).coerceIn(0,(items.size-1).coerceAtLeast(0))
    return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(items,index,saved.optLong("positionMs",0)))
   }
  }).build()
  val saved=JSONObject(prefs.getString("queue","{}")!!)
  val items=itemsFromJson(saved.optJSONArray("items")?:JSONArray())
  if(items.isNotEmpty()){player.setMediaItems(items,saved.optInt("queueIndex",0).coerceIn(0,items.size-1),saved.optLong("positionMs",0));player.prepare()}
  player.shuffleModeEnabled=saved.optBoolean("shuffle",false);player.repeatMode=when(saved.optString("repeat")){"all"->Player.REPEAT_MODE_ALL;"one"->Player.REPEAT_MODE_ONE;else->Player.REPEAT_MODE_OFF}
  journal.setExcluded(saved.optBoolean("excluded",false),false)
  handler.post(ticker)
 }
 override fun onGetSession(controllerInfo:MediaSession.ControllerInfo):MediaSession?=if(controllerInfo.isTrusted||controllerInfo.packageName==packageName)session else null
 fun control(op:String,p:JSONObject){when(op){
  "play"->{val items=itemsFromJson(p.getJSONArray("tracks"));require(items.isNotEmpty());val i=p.optInt("index",0);require(i in items.indices);journal.finish("queue-replaced");player.setMediaItems(items,i,0);player.prepare();player.play()}
  "toggle"->if(player.isPlaying)player.pause()else{if(player.playbackState==Player.STATE_IDLE)player.prepare();player.play()}
  "seek"->{journal.setPlaying(false);player.seekTo(p.optLong("ms",0).coerceIn(0,player.duration.coerceAtLeast(0)));journal.setPlaying(player.isPlaying)}
  "next"->if(player.hasNextMediaItem())player.seekToNextMediaItem()else if(player.mediaItemCount>0)player.seekTo(0,0)
  "previous"->player.seekToPrevious()
  "shuffle"->player.shuffleModeEnabled=p.optBoolean("value",false)
  "repeat"->player.repeatMode=when(p.optString("value")){"all"->Player.REPEAT_MODE_ALL;"one"->Player.REPEAT_MODE_ONE;else->Player.REPEAT_MODE_OFF}
  "excluded"->journal.setExcluded(p.optBoolean("value",false),player.isPlaying)
  "flush"->journal.setPlaying(player.isPlaying)
  "reorder"->{val ids=p.getJSONArray("ids");val items=(0 until player.mediaItemCount).map{player.getMediaItemAt(it)};val current=player.currentMediaItem?.mediaId;for(i in 0 until ids.length()){val id=ids.getString(i);val existing=(0 until player.mediaItemCount).firstOrNull{player.getMediaItemAt(it).mediaId==id}?:throw IllegalArgumentException("Unknown queue item");player.moveMediaItem(existing,i)};for(i in player.mediaItemCount-1 downTo ids.length()){require(player.getMediaItemAt(i).mediaId!=current);player.removeMediaItem(i)};require(items.any{it.mediaId==current})}
  "deleteHistory"->journal.clear(player.isPlaying){}
  else->throw IllegalArgumentException("Unknown playback operation")
 };persist()}
 fun snapshot():JSONObject{val q=JSONArray();for(i in 0 until player.mediaItemCount)q.put(player.getMediaItemAt(i).mediaId);return JSONObject().put("trackId",player.currentMediaItem?.mediaId?:JSONObject.NULL).put("playing",player.isPlaying).put("positionMs",player.currentPosition.coerceAtLeast(0)).put("durationMs",player.duration.coerceAtLeast(0)).put("queue",q).put("queueIndex",player.currentMediaItemIndex.coerceAtLeast(0)).put("shuffle",player.shuffleModeEnabled).put("repeat",when(player.repeatMode){Player.REPEAT_MODE_ALL->"all";Player.REPEAT_MODE_ONE->"one";else->"off"}).put("excluded",journal.excluded).put("error",player.playerError?.message?:JSONObject.NULL).put("unavailableTrackId",if(player.playerError?.errorCode in listOf(PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,PlaybackException.ERROR_CODE_IO_NO_PERMISSION))player.currentMediaItem?.mediaId?:JSONObject.NULL else JSONObject.NULL)}
 private fun persist(){if(!::player.isInitialized)return;val s=snapshot();val items=JSONArray();for(i in 0 until player.mediaItemCount){val item=player.getMediaItemAt(i);items.put(JSONObject().put("id",item.mediaId).put("sourceUri",item.localConfiguration?.uri.toString()).put("title",item.mediaMetadata.title?.toString()?:"").put("artist",item.mediaMetadata.artist?.toString()?:"").put("album",item.mediaMetadata.albumTitle?.toString()?:""))};s.put("items",items);prefs.edit().putString("queue",s.toString()).apply()}
 private fun itemsFromJson(items:JSONArray):List<MediaItem> =(0 until items.length()).map{val t=items.getJSONObject(it);MediaItem.Builder().setMediaId(t.getString("id")).setUri(t.getString("sourceUri")).setMediaMetadata(MediaMetadata.Builder().setTitle(t.optString("title")).setArtist(t.optString("artist")).setAlbumTitle(t.optString("album")).build()).build()}
 override fun onDestroy(){handler.removeCallbacks(ticker);persist();journal.close();session.release();player.release();instance=null;super.onDestroy()}
}
