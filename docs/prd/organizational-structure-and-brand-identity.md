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

### Internal Identity: Ascensum (Legacy)

**Ascensum** is the legacy internal identity from the original personal Microsoft Store account:
- **Identity Name**: `AscensumTools.GenImageFactory` (immutable Store identity)
- **Publisher**: `CN=E312E730-261C-4C09-AA08-642C4C57E8F8`
- **Store ID**: `9P0D8CQ3R86F`

**Critical Constraint**: The "Ascensum" identity name must be hidden behind the "Shiftline Tools" display brand in all user-visible areas. No references to "Ascensum" or "AscensumTools" may appear in:
- Application UI
- Splash screens
- About dialogs
- User-facing documentation
- Website content
- Store listings (except immutable technical identity fields)

## Microsoft Store Identity Management

### Current Identity (Legacy - Personal Account)

The application currently uses a Microsoft Store identity from the original personal Ascensum account:

- **Identity Name**: `AscensumTools.GenImageFactory` (immutable Store identity, internal only)
- **Publisher**: `CN=E312E730-261C-4C09-AA08-642C4C57E8F8`
- **Publisher Display Name**: `Shiftline Tools` (user-visible brand)
- **Store ID**: `9P0D8CQ3R86F`

**Configuration Location**: `package.json#build.appx`

### Future Identity (Shiftline Tools Organization)

When a new Microsoft Store identity is created connected to the Shiftline Tools brand:

- **Identity Name**: `ShiftlineTools.GenImageFactory` (or similar, based on new Store identity)
- **Publisher**: `CN=<NEW_PUBLISHER_ID>` (from new Store identity)
- **Publisher Display Name**: `Shiftline Tools` (unchanged)
- **Store ID**: `<NEW_STORE_ID>` (from new Store identity)

**Migration Process:**
- Create new Microsoft Store identity in Partner Center
- Update `package.json#build.appx` with new identity properties
- Update all documentation references
- Validate build and submission process
- Document migration checklist

**See**: Story 2.7 for detailed migration requirements.

## Brand Enforcement Policies

### User-Visible Branding

All user-facing content must:
- Display "Shiftline Tools" as the publisher/developer
- Include "Made by Shiftline Tools" branding where appropriate
- Maintain professional presentation
- Avoid any references to "Ascensum" or "AscensumTools"

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

- Professional hero/home page (not just docs index)
- Clear "Made by Shiftline Tools" branding
- Legal pages (Privacy Policy, Terms of Service) required
- Resources/affiliate page for transparency
- Consistent branding throughout

### Microsoft Store Listing

- Publisher Display Name: "Shiftline Tools"
- Professional description and screenshots
- Clear branding in Store listing
- Compliance with Store policies

## Related Documentation

- `docs/prd/technical-constraints-and-integration-requirements.md` - Microsoft Store Identity Profile
- `docs/microsoft-store-guide.md` - Microsoft Store distribution guide
- `docs/architecture/infrastructure-and-deployment-integration.md` - Deployment and identity management

