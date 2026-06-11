'use client';

import { useState, useRef } from 'react';

export interface AdminPhotoRow {
  id: string;
  s3_url: string;
  created_at: string;
  recipe_name: string;
}

export default function PhotosGrid({
  initialPhotos,
  recipes,
}: {
  initialPhotos: AdminPhotoRow[];
  recipes: { id: string; name_hinglish: string }[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadRecipeId, setUploadRecipeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadRecipeId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file, file.name);
      const res = await fetch(`/api/admin/recipes/${uploadRecipeId}/photo`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        const name =
          recipes.find((r) => r.id === uploadRecipeId)?.name_hinglish ?? 'Unknown recipe';
        setPhotos((prev) => [
          {
            id: data.photo.id,
            s3_url: data.photo.s3_url,
            created_at: data.photo.created_at,
            recipe_name: name,
          },
          ...prev,
        ]);
      } else {
        window.alert(data.error ?? 'Upload failed');
      }
    } catch {
      window.alert('Upload failed');
    } finally {
      setUploading(false);
    }
  }

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

      {/* Admin upload — users can no longer upload from the app */}
      <div
        className="mb-6 flex flex-wrap items-center gap-3 rounded-xl p-4"
        style={{ background: '#16213E' }}
      >
        <select
          value={uploadRecipeId}
          onChange={(e) => setUploadRecipeId(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: '#1A1A2E', color: '#fff', border: '1px solid #2A2A4E' }}
        >
          <option value="">Select recipe…</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name_hinglish}
            </option>
          ))}
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!uploadRecipeId || uploading}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#E8640C' }}
        >
          {uploading ? 'Uploading…' : '⬆️ Upload Photo for Recipe'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

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
