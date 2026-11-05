interface CustomPlayerProps {
  url: string;
  isMuted: boolean;
}

/*
 * Arbitrary embeds expose no audio API. A `muted=1` query param is the
 * de-facto convention many players honour, so it is toggled on the src.
 */
export function CustomPlayer({ url, isMuted }: CustomPlayerProps) {
  const src = new URL(url);
  if (isMuted) src.searchParams.set('muted', '1');
  else src.searchParams.delete('muted');

  return (
    <iframe
      key={src.toString()}
      src={src.toString()}
      className="player-frame"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      title={`Embedded stream: ${src.hostname}`}
    />
  );
}
