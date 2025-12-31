# Organizational Structure and Brand Identity

## Overview

This document defines the organizational structure, brand identity strategy, and Microsoft Store identity management for Gen Image Factory.

## Organizational Structure

### Shiftline Tools

**Shiftline Tools** is an individual-owned GitHub Organization (studio-style, not a legal entity) that serves as the publisher and brand for Gen Image Factory.

**Key Characteristics:**
- **Type**: Individual-owned GitHub Organization (free tier)
- **Ownership**: Individual developer ownership (not a registered business entity)
- **Display Name**: "Shiftline Tools" (with space)
- **GitHub Handle**: "ShiftlineTools" (no space, used in URLs)
- **Purpose**: Professional software development studio focused on creating tools that enhance productivity

**GitHub Organization:**
- Organization handle: `ShiftlineTools`
- Organization display name: `Shiftline Tools`
- Repository: `ShiftlineTools/gen-image-factory`
- Website: `genimage.shiftlinetools.com`
- Support email: `admin@shiftlinetools.com`

**Domain and DNS:**
- Documentation website: `genimage.shiftlinetools.com`
- DNS managed via Cloudflare
- CNAME record: `genimage.shiftlinetools.com` → `shiftlinetools.github.io`

## Brand Identity Strategy

### Public-Facing Brand: Shiftline Tools

**Shiftline Tools** is the user-visible brand used in:
- Application UI (splash screens, about dialogs)
- Documentation website
- Microsoft Store listing (Publisher Display Name)
- GitHub organization
- Support communications
- Marketing materials

**Branding Requirements:**
- All user-facing areas must display "Shiftline Tools" or "Made by Shiftline Tools"
- Professional presentation is required
- Consistent branding across all touchpoints

### Internal Identity: Shiftline Tools Organization

**Shiftline Tools** is the Microsoft Store organization identity:
- **Identity Name**: `ShiftlineTools.GenImageFactory` (immutable Store identity)
- **Publisher**: `CN=25094057-9D25-4368-831B-EF71134D46D6`
- **Store ID**: `9P761655KPBW`
- **Package Family Name (PFN)**: `ShiftlineTools.GenImageFactory_0gwrxd6wp7ebt`
- **Package SID**: `S-1-15-2-1705884162-2587684083-2754433856-416162892-334062652-2777467336-848623385`

## Microsoft Store Identity Management

### Current Identity (Shiftline Tools Organization)

The application uses a Microsoft Store identity connected to the Shiftline Tools organization:

- **Identity Name**: `ShiftlineTools.GenImageFactory` (immutable Store identity, internal only)
- **Publisher**: `CN=25094057-9D25-4368-831B-EF71134D46D6`
- **Publisher Display Name**: `Shiftline Tools` (user-visible brand)
- **Store ID**: `9P761655KPBW`
- **Package Family Name (PFN)**: `ShiftlineTools.GenImageFactory_0gwrxd6wp7ebt`
- **Package SID**: `S-1-15-2-1705884162-2587684083-2754433856-416162892-334062652-2777467336-848623385`

**Configuration Location**: `package.json#build.appx`

**Migration Completed**: Story 2.7 migration from legacy personal account identity completed.

## Brand Enforcement Policies

### User-Visible Branding

All user-facing content must:
- Display "Shiftline Tools" as the publisher/developer
- Include "Made by Shiftline Tools" branding where appropriate
- Maintain professional presentation

### Documentation Branding

- Repository README.md must include Shiftline Tools branding
- Documentation website must prominently feature Shiftline Tools
- All support communications use Shiftline Tools identity
- Legal pages (Privacy Policy, Terms of Service) reference Shiftline Tools

### Application Branding

- Splash screen displays "FROM SHIFTLINE TOOLS™"
- About dialog shows Shiftline Tools as developer
- System-level metadata (author, publisher) uses Shiftline Tools
- No internal identity references in UI

## Professional Presentation Requirements

### Repository Documentation

- README.md must be professional and comprehensive
- SECURITY.md must be present and complete
- All documentation must reflect Shiftline Tools branding
- Links to documentation website and Microsoft Store

### Website Presentation

**Home Page:**
- Professional hero/home page with custom React component (`website/src/pages/index.tsx`)
- Hero section with product name, tagline, and "Made by Shiftline Tools" branding
- Version badge displaying latest GitHub release version (automatically fetched from GitHub Releases API)
- Asymmetrical Bento Grid layout with 6 interactive feature cards linking to documentation
- Integrated Platforms/APIs section showcasing third-party services (OpenAI, Runware, Remove.bg)
- Recommended Apps section with 2-column Bento Grid layout
- Call-to-action buttons (Download, Documentation, Microsoft Store)
- Permanent dark mode theme with Industrial Zen design system

**Resources Page:**
- Resources/affiliate page (`public_docs/resources.md`) for transparency about third-party services
- Attribution and credit information for services used
- Links to third-party services (OpenAI, Runware, Remove.bg)
- Transparency about affiliate relationships (if applicable)

**Legal Pages:**
- Privacy Policy page (`public_docs/legal/privacy-policy.md`) required for Microsoft Store compliance
- Terms of Service page (`public_docs/legal/terms-of-service.md`) required for Microsoft Store compliance
- Legal pages accessible from footer navigation, sidebar, and installation guide
- Content emphasizes individual developer context (Shiftline Tools, not corporate entity)

**Design System:**
- Permanent dark mode theme (locked, no theme toggle)
- Industrial Zen design aesthetic with monospace typography
- Bento Grid layout for feature cards with glassmorphism effects
- Consistent Shiftline Tools branding throughout
- Responsive design with mobile-first approach

### Microsoft Store Website Compliance Requirements

The documentation website must comply with Microsoft Store requirements for websites linked from Store listings:

**Analytics and Privacy Compliance:**
- **Google Analytics 4 (GA4)**: Required for website analytics and user behavior tracking
  - Measurement ID: `G-X2N1PZ3PYX`
  - IP anonymization enabled for privacy compliance
- **Consent Mode v2**: Required for GDPR and privacy compliance
  - Default deny state: All analytics and ad storage denied by default
  - Consent granted only after explicit user acceptance
  - Consent state persisted via cookie (365-day expiration)
- **Cookie Consent Banner**: Required for transparency and compliance
  - User-friendly cookie consent banner with Accept/Decline options
  - Clear disclosure of cookie usage and purpose
  - Styled to match website dark theme and branding
  - Includes application version in consent text

**Implementation Details:**
- Custom Root component (`website/src/theme/Root.tsx`) manages consent lifecycle
- Consent Mode v2 script injected before GA4 loads to ensure default deny
- Cookie consent banner uses `react-cookie-consent` library
- Consent state updates GA4 Consent Mode when user accepts/declines
- All analytics tracking respects user consent preferences

**Compliance Validation:**
- Analytics only track after explicit user consent
- No tracking occurs before consent banner interaction
- Privacy Policy must disclose analytics usage and cookie practices
- Terms of Service must reference cookie usage and consent requirements

### Microsoft Store Listing

- Publisher Display Name: "Shiftline Tools"
- Professional description and screenshots
- Clear branding in Store listing
- Compliance with Store policies

## Related Documentation

- `docs/prd/technical-constraints-and-integration-requirements.md` - Microsoft Store Identity Profile
- `docs/microsoft-store-guide.md` - Microsoft Store distribution guide
- `docs/architecture/infrastructure-and-deployment-integration.md` - Deployment and identity management

