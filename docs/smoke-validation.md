# Smoke Validation Guide

This document describes the manual smoke validation steps for packaged application artifacts.

## Purpose

Smoke validation ensures that packaged artifacts launch correctly and basic functionality works without the development server. This is a critical step before releasing to users.

## Pre-Validation Setup

1. **Build Artifacts**:
   ```bash
   npm run dist
   # Or platform-specific:
   npm run dist:win
   npm run dist:mac
   npm run dist:linux
   ```

2. **Locate Artifacts**:
   - Windows: `dist/Gen Image Factory Setup *.exe` (NSIS) or `dist/*.msix` (Store)
   - macOS: `dist/Gen Image Factory-*.dmg` or `dist/Gen Image Factory-*.zip`
   - Linux: `dist/Gen Image Factory-*.AppImage` or `dist/*.deb`

## Windows Validation

### NSIS Installer
1. **Install**:
   - Run the `.exe` installer
   - Accept "Unknown Publisher" warning (expected for unsigned builds)
   - Complete installation wizard
   - Choose per-user installation (default)

2. **Launch**:
   - Launch from Start Menu or desktop shortcut
   - Application should open without errors

3. **Verify**:
   - [ ] Application window appears
   - [ ] Dashboard/home screen is visible
   - [ ] No console errors in DevTools (if accessible)
   - [ ] IPC communication works (test ping/get-version)
   - [ ] Navigation between views works (Settings, Dashboard, etc.)
   - [ ] Application icon appears correctly in taskbar

4. **Quit**:
   - Close application normally
   - Verify clean shutdown

### MSIX Package (Microsoft Store)
1. **Install**:
   - Double-click `.msix` file
   - Follow installation prompts
   - May require enabling developer mode or sideloading

2. **Launch**:
   - Launch from Start Menu
   - Application should open without errors

3. **Verify**:
   - [ ] Application window appears
   - [ ] Dashboard/home screen is visible
   - [ ] No console errors
   - [ ] IPC communication works
   - [ ] Navigation works
   - [ ] Application icon appears correctly

4. **Quit**:
   - Close application normally
   - Verify clean shutdown

## macOS Validation

### DMG
1. **Install**:
   - Open the `.dmg` file
   - Drag application to Applications folder
   - Eject DMG

2. **Launch**:
   - Open from Applications folder
   - Accept security warning if prompted (right-click → Open)
   - Application should open without errors

3. **Verify**:
   - [ ] Application window appears
   - [ ] Dashboard/home screen is visible
   - [ ] No console errors
   - [ ] IPC communication works
   - [ ] Navigation works
   - [ ] Application icon appears correctly in dock

4. **Quit**:
   - Close application normally (Cmd+Q)
   - Verify clean shutdown

### ZIP
1. **Install**:
   - Extract ZIP file
   - Move application to Applications folder

2. **Launch**:
   - Open from Applications folder
   - Accept security warning if prompted
   - Application should open without errors

3. **Verify**: Same as DMG validation

## Linux Validation

### AppImage
1. **Install**:
   - Make executable: `chmod +x Gen-Image-Factory-*.AppImage`

2. **Launch**:
   - Run: `./Gen-Image-Factory-*.AppImage`
   - Application should open without errors

3. **Verify**:
   - [ ] Application window appears
   - [ ] Dashboard/home screen is visible
   - [ ] No console errors
   - [ ] IPC communication works
   - [ ] Navigation works
   - [ ] Application icon appears correctly

4. **Quit**:
   - Close application normally
   - Verify clean shutdown

### DEB Package
1. **Install**:
   ```bash
   sudo dpkg -i gen-image-factory_*.deb
   sudo apt-get install -f  # Fix dependencies if needed
   ```

2. **Launch**:
   - Launch from application menu or command line
   - Application should open without errors

3. **Verify**: Same as AppImage validation

## Common Issues

### Windows: "Unknown Publisher" Warning
- **Expected**: Unsigned GitHub Releases artifacts will show this warning
- **Solution**: Click "More info" → "Run anyway"

### macOS: "App is damaged" or "Cannot be opened"
- **Expected**: Unsigned applications show security warnings
- **Solution**: Right-click → Open, then click "Open" in security dialog

### Linux: AppImage won't run
- **Check**: File is executable (`chmod +x`)
- **Check**: FUSE is installed (`sudo apt-get install fuse`)

### Application won't launch
- **Check**: Console/terminal for error messages
- **Check**: All dependencies are included in package
- **Check**: Preload scripts are correctly bundled
- **Check**: IPC bridges are functional

### IPC Communication fails
- **Check**: Preload script is loaded correctly
- **Check**: Context isolation is enabled
- **Check**: IPC handlers are registered

## Automated E2E Testing

For future enhancements, consider adding automated E2E tests for packaged artifacts:

```typescript
// Example: tests/e2e/packaged-app.test.ts
test('packaged app launches to dashboard', async () => {
  // Launch packaged app
  // Verify dashboard is visible
  // Test basic navigation
});
```

**Note**: Automated packaged-app E2E testing is marked as future work. Current validation is manual.

## Validation Checklist

Before marking a release as ready:

- [ ] Artifacts build successfully
- [ ] Windows NSIS installer works
- [ ] Windows MSIX package works (if applicable)
- [ ] macOS DMG works
- [ ] macOS ZIP works
- [ ] Linux AppImage works
- [ ] Linux DEB package works
- [ ] Application launches without dev server
- [ ] Dashboard/home screen is visible
- [ ] IPC communication works
- [ ] Navigation between views works
- [ ] Application quits cleanly
- [ ] No critical console errors

## Reporting Issues

If smoke validation fails:

1. **Document**:
   - Platform and artifact type
   - Error messages or symptoms
   - Steps to reproduce

2. **Investigate**:
   - Check build logs
   - Verify all dependencies are included
   - Test in development mode for comparison

3. **Fix**:
   - Address root cause
   - Rebuild artifacts
   - Re-run smoke validation

