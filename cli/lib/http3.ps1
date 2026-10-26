# JSON input arrives only on stdin. Never place credentials in command arguments,
# environment variables, a temporary file, or diagnostic output.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$client = $null
$request = $null
$response = $null
$sent = $false
try {
    if (-not [System.Net.Quic.QuicConnection]::IsSupported) {
        throw [System.PlatformNotSupportedException]::new('HTTP/3 unavailable')
    }
    $inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json -AsHashtable
    $uri = [Uri]::new([string]$inputData.url)
    if ($uri.Scheme -ne 'https' -or $uri.UserInfo) { throw 'Invalid HTTPS destination' }
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $false
    # Keep the platform's certificate validation and proxy configuration.
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromMilliseconds([Math]::Max(1, [Math]::Min(25000, [double]$inputData.timeoutMs)))
    $client.MaxResponseContentBufferSize = 64MB
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new([string]$inputData.method), $uri)
    $request.Version = [Version]'3.0'
    $request.VersionPolicy = [System.Net.Http.HttpVersionPolicy]::RequestVersionExact
    if ($null -ne $inputData.body) {
        $request.Content = [System.Net.Http.ByteArrayContent]::new([System.Text.Encoding]::UTF8.GetBytes([string]$inputData.body))
    }
    foreach ($header in $inputData.headers.GetEnumerator()) {
        if (-not $request.Headers.TryAddWithoutValidation([string]$header.Key, [string]$header.Value)) {
            if ($null -eq $request.Content) { $request.Content = [System.Net.Http.ByteArrayContent]::new([byte[]]::new(0)) }
            [void]$request.Content.Headers.TryAddWithoutValidation([string]$header.Key, [string]$header.Value)
        }
    }
    $sent = $true
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $headers = @{}
    foreach ($header in $response.Headers) { $headers[$header.Key] = @($header.Value) }
    foreach ($header in $response.Content.Headers) { $headers[$header.Key] = @($header.Value) }
    $result = @{ ok = $true; status = [int]$response.StatusCode; headers = $headers; body = [Convert]::ToBase64String($bytes); protocol = $response.Version.ToString() }
    [Console]::Out.Write((ConvertTo-Json -InputObject $result -Depth 8 -Compress))
} catch {
    $code = if ($sent) { 'HTTP3_REQUEST_FAILED' } else { 'HTTP3_UNAVAILABLE' }
    $exception = $_.Exception
    while ($null -ne $exception) {
        if ($exception -is [System.OperationCanceledException]) { $code = 'REQUEST_TIMEOUT' }
        if ($exception -is [System.Security.Authentication.AuthenticationException]) { $code = 'CERTIFICATE_ERROR' }
        $exception = $exception.InnerException
    }
    # Raw .NET exceptions can include URLs or request details; return a code only.
    [Console]::Out.Write((ConvertTo-Json -InputObject @{ ok = $false; code = $code } -Compress))
} finally {
    if ($null -ne $response) { $response.Dispose() }
    if ($null -ne $request) { $request.Dispose() }
    if ($null -ne $client) { $client.Dispose() }
}
