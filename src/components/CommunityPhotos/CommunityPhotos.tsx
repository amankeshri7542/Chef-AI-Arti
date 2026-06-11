'use client';

import { useState, useEffect } from 'react';

interface Photo {
  id: string;
  s3_url: string;
  user_id: string;
  caption: string | null;
  created_at: string;
}

interface Props {
  recipeId: string;
}

// Display-only: photo uploads are admin-only (via the admin panel).
export default function CommunityPhotos({ recipeId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/recipes/${recipeId}/photos`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => {});
  }, [recipeId]);

  if (photos.length === 0) return null;

  return (
    <>
      <section>
        <p className="mb-2 text-[12px] font-medium text-[#8B7355]">
          Logon ne banaya ❤️ <span className="ml-1">({photos.length})</span>
        </p>

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
