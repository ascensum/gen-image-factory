# Privacy Policy

**Last Updated**: January 2025

Gen Image Factory is developed by an individual developer under the **Shiftline Tools** brand. This Privacy Policy describes how we handle your data when you use Gen Image Factory.

## Data Collection Practices

Gen Image Factory is designed with privacy in mind. As an individual developer, I am committed to protecting your privacy and ensuring transparency about data handling.

### What We Collect

Gen Image Factory collects and stores the following data **locally on your device only**:

- **Job Configurations**: Settings, file paths, and job parameters you configure
- **Job Results**: Generated images, metadata, and execution history
- **Application Settings**: Your preferences and configuration choices
- **API Keys**: Third-party service credentials (stored securely, see below)

### What We Do NOT Collect

Gen Image Factory does **not** collect, transmit, or store any of the following:

- Personal information (name, email, address, etc.)
- Usage analytics or telemetry
- Error reports or crash data (unless you explicitly send them)
- Network traffic or browsing history
- Any data transmitted to external servers (except API calls you authorize)

**No Cloud Data Collection**: All data remains on your device unless you explicitly export it.

## API Key Storage and Security

Gen Image Factory implements a multi-tier security approach for storing your API keys:

### Tier 1: Native OS Credential Manager (Primary)

- **Technology**: Uses `keytar` library for secure storage
- **Platform Support**: Windows (Credential Manager), macOS (Keychain Access), Linux (Secret Service)
- **Security Level**: Maximum security using your operating system's built-in credential management

### Tier 2: Encrypted Database (Fallback)

- **Technology**: AES-256-GCM encryption using Node.js `crypto` module
- **Storage Location**: Encrypted keys stored in local SQLite database

## Third-Party Services Disclosure

Gen Image Factory integrates with third-party APIs (OpenAI, Runware, Remove.bg) to provide functionality. Data is transmitted directly to these providers via your authorized API keys. Shiftline Tools does not control, store, or retain the data transmitted to these services.

## Affiliate and Monetization Disclosure

To keep Gen Image Factory open-source and independent, Shiftline Tools participates in affiliate programs. 

- **Affiliate Links**: Our website (genimage.shiftlinetools.com) may contain affiliate links to third-party services, including the AI providers mentioned above. 
- **Transparency**: If you sign up for a service through these links, we may receive a small commission at no extra cost to you. 
- **Privacy Impact**: We do not share your application data, generated content, or usage habits with affiliate partners. Participation in these programs is strictly for website-level monetization to fund ongoing development.

## User Rights and Data Access

As an individual developer, I respect your privacy rights. All data is stored locally in `data/gen-image-factory.db`. You can access, export, or delete this data at any time by using the application's built-in tools or by uninstalling the software.

## Microsoft Store & GDPR Compliance

Gen Image Factory complies with Microsoft Store privacy requirements and GDPR principles. Since all data is stored locally and not transmitted to external servers (except authorized API calls), the application inherently respects your rights to access, rectification, and erasure.

## Individual Developer Privacy Policy

**Important**: Gen Image Factory is developed by an individual developer under the **Shiftline Tools** brand. This policy reflects a personal commitment to transparency and direct responsibility for the privacy practices described herein.

## Contact Information

- **Email**: admin@shiftlinetools.com
- **GitHub**: ShiftlineTools/gen-image-factory

---

**Gen Image Factory** is made by **Shiftline Tools**.