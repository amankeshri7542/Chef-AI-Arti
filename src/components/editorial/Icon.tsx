// Icon.tsx — Chief-AI-Arti stroke icon set (1.8px stroke, 24 viewBox).
// Crafted line icons for UI chrome; emoji stay in voice/content.
// Session-39 "Modern Rasoi Editorial".

import type { CSSProperties, ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  home: <g><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></g>,
  search: <g><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></g>,
  camera: <g><path d="M4 8h2.5l1.5-2.5h8L17.5 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="14" r="3.5" /></g>,
  profile: <g><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.5-3.5 4.2-5 7.5-5s6 1.5 7.5 5" /></g>,
  chat: <g><path d="M21 12a8 8 0 0 1-8 8H4l1.7-3A8 8 0 1 1 21 12Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" /></g>,
  pot: <g><path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5Z" /><path d="M2.5 10h19M8 6.5c0-1 .8-1 .8-2M12 6.5c0-1 .8-1 .8-2M16 6.5c0-1 .8-1 .8-2" /></g>,
  thali: <g><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="6.8" cy="8.5" r="1.4" /><circle cx="17.2" cy="8.5" r="1.4" /></g>,
  dice: <g><rect x="4" y="4" width="16" height="16" rx="3.5" /><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" /></g>,
  om: <g><path d="M7.5 8.2c.6-1.6 2-2.7 3.9-2.7 2.3 0 3.9 1.5 3.9 3.6 0 2.4-1.9 3.7-4.2 3.7h-1.3c2.9 0 5.5 1.3 5.5 4 0 2.4-2 4-4.6 4-2.4 0-4.1-1.3-4.7-3.2" /><path d="M16.5 4.5c.9.6 1.9.6 2.8 0" /><circle cx="18" cy="2.6" r="0.4" fill="currentColor" stroke="none" /></g>,
  heart: <g><path d="M12 20.5S4 15.5 4 9.8C4 6.9 6.1 5 8.5 5c1.5 0 2.8.8 3.5 2 .7-1.2 2-2 3.5-2C17.9 5 20 6.9 20 9.8c0 5.7-8 10.7-8 10.7Z" /></g>,
  back: <g><path d="M15 5l-7 7 7 7" /></g>,
  clock: <g><circle cx="12" cy="12.5" r="8" /><path d="M12 8.5v4l2.8 1.8M9.5 2.5h5" /></g>,
  users: <g><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c1-2.8 3-4 5.5-4s4.5 1.2 5.5 4" /><path d="M15.5 6a3 3 0 0 1 0 5.4M17.5 15.7c1.6.6 2.7 1.9 3.2 3.8" /></g>,
  chili: <g><path d="M19 4.5c-.5 1.5-2 2.5-3.5 2.5" /><path d="M15.5 7C16 11 13 17.5 6 19.5c-1 .3-1.8-.8-1.1-1.6C7.5 15 9 12 9.5 9.2 9.8 7.5 11 6.5 12.7 6.5h2.8Z" /></g>,
  wheat: <g><path d="M12 21V8" /><path d="M12 8c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Zm0 0c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4ZM12 13c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Zm0 0c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4ZM12 18c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Zm0 0c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Z" /></g>,
  speaker: <g><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" /><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7.5a6.5 6.5 0 0 1 0 9" /></g>,
  check: <g><path d="M5 12.5l4.5 4.5L19 7.5" /></g>,
  star: <g><path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3l-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 4Z" /></g>,
  bolt: <g><path d="M13 3 5.5 13.5h5L11 21l7.5-10.5h-5L13 3Z" /></g>,
  sun: <g><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></g>,
  sweet: <g><path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z" /><path d="M12 8.5 15.5 12 12 15.5 8.5 12 12 8.5Z" /></g>,
  trophy: <g><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 5H5a3 3 0 0 0 3 4.5M16 5h3a3 3 0 0 1-3 4.5M12 13v3.5M8.5 20h7M12 16.5c-1 0-2 1-2 3.5h4c0-2.5-1-3.5-2-3.5Z" /></g>,
  leaf: <g><path d="M19 5c-9 0-13 4.5-13 9.5 0 2.5 1.7 4.5 4.5 4.5C16 19 19 13 19 5Z" /><path d="M6.5 18.5C9 13.5 12.5 10 16 8" /></g>,
  pan: <g><circle cx="10" cy="12" r="6.5" /><path d="M16.5 12H22" strokeWidth="2.4" /></g>,
  flame: <g><path d="M12 21c-3.6 0-6-2.3-6-5.5 0-2.7 1.8-4.6 3.2-6.3.9-1.1 1.9-2.3 2.3-3.7.3-1 .2-1.8.2-2.5 2.8 1.6 6.3 5.7 6.3 10C18 18 16 21 12 21Z" /><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.7 1.5-2.8 2.6-4.4 1.1 1.4 3 2.8 3 4.6 0 1.5-1.1 2.6-2.8 2.6Z" /></g>,
  plus: <g><path d="M12 5.5v13M5.5 12h13" /></g>,
  minus: <g><path d="M5.5 12h13" /></g>,
  close: <g><path d="M6 6l12 12M18 6 6 18" /></g>,
  chevR: <g><path d="m9.5 6 6 6-6 6" /></g>,
  sparkle: <g><path d="M12 3.5 13.8 9 19.5 11 13.8 13 12 18.5 10.2 13 4.5 11 10.2 9 12 3.5Z" /><path d="M19 17.5l.7 2 .7-2 2-.7-2-.7-.7-2-.7 2-2 .7 2 .7Z" /></g>,
  play: <g><path d="M8 5.5v13l11-6.5L8 5.5Z" /></g>,
  share: <g><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="6" r="2.5" /><circle cx="17.5" cy="18" r="2.5" /><path d="m8.8 10.8 6.4-3.6M8.8 13.2l6.4 3.6" /></g>,
  refresh: <g><path d="M19 12a7 7 0 1 1-2-4.9" /><path d="M19.5 3.5v4h-4" /></g>,
  send: <g><path d="M3.5 11 20.5 4l-4 16.5-4.7-6.2L3.5 11Z" /><path d="m11.8 14.3 8.7-10.3" /></g>,
  gallery: <g><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4.5 17 4.5-4 3.5 3 3-2.5 4.5 3.5" /></g>,
  download: <g><path d="M12 4v10M7.5 10.5 12 15l4.5-4.5" /><path d="M5 18.5h14" /></g>,
  lock: <g><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></g>,
  pencil: <g><path d="m14.5 5.5 4 4L8 20l-4.5.5L4 16 14.5 5.5Z" /><path d="m13 7 4 4" /></g>,
  rupee: <g><path d="M7 4h10M7 8.5h10M7 4c5 0 7 1.5 7 4.5S11 13 8.5 13L15 20" /></g>,
  fridge: <g><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M6 10h12M9 6.5v1M9 13v3" /></g>,
  mic: <g><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></g>,
  map: <g><path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2Z" /><path d="M9 5v12M15 7v12" /></g>,
  bell: <g><path d="M18 16H6c1.2-1.2 1.5-3 1.5-5.5C7.5 7 9.5 5 12 5s4.5 2 4.5 5.5c0 2.5.3 4.3 1.5 5.5Z" /><path d="M10 19a2 2 0 0 0 4 0" /></g>,
  apple: <g><path d="M16 6.5c-1 .3-2.3.1-3.2-.7-.8-.7-1.3-1.9-1.1-3 1.1-.1 2.3.4 3 1.2.7.8 1.2 1.6 1.3 2.5ZM17.5 20c-1 1-2.4.8-3.4.3-.7-.3-1.5-.3-2.2 0-1 .5-2.4.7-3.4-.3-2.4-2.4-3.3-7.2-1-9.8 1-1.2 2.6-1.5 4-1 .7.3 1.5.3 2.2 0 1.4-.5 3-.2 4 1-2.7 2-2.3 5.8.7 7-.2 1-.5 2-.9 2.8Z" /></g>,
};

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 24,
  color = 'currentColor',
  sw = 1.8,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  sw?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.sparkle}
    </svg>
  );
}
