import type { Platform } from '../types/index.ts';
import { useStreamLabel } from '../hooks/useStreamLabel';

/** Renders a stream's display name as plain text (usable inside <option>). */
export function StreamLabel({ platform, videoId }: { platform: Platform; videoId: string }) {
  return <>{useStreamLabel(platform, videoId).label}</>;
}
