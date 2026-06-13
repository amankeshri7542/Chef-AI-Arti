// DishArt.tsx — Session-39 editorial dish media.
//  • <Steam>     animated steam micro-illustration.
//  • <DishArt>   deterministic warm gradient + plate rings + stroke icon.
//  • <DishImage> photo-first wrapper: real thumbnail when present, else DishArt.

import Image from 'next/image';
import type { CSSProperties } from 'react';
import Icon, { type IconName } from './Icon';
import { dishArt } from '@/lib/editorial';

export function Steam({ size = 26, color = 'rgba(255,255,255,0.85)' }: { size?: number; color?: string }) {
  return (
    <svg
      className="steam"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 18c-1.2-2 .8-3 .3-5" />
      <path d="M12 19c-1.4-2.4 1-3.6.4-6" />
      <path d="M17 18c-1.2-2 .8-3 .3-5" />
    </svg>
  );
}

/** Tasteful illustrated placeholder — warm deterministic gradient + plate + icon. */
export function DishArt({
  hue,
  icon,
  big = false,
  className,
  style,
}: {
  hue: number;
  icon: IconName;
  big?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const deep = `hsl(${hue}, 45%, 26%)`;
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 28% 18%, hsl(${hue}, 72%, ${big ? 88 : 90}%) 0%, transparent 55%), linear-gradient(150deg, hsl(${hue}, 62%, 84%) 0%, hsl(${hue}, 52%, 72%) 100%)`,
        ...style,
      }}
    >
      <div style={{ position: 'absolute', width: big ? 230 : 110, height: big ? 230 : 110, borderRadius: '50%', border: `1.5px solid ${deep}`, opacity: 0.18 }} />
      <div style={{ position: 'absolute', width: big ? 170 : 80, height: big ? 170 : 80, borderRadius: '50%', border: `1.5px dashed ${deep}`, opacity: 0.22 }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: 0.62 }}>
        <Steam size={big ? 30 : 18} color={deep} />
        <Icon name={icon} size={big ? 64 : 34} color={deep} sw={1.5} />
      </div>
    </div>
  );
}

type DishLike = {
  id?: string;
  category?: string | null;
  thumbnail_url?: string | null;
  name_hinglish?: string;
};

/** Photo-first media: real thumbnail when present, else a DishArt illustration.
 *  The parent must establish the box (height/width or inset) + border-radius. */
export default function DishImage({
  recipe,
  big = false,
  priority = false,
  sizes = '180px',
  className,
  style,
}: {
  recipe: DishLike;
  big?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { hue, icon } = dishArt(recipe);
  if (recipe.thumbnail_url) {
    return (
      <div className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
        <Image
          src={recipe.thumbnail_url}
          alt={recipe.name_hinglish ?? ''}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }
  return <DishArt hue={hue} icon={icon} big={big} className={className} style={style} />;
}
