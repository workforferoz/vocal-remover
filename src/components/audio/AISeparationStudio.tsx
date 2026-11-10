import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  localEngineService,
  type BackendJobStatusResponse,
  type BackendStemResult,
} from '../../services/localEngine';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useJobStore } from '../../store/useJobStore';
import { formatDuration, formatFileSize } from '../../services/audioMetadata';
import type { AudioMetadata, ProcessingMode, Project, ProcessingJob, GeneratedStem, OutputAudioFormat } from '../../types';
import {
  Sliders,
  Cpu,
  Sparkles,
  Play,
  Pause,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Volume2,
  VolumeX,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Clock,
  Info,
} from 'lucide-react';

interface AISeparationStudioProps {
  file: File;
  metadata?: AudioMetadata | null;
  mode: ProcessingMode; // 'ai-pro' | 'multi-stem'
  onSwitchToQuickLocal: () => void;
  onResetFile: () => void;
}

type WorkflowStep = 'consent' | 'uploading' | 'processing' | 'completed' | 'error';

interface StemPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  audioUrl: string | null;
  isLoading: boolean;
}

export const AISeparationStudio: React.FC<AISeparationStudioProps> = ({
  file,
  metadata,
  mode,
  onSwitchToQuickLocal,
  onResetFile,
}) => {
  const navigate = useNavigate();
  const { engineHealth, checkEngine, isCheckingEngine, settings } = useSettingsStore();
  const { showNotification } = useNotificationStore();
  const { createProject } = useProjectStore();
  const { createJob } = useJobStore();

  // Workflow State
  const [step, setStep] = useState<WorkflowStep>('consent');
  const [jobId, setJobId] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [jobStatus, setJobStatus] = useState<BackendJobStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Results State
  const [stemsMap, setStemsMap] = useState<Record<string, BackendStemResult>>({});
  const [stemsPlayer, setStemsPlayer] = useState<Record<string, StemPlayerState>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // Polling ref
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Selected neural model
  const selectedModel = 'htdemucs';
  const isMultiStem = mode === 'multi-stem';

  // Check engine health on mount if not yet active
  useEffect(() => {
    if (!engineHealth.connected) {
      checkEngine();
    }
  }, [checkEngine, engineHealth.connected]);

  // Clean up object URLs and audio elements on unmount
  useEffect(() => {
    const currentAudioElements = audioElementsRef.current;
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      Object.values(currentAudioElements).forEach((el) => {
        el.pause();
        el.src = '';
      });
    };
  }, []);

  // Format honest status text
  const getHonestStatusLabel = (stage?: string, status?: string): string => {
    if (status === 'queued') return 'Queued for Demucs Worker';
    if (status === 'cancelled') return 'Separation Cancelled';
    if (status === 'failed') return 'Separation Failed';
    if (status === 'completed') return 'Completed';

    if (stage) {
      if (stage.includes('inference')) return 'Processing with Demucs AI';
      if (stage.includes('Writing') || stage.includes('Saving')) return 'Finalizing stems';
      if (stage.includes('Preparing')) return 'Preparing audio tensors';
      return stage;
    }
    return 'Processing with AI';
  };

  // Stop polling helper
  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  // Start polling backend status
  const startPolling = useCallback(
    (createdJobId: string) => {
      stopPolling();

      const startTime = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Poll at honest 1500ms intervals (not flooding the engine)
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await localEngineService.getJobStatus(createdJobId);
          setJobStatus(status);

          if (status.status === 'completed') {
            stopPolling();
            handleSeparationCompleted(createdJobId, status);
          } else if (status.status === 'failed') {
            stopPolling();
            setStep('error');
            setErrorMessage(status.error || 'Separation failed on local Python engine.');
            showNotification({
              type: 'error',
              title: 'Separation Failed',
              message: status.error || 'Demucs model reported an inference failure.',
            });
          } else if (status.status === 'cancelled') {
            stopPolling();
            setStep('error');
            setErrorMessage('The separation job was cancelled by user request.');
          }
        } catch (err: unknown) {
          // If network connection to engine drops during processing
          stopPolling();
          setStep('error');
          const msg =
            err instanceof Error
              ? err.message
              : 'Lost connection to local Demucs engine on 127.0.0.1:8524.';
          setErrorMessage(
            `${msg} The Python engine process may have stopped or restarted. Check the engine console.`
          );
        }
      }, 1500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showNotification]
  );

  // Handle separation completed
  const handleSeparationCompleted = async (
    completedJobId: string,
    finalStatus: BackendJobStatusResponse
  ) => {
    try {
      const results = await localEngineService.getJobResults(completedJobId);
      setStemsMap(results.stems);
      setStep('completed');

      // Initialize stem audio states
      const initialPlayerState: Record<string, StemPlayerState> = {};
      Object.keys(results.stems).forEach((stemKey) => {
        initialPlayerState[stemKey] = {
          isPlaying: false,
          isMuted: false,
          volume: 1.0,
          currentTime: 0,
          duration: metadata?.duration || 0,
          audioUrl: localEngineService.getStemUrl(completedJobId, stemKey),
          isLoading: false,
        };
      });
      setStemsPlayer(initialPlayerState);

      // Save Project & Job to IndexedDB for project history
      const projectId = 'proj_' + Math.random().toString(36).substring(2, 10);
      setCreatedProjectId(projectId);
      const outputFormat: OutputAudioFormat = 'wav';

      const stemList: GeneratedStem[] = Object.entries(results.stems).map(([name, item]) => ({
        id: 'stem_' + Math.random().toString(36).substring(2, 8),
        type: (name === 'other' ? 'other' : name) as any,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        format: outputFormat,
        available: true,
        fileSize: item.file_size_bytes,
        url: localEngineService.getStemUrl(completedJobId, name),
        downloadUrl: localEngineService.getStemUrl(completedJobId, name),
        notes: `Separated with Demucs (${results.model || 'htdemucs'})`,
      }));

      const newProject: Project = {
        id: projectId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'audio/wav',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: metadata?.duration || 0,
        metadata: metadata || {
          duration: 0,
          sampleRate: 44100,
          channels: 2,
          format: file.name.split('.').pop()?.toUpperCase() || 'WAV',
          fileSize: file.size,
        },
        config: {
          mode,
          stems: isMultiStem
            ? ['vocals', 'drums', 'bass', 'other']
            : ['vocals', 'instrumental'],
          outputFormat: 'wav',
          quality: 'high',
          applyNoiseReduction: false,
          normalizeLoudness: false,
        },
        status: 'completed',
        stems: stemList,
        backendJobId: completedJobId,
        deviceUsed: finalStatus.stems ? engineHealth.device : undefined,
        modelUsed: selectedModel,
        processingTimeSeconds: finalStatus.duration_seconds || elapsedSeconds,
      };

      const newJob: ProcessingJob = {
        id: completedJobId,
        projectId,
        projectName: newProject.name,
        fileName: file.name,
        mode,
        status: 'completed',
        startedAt: finalStatus.started_at || new Date().toISOString(),
        completedAt: finalStatus.completed_at || new Date().toISOString(),
        durationSeconds: finalStatus.duration_seconds || elapsedSeconds,
        progress: 100,
        engine: `Demucs AI (${selectedModel})`,
        stage: 'Completed',
        deviceUsed: engineHealth.device,
        logs: [
          `File uploaded: ${file.name} (${formatFileSize(file.size)})`,
          `Demucs inference on device: ${engineHealth.device}`,
          `Duration: ${finalStatus.duration_seconds ? finalStatus.duration_seconds.toFixed(1) + 's' : 'Completed'}`,
          `Separated stems: ${Object.keys(results.stems).join(', ')}`,
        ],
      };

      await createProject(newProject);
      await createJob(newJob);

      showNotification({
        type: 'success',
        title: 'Demucs Separation Complete!',
        message: `All ${Object.keys(results.stems).length} audio stems are ready for preview and export.`,
      });
    } catch (err: unknown) {
      setStep('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to finalize stem results from engine.'
      );
    }
  };

  // Start upload and separation
  const handleStartSeparation = async () => {
    if (!engineHealth.connected) {
      showNotification({
        type: 'error',
        title: 'Engine Offline',
        message: 'Please start the local Python engine before initiating AI separation.',
      });
      return;
    }

    setStep('uploading');
    setUploadPercent(0);
    setErrorMessage(null);

    try {
      const jobResponse = await localEngineService.createSeparationJob(
        file,
        selectedModel,
        (percent) => {
          setUploadPercent(percent);
          if (percent >= 100) {
            setStep('processing');
          }
        }
      );

      setJobId(jobResponse.job_id);
      setStep('processing');
      startPolling(jobResponse.job_id);

      showNotification({
        type: 'info',
        title: 'Separation Job Queued',
        message: `Job ${jobResponse.job_id.substring(0, 8)} registered with Demucs engine.`,
      });
    } catch (err: unknown) {
      setStep('error');
      const msg = err instanceof Error ? err.message : 'Failed to upload audio to local engine';
      setErrorMessage(msg);
      showNotification({
        type: 'error',
        title: 'Upload Error',
        message: msg,
      });
    }
  };

  // Cancel job
  const handleCancelJob = async () => {
    if (!jobId) return;
    setIsCancelling(true);

    try {
      await localEngineService.cancelJob(jobId);
      stopPolling();
      setStep('error');
      setErrorMessage('Separation was cancelled and temporary files were removed.');
      showNotification({
        type: 'info',
        title: 'Job Cancelled',
        message: 'The separation job has been safely aborted.',
      });
    } catch (err: unknown) {
      showNotification({
        type: 'warning',
        title: 'Cancellation Note',
        message: err instanceof Error ? err.message : 'Job cancellation requested.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Play / Pause individual stem
  const toggleStemPlayback = (stemName: string) => {
    let audio = audioElementsRef.current[stemName];

    if (!audio) {
      const url = localEngineService.getStemUrl(jobId!, stemName);
      audio = new Audio(url);
      audioElementsRef.current[stemName] = audio;

      audio.ontimeupdate = () => {
        setStemsPlayer((prev) => ({
          ...prev,
          [stemName]: {
            ...prev[stemName],
            currentTime: audio.currentTime,
            duration: audio.duration || prev[stemName]?.duration || 0,
          },
        }));
      };

      audio.onended = () => {
        setStemsPlayer((prev) => ({
          ...prev,
          [stemName]: { ...prev[stemName], isPlaying: false, currentTime: 0 },
        }));
      };
    }

    if (stemsPlayer[stemName]?.isPlaying) {
      audio.pause();
      setStemsPlayer((prev) => ({
        ...prev,
        [stemName]: { ...prev[stemName], isPlaying: false },
      }));
    } else {
      audio.play().catch((e) => {
        console.warn('Playback blocked or failed:', e);
      });
      setStemsPlayer((prev) => ({
        ...prev,
        [stemName]: { ...prev[stemName], isPlaying: true },
      }));
    }
  };

  // Mute / Unmute stem
  const toggleStemMute = (stemName: string) => {
    const audio = audioElementsRef.current[stemName];
    const isMuted = !stemsPlayer[stemName]?.isMuted;

    if (audio) {
      audio.muted = isMuted;
    }

    setStemsPlayer((prev) => ({
      ...prev,
      [stemName]: { ...prev[stemName], isMuted },
    }));
  };

  // Stem Volume change
  const handleStemVolumeChange = (stemName: string, vol: number) => {
    const audio = audioElementsRef.current[stemName];
    if (audio) {
      audio.volume = vol;
    }
    setStemsPlayer((prev) => ({
      ...prev,
      [stemName]: { ...prev[stemName], volume: vol },
    }));
  };

  // Direct Stem Download
  const handleDownloadStem = (stemName: string) => {
    if (!jobId) return;
    const url = localEngineService.getStemUrl(jobId, stemName);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}_${stemName}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download All Stems
  const handleDownloadAllStems = () => {
    Object.keys(stemsMap).forEach((stemName, index) => {
      setTimeout(() => {
        handleDownloadStem(stemName);
      }, index * 400); // Stagger downloads slightly to prevent browser blocking
    });
  };

  // -------------------------------------------------------------
  // VIEW: 1. If Local Python Engine is NOT running
  // -------------------------------------------------------------
  if (!engineHealth.connected) {
    return (
      <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Local AI Engine Required
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Demucs neural separation requires the local Python daemon at {settings.pythonEngineUrl}
              </p>
            </div>
          </div>

          <button
            onClick={() => checkEngine()}
            disabled={isCheckingEngine}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEngine ? 'animate-spin' : ''}`} />
            <span>{isCheckingEngine ? 'Checking Engine...' : 'Retry Connection'}</span>
          </button>
        </div>

        {/* Informative Guidance */}
        <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Cpu className="w-4 h-4 text-[#7357F5]" />
            <span>How to launch your local AI engine:</span>
          </div>

          <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
            <li>
              Open a terminal or command prompt in your project folder:
              <pre className="mt-1 p-2.5 rounded-lg bg-[#080D18] text-slate-200 font-mono text-[11px] overflow-x-auto border border-white/5">
                cd local-engine
              </pre>
            </li>
            <li>
              Run the startup script:
              <pre className="mt-1 p-2.5 rounded-lg bg-[#080D18] text-emerald-400 font-mono text-[11px] overflow-x-auto border border-white/5">
                start.bat
              </pre>
            </li>
            <li>Once started, click <strong>"Retry Connection"</strong> above.</li>
          </ol>
        </div>

        {/* Quick Local Alternative Banner */}
        <div className="p-4 rounded-xl bg-[#16C784]/10 border border-[#16C784]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#16C784]" />
              <span>Need instant separation without running Python?</span>
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong>Quick Local mode</strong> runs 100% inside your browser using real DSP center-channel cancellation. No Python, GPU, or model downloads needed.
            </p>
          </div>

          <button
            onClick={onSwitchToQuickLocal}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#16C784] to-[#3984FF] text-white text-xs font-semibold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
          >
            <span>Switch to Quick Local</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 2. Consent & Confirmation Screen
  // -------------------------------------------------------------
  if (step === 'consent') {
    return (
      <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#7357F5]" />
              <span>
                {isMultiStem ? 'Multi-Stem 4-Way Separation' : 'AI Professional 2-Stem Separation'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Powered by Meta AI Demucs (<span className="text-white font-mono">{selectedModel}</span>) running locally
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#16C784]/10 text-[#16C784] border border-[#16C784]/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Engine Online ({engineHealth.device})</span>
            </span>
          </div>
        </div>

        {/* Track & Engine Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* File Card */}
          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-2">
            <span className="text-slate-400 font-medium">Selected Audio Track</span>
            <p className="font-semibold text-white text-sm truncate">{file.name}</p>
            <div className="flex items-center gap-4 text-slate-300 pt-1">
              <span>Size: {formatFileSize(file.size)}</span>
              {metadata?.duration && <span>Duration: {formatDuration(metadata.duration)}</span>}
              {metadata?.sampleRate && <span>{metadata.sampleRate} Hz</span>}
            </div>
          </div>

          {/* Engine Parameters Card */}
          <div className="p-4 rounded-xl bg-[#101827] border border-white/10 space-y-2">
            <span className="text-slate-400 font-medium">Demucs AI Dispatch Target</span>
            <p className="font-semibold text-[#7357F5] text-sm">
              {engineHealth.device?.includes('CUDA') ? 'NVIDIA GPU Acceleration' : 'Multi-Core CPU Pipeline'}
            </p>
            <div className="flex items-center gap-4 text-slate-300 pt-1">
              <span>Target Stems: {isMultiStem ? 'Vocals, Drums, Bass, Other' : 'Vocals, Backing'}</span>
              <span>Model: {selectedModel}</span>
            </div>
          </div>
        </div>

        {/* Privacy & Consent Guarantee Box */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#7357F5]/10 via-[#3984FF]/10 to-transparent border border-white/10 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-[#16C784] flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-white">100% Local Processing Guarantee</p>
            <p className="text-slate-300 leading-relaxed">
              When you confirm, this file will be sent strictly via local loopback (<code>127.0.0.1:8524</code>) to your local Python Demucs engine. No audio, telemetry, or metadata will ever leave your computer.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onResetFile}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs border border-white/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Choose Different File</span>
          </button>

          <button
            onClick={handleStartSeparation}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] hover:from-[#6345ec] hover:to-[#2b76f0] text-white text-xs font-bold shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Confirm & Start AI Separation</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 3. Uploading & Active Processing View
  // -------------------------------------------------------------
  if (step === 'uploading' || step === 'processing') {
    const isUploading = step === 'uploading';
    const progressVal = isUploading ? uploadPercent : jobStatus?.progress ?? 0;
    const stageName = isUploading ? 'Staging audio to local engine...' : jobStatus?.stage || 'Separating audio stems...';
    const statusLabel = isUploading ? 'Uploading to local engine' : getHonestStatusLabel(jobStatus?.stage, jobStatus?.status);

    return (
      <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#7357F5]/20 border border-[#7357F5]/40 flex items-center justify-center text-[#7357F5] animate-pulse">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isUploading ? 'Preparing Local AI Separation' : 'Demucs AI Engine Active'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Job ID: <span className="font-mono text-slate-300">{jobId || 'Allocating...'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Elapsed: {elapsedSeconds}s</span>
          </div>
        </div>

        {/* Track Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#101827] border border-white/10 text-xs">
          <div>
            <span className="text-slate-400 text-[11px]">Track</span>
            <p className="font-semibold text-white truncate">{file.name}</p>
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">File Size</span>
            <p className="font-semibold text-white">{formatFileSize(file.size)}</p>
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Neural Model</span>
            <p className="font-semibold text-[#7357F5]">{selectedModel}</p>
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Compute Device</span>
            <p className="font-semibold text-[#16C784] truncate">{engineHealth.device}</p>
          </div>
        </div>

        {/* Real Progress Bar */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#7357F5] animate-ping" />
              <span>{statusLabel}</span>
            </span>
            <span className="font-mono text-[#3984FF] font-bold">{progressVal}%</span>
          </div>

          <div className="w-full h-3 rounded-full bg-[#101827] border border-white/10 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7357F5] via-[#5b40e6] to-[#3984FF] transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progressVal, 5)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Stage: {stageName}
          </p>
        </div>

        {/* Note on low-end PC execution */}
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="leading-relaxed">
            {engineHealth.device?.includes('CUDA')
              ? 'GPU inference in progress. Deep neural source separation usually completes in ~15–30 seconds.'
              : 'CPU inference in progress with multi-threading safely tuned. For a full-length song, CPU separation typically takes 1–3 minutes without freezing your computer.'}
          </p>
        </div>

        {/* Cancel Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleCancelJob}
            disabled={isCancelling}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            <span>{isCancelling ? 'Cancelling...' : 'Cancel Separation'}</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 4. Error Screen with Clear Recovery Steps
  // -------------------------------------------------------------
  if (step === 'error') {
    return (
      <div className="bg-[#151F30] border border-rose-500/30 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Separation Stopped or Failed
            </h3>
            <p className="text-xs text-rose-300/80 mt-0.5">
              An error occurred during Demucs processing
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#101827] border border-white/10 text-xs text-rose-200 font-mono leading-relaxed break-words">
          {errorMessage || 'Unknown engine error occurred.'}
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <p className="font-semibold text-white">Suggested Troubleshooting:</p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-slate-400">
            <li>Verify that <code className="text-slate-200">start.bat</code> is still running in your terminal window.</li>
            <li>If memory was exhausted, close heavy applications or use a shorter audio clip.</li>
            <li>Ensure the file is a valid, uncorrupted audio format (WAV, MP3, FLAC, M4A, OGG).</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            onClick={onSwitchToQuickLocal}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs border border-white/10 transition-colors cursor-pointer"
          >
            Switch to Quick Local Mode
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setStep('consent');
                setErrorMessage(null);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#7357F5] hover:bg-[#6345ec] text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Separation</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 5. Completed Results with Stem Player & Exporter
  // -------------------------------------------------------------
  return (
    <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#16C784]" />
            <span>Separation Completed Successfully</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Track: <span className="text-white font-medium">{file.name}</span> • Model: <span className="text-[#7357F5] font-mono">{selectedModel}</span> • Duration: <span className="text-slate-300 font-mono">{formatDuration(metadata?.duration || 0)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {stemsMap['instrumental'] && (
            <button
              onClick={() => handleDownloadStem('instrumental')}
              className="px-4 py-2.5 rounded-xl bg-[#16C784] hover:bg-[#13b074] text-slate-950 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              title="Download Instrumental (WAV)"
            >
              <Download className="w-4 h-4" />
              <span>Download Instrumental</span>
            </button>
          )}
          <button
            onClick={handleDownloadAllStems}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
            title="Download all stems as individual WAV files"
          >
            <Download className="w-4 h-4" />
            <span>Download All Stems</span>
          </button>
        </div>
      </div>

      {/* Stem Player Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#7357F5]" />
          <span>Separated Audio Stems ({Object.keys(stemsMap).length})</span>
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {Object.entries(stemsMap).map(([stemKey, stemData]) => {
            const playerState = stemsPlayer[stemKey] || {
              isPlaying: false,
              isMuted: false,
              volume: 1.0,
              currentTime: 0,
              duration: metadata?.duration || 0,
            };

            const isInstrumental = stemKey.toLowerCase() === 'instrumental';
            const isVocals = stemKey.toLowerCase() === 'vocals';
            const isDrums = stemKey.toLowerCase() === 'drums';
            const isBass = stemKey.toLowerCase() === 'bass';

            let tagColor = 'bg-[#3984FF]/10 text-[#3984FF] border-[#3984FF]/30';
            if (isInstrumental) tagColor = 'bg-[#16C784]/20 text-[#16C784] border-[#16C784]/40 font-bold';
            if (isVocals) tagColor = 'bg-[#7357F5]/10 text-[#7357F5] border-[#7357F5]/30';
            if (isDrums) tagColor = 'bg-[#16C784]/10 text-[#16C784] border-[#16C784]/30';
            if (isBass) tagColor = 'bg-amber-500/10 text-amber-300 border-amber-500/30';

            return (
              <div
                key={stemKey}
                className="p-4 rounded-xl bg-[#101827] border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left: Stem Name & Badge */}
                <div className="flex items-center gap-3 min-w-[160px]">
                  <button
                    onClick={() => toggleStemPlayback(stemKey)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-white transition-all cursor-pointer"
                    aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
                  >
                    {playerState.isPlaying ? (
                      <Pause className="w-4 h-4 text-[#16C784]" />
                    ) : (
                      <Play className="w-4 h-4 text-[#7357F5] fill-current ml-0.5" />
                    )}
                  </button>

                  <div>
                    <h5 className="font-bold text-white text-sm capitalize">{stemKey}</h5>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${tagColor} mt-0.5`}>
                      16-bit PCM WAV
                    </span>
                  </div>
                </div>

                {/* Center: Controls & Volume */}
                <div className="flex items-center gap-3 flex-1 max-w-sm w-full">
                  <button
                    onClick={() => toggleStemMute(stemKey)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    title={playerState.isMuted ? 'Unmute' : 'Mute'}
                  >
                    {playerState.isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-slate-300" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={playerState.isMuted ? 0 : playerState.volume}
                    onChange={(e) => handleStemVolumeChange(stemKey, parseFloat(e.target.value))}
                    className="w-full accent-[#7357F5] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />

                  <span className="text-[11px] font-mono text-slate-400 min-w-[50px] text-right">
                    {formatDuration(playerState.currentTime)}
                  </span>
                </div>

                {/* Right: File Size & Download */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                  <span className="text-xs text-slate-400 font-mono">
                    {formatFileSize(stemData.file_size_bytes)}
                  </span>

                  <button
                    onClick={() => handleDownloadStem(stemKey)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                    title={`Download ${stemKey}.wav`}
                  >
                    <Download className="w-3.5 h-3.5 text-[#3984FF]" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
        <button
          onClick={onResetFile}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs border border-white/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Process Another Song</span>
        </button>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => navigate('/projects')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>My Projects</span>
          </button>

          <button
            onClick={() => {
              if (createdProjectId) {
                navigate(`/studio/${createdProjectId}`);
              } else {
                navigate('/projects');
              }
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] hover:brightness-110 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Open in Multitrack Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
