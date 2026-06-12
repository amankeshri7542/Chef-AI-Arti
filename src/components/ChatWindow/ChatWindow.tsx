'use client';

import { useState, useEffect, useRef } from 'react';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import { RATE_LIMITS } from '@/lib/rate-limits';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId?: string;
  recipeName?: string;
  subscriptionStatus?: 'free' | 'paid';
}

export default function ChatWindow({ isOpen, onClose, recipeId, recipeName, subscriptionStatus = 'free' }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number>(RATE_LIMITS[subscriptionStatus].chat);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load session when chat opens
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/chat/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.exists && data.session?.recent_messages?.length > 0) {
          setMessages(data.session.recent_messages);
        }
      })
      .catch(() => {});
    // focus input after slide-up animation
    setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || remaining <= 0) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, recipeId, recipeName }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setRemaining(0);
        setError(data.error);
        // Remove the optimistic user message since it didn't go through
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Kuch gadbad ho gayi. Dobara try karein.');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      setRemaining(data.remaining ?? 0);
    } catch {
      setError('Network error. Dobara try karein.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-white transition-transform duration-300 ease-out`}
        style={{
          maxHeight: '65vh',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        aria-label="Chat with Chef Arti"
      >
        {/* A. Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-8 rounded-full bg-[#E8DDD0]" />
        </div>

        {/* B. Header */}
        <div className="flex items-center justify-between border-b border-[#E8DDD0] px-4 py-2">
          <p className="text-[13px] font-bold text-[#1A1A1A]">Chef Arti se poochho 🍳</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[18px] text-[#806244] active:bg-[#FFF0E6]"
            aria-label="Band karo"
          >
            ✕
          </button>
        </div>

        {/* C. Rate limit banner — warm benefit-focused upsell */}
        {remaining === 0 && subscriptionStatus === 'free' && !bannerDismissed && (
          <div
            className="m-2 rounded-[14px] px-4 py-[14px]"
            style={{
              background: 'linear-gradient(135deg, #FFF0E6, #FFF8F0)',
              border: '1.5px solid var(--saffron-lt)',
              boxShadow: '0 4px 16px rgba(180,80,20,0.12)',
            }}
          >
            <p className="text-[13px] font-medium" style={{ color: 'var(--terracotta)' }}>
              ✨ Chef Arti aur help kar sakti hai!
            </p>

            <div className="mt-2 flex flex-col gap-1.5">
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>💬 Roz 20 sawaal — kabhi limit nahi</p>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>📷 Fridge scan 10 baar/din</p>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>🍱 Bacha Hua mode bhi milega</p>
            </div>

            <p className="mt-2 text-[13px]">
              <span className="font-bold" style={{ color: 'var(--saffron-dk)' }}>Sirf ₹150/mahine </span>
              <span className="italic" style={{ color: 'var(--muted)' }}>= less than chai ka ek cup roz ☕</span>
            </p>

            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="mt-3 flex w-full items-center justify-center rounded-[12px] text-[14px] font-semibold text-white"
              style={{
                height: 52,
                background: 'linear-gradient(160deg, #E8640C, #BF4E06)',
                boxShadow: '0 4px 16px rgba(180,80,20,0.25)',
              }}
            >
              Abhi upgrade karein →
            </button>

            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="mt-2 block w-full text-center text-[13px]"
              style={{ color: 'var(--muted)' }}
            >
              Kal free mein jaari rakhein
            </button>
          </div>
        )}

        {remaining === 1 && (
          <div className="m-2 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2">
            <p className="text-[13px] text-[#92600A]">1 sawaal aur bacha hai aaj ke liye 💬</p>
          </div>
        )}

        {/* D. Messages area */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 pb-2">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0E6] text-xl">
                🍳
              </div>
              <p className="text-[13px] text-[#806244]">
                Namaskar! Khaana pakane mein koi sawaal?
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[78%] px-3 py-2 text-[13px] leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? '#E8640C' : '#FFF0E6',
                    color: msg.role === 'user' ? '#fff' : '#1A1A1A',
                    borderRadius:
                      msg.role === 'user'
                        ? '12px 0 12px 12px'
                        : '0 12px 12px 12px',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-1 px-3 py-2"
                style={{ background: '#FFF0E6', borderRadius: '0 12px 12px 12px' }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-[#E8640C]"
                    style={{
                      animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <p className="text-center text-[13px] text-[#BF4E06]">{error}</p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* E. Input row */}
        <div className="flex items-center gap-2 border-t border-[#E8DDD0] bg-white px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Poochho kuch bhi..."
            disabled={remaining <= 0 || loading}
            className="flex-1 rounded-full bg-[#FFF0E6] px-4 py-2 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#806244] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || loading || remaining <= 0}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
            style={{ background: '#E8640C' }}
            aria-label="Bhejo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
