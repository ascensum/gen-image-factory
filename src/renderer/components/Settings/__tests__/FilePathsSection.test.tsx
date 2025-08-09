import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilePathsSection } from '../FilePathsSection'

// Mock the FileSelector component to avoid hanging
vi.mock('../FileSelector', () => ({
  FileSelector: ({ label, value, onChange, type }: any) => (
    <div data-testid={`file-selector-${label.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}>
      <label>{label}</label>
      <input 
        type="text" 
        value={value || ''} 
        onChange={(e) => onChange?.(e.target.value)}
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}
      />
      <button data-testid={`browse-${label.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}>
        Browse
      </button>
    </div>
  )
}))

describe('FilePathsSection', () => {
  const defaultProps = {
    inputDirectory: '',
    outputDirectory: '',
    templateFile: ''
  }

  test('renders file paths section with title and description', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('File Paths')).toBeInTheDocument()
    expect(screen.getByText(/configure input and output directories/i)).toBeInTheDocument()
  })

  test('displays input directory field', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('Input Directory')).toBeInTheDocument()
    expect(screen.getByTestId('file-selector-input-directory')).toBeInTheDocument()
  })

  test('displays output directory field', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('Output Directory')).toBeInTheDocument()
    expect(screen.getByTestId('file-selector-output-directory')).toBeInTheDocument()
  })

  test('displays template file field', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByText('Template File (Optional)')).toBeInTheDocument()
    expect(screen.getByTestId('file-selector-template-file-optional')).toBeInTheDocument()
  })

  test('displays existing file paths when provided', () => {
    const propsWithValues = {
      inputDirectory: '/existing/input',
      outputDirectory: '/existing/output',
      templateFile: '/existing/template.txt'
    }
    
    render(<FilePathsSection {...propsWithValues} />)
    
    expect(screen.getByDisplayValue('/existing/input')).toBeInTheDocument()
    expect(screen.getByDisplayValue('/existing/output')).toBeInTheDocument()
    expect(screen.getByDisplayValue('/existing/template.txt')).toBeInTheDocument()
  })

  test('renders all three FileSelector components', () => {
    render(<FilePathsSection {...defaultProps} />)
    
    expect(screen.getByTestId('file-selector-input-directory')).toBeInTheDocument()
    expect(screen.getByTestId('file-selector-output-directory')).toBeInTheDocument()
    expect(screen.getByTestId('file-selector-template-file-optional')).toBeInTheDocument()
  })
})