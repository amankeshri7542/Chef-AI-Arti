interface VibeBadgesProps {
  vibes: string[];
}

export default function VibeBadges({ vibes }: VibeBadgesProps) {
  const displayVibes = vibes.slice(0, 3);

  return (
    <div className="flex flex-wrap gap-1">
      {displayVibes.map((vibe) => (
        <span
          key={vibe}
          className="rounded-full px-2 py-0.5 text-[8px]"
          style={{ backgroundColor: '#FDE8D8', color: '#BF4E06' }}
        >
          {vibe}
        </span>
      ))}
    </div>
  );
}
