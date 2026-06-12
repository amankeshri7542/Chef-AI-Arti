'use client'
import { useRouter } from 'next/navigation'

interface Props {
  isOpen: boolean
  onClose: () => void
  feature: string
}

export default function LoginPromptModal({ isOpen, onClose, feature }: Props) {
  const router = useRouter()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white px-6 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E8DDD0]" />
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">🍳</span>
          <p className="text-[16px] font-bold text-[#1A1A1A]">Login karein!</p>
          <p className="text-[13px] text-[#806244]">
            {feature} ke liye login zaroori hai
            <br />
            Google se ek click mein login ho jaao
          </p>
          <button
            onClick={() => router.push('/sign-in')}
            className="mt-2 w-full rounded-xl bg-[#E8640C] py-3 text-[14px] font-semibold text-white"
          >
            Google se login karo →
          </button>
          <button
            onClick={onClose}
            className="text-[13px] text-[#806244] underline"
          >
            Abhi nahi
          </button>
        </div>
      </div>
    </div>
  )
}
