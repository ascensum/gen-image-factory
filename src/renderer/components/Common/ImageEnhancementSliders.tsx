import React from 'react';
import { formatSaturationDisplay, formatSharpeningDisplay } from '../../utils/formatProcessingDisplay';
import styles from './ImageEnhancementSliders.module.css';

export type ImageEnhancementSlidersVariant = 'settings' | 'dashboard' | 'jobs';

const labelClass: Record<ImageEnhancementSlidersVariant, string> = {
  settings: 'block text-sm font-medium text-gray-700 mb-2',
  dashboard: 'block text-sm font-medium text-gray-700 mb-2',
  jobs: 'block text-sm font-medium text-[var(--foreground)] mb-2',
};

const scaleRowClass: Record<ImageEnhancementSlidersVariant, string> = {
  settings: 'flex justify-between text-xs text-gray-500 mt-1',
  dashboard: 'flex justify-between text-xs text-gray-500 mt-1',
  jobs: 'flex justify-between text-xs text-[var(--muted-foreground)] mt-1',
};

export interface ImageEnhancementSlidersProps {
  variant?: ImageEnhancementSlidersVariant;
  sharpening: number;
  saturation: number;
  onSharpeningChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  /** When set, first slider block scrolls into view (e.g. batch retry modal). */
  sharpeningSectionRef?: React.RefObject<HTMLDivElement | null>;
  /** Disambiguate DOM ids when multiple instances may exist. */
  idSuffix?: string;
}

export function ImageEnhancementSliders({
  variant = 'settings',
  sharpening,
  saturation,
  onSharpeningChange,
  onSaturationChange,
  sharpeningSectionRef,
  idSuffix = '',
}: ImageEnhancementSlidersProps) {
  const suf = idSuffix ? `-${idSuffix}` : '';
  const sharpenId = `enhancement-sharpening${suf}`;
  const satId = `enhancement-saturation${suf}`;
  const lc = labelClass[variant];
  const sc = scaleRowClass[variant];

  return (
    <div className="space-y-4">
      <div ref={sharpeningSectionRef} className={sharpeningSectionRef ? 'scroll-mt-4' : undefined}>
        <label htmlFor={sharpenId} className={lc}>
          Sharpening (0-10)
        </label>
        <input
          id={sharpenId}
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={sharpening}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onSharpeningChange(v);
          }}
          className={styles.rangeSlider}
        />
        <div className={sc} aria-hidden>
          <span>0 (None)</span>
          <span>{formatSharpeningDisplay(sharpening)}</span>
          <span>10 (Maximum)</span>
        </div>
      </div>
      <div>
        <label htmlFor={satId} className={lc}>
          Saturation (0-2)
        </label>
        <input
          id={satId}
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={saturation}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onSaturationChange(v);
          }}
          className={styles.rangeSlider}
        />
        <div className={sc} aria-hidden>
          <span>0 (Grayscale)</span>
          <span>{formatSaturationDisplay(saturation)}</span>
          <span>2 (Vibrant)</span>
        </div>
      </div>
    </div>
  );
}
