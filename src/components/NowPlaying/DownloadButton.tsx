import { useState } from 'react';
import styles from './DownloadButton.module.css';

interface DownloadButtonProps {
  platform: string;
  videoId: string;
  slotId: number;
}

export function DownloadButton({ platform, videoId }: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const getVideoUrl = () => {
    switch (platform) {
      case 'youtube':
        return `https://www.youtube.com/watch?v=${videoId}`;
      case 'twitch':
        return `https://www.twitch.tv/${videoId}`;
      case 'kick':
        return `https://kick.com/${videoId}`;
      default:
        return '';
    }
  };

  const handleDownload = async () => {
    const url = getVideoUrl();
    if (!url) return;

    setIsDownloading(true);
    setStatus('downloading');
    setMessage('Downloading video from source...');

    try {
      const response = await fetch('http://localhost:3001/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Download request failed');
      }

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(`✅ Uploaded to cloud!`);
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.message || data.error || 'Download failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${styles[status]}`}
        onClick={handleDownload}
        disabled={isDownloading}
        title="Download and upload to cloud"
      >
        {isDownloading ? '⏳' : '💾'}
      </button>
      {message && (
        <div className={`${styles.message} ${styles[status]}`}>
          {message}
        </div>
      )}
    </div>
  );
}
