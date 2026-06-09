'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';

interface Photo {
  id: string;
  s3_url: string;
  user_id: string;
  caption: string | null;
  created_at: string;
}

interface Props {
  recipeId: string;
  isAuthenticated: boolean;
  hasCooked: boolean;
}

export default function CommunityPhotos({ recipeId, isAuthenticated, hasCooked }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/recipes/${recipeId}/photos`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => {});
  }, [recipeId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);

    try {
      let toUpload: File | Blob = file;
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        toUpload = await imageCompression(file, { maxWidthOrHeight: 800, useWebWorker: true });
      } catch {
        // skip compression if unavailable
      }

      const fd = new FormData();
      fd.append('image', toUpload, file.name);
      const res = await fetch(`/api/recipes/${recipeId}/photos`, { method: 'POST', body: fd });

      if (res.ok) {
        const { photo } = await res.json();
        setPhotos((prev) => [photo, ...prev]);
        setUploadDone(true);
        toast.success('Photo add ho gayi! 📸');
        setTimeout(() => setUploadDone(false), 3000);
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Upload nahi hua. Dobara try karein.');
      }
    } catch {
      toast.error('Upload nahi hua. Dobara try karein.');
    } finally {
      setUploading(false);
    }
  }

  if (photos.length === 0 && !(isAuthenticated && hasCooked)) return null;

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] text-[#8B7355] font-medium">
            Logon ne banaya ❤️
            {photos.length > 0 && <span className="ml-1">({photos.length})</span>}
          </p>
          {isAuthenticated && hasCooked && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-medium text-[#E8640C] disabled:opacity-50"
            >
              {uploading ? 'Upload ho rahi hai...' : '📸 Apni photo add karo'}
            </button>
          )}
        </div>

        {uploadDone && (
          <p className="text-[11px] text-[#2D6A4F] mb-2">Photo add ho gayi! ❤️</p>
        )}

        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightbox(photo.s3_url)}
                className="flex-shrink-0 overflow-hidden rounded-[10px] transition-transform active:scale-95"
                style={{ width: 80, height: 80 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.s3_url}
                  alt="Community photo"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          isAuthenticated && hasCooked && (
            <p className="text-[11px] text-[#C4B8A8] italic">
              Pehle banao aur photo upload karo!
            </p>
          )
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Band karo"
            className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full text-white text-xl"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
