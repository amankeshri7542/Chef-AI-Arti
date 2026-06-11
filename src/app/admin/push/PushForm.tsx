'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PushLogRow {
  id: string;
  title: string;
  body: string;
  target: string;
  sent_count: number;
  sent_at: string;
}

const fieldStyle = { background: '#1A1A2E', borderColor: '#0F3460', color: '#fff' };

export default function PushForm({ initialLogs }: { initialLogs: PushLogRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | 'free' | 'paid'>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Send "${title}" to ${target} users?`)) return;
    setSending(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, target }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ Sent to ${data.sent} user${data.sent === 1 ? '' : 's'}`);
        setTitle('');
        setBody('');
        router.refresh();
      } else {
        setResult(`❌ ${data.error ?? 'Send failed'}`);
      }
    } catch {
      setResult('❌ Network error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold">🔔 Push Notifications</h1>

      <form onSubmit={handleSend} className="mb-8 rounded-xl p-4" style={{ background: '#16213E' }}>
        <label className="mb-1 block text-xs font-medium uppercase" style={{ color: '#B8B8D0' }}>
          Title ({title.length}/50)
        </label>
        <input
          maxLength={50}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Aaj kya banao? 🍳"
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={fieldStyle}
        />

        <label className="mb-1 block text-xs font-medium uppercase" style={{ color: '#B8B8D0' }}>
          Message ({body.length}/200)
        </label>
        <textarea
          maxLength={200}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Aaj ki special recipe dekhi aapne?"
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={fieldStyle}
        />

        <p className="mb-2 text-xs font-medium uppercase" style={{ color: '#B8B8D0' }}>
          Target
        </p>
        <div className="mb-4 flex gap-4">
          {(['all', 'free', 'paid'] as const).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
              <input
                type="radio"
                name="target"
                checked={target === t}
                onChange={() => setTarget(t)}
              />
              {t} users
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-50"
          style={{ background: '#E8640C' }}
        >
          {sending ? 'Sending…' : '📤 Send Push'}
        </button>
        {result && <p className="mt-3 text-sm font-medium">{result}</p>}
      </form>

      <h2 className="mb-3 font-semibold">📜 Last 20 Sends</h2>
      <div className="overflow-x-auto rounded-xl" style={{ background: '#16213E' }}>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#B8B8D0' }}>
              <th className="p-3">Title</th>
              <th className="p-3">Target</th>
              <th className="p-3 text-right">Sent</th>
              <th className="p-3 text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {initialLogs.map((l) => (
              <tr key={l.id} className="border-t" style={{ borderColor: '#1A1A2E' }}>
                <td className="p-3">
                  <span className="font-medium">{l.title}</span>
                  <p className="text-xs" style={{ color: '#B8B8D0' }}>{l.body}</p>
                </td>
                <td className="p-3 capitalize" style={{ color: '#B8B8D0' }}>{l.target}</td>
                <td className="p-3 text-right">{l.sent_count}</td>
                <td className="p-3 text-right" style={{ color: '#B8B8D0' }}>
                  {new Date(l.sent_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
            {initialLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center" style={{ color: '#B8B8D0' }}>
                  No pushes sent yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
