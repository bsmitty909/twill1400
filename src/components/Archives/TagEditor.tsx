import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { archiveApi } from '../../services/archiveApi';
import type { ArchiveRecording } from '../../services/archiveApi';
import { CloseIcon, PlusIcon } from '../Icons';
import styles from './Archives.module.css';

export const TAG_SUGGESTIONS_ID = 'archive-tag-suggestions';
const MAX_TAGS = 20;

interface TagEditorProps {
  recording: ArchiveRecording;
  activeTag: string | null;
  onFilter: (tag: string) => void;
  act: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}

/**
 * Tag chips for one recording. Clicking a tag filters the list to it; the
 * "+ Tag" field accepts one or several comma-separated tags and suggests
 * tags already used elsewhere in the archive.
 */
export function TagEditor({ recording, activeTag, onFilter, act }: TagEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const tags = recording.tags;

  const save = (next: string[]) => act(() => archiveApi.setTags(recording.id, next));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const incoming = draft.split(',').map(t => t.trim()).filter(Boolean);
    setDraft('');
    if (!incoming.length) {
      setAdding(false);
      return;
    }
    const known = new Set(tags.map(t => t.toLowerCase()));
    const merged = [...tags, ...incoming.filter(t => !known.has(t.toLowerCase()))].slice(0, MAX_TAGS);
    if (merged.length !== tags.length) void save(merged);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDraft('');
      setAdding(false);
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      void save(tags.slice(0, -1));
    }
  };

  return (
    <div className={styles.tags} aria-label="Tags">
      {tags.map(tag => (
        <span key={tag} className={`${styles.tag} ${activeTag?.toLowerCase() === tag.toLowerCase() ? styles.tagActive : ''}`}>
          <button type="button" className={styles.tagName} onClick={() => onFilter(tag)} title={`Show recordings tagged "${tag}"`}>
            #{tag}
          </button>
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => void save(tags.filter(t => t !== tag))}
            aria-label={`Remove tag ${tag}`}
          >
            <CloseIcon size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <form className={styles.tagForm} onSubmit={submit}>
          <input
            className={styles.tagInput}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => submit()}
            list={TAG_SUGGESTIONS_ID}
            placeholder="tag, another"
            maxLength={120}
            aria-label="Add tags (comma separated)"
            autoFocus
          />
        </form>
      ) : (
        tags.length < MAX_TAGS && (
          <button type="button" className={styles.tagAdd} onClick={() => setAdding(true)}>
            <PlusIcon size={11} />
            Tag
          </button>
        )
      )}
    </div>
  );
}
