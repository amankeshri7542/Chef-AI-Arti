'use client';

interface YouTubeEmbedProps {
  videoId: string;
  channelName: string | null;
  title: string;
}

/**
 * Responsive 16:9 YouTube embed with channel credit, used on recipe pages
 * for YouTube-sourced CASE 2 recipes. Self-contained — wire in where needed.
 */
export default function YouTubeEmbed({
  videoId,
  channelName,
  title,
}: YouTubeEmbedProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span
          className="font-semibold"
          style={{ fontSize: '13px', color: '#2C1810' }}
        >
          📺 Video Dekho
        </span>
        {channelName && (
          <span style={{ fontSize: '10px', color: '#806244' }}>
            Credit: {channelName}
          </span>
        )}
      </div>
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: '56.25%' }}
      >
        <iframe
          className="absolute inset-0 h-full w-full rounded-xl"
          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}
