'use client';

import { useState } from 'react';

export interface PendingCardData {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  requestedBy: string;
  cookedCount: number;
  reportedCount: number;
  createdAt: string;
}

export default function PendingList({
  initialCards,
}: {
  initialCards: PendingCardData[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'reject') {
    const verb = action === 'approve' ? 'Approve & promote' : 'Reject';
    if (!window.confirm(`${verb} this recipe?`)) return;
    setBusy(id);
    const res = await fetch(`/api/admin/pending/${id}/${action}`, { method: 'POST' });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? `${verb} failed`);
    }
    setBusy(null);
  }

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">
        ⏳ Pending AI Recipes ({cards.length})
      </h1>

      {cards.length === 0 && (
        <p style={{ color: '#B8B8D0' }}>No pending recipes — sab clear! ✨</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <div key={c.id} className="rounded-xl p-4" style={{ background: '#16213E' }}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-semibold">✨ {c.name}</h2>
              <span className="shrink-0 text-xs" style={{ color: '#B8B8D0' }}>
                {new Date(c.createdAt).toLocaleDateString('en-IN')}
              </span>
            </div>
            <p className="mb-2 text-sm" style={{ color: '#B8B8D0' }}>
              Requested by <strong>{c.requestedBy}</strong> · 🍳 {c.cookedCount} cooks ·{' '}
              {c.reportedCount > 0 ? (
                <span className="font-semibold text-red-400">
                  ⚠️ {c.reportedCount} reports
                </span>
              ) : (
                '0 reports'
              )}
            </p>
            <p className="mb-3 text-sm">
              <span style={{ color: '#B8B8D0' }}>Ingredients: </span>
              {c.ingredients.slice(0, 6).join(', ')}
              {c.ingredients.length > 6 && ` +${c.ingredients.length - 6} more`}
            </p>

            {expanded === c.id && (
              <div className="mb-3 rounded-lg p-3 text-sm" style={{ background: '#1A1A2E' }}>
                {c.description && <p className="mb-2 italic">{c.description}</p>}
                <p className="mb-1 font-semibold">All ingredients:</p>
                <ul className="mb-2 list-inside list-disc" style={{ color: '#B8B8D0' }}>
                  {c.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
                <p className="mb-1 font-semibold">Steps:</p>
                <ol className="list-inside list-decimal space-y-1" style={{ color: '#B8B8D0' }}>
                  {c.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => act(c.id, 'approve')}
                disabled={busy === c.id}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#2D6A4F' }}
              >
                ✅ Approve
              </button>
              <button
                onClick={() => act(c.id, 'reject')}
                disabled={busy === c.id}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#8B2635' }}
              >
                ❌ Reject
              </button>
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="ml-auto rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: '#0F3460' }}
              >
                👁️ {expanded === c.id ? 'Hide' : 'Preview'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
