package com.plugin.native_music

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File
import java.security.MessageDigest
import java.util.UUID

internal object RecapImages {
 internal fun validate(name:String,bytes:ByteArray){
  require(name.isNotEmpty()&&name.length<=240&&!name.contains('/')&&!name.contains('\\')&&!name.contains('\u0000')&&name.endsWith(".png")){"Invalid image name"}
  val signature=byteArrayOf(137.toByte(),80,78,71,13,10,26,10)
  require(bytes.size in 8..20*1024*1024&&bytes.take(8).toByteArray().contentEquals(signature)){"Invalid PNG export"}
 }
 fun save(context:Context,name:String,bytes:ByteArray){
  validate(name,bytes)
  require(android.os.Build.VERSION.SDK_INT>=29)
  val resolver=context.contentResolver
  val values=ContentValues().apply{put(MediaStore.Images.Media.DISPLAY_NAME,name.removeSuffix(".png")+"-"+UUID.randomUUID().toString().take(8)+".png");put(MediaStore.Images.Media.MIME_TYPE,"image/png");put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/Local Music");put(MediaStore.Images.Media.IS_PENDING,1)}
  val uri=resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values)?:error("Image destination unavailable")
  try{
   resolver.openOutputStream(uri)?.use{it.write(bytes);it.flush()}?:error("Image destination unavailable")
   check(resolver.update(uri,ContentValues().apply{put(MediaStore.Images.Media.IS_PENDING,0)},null,null)==1){"Image could not be published"}
  }catch(e:Exception){runCatching{resolver.delete(uri,null,null)};throw e}
 }
 fun shareUri(context:Context,name:String,bytes:ByteArray):Uri{
  validate(name,bytes)
  val dir=File(context.cacheDir,"recap_exports");check(dir.isDirectory||dir.mkdirs()){"Share storage unavailable"}
  val now=System.currentTimeMillis()
  dir.listFiles()?.filter{now-it.lastModified()>24*60*60*1000L}?.forEach{it.delete()}
  val hash=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)}
  val file=File(dir,"$hash.png")
  if(!file.exists()){
   check((dir.listFiles()?.sumOf{it.length()}?:0)+bytes.size<=64L*1024*1024){"Temporary share storage is full. Try again later."}
   val temp=File.createTempFile("pending-",".tmp",dir)
   try{temp.outputStream().use{it.write(bytes)};check(temp.renameTo(file)){"Share image unavailable"}}finally{temp.delete()}
  }
  file.setLastModified(now)
  return FileProvider.getUriForFile(context,context.packageName+".fileprovider",file)
 }
}
