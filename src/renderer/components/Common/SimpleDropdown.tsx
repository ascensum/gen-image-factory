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
        className={`${
          buttonClassName || 'text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[10rem] text-left'
        } relative pr-8`}
      >
        {selected?.label}
        {/* bold chevron to match other filters */}
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-700">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
          </svg>
        </span>
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


