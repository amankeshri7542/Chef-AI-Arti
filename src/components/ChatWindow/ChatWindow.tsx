'use client';

import { useState, useEffect, useRef } from 'react';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import { RATE_LIMITS } from '@/lib/rate-limits';
import Icon from '@/components/editorial/Icon';

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
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col transition-transform duration-300 ease-out`}
        style={{
          maxHeight: '72vh',
          borderRadius: '24px 24px 0 0',
          background: 'var(--cream)',
          boxShadow: '0 -8px 40px rgba(44,24,16,0.25)',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        aria-label="Chat with Chef Arti"
      >
        {/* A. Handle bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-11 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* B. Header */}
        <div className="flex items-center gap-3 px-[18px] pb-3 pt-1" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--hero)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="chat" size={22} color="#fff" />
          </span>
          <div style={{ flex: 1 }}>
            <div className="t-display" style={{ fontSize: 18, color: 'var(--text)' }}>Chef Arti</div>
            <div className="t-caption" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} /> Hamesha aapke saath
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: 'var(--hero-lt)' }}
            aria-label="Band karo"
          >
            <Icon name="close" size={18} color="var(--hero-dk)" />
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
        <div className="no-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] py-3 pb-2">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2.5 pt-8">
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chat" size={26} color="var(--hero-dk)" />
              </span>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Namaskar! Khaana pakane mein koi sawaal?</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[82%]"
                  style={{
                    padding: '11px 14px',
                    fontSize: 14,
                    lineHeight: 1.5,
                    background: msg.role === 'user' ? 'var(--hero)' : 'var(--card)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                    boxShadow: '0 1px 2px var(--shadow)',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
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
              <div style={{ display: 'flex', gap: 5, padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px' }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="dot-b" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--muted)', animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <p className="text-center text-[13px]" style={{ color: 'var(--hero-dk)' }}>{error}</p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* E. Input row */}
        <div className="flex items-center gap-2 px-[18px] py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Arti se kuch poochho…"
            disabled={remaining <= 0 || loading}
            className="flex-1 outline-none disabled:opacity-50"
            style={{ minHeight: 50, padding: '0 16px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 14, color: 'var(--text)' }}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || loading || remaining <= 0}
            className="tap-spring flex flex-shrink-0 items-center justify-center disabled:opacity-40"
            style={{ width: 50, minHeight: 50, borderRadius: 16, background: 'var(--hero)' }}
            aria-label="Bhejo"
          >
            <Icon name="send" size={20} color="#fff" />
          </button>
        </div>
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
