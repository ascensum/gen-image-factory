import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { SettingsPanel } from '../SettingsPanel'

// Mock the Settings components
vi.mock('../ApiKeysSection', () => ({
  ApiKeysSection: () => <div data-testid="api-keys-section">API Keys Section</div>
}))

vi.mock('../FilePathsSection', () => ({
  FilePathsSection: () => <div data-testid="file-paths-section">File Paths Section</div>
}))

vi.mock('../ParametersSection', () => ({
  ParametersSection: () => <div data-testid="parameters-section">Parameters Section</div>
}))

describe('SettingsPanel', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  test('renders settings panel with navigation tabs', () => {
    render(<SettingsPanel />)
    
    // Check that main navigation tabs are rendered
    expect(screen.getAllByText('API Keys')).toHaveLength(2) // Tab and section header
    expect(screen.getByText('File Paths')).toBeInTheDocument()
    expect(screen.getByText('Parameters')).toBeInTheDocument() // Only the tab button initially
  })

  test('renders settings panel with API keys section', () => {
    render(<SettingsPanel />)
    
    expect(screen.getAllByTestId('api-keys-section')[0]).toBeInTheDocument()
  })

  test('navigates to Files section when tab is clicked', () => {
    render(<SettingsPanel />)
    
    const filesTab = screen.getByTestId('files-tab')
    fireEvent.click(filesTab)
    
    expect(screen.getAllByTestId('file-paths-section')[0]).toBeInTheDocument()
  })

  test('navigates to Parameters section when tab is clicked', async () => {
    render(<SettingsPanel />)
    
    const parametersTab = screen.getByTestId('parameters-tab')
    fireEvent.click(parametersTab)
    
    await waitFor(() => {
      expect(screen.getAllByTestId('parameters-section')[0]).toBeInTheDocument()
    })
  })

  test('navigates back to API Keys section', async () => {
    render(<SettingsPanel />)
    
    // First navigate to another section
    const filesTab = screen.getByText('File Paths')
    fireEvent.click(filesTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('file-paths-section')).toBeInTheDocument()
    })
    
    // Then navigate back to API Keys
    const apiKeysTab = screen.getByText('API Keys')
    fireEvent.click(apiKeysTab)
    
    await waitFor(() => {
      expect(screen.getAllByTestId('api-keys-section')[0]).toBeInTheDocument()
    })
  })

  test('displays save and reset buttons', () => {
    render(<SettingsPanel />)
    
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  test('handles keyboard navigation', () => {
    render(<SettingsPanel />)
    
    const filesTab = screen.getByText('File Paths')
    filesTab.focus()
    
    // Test that tab can be activated with Enter key
    fireEvent.keyDown(filesTab, { key: 'Enter', code: 'Enter' })
    
    // The tab should be selected after Enter key
    expect(filesTab).toHaveAttribute('aria-selected', 'true')
  })

  test('shows settings title', () => {
    render(<SettingsPanel />)
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('displays settings title', () => {
    render(<SettingsPanel />)
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('handles tab selection correctly', async () => {
    render(<SettingsPanel />)
    
    const filesTab = screen.getByText('File Paths')
    const parametersTab = screen.getByText('Parameters')
    
    // Click Files tab
    fireEvent.click(filesTab)
    expect(filesTab).toHaveAttribute('aria-selected', 'true')
    expect(parametersTab).toHaveAttribute('aria-selected', 'false')
    
    // Click Parameters tab
    fireEvent.click(parametersTab)
    expect(parametersTab).toHaveAttribute('aria-selected', 'true')
    expect(filesTab).toHaveAttribute('aria-selected', 'false')
  })

  test('applies correct styling to selected tab', async () => {
    render(<SettingsPanel />)
    
    const filesTab = screen.getByText('File Paths')
    fireEvent.click(filesTab)
    
    await waitFor(() => {
      expect(filesTab).toHaveClass('bg-blue-100', 'text-blue-700')
    })
  })

  test('shows all available tabs', () => {
    render(<SettingsPanel />)
    
    expect(screen.getAllByText('API Keys')).toHaveLength(2) // Tab and section header
    expect(screen.getByText('File Paths')).toBeInTheDocument()
    expect(screen.getByText('Parameters')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('AI Features')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  test('maintains tab state when switching', () => {
    render(<SettingsPanel />)
    
    // Switch to Files
    const filesTab = screen.getByTestId('files-tab')
    fireEvent.click(filesTab)
    expect(screen.getAllByTestId('file-paths-section')[0]).toBeInTheDocument()
    
    // Switch to Parameters
    const parametersTab = screen.getByTestId('parameters-tab')
    fireEvent.click(parametersTab)
    expect(screen.getAllByTestId('parameters-section')[0]).toBeInTheDocument()
    
    // Switch back to Files
    fireEvent.click(filesTab)
    expect(screen.getAllByTestId('file-paths-section')[0]).toBeInTheDocument()
  })
}) 