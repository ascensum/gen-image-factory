# Icon Size Guidelines

This document provides guidelines for using icons at different sizes across platforms.

## macOS Menu Bar (System Tray) Icons

**Recommended Size: 24x24 pixels minimum**

While macOS officially supports 16x16 point icons for menu bar items, **24x24 pixels is recommended** for better visibility and aesthetics, especially on Retina displays.

### Why 24x24?
- 16x16 appears too small and can be hard to see
- 24x24 provides better visibility without being too large
- Works well on both standard and Retina displays
- Matches modern macOS design patterns

### Implementation
When creating a system tray icon for macOS:
```javascript
const { Tray } = require('electron');
const path = require('path');

// Use 24x24 or 32x32 for menu bar
const trayIcon = path.join(__dirname, '../build/icons/png/24x24.png');
// Or for better Retina support:
const trayIcon = path.join(__dirname, '../build/icons/png/32x32.png');

const tray = new Tray(trayIcon);
```

**Note**: The ICNS file contains multiple sizes, and macOS will automatically select the appropriate size. However, when using PNG directly for tray icons, use 24x24 or larger.

## Windows System Tray Icons

**Recommended Size: 24x24 pixels (or 32x32 for high-DPI displays)**

While Windows traditionally uses 16x16 pixels for system tray icons, **24x24 or 32x32 pixels is recommended** for better visibility, especially on:
- High-DPI displays (125%, 150%, 200% scaling)
- Modern Windows 10/11 systems
- Better user experience and recognition

The `.ico` file contains multiple sizes (16, 32, 48, 64, 128, 256px), and Windows will automatically select the appropriate size based on display scaling. However, when using PNG directly, prefer 24x24 or 32x32 over 16x16.

### Why larger than 16x16?
- 16x16 can appear too small on modern high-DPI displays
- 24x24 provides better visibility without being intrusive
- 32x32 works well on 150%+ scaling
- Better icon recognition and user experience

## Desktop Icons

**Recommended Sizes:**
- **Small**: 32x32 pixels
- **Medium**: 48x48 pixels
- **Large**: 64x64 pixels or larger

Desktop icons are typically displayed at 32x32 or 48x48 pixels, depending on user settings.

## Available Icon Sizes

The following sizes are available in `build/icons/png/`:
- 16x16.png - Legacy small icons (too small for modern displays)
- 24x24.png - **Recommended minimum for macOS menu bar and Windows system tray**
- 32x32.png - **Recommended for high-DPI displays** (macOS menu bar Retina, Windows system tray 150%+ scaling)
- 48x48.png - Desktop icons (medium)
- 64x64.png - Desktop icons (large)
- 128x128.png - Large desktop icons
- 256x256.png - Very large icons
- 512x512.png - High-resolution source
- 1024x1024.png - Maximum resolution source

## Platform-Specific Icon Files

- **Windows**: `build/icons/win/icon.ico` (contains 16, 32, 48, 64, 128, 256px)
- **macOS**: `build/icons/mac/icon.icns` (contains 16, 32, 64, 128, 256, 512, 1024px)
- **Linux**: Individual PNG files in `build/icons/png/`

## Best Practices

1. **For macOS Menu Bar**: Always use 24x24.png or 32x32.png (never 16x16)
2. **For Windows System Tray**: Use 24x24.png or 32x32.png (16x16 is too small on modern displays)
3. **For Desktop Icons**: Use 32x32.png or larger
4. **For High-DPI Displays**: Provide 2x versions (e.g., 32x32 for standard, 64x64 for Retina)
5. **Icon Design**: Ensure icons are recognizable and clear at all sizes

## Previewing Icons

To preview icons at their actual size before using them:

```bash
# Preview common sizes (16, 24, 32, 48)
npm run preview-icons

# Preview a specific size
npm run preview-icons 24
npm run preview-icons 32
```

This opens the icons in your default image viewer at actual size, allowing you to compare and see which size looks best for system tray/menu bar use.

## Rebuilding Icons

To rebuild icons from the source:
```bash
npm run rebuild-icons
```

This will regenerate all icon sizes from the source 1024x1024 PNG.

