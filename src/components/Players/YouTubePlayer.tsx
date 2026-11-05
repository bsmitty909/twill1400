import { useEffect, useRef, useState } from 'react';
import { loadYouTubeApi } from '../../services/scriptLoader';
import { setYouTubeMeta } from '../../services/youtubeMeta';
import { PlayerError } from './PlayerError';

interface YouTubePlayerProps {
  videoId: string;
  isMuted: boolean;
  /** 0-100 */
  volume: number;
}

export function YouTubePlayer({ videoId, isMuted, volume }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const mutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // YT.Player replaces its target node, so give it a node React does not own.
    const host = hostRef.current;
    const target = document.createElement('div');
    host?.appendChild(target);

    loadYouTubeApi()
      .then(YT => {
        if (cancelled) return;
        playerRef.current = new YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, mute: mutedRef.current ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (event: {
              target: {
                mute(): void;
                unMute(): void;
                playVideo(): void;
                setVolume(v: number): void;
                getVideoData?: () => { author?: string; title?: string };
              };
            }) => {
              const data = event.target.getVideoData?.();
              if (data?.author) setYouTubeMeta(videoId, { author: data.author, title: data.title ?? '' });
              event.target.setVolume(volumeRef.current);
              if (mutedRef.current) event.target.mute();
              else event.target.unMute();
              event.target.playVideo();
            },
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Player already torn down by the API.
      }
      playerRef.current = null;
      host?.replaceChildren();
    };
  }, [videoId]);

  useEffect(() => {
    mutedRef.current = isMuted;
    volumeRef.current = volume;
    const player = playerRef.current;
    if (!player || typeof player.mute !== 'function') return;
    player.setVolume(volume);
    if (isMuted) player.mute();
    else player.unMute();
  }, [isMuted, volume]);

  if (failed) return <PlayerError message="YouTube player failed to load." />;
  return <div ref={hostRef} className="player-host" />;
}
