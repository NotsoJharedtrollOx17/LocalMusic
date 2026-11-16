param([string]$Output='artifacts/release-assets')
$ErrorActionPreference='Stop'
$musicRoot=Split-Path -Parent $PSScriptRoot
$musicVersion=(Get-Content (Join-Path $musicRoot 'package.json') -Raw | ConvertFrom-Json).version
$musicExe=Join-Path $musicRoot 'src-tauri/target/release/local-music.exe'
if((Get-Item -LiteralPath $musicExe).VersionInfo.ProductVersion -ne $musicVersion){throw 'Windows version mismatch'}
$musicOut=Join-Path $musicRoot $Output
$musicPortable=Join-Path $musicOut 'portable'
New-Item -ItemType Directory -Force -Path $musicPortable | Out-Null
Copy-Item -LiteralPath $musicExe -Destination $musicPortable
foreach($musicDll in @('WebView2Loader.dll','libunwind.dll')){
 $musicPath=Join-Path (Split-Path $musicExe) $musicDll
 if(Test-Path -LiteralPath $musicPath){Copy-Item -LiteralPath $musicPath -Destination $musicPortable}
}
Copy-Item -LiteralPath (Join-Path $musicRoot 'LICENSE') -Destination $musicPortable
Copy-Item -LiteralPath (Join-Path $musicRoot 'docs/third-party-notices.md') -Destination $musicPortable
Copy-Item -LiteralPath (Join-Path $musicRoot 'public/licenses') -Destination (Join-Path $musicPortable 'licenses') -Recurse
Compress-Archive -Path (Join-Path $musicPortable '*') -DestinationPath (Join-Path $musicOut "Local-Music-v$musicVersion-windows-x64-portable.zip") -Force
$musicInstallers=@(Get-ChildItem (Join-Path $musicRoot 'src-tauri/target/release/bundle/nsis') -Filter '*setup.exe')
if($musicInstallers.Count -ne 1){throw 'Expected exactly one Windows installer'}
Copy-Item -LiteralPath $musicInstallers[0].FullName -Destination (Join-Path $musicOut "Local-Music-v$musicVersion-windows-x64-setup.exe")
Get-ChildItem $musicOut -File | Where-Object {$_.Name -notlike '*SHA256SUMS*'} | ForEach-Object { "$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)" } | Set-Content (Join-Path $musicOut 'windows-SHA256SUMS.txt')
