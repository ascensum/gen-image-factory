import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ 
  checked, 
  onChange, 
  disabled = false,
  className = '',
  ariaLabel
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: checked ? '#2563eb' : '#e5e7eb',
        transition: 'background-color 0.2s ease-in-out',
        opacity: disabled ? 0.5 : 1,
        outline: 'none'
      }}
      className={className}
    >
      <span
        style={{
          position: 'absolute',
          left: checked ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'white',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.2s ease-in-out',
          transform: `translateX(${checked ? '0' : '0'})`
        }}
      />
    </button>
  );
}; 