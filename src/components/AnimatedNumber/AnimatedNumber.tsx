'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** Decimal places to render. Default 0. */
  decimals?: number;
  /** Tween duration in ms. Default 450. */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Counts from the previous value to the new value with an ease-out curve.
 * Used for portion size + nutrition macros so changes feel alive.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 450,
  className,
  style,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {display.toFixed(decimals)}
    </span>
  );
}
