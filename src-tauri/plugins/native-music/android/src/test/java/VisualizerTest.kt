package com.plugin.native_music
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONArray
import java.io.File
import kotlin.math.*
class VisualizerTest {
 @Test fun capturePreservesPostEqMultichannelOutput(){
  val curve=DoubleArray(10);curve[5]=6.0
  fun render(enabled:Boolean):DoubleArray {
   val dsp=SoundDsp(PreparedSound(SoundMath.bank(arrayOf(curve,curve),48000.0),1.0,false,0.0,1),48000,6)
   val visual=MusicVisualizer();val epoch=visual.reset(48000);val id=if(enabled)visual.start() else null
   val frame=DoubleArray(6);val output=DoubleArray(48000)
   for(i in 0 until 8000){for(ch in frame.indices)frame[ch]=sin(i*.13)*.8;dsp.process(frame);visual.capture(epoch,frame,i/48.0);for(ch in frame.indices)output[i*6+ch]=frame[ch]}
   if(id!=null)visual.stop(id);return output
  }
  assertArrayEquals(render(false),render(true),0.0)
 }
 @Test fun sharedNumpyAnalysisFixtures(){
  val fixtures=JSONArray(File("../../../../tests/fixtures/visualizer-analysis.json").readText())
  for(index in 0 until fixtures.length()){val f=fixtures.getJSONObject(index);val rate=f.getInt("rate");val l=DoubleArray(2048);val r=DoubleArray(2048);var seed=17L
   for(i in l.indices){l[i]=when(f.getString("signal")){"tone"->sin(i*2*PI*f.getDouble("frequency")/rate)*f.getDouble("amplitude");"impulse"->if(i==1024)1.0 else 0.0;"noise"->{seed=(seed*1664525+1013904223) and 0xffffffffL;(seed/4294967296.0-.5)*.5};else->0.0};r[i]=l[i]*if(f.getString("signal")=="impulse")-1.0 else f.optDouble("right",1.0)}
   val analyzer=VisualizerAnalysis();val actual=analyzer.analyze(l,r,rate);val expected=f.getJSONObject("expected")
   assertEquals(f.getString("name"),expected.getDouble("rms"),actual.rms,1e-9)
   for(i in 0 until 64)assertEquals(f.getString("name")+" band "+i,expected.getJSONArray("spectrum").getDouble(i),actual.spectrum[i],1e-7)
   for(i in 0 until 256)assertEquals(expected.getJSONArray("waveform").getDouble(i),actual.waveform[i],1e-9)
   assertEquals(0.0,analyzer.analyze(l,r,rate).onset,0.0)
  }
 }
 @Test fun sessionsAndTransportReset(){
  val v=MusicVisualizer();val old=v.start();val id=v.start();v.stop(old)
  try{v.read(old);fail("Stale session accepted")}catch(expected:IllegalStateException){}
  val epoch=v.reset(48000);v.clock(60,true);val pcm=doubleArrayOf(.5,-.5)
  for(i in 0 until 4096)v.capture(epoch,pcm,i/48.0)
  for(i in 0 until 30){if(v.read(id)!=null)break;Thread.sleep(10)}
  assertNotNull(v.read(id));assertEquals(epoch,v.read(id)!!.generation)
  v.reset(44100);assertNull(v.read(id));v.stop(id);v.stop(id);assertFalse(v.running())
 }
}
