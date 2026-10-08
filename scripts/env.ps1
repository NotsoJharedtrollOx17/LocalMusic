$musicRoot = Split-Path -Parent $PSScriptRoot
$musicCargo = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path $musicCargo) { $env:PATH = "$musicCargo;$env:PATH" }
$musicGnu = Get-ChildItem (Join-Path $musicRoot '.tools\llvm-mingw') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($musicGnu) {
 $env:RUSTUP_TOOLCHAIN = 'stable-x86_64-pc-windows-gnullvm'
 $env:PATH = "$(Join-Path $musicGnu.FullName 'bin');$env:PATH"
 $env:CC_x86_64_pc_windows_gnullvm = 'x86_64-w64-mingw32-clang'
 $env:CXX_x86_64_pc_windows_gnullvm = 'x86_64-w64-mingw32-clang++'
 $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNULLVM_LINKER = 'x86_64-w64-mingw32-clang'
}
$musicJava = Get-ChildItem (Join-Path $musicRoot '.tools\jdk') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($musicJava) { $env:JAVA_HOME = $musicJava.FullName; $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }
$musicSdkRoot = Join-Path $musicRoot '.tools\android-sdk'
if (Test-Path $musicSdkRoot) {
 $env:ANDROID_HOME = $musicSdkRoot
 $env:PATH = "$musicSdkRoot\platform-tools;$musicSdkRoot\emulator;$env:PATH"
 $musicNdk = Get-ChildItem "$musicSdkRoot\ndk" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
 if ($musicNdk) { $env:NDK_HOME = $musicNdk.FullName }
}
$env:CARGO_BUILD_JOBS = '2'
