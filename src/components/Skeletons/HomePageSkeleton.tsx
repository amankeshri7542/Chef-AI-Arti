export default function HomePageSkeleton() {
  return (
    <>
      {/* Shimmer keyframes */}
      <style>{`
        @keyframes skel-shimmer {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
        .skel-shine {
          background: linear-gradient(90deg, #F5EDE3 0%, #FDDBC2 50%, #F5EDE3 100%);
          background-size: 200% 100%;
          animation: skel-shimmer 1.5s infinite;
          border-radius: 8px;
        }
      `}</style>

      {/* Sticky header — greeting + vrat */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8DDD0] bg-white px-4 py-3">
        <div>
          <div className="skel-shine" style={{ width: 200, height: 15, marginBottom: 4 }} />
          <div className="skel-shine" style={{ width: 120, height: 13 }} />
        </div>
        <div className="skel-shine" style={{ width: 70, height: 32, borderRadius: 9999 }} />
      </div>

      {/* Tappable search bar */}
      <div className="mx-3 mt-3">
        <div className="skel-shine" style={{ width: '100%', height: 40, borderRadius: 9999 }} />
      </div>

      {/* QuickActions strip */}
      <div className="flex gap-3 px-3 py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skel-shine flex-shrink-0" style={{ width: 80, height: 90, borderRadius: 14 }} />
        ))}
      </div>

      {/* Aaj ke liye heading */}
      <div className="px-4 mt-2">
        <div className="skel-shine" style={{ width: 120, height: 14 }} />
      </div>

      {/* Featured cards horizontal */}
      <div className="flex gap-3 px-4 mt-3 pb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-2xl overflow-hidden"
            style={{ width: 160, height: 180, background: '#FFF0E6', border: '1px solid #E8DDD0' }}
          >
            <div className="skel-shine" style={{ width: '100%', height: 108, borderRadius: 0 }} />
            <div className="p-2.5">
              <div className="skel-shine mb-2" style={{ width: '80%', height: 13 }} />
              <div className="skel-shine" style={{ width: '50%', height: 11 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Promo card */}
      <div className="mx-4 mt-6 mb-6">
        <div className="skel-shine" style={{ width: '100%', height: 70, borderRadius: 16 }} />
      </div>

      <div className="pb-24" />
    </>
  );
}
