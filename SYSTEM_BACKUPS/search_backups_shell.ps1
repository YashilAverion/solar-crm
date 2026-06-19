$tempDir = "c:\Users\vishr\OneDrive - Ares Energy\Solar CRM\SYSTEM_BACKUPS\temp_extract_scan"
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$zips = Get-ChildItem "c:\Users\vishr\OneDrive - Ares Energy\Solar CRM\SYSTEM_BACKUPS\*.zip" | Sort-Object LastWriteTime -Descending
Write-Host "Found $($zips.Count) zip archives. Scanning starting from the latest..."

foreach ($zip in $zips) {
    $zipPath = $zip.FullName
    $zipName = $zip.Name
    $targetExtractDir = Join-Path $tempDir $zip.BaseName
    
    try {
        # Create folder for this zip
        New-Item -ItemType Directory -Path $targetExtractDir -Force | Out-Null
        
        # We can extract just public/products.html using .NET class or standard Shell.Application,
        # but since we want to be highly compatible, we use standard Expand-Archive with a filter if supported,
        # or we just let it run. However, Expand-Archive expands everything. To make it super fast, we can use Shell.Application.
        $shell = New-Object -ComObject Shell.Application
        $zipCom = $shell.NameSpace($zipPath)
        $publicFolder = $zipCom.Items() | Where-Object { $_.Name -eq "public" }
        if ($publicFolder) {
            $publicFolderCom = $shell.NameSpace($publicFolder.Path)
            $productsFile = $publicFolderCom.Items() | Where-Object { $_.Name -eq "products.html" }
            if ($productsFile) {
                # Copy products.html to targetExtractDir
                $targetFolderCom = $shell.NameSpace($targetExtractDir)
                $targetFolderCom.CopyHere($productsFile, 16) # 16 = Respond with Yes to All
                
                # Wait a tiny bit for async shell operations to finish
                Start-Sleep -Milliseconds 300
                
                $extractedFile = Join-Path $targetExtractDir "products.html"
                if (Test-Path $extractedFile) {
                    $text = [System.IO.File]::ReadAllText($extractedFile)
                    if ($text.Contains("function renderTable(){")) {
                        Write-Host "FOUND: $zipName has the full uncorrupted renderTable! Last modified: $($zip.LastWriteTime)"
                        # Let's check if it also has "Type of Inverter"
                        if ($text.Contains("Type of Inverter")) {
                            Write-Host "PERFECT MATCH: It also contains Inverter Type! Date: $($zip.LastWriteTime)"
                        } else {
                            Write-Host "MATCH: It has renderTable, but does NOT contain Inverter Type. Date: $($zip.LastWriteTime)"
                        }
                        
                        # Let's save this as the baseline target
                        $baselinePath = Join-Path $tempDir "baseline_products.html"
                        Copy-Item -Path $extractedFile -Destination $baselinePath -Force
                        break
                    }
                }
            }
        }
    } catch {
        Write-Host "Error scanning $zipName"
    }
}

if (Test-Path (Join-Path $tempDir "baseline_products.html")) {
    Write-Host "Successfully located baseline file!"
} else {
    Write-Host "Failed to locate any products.html baseline with renderTable defined."
}
