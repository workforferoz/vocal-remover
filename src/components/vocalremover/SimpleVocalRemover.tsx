import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useTokenStore } from '../../store/useTokenStore';
import { useUserStore } from '../../store/useUserStore';
import { localEngineService } from '../../services/localEngine';
import { saveAudioBlob } from '../../services/db';
import { decodeAudioFile } from '../../services/dsp/audioDecoder';
import { applyVocalReductionAsync } from '../../services/dsp/vocalReducer';
import { encodeWavBlob, downloadWavFile } from '../../services/dsp/wavEncoder';
import { formatDuration } from '../../services/audioMetadata';
import { FileDropzone } from '../upload/FileDropzone';
import { YouTubeLinkModal, YouTubeIcon } from '../upload/YouTubeLinkModal';
import { isValidYouTubeUrl, downloadYouTubeAudio } from '../../services/youtubeService';
import type { Project } from '../../types';
import {
  Music,
  Mic,
  Play,
  Pause,
  Download,
  RotateCcw,
  Volume2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Coins,
  Sparkles,
} from 'lucide-react';

interface SimpleVocalRemoverProps {
  initialFile?: File | null;
}

export const SimpleVocalRemover: React.FC<SimpleVocalRemoverProps> = ({ initialFile }) => {
  usePageMeta(
    'Vocal Remover - Extract Karaoke & Separate Stems | Ayesha Tech Studio',
    'Extract clean instrumental karaoke tracks and remove vocals from any song with AI.'
  );

  const { engineHealth, checkEngine } = useSettingsStore();
  const { showNotification } = useNotificationStore();
  const { createProject } = useProjectStore();
  const {
    balance: tokenBalance,
    isUnlimited,
    canConvert,
    consumeToken,
    openModal: openTokenModal,
  } = useTokenStore();
  const {
    isAuthenticated,
    openAuthModal,
    pendingFile,
    setPendingFile,
  } = useUserStore();

  // App State
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [stageText, setStageText] = useState<string>('Preparing song...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Result URLs and Blobs
  const [instrumentalUrl, setInstrumentalUrl] = useState<string | null>(null);
  const [vocalsUrl, setVocalsUrl] = useState<string | null>(null);
  const [instrumentalBlob, setInstrumentalBlob] = useState<Blob | null>(null);
  const [vocalsBlob, setVocalsBlob] = useState<Blob | null>(null);

  // Playback State
  const [isPlayingInst, setIsPlayingInst] = useState<boolean>(false);
  const [isPlayingVocals, setIsPlayingVocals] = useState<boolean>(false);
  const [isPlayingBoth, setIsPlayingBoth] = useState<boolean>(false);
  const [instVolume, setInstVolume] = useState<number>(1.0);
  const [vocalsVolume, setVocalsVolume] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // YouTube Audio Extraction State
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState<boolean>(false);
  const [inlineYouTubeUrl, setInlineYouTubeUrl] = useState<string>('');
  const [isInlineExtracting, setIsInlineExtracting] = useState<boolean>(false);

  // Audio Element Refs
  const instAudioRef = useRef<HTMLAudioElement | null>(null);
  const vocalsAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check engine on mount
  useEffect(() => {
    checkEngine();
  }, [checkEngine]);

  // Clean up audio object URLs
  useEffect(() => {
    return () => {
      if (instrumentalUrl && instrumentalUrl.startsWith('blob:')) URL.revokeObjectURL(instrumentalUrl);
      if (vocalsUrl && vocalsUrl.startsWith('blob:')) URL.revokeObjectURL(vocalsUrl);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [instrumentalUrl, vocalsUrl]);

  // Handle Synchronized Playback Events
  useEffect(() => {
    const instEl = instAudioRef.current;
    if (!instEl) return;

    const onTimeUpdate = () => {
      setCurrentTime(instEl.currentTime);
      if (instEl.duration && !isNaN(instEl.duration)) {
        setDuration(instEl.duration);
      }
    };

    const onEnded = () => {
      setIsPlayingInst(false);
      setIsPlayingVocals(false);
      setIsPlayingBoth(false);
      setCurrentTime(0);
    };

    instEl.addEventListener('timeupdate', onTimeUpdate);
    instEl.addEventListener('ended', onEnded);

    return () => {
      instEl.removeEventListener('timeupdate', onTimeUpdate);
      instEl.removeEventListener('ended', onEnded);
    };
  }, [instrumentalUrl]);

  // In-Browser DSP Fallback (100% offline via Web Audio API)
  const runBrowserDSP = useCallback(
    async (audioFile: File) => {
      setStageText('Decoding audio in browser...');
      setProgress(30);

      try {
        const decoded = await decodeAudioFile(audioFile);
        setDuration(decoded.duration);
        setProgress(60);
        setStageText('Canceling vocal frequencies and extracting instrumental...');

        const reduced = await applyVocalReductionAsync(
          decoded.channels,
          decoded.sampleRate,
          { strength: 0.95 },
          (pct: number) => {
            setProgress(Math.round(60 + pct * 0.25));
          }
        );

        setProgress(85);
        setStageText('Encoding instrumental and vocals into WAV files...');

        const instBlob = encodeWavBlob(reduced.channels, decoded.sampleRate);
        const vocChannels = reduced.vocalChannels || reduced.channels;
        const vocBlob = encodeWavBlob(vocChannels, decoded.sampleRate);

        const instUrl = URL.createObjectURL(instBlob);
        const vocUrl = URL.createObjectURL(vocBlob);

        setInstrumentalBlob(instBlob);
        setVocalsBlob(vocBlob);
        setInstrumentalUrl(instUrl);
        setVocalsUrl(vocUrl);

        // Save to project store
        const projId = `song_${Date.now()}`;
        const newProj: Project = {
          id: projId,
          name: audioFile.name.replace(/\.[^/.]+$/, ''),
          originalFileName: audioFile.name,
          fileSize: audioFile.size,
          mimeType: audioFile.type || 'audio/wav',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          duration: decoded.duration,
          metadata: {
            fileSize: audioFile.size,
            format: 'wav',
            duration: decoded.duration,
            sampleRate: decoded.sampleRate,
            channels: decoded.channels.length,
          },
          config: {
            mode: 'quick-local',
            stems: ['instrumental', 'vocals'],
            outputFormat: 'wav',
            quality: 'fast',
            applyNoiseReduction: false,
            normalizeLoudness: true,
          },
          status: 'completed',
          deviceUsed: 'Browser Web Audio API',
          stems: [
            {
              id: `${projId}_inst`,
              type: 'instrumental',
              label: 'Instrumental',
              format: 'wav',
              available: true,
              fileSize: instBlob.size,
              url: instUrl,
            },
            {
              id: `${projId}_voc`,
              type: 'vocals',
              label: 'Vocals',
              format: 'wav',
              available: true,
              fileSize: vocBlob.size,
              url: vocUrl,
            },
          ],
        };
        createProject(newProj);
        await saveAudioBlob(projId, instBlob, 'audio/wav', `${newProj.name}_instrumental.wav`);
        await saveAudioBlob(projId, vocBlob, 'audio/wav', `${newProj.name}_vocals.wav`);

        setProgress(100);
        setStatus('done');
        showNotification({
          type: 'success',
          title: 'Instrumental Ready!',
          message: 'Vocals removed using browser audio processing. Ready to download.',
        });
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to process audio.');
        showNotification({
          type: 'error',
          title: 'Processing Failed',
          message: 'Could not decode or remove vocals from this audio file.',
        });
      }
    },
    [createProject, showNotification]
  );

  // Execute Vocal Removal Process
  const processSong = useCallback(
    async (audioFile: File) => {
      // 1. Verify user authentication (must be logged in to account)
      if (!isAuthenticated) {
        openAuthModal('login', audioFile);
        showNotification({
          type: 'info',
          title: 'Sign In Required',
          message: 'Please sign in or create an account to process this song.',
        });
        return;
      }

      // 2. Verify token balance
      if (!canConvert()) {
        openTokenModal();
        showNotification({
          type: 'warning',
          title: '0 Tokens Left',
          message: 'You have used all available tokens. Please activate your token code to continue.',
        });
        return;
      }

      // 2. Consume 1 token for this conversion (or bypass if unlimited)
      const tokenResult = consumeToken(audioFile.name);
      if (!isUnlimited) {
        showNotification({
          type: 'info',
          title: '1 Token Used',
          message: tokenResult.message,
        });
      }

      setFile(audioFile);
      setStatus('processing');
      setProgress(5);
      setErrorMessage(null);
      setStageText('Analyzing audio file...');

      // Stop any current playback
      if (instAudioRef.current) instAudioRef.current.pause();
      if (vocalsAudioRef.current) vocalsAudioRef.current.pause();
      setIsPlayingInst(false);
      setIsPlayingVocals(false);
      setIsPlayingBoth(false);

      // 1. Try Demucs AI Engine if connected
      if (engineHealth.connected) {
        try {
          setStageText('Processing song...');
          setProgress(15);

          const jobResponse = await localEngineService.createSeparationJob(
            audioFile,
            'htdemucs',
            (pct: number) => {
              setProgress(Math.round(15 + pct * 0.15));
            }
          );

          const jobId = jobResponse.job_id;

          // Poll job execution status
          pollTimerRef.current = setInterval(async () => {
            try {
              const jobStatus = await localEngineService.getJobStatus(jobId);

              if (jobStatus.status === 'processing') {
                const currentPct = jobStatus.progress || 35;
                setProgress(Math.min(95, Math.max(30, currentPct)));
                setStageText(jobStatus.stage || 'Isolating vocals and music...');
              } else if (jobStatus.status === 'completed') {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                setProgress(95);
                setStageText('Retrieving separated instrumental and vocals...');

                // Fetch Instrumental Blob
                const instBlob = await localEngineService.fetchStemBlob(jobId, 'instrumental');
                const vocBlob = await localEngineService.fetchStemBlob(jobId, 'vocals');

                const instUrl = URL.createObjectURL(instBlob);
                const vocUrl = URL.createObjectURL(vocBlob);

                setInstrumentalBlob(instBlob);
                setVocalsBlob(vocBlob);
                setInstrumentalUrl(instUrl);
                setVocalsUrl(vocUrl);

                // Save project record
                const projId = `song_${Date.now()}`;
                const newProject: Project = {
                  id: projId,
                  name: audioFile.name.replace(/\.[^/.]+$/, ''),
                  originalFileName: audioFile.name,
                  fileSize: audioFile.size,
                  mimeType: audioFile.type || 'audio/wav',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  duration: duration || 0,
                  metadata: {
                    fileSize: audioFile.size,
                    format: 'wav',
                    duration: duration || 0,
                    sampleRate: 44100,
                    channels: 2,
                  },
                  config: {
                    mode: 'ai-pro',
                    stems: ['instrumental', 'vocals'],
                    outputFormat: 'wav',
                    quality: 'high',
                    applyNoiseReduction: false,
                    normalizeLoudness: true,
                  },
                  status: 'completed',
                  deviceUsed: engineHealth.device || 'Local AI Engine',
                  modelUsed: 'htdemucs',
                  stems: [
                    {
                      id: `${projId}_inst`,
                      type: 'instrumental',
                      label: 'Instrumental',
                      format: 'wav',
                      available: true,
                      fileSize: instBlob.size,
                      url: instUrl,
                    },
                    {
                      id: `${projId}_voc`,
                      type: 'vocals',
                      label: 'Vocals',
                      format: 'wav',
                      available: true,
                      fileSize: vocBlob.size,
                      url: vocUrl,
                    },
                  ],
                };

                createProject(newProject);
                await saveAudioBlob(projId, instBlob, 'audio/wav', `${newProject.name}_instrumental.wav`);

                setProgress(100);
                setStatus('done');
                showNotification({
                  type: 'success',
                  title: 'Vocals Removed Successfully!',
                  message: 'Your instrumental is ready to play and download.',
                });
              } else if (jobStatus.status === 'failed') {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                throw new Error(jobStatus.error || 'Separation job failed.');
              }
            } catch (err: unknown) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              console.warn('AI separation encountered error, falling back to Browser Local mode:', err);
              runBrowserDSP(audioFile);
            }
          }, 1500);

          return;
        } catch (err: unknown) {
          console.warn('AI engine upload failed, falling back to Browser Local:', err);
          runBrowserDSP(audioFile);
          return;
        }
      }

      // 2. If Demucs engine is offline, run instant in-browser DSP vocal reduction
      runBrowserDSP(audioFile);
    },
    [
      isAuthenticated,
      isUnlimited,
      openAuthModal,
      canConvert,
      openTokenModal,
      consumeToken,
      engineHealth.connected,
      engineHealth.device,
      duration,
      createProject,
      showNotification,
      runBrowserDSP,
    ]
  );

  // Intercept file chooser open to require login
  const handleBeforeOpen = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal('login');
      showNotification({
        type: 'info',
        title: 'Sign In Required',
        message: 'Please sign in or create an account to upload songs.',
      });
      return false;
    }
    return true;
  }, [isAuthenticated, openAuthModal, showNotification]);

  // Intercept drag-and-drop to require login and preserve dropped file
  const handleBeforeDrop = useCallback(
    (droppedFile: File) => {
      if (!isAuthenticated) {
        openAuthModal('login', droppedFile);
        showNotification({
          type: 'info',
          title: 'Sign In Required',
          message: 'Please sign in or create an account to process this song.',
        });
        return false;
      }
      return true;
    },
    [isAuthenticated, openAuthModal, showNotification]
  );

  // Open YouTube Modal with authentication check
  const handleYouTubeClick = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal('login');
      showNotification({
        type: 'info',
        title: 'Sign In Required',
        message: 'Please sign in or create an account to process YouTube songs.',
      });
      return;
    }
    setIsYouTubeModalOpen(true);
  }, [isAuthenticated, openAuthModal, showNotification]);

  // Handle quick inline YouTube URL submission
  const handleInlineYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = inlineYouTubeUrl.trim();
    if (!cleanUrl) return;

    if (!isAuthenticated) {
      openAuthModal('login');
      showNotification({
        type: 'info',
        title: 'Sign In Required',
        message: 'Please sign in or create an account to process YouTube songs.',
      });
      return;
    }

    if (!isValidYouTubeUrl(cleanUrl)) {
      showNotification({
        type: 'error',
        title: 'Invalid YouTube URL',
        message: 'Please paste a valid YouTube link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)',
      });
      return;
    }

    if (!canConvert()) {
      openTokenModal();
      showNotification({
        type: 'warning',
        title: '0 Tokens Left',
        message: 'You have used all available tokens. Please activate your token code to continue.',
      });
      return;
    }

    setIsInlineExtracting(true);
    showNotification({
      type: 'info',
      title: 'Fetching YouTube Audio',
      message: 'Downloading audio stream from YouTube...',
    });

    try {
      const downloadedFile = await downloadYouTubeAudio(cleanUrl);
      setInlineYouTubeUrl('');
      setIsInlineExtracting(false);
      await processSong(downloadedFile);
    } catch (err: unknown) {
      setIsInlineExtracting(false);
      const msg = err instanceof Error ? err.message : 'Failed to download YouTube audio.';
      showNotification({
        type: 'error',
        title: 'YouTube Download Error',
        message: msg,
      });
    }
  };

  // When user successfully signs in, resume processing any pending file
  useEffect(() => {
    if (isAuthenticated && pendingFile && status === 'idle') {
      const fileToProcess = pendingFile;
      setPendingFile(null);
      const timer = setTimeout(() => {
        processSong(fileToProcess);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, pendingFile, status, processSong, setPendingFile]);

  // Playback Control Handlers
  const togglePlayInstrumental = () => {
    const instEl = instAudioRef.current;
    if (!instEl) return;

    if (isPlayingInst) {
      instEl.pause();
      setIsPlayingInst(false);
      setIsPlayingBoth(false);
    } else {
      if (vocalsAudioRef.current && !isPlayingBoth) {
        vocalsAudioRef.current.pause();
        setIsPlayingVocals(false);
      }
      instEl.play();
      setIsPlayingInst(true);
    }
  };

  const togglePlayVocals = () => {
    const vocEl = vocalsAudioRef.current;
    if (!vocEl) return;

    if (isPlayingVocals) {
      vocEl.pause();
      setIsPlayingVocals(false);
      setIsPlayingBoth(false);
    } else {
      if (instAudioRef.current && !isPlayingBoth) {
        instAudioRef.current.pause();
        setIsPlayingInst(false);
      }
      vocEl.play();
      setIsPlayingVocals(true);
    }
  };

  const togglePlayBoth = () => {
    const instEl = instAudioRef.current;
    const vocEl = vocalsAudioRef.current;
    if (!instEl) return;

    if (isPlayingBoth) {
      instEl.pause();
      if (vocEl) vocEl.pause();
      setIsPlayingBoth(false);
      setIsPlayingInst(false);
      setIsPlayingVocals(false);
    } else {
      // Synchronize times
      if (vocEl) vocEl.currentTime = instEl.currentTime;
      instEl.play();
      if (vocEl) vocEl.play();
      setIsPlayingBoth(true);
      setIsPlayingInst(true);
      setIsPlayingVocals(true);
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (instAudioRef.current) instAudioRef.current.currentTime = newTime;
    if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = newTime;
  };

  const handleDownloadInstrumental = () => {
    if (!instrumentalBlob && !instrumentalUrl) return;
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'song';

    if (instrumentalBlob) {
      downloadWavFile(instrumentalBlob, baseName, '_instrumental');
    } else if (instrumentalUrl) {
      const a = document.createElement('a');
      a.href = instrumentalUrl;
      a.download = `${baseName}_instrumental.wav`;
      a.click();
    }
    showNotification({
      type: 'success',
      title: 'Downloading Instrumental',
      message: `Saved ${baseName}_instrumental.wav`,
    });
  };

  const handleDownloadVocals = () => {
    if (!vocalsBlob && !vocalsUrl) return;
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'song';

    if (vocalsBlob) {
      downloadWavFile(vocalsBlob, baseName, '_vocals');
    } else if (vocalsUrl) {
      const a = document.createElement('a');
      a.href = vocalsUrl;
      a.download = `${baseName}_vocals.wav`;
      a.click();
    }
    showNotification({
      type: 'success',
      title: 'Downloading Vocals',
      message: `Saved ${baseName}_vocals.wav`,
    });
  };

  const handleReset = () => {
    if (instAudioRef.current) instAudioRef.current.pause();
    if (vocalsAudioRef.current) vocalsAudioRef.current.pause();
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    setFile(null);
    setStatus('idle');
    setProgress(0);
    setInstrumentalUrl(null);
    setVocalsUrl(null);
    setInstrumentalBlob(null);
    setVocalsBlob(null);
    setIsPlayingInst(false);
    setIsPlayingVocals(false);
    setIsPlayingBoth(false);
    setCurrentTime(0);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Hidden Audio Elements for Playback */}
      {instrumentalUrl && (
        <audio
          ref={instAudioRef}
          src={instrumentalUrl}
          preload="auto"
          onPlay={() => setIsPlayingInst(true)}
          onPause={() => setIsPlayingInst(false)}
        />
      )}
      {vocalsUrl && (
        <audio
          ref={vocalsAudioRef}
          src={vocalsUrl}
          preload="auto"
          onPlay={() => setIsPlayingVocals(true)}
          onPause={() => setIsPlayingVocals(false)}
        />
      )}

      {/* 1. IDLE STATE: Upload Hero Dropzone */}
      {status === 'idle' && (
        <div className="space-y-6">
          <div className="text-center space-y-3 py-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3">
              <span className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
                <Music className="w-6 h-6" />
              </span>
              <span>Vocal Remover</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
              Extract the <strong>instrumental (karaoke)</strong> and remove vocals from any song.
              Fast, clean, and high quality audio.
            </p>

            {/* Token Status Badge */}
            <div className="pt-1 flex justify-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 shadow-xs">
                <Coins className="w-3.5 h-3.5 text-blue-400" />
                {isUnlimited ? (
                  <>
                    <span className="text-emerald-400 font-bold">Unlimited Conversions Active</span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-slate-300">No Limit</span>
                  </>
                ) : (
                  <>
                    <span>
                      Available: <strong className="text-white font-bold">{tokenBalance} Tokens</strong>
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-emerald-400 font-semibold">1 Conversion = 1 Token</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={openTokenModal}
                  className="ml-1 text-[11px] font-bold text-blue-400 hover:text-white underline cursor-pointer"
                >
                  {isUnlimited ? 'Tokens' : 'Buy More'}
                </button>
              </div>
            </div>
          </div>

          {/* Big Audio Dropzone & YouTube Option */}
          <div className="p-2 sm:p-4 rounded-3xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-3.5">
            <FileDropzone
              onFileAccepted={(f) => processSong(f)}
              onBeforeOpen={handleBeforeOpen}
              onBeforeDrop={handleBeforeDrop}
              onYouTubeClick={handleYouTubeClick}
            />

            {/* Quick Inline YouTube Link Bar */}
            <form
              onSubmit={handleInlineYouTubeSubmit}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center gap-2.5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                <div className="w-6 h-6 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                  <YouTubeIcon className="w-3.5 h-3.5 text-red-500" />
                </div>
                <span className="hidden sm:inline">YouTube Link:</span>
              </div>
              <input
                type="url"
                value={inlineYouTubeUrl}
                onChange={(e) => setInlineYouTubeUrl(e.target.value)}
                disabled={isInlineExtracting}
                placeholder="Paste YouTube song link (e.g. https://www.youtube.com/watch?v=...)"
                className="flex-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isInlineExtracting || !inlineYouTubeUrl.trim()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isInlineExtracting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Get Result</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. PROCESSING STATE: Clear Progress Bar */}
      {status === 'processing' && (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0F172A] border border-slate-800 shadow-xl text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm animate-pulse">
            <RefreshCw className="w-7 h-7 text-white animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Removing Vocals from Song
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto truncate font-mono">
              {file?.name}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(progress, 8)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
              <span>{stageText}</span>
              <span className="font-bold text-white">{progress}%</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Extracting vocal and instrumental audio tracks...
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 3. ERROR STATE */}
      {status === 'error' && (
        <div className="p-8 rounded-3xl bg-[#0F172A] border border-rose-500/30 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Could Not Remove Vocals</h3>
          <p className="text-xs text-rose-300 max-w-md mx-auto">{errorMessage}</p>
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Another Song</span>
          </button>
        </div>
      )}

      {/* 4. COMPLETED RESULTS: Clean Instrumental + Vocals Downloader */}
      {status === 'done' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Vocals Removed Successfully
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 truncate max-w-lg">
                Track: <span className="text-white font-medium">{file?.name}</span> - Duration:{' '}
                <span className="text-slate-200 font-mono">{formatDuration(duration || 0)}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer w-full sm:w-auto justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Process Another Song</span>
            </button>
          </div>

          {/* Master Scrubber Timeline */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
              <span>{formatDuration(currentTime)}</span>
              <button
                type="button"
                onClick={togglePlayBoth}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPlayingBoth ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pause Both</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-blue-400 fill-current" />
                    <span>Play Both (Preview Mix)</span>
                  </>
                )}
              </button>
              <span>{formatDuration(duration)}</span>
            </div>

            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* TWO MAIN CARDS: 1. INSTRUMENTAL & 2. VOCALS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. INSTRUMENTAL CARD */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0F172A] border-2 border-emerald-500/40 hover:border-emerald-500 shadow-xl transition-colors space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">Instrumental</h3>
                      <p className="text-xs text-emerald-400 font-medium">Music only - Vocals removed</p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                    Karaoke
                  </span>
                </div>

                {/* Player Row */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlayInstrumental}
                    className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center font-bold transition-colors shadow-sm cursor-pointer flex-shrink-0"
                    aria-label={isPlayingInst ? 'Pause Instrumental' : 'Play Instrumental'}
                  >
                    {isPlayingInst ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Volume</span>
                      </span>
                      <span className="font-mono">{Math.round(instVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={instVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setInstVolume(val);
                        if (instAudioRef.current) instAudioRef.current.volume = val;
                      }}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Download Instrumental Button */}
              <button
                type="button"
                onClick={handleDownloadInstrumental}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Instrumental (WAV)</span>
              </button>
            </div>

            {/* 2. VOCALS CARD */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 shadow-xl transition-colors space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">Vocals</h3>
                      <p className="text-xs text-blue-400 font-medium">Isolated vocals - A cappella</p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                    A Cappella
                  </span>
                </div>

                {/* Player Row */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlayVocals}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center font-bold transition-colors shadow-sm cursor-pointer flex-shrink-0"
                    aria-label={isPlayingVocals ? 'Pause Vocals' : 'Play Vocals'}
                  >
                    {isPlayingVocals ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Volume</span>
                      </span>
                      <span className="font-mono">{Math.round(vocalsVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={vocalsVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVocalsVolume(val);
                        if (vocalsAudioRef.current) vocalsAudioRef.current.volume = val;
                      }}
                      className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Download Vocals Button */}
              <button
                type="button"
                onClick={handleDownloadVocals}
                className="w-full py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Download Vocals (WAV)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Link Extraction Modal */}
      <YouTubeLinkModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onAudioLoaded={(loadedFile) => processSong(loadedFile)}
      />
    </div>
  );
};
