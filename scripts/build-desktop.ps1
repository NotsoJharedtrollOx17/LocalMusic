param([switch]$Debug,[switch]$Portable)
$ErrorActionPreference='Stop'
. "$PSScriptRoot\env.ps1"
Push-Location $musicRoot
try {
 $musicArgs=@('run','tauri','--','build','--features','custom-protocol')
 if($Debug){$musicArgs+='--debug'}
 if($Portable -or $musicGnu){$musicArgs+=@('--no-bundle')}
 $musicPreviousErrorAction=$ErrorActionPreference
 try {
  $ErrorActionPreference='Continue'
  & npm.cmd @musicArgs
  $musicExit=$LASTEXITCODE
 }finally{$ErrorActionPreference=$musicPreviousErrorAction}
 if($musicExit -ne 0){throw "Desktop build failed ($musicExit)"}
 if($Portable -or $musicGnu){
  $musicProfile=if($Debug){"debug"}else{"release"}
  $musicDesktopOutput=Join-Path $musicRoot "src-tauri/target/$musicProfile"
  $musicLoader=Get-ChildItem (Join-Path $musicDesktopOutput "build") -Filter "WebView2Loader.dll" -Recurse | Where-Object {$_.Directory.Name -eq "x64"} | Select-Object -First 1
  if($musicLoader){Copy-Item -LiteralPath $musicLoader.FullName -Destination $musicDesktopOutput -Force}
  Copy-Item -LiteralPath (Join-Path $musicRoot "public/licenses/llvm-runtime.txt") -Destination $musicDesktopOutput -Force
  if($musicGnu){foreach($musicRuntime in @("libunwind.dll")){ $musicRuntimePath=Join-Path $musicGnu.FullName "bin/$musicRuntime"; if(Test-Path $musicRuntimePath){Copy-Item -LiteralPath $musicRuntimePath -Destination $musicDesktopOutput -Force}}}
 }
}finally{Pop-Location}
