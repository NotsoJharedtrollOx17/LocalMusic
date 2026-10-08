$ErrorActionPreference='Stop'
. "$PSScriptRoot\env.ps1"
$musicChecks = @(
 @{Name='Node';Command='node'},@{Name='npm';Command='npm.cmd'},
 @{Name='Rust';Command='cargo'},@{Name='Rustup';Command='rustup'},
 @{Name='Android Java';Command='java'},@{Name='Android device bridge';Command='adb'}
)
foreach($musicCheck in $musicChecks) {
 $musicFound=Get-Command $musicCheck.Command -ErrorAction SilentlyContinue
 if($musicFound) { Write-Output "[FOUND] $($musicCheck.Name): $($musicFound.Source)" }
 else { Write-Output "[MISSING] $($musicCheck.Name)" }
}
Write-Output "JAVA_HOME: $env:JAVA_HOME"
Write-Output "ANDROID_HOME: $env:ANDROID_HOME"
Write-Output "NDK_HOME: $env:NDK_HOME"
$musicVswhere='C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
if(Test-Path $musicVswhere){& $musicVswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath}
if(Get-Command rustup -ErrorAction SilentlyContinue){& rustup target list --installed}
Write-Output 'See README.md for required setup and run commands.'
