Add-Type -AssemblyName "System.IO.Compression.FileSystem"
$zips = Get-ChildItem "c:\Users\vishr\OneDrive - Ares Energy\Solar CRM\SYSTEM_BACKUPS\*.zip" | Sort-Object LastWriteTime -Descending
foreach ($zip in $zips) {
    try {
        $archive = [System.IO.Compression]::ZipFile::OpenRead($zip.FullName)
        $entry = $archive.Entries | Where-Object { $_.FullName -eq "public/products.html" }
        if ($entry) {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            if ($text.Contains("function renderTable(){")) {
                Write-Host "FOUND: $($zip.Name) is uncorrupted! Date: $($zip.LastWriteTime)"
                $archive.Dispose()
                exit 0
            }
        }
        $archive.Dispose()
    } catch {
        Write-Host "Error checking $($zip.Name): $_"
    }
}
Write-Host "No uncorrupted backup with renderTable found!"
exit 1
