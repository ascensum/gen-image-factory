import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ParametersSection } from '../ParametersSection'

describe('ParametersSection', () => {
  const defaultProps = {
    // Backend parameters from index.js command line options
    // Legacy Midjourney parameters - required by component interface but NOT tested:
    processMode: 'relax',
    aspectRatios: ['1:1'],
    mjVersion: '6.1',
    // openaiModel is still actively used for prompt generation and AI features
    openaiModel: 'gpt-4o-mini',
    pollingTimeout: 15,
    keywordRandom: false,
    removeBg: false,
    imageConvert: false,
    convertToJpg: true,
    trimTransparentBackground: false,
    debugMode: false,
    jpgBackground: 'white',
    removeBgSize: 'auto',
    jpgQuality: 100,
    pngQuality: 100,
    runQualityCheck: true,
    runMetadataGen: true,
    
    // Callback functions
    // Legacy Midjourney callbacks - required by component interface but NOT tested:
    onProcessModeChange: vi.fn(),
    onAspectRatiosChange: vi.fn(),
    onMjVersionChange: vi.fn(),
    // onOpenaiModelChange is still actively used
    onOpenaiModelChange: vi.fn(),
    onPollingTimeoutChange: vi.fn(),
    onKeywordRandomChange: vi.fn(),
    onRemoveBgChange: vi.fn(),
    onImageConvertChange: vi.fn(),
    onConvertToJpgChange: vi.fn(),
    onTrimTransparentBackgroundChange: vi.fn(),
    onDebugModeChange: vi.fn(),
    onJpgBackgroundChange: vi.fn(),
    onRemoveBgSizeChange: vi.fn(),
    onJpgQualityChange: vi.fn(),
    onPngQualityChange: vi.fn(),
    onRunQualityCheckChange: vi.fn(),
    onRunMetadataGenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders basic settings section', () => {
    render(<ParametersSection {...defaultProps} />)
    
    expect(screen.getByText('Basic Settings')).toBeInTheDocument()
    // Legacy Midjourney parameters removed: Process Mode, Aspect Ratios, MJ Version
    // OpenAI Model is still actively used for prompt generation and AI features
    expect(screen.getByText('OpenAI Model')).toBeInTheDocument()
    // Component uses "Generation Timeout" not "Polling Timeout"
    expect(screen.getByText('Generation Timeout (minutes)')).toBeInTheDocument()
  })

  test('renders advanced settings section', () => {
    render(<ParametersSection {...defaultProps} />)
    
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument()
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    expect(screen.getByText('Remove Background')).toBeInTheDocument()
    expect(screen.getByText('Image Conversion')).toBeInTheDocument()
    expect(screen.getByText('Convert to JPG')).toBeInTheDocument()
  })

  test('renders image processing settings', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    expect(screen.getByText('Image Processing')).toBeInTheDocument()
    expect(screen.getByText('JPG Background')).toBeInTheDocument()
    expect(screen.getByText('Remove.bg Size')).toBeInTheDocument()
  })

  test('renders AI features settings', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    expect(screen.getByText('AI Features')).toBeInTheDocument()
    expect(screen.getByText('Run Quality Check')).toBeInTheDocument()
    expect(screen.getByText('Run Metadata Generation')).toBeInTheDocument()
  })

  // Legacy Midjourney parameter tests removed:
  // - displays process mode options
  // - displays aspect ratio options
  // - displays MJ version options
  
  test('displays OpenAI model options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument()
  })

  test('displays JPG background options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    expect(screen.getByText('White')).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
  })

  test('displays remove.bg size options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    expect(screen.getByText('Auto')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
  })

  // Legacy Midjourney parameter tests removed:
  // - handles process mode change
  // - handles aspect ratio selection
  // - handles MJ version change

  test('handles OpenAI model change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const modelButton = screen.getByText('gpt-4o')
    fireEvent.click(modelButton)
    
    expect(defaultProps.onOpenaiModelChange).toHaveBeenCalledWith('gpt-4o')
  })

  test('handles polling timeout change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const timeoutInput = screen.getByDisplayValue('15')
    fireEvent.change(timeoutInput, { target: { value: '20' } })
    
    expect(defaultProps.onPollingTimeoutChange).toHaveBeenCalledWith(20)
  })

  test('handles keyword random toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const toggle = screen.getByRole('switch', { name: /keyword random/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onKeywordRandomChange).toHaveBeenCalledWith(true)
  })

  test('handles remove background toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle remove background/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onRemoveBgChange).toHaveBeenCalledWith(true)
  })

  test('handles image conversion toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle image conversion/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onImageConvertChange).toHaveBeenCalledWith(true)
  })

  test('handles convert to JPG toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle convert to jpg/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onConvertToJpgChange).toHaveBeenCalledWith(false)
  })

  test('handles trim transparent background toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle trim transparent background/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onTrimTransparentBackgroundChange).toHaveBeenCalledWith(true)
  })

  test('handles debug mode toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle debug mode/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onDebugModeChange).toHaveBeenCalledWith(true)
  })

  test('handles JPG background change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const blackButton = screen.getByText('Black')
    fireEvent.click(blackButton)
    
    expect(defaultProps.onJpgBackgroundChange).toHaveBeenCalledWith('black')
  })

  test('handles remove.bg size change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const fullButton = screen.getByText('Full')
    fireEvent.click(fullButton)
    
    expect(defaultProps.onRemoveBgSizeChange).toHaveBeenCalledWith('full')
  })

  test('handles JPG quality change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    // Use getAllByDisplayValue since there are multiple inputs with value 100
    const qualityInputs = screen.getAllByDisplayValue('100')
    const jpgQualityInput = qualityInputs[0] // First one is JPG quality
    fireEvent.change(jpgQualityInput, { target: { value: '85' } })
    
    expect(defaultProps.onJpgQualityChange).toHaveBeenCalledWith(85)
  })

  test('handles PNG quality change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    // Use getAllByDisplayValue since there are multiple inputs with value 100
    const qualityInputs = screen.getAllByDisplayValue('100')
    const pngQualityInput = qualityInputs[1] // Second one is PNG quality
    fireEvent.change(pngQualityInput, { target: { value: '90' } })
    
    expect(defaultProps.onPngQualityChange).toHaveBeenCalledWith(90)
  })

  test('handles run quality check toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle run quality check/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onRunQualityCheckChange).toHaveBeenCalledWith(false)
  })

  test('handles run metadata generation toggle', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    const toggle = screen.getByRole('switch', { name: /toggle run metadata generation/i })
    fireEvent.click(toggle)
    
    expect(defaultProps.onRunMetadataGenChange).toHaveBeenCalledWith(false)
  })

  test('shows cost indicators for features', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Check that cost indicators are displayed in the cost summary
    expect(screen.getByText('$0.07 cost')).toBeInTheDocument()
    expect(screen.getByText('Total Estimated Cost')).toBeInTheDocument()
  })

  test('validates polling timeout input', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const timeoutInput = screen.getByDisplayValue('15')
    fireEvent.change(timeoutInput, { target: { value: '20' } })
    
    // Should call the callback with valid input
    expect(defaultProps.onPollingTimeoutChange).toHaveBeenCalledWith(20)
  })

  test('validates quality input ranges', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Expand advanced settings first
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    // Use getAllByDisplayValue since there are multiple inputs with value 100
    const qualityInputs = screen.getAllByDisplayValue('100')
    const jpgQualityInput = qualityInputs[0] // First one is JPG quality
    fireEvent.change(jpgQualityInput, { target: { value: '85' } })
    
    // Should call the callback with the new value
    expect(defaultProps.onJpgQualityChange).toHaveBeenCalledWith(85)
  })

  test('shows help text for advanced options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Legacy Midjourney help text removed:
    // - Process mode affects generation speed and cost
    // - Aspect ratios determine image dimensions
    // Component uses "Generation Timeout" and help text is "Used as HTTP timeout for Runware (minutes)"
    // There might be multiple "Generation Timeout" elements, so use getAllByText
    const timeoutTexts = screen.getAllByText(/Generation Timeout/i)
    expect(timeoutTexts.length).toBeGreaterThan(0)
    // Also check for the help text
    expect(screen.getByText(/Used as HTTP timeout for Runware/i)).toBeInTheDocument()
  })

  test('collapses advanced settings by default', () => {
    render(<ParametersSection {...defaultProps} />)
    
    // Advanced settings should be collapsed initially
    expect(screen.queryByText('Image Processing')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Features')).not.toBeInTheDocument()
  })

  test('expands advanced settings when clicked', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const advancedToggle = screen.getByText('Show Advanced')
    fireEvent.click(advancedToggle)
    
    expect(screen.getByText('Image Processing')).toBeInTheDocument()
    expect(screen.getByText('AI Features')).toBeInTheDocument()
  })
}) 