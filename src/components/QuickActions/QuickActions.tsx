'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuickAction {
  label: string;
  emoji: string;
  gradient: string;
  onClick: () => void;
}

interface QuickActionsProps {
  /** When true, render bare buttons without the outer scroll container (parent supplies it). */
  inline?: boolean;
}

export default function QuickActions({ inline = false }: QuickActionsProps) {
  const router = useRouter();
  const [surpriseLoading, setSurpriseLoading] = useState(false);

  async function onSurprise() {
    if (surpriseLoading) return;
    setSurpriseLoading(true);
    try {
      const res = await fetch('/api/recipes/surprise');
      if (res.ok) {
        const data = await res.json();
        if (data?.recipe?.id) {
          router.push('/recipe/' + data.recipe.id);
          return;
        }
      }
      // unauth or no result → send to search
      router.push('/search');
    } finally {
      setSurpriseLoading(false);
    }
  }

  const actions: QuickAction[] = [
    {
      label: 'Fridge Scan',
      emoji: '📷',
      gradient: 'linear-gradient(135deg, #E8640C, #F5A55B)',
      onClick: () => router.push('/fridge'),
    },
    {
      label: 'Bacha Hua',
      emoji: '🍱',
      gradient: 'linear-gradient(135deg, #2D6A4F, #52B788)',
      onClick: () => router.push('/bacha-hua'),
    },
    {
      label: 'Chef Arti',
      emoji: '💬',
      gradient: 'linear-gradient(135deg, #6B46C1, #9F7AEA)',
      onClick: () => router.push('/chat'),
    },
    {
      label: 'Surprise!',
      emoji: surpriseLoading ? '⏳' : '🎲',
      gradient: 'linear-gradient(135deg, #D97706, #FBBF24)',
      onClick: onSurprise,
    },
    {
      label: 'Dhundhon',
      emoji: '🔍',
      gradient: 'linear-gradient(135deg, #0369A1, #38BDF8)',
      onClick: () => router.push('/search'),
    },
  ];

  const buttons = actions.map((action) => (
    <button
      key={action.label}
      type="button"
      onClick={action.onClick}
      className="flex flex-shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] text-white active:scale-95"
      style={{ width: 80, height: 90, background: action.gradient }}
    >
      <span className="text-[24px] leading-none">{action.emoji}</span>
      <span className="text-[13px] font-semibold leading-tight">{action.label}</span>
    </button>
  ));

  if (inline) return <>{buttons}</>;

  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-2 scrollbar-hide">
      {buttons}
    </div>
  );
}
