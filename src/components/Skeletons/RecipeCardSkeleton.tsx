'use client';

export default function RecipeCardSkeleton() {
  return (
    <div
      className="flex min-h-[72px] w-full overflow-hidden bg-white"
      style={{ border: '0.5px solid #E8DDD0', borderRadius: 12 }}
    >
      {/* Thumbnail placeholder */}
      <div
        className="animate-pulse bg-[#E8DDD0] flex-shrink-0 rounded-l-xl"
        style={{ width: 72, height: 72 }}
      />

      {/* Content placeholder */}
      <div className="flex flex-1 flex-col justify-center gap-2 p-2">
        {/* Name lines */}
        <div className="animate-pulse bg-[#E8DDD0] rounded h-3 w-4/5" />
        <div className="animate-pulse bg-[#E8DDD0] rounded h-3 w-3/5" />

        {/* Vibe pill placeholders */}
        <div className="flex gap-1 mt-1">
          <div className="animate-pulse bg-[#E8DDD0] rounded-full h-4 w-14" />
          <div className="animate-pulse bg-[#E8DDD0] rounded-full h-4 w-16" />
        </div>
      </div>
    </div>
  );
}
