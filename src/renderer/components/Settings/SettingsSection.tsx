import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, CheckCircle, AlertCircle, AlertTriangle, Loader2, ExternalLink, HelpCircle, Settings } from 'lucide-react';

// Types and Interfaces
interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  validationStatus?: 'valid' | 'invalid' | 'warning' | 'loading';
  validationMessage?: string;
  helpText?: string;
  helpLink?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

type ValidationStatus = 'valid' | 'invalid' | 'warning' | 'loading';

interface ValidationConfig {
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: string;
  ariaLabel: string;
}

// Validation status configuration
const VALIDATION_CONFIGS: Record<ValidationStatus, ValidationConfig> = {
  valid: {
    icon: CheckCircle,
    colorClasses: 'text-green-500',
    ariaLabel: 'Section is valid'
  },
  invalid: {
    icon: AlertCircle,
    colorClasses: 'text-red-500',
    ariaLabel: 'Section has errors'
  },
  warning: {
    icon: AlertTriangle,
    colorClasses: 'text-yellow-500',
    ariaLabel: 'Section has warnings'
  },
  loading: {
    icon: Loader2,
    colorClasses: 'text-blue-500 animate-spin',
    ariaLabel: 'Section is loading'
  }
};

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  isExpanded: controlledExpanded,
  onToggle,
  validationStatus,
  validationMessage,
  helpText,
  helpLink,
  icon: IconComponent = Settings,
  className = '',
  disabled = false,
  required = false
}) => {
  // State management
  const [internalExpanded, setInternalExpanded] = useState(true); // Start expanded by default
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Determine if component is controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Calculate content height for smooth animations
  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
    }
  }, [children, isExpanded]);

  // Handle expand/collapse animation
  useEffect(() => {
    if (isExpanded) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Toggle section expansion
  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newExpanded = !isExpanded;
    
    if (isControlled) {
      onToggle?.(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }

    // Announce state change to screen readers
    const announcement = newExpanded ? `${title} section expanded` : `${title} section collapsed`;
    announceToScreenReader(announcement);
  }, [disabled, isExpanded, isControlled, onToggle, title]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  // Handle help link click
  const handleHelpLinkClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (helpLink && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(helpLink);
    }
  }, [helpLink]);

  // Announce to screen readers
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Get header styling based on state
  const getHeaderStyling = () => {
    const baseClasses = 'w-full px-4 py-3 flex items-center justify-between text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset';
    
    if (disabled) {
      return `${baseClasses} cursor-not-allowed opacity-50`;
    }

    if (validationStatus === 'invalid') {
      return `${baseClasses} hover:bg-red-50 focus:bg-red-50`;
    }

    if (validationStatus === 'warning') {
      return `${baseClasses} hover:bg-yellow-50 focus:bg-yellow-50`;
    }

    return `${baseClasses} hover:bg-gray-50 focus:bg-gray-50`;
  };

  // Get section border styling based on validation status
  const getSectionStyling = () => {
    const baseClasses = 'border rounded-lg transition-colors';
    
    if (validationStatus === 'invalid') {
      return `${baseClasses} border-red-200 bg-red-50/30`;
    }

    if (validationStatus === 'warning') {
      return `${baseClasses} border-yellow-200 bg-yellow-50/30`;
    }

    if (validationStatus === 'valid') {
      return `${baseClasses} border-green-200 bg-green-50/30`;
    }

    return `${baseClasses} border-gray-200 bg-white`;
  };

  // Validation Status Component
  const ValidationStatusIndicator = () => {
    if (!validationStatus) return null;

    const config = VALIDATION_CONFIGS[validationStatus];
    const StatusIcon = config.icon;

    return (
      <div className="flex items-center gap-1">
        <StatusIcon 
          className={`w-4 h-4 ${config.colorClasses}`}
          aria-label={config.ariaLabel}
        />
        {validationMessage && (
          <span className={`text-xs ${
            validationStatus === 'invalid' ? 'text-red-600' :
            validationStatus === 'warning' ? 'text-yellow-600' :
            validationStatus === 'valid' ? 'text-green-600' :
            'text-blue-600'
          }`}>
            {validationMessage}
          </span>
        )}
      </div>
    );
  };

  // Help Text Component
  const HelpTextSection = () => {
    if (!helpText && !helpLink) return null;

    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        {helpText && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <HelpCircle className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
            <p>{helpText}</p>
          </div>
        )}
        
        {helpLink && (
          <button
            onClick={handleHelpLinkClick}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View documentation
          </button>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={sectionRef}
      className={`${getSectionStyling()} ${className}`}
      role="region"
      aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={getHeaderStyling()}
        disabled={disabled}
        aria-expanded={isExpanded}
        aria-controls={`section-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Section Icon */}
          <IconComponent className="w-5 h-5 text-gray-600 flex-shrink-0" />
          
          {/* Title and Status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {title}
                {required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              <ValidationStatusIndicator />
            </div>
            
            {description && (
              <p className="text-sm text-gray-600 mt-1 text-left">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Chevron Icon */}
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div
          id={`section-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            height: contentHeight,
            opacity: 1
          }}
          aria-hidden={false}
        >
          <div 
            ref={contentRef}
            className="px-4 pb-4"
          >
            {/* Main Content */}
            <div className="space-y-4">
              {children}
            </div>

            {/* Help Text Section */}
            <HelpTextSection />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {validationStatus === 'loading' && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility component for grouping multiple sections
export const SettingsSectionGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}> = ({ children, className = '', title, description }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
          {description && (
            <p className="text-gray-600">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

// Hook for managing multiple section states
export const useSettingsSections = (initialStates: Record<string, boolean> = {}) => {
  const [sectionStates, setSectionStates] = useState(initialStates);

  const toggleSection = useCallback((sectionId: string) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }, []);

  const expandAll = useCallback(() => {
    setSectionStates(prev => 
      Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );
  }, []);

  const collapseAll = useCallback(() => {
    setSectionStates(prev => 
      Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {})
    );
  }, []);

  const setSectionState = useCallback((sectionId: string, expanded: boolean) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionId]: expanded
    }));
  }, []);

  return {
    sectionStates,
    toggleSection,
    expandAll,
    collapseAll,
    setSectionState
  };
};

// Note: Electron API types are declared centrally in src/types/ipc.d.ts