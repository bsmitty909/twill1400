import { useEffect, useRef, useState } from 'react';
import { loadTwitchApi } from '../../services/scriptLoader';
import { PlayerError } from './PlayerError';

interface TwitchPlayerProps {
  /** Channel name, or `videos/<id>` for a VOD. */
  source: string;
  isMuted: boolean;
  /** 0-100 */
  volume: number;
}

export function TwitchPlayer({ source, isMuted, volume }: TwitchPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const mutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    const target = document.createElement('div');
    target.style.cssText = 'width:100%;height:100%';
    host?.appendChild(target);

    loadTwitchApi()
      .then(Twitch => {
        if (cancelled) return;
        const isVod = source.startsWith('videos/');
        const player = new Twitch.Player(target, {
          width: '100%',
          height: '100%',
          parent: [window.location.hostname],
          muted: mutedRef.current,
          autoplay: true,
          ...(isVod ? { video: source.slice('videos/'.length) } : { channel: source }),
        });
        player.addEventListener(Twitch.Player.READY, () => {
          player.setVolume(volumeRef.current / 100);
          player.setMuted(mutedRef.current);
        });
        playerRef.current = player;
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      playerRef.current = null;
      host?.replaceChildren();
    };
  }, [source]);

  useEffect(() => {
    mutedRef.current = isMuted;
    volumeRef.current = volume;
    playerRef.current?.setVolume?.(volume / 100);
    playerRef.current?.setMuted?.(isMuted);
  }, [isMuted, volume]);

  if (failed) return <PlayerError message="Twitch player failed to load." />;
  return <div ref={hostRef} className="player-host" />;
}
