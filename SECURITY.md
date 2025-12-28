# Security Policy

## Supported Versions

We actively support security updates for the latest stable release of Gen Image Factory. Security vulnerabilities will be addressed in the current version and, when feasible, backported to previous versions.

| Version | Supported          |
| ------- | ------------------ |
| <img src="https://img.shields.io/github/v/release/ShiftlineTools/gen-image-factory?label=Latest%20Release&color=3b82f6&style=flat-square" alt="Latest Release" /> | :white_check_mark: |
| < Latest| :x:                |

## Security Policy Statement

**Made by Shiftline Tools**

Gen Image Factory is developed and maintained by an individual developer (not a corporate entity) under the **Shiftline Tools** brand. We take security seriously and are committed to protecting user data and maintaining the security of the application.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Email**: [admin@shiftlinetools.com](mailto:admin@shiftlinetools.com)
   - Use the subject line: `[SECURITY] Gen Image Factory Vulnerability Report`
   - Include a detailed description of the vulnerability
   - Provide steps to reproduce (if applicable)
   - Include any proof-of-concept code or screenshots

2. **GitHub Security Advisory**: For critical vulnerabilities, you may also use GitHub's [Security Advisory](https://github.com/ShiftlineTools/gen-image-factory/security/advisories) feature.

### What to Include in Your Report

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information (optional, but helpful for follow-up questions)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

We appreciate your responsible disclosure and will acknowledge your contribution (with your permission) once the vulnerability is resolved.

## Security Contact Information

- **Email**: [admin@shiftlinetools.com](mailto:admin@shiftlinetools.com)
- **GitHub**: [ShiftlineTools/gen-image-factory](https://github.com/ShiftlineTools/gen-image-factory)

## Data Handling and Privacy Commitments

### Local Data Storage

Gen Image Factory stores data locally on your device:

- **Job Configurations**: Saved in a local SQLite database (`data/gen-image-factory.db`)
- **Job Results**: Generated images, metadata, and execution history stored locally
- **Settings**: Application preferences stored in local database
- **No Cloud Sync**: All data remains on your device unless explicitly exported

### API Key Storage Security

Gen Image Factory implements a multi-tier security approach for API key storage:

#### **Tier 1: Native OS Credential Manager (Primary)**

- **Technology**: Uses `keytar` library for secure storage
- **Platform Support**:
  - **macOS**: Keychain Access
  - **Windows**: Windows Credential Manager
  - **Linux**: Secret Service (GNOME Keyring, KWallet, etc.)
- **Security Level**: Maximum security using your operating system's built-in credential management
- **Access**: API keys are encrypted and stored by the OS, accessible only to the application

#### **Tier 2: Encrypted Database (Fallback)**

- **When Used**: When the native OS credential manager is unavailable or fails
- **Technology**: AES-256-GCM encryption using Node.js `crypto` module
- **Encryption Key**: Generated from system-specific information
- **Storage Location**: Encrypted keys stored in local SQLite database
- **Security Level**: Secure fallback that prevents plaintext storage

#### **Security Status**

The application displays the current security status in the Settings UI:
- **"Secure"**: Using native OS credential manager (Tier 1)
- **"Encrypted Fallback"**: Using encrypted database storage (Tier 2)

### Third-Party Services

Gen Image Factory integrates with the following third-party services:

1. **OpenAI** (API)
   - **Purpose**: Prompt generation, quality checks, metadata generation
   - **Data Sent**: Image prompts, generated images (for quality checks)
   - **Privacy**: See [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)

2. **Runware** (API)
   - **Purpose**: AI-powered image generation
   - **Data Sent**: Image generation prompts and parameters
   - **Privacy**: See [Runware Privacy Policy](https://runware.ai/privacy)

3. **Remove.bg** (API) - Optional
   - **Purpose**: Background removal from images
   - **Data Sent**: Image files when background removal is enabled
   - **Privacy**: See [Remove.bg Privacy Policy](https://www.remove.bg/privacy-policy)

**Important**: When using these services, your data (including images and prompts) may be transmitted to these third-party providers. Review their privacy policies to understand how your data is handled.

### Logging and Debug Information

- **Log Masking**: API keys and sensitive credentials are automatically masked in application logs
- **Debug Mode**: When enabled, debug logs may contain additional technical information but still mask sensitive data
- **Log Location**: Debug logs stored locally in `debug-logs/` directory

## Update Policy

### Automatic Updates

- **Microsoft Store (Windows)**: Updates are handled automatically by Windows OS through the Microsoft Store
- **GitHub Releases (macOS/Linux)**: Updates are handled by `electron-updater` when available
- **Update Frequency**: Security updates are released as soon as possible after vulnerability resolution

### Update Notifications

- Users are notified when updates are available
- Critical security updates are prioritized and released immediately
- Release notes are available in GitHub Releases and the application

## Individual Developer Security Policy

**Important**: Gen Image Factory is developed and maintained by an individual developer (not a corporate entity). This means:

- **Response Times**: While we strive for prompt responses, response times may vary based on availability
- **Resources**: Security resources are limited compared to large organizations
- **Scope**: Security focus is on the application itself and user data protection
- **Support**: Security support is provided on a best-effort basis

We are committed to maintaining security best practices and addressing vulnerabilities promptly within our capacity.

## Security Best Practices for Users

1. **Keep the Application Updated**: Always install the latest version to receive security patches
2. **Protect Your API Keys**: 
   - Never share your API keys
   - Use strong, unique API keys from service providers
   - Rotate API keys periodically
   - Monitor API key usage in your service provider dashboards
3. **Secure Your Device**: 
   - Use strong device passwords/biometrics
   - Keep your operating system updated
   - Use antivirus/anti-malware software
4. **Review Third-Party Services**: Understand what data is sent to third-party services (OpenAI, Runware, Remove.bg)
5. **Local Data**: Be aware that all data is stored locally on your device

## Security Architecture

### Electron Security Standards

Gen Image Factory follows Electron security best practices:

- `nodeIntegration: false` - Prevents Node.js access from renderer process
- `contextIsolation: true` - Isolates context between main and renderer processes
- `enableRemoteModule: false` - Disables remote module access
- `sandbox: true` - Enables Chromium sandboxing
- `webSecurity: true` - Enables web security features

### Code Security Scanning

The project uses automated security scanning:

- **CodeQL**: JavaScript/TypeScript security analysis (runs on every push and weekly)
- **Semgrep**: OWASP Top 10 and JavaScript security rules
- **Socket.dev**: Supply-chain risk detection for npm dependencies
- **npm audit**: Dependency vulnerability scanning

All security scans are integrated into CI/CD pipelines and must pass before code is merged.

## Known Limitations

1. **Encryption Key**: The encrypted database fallback uses a static encryption key combined with machine-specific information. For a single-user desktop application, this provides significant security improvement over plaintext storage, but is not as secure as hardware-backed key storage.

2. **Memory Protection**: API keys may exist in memory during application execution. Future enhancements may include memory protection measures.

3. **Development Mode**: In development environments, API keys may be stored in plaintext for debugging purposes. This does not affect production builds.

## Security Acknowledgments

We appreciate security researchers and users who responsibly disclose vulnerabilities. Contributors will be acknowledged (with permission) in security advisories and release notes.

---

**Last Updated**: 2025-01-23

**Maintained by**: Shiftline Tools

For questions or concerns about this security policy, contact [admin@shiftlinetools.com](mailto:admin@shiftlinetools.com).

