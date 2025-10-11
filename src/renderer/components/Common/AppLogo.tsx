import React from 'react';

import logoBannerUrl from '../../assets/logo-banner.svg';
import logoSquareUrl from '../../assets/logo-square.svg';

type AppLogoVariant = 'banner' | 'square';
type AppLogoSize = 'sm' | 'md' | 'lg';

interface AppLogoProps {
  variant?: AppLogoVariant;
  size?: AppLogoSize;
  className?: string;
  alt?: string;
  fit?: 'none' | 'width'; // width: fill container width with object-contain
}

const sizeToClass: Record<AppLogoSize, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12'
};

export const AppLogo: React.FC<AppLogoProps> = ({ variant = 'square', size = 'md', className = '', alt, fit = 'none' }) => {
  const src = variant === 'banner' ? logoBannerUrl : logoSquareUrl;
  const heightClass = sizeToClass[size] || sizeToClass.md;
  const fitClasses = fit === 'width' ? 'w-full h-auto object-contain' : '';
  const classes = [`select-none`, fit === 'width' ? '' : heightClass, fitClasses, className].filter(Boolean).join(' ');
  return (
    <img
      src={src}
      alt={alt || (variant === 'banner' ? 'Gen Image Factory Banner' : 'Gen Image Factory Logo')}
      className={classes}
      draggable={false}
    />
  );
};

export default AppLogo;


