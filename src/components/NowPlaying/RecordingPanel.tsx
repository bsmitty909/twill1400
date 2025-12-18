import React, { useState } from 'react';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import styles from './RecordingPanel.module.css';

interface RecordingPanelProps {
  gridRef: React.RefObject<HTMLDivElement>;
}

export function RecordingPanel({ gridRef }: RecordingPanelProps) {
  const {
    isRecording,
    recordedBlob,
    duration,
    error,
    startRecording,
    stopRecording,
    clearRecording,
  } = useMediaRecorder();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    setUploadSuccess(false);
    setUploadError(null);
    await startRecording();
  };

  const handleDownload = () => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twill-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('video', recordedBlob, `twill-recording-${Date.now()}.webm`);

      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadSuccess(true);
        console.log('Video uploaded:', data.url);
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>🎥 Recording</h3>
      
      <div className={styles.controls}>
        {!isRecording && !recordedBlob && (
          <button 
            className={`${styles.button} ${styles.recordButton}`}
            onClick={handleStartRecording}
          >
            ⏺ Start Recording
          </button>
        )}

        {isRecording && (
          <>
            <div className={styles.recordingStatus}>
              <span className={styles.recordingDot} />
              Recording: {formatDuration(duration)}
            </div>
            <button 
              className={`${styles.button} ${styles.stopButton}`}
              onClick={stopRecording}
            >
              ⏹ Stop
            </button>
          </>
        )}

        {recordedBlob && !isRecording && (
          <div className={styles.actions}>
            <button 
              className={`${styles.button} ${styles.downloadButton}`}
              onClick={handleDownload}
            >
              📥 Download
            </button>
            <button 
              className={`${styles.button} ${styles.uploadButton}`}
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? '⏳ Uploading...' : '☁️ Upload to Cloud'}
            </button>
            <button 
              className={`${styles.button} ${styles.clearButton}`}
              onClick={clearRecording}
            >
              🗑️ Clear
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>⚠️ {error}</div>
      )}

      {uploadSuccess && (
        <div className={styles.success}>✅ Video uploaded successfully!</div>
      )}

      {uploadError && (
        <div className={styles.error}>❌ Upload failed: {uploadError}</div>
      )}
    </div>
  );
}
