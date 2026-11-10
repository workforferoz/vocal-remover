import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  glow?: 'purple' | 'blue' | 'none';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  glow = 'none',
}) => {
  let glowClass = '';
  if (glow === 'purple') glowClass = 'hover:shadow-[0_0_20px_-3px_rgba(115,87,245,0.3)]';
  if (glow === 'blue') glowClass = 'hover:shadow-[0_0_20px_-3px_rgba(57,132,255,0.3)]';

  const hoverClass = hoverable
    ? `cursor-pointer transition-all duration-200 hover:border-white/20 hover:bg-[#1A263C] ${glowClass}`
    : '';

  return (
    <div
      onClick={onClick}
      className={`bg-[#151F30] border border-white/10 rounded-2xl p-5 shadow-lg ${hoverClass} ${className}`}
    >
      {children}
    </div>
  );
};

