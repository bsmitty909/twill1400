import { useEffect, useRef, useState } from 'react';
import { loadTwitchApi } from '../../services/scriptLoader';
import { PlayerError } from './PlayerError';

interface TwitchPlayerProps {
  /** Channel name, or `videos/<id>` for a VOD. */
  source: string;
  isMuted: boolean;
}

export function TwitchPlayer({ source, isMuted }: TwitchPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const mutedRef = useRef(isMuted);
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
        player.addEventListener(Twitch.Player.READY, () => player.setMuted(mutedRef.current));
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
    playerRef.current?.setMuted?.(isMuted);
  }, [isMuted]);

  if (failed) return <PlayerError message="Twitch player failed to load." />;
  return <div ref={hostRef} className="player-host" />;
}
