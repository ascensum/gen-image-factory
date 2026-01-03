#!/bin/bash
# Generates a self-signed Code Signing certificate on macOS using OpenSSL
# Compatible with Windows AppX/MSIX packaging requirements.

# Default values if not provided via environment or arguments
SUBJECT="${1:-CN=GenImageFactory}"
PASSWORD="${2:-changeit}"
OUTFILE="windows_codesigning_cert.pfx"

echo "Generating Code Signing Certificate for $SUBJECT..."

# 1. Create a configuration file for OpenSSL to include the Code Signing EKU
cat > codesign.conf <<EOF
[req]
distinguished_name = req_distinguished_name
prompt = no
[req_distinguished_name]
CN = ${SUBJECT#CN=}
[ v3_codesign ]
basicConstraints = CA:FALSE
keyUsage = digitalSignature
extendedKeyUsage = codeSigning
EOF

# 2. Generate the certificate and private key
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -config codesign.conf -extensions v3_codesign

# 3. Export to PFX
openssl pkcs12 -export -out "$OUTFILE" -inkey key.pem -in cert.pem -password "pass:$PASSWORD"

# 4. Clean up temp files
rm key.pem cert.pem codesign.conf

echo "----------------------------------------------------------"
echo "SUCCESS! PFX exported to: $OUTFILE"
echo "----------------------------------------------------------"
echo "Next Steps:"
echo "1. Run the following command to get the Base64 string:"
echo "   base64 -i \"$OUTFILE\" | pbcopy"
echo "2. The string is now in your clipboard. Update GITHUB_SECRET 'WINDOWS_PFX_BASE64'."
echo "3. Update GITHUB_SECRET 'WINDOWS_PFX_PASSWORD' with: $PASSWORD"
echo "4. Ensure MS_STORE_PUBLISHER_ID in GitHub Secrets is exactly: $SUBJECT"
echo "----------------------------------------------------------"