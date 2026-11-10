import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useProjectStore } from '../../store/useProjectStore';
import { localEngineService } from '../../services/localEngine';
import { saveAudioBlob } from '../../services/db';
import { decodeAudioFile } from '../../services/dsp/audioDecoder';
import { applyVocalReductionAsync } from '../../services/dsp/vocalReducer';
import { encodeWavBlob, downloadWavFile } from '../../services/dsp/wavEncoder';
import { formatDuration } from '../../services/audioMetadata';
import { FileDropzone } from '../upload/FileDropzone';
import type { Project } from '../../types';
import {
  Music,
  Mic,
  Play,
  Pause,
  Download,
  RotateCcw,
  Volume2,
  Sparkles,
  Zap,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface SimpleVocalRemoverProps {
  initialFile?: File | null;
}

export const SimpleVocalRemover: React.FC<SimpleVocalRemoverProps> = ({ initialFile }) => {
  const { engineHealth, checkEngine } = useSettingsStore();
  const { showNotification } = useNotificationStore();
  const { createProject } = useProjectStore();

  // App State
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [stageText, setStageText] = useState<string>('Preparing song...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<'demucs' | 'browser-dsp'>('demucs');

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
      setEngineUsed('browser-dsp');
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
        setEngineUsed('demucs');
        try {
          setStageText('Uploading song to local Demucs AI engine...');
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
                setStageText(jobStatus.stage || 'Demucs neural network is isolating vocals and music...');
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
    [engineHealth.connected, engineHealth.device, duration, createProject, showNotification, runBrowserDSP]
  );

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
          <div className="text-center space-y-2 py-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3">
              <span className="p-2 rounded-2xl bg-gradient-to-tr from-[#7357F5] to-[#3984FF] shadow-lg shadow-indigo-500/25">
                <Music className="w-7 h-7 text-white" />
              </span>
              <span>Vocal Remover</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto">
              Extract the <strong>instrumental (karaoke)</strong> and remove vocals from any song.
              100% free, private, and runs directly on your computer.
            </p>
          </div>

          {/* Engine Status Banner */}
          <div className="flex items-center justify-center">
            {engineHealth.connected ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16C784]/15 border border-[#16C784]/30 text-[#16C784] text-xs font-semibold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#16C784] animate-pulse" />
                <span>AI Separation Active (Demucs Neural Network)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3984FF]/15 border border-[#3984FF]/30 text-[#3984FF] text-xs font-semibold shadow-xs">
                <Zap className="w-3.5 h-3.5" />
                <span>Fast In-Browser Engine Active</span>
              </div>
            )}
          </div>

          {/* Big Audio Dropzone */}
          <div className="p-2 sm:p-4 rounded-3xl bg-[#151F30]/80 border border-white/10 shadow-2xl backdrop-blur-md">
            <FileDropzone onFileAccepted={(f) => processSong(f)} />
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-400">
            <div className="p-3.5 rounded-2xl bg-[#101827] border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-white">Instant Download</p>
                <p className="text-[11px] text-slate-400">Download clean instrumental in 16-bit WAV</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#101827] border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#7357F5]/10 text-[#7357F5] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-white">AI Vocal Removal</p>
                <p className="text-[11px] text-slate-400">Pristine separation using Demucs AI</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#101827] border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-white">100% Offline & Private</p>
                <p className="text-[11px] text-slate-400">Your songs never leave your PC</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROCESSING STATE: Clear Progress Bar */}
      {status === 'processing' && (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#151F30] border border-white/10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#7357F5] to-[#3984FF] flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 animate-pulse">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Removing Vocals from Song...
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto truncate">
              {file?.name}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-full h-3 rounded-full bg-[#101827] border border-white/10 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7357F5] via-[#5b40e6] to-[#16C784] transition-all duration-300 ease-out"
                style={{ width: `${Math.max(progress, 8)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>{stageText}</span>
              <span className="font-bold text-white">{progress}%</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {engineUsed === 'demucs'
              ? 'Deep neural inference in progress. All processing remains 100% on your machine.'
              : 'Processing audio in-browser via Web Audio API.'}
          </p>

          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 3. ERROR STATE */}
      {status === 'error' && (
        <div className="p-8 rounded-3xl bg-[#151F30] border border-rose-500/30 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Could Not Remove Vocals</h3>
          <p className="text-xs text-rose-300 max-w-md mx-auto">{errorMessage}</p>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] text-white text-xs font-bold transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
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
          <div className="p-5 sm:p-6 rounded-3xl bg-[#151F30] border border-white/10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#16C784]" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Vocals Removed Successfully!
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate max-w-lg">
                Track: <span className="text-white font-medium">{file?.name}</span> • Duration:{' '}
                <span className="text-slate-300 font-mono">{formatDuration(duration || 0)}</span>
              </p>
            </div>

            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer w-full sm:w-auto justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Process Another Song</span>
            </button>
          </div>

          {/* Master Scrubber Timeline */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#101827] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>{formatDuration(currentTime)}</span>
              <button
                onClick={togglePlayBoth}
                className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPlayingBoth ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#16C784]" />
                    <span>Pause Both</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#7357F5] fill-current" />
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
              className="w-full accent-[#7357F5] h-2 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

          {/* TWO MAIN CARDS: 1. INSTRUMENTAL & 2. VOCALS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. INSTRUMENTAL CARD */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-[#101827] to-[#151F30] border-2 border-[#16C784]/40 hover:border-[#16C784] shadow-xl transition-all space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#16C784]/20 border border-[#16C784]/40 flex items-center justify-center text-[#16C784] shadow-md">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">Instrumental</h3>
                      <p className="text-xs text-[#16C784] font-medium">Music only • Vocals removed</p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#16C784]/15 text-[#16C784] font-bold border border-[#16C784]/30">
                    Karaoke / Music
                  </span>
                </div>

                {/* Player Row */}
                <div className="p-3.5 rounded-2xl bg-[#080D18]/80 border border-white/5 flex items-center gap-3">
                  <button
                    onClick={togglePlayInstrumental}
                    className="w-11 h-11 rounded-xl bg-[#16C784] hover:bg-[#13b074] active:scale-95 text-slate-950 flex items-center justify-center font-bold transition-all shadow-md cursor-pointer flex-shrink-0"
                    aria-label={isPlayingInst ? 'Pause' : 'Play Instrumental'}
                  >
                    {isPlayingInst ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
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
                      className="w-full accent-[#16C784] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Big Download Instrumental Button */}
              <button
                onClick={handleDownloadInstrumental}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#16C784] to-[#10b981] hover:brightness-110 active:scale-[0.99] text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Download Instrumental (WAV)</span>
              </button>
            </div>

            {/* 2. VOCALS CARD */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-[#101827] to-[#151F30] border border-white/10 hover:border-[#7357F5]/50 shadow-xl transition-all space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#7357F5]/20 border border-[#7357F5]/40 flex items-center justify-center text-[#7357F5] shadow-md">
                      <Mic className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">Vocals</h3>
                      <p className="text-xs text-[#a594fd] font-medium">Isolated vocals • A cappella</p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#7357F5]/15 text-[#a594fd] font-bold border border-[#7357F5]/30">
                    A Cappella
                  </span>
                </div>

                {/* Player Row */}
                <div className="p-3.5 rounded-2xl bg-[#080D18]/80 border border-white/5 flex items-center gap-3">
                  <button
                    onClick={togglePlayVocals}
                    className="w-11 h-11 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] active:scale-95 text-white flex items-center justify-center font-bold transition-all shadow-md cursor-pointer flex-shrink-0"
                    aria-label={isPlayingVocals ? 'Pause' : 'Play Vocals'}
                  >
                    {isPlayingVocals ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
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
                      className="w-full accent-[#7357F5] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Download Vocals Button */}
              <button
                onClick={handleDownloadVocals}
                className="w-full py-4 px-6 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-[0.99] text-white font-extrabold text-sm border border-white/10 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Download className="w-5 h-5 text-[#a594fd]" />
                <span>Download Vocals (WAV)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
