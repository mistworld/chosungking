# API 속도 테스트 스크립트
$url = "https://steep-moon-7816.sucksuck1114.workers.dev/api/validate-word"
$body = @{
    word = "사과"
} | ConvertTo-Json

Write-Host "========================================"
Write-Host "API 속도 테스트"
Write-Host "========================================"
Write-Host "URL: $url"
Write-Host "단어: 사과"
Write-Host ""

$times = @()
for ($i = 1; $i -le 5; $i++) {
    Write-Host "[테스트 $i/5] 요청 중..."
    $elapsed = Measure-Command {
        $response = Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    }
    $ms = [math]::Round($elapsed.TotalMilliseconds, 2)
    $times += $ms
    
    $responseData = $response.Content | ConvertFrom-Json
    $source = $responseData.source
    $valid = $responseData.valid
    $kvTime = if ($responseData._kvTime) { $responseData._kvTime } else { "N/A" }
    
    Write-Host "  응답 시간: $ms ms"
    Write-Host "  소스: $source"
    Write-Host "  유효성: $valid"
    Write-Host "  KV 시간: $kvTime ms"
    Write-Host ""
    
    Start-Sleep -Milliseconds 500
}

Write-Host "========================================"
Write-Host "결과 요약"
Write-Host "========================================"
$avg = ($times | Measure-Object -Average).Average
$min = ($times | Measure-Object -Minimum).Minimum
$max = ($times | Measure-Object -Maximum).Maximum

Write-Host "평균: $([math]::Round($avg, 2)) ms"
Write-Host "최소: $([math]::Round($min, 2)) ms"
Write-Host "최대: $([math]::Round($max, 2)) ms"
Write-Host "========================================"

