import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, Zap, AlertTriangle, Ban, HelpCircle, Info, ExternalLink } from 'lucide-react';

// Types and Interfaces
interface CostIndicatorProps {
  costLevel: 'free' | 'low' | 'medium' | 'high' | 'unknown';
  estimatedCost?: string;
  costDescription?: string;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
  className?: string;
  feature?: string;
  usageEstimate?: string;
  pricingUrl?: string;
}

type CostLevel = 'free' | 'low' | 'medium' | 'high' | 'unknown';

interface CostConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: string;
  description: string;
}

// Cost level configuration
const COST_CONFIGS: Record<CostLevel, CostConfig> = {
  free: {
    label: 'Free',
    icon: Ban,
    colorClasses: 'bg-green-100 text-green-800 border-green-200',
    description: 'No additional cost for this feature'
  },
  low: {
    label: 'Low Cost',
    icon: DollarSign,
    colorClasses: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Minimal cost, typically under $0.01 per use'
  },
  medium: {
    label: 'Medium Cost',
    icon: Zap,
    colorClasses: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    description: 'Moderate cost, typically $0.01-$0.10 per use'
  },
  high: {
    label: 'High Cost',
    icon: AlertTriangle,
    colorClasses: 'bg-red-100 text-red-800 border-red-200',
    description: 'Significant cost, typically over $0.10 per use'
  },
  unknown: {
    label: 'Cost Unavailable',
    icon: HelpCircle,
    colorClasses: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'Cost information not available from API provider'
  }
};

// Size configuration
const SIZE_CONFIGS = {
  small: {
    badgeClasses: 'px-2 py-0.5 text-xs',
    iconClasses: 'w-3 h-3',
    infoIconClasses: 'w-3 h-3',
    tooltipClasses: 'text-xs max-w-xs'
  },
  medium: {
    badgeClasses: 'px-2.5 py-1 text-sm',
    iconClasses: 'w-4 h-4',
    infoIconClasses: 'w-4 h-4',
    tooltipClasses: 'text-sm max-w-sm'
  },
  large: {
    badgeClasses: 'px-3 py-1.5 text-base',
    iconClasses: 'w-5 h-5',
    infoIconClasses: 'w-5 h-5',
    tooltipClasses: 'text-base max-w-md'
  }
};

