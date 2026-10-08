param([switch]$Debug,[switch]$Portable)
$ErrorActionPreference='Stop'
. "$PSScriptRoot\env.ps1"
Push-Location $musicRoot
try {
 $musicArgs=@('run','tauri','--','build','--features','custom-protocol')
 if($Debug){$musicArgs+='--debug'}
 if($Portable -or $musicGnu){$musicArgs+=@('--no-bundle')}
 & npm.cmd @musicArgs
 if($LASTEXITCODE -ne 0){throw "Desktop build failed ($LASTEXITCODE)"}
}finally{Pop-Location}
