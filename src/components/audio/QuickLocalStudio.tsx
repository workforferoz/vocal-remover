import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  decodeAudioFile,
  type DecodedAudioPayload,
} from '../../services/dsp/audioDecoder';
import {
  applyVocalReductionAsync,
  type ReductionResult,
} from '../../services/dsp/vocalReducer';
import {
  encodeWavBlob,
  downloadWavFile,
} from '../../services/dsp/wavEncoder';
import { CanvasWaveform } from './CanvasWaveform';
import { formatDuration, formatFileSize } from '../../services/audioMetadata';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useJobStore } from '../../store/useJobStore';
import type { ProcessingStage, Project, ProcessingJob } from '../../types';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Sliders,
  Volume2,
  VolumeX,
  Repeat,
  FastForward,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
  Activity,
  HardDrive,
  Radio,
  Clock,
  Layers,
  FileAudio,
  Cpu,
} from 'lucide-react';

interface QuickLocalStudioProps {
  initialFile?: File;
  onClose?: () => void;
}

export const QuickLocalStudio: React.FC<QuickLocalStudioProps> = ({
  initialFile,
}) => {
  const { showNotification } = useNotificationStore();
  const { createProject } = useProjectStore();
  const { createJob } = useJobStore();

  // Core audio data state
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [decodedData, setDecodedData] = useState<DecodedAudioPayload | null>(null);
  const [processedResult, setProcessedResult] = useState<ReductionResult | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);

  // URLs for audio playback
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null);

  // Processing configuration and state
  const [strength, setStrength] = useState<number>(0.9); // 90% default for optimal cancellation
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('ready');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to analyze');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingDurationMs, setProcessingDurationMs] = useState<number>(0);

  // Playback & A/B comparison state
  const [activeTrack, setActiveTrack] = useState<'A' | 'B'>('B'); // 'A' = Original, 'B' = Processed
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Hidden audio element refs
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);

  // Clean up Object URLs when unmounting or loading new files
  useEffect(() => {
    return () => {
      if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
      if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);
    };
  }, [originalAudioUrl, processedAudioUrl]);

  // Handle loading and decoding audio file
  const loadAndDecodeFile = useCallback(
    async (audioFile: File) => {
      setFile(audioFile);
      setErrorMessage(null);
      setDecodedData(null);
      setProcessedResult(null);
      setProcessedBlob(null);
      setIsPlaying(false);
      setCurrentTime(0);

      // Create object URL for original track
      if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
      const originalUrl = URL.createObjectURL(audioFile);
      setOriginalAudioUrl(originalUrl);

      setProcessingStage('loading');
      setStatusMessage('Reading and decoding audio file with Web Audio API...');

      try {
        const decoded = await decodeAudioFile(audioFile, audioFile.name, (msg) => {
          setStatusMessage(msg);
        });

        setDecodedData(decoded);
        setProcessingStage('ready');
        setStatusMessage('Audio decoded and analyzed successfully');

        showNotification({
          type: 'success',
          title: 'Audio Decoded',
          message: `${audioFile.name} (${decoded.numberOfChannels === 1 ? 'Mono' : 'Stereo'}, ${(decoded.duration).toFixed(1)}s, ${decoded.sampleRate}Hz)`,
        });
      } catch (err: unknown) {
        setProcessingStage('failed');
        const msg = err instanceof Error ? err.message : 'Failed to decode audio file';
        setErrorMessage(msg);
        setStatusMessage('Decoding failed');
        showNotification({
          type: 'error',
          title: 'Audio Decode Error',
          message: msg,
        });
      }
    },
    [originalAudioUrl, showNotification]
  );

  // Initial load if file provided
  useEffect(() => {
    if (!initialFile) return;
    const timer = setTimeout(() => {
      loadAndDecodeFile(initialFile);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialFile, loadAndDecodeFile]);

  // Execute genuine DSP vocal reduction
  const handleProcessAudio = async () => {
    if (!decodedData || !file) return;

    setProcessingStage('processing');
    setProgressPercent(0);
    setErrorMessage(null);
    setStatusMessage('Applying DSP center-channel cancellation...');
    const startTime = performance.now();

    try {
      const result = await applyVocalReductionAsync(
        decodedData.channels,
        decodedData.sampleRate,
        { strength },
        (pct) => {
          setProgressPercent(pct);
        }
      );

      const elapsedMs = Math.round(performance.now() - startTime);
      setProcessingDurationMs(elapsedMs);
      setProcessedResult(result);

      // Encode result to real WAV Blob for playback & export
      setStatusMessage('Encoding 16-bit PCM WAV stream...');
      const wavBlob = encodeWavBlob(result.channels, result.sampleRate);
      setProcessedBlob(wavBlob);

      if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);
      const processedUrl = URL.createObjectURL(wavBlob);
      setProcessedAudioUrl(processedUrl);

      setProcessingStage('completed');
      setStatusMessage(`Completed in ${(elapsedMs / 1000).toFixed(2)}s`);
      setActiveTrack('B'); // Default to processed output

      // Auto-save project metadata into IndexedDB
      const projectId = 'proj_quick_' + Math.random().toString(36).substring(2, 9);
      const newProject: Project = {
        id: projectId,
        name: file.name.replace(/\.[^/.]+$/, '') + ' (Vocal Reduced)',
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'audio/wav',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: result.duration,
        metadata: {
          duration: result.duration,
          sampleRate: result.sampleRate,
          channels: result.channels.length,
          format: decodedData.format,
          fileSize: wavBlob.size,
          bitDepth: '16-bit PCM',
          peakAmplitude: result.peakAmplitude,
          peakDb: result.peakAmplitude > 0 ? Math.round(20 * Math.log10(result.peakAmplitude) * 10) / 10 : -96,
          rmsLevel: result.rmsLevel,
          rmsDb: result.rmsLevel > 0 ? Math.round(20 * Math.log10(result.rmsLevel) * 10) / 10 : -96,
          isMono: result.isMono,
        },
        config: {
          mode: 'quick-local',
          stems: ['vocals', 'instrumental'],
          outputFormat: 'wav',
          quality: 'high',
          applyNoiseReduction: false,
          normalizeLoudness: false,
        },
        status: 'completed',
        stems: [
          {
            id: 'stem_' + Math.random().toString(36).substring(2, 7),
            type: 'instrumental',
            label: 'Vocal Reduced Mix',
            format: 'wav',
            available: true,
            fileSize: wavBlob.size,
            notes: `Stereo centre-cancelled at ${Math.round(strength * 100)}% strength.`,
          },
        ],
      };

      const newJob: ProcessingJob = {
        id: 'job_' + Math.random().toString(36).substring(2, 9),
        projectId,
        projectName: newProject.name,
        fileName: file.name,
        mode: 'quick-local',
        status: 'completed',
        startedAt: new Date(Date.now() - elapsedMs).toISOString(),
        completedAt: new Date().toISOString(),
        durationSeconds: parseFloat((elapsedMs / 1000).toFixed(2)),
        progress: 100,
        engine: 'Web Audio DSP (Centre-Channel Phase Cancellation)',
        logs: [
          `Decoded ${decodedData.format} audio: ${decodedData.numberOfChannels} ch @ ${decodedData.sampleRate}Hz`,
          `Applied centre cancellation with reduction strength: ${Math.round(strength * 100)}%`,
          `Input peak: ${decodedData.stats.peakDb} dBFS, Output peak: ${result.peakAmplitude > 0 ? (20 * Math.log10(result.peakAmplitude)).toFixed(1) : '-96'} dBFS`,
          `Encoded 16-bit PCM WAV stream (${formatFileSize(wavBlob.size)}) in ${elapsedMs}ms`,
        ],
      };

      await createProject(newProject, file);
      await createJob(newJob);

      showNotification({
        type: 'success',
        title: 'Processing Complete',
        message: `Vocal reduction applied in ${(elapsedMs / 1000).toFixed(2)}s. Listen to A/B preview or Export WAV.`,
      });
    } catch (err: unknown) {
      setProcessingStage('failed');
      const msg = err instanceof Error ? err.message : 'Processing failed';
      setErrorMessage(msg);
      setStatusMessage('Processing failed');
      showNotification({
        type: 'error',
        title: 'DSP Processing Error',
        message: msg,
      });
    }
  };

  // Export processed WAV file
  const handleExportWav = () => {
    if (!processedBlob || !file) {
      showNotification({
        type: 'error',
        title: 'Export Unavailable',
        message: 'Please process the audio before exporting.',
      });
      return;
    }

    downloadWavFile(processedBlob, file.name, `_vocal-reduced_${Math.round(strength * 100)}pct`);

    showNotification({
      type: 'success',
      title: 'WAV Exported',
      message: `Downloaded genuine 16-bit PCM WAV (${formatFileSize(processedBlob.size)}).`,
    });
  };

  // Sync active audio playback
  const activeAudioEl = activeTrack === 'A' ? audioRefA.current : audioRefB.current;
  const inactiveAudioEl = activeTrack === 'A' ? audioRefB.current : audioRefA.current;

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (!activeAudioEl) return;

    if (isPlaying) {
      activeAudioEl.pause();
      if (inactiveAudioEl) inactiveAudioEl.pause();
      setIsPlaying(false);
    } else {
      activeAudioEl
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn('Play request interrupted:', e));
    }
  };

  // Seamless A/B comparison toggle (Preserves exact playback timestamp!)
  const handleToggleAB = (track: 'A' | 'B') => {
    if (track === activeTrack) return;

    const sourceEl = activeTrack === 'A' ? audioRefA.current : audioRefB.current;
    const targetEl = track === 'A' ? audioRefA.current : audioRefB.current;

    const currentPosition = sourceEl?.currentTime || currentTime;

    setActiveTrack(track);

    if (sourceEl) {
      sourceEl.pause();
    }

    if (targetEl) {
      targetEl.currentTime = currentPosition;
      targetEl.volume = isMuted ? 0 : volume;
      targetEl.playbackRate = playbackRate;
      targetEl.loop = isLooping;

      if (isPlaying) {
        targetEl
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    }
  };

  // Seek bar handler
  const handleSeek = (percentage: number) => {
    const totalDuration = decodedData?.duration || 0;
    if (totalDuration <= 0) return;

    const target = percentage * totalDuration;
    setCurrentTime(target);

    if (audioRefA.current) audioRefA.current.currentTime = target;
    if (audioRefB.current) audioRefB.current.currentTime = target;
  };

  // Time update listener
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const el = e.currentTarget;
    setCurrentTime(el.currentTime);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const totalDuration = decodedData?.duration || 0;
  const playProgress = totalDuration > 0 ? currentTime / totalDuration : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hidden audio players for seamless A/B switching */}
      {originalAudioUrl && (
        <audio
          ref={audioRefA}
          src={originalAudioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleAudioEnded}
          preload="auto"
        />
      )}
      {processedAudioUrl && (
        <audio
          ref={audioRefB}
          src={processedAudioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleAudioEnded}
          preload="auto"
        />
      )}

      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-[#151F30] border border-white/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#7357F5] to-[#3984FF] flex items-center justify-center text-white flex-shrink-0 shadow-md">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {file ? file.name : 'Quick Local DSP Processor'}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                In-Browser DSP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Pure client-side centre-channel vocal attenuation with instant A/B playback and 16-bit PCM WAV export.
            </p>
          </div>
        </div>

        {/* Action button: File Selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-[#3984FF]" />
            <span>Load New Audio</span>
            <input
              type="file"
              accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  loadAndDecodeFile(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Main Dual-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Waveform, Player & A/B Transport */}
        <div className="lg:col-span-7 space-y-6">
          {/* Waveform Visualization Panel */}
          <div className="p-5 rounded-2xl bg-[#101827] border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#7357F5]" />
                <span className="text-xs font-semibold text-white">Waveform & Playhead</span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                <span className="text-white font-medium">{formatDuration(currentTime)}</span> /{' '}
                <span>{formatDuration(totalDuration)}</span>
              </div>
            </div>

            {/* Canvas Waveform */}
            <CanvasWaveform
              peaks={decodedData?.waveformPeaks || []}
              progress={playProgress}
              duration={totalDuration}
              onSeek={handleSeek}
              height={70}
            />

            {/* A/B Comparison Selector Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <span className="text-xs font-medium text-slate-400">Audio Preview Source:</span>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#151F30] border border-white/10">
                <button
                  onClick={() => handleToggleAB('A')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTrack === 'A'
                      ? 'bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white/70" />
                  <span>A: Original Stereo</span>
                </button>

                <button
                  onClick={() => handleToggleAB('B')}
                  disabled={!processedAudioUrl}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTrack === 'B'
                      ? 'bg-gradient-to-r from-[#16C784] to-[#3984FF] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white/70" />
                  <span>B: Vocal Reduced</span>
                </button>
              </div>
            </div>

            {/* Player Transport Controls */}
            <div className="flex items-center justify-between gap-4 pt-2">
              {/* Play / Skip / Rewind */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSeek(Math.max(0, (currentTime - 5) / (totalDuration || 1)))}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Rewind 5s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  disabled={!decodedData}
                  className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white flex items-center justify-center shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-40"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleSeek(Math.min(1, (currentTime + 5) / (totalDuration || 1)))}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Forward 5s"
                >
                  <FastForward className="w-4 h-4" />
                </button>
              </div>

              {/* Playback speed & loop */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = !isLooping;
                    setIsLooping(next);
                    if (audioRefA.current) audioRefA.current.loop = next;
                    if (audioRefB.current) audioRefB.current.loop = next;
                  }}
                  className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isLooping
                      ? 'bg-[#7357F5]/20 text-[#7357F5] border-[#7357F5]/40'
                      : 'text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
                  }`}
                  title="Loop playback"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    const rates = [1.0, 1.25, 1.5, 0.75];
                    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                    setPlaybackRate(next);
                    if (audioRefA.current) audioRefA.current.playbackRate = next;
                    if (audioRefB.current) audioRefB.current.playbackRate = next;
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-mono font-medium bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  {playbackRate}x
                </button>

                {/* Volume slider */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                  <button
                    onClick={() => {
                      const nextMute = !isMuted;
                      setIsMuted(nextMute);
                      if (audioRefA.current) audioRefA.current.volume = nextMute ? 0 : volume;
                      if (audioRefB.current) audioRefB.current.volume = nextMute ? 0 : volume;
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (isMuted) setIsMuted(false);
                      if (audioRefA.current) audioRefA.current.volume = v;
                      if (audioRefB.current) audioRefB.current.volume = v;
                    }}
                    className="w-16 sm:w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#7357F5]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Processing Controls Panel */}
          <div className="p-6 rounded-2xl bg-[#151F30] border border-white/10 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#7357F5]" />
                <h3 className="text-sm font-semibold text-white">DSP Reduction Controls</h3>
              </div>
              <span className="text-xs font-mono text-[#7357F5] font-semibold">
                {Math.round(strength * 100)}% Strength
              </span>
            </div>

            {/* Strength Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Vocal Reduction Strength</span>
                <span className="text-slate-400">
                  {strength === 0
                    ? '0% (Original)'
                    : strength === 1
                    ? '100% (Full Cancellation)'
                    : `${Math.round(strength * 100)}% Mix`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                className="w-full h-2 bg-[#101827] rounded-lg appearance-none cursor-pointer accent-[#7357F5]"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Original Stereo)</span>
                <span>50% (Balanced)</span>
                <span>100% (Max Cancellation)</span>
              </div>
            </div>

            {/* Real Processing Progress Bar */}
            {processingStage === 'processing' && (
              <div className="space-y-1.5 pt-2 animate-in fade-in">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7357F5] animate-ping" />
                    <span>Processing audio samples...</span>
                  </span>
                  <span className="font-mono text-white font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-[#101827] rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#7357F5] via-[#3984FF] to-[#16C784] transition-all duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Status & Error Display */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-400">Current Status:</span>
              <span
                className={`font-semibold flex items-center gap-1.5 ${
                  processingStage === 'completed'
                    ? 'text-[#16C784]'
                    : processingStage === 'failed'
                    ? 'text-rose-400'
                    : processingStage === 'processing'
                    ? 'text-[#7357F5]'
                    : 'text-slate-300'
                }`}
              >
                {processingStage === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {statusMessage}
                {processingDurationMs > 0 && processingStage === 'completed' && (
                  <span className="font-mono text-[11px] text-slate-400">({processingDurationMs}ms)</span>
                )}
              </span>
            </div>

            {/* Action Buttons: Process, Reset, Export */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleProcessAudio}
                disabled={!decodedData || processingStage === 'processing'}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white font-semibold text-xs shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {processedResult ? 'Re-Process Audio' : 'Process Vocal Reduction'}
                </span>
              </button>

              <button
                onClick={handleExportWav}
                disabled={!processedBlob}
                className="w-full sm:w-auto py-3 px-5 rounded-xl bg-[#16C784] hover:bg-[#14b376] text-black font-semibold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:bg-slate-700 disabled:text-slate-400"
              >
                <Download className="w-4 h-4" />
                <span>Export 16-Bit WAV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Audio Analysis Panel & Disclaimer */}
        <div className="lg:col-span-5 space-y-6">
          {/* Detailed Audio Analysis Specs */}
          <div className="p-6 rounded-2xl bg-[#151F30] border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Info className="w-4 h-4 text-[#3984FF]" />
              <h3 className="text-sm font-semibold text-white">Audio Analysis & Specs</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Duration:</span>
                </span>
                <span className="font-mono text-white font-semibold">
                  {decodedData ? formatDuration(decodedData.duration) : '--:--'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sample Rate:</span>
                </span>
                <span className="font-mono text-white">
                  {decodedData ? `${decodedData.sampleRate} Hz` : '--'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Channels:</span>
                </span>
                <span className="font-mono text-white">
                  {decodedData
                    ? decodedData.numberOfChannels === 1
                      ? 'Mono (1 Ch)'
                      : 'Stereo (2 Ch)'
                    : '--'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  <span>Bit Depth / Encoding:</span>
                </span>
                <span className="font-mono text-white truncate max-w-[180px]">
                  {decodedData ? decodedData.bitDepth : '--'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>File Size:</span>
                </span>
                <span className="font-mono text-white">
                  {file ? formatFileSize(file.size) : '--'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Peak Amplitude:</span>
                <span className="font-mono text-white">
                  {decodedData ? `${decodedData.stats.peakLinear} (${decodedData.stats.peakDb} dBFS)` : '--'}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-400">RMS Energy Level:</span>
                <span className="font-mono text-white">
                  {decodedData ? `${decodedData.stats.rmsLinear} (${decodedData.stats.rmsDb} dBFS)` : '--'}
                </span>
              </div>
            </div>

            {/* Mono Audio Warning */}
            {decodedData?.numberOfChannels === 1 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <p className="leading-relaxed">
                  <strong>Mono Audio Notice:</strong> This track has only 1 channel. Stereo centre cancellation
                  requires phase difference between left and right channels to eliminate centered sound.
                </p>
              </div>
            )}
          </div>

          {/* Technical DSP Disclosure Card */}
          <div className="p-5 rounded-2xl bg-[#101827] border border-white/10 space-y-3 text-xs leading-relaxed">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Info className="w-4 h-4 text-[#7357F5]" />
              <span>How Centre-Channel Cancellation Works</span>
            </div>
            <p className="text-slate-300">
              Quick Local uses traditional stereo matrix arithmetic (<strong>Left − Right</strong> and{' '}
              <strong>Right − Left</strong>).
            </p>
            <p className="text-slate-400">
              Because lead vocals are customarily panned dead-centre with identical volume in both channels, subtracting
              one channel from the other largely cancels them out.
            </p>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] space-y-1">
              <p className="font-semibold text-white">Known Characteristics & Limitations:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                <li>Centrally mixed instruments (kick drum, bassline, snares) will also be attenuated.</li>
                <li>Stereo vocal reverbs, stereo delays, and panned backing vocals will remain audible.</li>
                <li>For complete discrete stem separation, deep learning Demucs models will be integrated in Stage 3.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
