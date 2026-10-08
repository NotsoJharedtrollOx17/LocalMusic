param([switch]$Debug,[ValidateSet('aarch64','x86_64')][string]$Target='aarch64')
$ErrorActionPreference='Stop'
. "$PSScriptRoot/env.ps1"
$musicTriple=if($Target -eq 'aarch64'){'aarch64-linux-android'}else{'x86_64-linux-android'}
$musicAbi=if($Target -eq 'aarch64'){'arm64-v8a'}else{'x86_64'}
$musicArch=if($Target -eq 'aarch64'){'arm64'}else{'x86_64'}
$musicProfile=if($Debug){'debug'}else{'release'}
$musicVariant=if($Debug){'Debug'}else{'Release'}
$musicFlavor=$musicArch.Substring(0,1).ToUpper()+$musicArch.Substring(1)
$musicLibrary=Join-Path $musicRoot "src-tauri/target/$musicTriple/$musicProfile/liblocal_music_lib.so"
if(-not (Test-Path -LiteralPath $musicLibrary)){throw "Compile the native library first: $musicLibrary"}
$musicAndroidRoot=Join-Path $musicRoot 'src-tauri/gen/android'
$musicDestination=Join-Path $musicAndroidRoot "app/src/main/jniLibs/$musicAbi"
New-Item -ItemType Directory -Force -Path $musicDestination | Out-Null
Copy-Item -LiteralPath $musicLibrary -Destination (Join-Path $musicDestination 'liblocal_music_lib.so') -Force
Set-Content -LiteralPath (Join-Path $musicAndroidRoot 'local.properties') -Value ('sdk.dir='+$env:ANDROID_HOME.Replace('\','/'))
$musicWrapper=Join-Path $musicAndroidRoot 'gradle/wrapper/gradle-wrapper.jar'
& "$env:JAVA_HOME/bin/java.exe" -jar $musicWrapper -p $musicAndroidRoot "assemble$musicFlavor$musicVariant" '-x' ":app:rustBuild$musicFlavor$musicVariant" "-PabiList=$musicAbi" "-ParchList=$musicArch" "-PtargetList=$Target" '--console=plain'
if($LASTEXITCODE -ne 0){throw "Gradle APK packaging failed ($LASTEXITCODE)"}