export const CostIndicator: React.FC<CostIndicatorProps> = ({
  costLevel,
  estimatedCost,
  costDescription,
  size = 'medium',
  showTooltip = true,
  className = '',
  feature,
  usageEstimate,
  pricingUrl
}) => {
  // State management
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Get configuration for current cost level and size
  const costConfig = COST_CONFIGS[costLevel] || COST_CONFIGS.unknown;
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.medium;

  // Calculate tooltip position based on viewport
  useEffect(() => {
    if (isTooltipVisible && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      
      // Show tooltip below if there's more space below, otherwise above
      setTooltipPosition(spaceBelow > spaceAbove ? 'bottom' : 'top');
    }
  }, [isTooltipVisible]);

  // Handle tooltip visibility
  const handleMouseEnter = () => {
    if (showTooltip) {
      setIsTooltipVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsTooltipVisible(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsTooltipVisible(!isTooltipVisible);
    } else if (event.key === 'Escape') {
      setIsTooltipVisible(false);
    }
  };

  // Handle external link click
  const handlePricingClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (pricingUrl && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(pricingUrl);
    }
  };

  // Get tooltip content
  const getTooltipContent = () => {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <costConfig.icon className={`${sizeConfig.iconClasses} ${costLevel === 'free' ? 'text-green-600' : costLevel === 'low' ? 'text-blue-600' : costLevel === 'medium' ? 'text-yellow-600' : costLevel === 'high' ? 'text-red-600' : 'text-gray-600'}`} />
          <h4 className="font-semibold text-gray-900">{costConfig.label}</h4>
        </div>
        
        <p className="text-gray-700">
          {costDescription || costConfig.description}
        </p>
        
        {feature && (
          <div className="text-gray-600">
            <span className="font-medium">Feature:</span> {feature}
          </div>
        )}
        
        {estimatedCost && (
          <div className="text-gray-600">
            <span className="font-medium">Estimated Cost:</span> {estimatedCost}
          </div>
        )}
        
        {usageEstimate && (
          <div className="text-gray-600">
            <span className="font-medium">Usage Estimate:</span> {usageEstimate}
          </div>
        )}
        
        {costLevel !== 'free' && costLevel !== 'unknown' && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Costs may vary based on usage patterns and API pricing changes.
            </p>
          </div>
        )}
        
        {pricingUrl && (
          <button
            onClick={handlePricingClick}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View detailed pricing
          </button>
        )}
      </div>
    );
  };

  // Get tooltip positioning classes
  const getTooltipClasses = () => {
    const baseClasses = `absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 ${sizeConfig.tooltipClasses}`;
    
    if (tooltipPosition === 'bottom') {
      return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
    } else {
      return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  // Get arrow classes for tooltip
  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 bg-white border transform rotate-45';
    
    if (tooltipPosition === 'bottom') {
      return `${baseClasses} -top-1 left-1/2 -translate-x-1/2 border-b-0 border-r-0`;
    } else {
      return `${baseClasses} -bottom-1 left-1/2 -translate-x-1/2 border-t-0 border-l-0`;
    }
  };

  const CostIcon = costConfig.icon;

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cost Badge */}
      <span 
        className={`inline-flex items-center gap-1 rounded-full font-medium border transition-colors ${costConfig.colorClasses} ${sizeConfig.badgeClasses}`}
        role="status"
        aria-label={`Cost level: ${costConfig.label}${estimatedCost ? `, estimated cost: ${estimatedCost}` : ''}`}
      >
        <CostIcon className={sizeConfig.iconClasses} />
        {costConfig.label}
      </span>

      {/* Info Button */}
      {showTooltip && (
        <button
          type="button"
          onClick={() => setIsTooltipVisible(!isTooltipVisible)}
          onKeyDown={handleKeyDown}
          className="text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-colors"
          aria-label="Show cost details"
          aria-expanded={isTooltipVisible}
          aria-describedby={isTooltipVisible ? 'cost-tooltip' : undefined}
        >
          <Info className={sizeConfig.infoIconClasses} />
        </button>
      )}

      {/* Tooltip */}
      {isTooltipVisible && showTooltip && (
        <div
          ref={tooltipRef}
          id="cost-tooltip"
          className={getTooltipClasses()}
          role="tooltip"
          aria-live="polite"
        >
          {/* Tooltip Arrow */}
          <div className={getArrowClasses()} />
          
          {/* Tooltip Content */}
          {getTooltipContent()}
        </div>
      )}
    </div>
  );
};

// Utility function to get cost level from estimated cost string
export const getCostLevelFromEstimate = (estimatedCost: string): CostLevel => {
  if (!estimatedCost || estimatedCost.toLowerCase().includes('free')) {
    return 'free';
  }
  
  // Extract numeric value from cost string
  const numericValue = parseFloat(estimatedCost.replace(/[^0-9.]/g, ''));
  
  if (isNaN(numericValue)) {
    return 'unknown';
  }
  
  if (numericValue === 0) {
    return 'free';
  } else if (numericValue < 0.01) {
    return 'low';
  } else if (numericValue < 0.10) {
    return 'medium';
  } else {
    return 'high';
  }
};

// Utility function to format cost for display
export const formatCost = (cost: number, currency: string = 'USD'): string => {
  if (cost === 0) {
    return 'Free';
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: cost < 0.01 ? 4 : 2,
    maximumFractionDigits: cost < 0.01 ? 4 : 2
  });
  
  return formatter.format(cost);
};

// Electron API types are declared centrally in src/types/ipc.d.ts