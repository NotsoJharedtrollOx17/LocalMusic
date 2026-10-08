param([switch]$Debug,[ValidateSet('aarch64','x86_64')][string]$Target='aarch64')
$ErrorActionPreference='Stop'
. "$PSScriptRoot/env.ps1"
if(-not $env:ANDROID_HOME -or -not $env:NDK_HOME){throw 'Android SDK and NDK are missing. Run doctor and follow README.'}
Push-Location $musicRoot
try {
 $musicArgs=@('run','tauri','--','android','build','--apk','--target',$Target,'--features','custom-protocol')
 if($Debug){$musicArgs+='--debug'}
 $musicOutput=New-Object System.Collections.Generic.List[string]
 $musicPreviousErrorAction=$ErrorActionPreference
 try {
  $ErrorActionPreference="Continue"
  & npm.cmd @musicArgs 2>&1 | ForEach-Object { $musicLine=$_.ToString();$musicOutput.Add($musicLine);Write-Output $musicLine }
  $musicExit=$LASTEXITCODE
 }finally{$ErrorActionPreference=$musicPreviousErrorAction}
 if($musicExit -ne 0){
  if(($musicOutput -join [Environment]::NewLine) -match 'Creation symbolic link is not allowed'){
   Write-Output 'Native compilation succeeded; using file-copy APK packaging on this Windows machine.'
   & "$PSScriptRoot/package-android.ps1" -Target $Target -Debug:$Debug
  }else{throw "Android build failed ($musicExit)"}
 }
}finally{Pop-Location}
