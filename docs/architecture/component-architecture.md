# Component Architecture

The application will be composed of several new components that orchestrate and extend the existing backend logic, as illustrated in the diagram below.

```mermaid
graph TD
    subgraph "Electron Renderer Process"
        UI[UI Components <br/>(React + TypeScript + Tailwind CSS)]
        SecurityUI[Security Status UI <br/>(Story 1.13)]
        Vite[Vite Build Tool <br/>& Dev Server]
    end

    subgraph "Electron Main Process"
        Adapter[Backend Adapter]
        SecurityMgr[Security Manager <br/>(Story 1.13)]
        DB[Database Service <br/>(SQLite)]
        SecureStore[Secure Storage Service <br/>(Keytar)]
        CoreLogic[Core Logic Services <br/>(Midjourney/OpenAI/RemoveBG)]
    end
    
    subgraph "External APIs"
        OpenAI[OpenAI API]
        PiAPI[PiAPI]
        RemoveBgAPI[Remove.bg API]
    end

    UI -- IPC Bridge --> Adapter
    SecurityUI --> SecurityMgr
    Vite --> UI
    
    Adapter --> SecurityMgr
    Adapter --> DB
    Adapter --> SecureStore
    Adapter --> CoreLogic

    CoreLogic --> OpenAI
    CoreLogic --> PiAPI
    CoreLogic --> RemoveBgAPI
```

## Settings UI Components

### Core Settings Components
The Settings UI is organized into logical sections with conditional visibility and master toggle system:

#### **SettingsPanel.tsx** - Main Settings Container
- **Purpose**: Main settings container with tab navigation
- **Features**: Tab-based navigation, settings persistence, form validation
- **Tabs**: API Keys, Files, Parameters, Processing, AI, Advanced
- **State Management**: Centralized settings state with unsaved changes tracking

#### **ApiKeysSection.tsx** - API Key Management
- **Purpose**: Secure API key management with OS credential storage
- **Features**: Secure input masking, show/hide toggles, validation
- **Security**: Uses native OS credential manager via keytar library

#### **FilePathsSection.tsx** - File Path Configuration
- **Purpose**: File path configuration with native OS file dialogs
- **Features**: File browser integration, drag-and-drop support, validation
- **Integration**: Electron dialog.showOpenDialog for native file selection

#### **ParametersSection.tsx** - Generation Parameters
- **Purpose**: Image generation parameter configuration
- **Features**: Parameter validation, preset management, real-time validation
- **Integration**: Backend parameter validation and optimization

#### **ProcessingSection.tsx** - Image Processing Configuration
- **Purpose**: Image processing and enhancement settings
- **Features**: Image enhancement toggles, quality settings, format options
- **New Features**: Image enhancement, sharpening, saturation controls

#### **AISection.tsx** - AI Feature Configuration
- **Purpose**: AI-powered feature configuration
- **Features**: Quality check toggles, metadata generation settings
- **Integration**: OpenAI integration for AI-powered features

#### **AdvancedSection.tsx** - Advanced Settings
- **Purpose**: Advanced application configuration
- **Features**: Debug mode, auto-save settings, performance options
- **Integration**: Development and debugging features

### Security Components (Story 1.13)

#### **SecurityStatusIndicator.tsx** - Security Status Display
- **Purpose**: Display security status and storage method to users
- **Features**: Security level indicators, storage method display, user messaging
- **Integration**: Security manager for status updates

#### **SecurityConfiguration.tsx** - Security Settings
- **Purpose**: Security configuration and management
- **Features**: Security mode selection, encryption status, memory protection
- **Integration**: Security manager for configuration changes

### Utility Components

#### **SecureInput.tsx** - Secure Input Field
- **Purpose**: Secure input for sensitive data like API keys
- **Features**: Input masking, show/hide toggle, validation
- **Security**: Secure storage integration, memory protection

#### **FileSelector.tsx** - File Selection Component
- **Purpose**: Native file and directory selection
- **Features**: File type filtering, drag-and-drop, path validation
- **Integration**: Electron dialog integration

#### **Toggle.tsx** - Toggle Switch Component
- **Purpose**: Boolean setting toggles
- **Features**: Animated toggles, accessibility support
- **Integration**: Form state management

#### **CostIndicator.tsx** - Cost Estimation
- **Purpose**: Real-time cost estimation for API usage
- **Features**: Cost calculation, usage tracking, budget alerts
- **Integration**: API usage monitoring

## Backend Integration Components

### **BackendAdapter** - Main Integration Layer
- **Purpose**: Sole intermediary between UI and backend modules
- **Features**: Job control, settings management, security integration
- **Security**: Three-tier security implementation (keytar → encrypted DB → plain text)

### **SecurityManager** - Security Management (Story 1.13)
- **Purpose**: Centralized security management and encryption
- **Features**: API key encryption, memory protection, security status
- **Integration**: Database encryption, keytar fallback management

Note (2025-11-02): In the current implementation, Security Manager responsibilities are consolidated inside `BackendAdapter`. A separate `SecurityManager` module and encrypted-DB fallback are planned but not yet implemented.

### **JobRunner** - Job Execution Service
- **Purpose**: Encapsulates core job execution logic
- **Features**: Progress tracking, error handling, job state management
- **Integration**: Existing CLI modules with minimal refactoring

### **ErrorTranslationService** - Error Handling
- **Purpose**: Translates technical errors to user-friendly messages
- **Features**: Error categorization, user messaging, logging
- **Integration**: Comprehensive error handling across all components

## Security Architecture (Story 1.13)

### Security Implementation Tiers
1. **Native OS Keychain**: Primary secure storage using keytar
2. **Encrypted Database**: Secure fallback when keytar unavailable
3. **Plain Text Database**: Development-only fallback (current)

### Memory Protection
- API keys cleared from memory on application exit
- Sensitive data masked in logs and error messages
- Secure string handling for API key operations

### Security Status Communication
- Real-time security status updates to UI
- User-friendly messaging about security level
- Storage method indicators and warnings

## Component Communication Patterns

### IPC Communication
- All UI-backend communication via secure IPC bridge
- Event-based progress updates and status changes
- Error propagation with user-friendly translation

### State Management
- Centralized settings state with validation
- Real-time security status updates
- Job execution state management

### Security Integration
- Secure credential storage with fallback mechanisms
- Memory protection for sensitive data
- User communication about security status 