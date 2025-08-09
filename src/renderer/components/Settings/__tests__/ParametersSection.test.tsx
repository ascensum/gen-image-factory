import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ParametersSection } from '../ParametersSection'

describe('ParametersSection', () => {
  const defaultProps = {
    // Backend parameters from index.js command line options
    processMode: 'relax',
    aspectRatios: ['1:1', '16:9', '9:16'],
    mjVersion: '6.1',
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
    onProcessModeChange: vi.fn(),
    onAspectRatiosChange: vi.fn(),
    onMjVersionChange: vi.fn(),
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
    expect(screen.getByText('Process Mode')).toBeInTheDocument()
    expect(screen.getByText('Aspect Ratios')).toBeInTheDocument()
    expect(screen.getByText('MJ Version')).toBeInTheDocument()
    expect(screen.getByText('OpenAI Model')).toBeInTheDocument()
    expect(screen.getByText('Polling Timeout (minutes)')).toBeInTheDocument()
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

  test('displays process mode options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    expect(screen.getByText('Relax')).toBeInTheDocument()
    expect(screen.getByText('Fast')).toBeInTheDocument()
    expect(screen.getByText('Turbo')).toBeInTheDocument()
  })

  test('displays aspect ratio options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    expect(screen.getByText('1:1')).toBeInTheDocument()
    expect(screen.getByText('16:9')).toBeInTheDocument()
    expect(screen.getByText('9:16')).toBeInTheDocument()
  })

  test('displays MJ version options', () => {
    render(<ParametersSection {...defaultProps} />)
    
    expect(screen.getByText('6.1')).toBeInTheDocument()
    expect(screen.getByText('6.0')).toBeInTheDocument()
    expect(screen.getByText('niji')).toBeInTheDocument()
  })

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

  test('handles process mode change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const fastButton = screen.getByText('Fast')
    fireEvent.click(fastButton)
    
    expect(defaultProps.onProcessModeChange).toHaveBeenCalledWith('fast')
  })

  test('handles aspect ratio selection', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const ratioButton = screen.getByText('16:9')
    fireEvent.click(ratioButton)
    
    expect(defaultProps.onAspectRatiosChange).toHaveBeenCalledWith(['16:9'])
  })

  test('handles MJ version change', () => {
    render(<ParametersSection {...defaultProps} />)
    
    const versionButton = screen.getByText('6.0')
    fireEvent.click(versionButton)
    
    expect(defaultProps.onMjVersionChange).toHaveBeenCalledWith('6.0')
  })

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
    
    expect(screen.getByText(/Process mode affects generation speed and cost/)).toBeInTheDocument()
    expect(screen.getByText(/Aspect ratios determine image dimensions/)).toBeInTheDocument()
    expect(screen.getByText(/Polling timeout in minutes/)).toBeInTheDocument()
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