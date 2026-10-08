package com.plugin.native_music
import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
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

@InvokeArg class ControlArgs { var op:String?=null; var payload:String?=null }
@InvokeArg class AckArgs { var through:Long?=null }
@InvokeArg class ArtworkArgs { var uri:String?=null }
@InvokeArg class ImportArgs { var mode:String?=null }
@InvokeArg class ExportArgs { var name:String?=null; var bytes:Array<Int>?=null }

@TauriPlugin(permissions=[
 Permission(strings=[Manifest.permission.READ_MEDIA_AUDIO],alias="audio"),
 Permission(strings=[Manifest.permission.READ_EXTERNAL_STORAGE],alias="legacyAudio")
])
class NativeMusicPlugin(private val activity:Activity):Plugin(activity){
 private var musicWebView:android.webkit.WebView?=null
 override fun load(webView:android.webkit.WebView){musicWebView=webView;webView.settings.textZoom=(activity.resources.configuration.fontScale*100).toInt()}
 override fun onConfigurationChanged(newConfig:android.content.res.Configuration){musicWebView?.settings?.textZoom=(newConfig.fontScale*100).toInt()}
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
 @Command fun artwork(invoke:Invoke){val args=invoke.parseArgs(ArtworkArgs::class.java);worker.execute{try{val marker=MusicReader(activity.applicationContext,AtomicBoolean(false)).artwork(android.net.Uri.parse(args.uri?:""));invoke.resolve(JSObject().put("value",marker?:JSONObject.NULL))}catch(e:Exception){invoke.reject(e.message?:"Artwork unavailable")}}}
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
  if(result.resultCode!=Activity.RESULT_OK||uri==null){invoke.resolve(JSObject());return}
  val args=invoke.parseArgs(ExportArgs::class.java)
  worker.execute{try{activity.contentResolver.openOutputStream(uri)?.use{out->out.write((args.bytes?:emptyArray()).map{it.toByte()}.toByteArray())}?:throw IllegalStateException("Export destination unavailable");invoke.resolve(JSObject())}catch(e:Exception){invoke.reject(e.message?:"Export failed")}}
 }
}
