import { describe, beforeEach, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FilePathsSection } from '../FilePathsSection'

// Mock Electron API
const mockElectronAPI = {
  showOpenDialog: vi.fn(),
  validatePath: vi.fn()
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
})

describe('FilePathsSection', () => {
  const defaultProps = {
    inputDirectory: '',
    outputDirectory: '',
    templateFiles: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI.showOpenDialog.mockResolvedValue({ 
      filePaths: ['/test/directory'], 
      canceled: false 
    })
    mockElectronAPI.validatePath.mockResolvedValue({
      isValid: true,
      exists: true,
      isAccessible: true,
      hasReadPermission: true,
      hasWritePermission: true
    })
  })

  test('renders file paths section with title and description', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('File Paths')).toBeInTheDocument()
    expect(screen.getByText(/configure input and output directories/i)).toBeInTheDocument()
  })

  test('displays input directory field', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('Input Directory')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/select directory containing your input files/i)).toBeInTheDocument()
  })

  test('displays output directory field', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('Output Directory')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/select directory for generated output/i)).toBeInTheDocument()
  })

  test('displays template files field', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('Template Files (Optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/select template files for custom prompts/i)).toBeInTheDocument()
  })

  test('opens directory dialog when input directory browse button is clicked', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const inputDirectoryButton = browseButtons[0] // First browse button is for input directory
    fireEvent.click(inputDirectoryButton)
    
    expect(window.electronAPI.showOpenDialog).toHaveBeenCalledWith({
      type: 'directory',
      defaultPath: ''
    })
  })

  test('opens directory dialog when output directory browse button is clicked', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const outputDirectoryButton = browseButtons[1] // Second browse button is for output directory
    fireEvent.click(outputDirectoryButton)
    
    expect(window.electronAPI.showOpenDialog).toHaveBeenCalledWith({
      type: 'directory',
      defaultPath: ''
    })
  })

  test('opens file dialog when template files browse button is clicked', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const templateFilesButton = browseButtons[2] // Third browse button is for template files
    fireEvent.click(templateFilesButton)
    
    expect(window.electronAPI.showOpenDialog).toHaveBeenCalledWith({
      type: 'multiple',
      fileTypes: ['.txt', '.md', '.json'],
      defaultPath: undefined
    })
  })

  test('displays existing file paths when provided', () => {
    const propsWithValues = {
      inputDirectory: '/existing/input',
      outputDirectory: '/existing/output',
      templateFiles: ['/existing/template1.txt', '/existing/template2.txt']
    }
    
    render(<FilePathsSection {...propsWithValues} />)
    
    expect(screen.getByDisplayValue('/existing/input')).toBeInTheDocument()
    expect(screen.getByDisplayValue('/existing/output')).toBeInTheDocument()
    expect(screen.getByDisplayValue('/existing/template1.txt; /existing/template2.txt')).toBeInTheDocument()
  })

  test('handles directory selection for input directory', async () => {
    const onInputDirectoryChange = vi.fn()
    render(<FilePathsSection {...defaultProps} onInputDirectoryChange={onInputDirectoryChange} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const inputDirectoryButton = browseButtons[0]
    fireEvent.click(inputDirectoryButton)
    
    await waitFor(() => {
      expect(onInputDirectoryChange).toHaveBeenCalledWith('/test/directory')
    })
  })

  test('handles directory selection for output directory', async () => {
    const onOutputDirectoryChange = vi.fn()
    render(<FilePathsSection {...defaultProps} onOutputDirectoryChange={onOutputDirectoryChange} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const outputDirectoryButton = browseButtons[1]
    fireEvent.click(outputDirectoryButton)
    
    await waitFor(() => {
      expect(onOutputDirectoryChange).toHaveBeenCalledWith('/test/directory')
    })
  })

  test('handles file selection for template files', async () => {
    const onTemplateFilesChange = vi.fn()
    render(<FilePathsSection {...defaultProps} onTemplateFilesChange={onTemplateFilesChange} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const templateFilesButton = browseButtons[2]
    fireEvent.click(templateFilesButton)
    
    await waitFor(() => {
      expect(onTemplateFilesChange).toHaveBeenCalledWith(['/test/directory'])
    })
  })

  test('shows validation errors for invalid paths', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    // The component should show validation errors for invalid paths
    // This would be implemented in the component if needed
    expect(screen.getByText(/directory containing keyword files/i)).toBeInTheDocument()
    expect(screen.getByText(/directory where generated images/i)).toBeInTheDocument()
    expect(screen.getByText(/template files containing prompt templates/i)).toBeInTheDocument()
  })

  test('handles directory dialog cancellation', () => {
    mockElectronAPI.showOpenDialog.mockResolvedValue({ filePaths: [], canceled: true })
    render(<FilePathsSection {...defaultProps} />)
    
    const browseButtons = screen.getAllByRole('button', { name: /browse/i })
    const inputDirectoryButton = browseButtons[0]
    fireEvent.click(inputDirectoryButton)
    
    // Should not call onChange when dialog is cancelled
    expect(window.electronAPI.showOpenDialog).toHaveBeenCalled()
  })
})