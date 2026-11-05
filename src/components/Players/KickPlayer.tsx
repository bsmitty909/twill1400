interface KickPlayerProps {
  channel: string;
  isMuted: boolean;
}

/*
 * Kick's embed has no JS API, so muting is only possible through the URL.
 * Changing the src reloads the stream, which is the best available option.
 */
export function KickPlayer({ channel, isMuted }: KickPlayerProps) {
  const src = new URL(encodeURIComponent(channel), 'https://player.kick.com/');
  src.searchParams.set('autoplay', 'true');
  src.searchParams.set('muted', String(isMuted));

  return (
    <iframe
      key={src.toString()}
      src={src.toString()}
      className="player-frame"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="origin"
      title={`Kick stream: ${channel}`}
    />
  );
}
