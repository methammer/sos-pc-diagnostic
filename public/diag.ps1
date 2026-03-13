$ErrorActionPreference = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle = "SOS-PC - Diagnostic en cours..."
Write-Host ""; Write-Host "  +-----------------------------------------+" -ForegroundColor Cyan; Write-Host "  |        SOS-PC - Diagnostic PC           |" -ForegroundColor Cyan; Write-Host "  +-----------------------------------------+" -ForegroundColor Cyan; Write-Host ""; Write-Host "  Collecte des informations systeme..." -ForegroundColor White; Write-Host ""
Write-Host "  [1/7] Systeme d exploitation..." -ForegroundColor Gray
$os = Get-CimInstance Win32_OperatingSystem
$osInfo = @{ name=$os.Caption; version=$os.Version; build=$os.BuildNumber; arch=$os.OSArchitecture; uptime=[math]::Round((New-TimeSpan -Start $os.LastBootUpTime).TotalHours,1); ram_total_gb=[math]::Round($os.TotalVisibleMemorySize/1MB,1); ram_free_gb=[math]::Round($os.FreePhysicalMemory/1MB,1) }
Write-Host "  [2/7] Processeur..." -ForegroundColor Gray
$cpu=Get-CimInstance Win32_Processor|Select-Object -First 1; $cpuLoad=(Get-CimInstance Win32_Processor|Measure-Object -Property LoadPercentage -Average).Average
$cpuInfo = @{ name=$cpu.Name.Trim(); cores=$cpu.NumberOfCores; threads=$cpu.NumberOfLogicalProcessors; load=[int]$cpuLoad; max_mhz=$cpu.MaxClockSpeed }
Write-Host "  [3/7] Stockage..." -ForegroundColor Gray
$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|ForEach-Object { @{ letter=$_.DeviceID; total_gb=[math]::Round($_.Size/1GB,1); free_gb=[math]::Round($_.FreeSpace/1GB,1); pct_used=if($_.Size-gt 0){[math]::Round((1-$_.FreeSpace/$_.Size)*100)}else{0} } }
Write-Host "  [4/7] Carte graphique..." -ForegroundColor Gray
$gpu=Get-CimInstance Win32_VideoController|Select-Object -First 1; $gpuInfo=@{ name=$gpu.Name; ram_mb=[math]::Round($gpu.AdapterRAM/1MB); driver=$gpu.DriverVersion }
Write-Host "  [5/7] Processus actifs..." -ForegroundColor Gray
$topProcs=Get-Process|Sort-Object WorkingSet64 -Descending|Select-Object -First 8|ForEach-Object { @{ name=$_.Name; ram_mb=[math]::Round($_.WorkingSet64/1MB); cpu=[math]::Round($_.CPU,1) } }
Write-Host "  [6/7] Demarrage automatique..." -ForegroundColor Gray
$startupApps=@(); foreach($path in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run","HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run")){ if(Test-Path $path){ Get-ItemProperty $path|Get-Member -MemberType NoteProperty|Where-Object{$_.Name -notlike "PS*"}|ForEach-Object{$startupApps+=$_.Name} } }
Write-Host "  [7/7] Journal d evenements..." -ForegroundColor Gray
$since=(Get-Date).AddHours(-24); $critCount=(Get-WinEvent -FilterHashtable @{LogName='System','Application';Level=1,2;StartTime=$since} -MaxEvents 50 -ErrorAction SilentlyContinue|Measure-Object).Count; $recentErrors=Get-WinEvent -FilterHashtable @{LogName='System';Level=2;StartTime=$since} -MaxEvents 3 -ErrorAction SilentlyContinue|ForEach-Object{ @{id=$_.Id;msg=($_.Message -split "`n")[0] -replace '[^\x20-\x7E]',''} }
$payload=@{ os=$osInfo; cpu=$cpuInfo; gpu=$gpuInfo; disks=@($disks); procs=@($topProcs); startup=@($startupApps|Select-Object -First 10); events=@{critical_24h=$critCount;samples=@($recentErrors)}; collected_at=(Get-Date -Format "yyyy-MM-ddTHH:mm:ss") }
$json=$payload|ConvertTo-Json -Depth 5 -Compress; $bytes=[System.Text.Encoding]::UTF8.GetBytes($json); $encoded=[Convert]::ToBase64String($bytes)
Write-Host ""; Write-Host "  Collecte terminee !" -ForegroundColor Green; Write-Host "  Retour sur sos-pc.click avec votre diagnostic..." -ForegroundColor White; Write-Host ""
Start-Process "https://sos-pc.click/?diag=$encoded"
Start-Sleep 2; Write-Host "  Retournez sur l onglet SOS-PC dans votre navigateur !" -ForegroundColor Cyan; Start-Sleep 2
