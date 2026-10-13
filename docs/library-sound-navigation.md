# Compact Library and separate sound views - 12 October 2026

Apply the attached reference flow without replacing the orange/charcoal visual system. Stay on the current `dev.ui-ux-polish` branch; preserve release branches, tags, references and DSP/storage.

- Replace the redundant large Library title and LOCAL MUSIC eyebrow with a compact tab row sharing Search and the top-right menu. Keep logo/privacy motto, collection detail titles, accessible Library tab labels and sticky navigation.
- Use one top-right menu: Edit enters existing track selection; Sound options opens a two-row hub; Settings opens ordinary preferences. Disable Edit where no track collection is displayed. Remove the old filter/sort icon from collection and playlist toolbars. Favorites remains in automatic Lists; existing internal sort state is retained.
- Sound options contains Equalizer (with current preset/profile summary) and Adapt Sound. Equalizer contains only presets and the compact gain display. Adapt Sound owns creation, profiles, management and per-channel preview. Existing personal priority, independent channel processing, tone limits and setup cancellation remain intact.
- Settings contains Language, Theme and Listening history with its current coverage and confirmed clearing action. Remove timezone presentation, retain device-calendar synchronization for truthful recap boundaries.
- Keep one active modal. Close/Back/Escape returns to the parent sound hub, then the originating library/player/queue surface; restore focus and scroll. App-scoped sound state retains rapid edits between views. Setup cancellation must stop tones and discard partial responses.
- Verify compact desktop/mobile, EN/ES, light/dark, keyboard/menu focus, Back, nested navigation, profile priority, setup cancellation, gain persistence, imports/search and recap history actions. Frontend/browser checks and Windows native rebuild/inspection provide local evidence; Android runtime remains a separate gate.
