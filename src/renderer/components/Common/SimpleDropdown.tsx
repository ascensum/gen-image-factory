import React from 'react';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
}

interface SimpleDropdownProps<T = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  buttonClassName?: string;
  menuWidthClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const SimpleDropdown = <T extends string | number = string>({
  options,
  value,
  onChange,
  buttonClassName,
  menuWidthClassName,
  ariaLabel,
  disabled,
}: SimpleDropdownProps<T>) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const selected = React.useMemo(() => options.find(o => String(o.value) === String(value)) || options[0], [options, value]);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        className={
          buttonClassName || 'text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[10rem] text-left'
        }
      >
        {selected?.label}
      </button>
      {open && (
        <div className={`absolute z-30 mt-2 ${menuWidthClassName || 'w-[12rem]'} bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden`}>
          <ul role="listbox" className="py-1">
            {options.map(opt => (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={String(value) === String(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${String(value) === String(opt.value) ? 'bg-gray-100' : ''}`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SimpleDropdown;


