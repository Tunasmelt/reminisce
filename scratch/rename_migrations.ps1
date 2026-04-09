
$migrations = @{
    "00000000000000_init.sql" = "00000000000000_core_schema.sql";
    "00000000000001_init.sql" = "00000000000001_economy_and_wallet.sql";
    "00000000000002_init.sql" = "00000000000002_graph_and_board.sql";
    "00000000000004_init.sql" = "00000000000004_placeholder.sql";
    "00000000000005_init.sql" = "00000000000005_pam_threads.sql";
    "00000000000006_init.sql" = "00000000000006_pam_phase2_and_prompts.sql";
    "00000000000007_init.sql" = "00000000000007_project_reminders.sql";
    "00000000000008_init.sql" = "00000000000008_context_sync_and_git.sql";
    "00000000000009_init.sql" = "00000000000009_admin_and_models.sql";
    "0000000000010_init.sql"  = "00000000000010_missing_columns_and_templates.sql"
}

$baseDir = "supabase/migrations"

foreach ($oldName in $migrations.Keys) {
    $newName = $migrations[$oldName]
    $oldPath = Join-Path $baseDir $oldName
    $newPath = Join-Path $baseDir $newName
    
    if (Test-Path $oldPath) {
        $content = Get-Content $oldPath -Raw
        $desc = $newName.Substring(15).Replace(".sql", "").Replace("_", " ")
        $header = "-- Originally: $oldName | Feature: $desc`r`n"
        $newContent = $header + $content
        
        Set-Content -Path $newPath -Value $newContent -NoNewline
        Remove-Item $oldPath
        Write-Host "Renamed $oldName to $newName"
    } else {
        Write-Warning "File not found: $oldPath"
    }
}
