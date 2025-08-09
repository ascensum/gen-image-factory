# AI Frontend Generation Prompt: Gen Image Factory Settings UI

## High-Level Goal
Create a comprehensive, desktop-optimized Settings UI for an Electron application that manages API keys, file paths, and generation parameters with native OS integration, secure storage using keytar, real-time validation, and cost indicators.

## Detailed, Step-by-Step Instructions

1. **Create the main Settings Panel component** (`SettingsPanel.tsx`)
   - Implement tab navigation with sections: API Keys, Files, Parameters, Advanced
   - Add auto-save functionality with debounced form updates
   - Include loading states and error handling
   - Use Tailwind CSS for responsive design

2. **Create the SecureInput component** (`SecureInput.tsx`)
   - Build a masked input field for API keys with show/hide toggle
   - Implement real-time validation with visual feedback
   - Add secure storage integration using keytar library
   - Include error states and success confirmation
   - Handle cases where native credential manager is unavailable

3. **Create the FileSelector component** (`FileSelector.tsx`)
   - Build file/directory selection with Electron's native dialog.showOpenDialog
   - Add drag-and-drop support from OS file manager
   - Implement path validation and permission checking
   - Include recent paths dropdown and auto-complete
   - Integrate with OS recent files list

4. **Create the CostIndicator component** (`CostIndicator.tsx`)
   - Build cost display badges with color-coded levels
   - Add estimated cost calculations for API features
   - Include tooltips with detailed pricing information
   - Implement different size variants (small, medium, large)

5. **Create the SettingsSection component** (`SettingsSection.tsx`)
   - Build collapsible section containers for settings groups
   - Add validation status indicators
   - Implement progressive disclosure for advanced options
   - Include help text and documentation links

6. **Create the API Keys section** (`ApiKeysSection.tsx`)
   - Build service selection dropdown (OpenAI, Midjourney, etc.)
   - Add SecureInput components for each service
   - Implement test connection functionality
   - Include secure storage status indicators

7. **Create the File Paths section** (`FilePathsSection.tsx`)
   - Build FileSelector components for input/output directories
   - Add file type filtering for keyword files and templates
   - Implement permission validation and error handling
   - Include path validation and display

8. **Create the Generation Parameters section** (`ParametersSection.tsx`)
   - Build toggle switches for boolean settings (Remove Background, etc.)
   - Add sliders for quality settings
   - Implement CostIndicator components for paid features
   - Include parameter presets and advanced options

9. **Implement form validation and error handling**
   - Add real-time validation for all input fields
   - Implement error message display with clear feedback
   - Add success confirmations for saved settings
   - Include keyboard shortcuts (Ctrl+S to save)

10. **Add desktop-specific design and accessibility**
    - Implement desktop-optimized layout with window size adaptation
    - Add proper ARIA labels and roles
    - Ensure full keyboard navigation support with shortcuts
    - Include focus management and screen reader support
    - Add native OS integration features

## Code Examples, Data Structures & Constraints

### Tech Stack
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React hooks (useState, useEffect, useCallback)
- **Form Handling:** React Hook Form (recommended)
- **Validation:** Zod schema validation

### Component Structure
```typescript
// Settings Panel Structure
<SettingsPanel>
  <SettingsTabs>
    <ApiKeysSection />
    <FilePathsSection />
    <ParametersSection />
    <AdvancedSection />
  </SettingsTabs>
  <SettingsActions>
    <SaveButton />
    <ResetButton />
  </SettingsActions>
</SettingsPanel>
```

### API Integration
```typescript
// Electron IPC Interface
interface SettingsAdapter {
  getSettings(): Promise<SettingsObject>;
  saveSettings(settings: SettingsObject): Promise<void>;
  getApiKey(serviceName: string): Promise<string | null>;
  setApiKey(serviceName: string, apiKey: string): Promise<void>;
  selectFile(options: FileDialogOptions): Promise<string | null>;
  validateApiKey(serviceName: string, apiKey: string): Promise<boolean>;
  showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>;
  isSecureStorageAvailable(): Promise<boolean>;
}
```

### Settings Data Structure
```typescript
interface SettingsObject {
  apiKeys: {
    openai?: string;
    midjourney?: string;
    [key: string]: string | undefined;
  };
  filePaths: {
    inputDirectory: string;
    outputDirectory: string;
    templateFiles: string[];
  };
  parameters: {
    removeBackground: boolean;
    qualityLevel: 'low' | 'medium' | 'high';
    enableMetadata: boolean;
    enableQualityCheck: boolean;
    [key: string]: any;
  };
  advanced: {
    [key: string]: any;
  };
}
```

