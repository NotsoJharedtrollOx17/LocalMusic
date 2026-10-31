"""Create a NEW isolated Windows inspection profile; never replace an existing DB.
Run from the repository root before building/launching the native probe.
"""
from pathlib import Path
import json, os, re, sqlite3, wave

IDENTITY = 'app.localmusic.detachedprobe20261031'
output = Path('artifacts/detached-windows')
profile = Path(os.environ['APPDATA']).resolve() / IDENTITY
assert profile.name == IDENTITY and profile.parent == Path(os.environ['APPDATA']).resolve()
assert not (profile / 'music.sqlite').exists(), 'Refusing to overwrite a probe database'
output.mkdir(parents=True, exist_ok=True)
profile.mkdir(exist_ok=True)
schema = re.search(r'const SCHEMA: &str = r#"(.*?)"#;', Path('crates/music-core/src/store.rs').read_text(encoding='utf-8'), re.S).group(1)
with sqlite3.connect(profile / 'music.sqlite') as db:
    db.executescript(schema)
    settings = dict(language='en', theme='light', timeZone='America/Los_Angeles', historyEnabledSince='2026-10-31T00:00:00Z', privacyRevision=0)
    db.execute('INSERT INTO settings VALUES(?,?)', ('preferences', json.dumps(settings)))
    for index in range(12):
        source = (output / f'fixture-{index}.wav').resolve()
        assert not source.exists(), 'Refusing to replace a fixture'
        with wave.open(str(source), 'wb') as audio:
            audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            audio.writeframes(b'\0\0' * 16000 * 120)
        track = dict(id=f'native-{index}', title=f'Native song {index:05}', artist=f'Native Artist {index:05}', album=f'Native Album {index:05}', genre='', durationMs=120000, sourceUri=str(source), favorite=False, available=True, demo=True, orderMetadataRead=True, releaseMetadataRead=True)
        db.execute('INSERT INTO tracks VALUES(?,?,?,?,?)', (track['id'], track['title'], track['artist'], track['album'], json.dumps(track)))
        db.execute('INSERT INTO tracks_fts VALUES(?,?,?,?)', (track['id'], track['title'], track['artist'], track['album']))
        db.execute('INSERT INTO track_sources(uri,track_id) VALUES(?,?)', (track['sourceUri'], track['id']))
    queue = dict(trackId='native-0', playing=False, positionMs=12000, durationMs=120000, queue=['native-0', 'native-1', 'native-2'], queueIndex=0, shuffle=False, repeat='off', excluded=False)
    db.execute('INSERT INTO settings VALUES(?,?)', ('queue', json.dumps(queue)))
(output / 'probe-config.json').write_text(json.dumps(dict(identifier=IDENTITY, build=dict(beforeBuildCommand=''))), encoding='utf-8')
print(json.dumps(dict(identity=IDENTITY, tracks=12, profile=str(profile))))
