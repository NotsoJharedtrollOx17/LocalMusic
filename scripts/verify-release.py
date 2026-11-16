"""Fail closed on an incorrectly versioned, signed or packaged Android release."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import zipfile

p = argparse.ArgumentParser()
p.add_argument('--apk', required=True, type=Path)
p.add_argument('--native', required=True, type=Path)
p.add_argument('--output', required=True, type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
certificate = json.loads((root / '.github/release-signing.json').read_text())['androidCertificateSha256']
sdk = Path(os.environ.get('ANDROID_HOME', os.environ.get('ANDROID_SDK_ROOT', '')))
tools = sdk / 'build-tools/36.0.0'
suffix = '.exe' if os.name == 'nt' else ''
badging = subprocess.check_output([str(tools / ('aapt' + suffix)), 'dump', 'badging', str(a.apk)], text=True)
assert "name='app.localmusic.year'" in badging and f"versionName='{version}'" in badging
major, minor, patch = map(int, version.split('.'))
assert f"versionCode='{major * 1000000 + minor * 1000 + patch}'" in badging
assert 'application-debuggable' not in badging, 'Release is debuggable'
signature = subprocess.check_output(['java', '-jar', str(tools / 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', str(a.apk)], text=True)
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signature
actual_cert = re.search(r'certificate SHA-256 digest: (\w+)', signature)[1].lower()
assert actual_cert == certificate.lower(), 'Unexpected Android signer'
subprocess.run([str(tools / ('zipalign' + suffix)), '-c', '-P', '16', '4', str(a.apk)], check=True)
with zipfile.ZipFile(a.apk) as z:
    assert z.testzip() is None
    libs = [n for n in z.namelist() if n.startswith('lib/') and n.endswith('.so')]
    assert libs and all(n.startswith('lib/arm64-v8a/') for n in libs), 'Unexpected ABI'
    native = z.read('lib/arm64-v8a/liblocal_music_lib.so')
    native_hash = hashlib.sha256(native).hexdigest()
    assert native_hash == hashlib.sha256(a.native.read_bytes()).hexdigest(), 'Packaged library differs from compiled output'
    assert native[:5] == b'\x7fELF\x02'
    offset = struct.unpack_from('<Q', native, 32)[0]
    size, count = struct.unpack_from('<HH', native, 54)
    for i in range(count):
        pos = offset + i * size
        if struct.unpack_from('<I', native, pos)[0] == 1:
            assert struct.unpack_from('<Q', native, pos + 48)[0] >= 16384, 'ELF load segment is not 16 KiB aligned'
report = {'version': version, 'apkSha256': hashlib.sha256(a.apk.read_bytes()).hexdigest(), 'nativeSha256': native_hash, 'certificateSha256': actual_cert, 'releaseNotDebuggable': True, 'alignment16KiB': True, 'packagedNativeMatches': True}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
