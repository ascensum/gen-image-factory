import React from 'react';

import logoSquareUrl from '../../assets/logo-square.svg';

type AppLogoSize = 'sm' | 'md' | 'lg';

interface AppLogoProps {
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

export const AppLogo: React.FC<AppLogoProps> = ({ size = 'md', className = '', alt, fit = 'none' }) => {
  const src = logoSquareUrl;
  const heightClass = sizeToClass[size] || sizeToClass.md;
  const fitClasses = fit === 'width' ? 'w-full h-auto object-contain' : '';
  const classes = [`select-none`, fit === 'width' ? '' : heightClass, fitClasses, className].filter(Boolean).join(' ');
  return (
    <img
      src={src}
      alt={alt || 'Gen Image Factory Logo'}
      className={classes}
      draggable={false}
    />
  );
};

export default AppLogo;


