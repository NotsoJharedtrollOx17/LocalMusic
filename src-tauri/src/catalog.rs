use lofty::{
    file::{AudioFile, TaggedFileExt},
    tag::{Accessor, ItemKey},
};
use music_core::{Store, Track};
use std::{
    io::{Read, Seek, SeekFrom},
    path::Path,
};
pub fn read_file(path: &Path, cache: &Path) -> Result<Track, String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let size = file.metadata().map_err(|e| e.to_string())?.len();
    let mut hasher = blake3::Hasher::new();
    hasher.update(&size.to_le_bytes());
    let mut buffer = vec![0; 65536];
    let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
    hasher.update(&buffer[..n]);
    if size > 65536 {
        file.seek(SeekFrom::End(-65536))
            .map_err(|e| e.to_string())?;
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        hasher.update(&buffer[..n]);
    }
    let id = hasher.finalize().to_hex().to_string();
    let mut t = Track {
        identity: Default::default(),
        id,
        title: path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        artist: String::new(),
        album: String::new(),
        genre: String::new(),
        duration_ms: 0,
        source_uri: path.to_string_lossy().into(),
        artwork_url: None,
        release_year: None,
        release_metadata_read: true,
        track_number: None,
        disc_number: None,
        order_metadata_read: true,
        favorite: false,
        available: true,
        demo: false,
        hidden: false,
    };
    if let Ok(tagged) = lofty::read_from_path(path) {
        t.release_year = crate::album_order::release_year(&tagged);
        t.duration_ms = tagged
            .properties()
            .duration()
            .as_millis()
            .min(u64::MAX as u128) as u64;
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(v) = tag.title() {
                t.title = v.into_owned()
            }
            t.identity.artist_names = tag
                .get_strings(&ItemKey::TrackArtists)
                .flat_map(|s| s.split(';'))
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .collect();
            t.identity.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(str::to_owned);
            t.identity.identity_metadata_read = true;
            t.artist = tag.artist().map(|v| v.into_owned()).unwrap_or_default();
            t.album = tag.album().map(|v| v.into_owned()).unwrap_or_default();
            t.genre = tag.genre().map(|v| v.into_owned()).unwrap_or_default();
            t.track_number = tag
                .track()
                .or_else(|| tagged.tags().iter().find_map(|t| t.track()))
                .filter(|n| *n > 0);
            t.disc_number = tag
                .disk()
                .or_else(|| tagged.tags().iter().find_map(|t| t.disk()))
                .filter(|n| *n > 0);
            if let Some(p) = tag.pictures().first() {
                if let Ok(key) = crate::artwork::save_embedded(p.data(), cache) {
                    t.artwork_url = Some(key);
                }
            }
        }
    }
    Ok(t)
}
pub fn refresh_track(store: &mut Store, mut track: Track) -> Result<Track, String> {
    let aliases = store.source_uris(&track.id)?;
    if !aliases.contains(&track.source_uri) || !Path::new(&track.source_uri).is_file() {
        if let Some(uri) = aliases.iter().cloned().find(|uri| Path::new(uri).is_file()) {
            track.source_uri = uri;
        }
    }
    let available = aliases.contains(&track.source_uri) && Path::new(&track.source_uri).is_file();
    if available != track.available
        || store
            .track(&track.id)?
            .is_some_and(|old| old.source_uri != track.source_uri)
    {
        track.available = available;
        store.upsert_track(&track)?;
    }
    Ok(track)
}
pub fn reconcile(store: &mut Store) -> Result<(), String> {
    for track in store.all_tracks()? {
        refresh_track(store, track)?;
    }
    Ok(())
}
