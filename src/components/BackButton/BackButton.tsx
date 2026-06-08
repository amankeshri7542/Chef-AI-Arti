'use client';

import { useBackNavigation } from '@/hooks/useBackNavigation';

interface BackButtonProps {
  fallback?: string;
  variant?: 'arrow' | 'x';
  onClick?: () => void;
  className?: string;
}

export default function BackButton({
  fallback = '/home',
  variant = 'arrow',
  onClick,
  className = '',
}: BackButtonProps) {
  const goBack = useBackNavigation(fallback);
  const handleClick = onClick ?? goBack;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={variant === 'arrow' ? 'Wapas jao' : 'Band karo'}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-[18px] transition-opacity active:opacity-70 ${className}`}
      style={{ minHeight: 48, minWidth: 48 }}
    >
      {variant === 'arrow' ? '←' : '✕'}
    </button>
  );
}
