export default function ThaliLoading() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-24">
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

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#E8DDD0] bg-white px-4 py-3">
        <div className="skel-shine" style={{ width: 36, height: 36, borderRadius: '50%' }} />
        <div>
          <div className="skel-shine" style={{ width: 120, height: 15, marginBottom: 4 }} />
          <div className="skel-shine" style={{ width: 180, height: 11 }} />
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="skel-shine mb-3" style={{ width: 100, height: 14 }} />
            <div className="rounded-xl overflow-hidden" style={{ background: '#FFF0E6' }}>
              <div className="skel-shine" style={{ width: '100%', height: 120, borderRadius: 0 }} />
              <div className="p-3">
                <div className="skel-shine mb-2" style={{ width: '70%', height: 14 }} />
                <div className="skel-shine" style={{ width: '40%', height: 11 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
