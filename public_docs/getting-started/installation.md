# Installation Guide

This guide will help you install Gen Image Factory on your system.

## Windows

### Microsoft Store (Recommended)

The easiest way to install Gen Image Factory on Windows is through the Microsoft Store:

1. Open Microsoft Store
2. Search for "Gen Image Factory"
3. Click "Install"
4. Updates are handled automatically by Windows

### GitHub Releases (Advanced Users)

If you prefer to install from GitHub Releases:

1. Download the NSIS installer (`.exe`) from [GitHub Releases](https://github.com/your-org/gen-image-factory/releases)
2. Run the installer
3. Accept the "Unknown Publisher" warning (artifacts are unsigned)
4. Follow the installation wizard

**Note**: Unsigned installers will trigger Windows SmartScreen warnings. This is expected for GitHub Releases artifacts.

## macOS

1. Download the DMG file from [GitHub Releases](https://github.com/your-org/gen-image-factory/releases)
2. Open the DMG file
3. Drag the application to Applications folder
4. Open the application (may require right-click → Open on first launch due to unsigned status)
5. Accept the security warning if prompted

**Note**: Unsigned macOS applications will show security warnings. This is expected for GitHub Releases artifacts.

## Linux

### AppImage

1. Download the AppImage file from [GitHub Releases](https://github.com/your-org/gen-image-factory/releases)
2. Make it executable:
   ```bash
   chmod +x Gen-Image-Factory-*.AppImage
   ```
3. Run the application:
   ```bash
   ./Gen-Image-Factory-*.AppImage
   ```

### DEB (Ubuntu/Debian)

1. Download the DEB package from [GitHub Releases](https://github.com/your-org/gen-image-factory/releases)
2. Install using:
   ```bash
   sudo dpkg -i gen-image-factory_*.deb
   ```
3. Fix any dependency issues:
   ```bash
   sudo apt-get install -f
   ```

## Verifying Installation

After installation, you can verify the installation by:

1. Launching the application
2. Checking that the main dashboard appears
3. Verifying you can access the Settings panel

## Next Steps

Once installed, see the [User Guide](../user-guide/) for information on:
- Configuring your settings
- Starting your first job
- Managing job history
- Exporting results

