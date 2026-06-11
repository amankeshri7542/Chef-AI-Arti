'use client';

import { Fragment, useMemo, useState } from 'react';

export interface AdminUserRow {
  id: string;
  name: string | null;
  diet_type: string;
  subscription_status: 'free' | 'paid';
  created_at: string;
  last_cooked_at: string | null;
}

interface HistoryRow {
  recipe_name: string;
  cooked_at: string;
  family_size: number;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UsersTable({
  initialUsers,
}: {
  initialUsers: AdminUserRow[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const list = users.filter(
      (u) => filter === 'all' || u.subscription_status === filter,
    );
    return [...list].sort((a, b) => {
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? d : -d;
    });
  }, [users, filter, sortAsc]);

  async function togglePremium(u: AdminUserRow) {
    const next = u.subscription_status === 'paid' ? 'free' : 'paid';
    if (!window.confirm(`Set ${u.name ?? 'this user'} to ${next}?`)) return;
    setBusy(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_status: next }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, subscription_status: next } : x)),
      );
    } else {
      window.alert('Update failed');
    }
    setBusy(null);
  }

  async function toggleHistory(userId: string) {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (!history[userId]) {
      const res = await fetch(`/api/admin/users/${userId}/history`);
      const data = await res.json();
      setHistory((prev) => ({ ...prev, [userId]: data.history ?? [] }));
    }
  }

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">👥 Users ({users.length})</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'free', 'paid'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full px-4 py-1.5 text-sm font-medium capitalize"
            style={{
              background: filter === f ? '#E8640C' : '#16213E',
              color: filter === f ? '#fff' : '#B8B8D0',
            }}
          >
            {f}
          </button>
        ))}
        <button
          onClick={() => setSortAsc((s) => !s)}
          className="ml-auto rounded-full px-4 py-1.5 text-sm"
          style={{ background: '#16213E', color: '#B8B8D0' }}
        >
          Joined {sortAsc ? '↑ oldest' : '↓ newest'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ background: '#16213E' }}>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#B8B8D0' }}>
              <th className="p-3">Name</th>
              <th className="p-3">Diet</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Last Cooked</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <Fragment key={u.id}>
                <tr className="border-t" style={{ borderColor: '#1A1A2E' }}>
                  <td className="p-3 font-medium">{u.name ?? '(no name)'}</td>
                  <td className="p-3" style={{ color: '#B8B8D0' }}>{u.diet_type}</td>
                  <td className="p-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: u.subscription_status === 'paid' ? '#2D6A4F' : '#0F3460',
                      }}
                    >
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="p-3" style={{ color: '#B8B8D0' }}>{fmtDate(u.created_at)}</td>
                  <td className="p-3" style={{ color: '#B8B8D0' }}>{fmtDate(u.last_cooked_at)}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => togglePremium(u)}
                      disabled={busy === u.id}
                      className="mr-3 font-medium disabled:opacity-50"
                      style={{ color: '#E8640C' }}
                    >
                      {u.subscription_status === 'paid' ? 'Make Free' : 'Make Paid'}
                    </button>
                    <button
                      onClick={() => toggleHistory(u.id)}
                      className="font-medium"
                      style={{ color: '#B8B8D0' }}
                    >
                      {expanded === u.id ? 'Hide ▲' : 'History ▼'}
                    </button>
                  </td>
                </tr>
                {expanded === u.id && (
                  <tr>
                    <td colSpan={6} className="p-3" style={{ background: '#1A1A2E' }}>
                      {!history[u.id] ? (
                        <p style={{ color: '#B8B8D0' }}>Loading…</p>
                      ) : history[u.id].length === 0 ? (
                        <p style={{ color: '#B8B8D0' }}>No cooking history yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {history[u.id].map((h, i) => (
                            <li key={i} className="flex justify-between text-sm">
                              <span>🍳 {h.recipe_name} (x{h.family_size})</span>
                              <span style={{ color: '#B8B8D0' }}>{fmtDate(h.cooked_at)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center" style={{ color: '#B8B8D0' }}>
                  No users match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
