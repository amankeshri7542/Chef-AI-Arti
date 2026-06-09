interface RecipeGridSkeletonProps {
  /** Number of placeholder cards. Default 6. */
  count?: number;
  className?: string;
}

/**
 * 2-col shimmer grid matching RecipeCardCompact (3:2 image + two text lines).
 * Used as the search results placeholder so loads feel content-shaped, not blank.
 */
export default function RecipeGridSkeleton({ count = 6, className = '' }: RecipeGridSkeletonProps) {
  return (
    <div className={`grid grid-cols-2 gap-3.5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl" style={{ background: '#FFF0E6' }}>
          <div className="skel-shine" style={{ width: '100%', aspectRatio: '3/2', borderRadius: 0 }} />
          <div className="p-2.5">
            <div className="skel-shine mb-2" style={{ width: '80%', height: 13 }} />
            <div className="skel-shine" style={{ width: '50%', height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
