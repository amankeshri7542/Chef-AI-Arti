import RecipeGridSkeleton from '@/components/Skeletons/RecipeGridSkeleton';

export default function SearchPageSkeleton() {
  return (
    <div className="flex flex-col min-h-full bg-[#FFFAF6]">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #E8DDD0' }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="skel-shine" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div>
            <div className="skel-shine" style={{ width: 140, height: 16, marginBottom: 4 }} />
            <div className="skel-shine" style={{ width: 200, height: 11 }} />
          </div>
        </div>

        {/* Search input */}
        <div className="skel-shine" style={{ width: '100%', height: 44, borderRadius: 9999 }} />

        {/* Category chips */}
        <div className="flex gap-2 mt-2">
          {[70, 55, 65, 65, 55].map((w, i) => (
            <div key={i} className="skel-shine flex-shrink-0" style={{ width: w, height: 32, borderRadius: 9999 }} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3">
        {/* Food Library heading */}
        <div className="skel-shine mb-3" style={{ width: 100, height: 14 }} />

        {/* Collection cards */}
        <div className="flex gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel-shine flex-shrink-0" style={{ width: 80, height: 80, borderRadius: 14 }} />
          ))}
        </div>

        {/* Results heading */}
        <div className="skel-shine mb-3" style={{ width: 80, height: 12 }} />

        {/* 2-col recipe grid */}
        <RecipeGridSkeleton />
      </div>
    </div>
  );
}
