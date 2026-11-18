param(
    [Parameter(Mandatory = $true)][string]$BackendPath,
    [Parameter(Mandatory = $true)][string]$FrontendPath
)
$ErrorActionPreference = 'Stop'
foreach ($repo in @($BackendPath, $FrontendPath)) {
    git -C $repo rev-parse --is-inside-work-tree
    if ($LASTEXITCODE -ne 0) { throw "No es un repositorio: $repo" }
    $cambios = git -C $repo status --porcelain
    if ($cambios) { throw "Hay cambios locales en $repo. Guárdalos antes de actualizar." }
}
git -C $BackendPath pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar el backend.' }
npm --prefix $BackendPath ci
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
git -C $FrontendPath pull --ff-only origin master
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar Android.' }
Write-Host 'Repositorios actualizados. Abre Android Studio y sincroniza Gradle.'
