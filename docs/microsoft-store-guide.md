# Microsoft Store Distribution Guide

## Overview

Microsoft Store distribution is **mandatory** for Windows users. It provides:
- Free code signing (no certificates needed)
- Automatic updates via Windows OS
- Trusted distribution channel
- No SmartScreen warnings

## $0 Cost Strategy

Microsoft Store distribution is completely free for developers:
- No developer account fees
- No code signing certificate costs
- No per-app submission fees
- Microsoft handles all signing and certificate management

## Requirements

1. **Microsoft Partner Center Account**:
   - Sign up at https://partner.microsoft.com/
   - Free developer account (no credit card required for free apps)
   - Complete account verification

2. **App Identity Configuration**:
   - Identity Name: `ShiftlineTools.GenImageFactory` (immutable Store identity)
   - Publisher: `CN=25094057-9D25-4368-831B-EF71134D46D6`
   - Publisher Display Name: `Shiftline Tools`
   - Store ID: `9P761655KPBW`

3. **MSIX Package**:
   - Built automatically by CI on version tags
   - Located in `dist/` after build
   - File format: `.msix` or `.appx`

## Configuration

The app is already configured for Microsoft Store in `package.json`:

```json
{
  "build": {
    "win": {
      "appx": {
        "identityName": "ShiftlineTools.GenImageFactory",
        "publisher": "CN=25094057-9D25-4368-831B-EF71134D46D6",
        "publisherDisplayName": "Shiftline Tools"
      }
    }
  }
}
```

## Submission Process

1. **Build MSIX Package**:
   - Triggered automatically on version tags (`v*.*.*`)
   - Or build manually: `npm run dist:win` (builds MSIX along with NSIS)

2. **Log in to Partner Center**:
   - Go to https://partner.microsoft.com/dashboard
   - Navigate to your app

3. **Create New Submission**:
   - Click "Create new submission"
   - Or update existing submission

4. **Upload MSIX Package**:
   - Go to "Packages" section
   - Upload the `.msix` file from `dist/` directory
   - Wait for package validation

5. **Store Listing**:
   - **Description**: Write clear, compelling description
   - **Screenshots**: Add screenshots of the application
   - **Category**: Graphics/Design
   - **Age Rating**: Complete age rating questionnaire
   - **Pricing**: Set to Free (or paid if applicable)

6. **Certification**:
   - Submit for certification
   - Microsoft reviews the app (typically 1-3 business days)
   - Certification includes security, content, and policy compliance checks

7. **Publish**:
   - Once certified, publish to Store
   - App appears in Microsoft Store within 24 hours

## Update Process

1. Build new MSIX package with updated version
2. Create new submission in Partner Center
3. Upload new MSIX package
4. Submit for certification
5. Publish update

Updates are automatically delivered to users via Windows OS update mechanism.

## Runtime Detection

The application automatically detects if it's running in Microsoft Store:

```javascript
const isWindowsStore = process.windowsStore || false;
```

If running in Store:
- `electron-updater` is disabled
- Updates are handled by Windows OS
- No manual update checks needed

## Troubleshooting

### Package Validation Failures
- Check that all required assets are included
- Verify app identity matches Partner Center configuration
- Ensure version number is incremented

### Certification Failures
- Review certification report
- Address any policy violations
- Fix security issues if reported

### Update Issues
- Verify MSIX package version is higher than current Store version
- Check that app identity matches exactly
- Ensure all dependencies are included in package

## Best Practices

1. **Version Management**:
   - Always increment version number for new submissions
   - Use semantic versioning (e.g., 1.0.0, 1.0.1, 1.1.0)

2. **Testing**:
   - Test MSIX package locally before submission
   - Use Windows App Certification Kit (WACK) for validation

3. **Store Listing**:
   - Keep description up to date
   - Add screenshots for major updates
   - Respond to user reviews

4. **Release Notes**:
   - Include release notes with each update
   - Highlight new features and bug fixes

## Resources

- [Microsoft Partner Center](https://partner.microsoft.com/)
- [MSIX Packaging Documentation](https://docs.microsoft.com/en-us/windows/msix/)
- [App Certification Requirements](https://docs.microsoft.com/en-us/windows/uwp/publish/app-certification-requirements)
- [Store Policies](https://docs.microsoft.com/en-us/windows/uwp/publish/store-policies)

