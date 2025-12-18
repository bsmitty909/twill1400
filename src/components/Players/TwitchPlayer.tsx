import React, { useEffect, useRef } from 'react';

interface TwitchPlayerProps {
  channel?: string;
  video?: string;
  isMuted: boolean;
  onPlayerReady?: (player: any) => void;
}

export function TwitchPlayer({ channel, video, isMuted, onPlayerReady }: TwitchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!window.Twitch) {
      const script = document.createElement('script');
      script.src = 'https://player.twitch.tv/js/embed/v1.js';
      script.async = true;
      script.onload = () => initPlayer();
      document.body.appendChild(script);
    } else {
      initPlayer();
    }

    function initPlayer() {
      if (containerRef.current && window.Twitch && window.Twitch.Player) {
        const options: any = {
          width: '100%',
          height: '100%',
          parent: [window.location.hostname],
          muted: isMuted,
        };

        if (channel) {
          options.channel = channel;
        } else if (video) {
          options.video = video;
        }

        playerRef.current = new window.Twitch.Player(containerRef.current, options);

        playerRef.current.addEventListener(window.Twitch.Player.READY, () => {
          if (onPlayerReady) {
            onPlayerReady(playerRef.current);
          }
        });
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current = null;
      }
    };
  }, [channel, video]);

  useEffect(() => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.setMuted(true);
      } else {
        playerRef.current.setMuted(false);
      }
    }
  }, [isMuted]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

declare global {
  interface Window {
    Twitch: any;
  }
}
