import React from 'react';
import humanityBridgeLogo from '../assets/images/HumanityBridge Global Unity Logo.png';

interface BrandLogoProps {
  className: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>
      <img
        src={humanityBridgeLogo}
        alt="HumanityBridge official logo"
        className="block h-full w-full object-contain dark:drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]"
        decoding="async"
      />
    </span>
  );
}
