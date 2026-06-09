'use client';

interface ArtiLoaderProps {
  /** Hinglish line shown under the pot. Defaults to "Arti soch rahi hai". */
  message?: string;
  /** Pot emoji size in px. */
  size?: number;
  className?: string;
}

/**
 * Warm, on-brand loader: a gently stirring pot + bouncing dots.
 * Replaces plain border spinners across the app.
 */
export default function ArtiLoader({
  message = 'Arti soch rahi hai',
  size = 40,
  className = '',
}: ArtiLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <span className="animate-pot-stir" style={{ fontSize: size, lineHeight: 1 }}>
        🍲
      </span>
      <p className="flex items-center gap-1 text-[12px] font-medium text-[#8B7355]">
        {message}
        <span className="flex gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-dot inline-block rounded-full"
              style={{
                width: 4,
                height: 4,
                background: '#E8640C',
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </span>
      </p>
    </div>
  );
}
