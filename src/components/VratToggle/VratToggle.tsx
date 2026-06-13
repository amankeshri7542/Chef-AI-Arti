'use client';

import Icon from '@/components/editorial/Icon';

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
      aria-pressed={isVrat}
      className="tap-spring disabled:opacity-70"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minHeight: 48,
        padding: '0 14px',
        borderRadius: 999,
        background: isVrat ? 'var(--green)' : 'var(--card)',
        border: `1.5px solid ${isVrat ? 'var(--green)' : 'var(--border)'}`,
        color: isVrat ? '#fff' : 'var(--muted)',
        fontSize: 14,
        fontWeight: 600,
        transition: 'all 0.25s ease',
      }}
    >
      <Icon name="om" size={17} sw={1.9} color={isVrat ? '#fff' : 'var(--muted)'} /> Vrat
      {loading ? (
        <span
          className="animate-spin rounded-full border-2"
          style={{
            width: 14,
            height: 14,
            borderColor: isVrat ? 'rgba(255,255,255,0.3)' : 'rgba(128,98,68,0.3)',
            borderTopColor: isVrat ? '#fff' : 'var(--muted)',
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{ width: 30, height: 17, borderRadius: 99, background: isVrat ? 'rgba(255,255,255,0.35)' : 'var(--border)', position: 'relative', transition: 'background 0.25s' }}
        >
          <span style={{ position: 'absolute', top: 2, left: isVrat ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left 0.25s cubic-bezier(0.34, 1.4, 0.5, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
        </span>
      )}
    </button>
  );
}
