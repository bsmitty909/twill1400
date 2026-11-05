import { useCallback, useEffect, useState } from 'react';

/** Whole-page browser fullscreen (hides the browser's own UI too). */
export function useBrowserFullscreen() {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);
  return { active, toggle, supported: typeof document.documentElement.requestFullscreen === 'function' };
}
