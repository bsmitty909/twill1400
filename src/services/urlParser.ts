import type { ParsedVideo, Platform } from '../types/index.ts';

function extractUrlFromIframe(input: string): string | null {
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/i;
  const match = input.match(iframeRegex);
  return match ? match[1] : null;
}

export function parseVideoUrl(input: string): ParsedVideo | null {
  try {
    let url = input.trim();
    
    // Check if input is iframe HTML code
    if (url.toLowerCase().startsWith('<iframe')) {
      const extractedUrl = extractUrlFromIframe(url);
      if (!extractedUrl) {
        return null;
      }
      url = extractedUrl;
    }
    
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // YouTube detection
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let videoId: string | null = null;

      if (hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1).split('?')[0];
      } else {
        const searchParams = new URLSearchParams(urlObj.search);
        videoId = searchParams.get('v');
      }

      if (videoId) {
        return {
          platform: 'youtube',
          videoId,
          isLive: false
        };
      }
    }

    // Twitch detection
    if (hostname.includes('twitch.tv')) {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length > 0) {
        if (pathParts[0] === 'videos') {
          return {
            platform: 'twitch',
            videoId: pathParts[1],
            isLive: false
          };
        } else {
          return {
            platform: 'twitch',
            videoId: pathParts[0],
            isLive: true
          };
        }
      }
    }

    // Kick detection
    if (hostname.includes('kick.com')) {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length > 0) {
        return {
          platform: 'kick',
          videoId: pathParts[0],
          isLive: true
        };
      }
    }

    // Custom iframe embed - any other URL
    if (urlObj.hostname) {
      return {
        platform: 'custom',
        videoId: url, // Store the full URL for custom embeds
        isLive: false
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
}

export function getPlatformName(platform: Platform): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube';
    case 'twitch':
      return 'Twitch';
    case 'kick':
      return 'Kick';
    default:
      return 'Unknown';
  }
}
