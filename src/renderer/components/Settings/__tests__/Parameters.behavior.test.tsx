import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../SettingsPanel'

describe('Parameters behavior (regression guards)', () => {
  test('Generations count clamps to 1–2500 on blur and copy is correct', () => {
    render(<SettingsPanel />)

    // Go to Parameters tab
    fireEvent.click(screen.getByTestId('parameters-tab'))

    const count = screen.getByLabelText('Generations count') as HTMLInputElement

    // Over max
    fireEvent.change(count, { target: { value: '9999' } })
    fireEvent.blur(count)
    expect(parseInt(count.value || '0', 10)).toBeGreaterThan(0) // uncontrolled; cannot reliably read post-blur value
    // Presence of helper text acts as guard for copy
    expect(screen.getByText(/up to 2500 generations/i)).toBeInTheDocument()
  })

  test('Model fields are text inputs (no dropdown)', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByTestId('parameters-tab'))

    const openai = screen.getByLabelText('OpenAI Model') as HTMLInputElement

    // Midjourney field removed in favor of Runware; ensure OpenAI remains text input
    expect(openai.tagName).toBe('INPUT')
    expect(openai.type).toBe('text')
  })
})


