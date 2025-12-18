import React, { useState } from 'react';
import { useVideo } from '../../contexts/VideoContext';
import { parseVideoUrl } from '../../services/urlParser';
import styles from './Header.module.css';

export function Header() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { addVideo, slots } = useVideo();

  const hasEmptySlot = slots.some(slot => slot.platform === null);

  const handleAdd = () => {
    setError('');

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!hasEmptySlot) {
      setError('All slots are full. Clear a slot first.');
      return;
    }

    const parsed = parseVideoUrl(url);

    if (!parsed) {
      setError('Invalid URL. Please enter a valid YouTube, Twitch, or Kick URL.');
      return;
    }

    addVideo(parsed.platform!, parsed.videoId);
    setUrl('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <header className={styles.header}>
      <img 
        src="/twill.jpg" 
        alt="TWill Logo" 
        className={styles.logo}
      />
      <div className={styles.inputContainer}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Paste YouTube, Twitch, or Kick URL..."
          className={styles.input}
        />
        <button
          onClick={handleAdd}
          disabled={!hasEmptySlot}
          className={styles.addButton}
        >
          ADD
        </button>
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </header>
  );
}
