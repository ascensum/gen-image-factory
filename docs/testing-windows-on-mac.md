# Testing Windows on macOS

This document describes options for testing Windows-specific features (like system tray icons) when developing on macOS.

## Quick Preview (Recommended First Step)

Before setting up a full Windows environment, preview icons at actual size:

```bash
npm run preview-icons
```

This opens icons at their actual pixel dimensions so you can see how they'll appear. Compare 16x16, 24x24, and 32x32 to determine the best size.

## Option 1: Virtual Machines (Best for Full Testing)

### Parallels Desktop (Recommended)
- **Pros**: Excellent performance, seamless integration, supports Apple Silicon
- **Cons**: Paid software (~$100/year)
- **Setup**: 
  1. Download from [parallels.com](https://www.parallels.com/)
  2. Install Windows 11 (free for development)
  3. Test your packaged application

### VMware Fusion
- **Pros**: Good performance, free for personal use
- **Cons**: Slightly slower than Parallels
- **Setup**:
  1. Download VMware Fusion (free for personal use)
  2. Install Windows 11
  3. Test your application

### VirtualBox (Free)
- **Pros**: Completely free and open source
- **Cons**: Slower performance, may have compatibility issues on Apple Silicon
- **Setup**:
  1. Download from [virtualbox.org](https://www.virtualbox.org/)
  2. Install Windows 11
  3. Test your application

## Option 2: GitHub Actions (CI Testing)

Test Windows builds automatically in CI without local setup:

```yaml
# .github/workflows/test-windows.yml
name: Test Windows Build
on: [push, pull_request]
jobs:
  test-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run dist:win
      # Test the built application
```

This allows you to:
- Build Windows artifacts automatically
- Run automated tests on Windows
- Verify icon appearance (with screenshots)

## Option 3: Remote Windows Machine

If you have access to a Windows machine:
1. Build the application on macOS
2. Transfer the `.exe` or `.msix` file
3. Test on the Windows machine

## Option 4: Boot Camp (Intel Macs Only)

For Intel-based Macs:
- Install Windows via Boot Camp
- Dual-boot between macOS and Windows
- Test natively on Windows hardware

**Note**: Not available on Apple Silicon Macs.

## Option 5: Cloud Windows Instances

Use cloud services for temporary Windows access:
- **AWS EC2**: Launch Windows instances
- **Azure Virtual Machines**: Windows VMs
- **Google Cloud**: Windows Server instances

## Recommended Workflow

1. **Preview Icons Locally** (5 minutes):
   ```bash
   npm run preview-icons
   ```
   Compare sizes to determine the best fit.

2. **Build Windows Artifact** (2 minutes):
   ```bash
   npm run dist:win
   ```

3. **Test in VM** (if available):
   - Install in Parallels/VMware
   - Verify system tray icon appearance
   - Test functionality

4. **CI Verification** (automatic):
   - GitHub Actions builds on Windows
   - Automated tests verify functionality
   - Screenshots can verify visual appearance

## Icon Size Recommendations

Based on testing and modern display standards:

- **Windows System Tray**: Use **24x24 or 32x32** (not 16x16)
  - 16x16 is too small on modern high-DPI displays
  - 24x24 provides good visibility
  - 32x32 works well on 150%+ scaling

- **macOS Menu Bar**: Use **24x24 or 32x32** (not 16x16)
  - 16x16 is too small
  - 24x24 is the recommended minimum
  - 32x32 for Retina displays

## Quick Test Script

Create a simple test to verify icon sizes:

```javascript
// test-icon-sizes.js
const { Tray } = require('electron');
const path = require('path');

const sizes = [16, 24, 32];
sizes.forEach(size => {
  const iconPath = path.join(__dirname, `build/icons/png/${size}x${size}.png`);
  console.log(`Testing ${size}x${size}...`);
  // Create tray icon and test
});
```

## Cost Comparison

| Method | Cost | Setup Time | Performance |
|--------|------|------------|-------------|
| Preview Script | Free | 1 min | Instant |
| VirtualBox | Free | 30 min | Slow |
| VMware Fusion | Free (personal) | 30 min | Good |
| Parallels | ~$100/year | 30 min | Excellent |
| GitHub Actions | Free (public repos) | 5 min | Good |
| Boot Camp | Free | 1 hour | Native |

## Conclusion

For quick icon size verification, use `npm run preview-icons`. For full Windows testing, use a VM (Parallels recommended) or GitHub Actions for automated testing.

