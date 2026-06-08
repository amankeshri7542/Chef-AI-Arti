'use client';
import { useState } from 'react';

const CATEGORIES = [
  { label: 'Sab', emoji: '✨', filter: null },
  { label: 'Sabzi', emoji: '🥗', filter: 'sabzi' },
  { label: 'Dal', emoji: '🫘', filter: 'dal' },
  { label: 'Chawal', emoji: '🍚', filter: 'chawal' },
  { label: 'Nashta', emoji: '🍳', filter: 'nashta' },
  { label: 'Vrat', emoji: '🕉️', filter: 'vrat' },
  { label: 'Meetha', emoji: '🍬', filter: 'meetha' },
];

interface Props { onFilter: (filter: string | null) => void }

export default function StoryCircles({ onFilter }: Props) {
  const [active, setActive] = useState<string | null>(null);

  function handleTap(filter: string | null) {
    const next = filter === active ? null : filter; // toggle off
    setActive(next);
    onFilter(next);
  }

  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-3 scrollbar-hide">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.filter;
        return (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleTap(cat.filter)}
            className="flex flex-shrink-0 flex-col items-center gap-1"
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{
                border: isActive ? '2.5px solid #E8640C' : '2px solid #E8DDD0',
                background: isActive ? '#FFF0E6' : '#FFFDF9',
              }}
            >
              {cat.emoji}
            </div>
            <span
              className="text-[9px] font-medium"
              style={{ color: isActive ? '#E8640C' : '#8B7355' }}
            >
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
