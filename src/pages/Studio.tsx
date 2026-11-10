import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/useProjectStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { getProjectById, getAudioBlob, saveProject } from '../services/db';
import {
  MultitrackAudioEngine,
  type StemTrackConfig,
  type TrackRuntimeState,
  type PlaybackState,
  type StudioPreset,
} from '../services/audio/multitrackEngine';
import { StemTrackStrip } from '../components/studio/StemTrackStrip';
import { StudioTimeline } from '../components/studio/StudioTimeline';
import { formatDuration } from '../services/audioMetadata';
import { downloadWavFile } from '../services/dsp/wavEncoder';
import type { Project } from '../types';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Repeat,
  Download,
  Sparkles,
  Sliders,
  ArrowLeft,
  Disc,
  Layers,
  Cpu,
  Clock,
  Radio,
  CheckCircle2,
} from 'lucide-react';

export const StudioPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects } = useProjectStore();
  const { showNotification } = useNotificationStore();

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);

  // Engine state
  const engineRef = useRef<MultitrackAudioEngine | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isABOriginal, setIsABOriginal] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<StudioPreset>('original-balance');

  // Track runtime states
  const [tracks, setTracks] = useState<Record<string, TrackRuntimeState>>({});
  const [isRenderingExport, setIsRenderingExport] = useState<boolean>(false);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input field
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyR') {
        engineRef.current?.restart();
      } else if (e.code === 'Escape') {
        engineRef.current?.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Load project record
  useEffect(() => {
    let isCancelled = false;

    async function loadTargetProject() {
      if (!projectId) {
        setIsLoadingProject(false);
        return;
      }

      try {
        const found =
          projects.find((p) => p.id === projectId) || (await getProjectById(projectId));

        if (!isCancelled) {
          if (found) {
            setProject(found);
            setTotalDuration(found.duration || 0);
          }
          setIsLoadingProject(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setIsLoadingProject(false);
          showNotification({
            type: 'error',
            title: 'Project Load Failed',
            message: err instanceof Error ? err.message : 'Could not find project record.',
          });
        }
      }
    }

    loadTargetProject();

    return () => {
      isCancelled = true;
    };
  }, [projectId, projects, showNotification]);

  // Initialize and load MultitrackAudioEngine
  useEffect(() => {
    if (!project) return;

    // Create engine instance
    const engine = new MultitrackAudioEngine({
      onTimeUpdate: (curr, dur) => {
        setCurrentTime(curr);
        if (dur > 0) setTotalDuration(dur);
      },
      onStateChange: (state) => {
        setPlaybackState(state);
      },
      onTrackStateChange: (newTracks) => {
        setTracks(newTracks);
      },
      onEnded: () => {
        setPlaybackState('stopped');
        setCurrentTime(0);
      },
      onError: (msg) => {
        showNotification({
          type: 'error',
          title: 'Audio Engine Error',
          message: msg,
        });
      },
    });

    engineRef.current = engine;

    // Build Stem Configurations
    async function setupTracks() {
      const stemConfigs: StemTrackConfig[] = [];

      // 1. Check for original audio in IndexedDB
      try {
        const originalBlob = await getAudioBlob(project!.id);
        if (originalBlob) {
          stemConfigs.push({
            id: 'track_original',
            name: 'original',
            label: 'Original Track',
            blob: originalBlob,
            initialVolume: 1.0,
            initialMuted: false,
          });
        }
      } catch {
        // Original blob may not have been saved
      }

      // 2. Add available stems
      project!.stems.forEach((stem) => {
        const initialVol = project!.mixerState?.stems?.[stem.type]?.volume ?? 1.0;
        const initialMute = project!.mixerState?.stems?.[stem.type]?.muted ?? false;
        const initialSolo = project!.mixerState?.stems?.[stem.type]?.solo ?? false;

        stemConfigs.push({
          id: `track_${stem.type}`,
          name: stem.type,
          label: stem.label || stem.type.charAt(0).toUpperCase() + stem.type.slice(1),
          url: stem.url,
          initialVolume: initialVol,
          initialMuted: initialMute,
          initialSolo: initialSolo,
        });
      });

      await engine.loadTracks(stemConfigs);

      // Restore saved mixer state if present
      if (project!.mixerState?.preset) {
        setActivePreset(project!.mixerState.preset as StudioPreset);
      }
      if (project!.mixerState?.playbackSpeed) {
        setPlaybackSpeed(project!.mixerState.playbackSpeed);
        engine.setSpeed(project!.mixerState.playbackSpeed);
      }
      if (project!.mixerState?.isLooping) {
        setIsLooping(project!.mixerState.isLooping);
        engine.setLoop(project!.mixerState.isLooping);
      }
    }

    setupTracks();

    return () => {
      // Save mixer state back to IndexedDB before leaving
      if (project && engineRef.current) {
        const currentTracks = engineRef.current.getTrackStates();
        const stemsRecord: Record<string, { volume: number; muted: boolean; solo: boolean }> = {};

        Object.values(currentTracks).forEach((t) => {
          stemsRecord[t.name] = {
            volume: t.volume,
            muted: t.muted,
            solo: t.solo,
          };
        });

        const updatedProject: Project = {
          ...project,
          mixerState: {
            stems: stemsRecord,
            preset: activePreset,
            playbackSpeed: engineRef.current.getPlaybackSpeed(),
            isLooping: engineRef.current.getIsLooping(),
            lastPosition: engineRef.current.getCurrentTime(),
          },
          updatedAt: new Date().toISOString(),
        };

        saveProject(updatedProject).catch(() => {});
      }

      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Playback Control Handlers
  const togglePlayPause = () => {
    if (!engineRef.current) return;
    if (playbackState === 'playing') {
      engineRef.current.pause();
    } else {
      engineRef.current.play();
    }
  };

  const handleStop = () => {
    engineRef.current?.stop();
  };

  const handleRestart = () => {
    engineRef.current?.restart();
  };

  const handleSeek = (timeSeconds: number) => {
    engineRef.current?.seek(timeSeconds);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    engineRef.current?.setSpeed(speed);
  };

  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    engineRef.current?.setLoop(next);
  };

  const handleToggleAB = () => {
    if (!engineRef.current) return;
    const isNowOriginal = engineRef.current.toggleABOriginalMode();
    setIsABOriginal(isNowOriginal);
    showNotification({
      type: 'info',
      title: isNowOriginal ? 'A/B: Original Audio Active' : 'A/B: Demucs Stems Active',
      message: isNowOriginal
        ? 'Listening directly to the unseparated reference mix.'
        : 'Listening to the custom multitrack stem mix.',
    });
  };

  // Preset Handlers
  const handleApplyPreset = (preset: StudioPreset) => {
    setActivePreset(preset);
    engineRef.current?.applyPreset(preset);
    showNotification({
      type: 'info',
      title: `Preset Applied: ${preset.replace('-', ' ').toUpperCase()}`,
      message:
        preset === 'karaoke'
          ? 'Lead vocals silenced (0%). Backing instruments at full volume.'
          : preset === 'vocals-only'
          ? 'Vocals soloed at full volume. Backing tracks silenced.'
          : 'Stem volumes and balances reset to original levels.',
    });
  };

  // Track Control Handlers
  const handleVolumeChange = (trackId: string, vol: number) => {
    setActivePreset('custom');
    engineRef.current?.setTrackVolume(trackId, vol);
  };

  const handleToggleMute = (trackId: string) => {
    setActivePreset('custom');
    engineRef.current?.setTrackMute(trackId);
  };

  const handleToggleSolo = (trackId: string) => {
    setActivePreset('custom');
    engineRef.current?.setTrackSolo(trackId);
  };

  // Download individual stem
  const handleDownloadStem = (track: TrackRuntimeState) => {
    const stemObj = project?.stems.find((s) => s.type === track.name);
    if (stemObj?.url) {
      const a = document.createElement('a');
      a.href = stemObj.url;
      a.download = `${project?.name || 'track'}_${track.name}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      showNotification({
        type: 'warning',
        title: 'Stem Download',
        message: `Stem download link not available for ${track.name}.`,
      });
    }
  };

  // "Export My Mix" (Offline Render to WAV)
  const handleExportMix = async () => {
    if (!engineRef.current) return;
    setIsRenderingExport(true);

    showNotification({
      type: 'info',
      title: 'Rendering Custom Mix',
      message: 'Processing multitrack mixdown with peak limiting via OfflineAudioContext...',
    });

    try {
      const mixBlob = await engineRef.current.exportMix({ normalize: true });
      const filename = `${project?.name || 'Vocal_Studio'}_${activePreset}_Mix.wav`;
      downloadWavFile(mixBlob, filename);

      showNotification({
        type: 'success',
        title: 'Mix Exported Successfully!',
        message: `Saved high-fidelity 16-bit PCM WAV: "${filename}"`,
      });
    } catch (err: unknown) {
      showNotification({
        type: 'error',
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Could not render multitrack mix.',
      });
    } finally {
      setIsRenderingExport(false);
    }
  };

  // Download all stems
  const handleDownloadAllStems = () => {
    const activeStems = Object.values(tracks).filter((t) => t.name !== 'original');
    activeStems.forEach((track, index) => {
      setTimeout(() => {
        handleDownloadStem(track);
      }, index * 400);
    });
  };

  // -------------------------------------------------------------
  // RENDER: Loading or Project Not Found
  // -------------------------------------------------------------
  if (isLoadingProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#7357F5] border-t-transparent animate-spin" />
        <span className="text-xs font-medium">Loading multitrack studio...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center space-y-4">
        <h3 className="text-lg font-bold text-white">Project Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested project does not exist in local storage.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2 rounded-xl bg-[#7357F5] text-white text-xs font-semibold"
        >
          Return to My Projects
        </button>
      </div>
    );
  }

  // Filter stems tracks vs original track
  const stemTracks = Object.values(tracks).filter((t) => t.name !== 'original');
  const originalTrack = Object.values(tracks).find((t) => t.name === 'original');

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header / Project Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/projects')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Back to Projects"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-6 h-6 text-[#7357F5]" />
              <span>{project.name}</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#16C784]/15 text-[#16C784] border border-[#16C784]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Demucs Separated</span>
            </span>
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-3 pl-8">
            <span>File: <strong className="text-white font-mono">{project.originalFileName}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatDuration(totalDuration)}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-[#3984FF]" />
              <span>{project.deviceUsed || 'Local CPU/GPU'}</span>
            </span>
          </p>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2.5 pl-8 sm:pl-0">
          <button
            onClick={() => {
              const instTrack = Object.values(tracks).find(
                (t) => t.name.toLowerCase() === 'instrumental' || t.name.toLowerCase().includes('instrument')
              );
              if (instTrack) {
                handleDownloadStem(instTrack);
              } else {
                handleApplyPreset('karaoke');
                setTimeout(() => handleExportMix(), 150);
              }
            }}
            className="px-4 py-2 rounded-xl bg-[#16C784] hover:bg-[#13b074] text-slate-950 font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download clean instrumental as WAV"
          >
            <Download className="w-4 h-4" />
            <span>Download Instrumental</span>
          </button>

          <button
            onClick={handleDownloadAllStems}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download individual WAV stems"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All Stems</span>
          </button>

          <button
            onClick={handleExportMix}
            disabled={isRenderingExport}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7357F5] via-[#5b40e6] to-[#3984FF] hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Render custom mix with current volume and mute settings to a single WAV file"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isRenderingExport ? 'Rendering WAV...' : 'Export My Mix'}</span>
          </button>
        </div>
      </div>

      {/* Main Transport & Master Control Console */}
      <div className="bg-[#151F30] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Playback Controls & Speed */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/10 pb-6">
          {/* Left: Main Transport Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7357F5] to-[#3984FF] hover:brightness-110 active:scale-95 shadow-xl shadow-indigo-500/25 flex items-center justify-center text-white transition-all cursor-pointer"
              title={playbackState === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
            >
              {playbackState === 'playing' ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-1" />
              )}
            </button>

            <button
              onClick={handleStop}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Stop (Esc)"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              onClick={handleRestart}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Restart (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleLoop}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isLooping
                  ? 'bg-[#16C784]/20 text-[#16C784] border-[#16C784]/40 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
              }`}
              title={isLooping ? 'Loop Active' : 'Enable Loop'}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Center: A/B Comparison Toggle */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#101827] border border-white/10">
            <button
              onClick={() => isABOriginal && handleToggleAB()}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isABOriginal
                  ? 'bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stem Mix
            </button>
            <button
              onClick={() => !isABOriginal && handleToggleAB()}
              disabled={!originalTrack}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isABOriginal
                  ? 'bg-[#3984FF] text-white shadow-md'
                  : 'text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              title={originalTrack ? 'Listen to Original Track' : 'Original audio not cached'}
            >
              A/B Original
            </button>
          </div>

          {/* Right: Playback Speed Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#101827] border border-white/10 text-xs">
            {[0.75, 1.0, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`px-2.5 py-1 rounded-lg font-mono font-semibold transition-all cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-[#7357F5] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Scrubbable Synchronized Timeline */}
        <StudioTimeline
          currentTime={currentTime}
          duration={totalDuration}
          onSeek={handleSeek}
          peaks={project.metadata?.peaks}
        />

        {/* Vocal Control & Mixing Presets Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#7357F5]" />
            <span className="text-xs font-semibold text-white">Mixing Presets:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'original-balance', label: 'Original Balance' },
              { id: 'karaoke', label: 'Karaoke (No Vocals)' },
              { id: 'instrumental', label: 'Full Instrumental' },
              { id: 'vocals-only', label: 'Vocals Acapella' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p.id as StudioPreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  activePreset === p.id
                    ? 'bg-[#7357F5]/20 text-[#7357F5] border-[#7357F5]/50 shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Stem Multitrack Mixer Console */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#7357F5]" />
            <span>Multitrack Stems Mixer ({stemTracks.length} Channels)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Hardware-synchronized Web Audio playback engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stemTracks.map((track) => (
            <StemTrackStrip
              key={track.id}
              track={track}
              isPlaying={playbackState === 'playing'}
              onVolumeChange={(vol) => handleVolumeChange(track.id, vol)}
              onToggleMute={() => handleToggleMute(track.id)}
              onToggleSolo={() => handleToggleSolo(track.id)}
              onDownload={() => handleDownloadStem(track)}
            />
          ))}
        </div>
      </div>

      {/* Optional Reference Original Track Strip */}
      {originalTrack && (
        <div className="mt-4 p-4 rounded-xl bg-[#101827] border border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#3984FF]">
              <Disc className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Reference Original Track</h5>
              <p className="text-[10px] text-slate-400">Unprocessed song for real-time A/B phase comparison</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAB}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                isABOriginal
                  ? 'bg-[#3984FF] text-white border-transparent'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              {isABOriginal ? 'Currently Listening' : 'Preview Original'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
