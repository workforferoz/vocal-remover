import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import {
  HelpCircle,
  FileAudio,
  Cpu,
  ShieldCheck,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp,
  Laptop,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';

export const Help: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does Vocal Studio AI work without sending my audio to cloud servers?',
      a: 'Vocal Studio AI runs 100% on your local workstation. All audio decoding, metadata extraction, waveform rendering, and stereo phase cancellation happen inside your browser sandbox and your machine’s hardware. In Stage 2, deep neural models (Demucs) will execute locally using a lightweight Python engine on your CPU or GPU.',
    },
    {
      q: 'Can this run smoothly on a low-end PC with only 4 GB or 8 GB RAM?',
      a: 'Yes. Vocal Studio AI has been purpose-built with memory efficiency in mind: it avoids loading uncompressed PCM buffers into browser RAM, immediately revokes temporary Object URLs, generates lightweight waveform visuals, and stores audio in IndexedDB without memory duplication.',
    },
    {
      q: 'What is the difference between Quick Local and AI Professional?',
      a: 'Quick Local uses standard stereo phase and center-cut cancellation that runs directly in any modern browser without downloading heavy AI models. AI Professional uses deep neural networks (Demucs / MDX-Net) running on Python to intelligently isolate vocal frequencies from instruments with studio-grade fidelity and minimal phase distortion.',
    },
    {
      q: 'Why does AI Professional say "Stage 2 Engine Required"?',
      a: 'Vocal Studio AI follows a strict integrity standard. We never fake AI processing or output simulated files. Stage 1 establishes the full frontend architecture, audio pipeline, and IndexedDB foundation. Stage 2 connects the local Python Demucs backend engine to execute neural separation.',
    },
    {
      q: 'What audio formats are supported?',
      a: 'We support MP3 (up to 320 kbps), WAV (16-bit and 24-bit PCM), FLAC (lossless), M4A / AAC (standard Apple/mobile audio), and OGG Vorbis.',
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="border-b border-white/10 pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <HelpCircle className="w-6 h-6 text-[#7357F5]" />
          <span>Help & Documentation</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Complete guide to source separation modes, supported audio specifications, and low-end PC optimization.
        </p>
      </div>

      {/* Getting Started Guide */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <BookOpen className="w-5 h-5 text-[#7357F5]" />
          <h2 className="text-base font-semibold text-white">Getting Started with Vocal Studio AI</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#101827] border border-white/5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-[#7357F5] text-white flex items-center justify-center font-bold text-xs">
              1
            </span>
            <h4 className="font-semibold text-white">Upload Your Audio</h4>
            <p className="text-slate-400 leading-relaxed">
              Drag and drop an MP3, WAV, FLAC, or M4A track into the New Separation workspace.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101827] border border-white/5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-[#3984FF] text-white flex items-center justify-center font-bold text-xs">
              2
            </span>
            <h4 className="font-semibold text-white">Preview & Verify</h4>
            <p className="text-slate-400 leading-relaxed">
              Use the built-in HTML5 player and visual waveform scrubber to verify audio clarity.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101827] border border-white/5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-[#16C784] text-white flex items-center justify-center font-bold text-xs">
              3
            </span>
            <h4 className="font-semibold text-white">Select Separation Mode</h4>
            <p className="text-slate-400 leading-relaxed">
              Choose Quick Local for instant browser preview, or AI Professional / Multi-Stem for neural models.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101827] border border-white/5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
              4
            </span>
            <h4 className="font-semibold text-white">Manage & Export</h4>
            <p className="text-slate-400 leading-relaxed">
              Track jobs in Processing History and manage your separated tracks in My Projects.
            </p>
          </div>
        </div>
      </Card>

      {/* Processing Modes Comparison Table */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <Layers className="w-5 h-5 text-[#3984FF]" />
          <h2 className="text-base font-semibold text-white">Processing Modes Comparison</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold">
                <th className="py-3 px-4">Processing Mode</th>
                <th className="py-3 px-4">Stems Generated</th>
                <th className="py-3 px-4">Engine Tech</th>
                <th className="py-3 px-4">Hardware Footprint</th>
                <th className="py-3 px-4">Stage Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              <tr className="hover:bg-white/5">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#16C784]" />
                  <span>Quick Local</span>
                </td>
                <td className="py-3.5 px-4">Vocals, Instrumental (Center-Cut)</td>
                <td className="py-3.5 px-4">Browser Web Audio Matrix</td>
                <td className="py-3.5 px-4 text-emerald-400">Ultra-low (~50 MB RAM)</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-full bg-[#16C784]/15 text-[#16C784] border border-[#16C784]/30">
                    Stage 1 Active
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-white/5">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#7357F5]" />
                  <span>AI Professional</span>
                </td>
                <td className="py-3.5 px-4">Lead Vocals, Backing Instrumental</td>
                <td className="py-3.5 px-4">Demucs HTDemucs / MDX-Net</td>
                <td className="py-3.5 px-4 text-indigo-300">Medium (CPU / CUDA GPU)</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-full bg-[#7357F5]/15 text-[#7357F5] border border-[#7357F5]/30">
                    Stage 2 Integration
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-white/5">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#3984FF]" />
                  <span>Multi-Stem</span>
                </td>
                <td className="py-3.5 px-4">Vocals, Drums, Bass, Other</td>
                <td className="py-3.5 px-4">Demucs 4-Stem Deep Model</td>
                <td className="py-3.5 px-4 text-blue-300">High (Demucs Ensemble)</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-full bg-[#3984FF]/15 text-[#3984FF] border border-[#3984FF]/30">
                    Stage 3 Integration
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Supported Formats & Low-Spec PC Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Supported Audio Formats */}
        <Card className="p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <FileAudio className="w-5 h-5 text-[#16C784]" />
            <h3 className="text-base font-semibold text-white">Supported Audio Formats</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#101827] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">WAV (.wav)</span>
                <p className="text-[11px] text-slate-400">16-bit / 24-bit Linear PCM (Uncompressed)</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Recommended
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#101827] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">FLAC (.flac)</span>
                <p className="text-[11px] text-slate-400">Free Lossless Audio Codec (Full fidelity)</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Lossless
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#101827] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">MP3 (.mp3)</span>
                <p className="text-[11px] text-slate-400">MPEG Layer-3 up to 320 kbps</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                Supported
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#101827] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">M4A / AAC (.m4a, .aac)</span>
                <p className="text-[11px] text-slate-400">Advanced Audio Coding (Apple Music / YouTube)</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                Supported
              </span>
            </div>
          </div>
        </Card>

        {/* Low-End Computer Optimization */}
        <Card className="p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Laptop className="w-5 h-5 text-[#3984FF]" />
            <h3 className="text-base font-semibold text-white">Low-End PC Optimization Tips</h3>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#101827] border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-[#16C784] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">4 GB RAM Systems:</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Keep "Low Memory Mode" enabled in Settings. Close memory-intensive browser tabs when working with files larger than 50 MB.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#101827] border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-[#16C784] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Older Intel Processors:</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use the "Fast" quality preset for separations to minimize CPU calculation cycles and heat generation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#101827] border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-[#16C784] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Browser Cache Cleaning:</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Regularly click "Purge Audio Cache" in Settings to keep browser IndexedDB storage light and responsive.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Frequently Asked Questions Accordion */}
      <Card className="p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <AlertCircle className="w-5 h-5 text-[#7357F5]" />
          <h2 className="text-base font-semibold text-white">Frequently Asked Questions</h2>
        </div>

        <div className="divide-y divide-white/5">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className="py-3.5">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-medium text-white hover:text-[#7357F5] transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed pl-1 animate-in fade-in">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 100% Privacy Guarantee Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#151F30] to-[#101827] border border-[#16C784]/30 flex flex-col sm:flex-row items-center gap-4 text-xs">
        <div className="w-12 h-12 rounded-xl bg-[#16C784]/15 border border-[#16C784]/30 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-6 h-6 text-[#16C784]" />
        </div>
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-semibold text-white">100% Local & Private Processing Guarantee</h4>
          <p className="text-slate-300 mt-0.5 leading-relaxed">
            Your music and stems never leave your device. Vocal Studio AI has zero third-party cloud analytics,
            zero audio data transmissions, and operates completely offline.
          </p>
        </div>
      </div>
    </div>
  );
};

