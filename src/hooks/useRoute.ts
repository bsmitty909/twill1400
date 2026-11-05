import { useSyncExternalStore } from 'react';

export type Route = 'watch' | 'archives';

const NAV_EVENT = 'twill:navigate';

function currentRoute(): Route {
  return window.location.pathname.replace(/\/+$/, '') === '/archives' ? 'archives' : 'watch';
}

export function navigate(route: Route) {
  const path = route === 'archives' ? '/archives' : '/';
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event(NAV_EVENT));
  }
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  return useSyncExternalStore(
    onChange => {
      window.addEventListener('popstate', onChange);
      window.addEventListener(NAV_EVENT, onChange);
      return () => {
        window.removeEventListener('popstate', onChange);
        window.removeEventListener(NAV_EVENT, onChange);
      };
    },
    currentRoute,
    () => 'watch'
  );
}
