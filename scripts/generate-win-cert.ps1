<#
.SYNOPSIS
    Generates a self-signed Code Signing certificate compatible with Windows AppX/MSIX packaging.
    
.DESCRIPTION
    AppX packaging requires a certificate with the Code Signing EKU (OID 1.3.6.1.5.5.7.3.3).
    This script creates such a certificate and exports it as a PFX file.
    
.PARAMETER Subject
    The Subject name. Must match MS_STORE_PUBLISHER_ID (e.g., "CN=ShiftlineTools").
    
.PARAMETER Password
    The password for the PFX file.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Subject,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [string]$OutFile = "windows_codesigning_cert.pfx"
)

$ErrorActionPreference = "Stop"

Write-Host "Generating Code Signing Certificate for $Subject..." -ForegroundColor Cyan

# 1. Create the certificate with the mandatory CodeSigning type
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
    -Subject $Subject `
    -KeyUsage DigitalSignature `
    -FriendlyName "GenImageFactory AppX Dev Cert" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(1)

Write-Host "Certificate created with Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green

# 2. Export to PFX
$secPassword = ConvertTo-SecureString -String $Password -AsPlainText -Force
$certPath = "Cert:\CurrentUser\My\$($cert.Thumbprint)"

Export-PfxCertificate -Cert $certPath -FilePath $OutFile -Password $secPassword

Write-Host "Success! PFX exported to: $OutFile" -ForegroundColor Green
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Convert to Base64: [Convert]::ToBase64String([System.IO.File]::ReadAllBytes('$OutFile'))"
Write-Host "2. Update GITHUB_SECRET 'WINDOWS_PFX_BASE64' with the output."
Write-Host "3. Update GITHUB_SECRET 'WINDOWS_PFX_PASSWORD' with your password."
Write-Host "4. Ensure MS_STORE_PUBLISHER_ID matches '$Subject' exactly."
