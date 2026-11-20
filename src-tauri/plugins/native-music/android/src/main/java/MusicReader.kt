package com.plugin.native_music
import android.content.Context
import android.content.ContentUris
import android.net.Uri
import android.provider.MediaStore
import android.media.MediaMetadataRetriever
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.documentfile.provider.DocumentFile
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

class MusicReader(private val context:Context,private val cancelled:AtomicBoolean){
 private var cacheBytes:Long?=null
 internal fun scan(folder:Uri?,knownIds:Set<String> = emptySet(),progress:(ImportCounter)->Unit):Pair<File,ImportCounter>{
  val manifest=File.createTempFile("music-import-",".jsonl",context.cacheDir)
  val counter=ImportCounter({android.os.SystemClock.elapsedRealtime()},progress)
  try {
  counter.emit(true)
  manifest.bufferedWriter().use{out->
   fun write(uri:Uri,title:String,artist:String,album:String,duration:Long,size:Long){
    if(cancelled.get())return
    val item=try{track(uri,title,artist,album,duration,size,knownIds)}catch(_:Exception){counter.checked(false);return}
    if(item==null){counter.skipped();return}
    // Storage failures must abort, rather than masquerading as unreadable source files.
    out.write(item.toString());out.newLine();counter.checked(true)
   }
   if(folder==null){
    val projection=arrayOf(MediaStore.Audio.Media._ID,MediaStore.Audio.Media.TITLE,MediaStore.Audio.Media.ARTIST,MediaStore.Audio.Media.ALBUM,MediaStore.Audio.Media.DURATION,MediaStore.Audio.Media.SIZE)
    val cursor=context.contentResolver.query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,projection,null,null,null)?:throw IllegalStateException("Music index unavailable. Try again or choose a folder.")
    cursor.use{c->counter.total=c.count;counter.emit(true);while(!cancelled.get()&&c.moveToNext()){val uri=ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,c.getLong(0));write(uri,c.getString(1)?:"Untitled",c.getString(2)?:"",c.getString(3)?:"",c.getLong(4),c.getLong(5))}}
   }else{
    val root=DocumentFile.fromTreeUri(context,folder)?:throw IllegalArgumentException("Unsupported folder")
    val pending=java.util.ArrayDeque<DocumentFile>();pending.add(root)
    while(pending.isNotEmpty()&&!cancelled.get()){val d=pending.removeFirst();if(d.isDirectory)d.listFiles().forEach{pending.add(it)}else if(d.type?.startsWith("audio/")==true||Regex("(?i).*\\.(mp3|flac|wav|m4a|ogg|opus|aac)$").matches(d.name?:""))write(d.uri,(d.name?:"Untitled").substringBeforeLast('.'),"","",0,d.length())}
   }
  };counter.emit(true);pruneCache();return Pair(manifest,counter)
  }catch(e:Exception){manifest.delete();throw e}
 }
 private fun track(uri:Uri,fallbackTitle:String,artist:String,album:String,duration:Long,size:Long,knownIds:Set<String>):JSONObject?{
  val digest=MessageDigest.getInstance("SHA-256");digest.update(size.toString().toByteArray())
  context.contentResolver.openFileDescriptor(uri,"r")?.use{fd->FileInputStream(fd.fileDescriptor).use{input->val data=ByteArray(65536);val n=input.read(data);if(n>0)digest.update(data,0,n);try{if(size>65536){input.channel.position(size-65536);val last=input.read(data);if(last>0)digest.update(data,0,last)}}catch(_:Exception){}}}?:throw IllegalStateException("Unavailable music")
  val id=digest.digest().joinToString(""){"%02x".format(it)}
  if(id in knownIds)return null
  val result=JSONObject().put("id",id).put("title",fallbackTitle).put("artist",if(artist=="<unknown>")"" else artist).put("album",if(album=="<unknown>")"" else album).put("genre","").put("durationMs",duration.coerceAtLeast(0)).put("sourceUri",uri.toString()).put("favorite",false).put("available",true).put("demo",false).put("artworkUrl",JSONObject.NULL)
  val retriever=MediaMetadataRetriever()
  try{
   retriever.setDataSource(context,uri)
   fun put(key:String,metadata:Int){retriever.extractMetadata(metadata)?.takeIf{it.isNotBlank()}?.let{result.put(key,it)}}
   put("title",MediaMetadataRetriever.METADATA_KEY_TITLE);put("artist",MediaMetadataRetriever.METADATA_KEY_ARTIST);put("album",MediaMetadataRetriever.METADATA_KEY_ALBUM);put("genre",MediaMetadataRetriever.METADATA_KEY_GENRE)
   applyIdentity(result,retriever)
   applyAlbumOrder(result,retriever)
   retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.let{result.put("durationMs",it)}
   retriever.embeddedPicture?.takeIf{it.size<=8*1024*1024}?.let{bytes->cachePicture(bytes)?.let{result.put("artworkUrl",it)}}
  }catch(_:Exception){}finally{retriever.release()}
  result.put("orderMetadataRead",true)
  return result
 }
 private fun applyIdentity(result:JSONObject,retriever:MediaMetadataRetriever){
  retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST)?.takeIf{it.isNotBlank()}?.let{result.put("albumArtist",it)}
  // Retriever exposes a joined ARTIST credit, not structured ARTISTS; retain it intact.
  result.put("artistNames",org.json.JSONArray()).put("identityMetadataRead",true)
 }
 private fun applyAlbumOrder(result:JSONObject,retriever:MediaMetadataRetriever){
  fun number(key:String,metadata:Int){retriever.extractMetadata(metadata)?.substringBefore('/')?.trim()?.toIntOrNull()?.takeIf{it>0}?.let{result.put(key,it)}}
  number("trackNumber",MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER)
  number("discNumber",MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER)
  val year=(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR)?:retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))?.take(4)?.toIntOrNull()
  if(year!=null&&year in 1000..9999)result.put("releaseYear",year)
  result.put("releaseMetadataRead",true)
 }
 fun albumOrder(uri:Uri):JSONObject {val retriever=MediaMetadataRetriever();return try{retriever.setDataSource(context,uri);JSONObject().also{applyAlbumOrder(it,retriever);applyIdentity(it,retriever)}}finally{retriever.release()}}
 fun artwork(uri:Uri):String? {val retriever=MediaMetadataRetriever();return try{retriever.setDataSource(context,uri);retriever.embeddedPicture?.takeIf{it.size<=8*1024*1024}?.let{cachePicture(it)}}catch(_:Exception){null}finally{retriever.release()}}
 private fun pruneCache(keep:String?=null){val files=File(context.cacheDir,"artwork").listFiles()?.filter{it.isFile&&it.extension=="png"}?.sortedBy{it.lastModified()}?:return;var bytes=files.sumOf{it.length()};for(file in files){if(bytes<=128L*1024*1024)break;if(keep!=null&&file.name.startsWith(keep))continue;val size=file.length();if(file.delete())bytes-=size};cacheBytes=bytes}
 private fun cachePicture(bytes:ByteArray):String? {
    val key=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)}
    val cache=File(context.cacheDir,"artwork").apply{mkdirs()}
    val large=File(cache,"$key-512.png")
    if(cacheBytes==null)cacheBytes=cache.listFiles()?.filter{it.isFile&&it.extension=="png"}?.sumOf{it.length()}?:0L
    val previous=large.length()
    if(!completeCover(large)){
     val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
     require(bounds.outWidth in 1..8192 && bounds.outHeight in 1..8192)
     var sample=1;while(maxOf(bounds.outWidth,bounds.outHeight)/sample>512)sample*=2
     val options=BitmapFactory.Options().apply{inSampleSize=sample}
     BitmapFactory.decodeByteArray(bytes,0,bytes.size,options)?.let{bitmap->
      val scale = minOf(1f, 512f / maxOf(bitmap.width, bitmap.height))
      val thumb = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1),
          (bitmap.height * scale).toInt().coerceAtLeast(1), true)
      val temp = File.createTempFile("cover-", ".tmp", cache)
      try {
        temp.outputStream().use { check(thumb.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        check(temp.renameTo(large) || large.length() > 0)
      } finally {
        temp.delete()
        if (thumb !== bitmap) thumb.recycle()
      }
      bitmap.recycle()
     }
    }
    cacheBytes=(cacheBytes?:0L)+large.length()-previous
    if((cacheBytes?:0L)>128L*1024*1024)pruneCache(key)
    return if(large.length()>0L)"cache:$key" else null
 }
}
