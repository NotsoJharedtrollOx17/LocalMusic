# Detached Now Playing and Visualizer windows

Approved 31 October 2026. Implementation starts on `dev.detached-player-windows` from clean `dev` at `4b12e81` after this specification is committed.

## 1. Delivery and confirmed behavior

- Support two independent Windows windows: Now Playing (including Queue) and Visualizer, alongside Library.
- Add an accessible header **Open in separate window** button. Ordinary opening remains in-app. Detached views provide **Return to main window** and an optional **Always on top** toggle, initially off.
- Closing a detached window returns its view to main without interrupting playback. Closing main exits the entire application.
- Android and browser preview retain their in-app experiences without detachment controls.
- Keep version 0.12.0. Commit the completed feature for review; merging and releasing require another request.

## 2. Window experience and navigation

- Use decorated, resizable Windows windows with native dragging, resizing, minimize/maximize and taskbar behavior, localized titles and existing orange focus frames.
- Initial logical sizes: player 720 x 860; visualizer 1100 x 720. Constrain to the monitor working area. Minimum sizes: 360 x 480; retain responsive reflow and zoom.
- Remember bounds during the application session, correcting off-screen bounds. Do not reopen automatically or persist pin state across restarts.
- Show children only after initial state/theme readiness; keep the source view until acknowledgement. Creation failure leaves the source usable with retry feedback.
- Allow one window per view; repeated activation focuses/restores it. Opening an already detached view focuses its window.
- Detached content fills the window without Library or modal backdrop. Preserve player menus, Queue, square artwork and visualizer controls.
- Escape dismisses child menus/dialogs first, Queue returns to Now Playing, otherwise returns to main. Native Close has the same return behavior.
- Restore current player/Queue view or visualizer mode and corresponding main focus. Defer returns while another main dialog is active; multiple pending returns appear in return order.
- Album/artist navigation targets the main Library. Details, EQ, playlist selection and confirmation dialogs stay in their originating window, one interactive overlay per window.

## 3. Architecture, synchronization and lifecycle

- Use ordinary Tauri multi-window APIs with fixed labels and bundled routes. Rust owns creation, pinning, routing validation and lifecycle. Restrict capabilities to known local windows and necessary operations.
- Typed desktop operations cover capability discovery, open/focus, ready acknowledgement, return, pin and state subscription. Validate caller/view; accept no arbitrary URL or window label.
- Share focused player presentation/controller between embedded and detached hosts. Children must not mount the Library controller, scan the catalog, refresh Recap or rewrite preferences on mount.
- Keep one native player, queue, listening journal and EQ engine. All views consume authoritative playback snapshots; reject older polls/seek responses across windows.
- Broadcast revisioned favorite/playlist/feedback/privacy/catalog/sound invalidations; refetch affected state. Subscribe before reads and reconcile on readiness/resume.
- Persist settings through atomic field updates against current native settings. Preserve validation/privacy-owned fields; synchronize theme, language and visualizer mode without whole-record overwrites/write-back loops.
- Maintain exactly one visualizer renderer/analysis lease. Transfer with generation checks so late cleanup cannot stop a new owner. Minimize/background follows the visualizer window, not Library.
- Preserve adaptive rendering, pause settling and wake cleanup. Library minimization must not stop a visible detached visualizer; ordinary blur never stops music.
- Main shutdown suppresses returns, closes children and releases analysis. Unexpected child destruction clears ownership and restores recoverably.
- Apply existing WebView theme/context-menu/shortcut policies to all windows. No listening-data or database migration.
- References: [Tauri windows](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/), [capabilities](https://v2.tauri.app/security/capabilities/), [native events](https://v2.tauri.app/develop/calling-frontend/).

## 4. Verification and completion

- Test readiness, duplicates, failure/retry, ordered returns, pin, destruction and app shutdown.
- Test simultaneous seek/track/Queue/favorite/playlist/feedback/privacy/removal/EQ/settings changes without changing listening accounting.
- Test visualizer ownership, stale generations, pause, minimize/resume and wake cleanup without duplicate rendering/analysis.
- Inspect actual Windows windows in EN/ES, themes, keyboard/focus, Reduce Motion, high zoom, short windows and monitor boundaries. Browser mocks are not native acceptance.
- Run frontend checks, complete browser suite, Rust core/native and Kotlin regressions. Build Windows/ARM64 Android and verify metadata, signatures, library hashes and frozen frontend assets.
- Record actual results in `docs/verification.md`, separating Android runtime, physical performance and manual accessibility gates. Commit for review on the feature branch.


## Amendment - direct Visualizer opening and responsive window content

Approved 31 October 2026. This supersedes the original in-app-first opening rule for Visualizer on Windows. On Windows, choosing Visualizer from Now Playing/Queue opens or focuses its separate window directly, from either embedded or detached player. Keep the originating player usable during startup and on failure; retain Retry. Android/browser keep in-app navigation. Existing explicit Return behavior is unchanged.

Both native windows remain resizable with the existing 360 x 480 logical minimum. Adapt content to width and height using bounded CSS sizing, without CSS transforms or overriding accessibility zoom. Scale player artwork between 96 and 512 px while fitting remaining height; keep ordinary popup artwork behavior. Scale detached title/artist text with floors of 20/14 px, button targets at least 44 px and bounded enlarged controls. Scale Queue metadata and visualizer controls similarly. Below readable floors, wrap/scroll rather than truncate controls or shrink text further. Keep the visualizer drawing-surface/performance caps unchanged. Add direct-open/failure/single-instance and multi-size geometry regressions, rebuild native packages, and record actual results before committing this amendment on the same feature branch.


## Amendment - close detached windows without reopening a popup

Approved by user follow-up. The native Close button dismisses either detached view after its renderer and visualizer lease have been released, while playback continues. It does not bring Library to the foreground or enqueue the view for in-app presentation. The explicit Return to main control retains its existing behavior, as do recovery after unexpected destruction and main-window shutdown. Preserve per-session bounds and generation checks. Verify native Close for both views, explicit Return, playback and visualizer ownership.
