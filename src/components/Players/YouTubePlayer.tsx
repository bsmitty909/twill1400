import { useState, useEffect, useRef } from "react"; // import React, { useEffect, useRef, useState } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  isMuted: boolean;
  onPlayerReady?: (player: any) => void;
}

let playerIdCounter = 0;

export function YouTubePlayer({ videoId, isMuted, onPlayerReady }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [playerId] = useState(() => `youtube-player-${++playerIdCounter}`);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const loadPlayer = () => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      } else if (window.YT.Player) {
        initPlayer();
      } else {
        setTimeout(loadPlayer, 100);
      }
    };

    const initPlayer = () => {
      if (containerRef.current && window.YT && window.YT.Player) {
        try {
          playerRef.current = new window.YT.Player(playerId, {
            videoId: videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 1,
              controls: 1,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: any) => {
                const player = event.target;
                if (isMuted && player.mute) {
                  player.mute();
                }
                if (onPlayerReady) {
                  onPlayerReady(player);
                }
              },
            },
          });
        } catch (error) {
          console.error('YouTube Player init error:', error);
          isLoadingRef.current = false;
        }
      }
    };

    loadPlayer();

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('YouTube Player destroy error:', error);
        }
      }
      playerRef.current = null;
      isLoadingRef.current = false;
    };
  }, [videoId, playerId]);

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.mute === 'function') {
      try {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (error) {
        console.error('YouTube mute error:', error);
      }
    }
  }, [isMuted]);

  return <div id={playerId} ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}
