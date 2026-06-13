// SectionHead.tsx — editorial section header: overline + Playfair title +
// optional action link. Plus a spice-dot Divider. Session-39.

import type { CSSProperties, ReactNode } from 'react';
import Icon from './Icon';

export function SectionHead({
  over,
  title,
  action,
  onAction,
  style,
}: {
  over?: string;
  title: ReactNode;
  action?: string;
  onAction?: () => void;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, ...style }}>
      <div style={{ minWidth: 0 }}>
        {over && <div className="t-overline" style={{ marginBottom: 3 }}>{over}</div>}
        <h2 className="t-display" style={{ fontSize: 21, margin: 0, color: 'var(--text)' }}>{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="tap-spring"
          style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 48, padding: '0 4px', color: 'var(--hero-dk)', fontSize: 13.5, fontWeight: 600, flexShrink: 0, background: 'none', border: 'none' }}
        >
          {action} <Icon name="chevR" size={16} />
        </button>
      )}
    </div>
  );
}

export function Divider({ style }: { style?: CSSProperties }) {
  return (
    <div className="r-div" style={style} aria-hidden="true">
      <span className="dots"><i /><i /><i /></span>
    </div>
  );
}
