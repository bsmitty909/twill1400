import { useState, useRef, useCallback } from 'react';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordedBlob: Blob | null;
  duration: number;
  error: string | null;
}

export function useMediaRecorder() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordedBlob: null,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          cursor: 'never',
        } as any,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } as any,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      let mimeType = 'video/webm;codecs=vp9,opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setState(prev => ({
          ...prev,
          isRecording: false,
          recordedBlob: blob,
        }));

        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        setState(prev => ({
          ...prev,
          error: 'Recording failed',
          isRecording: false,
        }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      setState({
        isRecording: true,
        isPaused: false,
        recordedBlob: null,
        duration: 0,
        error: null,
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isRecording, state.isPaused]);

  const clearRecording = useCallback(() => {
    setState({
      isRecording: false,
      isPaused: false,
      recordedBlob: null,
      duration: 0,
      error: null,
    });
    chunksRef.current = [];
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  };
}
