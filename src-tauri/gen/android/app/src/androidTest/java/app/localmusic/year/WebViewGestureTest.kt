package app.localmusic.year

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class WebViewGestureTest {
    @Test fun pinchKeepsPageScaleAndSystemTextSize() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        ActivityScenario.launch(MainActivity::class.java).use {
            lateinit var web: WebView
            val origin = IntArray(2)
            var centerX = 0f
            var centerY = 0f
            onView(isAssignableFrom(WebView::class.java)).check { view, error ->
                if (error != null) throw error
                web = view as WebView
                assertFalse(web.settings.supportZoom())
                assertFalse(web.settings.builtInZoomControls)
                assertEquals((web.resources.configuration.fontScale * 100).toInt(), web.settings.textZoom)
                web.getLocationOnScreen(origin)
                centerX = origin[0] + web.width / 2f
                centerY = origin[1] + web.height / 2f
            }
            fun scale(): Double {
                val result = ArrayBlockingQueue<String>(1)
                instrumentation.runOnMainSync {
                    web.evaluateJavascript("window.visualViewport.scale") { result.offer(it) }
                }
                return requireNotNull(result.poll(5, TimeUnit.SECONDS)).toDouble()
            }
            val before = scale()
            val start = SystemClock.uptimeMillis()
            fun touch(action: Int, count: Int, spread: Float) {
                val pointers = Array(count) { index -> MotionEvent.PointerProperties().apply {
                    id = index
                    toolType = MotionEvent.TOOL_TYPE_FINGER
                } }
                val positions = Array(count) { index -> MotionEvent.PointerCoords().apply {
                    x = centerX + (if (index == 0) -spread else spread)
                    y = centerY
                    pressure = 1f
                    size = 1f
                } }
                val event = MotionEvent.obtain(start, SystemClock.uptimeMillis(), action,
                    count, pointers, positions, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
                try { assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)) }
                finally { event.recycle() }
            }
            val second = 1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT
            touch(MotionEvent.ACTION_DOWN, 1, 20f)
            touch(MotionEvent.ACTION_POINTER_DOWN or second, 2, 20f)
            for (distance in 30..110 step 10) touch(MotionEvent.ACTION_MOVE, 2, distance.toFloat())
            touch(MotionEvent.ACTION_POINTER_UP or second, 2, 110f)
            touch(MotionEvent.ACTION_UP, 1, 110f)
            instrumentation.waitForIdleSync()
            assertEquals(before, scale(), 0.001)
        }
    }
}
