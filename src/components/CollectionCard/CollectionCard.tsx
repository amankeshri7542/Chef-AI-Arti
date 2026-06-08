'use client';

import { RECIPE_COLLECTIONS } from '@/lib/collections';

type Collection = (typeof RECIPE_COLLECTIONS)[number];

interface CollectionCardProps {
  collection: Collection;
  active?: boolean;
  onClick: () => void;
}

export default function CollectionCard({ collection, active = false, onClick }: CollectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-[12px] transition-transform active:scale-95 flex-shrink-0"
      style={{
        width: 80,
        height: 80,
        border: active ? '2px solid #E8640C' : '0.5px solid #E8DDD0',
        boxShadow: active ? '0 0 0 1px #E8640C' : undefined,
      }}
    >
      {/* Top — emoji */}
      <div
        className="flex flex-1 items-center justify-center text-2xl"
        style={{ background: collection.bg }}
      >
        {collection.emoji}
      </div>
      {/* Bottom — label */}
      <div
        className="flex items-center justify-center px-1 py-1"
        style={{ background: '#fff', minHeight: 24 }}
      >
        <span
          className="text-center font-medium leading-tight text-[#1A1A1A]"
          style={{ fontSize: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {collection.label}
        </span>
      </div>
    </button>
  );
}