### DO NOT include:
- External state management libraries (Redux, Zustand, etc.)
- Complex animations or heavy dependencies
- Server-side rendering or static generation
- Complex routing (use simple tab navigation)
- External UI component libraries (build custom components)
- Web-specific features (use desktop-optimized alternatives)

## Define a Strict Scope

**You should only create:**
- `src/renderer/components/Settings/SettingsPanel.tsx` - Main settings container
- `src/renderer/components/Settings/SecureInput.tsx` - Secure API key input
- `src/renderer/components/Settings/FileSelector.tsx` - File/directory selector
- `src/renderer/components/Settings/CostIndicator.tsx` - Cost display component
- `src/renderer/components/Settings/SettingsSection.tsx` - Section container
- `src/renderer/components/Settings/ApiKeysSection.tsx` - API keys management
- `src/renderer/components/Settings/FilePathsSection.tsx` - File path configuration
- `src/renderer/components/Settings/ParametersSection.tsx` - Generation parameters

**Do NOT alter:**
- Existing Electron main process files
- Preload script or IPC bridge
- Database models or backend services
- Existing React app structure or routing
- Package.json or build configuration
- Electron security policies or CSP settings

## Visual Design Requirements

### Color Palette
- **Primary:** #3B82F6 (blue-500)
- **Success:** #10B981 (emerald-500)
- **Warning:** #F59E0B (amber-500)
- **Error:** #EF4444 (red-500)
- **Neutral:** #6B7280 (gray-500)

### Typography
- **Font:** Inter (system font stack)
- **Sizes:** text-sm (14px), text-base (16px), text-lg (18px)
- **Weights:** font-normal (400), font-medium (500), font-semibold (600)

### Spacing
- **Base unit:** 4px (space-1)
- **Common spacing:** space-2 (8px), space-4 (16px), space-6 (24px)

### Component Styling Guidelines
- Use Tailwind utility classes for all styling
- Implement hover and focus states for all interactive elements
- Add smooth transitions (transition-all duration-200)
- Use consistent border radius (rounded-md, rounded-lg)
- Implement proper focus rings (focus:ring-2 focus:ring-blue-500)

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- Minimum color contrast ratio of 4.5:1 for normal text
- Proper ARIA labels and roles for all form elements
- Keyboard navigation support for all interactive elements
- Screen reader friendly error messages and success confirmations
- Focus management for modal dialogs and form sections

### Implementation Details
- Use semantic HTML elements (button, input, label, fieldset)
- Add proper aria-describedby for help text
- Implement aria-live regions for dynamic content
- Include skip links for keyboard navigation
- Add proper focus indicators and focus trapping

## Performance Considerations

### Desktop Optimization Strategies
- Implement debounced form validation (300ms delay)
- Use React.memo for expensive components
- Lazy load advanced settings sections
- Optimize re-renders with useCallback and useMemo
- Leverage native OS file dialogs for performance
- Use Electron's IPC for secure storage operations
- Implement window state persistence

### Loading States
- Add skeleton screens for initial data loading
- Implement progressive loading for advanced sections
- Show loading indicators for API operations
- Add optimistic updates for better perceived performance
- Use native OS loading indicators for file operations

## Security Considerations

### API Key Handling
- Never log or display API keys in plain text
- Use native OS credential manager (keytar) for secure storage
- Implement proper key validation before storage
- Add confirmation dialogs for key deletion
- Include security status indicators
- Handle cases where secure storage is unavailable
- Use Electron's IPC for secure key operations

### Data Validation
- Validate all user inputs on both client and server
- Sanitize file paths and prevent directory traversal
- Implement proper error handling without exposing sensitive data
- Add rate limiting for API key validation requests

## Testing Requirements

### Component Testing
- Unit tests for all Settings components
- Integration tests for form validation
- Accessibility testing with axe-core
- Keyboard navigation testing
- Screen reader compatibility testing

### User Experience Testing
- Test form auto-save functionality
- Validate error handling and recovery
- Test responsive design across devices
- Verify accessibility compliance
- Test performance with large datasets

## Final Implementation Notes

**Critical Success Factors:**
1. **Security First:** All API keys must be handled securely with proper masking and storage
2. **User Experience:** Immediate feedback for all user actions with clear error messages
3. **Accessibility:** Full WCAG 2.1 AA compliance with keyboard and screen reader support
4. **Performance:** Fast loading and responsive interactions with proper loading states
5. **Maintainability:** Clean, well-documented code with proper TypeScript types

**Remember:** All AI-generated code will require careful human review, testing, and refinement to be considered production-ready. Pay special attention to security implementations and accessibility compliance. 