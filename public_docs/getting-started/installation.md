# Installation Guide

This guide will help you install Gen Image Factory on your system.

**Gen Image Factory** is developed by an individual developer under the **Shiftline Tools** brand.

## Windows

### Microsoft Store

Gen Image Factory is available on the Microsoft Store. This provides the easiest installation method with automatic updates.

[**Get it from Microsoft Store**](https://apps.microsoft.com/detail/9P761655KPBW) (Requires MS Account)

### Direct Download (GitHub Releases)

If you prefer to install manually or use the portable version:

1. Download the NSIS installer (`.exe`) from [GitHub Releases](https://github.com/ShiftlineTools/gen-image-factory/releases)
2. Run the installer
3. Follow the installation wizard

### Power Users (winget)

You can also install via command line:

```bash
winget install "Gen Image Factory"
```

**Note**: Unsigned installers will trigger Windows SmartScreen warnings. This is expected for GitHub Releases artifacts.

## macOS

1. Download the DMG file from [GitHub Releases](https://github.com/ShiftlineTools/gen-image-factory/releases)
2. Open the DMG file
3. Drag the application to Applications folder
4. Open the application (may require right-click → Open on first launch due to unsigned status)
5. Accept the security warning if prompted

**Note**: Unsigned macOS applications will show security warnings. This is expected for GitHub Releases artifacts.

## Linux

### AppImage

1. Download the AppImage file from [GitHub Releases](https://github.com/ShiftlineTools/gen-image-factory/releases)
2. Make it executable:
   ```bash
   chmod +x Gen-Image-Factory-*.AppImage
   ```
3. Run the application:
   ```bash
   ./Gen-Image-Factory-*.AppImage
   ```

### DEB (Ubuntu/Debian)

1. Download the DEB package from [GitHub Releases](https://github.com/ShiftlineTools/gen-image-factory/releases)
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

Once installed, see the [User Guide](/docs/user-guide/settings) for information on:
- Configuring your settings
- Starting your first job
- Managing job history
- Exporting results

## Legal Information

For information about how Gen Image Factory handles your data and the terms of use, please review:
- [Privacy Policy](/docs/legal/privacy-policy) - Learn how we handle your data and protect your privacy
- [Terms of Service](/docs/legal/terms-of-service) - Review the terms and conditions for using Gen Image Factory

