param([switch]$WithEmulator)
$ErrorActionPreference = 'Stop'
$musicRoot = Split-Path -Parent $PSScriptRoot
$musicTools = Join-Path $musicRoot '.tools'
New-Item -ItemType Directory -Force -Path $musicTools | Out-Null
function Get-MusicArchive([string]$Url,[string]$Name,[string]$Hash,[string]$Destination) {
 $archive = Join-Path $musicTools $Name
 if (-not (Test-Path $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $archive }
 if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Hash) { throw "Checksum mismatch: $Name" }
 $complete = Join-Path $Destination ".archive-sha256"
 if (-not (Test-Path $complete) -or (Get-Content -LiteralPath $complete -Raw).Trim() -ne $Hash) {
   Expand-Archive -LiteralPath $archive -DestinationPath $Destination -Force
   Set-Content -LiteralPath $complete -Value $Hash
 }
}
Get-MusicArchive 'https://github.com/mstorsjo/llvm-mingw/releases/download/20261006/llvm-mingw-20261006-ucrt-x86_64.zip' 'llvm-mingw.zip' '317492C456AA27EE607A5919F1D2D38DCDC1112516A24D0BF4B00D078F52D17A' (Join-Path $musicTools 'llvm-mingw')
Get-MusicArchive 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip' 'jdk.zip' 'E53A79C3C3D86865BD7E787903884331068E71321714FFD44F145785AFFC7CB0' (Join-Path $musicTools 'jdk')
Get-MusicArchive 'https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip' 'android-cli.zip' 'CC610CCBE83FADDB58E1AA68E8FC8743BB30AA5E83577ECEB4CC168DAE95F9EE' (Join-Path $musicTools 'android-cli')
New-Item -ItemType Directory -Force -Path (Join-Path $musicTools 'android-sdk') | Out-Null
. "$PSScriptRoot/env.ps1"
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) { throw 'Install Rustup from https://rustup.rs then rerun this script.' }
& rustup toolchain install stable-x86_64-pc-windows-gnullvm --profile minimal --component rustfmt
if ($LASTEXITCODE -ne 0) { throw 'Rust toolchain installation failed' }
& rustup target add aarch64-linux-android x86_64-linux-android
if ($LASTEXITCODE -ne 0) { throw 'Android Rust target installation failed' }
$musicCli = Join-Path $musicTools 'android-cli/cmdline-tools'
$musicJavaExe = Join-Path $env:JAVA_HOME 'bin/java.exe'
$musicSdkArgs = @("-Dcom.android.sdkmanager.toolsdir=$musicCli",'-cp',"$musicCli/lib/sdkmanager-classpath.jar",'com.android.sdklib.tool.sdkmanager.SdkManagerCli',"--sdk_root=$env:ANDROID_HOME")
& $musicJavaExe @musicSdkArgs --licenses
if ($LASTEXITCODE -ne 0) { throw 'Android SDK license step failed' }
$musicPackages = @('platform-tools','platforms;android-36','build-tools;36.0.0','ndk;29.0.14206865')
if ($WithEmulator) { $musicPackages += @('emulator','system-images;android-33;google_apis;x86_64') }
& $musicJavaExe @musicSdkArgs --install @musicPackages
if ($LASTEXITCODE -ne 0) { throw 'Android SDK package installation failed' }
. "$PSScriptRoot/env.ps1"
Write-Output 'Setup complete. Run npm.cmd ci and npm.cmd run doctor.'
