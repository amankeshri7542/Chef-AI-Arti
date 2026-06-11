'use client';

import { useState } from 'react';

export interface AdminPhotoRow {
  id: string;
  s3_url: string;
  created_at: string;
  recipe_name: string;
}

export default function PhotosGrid({
  initialPhotos,
}: {
  initialPhotos: AdminPhotoRow[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this photo? (DB row + S3 object)')) return;
    setBusy(id);
    const res = await fetch(`/api/admin/photos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } else {
      window.alert('Delete failed');
    }
    setBusy(null);
  }

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">
        📸 Community Photos ({photos.length})
      </h1>

      {photos.length === 0 && (
        <p style={{ color: '#B8B8D0' }}>No community photos yet</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl" style={{ background: '#16213E' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.s3_url}
              alt={p.recipe_name}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
            <div className="p-3">
              <p className="truncate text-sm font-medium">{p.recipe_name}</p>
              <p className="mb-2 text-xs" style={{ color: '#B8B8D0' }}>
                {new Date(p.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={busy === p.id}
                className="w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#8B2635' }}
              >
                {busy === p.id ? 'Deleting…' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
