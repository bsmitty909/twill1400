import React from 'react';

interface KickPlayerProps {
  channel: string;
  isMuted: boolean;
}

export function KickPlayer({ channel, isMuted }: KickPlayerProps) {
  const embedUrl = `https://player.kick.com/${channel}?muted=${isMuted ? '1' : '0'}`;

  return (
    <iframe
      src={embedUrl}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title={`Kick stream: ${channel}`}
    />
  );
}
