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
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-colors duration-150 flex flex-col items-center justify-center ${isDragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-900/80 hover:border-slate-500 hover:bg-slate-900'
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
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-150 ${isDragOver ? 'scale-105 bg-blue-600/20 text-blue-400' : 'bg-slate-800 border border-slate-700 text-blue-400'
                        }`}
                >
                    {isBusy ? (
                        <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                    ) : (
                        <UploadCloud className="w-7 h-7 text-blue-400" />
                    )}
                </div>

                {/* Action Title */}
                <h3 className="text-lg font-bold text-white tracking-tight mb-1">
                    {isBusy ? 'Reading audio file...' : 'Drop your song here, or browse files'}
                </h3>
                <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
                    Upload any song to remove vocals and create karaoke tracks.
                </p>

                {/* Format Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                    {['MP3', 'WAV', 'FLAC', 'M4A', 'OGG'].map((format) => (
                        <span
                            key={format}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5"
                        >
                            <FileAudio className="w-3 h-3 text-blue-400" />
                            {format}
                        </span>
                    ))}
                    <span className="text-xs text-slate-400 ml-1">Up to 150 MB</span>
                </div>

                {/* Action Buttons: Local Upload & YouTube Link */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={openPicker}
                        disabled={isBusy}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
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
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-red-500/50 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors flex items-center gap-2 cursor-pointer group"
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

