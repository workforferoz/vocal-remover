import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { Music, Phone, Mail, MessageCircle, ExternalLink, ShieldCheck, FileText } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export const Footer: React.FC = () => {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-800 bg-[#0F172A] py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
            {/* Column 1: Brand & Clickable Logo */}
            <div className="space-y-3 sm:col-span-2">
              <Link to="/" className="flex items-center gap-2.5 w-fit group" title="Vocal Remover Home">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:bg-blue-500 transition-colors">
                  <Music className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-base text-white tracking-tight">
                  Vocal Remover
                </span>
              </Link>
              <p className="text-slate-300 text-xs leading-relaxed max-w-sm">
                Easily remove vocals and create clean karaoke tracks from any song.
                Fast, private, and simple to use directly on your device.
              </p>
            </div>

            {/* Column 2: Navigation Links */}
            <div className="space-y-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200 block">
                Quick Links
              </span>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    Vocal Remover Home
                  </Link>
                </li>
                <li>
                  <Link to="/projects" className="hover:text-white transition-colors">
                    My Songs & Stems
                  </Link>
                </li>
                <li>
                  <Link to="/settings" className="hover:text-white transition-colors">
                    Audio Settings
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-white transition-colors">
                    Privacy & Legal Policy
                  </Link>
                </li>
                <li>
                  <a
                    href="https://www.karokemaker.online/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-white transition-colors text-blue-400"
                  >
                    <span>Karoke Maker Online</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact & Support (Clickable Phone & Email) */}
            <div className="space-y-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200 block">
                Contact & Support
              </span>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <a
                    href="https://wa.me/919743247790"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp: 9743247790</span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+919743247790"
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                    title="Call Phone Support"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>+91 9743247790</span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:ayeshatechstudio@gmail.com"
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors break-all"
                    title="Send Email"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>ayeshatechstudio@gmail.com</span>
                  </a>
                </li>
                <li className="pt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen(true)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                  >
                    Terms of Use
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Bar with Dynamic Year */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <div>
              &copy; {CURRENT_YEAR} <strong className="text-slate-200">Ayesha Tech Studio</strong>. All rights reserved.
            </div>
            <div className="text-[11px] text-slate-400">
              Designed and developed for studio creators and producers.
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      <Modal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Privacy Policy"
        subtitle="100% Private, On-Device Audio Processing"
      >
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          <div className="p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-200 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-blue-400" />
            <p>
              Your privacy is our highest priority. All audio files processed through Vocal Remover remain on your
              local computer or device. We do not upload, store, or sell your audio content.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Local Processing & Storage</h4>
            <p>
              Vocal Remover processes your songs directly on your computer or device.
              Separated vocals and karaoke tracks are saved securely in your browser.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Payment & Token Information</h4>
            <p>
              When purchasing conversion tokens via official payment QR, payment transactions are handled directly
              by your payment application (Google Pay, PhonePe, Paytm) according to standard banking security protocols.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Contact</h4>
            <p>
              For privacy inquiries, contact support at{' '}
              <a href="mailto:ayeshatechstudio@gmail.com" className="text-blue-400 hover:underline">
                ayeshatechstudio@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title="Terms of Service"
        subtitle="Vocal Remover Usage Terms & Token System"
      >
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 flex items-start gap-2.5">
            <FileText className="w-5 h-5 flex-shrink-0 text-blue-400" />
            <p>
              By using Vocal Remover, you agree to these fair usage terms and understand the token-based conversion model.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Token Billing</h4>
            <p>
              1 song conversion requires 1 conversion token. Each new user receives 5 free trial tokens upon first visit.
              Additional tokens and unlimited conversion licenses can be activated directly with a valid code or obtained
              via WhatsApp support (+91 9743247790) from Ayesha Tech Studio.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Intellectual Property</h4>
            <p>
              You must own the rights or have permission to separate and modify any audio files you upload to Vocal
              Remover. Ayesha Tech Studio is not responsible for copyright violations committed by users.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Refunds & Support</h4>
            <p>
              If a token is consumed by an unrecoverable engine failure, contact Ayesha Tech Studio on WhatsApp (+91 9743247790) with
              your Device ID for immediate token replacement.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
