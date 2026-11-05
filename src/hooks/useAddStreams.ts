import { useCallback } from 'react';
import { useVideo, SLOT_COUNT } from '../contexts/VideoContext';
import { parseVideoUrl } from '../services/urlParser';
import { rememberStreams } from '../services/library';
import type { StreamRef } from '../services/library';

export type AddFeedback = { tone: 'error' | 'success'; text: string; added: number };

/** Splits pasted text into links; iframe embed code is kept whole. */
function splitLinks(input: string): string[] {
  const text = input.trim();
  if (!text) return [];
  if (text.toLowerCase().startsWith('<iframe')) return [text];
  return text.split(/[\s,]+/).filter(Boolean);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Adds one or many pasted links (or known streams) and returns a single
 * human-readable summary. Successful adds are remembered as recent streams.
 */
export function useAddStreams() {
  const { addVideos } = useVideo();

  const addStreams = useCallback(
    (streams: StreamRef[], invalid = 0): AddFeedback => {
      const results = addVideos(streams);
      const added = streams.filter((_, i) => results[i].ok);
      rememberStreams(added);

      const duplicates = results.filter(r => !r.ok && r.reason === 'duplicate');
      const full = results.filter(r => !r.ok && r.reason === 'full').length;
      const slotIds = results.flatMap(r => (r.ok ? [r.slotId + 1] : []));

      if (!added.length) {
        if (full) return { tone: 'error', added: 0, text: `All ${SLOT_COUNT} slots are in use. Remove a stream to add another.` };
        if (duplicates.length === 1 && !invalid) {
          return { tone: 'error', added: 0, text: `Already playing in slot ${(duplicates[0].ok ? 0 : (duplicates[0].slotId ?? 0)) + 1}.` };
        }
        if (invalid && !duplicates.length) {
          return { tone: 'error', added: 0, text: "That link doesn't look right. Try a YouTube, Twitch, or Kick URL." };
        }
      }

      const parts = [
        added.length === 1 ? `Added to slot ${slotIds[0]}` : added.length ? `Added ${plural(added.length, 'stream')}` : '',
        duplicates.length ? `${plural(duplicates.length, 'link')} already playing` : '',
        invalid ? `${plural(invalid, 'link')} not recognized` : '',
        full ? `${full} skipped (slots full)` : '',
      ].filter(Boolean);
      return { tone: added.length ? 'success' : 'error', added: added.length, text: `${parts.join(' · ')}.` };
    },
    [addVideos]
  );

  const addFromText = useCallback(
    (input: string): AddFeedback => {
      const links = splitLinks(input);
      if (!links.length) return { tone: 'error', added: 0, text: 'Paste a stream or video link first.' };
      const parsed = links.map(parseVideoUrl);
      const valid = parsed.filter((p): p is NonNullable<typeof p> => p !== null);
      return addStreams(valid, parsed.length - valid.length);
    },
    [addStreams]
  );

  return { addFromText, addStreams };
}
