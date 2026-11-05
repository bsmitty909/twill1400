import { useState, useEffect } from 'react';

interface CustomPlayerProps {
  url: string;
  isMuted: boolean;
}

export function CustomPlayer({ url, isMuted }: CustomPlayerProps) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey(prev => prev + 1);
  }, [isMuted]);

  const embedUrl = isMuted ? `${url}${url.includes('?') ? '&' : '?'}muted=1` : url;

  return (
    <iframe
      key={key}
      src={embedUrl}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      title={`Custom stream: ${url}`}
    />
  );
}
