# Microsoft Store Identity Secrets Setup

This document describes how to configure GitHub secrets for Microsoft Store identity information.

## Required GitHub Secrets

Create the following secrets in your GitHub repository (Settings → Secrets and variables → Actions):

### Store Identity Secrets

**IMPORTANT**: The actual values for these secrets are NOT stored in this repository. They must be configured in GitHub Secrets (Settings → Secrets and variables → Actions).

1. **`MS_STORE_IDENTITY_NAME`**
   - Description: Microsoft Store identity name (immutable)
   - Format: `OrganizationName.AppName`
   - Example: `ShiftlineTools.GenImageFactory`

2. **`MS_STORE_PUBLISHER_ID`**
   - Description: Publisher certificate identifier
   - Format: `CN=<GUID>`
   - Example: `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`

3. **`MS_STORE_PUBLISHER_DISPLAY_NAME`**
   - Description: User-visible publisher name
   - Format: Plain text organization name
   - Example: `Shiftline Tools`

4. **`MS_STORE_STORE_ID`**
   - Description: Microsoft Store application ID
   - Format: Alphanumeric Store ID
   - Example: `9PXXXXXXXX`

5. **`MS_STORE_PACKAGE_FAMILY_NAME`**
   - Description: Package Family Name (PFN)
   - Format: `IdentityName_Hash`
   - Example: `OrganizationName.AppName_XXXXXXXXXXXX`

6. **`MS_STORE_PACKAGE_SID`**
   - Description: Package Security Identifier
   - Format: `S-1-15-2-<numbers>`
   - Example: `S-1-15-2-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

## How to Create Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## Usage in Workflows

These secrets can be referenced in GitHub Actions workflows using:

```yaml
env:
  STORE_ID: ${{ secrets.MS_STORE_STORE_ID }}
  PUBLISHER_ID: ${{ secrets.MS_STORE_PUBLISHER_ID }}
```

## Note on package.json

The `package.json` file still needs to contain `identityName`, `publisher`, and `publisherDisplayName` for electron-builder to work correctly. These values are required at build time and are embedded in the MSIX package.

However, storing them in secrets provides:
- Centralized management
- Easy updates without code changes
- Better security practices
- Ability to reference in CI/CD workflows for validation

## Security Best Practices

- Never commit sensitive values directly in code
- Use secrets for any values that might change or need to be kept private
- Rotate secrets if compromised
- Limit access to secrets to necessary workflows only
