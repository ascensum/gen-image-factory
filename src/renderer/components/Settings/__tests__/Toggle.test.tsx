import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { Toggle } from '../Toggle';

describe('Toggle', () => {
  const defaultProps = {
    checked: false,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders toggle with correct initial state', () => {
    render(<Toggle {...defaultProps} />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('renders toggle as checked when checked prop is true', () => {
    render(<Toggle {...defaultProps} checked={true} />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('calls onChange when clicked', () => {
    const onChange = vi.fn();
    render(<Toggle {...defaultProps} onChange={onChange} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('calls onChange with false when clicked while checked', () => {
    const onChange = vi.fn();
    render(<Toggle {...defaultProps} checked={true} onChange={onChange} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('applies custom className', () => {
    render(<Toggle {...defaultProps} className="custom-class" />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('custom-class');
  });

  test('is disabled when disabled prop is true', () => {
    render(<Toggle {...defaultProps} disabled={true} />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });

  test('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle {...defaultProps} disabled={true} onChange={onChange} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    expect(onChange).not.toHaveBeenCalled();
  });

  test('has correct visual state when checked', () => {
    render(<Toggle {...defaultProps} checked={true} />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('has correct visual state when unchecked', () => {
    render(<Toggle {...defaultProps} checked={false} />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
}); 