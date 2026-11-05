/*
 * Third-party player SDKs must be injected exactly once even when several
 * slots mount at the same moment. Each loader memoizes a single promise so
 * every caller awaits the same script load.
 */

let youTubeApi: Promise<YTNamespace> | null = null;
let twitchApi: Promise<TwitchNamespace> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youTubeApi) {
    youTubeApi = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      injectScript('https://www.youtube.com/iframe_api').catch(error => {
        youTubeApi = null;
        reject(error);
      });
    });
  }
  return youTubeApi;
}

export function loadTwitchApi(): Promise<TwitchNamespace> {
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (!twitchApi) {
    twitchApi = injectScript('https://player.twitch.tv/js/embed/v1.js')
      .then(() => window.Twitch!)
      .catch(error => {
        twitchApi = null;
        throw error;
      });
  }
  return twitchApi;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type YTNamespace = { Player: new (el: HTMLElement, options: any) => any };
export type TwitchNamespace = { Player: (new (el: HTMLElement, options: any) => any) & { READY: string } };

declare global {
  interface Window {
    YT?: YTNamespace;
    Twitch?: TwitchNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
