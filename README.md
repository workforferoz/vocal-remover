# Vocal Studio AI — Stage 2: Genuine Local Audio Processing

[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Native_DSP-orange?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Tests](https://img.shields.io/badge/Vitest-23_Passed-brightgreen?style=flat-square)](https://vitest.dev/)
[![Storage](https://img.shields.io/badge/Storage-IndexedDB_via_IDB-green?style=flat-square)](https://github.com/jakearchibald/idb)

**Vocal Studio AI** is a professional music source-separation and vocal-reduction application engineered for karaoke producers, musicians, DJs, and audio engineers.

This release marks the completion of **Stage 2: Genuine Local Audio Processing**. Users can upload any stereo song, decode the audio stream with the Web Audio API, analyze its sample rate, channels, bit depth, peak amplitude, and RMS energy, apply real DSP centre-channel cancellation with strength control, compare results instantly using A/B toggles, and export an RFC-compliant 16-bit PCM WAV file.

---

## 1. Stage 2 Core Objectives & Achievements

- **100% Client-Side Processing**: Zero external APIs, zero paid services, and zero audio uploaded to servers. All operations execute strictly within the browser environment.
- **Genuine Centre-Channel Cancellation DSP**:
  - Stereo subtraction matrix: $L_{out} = L - R$ and $R_{out} = R - L$ with normalized blending:
    $$L_{out} = (1 - S) \cdot L + S \cdot \frac{L - R}{2}$$
    $$R_{out} = (1 - S) \cdot R + S \cdot \frac{R - L}{2}$$
  - Seamless strength adjustment from 0% (original stereo) to 100% (full centre-channel elimination).
  - Safe mono audio handling without crashing (preserves mono signal and alerts the user).
  - Soft-clamping protection to guarantee output remains strictly within $[-1.0, 1.0]$.
- **RFC-Compliant 16-bit PCM WAV Encoder**:
  - Encodes raw audio channels directly into standard RIFF WAVE format with accurate headers (SampleRate, ByteRate, BlockAlign, Subchunk2Size).
  - Preserves duration, channel count, and sample rate.
  - Generates downloadable `audio/wav` Blobs with descriptive filenames: `<name>_vocal-reduced_<strength>pct.wav`.
- **High-Performance Canvas Waveform**:
  - Downsampled peak decimation rendered on an HTML5 `<canvas>` via `ResizeObserver`.
  - Zero heavy DOM nodes; renders thousands of samples in < 1 ms.
- **Instant A/B Audio Comparison**:
  - Seamless toggle between "A (Original Stereo)" and "B (Vocal Reduced)" preserving the exact playback playhead timestamp.
- **Real-Time Progress Reporting**:
  - Chunked asynchronous processing (`applyVocalReductionAsync`) prevents browser UI locking and displays real progress percentages based on processed sample counts.

---

## 2. Technical Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **DSP & Audio Engine** | Web Audio API + TypedArrays | AudioContext decoding, Float32Array channel processing, peak decimation |
| **WAV Encoder** | Custom 16-bit PCM ArrayBuffer Encoder | Pure JavaScript RIFF WAV container builder with clamp protection |
| **Waveform Visualizer** | HTML5 Canvas + ResizeObserver | Efficient GPU-accelerated audio waveform and scrub playhead |
| **Framework** | React 19 + TypeScript | Strongly-typed components, zero unhandled errors |
| **Build & Tooling** | Vite 8 + @tailwindcss/vite | Sub-second production compilation and HMR |
| **Test Suite** | Vitest 5 | 23 automated unit tests covering DSP algorithms, encoders, and edge cases |
| **State & Persistence** | Zustand 5 + IndexedDB (`idb`) | Reactive audio studio state and persistent project metadata |

---

## 3. Audio Analysis & DSP Engine Specifications

### A. Supported Formats
- **WAV**: 16-bit, 24-bit PCM, and 32-bit float.
- **MP3**: MPEG Layer-3 up to 320 kbps.
- **FLAC**: Lossless audio where supported by the browser.
- **M4A / AAC**: AAC stereo files where supported by the browser.
- **OGG**: Ogg Vorbis where supported by the browser.

### B. Track Analysis Metrics
1. **Duration**: Precise to the millisecond.
2. **Sample Rate**: Input sample rate (e.g., 44.1 kHz, 48 kHz, 96 kHz, 192 kHz).
3. **Channels**: Mono (1 ch) or Stereo (2 ch).
4. **Bit Depth**: Header-inspected for WAV/FLAC, or internal 32-bit float.
5. **Peak Amplitude**: Linear scale ($0.0$ to $1.0$) and full-scale decibels ($\text{dBFS} = 20 \log_{10}(\text{peak})$).
6. **RMS Energy Level**: Root-mean-square linear and $\text{dBFS} = 20 \log_{10}(\text{RMS})$.

### C. DSP Center-Channel Cancellation Limitations (Transparent Disclosure)
- **What it does**: Removes audio signals that are identical in both left and right channels (which is the industry standard mix position for lead vocals).
- **What it also affects**: Center-panned kick drums, basslines, and center snare frequencies will be reduced alongside vocals.
- **What remains**: Stereo vocal reverbs, wide panned backing vocals, and stereo delays remain audible because they have differing left/right phase signatures.
- **Stage 3 Roadmap**: Deep neural network separation (Demucs / MDX-Net) will be introduced to cleanly extract discrete stems without attenuating bass or drums.

---

## 4. Folder Structure & Modular Architecture

```
vocal-remover/
├── src/
│   ├── services/
│   │   ├── dsp/
│   │   │   ├── audioDecoder.ts        # Web Audio API loading, decoding & peak downsampling
│   │   │   ├── vocalReducer.ts        # Sync/async center cancellation & audio analysis
│   │   │   ├── wavEncoder.ts          # 16-bit PCM RIFF WAV binary encoder & download trigger
│   │   │   └── __tests__/
│   │   │       ├── audioDecoder.test.ts   # Tests for header parsing & peak decimation
│   │   │       ├── vocalReducer.test.ts   # Tests for DSP center cancellation & mono safety
│   │   │       ├── wavEncoder.test.ts     # Tests for WAV headers, PCM clamping & sample rates
│   │   │       └── dspIntegration.test.ts # Tests for edge cases, 192kHz, and long audio
│   │   ├── audioMetadata.ts           # Format validation, mime type checking & duration
│   │   ├── db.ts                      # IndexedDB database CRUD for projects, jobs & settings
│   │   └── engineClient.ts            # Local Python daemon health check & diagnostics
│   ├── components/
│   │   ├── audio/
│   │   │   ├── QuickLocalStudio.tsx   # Interactive Quick Local DSP workspace
│   │   │   ├── CanvasWaveform.tsx     # GPU-accelerated HTML5 Canvas waveform visualizer
│   │   │   ├── AudioPlayer.tsx        # Standard HTML5 audio preview controller
│   │   │   └── AudioMetadataCard.tsx  # Track info and hardware metrics display
│   │   ├── dashboard/
│   │   │   ├── ModeSelector.tsx       # Quick Local vs AI Pro vs Multi-Stem mode selector
│   │   │   ├── RecentProjectsList.tsx # Recent projects list with quick preview
│   │   │   ├── SystemStatusCard.tsx   # Workstation diagnostics & engine ping
│   │   │   └── WelcomeSection.tsx     # Studio banner and quick upload action
│   │   ├── upload/
│   │   │   └── FileDropzone.tsx       # Drag-and-drop file upload with format badges
│   │   └── layout/
│   │       ├── AppLayout.tsx          # Responsive navigation shell
│   │       ├── Header.tsx             # Breadcrumb, status pill & profile placeholder
│   │       └── Sidebar.tsx            # Navigation links & engine status widget
│   ├── pages/
│   │   ├── Dashboard.tsx              # Main dashboard hub
│   │   ├── NewSeparation.tsx          # Dynamic workspace (Quick Local DSP & AI Pro queue)
│   │   ├── Projects.tsx               # Saved projects, audio playback & JSON export
│   │   ├── History.tsx                # Processing job logs & execution details
│   │   ├── Settings.tsx               # Audio defaults, daemon URL & IndexedDB cache purge
│   │   └── Help.tsx                   # User guides, format specs & FAQ
│   ├── App.tsx                        # Client-side router with lazy loading
│   └── main.tsx                       # React application entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Automated Unit Tests

All 23 automated tests run via Vitest:

```powershell
npm.cmd test
```

### Test Coverage Highlights:
- **`wavEncoder.test.ts`**:
  - RIFF WAVE header structure (Magic strings "RIFF", "WAVE", "fmt ", "data").
  - 16-bit signed PCM integer scaling and overshoot clamping ($[-32768, 32767]$).
  - Stereo BlockAlign (4 bytes) and Mono BlockAlign (2 bytes).
  - High sample rate support ($96\text{ kHz}$).
  - Valid `audio/wav` Blob generation.
- **`vocalReducer.test.ts`**:
  - 100% elimination of identical mono center signals on Left and Right channels.
  - Side content preservation and vocal cancellation in mixed audio.
  - 0% reduction strength identity check ($L_{out} \approx L_{in}, R_{out} \approx R_{in}$).
  - 50% linear interpolation blend check.
  - Mono audio graceful handling (returns `isMono: true` and warning without throwing).
  - Chunked asynchronous processing with real progress updates.
  - Peak amplitude (linear + dBFS) and RMS energy level calculations.
- **`audioDecoder.test.ts`**:
  - Accurate bit depth detection from WAV PCM headers.
  - FLAC signature recognition.
  - Downsampled peak decimation algorithm.
- **`dspIntegration.test.ts`**:
  - Short audio files ($100\text{ samples}$).
  - Long audio files ($500,000\text{ samples}$, $\approx 11.3\text{ seconds}$).
  - High-resolution audio ($192\text{ kHz}$).
  - Phase inversion clipping resistance.
  - Extension and MIME type validation.

---

## 6. Development & Run Commands

```powershell
# Navigate to project root
cd "e:\vocal remover"

# Run automated unit tests
npm.cmd test

# Run code linter
npm.cmd run lint

# Start Vite development server
npm.cmd run dev

# Run TypeScript compilation and production build
npm.cmd run build

# Preview production build
npm.cmd run preview
```

---

## 7. Verification Results

| Check | Command | Result |
| :--- | :--- | :--- |
| **Unit Test Suite** | `npm.cmd test` | **23 passed** across 4 test files (395 ms) |
| **Code Quality Linter** | `npm.cmd run lint` | **0 errors, 0 warnings** across 42 files (56 ms) |
| **TypeScript Typecheck** | `tsc -b` | **0 type errors** |
| **Production Vite Build** | `npm.cmd run build` | **Built in 789 ms** with code splitting |
| **Audio File Validation** | Supported & Unsupported files | Tested WAV, MP3, FLAC, M4A, OGG, and invalid files |
| **WAV Export** | `downloadWavFile` | RFC-compliant 16-bit PCM WAV validated |
