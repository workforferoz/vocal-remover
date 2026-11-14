import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileAudio, AlertCircle, Loader2 } from 'lucide-react';
import { validateAudioFile, extractAudioMetadata } from '../../services/audioMetadata';
import type { AudioMetadata } from '../../types';
import { useNotificationStore } from '../../store/useNotificationStore';

interface FileDropzoneProps {
    onFileAccepted: (file: File, metadata: AudioMetadata) => void;
    onBeforeOpen?: () => boolean;
    onBeforeDrop?: (file: File) => boolean;
    onYouTubeClick?: () => void;
    maxSizeBytes?: number;
    isLoading?: boolean;
}

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

export const FileDropzone: React.FC<FileDropzoneProps> = ({
    onFileAccepted,
    onBeforeOpen,
    onBeforeDrop,
    onYouTubeClick,
    maxSizeBytes,
    isLoading = false,
}) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showNotification } = useNotificationStore();

    const handleProcessFile = useCallback(
        async (file: File) => {
            setErrorMessage(null);
            const validation = validateAudioFile(file, maxSizeBytes);
            if (!validation.valid) {
                setErrorMessage(validation.error || 'Invalid audio file.');
                showNotification({
                    type: 'error',
                    title: 'Unsupported File',
                    message: validation.error,
                });
                return;
            }

            setIsProcessing(true);
            try {
                const metadata = await extractAudioMetadata(file);
                setIsProcessing(false);
                showNotification({
                    type: 'success',
                    title: 'Audio File Loaded',
                    message: `${file.name} (${metadata.format}, ${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
                });
                onFileAccepted(file, metadata);
            } catch (err: unknown) {
                setIsProcessing(false);
                const msg = err instanceof Error ? err.message : 'Failed to parse audio file.';
                setErrorMessage(msg);
                showNotification({
                    type: 'error',
                    title: 'Metadata Parsing Error',
                    message: msg,
                });
            }
        },
        [maxSizeBytes, onFileAccepted, showNotification]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragOver(false);

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (onBeforeDrop && !onBeforeDrop(file)) {
                    return;
                }
                handleProcessFile(file);
            }
        },
        [handleProcessFile, onBeforeDrop]
    );

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                handleProcessFile(e.target.files[0]);
            }
        },
        [handleProcessFile]
    );

    const openPicker = () => {
        if (onBeforeOpen && !onBeforeOpen()) {
            return;
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const isBusy = isLoading || isProcessing;

    return (
        <div className="w-full flex flex-col gap-3">
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={openPicker}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 flex flex-col items-center justify-center group ${isDragOver
                    ? 'border-blue-500 bg-blue-500/10 shadow-2xl shadow-blue-500/20 scale-[1.01]'
                    : 'border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-blue-500/50 hover:from-white/[0.07] hover:to-white/[0.02] shadow-xl shadow-black/40'
                    } ${isBusy ? 'pointer-events-none opacity-70' : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Upload audio file drop area"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openPicker();
                    }
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*"
                    className="hidden"
                    onChange={handleInputChange}
                    disabled={isBusy}
                />

                {/* Central Icon */}
                <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-200 ${isDragOver
                        ? 'scale-110 bg-blue-600/30 text-blue-300 border border-blue-400/50 shadow-lg shadow-blue-500/25'
                        : 'bg-gradient-to-tr from-blue-600/20 via-blue-500/15 to-indigo-500/10 border border-blue-500/30 text-blue-400 group-hover:scale-105 group-hover:border-blue-500/60 shadow-md shadow-blue-500/10'
                        }`}
                >
                    {isBusy ? (
                        <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                    ) : (
                        <UploadCloud className="w-7 h-7 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    )}
                </div>

                {/* Action Title */}
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mb-1.5">
                    {isBusy ? 'Reading audio file...' : 'Drop your song here, or browse files'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
                    Upload any song to isolate clean vocals and create instrumental karaoke tracks.
                </p>

                {/* Format Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                    {['MP3', 'WAV', 'FLAC', 'M4A', 'OGG'].map((format) => (
                        <span
                            key={format}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-300 flex items-center gap-1.5 shadow-xs"
                        >
                            <FileAudio className="w-3 h-3 text-blue-400" />
                            {format}
                        </span>
                    ))}
                    <span className="text-[11px] font-medium text-slate-400 ml-1">Up to 150 MB</span>
                </div>

                {/* Action Buttons: Local Upload & YouTube Link */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={openPicker}
                        disabled={isBusy}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <UploadCloud className="w-4 h-4" />
                        <span>Select Song</span>
                    </button>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onYouTubeClick) onYouTubeClick();
                        }}
                        disabled={isBusy}
                        className="px-5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 border border-white/10 hover:border-red-500/40 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer group hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <YouTubeIcon className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                        <span>YouTube Link</span>
                    </button>
                </div>
            </div>

            {/* Error alert if any */}
            {errorMessage && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                </div>
            )}
        </div>
    );
};

