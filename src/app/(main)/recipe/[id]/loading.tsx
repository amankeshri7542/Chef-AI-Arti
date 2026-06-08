export default function RecipeDetailLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 bg-[#FFFAF6] min-h-full">
      {/* Hero image placeholder */}
      <div className="animate-pulse bg-[#E8DDD0] rounded-xl w-full" style={{ height: 200 }} />

      {/* Title placeholder */}
      <div className="flex flex-col gap-2 px-1">
        <div className="animate-pulse bg-[#E8DDD0] rounded h-5 w-3/4" />
        <div className="animate-pulse bg-[#E8DDD0] rounded h-4 w-1/2" />
      </div>

      {/* Vibe pills */}
      <div className="flex gap-2 px-1">
        <div className="animate-pulse bg-[#E8DDD0] rounded-full h-6 w-20" />
        <div className="animate-pulse bg-[#E8DDD0] rounded-full h-6 w-24" />
        <div className="animate-pulse bg-[#E8DDD0] rounded-full h-6 w-16" />
      </div>

      {/* Content lines */}
      <div className="flex flex-col gap-3 px-1 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-[#E8DDD0] rounded h-3 w-full" />
        ))}
        <div className="animate-pulse bg-[#E8DDD0] rounded h-3 w-4/5" />
      </div>
    </div>
  );
}
