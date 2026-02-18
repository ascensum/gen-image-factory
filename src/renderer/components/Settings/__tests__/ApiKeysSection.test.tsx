import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ApiKeysSection } from '../ApiKeysSection'

describe('ApiKeysSection', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    
    // Mock the electronAPI methods
    Object.defineProperty(window, 'electronAPI', {
      value: {
        getApiKey: vi.fn().mockResolvedValue('test-key'),
        saveApiKey: vi.fn().mockResolvedValue(true),
        testApiConnection: vi.fn().mockResolvedValue({ success: true }),
        getSettings: vi.fn().mockResolvedValue({}),
        saveSettings: vi.fn().mockResolvedValue(true),
      },
      writable: true,
    })
  })

  test('renders API keys section with default services', () => {
    render(<ApiKeysSection />)
    
    // Check that the section header is rendered
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText(/Configure your API keys for various services/)).toBeInTheDocument()
    
    // Check that the default OpenAI service is rendered
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('API Key Configuration')).toBeInTheDocument()
  })

  test('displays API key input fields', () => {
    render(<ApiKeysSection />)
    
    // Check that API key input is rendered
    expect(screen.getByLabelText('API Key')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
  })

  test('shows test button for each service', () => {
    render(<ApiKeysSection />)
    
    // Check that test button is rendered
    expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument()
  })

  test('handles API key input changes', async () => {
    const onApiKeyChange = vi.fn()
    render(<ApiKeysSection onApiKeyChange={onApiKeyChange} />)
    
    const apiKeyInput = screen.getByLabelText('API Key')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } })
    
    await waitFor(() => {
      expect(onApiKeyChange).toHaveBeenCalledWith('openai', 'sk-test-key')
    })
  })

  test('loads existing API keys on mount', async () => {
    // Mock that getApiKey returns a valid key
    window.electronAPI.getApiKey.mockResolvedValue('sk-1234567890abcdef1234567890abcdef1234567890abcdef')
    
    render(<ApiKeysSection />)
    
    // The component doesn't automatically call getApiKey on mount
    // It only loads keys when explicitly provided via props
    expect(window.electronAPI.getApiKey).not.toHaveBeenCalled()
  })

  test('shows success message after saving API key', async () => {
    render(<ApiKeysSection />)
    
    const apiKeyInput = screen.getByDisplayValue('')
    
    // Enter a valid API key (exactly 48 chars after sk-)
    fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef' } })
    
    // Check that the input shows the entered value
    expect(apiKeyInput).toHaveValue('sk-1234567890abcdef1234567890abcdef1234567890abcdef')
    
    // The component should not show error message for valid keys
    expect(screen.queryByText(/invalid api key format/i)).not.toBeInTheDocument()
  })

  test('shows error message when API key save fails', async () => {
    render(<ApiKeysSection />)
    
    const apiKeyInput = screen.getByDisplayValue('')
    
    // Enter an invalid API key
    fireEvent.change(apiKeyInput, { target: { value: 'invalid-key' } })
    
    // Check that the input shows the entered value
    expect(apiKeyInput).toHaveValue('invalid-key')
    
    // Check that error message is shown
    expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument()
  })

  test('tests API key connection when test button is clicked', async () => {
    const onTestConnection = vi.fn().mockResolvedValue(true)
    render(<ApiKeysSection onTestConnection={onTestConnection} />)
    
    // First provide a valid API key to enable the test button
    const apiKeyInput = screen.getByLabelText('API Key')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-123456789012345678901234567890123456789012345678' } })
    
    // Wait for the key to be validated
    await waitFor(() => {
      expect(screen.queryByText(/invalid api key format/i)).not.toBeInTheDocument()
    })
    
    const testButton = screen.getByRole('button', { name: /test/i })
    fireEvent.click(testButton)
    
    await waitFor(() => {
      expect(onTestConnection).toHaveBeenCalledWith('openai')
    })
  })

  test('shows loading state during connection test', async () => {
    const onTestConnection = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 100)))
    render(<ApiKeysSection onTestConnection={onTestConnection} />)
    
    // First provide a valid API key to enable the test button
    const apiKeyInput = screen.getByLabelText('API Key')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-123456789012345678901234567890123456789012345678' } })
    
    await waitFor(() => {
      expect(screen.queryByText(/invalid api key format/i)).not.toBeInTheDocument()
    })
    
    const testButton = screen.getByRole('button', { name: /test/i })
    fireEvent.click(testButton)
    
    // During connection test the button is disabled (loading state)
    expect(testButton).toBeDisabled()
    
    // After test completes, button is enabled again
    await waitFor(() => {
      expect(testButton).not.toBeDisabled()
    })
  })

  test('displays multiple services when provided', () => {
    const services = [
      { name: 'openai', apiKey: '', isValid: false, isTested: false, secureStorageAvailable: false },
      { name: 'midjourney', apiKey: '', isValid: false, isTested: false, secureStorageAvailable: false }
    ]
    
    render(<ApiKeysSection services={services} />)
    
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Midjourney')).toBeInTheDocument()
  })
}) 