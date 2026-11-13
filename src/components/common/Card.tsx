import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => {
  const hoverClass = hoverable
    ? 'cursor-pointer transition-colors duration-150 hover:border-slate-700 hover:bg-slate-900'
    : '';

  return (
    <div
      onClick={onClick}
      className={`bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-sm ${hoverClass} ${className}`}
    >
      {children}
    </div>
  );
};
