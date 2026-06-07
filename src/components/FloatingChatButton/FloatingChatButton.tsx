'use client';

import { useState } from 'react';
import ChatWindow from '@/components/ChatWindow/ChatWindow';

interface FloatingChatButtonProps {
  recipeId?: string;
  recipeName?: string;
}

export default function FloatingChatButton({ recipeId, recipeName }: FloatingChatButtonProps) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{ background: '#E8640C' }}
        aria-label="Chat kholo"
      >
        <span className="text-2xl">💬</span>
      </button>

      <ChatWindow
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        recipeId={recipeId}
        recipeName={recipeName}
      />
    </>
  );
}
