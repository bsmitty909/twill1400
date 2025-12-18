import { useState, useEffect, useRef } from "react"; // import React, { useEffect, useRef, useState } from 'react';

interface TwitchPlayerProps {
  channel?: string;
  video?: string;
  isMuted: boolean;
  onPlayerReady?: (player: any) => void;
}

let playerIdCounter = 0;

export function TwitchPlayer({ channel, video, isMuted, onPlayerReady }: TwitchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [playerId] = useState(() => `twitch-player-${++playerIdCounter}`);
  const isLoadingRef = useRef(false);
  const [muteKey, setMuteKey] = useState(0);

  useEffect(() => {
    setMuteKey(prev => prev + 1);
  }, [isMuted]);

  useEffect(() => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const loadPlayer = () => {
      if (!window.Twitch) {
        const script = document.createElement('script');
        script.src = 'https://player.twitch.tv/js/embed/v1.js';
        script.async = true;
        script.onload = () => {
          setTimeout(initPlayer, 100);
        };
        document.body.appendChild(script);
      } else {
        initPlayer();
      }
    };

    const initPlayer = () => {
      if (containerRef.current && window.Twitch && window.Twitch.Player) {
        try {
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

          const targetElement = document.getElementById(playerId);
          if (targetElement) {
            playerRef.current = new window.Twitch.Player(playerId, options);

            playerRef.current.addEventListener(window.Twitch.Player.READY, () => {
              if (playerRef.current && typeof playerRef.current.setMuted === 'function') {
                playerRef.current.setMuted(isMuted);
              }
              if (onPlayerReady) {
                onPlayerReady(playerRef.current);
              }
            });
          }
        } catch (error) {
          console.error('Twitch Player init error:', error);
          isLoadingRef.current = false;
        }
      }
    };

    loadPlayer();

    return () => {
      if (playerRef.current) {
        try {
          const iframe = document.querySelector(`#${playerId} iframe`);
          if (iframe) {
            iframe.remove();
          }
        } catch (error) {
          console.error('Twitch Player cleanup error:', error);
        }
        playerRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [channel, video, playerId, muteKey]);

  return <div key={muteKey} id={playerId} ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

declare global {
  interface Window {
    Twitch: any;
  }
}
