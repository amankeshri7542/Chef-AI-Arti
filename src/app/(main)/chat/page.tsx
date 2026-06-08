'use client';

import BackButton from '@/components/BackButton/BackButton';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <div className="flex items-center gap-2 border-b border-[#E8DDD0] bg-white px-4 py-3">
        <BackButton fallback="/home" />
        <p className="text-[14px] font-semibold text-[#1A1A1A]">Chef Arti se baat karo 💬</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <span className="text-[40px]">💬</span>
        <p className="mt-3 text-[15px] font-semibold text-[#1A1A1A]">
          Niche wale button se chat kholo
        </p>
        <p className="mt-1 text-[12px] text-[#8B7355]">
          Arti se khaane ke baare mein kuch bhi poochho — kitne log, kya bacha hai, kaise banaye.
        </p>
      </div>

      <FloatingChatButton />
    </div>
  );
}
