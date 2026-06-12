'use client';

import { useState } from 'react';

// ─── Interactive variant ─────────────────────────────────────────────────────

interface InteractiveProps {
  value: number;
  onChange: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function StarRatingInteractive({
  value,
  onChange,
  size = 'md',
  disabled = false,
}: InteractiveProps) {
  const [hovered, setHovered] = useState(0);
  const tapSize = size === 'lg' ? 48 : size === 'md' ? 44 : 36;
  const starSize = size === 'lg' ? 36 : size === 'md' ? 24 : 18;
  const active = hovered || value;

  return (
    <div className="flex items-center" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star} star`}
          className="flex items-center justify-center transition-transform active:scale-110 disabled:cursor-default"
          style={{ minWidth: tapSize, minHeight: tapSize }}
        >
          <span
            style={{
              fontSize: starSize,
              color: star <= active ? '#E8640C' : '#E8DDD0',
              lineHeight: 1,
            }}
          >
            {star <= active ? '★' : '☆'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Display variant ─────────────────────────────────────────────────────────

interface DisplayProps {
  avg_rating: number;
  rating_count: number;
  size?: 'sm' | 'md';
}

export function StarRatingDisplay({ avg_rating, rating_count, size = 'md' }: DisplayProps) {
  if (rating_count === 0) return null;

  const starSize = size === 'md' ? 16 : 12;
  const textSize = size === 'md' ? 13 : 11;
  const filled = Math.round(avg_rating * 2) / 2; // round to nearest 0.5

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center" style={{ gap: 1 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              fontSize: starSize,
              color: star <= filled ? '#E8640C' : '#E8DDD0',
              lineHeight: 1,
            }}
          >
            {star <= filled ? '★' : '☆'}
          </span>
        ))}
      </div>
      <span style={{ fontSize: textSize, color: '#806244' }}>
        {avg_rating.toFixed(1)} ({rating_count})
      </span>
    </div>
  );
}
