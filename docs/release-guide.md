# Release Guide

This document describes the release process for Gen Image Factory, including automated release pipeline, manual release steps, and platform-specific installation instructions.

## Automated Release Pipeline

The release pipeline is triggered automatically when a version tag is pushed to the repository (e.g., `v1.0.0`, `v1.2.3`).

### Process

1. **Quality Gates**: All quality gates must pass before artifact build:
   - Unit and integration tests
   - E2E tests (run on version tags before artifact build)
   - CodeQL security scanning
   - Semgrep security scanning
   - npm audit (high severity only)
   - Socket.dev supply-chain scanning

2. **Artifact Build**: Builds artifacts for all platforms:
   - **Windows**: MSIX (Microsoft Store), NSIS installer, Portable
   - **macOS**: DMG, ZIP
   - **Linux**: AppImage, DEB

3. **Artifact Integrity**: Every release includes:
   - SHA-256 checksums file for all artifacts
   - SBOM (Software Bill of Materials) for auditability

4. **GitHub Release**: Artifacts are automatically uploaded to GitHub Releases with auto-generated release notes

5. **Microsoft Store Upload**: MSIX package is built and ready for Microsoft Store submission (manual upload required)

## Manual Release Process

If you need to create a release manually:

1. **Create Version Tag**:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. **Wait for CI**: The automated release pipeline will build and upload artifacts

3. **Verify Release**: Check GitHub Releases page for the new release

4. **Extract Release Notes for Microsoft Store**:
   ```bash
   # Extract release notes for the latest release
   npm run release-notes:latest
   
   # Or for a specific version
   npm run release-notes v1.0.9
   ```
   This will display formatted release notes and save them to a file for easy copy-paste into Microsoft Partner Center.

5. **Microsoft Store Submission**: 
   - Upload the MSIX package to Microsoft Store Partner Center
   - Paste the release notes (from step 4) into the "What's New" field
   - Complete store listing and submit for certification

## Platform-Specific Installation

### Windows

#### Microsoft Store (Recommended)
1. Open Microsoft Store
2. Search for "Gen Image Factory"
3. Click "Install"
4. Updates are handled automatically by Windows

#### GitHub Releases (Advanced Users)
1. Download the NSIS installer (`.exe`) from GitHub Releases
2. Run the installer
3. Accept the "Unknown Publisher" warning (artifacts are unsigned)
4. Follow the installation wizard

**Note**: Unsigned installers will trigger Windows SmartScreen warnings. This is expected for GitHub Releases artifacts.

### macOS

1. Download the DMG file from GitHub Releases
2. Open the DMG file
3. Drag the application to Applications folder
4. Open the application (may require right-click → Open on first launch due to unsigned status)
5. Accept the security warning if prompted

**Note**: Unsigned macOS applications will show security warnings. This is expected for GitHub Releases artifacts.

### Linux

#### AppImage
1. Download the AppImage file from GitHub Releases
2. Make it executable:
   ```bash
   chmod +x Gen-Image-Factory-*.AppImage
   ```
3. Run the application:
   ```bash
   ./Gen-Image-Factory-*.AppImage
   ```

#### DEB (Ubuntu/Debian)
1. Download the DEB package from GitHub Releases
2. Install using:
   ```bash
   sudo dpkg -i gen-image-factory_*.deb
   ```
3. Fix any dependency issues:
   ```bash
   sudo apt-get install -f
   ```

## Rollback Process

If a release has issues, users can rollback by:

1. **Download Previous Release**: Go to GitHub Releases and download a previous version
2. **Uninstall Current Version**: Remove the current installation
3. **Install Previous Version**: Install the downloaded artifact from the previous release

### Windows
- Uninstall via Settings → Apps
- Install previous version from GitHub Releases

### macOS
- Delete the application from Applications folder
- Install previous DMG from GitHub Releases

### Linux
- Uninstall via package manager or delete AppImage
- Install previous version from GitHub Releases

## Microsoft Store Submission

### Requirements
- Microsoft Partner Center account (free developer account)
- MSIX package built by CI
- Store listing metadata (description, screenshots, etc.)

### Process
1. Build MSIX package (automated in CI on version tags)
2. Extract release notes using `npm run release-notes:latest` or `npm run release-notes <version>`
3. Log in to Microsoft Partner Center
4. Create new submission or update existing app
5. Upload MSIX package
6. Paste release notes into "What's New" field (from step 2)
7. Complete store listing information
8. Submit for certification

### $0 Cost Strategy
Microsoft Store distribution is free for developers. No code signing certificates or fees required. Microsoft handles:
- Code signing
- Certificate management
- Secure distribution
- Automatic updates

## Artifact Integrity Verification

### Verify SHA-256 Checksums
```bash
# Linux/macOS
sha256sum -c SHA256SUMS.txt

# Windows (PowerShell)
Get-FileHash -Path <artifact> -Algorithm SHA256
# Compare with SHA256SUMS.txt
```

### Verify SBOM
The SBOM (Software Bill of Materials) is provided in JSON format and can be inspected to verify dependencies and their versions.

## Troubleshooting

### Windows: "Unknown Publisher" Warning
This is expected for unsigned GitHub Releases artifacts. Click "More info" → "Run anyway" to proceed.

### macOS: "App is damaged" or "Cannot be opened"
1. Right-click the application
2. Select "Open"
3. Click "Open" in the security dialog

### Linux: AppImage won't run
1. Ensure the file is executable: `chmod +x *.AppImage`
2. Check if FUSE is installed: `sudo apt-get install fuse`

## Release Checklist

- [ ] All quality gates pass
- [ ] E2E tests pass
- [ ] Version tag created and pushed
- [ ] Release artifacts generated
- [ ] SHA-256 checksums generated
- [ ] SBOM generated
- [ ] GitHub Release created
- [ ] Microsoft Store submission (if applicable)
- [ ] Release notes updated
- [ ] Documentation updated

