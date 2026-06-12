'use client';

import { useRef, useState, useCallback } from 'react';
import { haptic } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Lightweight pull-to-refresh. Only engages when the page is scrolled to the
 * very top and the user drags downward, so it never fights normal scrolling.
 */
export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      armed.current = true;
    } else {
      armed.current = false;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!armed.current || startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    // Resistance curve
    const dist = Math.min(delta * 0.5, MAX_PULL);
    setPull(dist);
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!armed.current || refreshing) return;
    armed.current = false;
    startY.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      haptic('success');
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, refreshing, onRefresh]);

  const ready = pull >= THRESHOLD;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pull,
          transition: armed.current ? 'none' : 'height 0.25s ease-out',
        }}
      >
        <span
          className={refreshing ? 'animate-pot-stir' : ''}
          style={{
            fontSize: 26,
            opacity: Math.min(pull / THRESHOLD, 1),
            transform: refreshing ? 'none' : `rotate(${pull * 3}deg)`,
          }}
        >
          🍲
        </span>
        {ready && !refreshing && (
          <span className="ml-2 text-[12px] font-medium text-[#806244]">Chhodo refresh ke liye</span>
        )}
      </div>

      {children}
    </div>
  );
}
