'use client';

interface WhatsAppShareProps {
  recipeName: string;
  recipeId: string;
  isPaid: boolean;
  onUpgradeClick: () => void;
}

export default function WhatsAppShare({
  recipeName,
  recipeId,
  isPaid,
  onUpgradeClick,
}: WhatsAppShareProps) {
  function handleShare() {
    if (!isPaid) {
      onUpgradeClick();
      return;
    }
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `*${recipeName}* — Chief AI Arti pe banao!\n${appUrl}/recipe/${recipeId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex h-10 items-center gap-2 rounded-full border border-[#E8DDD0] bg-white px-4 text-[13px] font-medium text-[#1A1A1A] active:bg-[#FFF0E6]"
    >
      {isPaid ? '📤 WhatsApp par bhejo' : '🔒 WhatsApp (Premium)'}
    </button>
  );
}
