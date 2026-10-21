$jsonPath = "D:\下载\第一版flow-journey (2)\package.json"
$backupPath = "D:\下载\第一版flow-journey (2)\package.json.backup"

# Backup original file
Copy-Item $jsonPath $backupPath

# Read and parse JSON
$jsonContent = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json

# Remove backend dependencies
$backendDeps = @("express", "mongoose", "jsonwebtoken", "bcryptjs", "resend", "tsx", "cookie-parser", "dotenv")
foreach ($dep in $backendDeps) {
    if ($jsonContent.dependencies.PSObject.Properties.Name -contains $dep) {
        $jsonContent.dependencies.PSObject.Properties.Remove($dep)
        Write-Host "Removed dependency: $dep"
    }
}

# Remove backend type definitions
$backendTypes = @("@types/express", "@types/jsonwebtoken", "@types/cookie-parser", "@types/bcryptjs")
foreach ($type in $backendTypes) {
    if ($jsonContent.devDependencies.PSObject.Properties.Name -contains $type) {
        $jsonContent.devDependencies.PSObject.Properties.Remove($type)
        Write-Host "Removed type definition: $type"
    }
}

# Update scripts
$jsonContent.scripts.dev = "vite"
$jsonContent.scripts.PSObject.Properties.Remove("start")

# Save modified JSON
$jsonContent | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath

Write-Host "package.json modified successfully!"
Write-Host "Original file backed up as package.json.backup"