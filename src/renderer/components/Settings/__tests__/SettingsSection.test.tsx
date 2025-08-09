import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { SettingsSection } from '../SettingsSection'

describe('SettingsSection', () => {
  const defaultProps = {
    title: 'Test Section',
    children: <div data-testid="section-content">Section Content</div>,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders settings section with title', () => {
    render(<SettingsSection {...defaultProps} />)
    
    expect(screen.getByText('Test Section')).toBeInTheDocument()
  })

  test('displays section content when expanded', () => {
    render(<SettingsSection {...defaultProps} isExpanded={true} />)
    
    expect(screen.getByTestId('section-content')).toBeInTheDocument()
  })

  test('hides section content when collapsed', () => {
    render(<SettingsSection {...defaultProps} isExpanded={false} />)
    
    // When explicitly set to collapsed, content should be hidden
    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument()
  })

  test('toggles section visibility when header is clicked', async () => {
    render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    
    // Initially expanded (default behavior)
    expect(screen.getByTestId('section-content')).toBeInTheDocument()
    
    // Click to collapse
    fireEvent.click(header)
    
    await waitFor(() => {
      expect(screen.queryByTestId('section-content')).not.toBeInTheDocument()
    })
    
    // Click to expand again
    fireEvent.click(header)
    
    await waitFor(() => {
      expect(screen.getByTestId('section-content')).toBeInTheDocument()
    })
  })

  test('displays expand/collapse icon', () => {
    render(<SettingsSection {...defaultProps} />)
    
    const chevronIcon = screen.getByRole('button', { name: /test section/i }).querySelector('svg[class*="chevron"]')
    expect(chevronIcon).toBeInTheDocument()
  })

  test('updates icon when section is toggled', async () => {
    render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    const chevronIcon = header.querySelector('svg[class*="chevron"]')
    
    // Initially expanded - should be rotated
    expect(chevronIcon).toHaveClass('rotate-180')
    
    // Click to collapse
    fireEvent.click(header)
    
    await waitFor(() => {
      expect(chevronIcon).not.toHaveClass('rotate-180')
    })
  })

  test('handles keyboard navigation', () => {
    render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    
    // Test Enter key to collapse
    fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' })
    
    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument()
    
    // Test Space key to expand
    fireEvent.keyDown(header, { key: ' ', code: 'Space' })
    
    expect(screen.getByTestId('section-content')).toBeInTheDocument()
  })

  test('applies custom className when provided', () => {
    render(<SettingsSection {...defaultProps} className="custom-class" />)
    
    const section = screen.getByRole('region')
    expect(section).toHaveClass('custom-class')
  })

  test('applies disabled state correctly', () => {
    render(<SettingsSection {...defaultProps} disabled={true} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    expect(header).toBeDisabled()
  })

  test('shows loading state when provided', () => {
    render(<SettingsSection {...defaultProps} validationStatus="loading" />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('displays error state when provided', () => {
    render(<SettingsSection {...defaultProps} validationStatus="invalid" validationMessage="Section error" />)
    
    expect(screen.getByText('Section error')).toBeInTheDocument()
  })

  test('handles multiple children correctly', () => {
    render(
      <SettingsSection {...defaultProps}>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </SettingsSection>
    )
    
    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })

  test('maintains focus when toggling', async () => {
    render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    header.focus()
    
    fireEvent.click(header)
    
    await waitFor(() => {
      expect(header).toHaveFocus()
    })
  })

  test('applies proper ARIA attributes', () => {
    render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    const content = screen.getByTestId('section-content').closest('div[aria-hidden]')
    
    expect(header).toHaveAttribute('aria-expanded', 'true') // Initially expanded
    expect(header).toHaveAttribute('aria-controls')
    expect(content).toHaveAttribute('id')
  })

  test('updates ARIA attributes when toggled', async () => {
    render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    
    // Initially expanded
    expect(header).toHaveAttribute('aria-expanded', 'true')
    
    // Click to collapse
    fireEvent.click(header)
    
    await waitFor(() => {
      expect(header).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test('handles long section titles', () => {
    const longTitle = 'This is a very long section title that might wrap to multiple lines and should be handled gracefully by the component'
    render(<SettingsSection {...defaultProps} title={longTitle} />)
    
    expect(screen.getByText(longTitle)).toBeInTheDocument()
  })

  test('applies smooth transition animations', () => {
    render(<SettingsSection {...defaultProps} />)
    
    const content = screen.getByTestId('section-content').closest('div[aria-hidden]')
    expect(content).toHaveClass('transition-all', 'duration-300')
  })

  test('handles empty children gracefully', () => {
    render(<SettingsSection {...defaultProps} children={null} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    expect(header).toBeInTheDocument()
  })

  test('handles section with no title', () => {
    render(<SettingsSection {...defaultProps} title="" />)
    
    const header = screen.getByRole('button')
    expect(header).toBeInTheDocument()
  })

  test('applies proper spacing and padding', () => {
    render(<SettingsSection {...defaultProps} />)
    
    const section = screen.getByRole('region')
    expect(section).toHaveClass('border', 'rounded-lg')
  })

  test('handles section with custom icon', () => {
    const CustomIcon = () => <div data-testid="custom-icon">Icon</div>
    render(<SettingsSection {...defaultProps} icon={CustomIcon} />)
    
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  test('maintains state when parent re-renders', () => {
    const { rerender } = render(<SettingsSection {...defaultProps} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    
    // Collapse the section
    fireEvent.click(header)
    
    // Re-render with same props
    rerender(<SettingsSection {...defaultProps} />)
    
    // Should remain collapsed
    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument()
  })

  test('handles section with description', () => {
    render(<SettingsSection {...defaultProps} description="Section description" />)
    
    expect(screen.getByText('Section description')).toBeInTheDocument()
  })

  test('applies different styles for different states', () => {
    const { rerender } = render(<SettingsSection {...defaultProps} />)
    
    let header = screen.getByRole('button', { name: /test section/i })
    expect(header).toHaveClass('hover:bg-gray-50')
    
    // Test disabled state
    rerender(<SettingsSection {...defaultProps} disabled={true} />)
    header = screen.getByRole('button', { name: /test section/i })
    expect(header).toBeDisabled()
  })

  test('shows required indicator when required is true', () => {
    render(<SettingsSection {...defaultProps} required={true} />)
    
    const title = screen.getByText('Test Section')
    expect(title.parentElement).toHaveTextContent('*')
  })

  test('calls onToggle callback when provided', async () => {
    const onToggle = vi.fn()
    render(<SettingsSection {...defaultProps} isExpanded={true} onToggle={onToggle} />)
    
    const header = screen.getByRole('button', { name: /test section/i })
    fireEvent.click(header)
    
    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(false) // Should be false since it starts expanded
    })
  })

  test('handles controlled expansion', () => {
    const { rerender } = render(<SettingsSection {...defaultProps} isExpanded={true} />)
    
    expect(screen.getByTestId('section-content')).toBeInTheDocument()
    
    rerender(<SettingsSection {...defaultProps} isExpanded={false} />)
    
    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument()
  })

  test('shows validation status indicators', () => {
    const { rerender } = render(<SettingsSection {...defaultProps} validationStatus="valid" />)
    
    // Should show valid indicator
    expect(screen.getByLabelText('Section is valid')).toBeInTheDocument()
    
    rerender(<SettingsSection {...defaultProps} validationStatus="invalid" />)
    
    // Should show invalid indicator
    expect(screen.getByLabelText('Section has errors')).toBeInTheDocument()
  })

  test('handles help text and links', () => {
    render(
      <SettingsSection 
        {...defaultProps} 
        helpText="Help information" 
        helpLink="https://example.com" 
      />
    )
    
    expect(screen.getByText('Help information')).toBeInTheDocument()
    expect(screen.getByText('View documentation')).toBeInTheDocument()
  })
}) 