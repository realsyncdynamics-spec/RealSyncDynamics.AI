import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  errorMessage?: string;
  label?: string;
  helper?: string;
  isFullWidth?: boolean;
  placeholder?: string;
  searchable?: boolean;
  multiselect?: boolean;
  icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      size = 'md',
      error = false,
      errorMessage,
      label,
      helper,
      isFullWidth = false,
      placeholder = 'Select an option',
      searchable = false,
      multiselect = false,
      icon,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedValues, setSelectedValues] = useState<Set<string | number>>(new Set());
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const baseInputStyles = 'font-mono transition-colors focus:outline-none';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm h-8',
      md: 'px-4 py-2 text-base h-10',
      lg: 'px-5 py-3 text-lg h-12',
    };

    const variantStyles = `border border-titanium/30 bg-obsidian text-titanium placeholder:text-titanium/40 hover:border-titanium/50 focus:border-security-blue focus:ring-1 focus:ring-security-blue/30`;

    const errorStyles = error ? 'border-red-500 focus:border-red-600 focus:ring-red-500/30' : '';
    const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
    const fullWidthStyles = isFullWidth ? 'w-full' : '';

    const containerClasses = `flex flex-col gap-1 ${fullWidthStyles}`;

    const filteredOptions = searchTerm
      ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
      : options;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen && searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, searchable]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(filteredOptions.length - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleSelectOption(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    const handleSelectOption = (option: SelectOption) => {
      if (multiselect) {
        const newSelected = new Set(selectedValues);
        if (newSelected.has(option.value)) {
          newSelected.delete(option.value);
        } else {
          newSelected.add(option.value);
        }
        setSelectedValues(newSelected);
      } else {
        setSelectedValues(new Set([option.value]));
        setIsOpen(false);
      }
    };

    const selectedLabel = selectedValues.size === 0
      ? placeholder
      : selectedValues.size === 1
      ? options.find(o => o.value === Array.from(selectedValues)[0])?.label || placeholder
      : `${selectedValues.size} selected`;

    return (
      <div ref={containerRef} className={containerClasses}>
        {label && (
          <label className="text-sm font-semibold text-titanium">
            {label}
          </label>
        )}
        <div className="relative">
          <button
            className={`${baseInputStyles} ${variantStyles} ${sizeStyles[size]} ${errorStyles} ${disabledStyles} ${fullWidthStyles} flex items-center justify-between`}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            type="button"
          >
            <span>{selectedLabel}</span>
            {icon || (
              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </button>

          {isOpen && (
            <div className="absolute z-dropdown top-full left-0 right-0 mt-1 bg-obsidian border border-titanium/30 rounded shadow-lg">
              {searchable && (
                <div className="p-2 border-b border-titanium/20">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    className={`${baseInputStyles} w-full px-3 py-1.5 text-sm border border-titanium/30 bg-obsidian/50 text-titanium placeholder:text-titanium/40 focus:border-security-blue focus:ring-1 focus:ring-security-blue/30 rounded`}
                  />
                </div>
              )}
              <ul className="max-h-64 overflow-y-auto">
                {filteredOptions.map((option, index) => (
                  <li key={`${option.value}-${index}`}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-2.5 hover:bg-security-blue/20 transition-colors flex items-center gap-2 ${
                        highlightedIndex === index ? 'bg-security-blue/30' : ''
                      } ${selectedValues.has(option.value) ? 'bg-security-blue/10 text-security-blue' : 'text-titanium'}`}
                      onClick={() => handleSelectOption(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {multiselect && (
                        <input
                          type="checkbox"
                          checked={selectedValues.has(option.value)}
                          readOnly
                          className="w-4 h-4"
                        />
                      )}
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {error && errorMessage && (
          <span className="text-xs text-red-400">{errorMessage}</span>
        )}
        {!error && helper && (
          <span className="text-xs text-titanium/50">{helper}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
