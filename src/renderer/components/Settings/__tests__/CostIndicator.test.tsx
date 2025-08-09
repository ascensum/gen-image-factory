import { render, screen, fireEvent } from '@testing-library/react'
import { CostIndicator } from '../CostIndicator'

describe('CostIndicator', () => {
  const defaultProps = {
    costLevel: 'unknown' as const, // Default to unknown since most APIs don't provide cost
    size: 'medium' as const,
  }

  test('renders cost indicator with default props', () => {
    render(<CostIndicator {...defaultProps} />)
    
    expect(screen.getByText('Cost Unavailable')).toBeInTheDocument()
  })

  test('displays cost with different cost levels', () => {
    const { rerender } = render(<CostIndicator {...defaultProps} costLevel="free" />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="low" />)
    expect(screen.getByText('Low Cost')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="medium" />)
    expect(screen.getByText('Medium Cost')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="high" />)
    expect(screen.getByText('High Cost')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="unknown" />)
    expect(screen.getByText('Cost Unavailable')).toBeInTheDocument()
  })

  test('applies correct size classes', () => {
    const { rerender } = render(<CostIndicator {...defaultProps} size="small" />)
    
    const badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('text-xs')
    
    rerender(<CostIndicator {...defaultProps} size="medium" />)
    expect(badge).toHaveClass('text-sm')
    
    rerender(<CostIndicator {...defaultProps} size="large" />)
    expect(badge).toHaveClass('text-base')
  })

  test('applies correct color based on cost level', () => {
    const { rerender } = render(<CostIndicator {...defaultProps} costLevel="free" />)
    
    let badge = screen.getByText('Free')
    expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    
    rerender(<CostIndicator {...defaultProps} costLevel="low" />)
    badge = screen.getByText('Low Cost')
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
    
    rerender(<CostIndicator {...defaultProps} costLevel="medium" />)
    badge = screen.getByText('Medium Cost')
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    
    rerender(<CostIndicator {...defaultProps} costLevel="high" />)
    badge = screen.getByText('High Cost')
    expect(badge).toHaveClass('bg-red-100', 'text-red-800')
    
    rerender(<CostIndicator {...defaultProps} costLevel="unknown" />)
    badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800')
  })

  test('displays estimated cost in tooltip when provided by API', () => {
    render(<CostIndicator {...defaultProps} estimatedCost="$0.05" />)
    
    const infoButton = screen.getByRole('button', { name: /show cost details/i })
    expect(infoButton).toBeInTheDocument()
  })

  test('handles missing estimated cost gracefully', () => {
    render(<CostIndicator {...defaultProps} estimatedCost={undefined} />)
    
    expect(screen.getByText('Cost Unavailable')).toBeInTheDocument()
  })

  test('applies custom className when provided', () => {
    render(<CostIndicator {...defaultProps} className="custom-class" />)
    
    const container = screen.getByText('Cost Unavailable').closest('div')
    expect(container).toHaveClass('custom-class')
  })

  test('shows tooltip when showTooltip is true', () => {
    render(<CostIndicator {...defaultProps} showTooltip={true} />)
    
    const infoButton = screen.getByRole('button', { name: /show cost details/i })
    expect(infoButton).toBeInTheDocument()
  })

  test('hides tooltip when showTooltip is false', () => {
    render(<CostIndicator {...defaultProps} showTooltip={false} />)
    
    const infoButton = screen.queryByRole('button', { name: /show cost details/i })
    expect(infoButton).not.toBeInTheDocument()
  })

  test('applies different color schemes for different cost levels', () => {
    const { rerender } = render(<CostIndicator {...defaultProps} costLevel="free" />)
    
    // Free - green
    let badge = screen.getByText('Free')
    expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    
    // Low - blue
    rerender(<CostIndicator {...defaultProps} costLevel="low" />)
    badge = screen.getByText('Low Cost')
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
    
    // Medium - yellow
    rerender(<CostIndicator {...defaultProps} costLevel="medium" />)
    badge = screen.getByText('Medium Cost')
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    
    // High - red
    rerender(<CostIndicator {...defaultProps} costLevel="high" />)
    badge = screen.getByText('High Cost')
    expect(badge).toHaveClass('bg-red-100', 'text-red-800')
    
    // Unknown - gray
    rerender(<CostIndicator {...defaultProps} costLevel="unknown" />)
    badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800')
  })

  test('applies correct padding based on size', () => {
    const { rerender } = render(<CostIndicator {...defaultProps} size="small" />)
    
    let badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('px-2', 'py-0.5')
    
    rerender(<CostIndicator {...defaultProps} size="medium" />)
    badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('px-2.5', 'py-1')
    
    rerender(<CostIndicator {...defaultProps} size="large" />)
    badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('px-3', 'py-1.5')
  })

  test('applies rounded corners', () => {
    render(<CostIndicator {...defaultProps} />)
    
    const badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('rounded-full')
  })

  test('applies font weight', () => {
    render(<CostIndicator {...defaultProps} />)
    
    const badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveClass('font-medium')
  })

  test('handles undefined cost level gracefully', () => {
    render(<CostIndicator {...defaultProps} costLevel={undefined as any} />)
    
    expect(screen.getByText('Cost Unavailable')).toBeInTheDocument()
  })

  test('handles null cost level gracefully', () => {
    render(<CostIndicator {...defaultProps} costLevel={null as any} />)
    
    expect(screen.getByText('Cost Unavailable')).toBeInTheDocument()
  })

  test('applies inline display', () => {
    render(<CostIndicator {...defaultProps} />)
    
    const container = screen.getByText('Cost Unavailable').closest('div')
    expect(container).toHaveClass('inline-flex')
  })

  test('applies items center alignment', () => {
    render(<CostIndicator {...defaultProps} />)
    
    const container = screen.getByText('Cost Unavailable').closest('div')
    expect(container).toHaveClass('items-center')
  })

  test('applies gap spacing', () => {
    render(<CostIndicator {...defaultProps} />)
    
    const container = screen.getByText('Cost Unavailable').closest('div')
    expect(container).toHaveClass('gap-1')
  })

  test('displays feature information in tooltip when provided', () => {
    render(<CostIndicator {...defaultProps} feature="Image Generation" />)
    
    const infoButton = screen.getByRole('button', { name: /show cost details/i })
    fireEvent.click(infoButton)
    
    expect(screen.getByText(/Feature:/)).toBeInTheDocument()
    expect(screen.getByText(/Image Generation/)).toBeInTheDocument()
  })

  test('displays usage estimate in tooltip when provided', () => {
    render(<CostIndicator {...defaultProps} usageEstimate="~100 requests/month" />)
    
    const infoButton = screen.getByRole('button', { name: /show cost details/i })
    fireEvent.click(infoButton)
    
    expect(screen.getByText(/Usage Estimate:/)).toBeInTheDocument()
    expect(screen.getByText(/~100 requests\/month/)).toBeInTheDocument()
  })

  test('maintains accessibility with proper ARIA attributes', () => {
    render(<CostIndicator {...defaultProps} />)
    
    const badge = screen.getByText('Cost Unavailable')
    expect(badge).toHaveAttribute('role', 'status')
    expect(badge).toHaveAttribute('aria-label')
  })

  test('handles different cost thresholds correctly', () => {
    const { rerender } = render(<CostIndicator {...defaultProps} costLevel="low" />)
    expect(screen.getByText('Low Cost')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="medium" />)
    expect(screen.getByText('Medium Cost')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="high" />)
    expect(screen.getByText('High Cost')).toBeInTheDocument()
    
    rerender(<CostIndicator {...defaultProps} costLevel="free" />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  test('shows realistic cost information when API provides it', () => {
    // Mock scenario where OpenAI API returns cost information
    render(<CostIndicator 
      {...defaultProps} 
      costLevel="medium" 
      estimatedCost="$0.05 per request"
      feature="OpenAI API"
    />)
    
    expect(screen.getByText('Medium Cost')).toBeInTheDocument()
    
    const infoButton = screen.getByRole('button', { name: /show cost details/i })
    fireEvent.click(infoButton)
    
    expect(screen.getByText(/Feature:/)).toBeInTheDocument()
    expect(screen.getByText(/OpenAI API/)).toBeInTheDocument()
    expect(screen.getByText(/Estimated Cost:/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.05 per request/)).toBeInTheDocument()
  })

  test('shows unavailable when API does not provide cost info', () => {
    // Mock scenario where Remove.BG API doesn't provide cost information
    render(<CostIndicator 
      {...defaultProps} 
      costLevel="unknown"
      feature="Remove.BG API"
    />)
    
    expect(screen.getByText('Cost Unavailable')).toBeInTheDocument()
    
    const infoButton = screen.getByRole('button', { name: /show cost details/i })
    fireEvent.click(infoButton)
    
    expect(screen.getByText(/Feature:/)).toBeInTheDocument()
    expect(screen.getByText(/Remove\.BG API/)).toBeInTheDocument()
    expect(screen.getByText(/Cost information not available from API provider/)).toBeInTheDocument()
  })
}) 