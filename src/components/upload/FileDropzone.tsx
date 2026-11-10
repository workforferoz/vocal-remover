import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileAudio, AlertCircle, Loader2 } from 'lucide-react';
import { validateAudioFile, extractAudioMetadata } from '../../services/audioMetadata';
import type { AudioMetadata } from '../../types';
import { useNotificationStore } from '../../store/useNotificationStore';

interface FileDropzoneProps {
  onFileAccepted: (file: File, metadata: AudioMetadata) => void;
  maxSizeBytes?: number;
  isLoading?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileAccepted,
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
        handleProcessFile(file);
      }
    },
    [handleProcessFile]
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
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-[#7357F5] bg-[#7357F5]/10 shadow-[0_0_30px_rgba(115,87,245,0.2)]'
            : 'border-white/15 bg-[#151F30]/70 hover:border-white/30 hover:bg-[#151F30]'
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
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 ${
            isDragOver ? 'scale-110 bg-[#7357F5]/30' : 'bg-white/5 border border-white/10'
          }`}
        >
          {isBusy ? (
            <Loader2 className="w-8 h-8 text-[#7357F5] animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-[#7357F5]" />
          )}
        </div>

        {/* Action Title */}
        <h3 className="text-lg font-semibold text-white tracking-tight mb-1">
          {isBusy ? 'Analyzing Audio Metadata...' : 'Drop your song here, or browse files'}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Upload any stereo audio track to isolate vocals, instrumental, drums, bass, and custom stems.
        </p>

        {/* Format Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {['MP3', 'WAV', 'FLAC', 'M4A', 'OGG'].map((format) => (
            <span
              key={format}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#101827] border border-white/10 text-slate-300 flex items-center gap-1.5"
            >
              <FileAudio className="w-3 h-3 text-[#3984FF]" />
              {format}
            </span>
          ))}
          <span className="text-xs text-slate-500 ml-1">Up to 150 MB</span>
        </div>

        {/* Upload Button */}
        <button
          type="button"
          disabled={isBusy}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white font-medium text-sm shadow-md hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center gap-2 pointer-events-none"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Select Audio Track</span>
        </button>
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

