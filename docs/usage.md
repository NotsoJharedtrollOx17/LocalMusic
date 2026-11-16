# Using Local Music

Local Music plays imported local files without an account or streaming service. Windows and Android are native applications. Browser preview uses separate browser storage and audio APIs; its optional original sample tracks do not count toward listening history.

## Library and search

Import music with the Library action: a Windows folder, Android MediaStore/selected-folder grant, or browser file picker. Existing recognized sources are refreshed rather than blindly duplicated. Checking files, saving records and refreshing the Library are separate import stages; unreadable files are reported. Local organization never rewrites tags or deletes source files.

Songs, Albums, Artists, Playlists and Your Recap form the Library. Search filters the current view; all terms use normalized literal substring matching. Titles/names receive relevance priority in their own views. Query and ordering apply before visible-row virtualization. Searching Playlists combines default and saved names, with custom matches first. Clear removes the filter; collapsing search retains the active filter. Collection searches are independent and Back restores their parent state.

On phones, the selected tab stays left-aligned while the content follows horizontal drags and settles to adjacent pages. Vertical lists contain the complete prepared catalog, with bounded mounted rows rather than a Load more boundary. Hold a song to select it; the selection toolbar offers Select all and contextual actions. Duration is retained in playback/seek controls rather than repeated in mobile collection rows. The persistent mini-player controls the same queue as Now Playing.

## Playback, sound and Windows windows

Use Now Playing or the mini-player for playback, seek, skip, shuffle and repeat. Queue edits retain stable track identities. The artwork play/pause action toggles the current song; selecting another song starts that selection. Exclude from recap suppresses that listening session's contribution. Removing a library entry hides it without deleting its source audio; follow confirmations and Undo where offered.

Windows continues real-time playback through a silent PCM output when no physical output exists. That consumed playback counts toward history by product choice. Android retains its normal audio-focus and headphone behavior.

Equalizer has nine editable bands and Normal/Pop/Rock/Jazz/Classical/Custom presets. Changes apply live and manual settings save to Custom. Adapt Sound has been removed. Unsupported frequency bands are explained or omitted according to the active output capabilities.

Visualizer offers Spectrum, Geometry and XMB waves driven by post-EQ audio. It settles on pause and stops analysis/rendering when hidden. Reduce Motion uses gentler automatic animation. The selected style is remembered, but the view does not open automatically.

Windows supports detached Now Playing/Queue, Visualizer and Equalizer windows, including optional Always on top. Closing a child dismisses it; Return to main explicitly restores it. Closing Library exits the application. The native menu bar belongs only to the main window. Android and browser retain in-app views.

## Playlists and organization

The Default Ones contains Recently added, Recently played, Most played and Favorites. Your playlists contains editable manual/generated lists, with Rename/Delete menus. Make a playlist starts at 30 tracks, with Familiar/Balanced/Explore preferences, favorites/cooldown controls and up to three included/excluded artists. Genre becomes a preference when artists are explicitly included. Generation is explicit; source analysis does not run continuously while browsing. See the [ranking method](personalized-playlists.md).

Settings > Organize provides artist corrections and reviewed song/album linking. Track and album details also expose Organize. Review candidates, choose a preferred copy or canonical album and confirm changes. Different editions stay separate unless explicitly linked. Explicit playlist cleanup previews duplicate removal and offers Undo; it does not silently rewrite the active queue.

## Your Recap and image delivery

Choose Weekly, Monthly or Yearly for the current calendar period; weeks start Monday and use ISO week labels. History coverage is explicit. Top songs, artists and albums have separate rankings, and the ranked top ten can be played or saved as a playlist.

Export image prepares Story (2160 x 3840) or Feed (2160 x 2700) PNGs with artwork, coverage and a small local. stamp. Preview space stays bounded through loading and format changes. Android 10+ saves directly to Pictures/Local Music; Android 8-9 and Windows use destination pickers. Browser preview starts a download. Saved feedback disappears after three seconds. Canceled saves are not success.

Share image opens Android's system chooser or supported browser file sharing. Installed destinations determine available social actions; opening the chooser does not post a Story. Windows retains Save As. Image delivery uses display data only and rechecks privacy/organization revisions. See [Recap rules](recap-methodology.md).

Language and theme are available in Settings. Listening history deletion removes learned listening influence while retaining favorites, explicit suggestion preferences and source-audio descriptors. About shows the running version and credits.
