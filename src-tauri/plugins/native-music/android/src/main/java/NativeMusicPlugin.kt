package com.plugin.native_music
import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.ClipData
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.tauri.PermissionState
import app.tauri.annotation.*
import app.tauri.plugin.*
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@InvokeArg class VisualizerArgs {var id:String?=null}
@InvokeArg class AnalysisArgs {var active:Boolean=false;var uri:String?=null;var durationMs:Long=0}
@InvokeArg class ControlArgs { var op:String?=null; var payload:String?=null }
@InvokeArg class AckArgs { var through:Long?=null }
@InvokeArg class ArtworkArgs { var uri:String?=null; var idle:Boolean=false }
@InvokeArg class ImportArgs { var mode:String?=null }
@InvokeArg class ExportArgs { var name:String?=null; var bytes:Array<Int>?=null }
@InvokeArg class ShareArgs { var uris:Array<String>?=null }
@InvokeArg class SoundPayloadArgs { var payload:String?=null }

@TauriPlugin(permissions=[
 Permission(strings=[Manifest.permission.READ_MEDIA_AUDIO],alias="audio"),
 Permission(strings=[Manifest.permission.READ_EXTERNAL_STORAGE],alias="legacyAudio")
])
class NativeMusicPlugin(private val activity:Activity):Plugin(activity){
 private val analysisWorker=Executors.newSingleThreadExecutor()
 @Command fun analysisSources(invoke:Invoke){val args=invoke.parseArgs(SoundPayloadArgs::class.java);worker.execute{try{val sources=org.json.JSONArray(args.payload?:"[]");val result=JSObject();val decoder=AcousticDecoder(activity.applicationContext);for(i in 0 until sources.length()){val s=sources.getJSONObject(i);val revision=try{decoder.fingerprint(Uri.parse(s.getString("uri")))}catch(_:Exception){"unavailable"};result.put(s.getString("id"),revision)};invoke.resolve(result)}catch(e:Exception){invoke.reject(e.message?:"Audio sources unavailable")}}}
 @Command fun analysisActivity(invoke:Invoke){val args=invoke.parseArgs(AnalysisArgs::class.java);PlaylistScanGate.activity(args.active);invoke.resolve(JSObject())}
 @Command fun analyzeTrack(invoke:Invoke){val args=invoke.parseArgs(AnalysisArgs::class.java);analysisWorker.execute{try{val feature=AcousticDecoder(activity.applicationContext).decode(Uri.parse(args.uri?:""),args.durationMs);invoke.resolve(JSObject().put("feature",feature?:JSONObject.NULL))}catch(e:Exception){invoke.reject(e.message?:"Audio analysis unavailable")}}}
 private var musicWebView:android.webkit.WebView?=null
 override fun load(webView:android.webkit.WebView){
  musicWebView=webView;webView.settings.textZoom=(activity.resources.configuration.fontScale*100).toInt()
  (activity as? ComponentActivity)?.onBackPressedDispatcher?.addCallback(activity,object:OnBackPressedCallback(true){
   override fun handleOnBackPressed(){webView.evaluateJavascript("Boolean(window.__musicBack && window.__musicBack())"){handled->
    if(handled!="true"){isEnabled=false;(activity as ComponentActivity).onBackPressedDispatcher.onBackPressed();isEnabled=true}
   }}
  })
 }
 override fun onConfigurationChanged(newConfig:android.content.res.Configuration){musicWebView?.settings?.textZoom=(newConfig.fontScale*100).toInt()}
 private val visualHandler=android.os.Handler(android.os.Looper.getMainLooper())
 private val visualLease=object:Runnable {override fun run(){val service=PlaybackService.instance;val awake=service?.sound?.visualizer?.running()==true&&service.player.isPlaying&&!activity.isFinishing
  if(awake)activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)else activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  if(service?.sound?.visualizer?.running()==true)visualHandler.postDelayed(this,250)
 }}
 override fun onResume(activity:androidx.appcompat.app.AppCompatActivity){super.onResume(activity);PlaylistScanGate.foreground.set(true)}
 override fun onPause(activity:androidx.appcompat.app.AppCompatActivity){super.onPause(activity);PlaylistScanGate.foreground.set(false);PlaylistScanGate.stop();PlaybackService.instance?.sound?.visualizer?.stopAll();visualHandler.removeCallbacks(visualLease);activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
 @Command fun startVisualizer(invoke:Invoke){withService(invoke){service->
  service.sound.visualizer.clock(service.player.currentPosition.coerceAtLeast(0),service.player.isPlaying)
  val id=service.sound.visualizer.start();visualHandler.removeCallbacks(visualLease);visualHandler.post(visualLease);invoke.resolve(JSObject().put("id",id).put("capabilities",JSONObject().put("fftSize",2048).put("bands",64).put("waveformPoints",256).put("maxUpdatesPerSecond",30).put("postEffects",true)))
 }}
 @Command fun readVisualizer(invoke:Invoke){val args=invoke.parseArgs(VisualizerArgs::class.java);withService(invoke){service->
  service.sound.visualizer.clock(service.player.currentPosition.coerceAtLeast(0),service.player.isPlaying)
  val frame=service.sound.visualizer.read(args.id?:"");invoke.resolve(JSObject().put("frame",frame?.json()?:JSONObject.NULL))
 }}
 @Command fun stopVisualizer(invoke:Invoke){val args=invoke.parseArgs(VisualizerArgs::class.java);activity.runOnUiThread{
  PlaybackService.instance?.sound?.visualizer?.stop(args.id?:"");visualHandler.removeCallbacks(visualLease);visualHandler.post(visualLease);invoke.resolve(JSObject())
 }}
 private val worker=Executors.newSingleThreadExecutor()
 private val cancelled=AtomicBoolean(false)
 private var controllerFuture:com.google.common.util.concurrent.ListenableFuture<MediaController>?=null
 private fun withService(invoke:Invoke,body:(PlaybackService)->Unit){
  activity.runOnUiThread {
   try{
    if(controllerFuture==null)controllerFuture=MediaController.Builder(activity,SessionToken(activity,ComponentName(activity,PlaybackService::class.java))).buildAsync()
    controllerFuture!!.addListener({
     try{controllerFuture!!.get();val service=PlaybackService.instance?:throw IllegalStateException("Playback service is not ready");body(service)}catch(e:Exception){invoke.reject(e.message?:"Playback failed")}
    },androidx.core.content.ContextCompat.getMainExecutor(activity))
   }catch(e:Exception){invoke.reject(e.message?:"Playback failed")}
  }
 }
 private fun resolveSnapshot(invoke:Invoke,service:PlaybackService){val snapshot=service.snapshot();service.journal.batch{events->activity.runOnUiThread{invoke.resolve(JSObject().put("snapshot",snapshot).put("journal",events))}}}
 @Command fun control(invoke:Invoke){val args=invoke.parseArgs(ControlArgs::class.java);withService(invoke){service->service.control(args.op?:"",JSONObject(args.payload?:"{}"));resolveSnapshot(invoke,service)}}
 @Command fun snapshot(invoke:Invoke){withService(invoke){resolveSnapshot(invoke,it)}}
 @Command fun ack(invoke:Invoke){val args=invoke.parseArgs(AckArgs::class.java);withService(invoke){it.journal.ack(args.through?:0){invoke.resolve(JSObject())}}}
 @Command fun timeZone(invoke:Invoke){invoke.resolve(JSObject().put("value",java.util.TimeZone.getDefault().id))}
 @Command fun soundCapabilities(invoke:Invoke){withService(invoke){service->
  val result=service.sound.state(service.player.isPlaying)
  invoke.resolve(JSObject(result.toString()))
 }}
 @Command fun setSound(invoke:Invoke){val args=invoke.parseArgs(SoundPayloadArgs::class.java);withService(invoke){service->val playing=service.player.isPlaying;worker.execute{try{service.sound.configure(JSONObject(args.payload?:"{}"));val result=service.sound.state(playing);invoke.resolve(JSObject(result.toString()))}catch(e:Exception){invoke.reject(e.message?:"Sound configuration failed")}}}}
 @Command fun soundAction(invoke:Invoke){val args=invoke.parseArgs(SoundPayloadArgs::class.java);withService(invoke){service->val action=JSONObject(args.payload?:"{}");if(action.optString("op")=="retry"){service.player.pause();if(service.player.playerError!=null&&service.player.currentMediaItem!=null)service.player.prepare()};val playing=service.player.isPlaying;worker.execute{try{service.sound.action(action);invoke.resolve(JSObject(service.sound.state(playing).toString()))}catch(e:Exception){invoke.reject(e.message?:"Sound action failed")}}}}
 @Command fun shareAudio(invoke:Invoke){
  val args=invoke.parseArgs(ShareArgs::class.java)
  activity.runOnUiThread{try{
   val uris=ArrayList((args.uris?:emptyArray()).map{Uri.parse(it)})
   require(uris.isNotEmpty()&&uris.all{it.scheme=="content"}){"Audio source cannot be shared"}
   val intent=Intent(if(uris.size==1)Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).setType("audio/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
   if(uris.size==1)intent.putExtra(Intent.EXTRA_STREAM,uris[0])else intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris)
   val clips=ClipData.newUri(activity.contentResolver,"Audio",uris[0]);for(uri in uris.drop(1))clips.addItem(ClipData.Item(uri));intent.clipData=clips
   activity.startActivity(Intent.createChooser(intent,"Share audio"));invoke.resolve(JSObject().put("outcome","opened"))
  }catch(e:Exception){invoke.reject(e.message?:"Audio could not be shared")}}
 }
 @Command fun artwork(invoke:Invoke){val args=invoke.parseArgs(ArtworkArgs::class.java);worker.execute{try{val marker=MusicReader(activity.applicationContext,AtomicBoolean(false)).artwork(android.net.Uri.parse(args.uri?:""));invoke.resolve(JSObject().put("value",marker?:JSONObject.NULL))}catch(e:Exception){invoke.reject(e.message?:"Artwork unavailable")}}}
 @Command fun albumOrder(invoke:Invoke){val args=invoke.parseArgs(ArtworkArgs::class.java);worker.execute{try{if(args.idle&&(!PlaylistScanGate.foreground.get()||PlaylistScanGate.playbackRequested.get()))throw IllegalStateException("Metadata read deferred");val order=MusicReader(activity.applicationContext,AtomicBoolean(false)).albumOrder(android.net.Uri.parse(args.uri?:""));invoke.resolve(JSObject().put("trackNumber",order.opt("trackNumber")?:JSONObject.NULL).put("discNumber",order.opt("discNumber")?:JSONObject.NULL).put("releaseYear",order.opt("releaseYear")?:JSONObject.NULL).put("albumArtist",order.opt("albumArtist")?:JSONObject.NULL).put("artistNames",order.optJSONArray("artistNames")?:org.json.JSONArray()).put("identityMetadataRead",true))}catch(e:Exception){invoke.reject(e.message?:"Track order unavailable")}}}
 @Command fun cancelImport(invoke:Invoke){cancelled.set(true);invoke.resolve(JSObject())}
 @Command fun importMusic(invoke:Invoke){
  cancelled.set(false)
  val args=invoke.parseArgs(ImportArgs::class.java)
  if(args.mode=="folder"){val intent=Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(invoke,intent,"folderResult");return}
  val alias=if(Build.VERSION.SDK_INT>=33)"audio" else "legacyAudio"
  if(getPermissionState(alias)!=PermissionState.GRANTED){requestPermissionForAlias(alias,invoke,"audioPermission");return}
  scan(invoke,null)
 }
 @PermissionCallback fun audioPermission(invoke:Invoke){
  val alias=if(Build.VERSION.SDK_INT>=33)"audio" else "legacyAudio"
  if(getPermissionState(alias)==PermissionState.GRANTED)scan(invoke,null)else invoke.reject("Music access was denied. Choose a folder instead.")
 }
 @ActivityCallback fun folderResult(invoke:Invoke,result:ActivityResult){
  val uri=result.data?.data
  if(result.resultCode!=Activity.RESULT_OK||uri==null){invoke.resolve(JSObject().put("manifestPath",JSONObject.NULL));return}
  try{activity.contentResolver.takePersistableUriPermission(uri,(result.data!!.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION));scan(invoke,uri)}catch(e:Exception){invoke.reject(e.message?:"Folder access could not be saved")}
 }
 private fun scan(invoke:Invoke,folder:android.net.Uri?){
  worker.execute{try{val manifest=MusicReader(activity.applicationContext,cancelled).scan(folder);invoke.resolve(JSObject().put("manifestPath",manifest.absolutePath))}catch(e:Exception){invoke.reject(e.message?:"Import failed")}}
 }
 @Command fun exportFile(invoke:Invoke){
  val args=invoke.parseArgs(ExportArgs::class.java);val name=args.name?:"your-year.png"
  if(name.contains('/')||name.contains('\\')||(args.bytes?.size?:0)>20*1024*1024){invoke.reject("Invalid export");return}
  val intent=Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(if(name.endsWith(".png"))"image/png" else "application/json").putExtra(Intent.EXTRA_TITLE,name)
  startActivityForResult(invoke,intent,"exportResult")
 }
 @ActivityCallback fun exportResult(invoke:Invoke,result:ActivityResult){
  val uri=result.data?.data
  if(result.resultCode!=Activity.RESULT_OK||uri==null){invoke.resolve(JSObject().put("saved",false));return}
  val args=invoke.parseArgs(ExportArgs::class.java)
  worker.execute{try{activity.contentResolver.openOutputStream(uri)?.use{out->out.write((args.bytes?:emptyArray()).map{it.toByte()}.toByteArray())}?:throw IllegalStateException("Export destination unavailable");invoke.resolve(JSObject().put("saved",true))}catch(e:Exception){invoke.reject(e.message?:"Export failed")}}
 }
}
