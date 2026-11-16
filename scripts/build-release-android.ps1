param([string]$SigningConfig=(Join-Path $env:USERPROFILE '.local-music-signing/signing.json'))
$ErrorActionPreference='Stop'
if(-not (Test-Path -LiteralPath $SigningConfig)){throw 'Private signing configuration is missing; see docs/release-process.md'}
$musicSigning=Get-Content -LiteralPath $SigningConfig -Raw | ConvertFrom-Json
$musicNames=@('LOCAL_MUSIC_KEYSTORE','LOCAL_MUSIC_STORE_PASSWORD','LOCAL_MUSIC_KEY_ALIAS','LOCAL_MUSIC_KEY_PASSWORD')
$musicPrevious=@{}
foreach($musicName in $musicNames){$musicPrevious[$musicName]=[Environment]::GetEnvironmentVariable($musicName)}
try {
 $env:LOCAL_MUSIC_KEYSTORE=$musicSigning.storeFile
 $env:LOCAL_MUSIC_STORE_PASSWORD=$musicSigning.storePassword
 $env:LOCAL_MUSIC_KEY_ALIAS=$musicSigning.keyAlias
 $env:LOCAL_MUSIC_KEY_PASSWORD=$musicSigning.keyPassword
 & "$PSScriptRoot/build-android.ps1" -Target aarch64
}finally{
 foreach($musicName in $musicNames){[Environment]::SetEnvironmentVariable($musicName,$musicPrevious[$musicName])}
}
