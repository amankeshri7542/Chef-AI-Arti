'use client';

interface VratToggleProps {
  isVrat: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export default function VratToggle({ isVrat, onToggle, loading = false }: VratToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className="flex items-center justify-center rounded-full px-4 transition-colors duration-150 disabled:opacity-70"
      style={{
        minHeight: '48px',
        backgroundColor: isVrat ? '#2D6A4F' : '#E8DDD0',
        color: isVrat ? '#FFFFFF' : '#8B7355',
      }}
    >
      {loading ? (
        <span
          className="animate-spin rounded-full border-2"
          style={{
            width: 14,
            height: 14,
            borderColor: isVrat ? 'rgba(255,255,255,0.3)' : 'rgba(139,115,85,0.3)',
            borderTopColor: isVrat ? '#FFFFFF' : '#8B7355',
          }}
        />
      ) : (
        <span className="text-[13px] font-medium">
          {isVrat ? '🕉️ Vrat ON' : '🕉️ Vrat'}
        </span>
      )}
    </button>
  );
}
