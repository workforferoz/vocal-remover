import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { useNotificationStore } from '../store/useNotificationStore';
import { resetEntireDatabase } from '../services/db';
import { resetTokensForTesting } from '../services/tokenService';
import {
  ShieldCheck,
  Building,
  Mail,
  Database,
  Trash2,
  Lock,
  EyeOff,
  UserCheck,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  usePageMeta(
    'Privacy Policy & Legal Compliance - Vocal Remover',
    'Comprehensive privacy policy, business registration details, data minimization practices, and data deletion rights for Vocal Remover.'
  );

  const { showNotification } = useNotificationStore();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteSuccess, setDeleteSuccess] = useState<boolean>(false);

  const handlePurgeAllLocalData = async () => {
    if (!window.confirm('Are you sure you want to delete all local projects, audio blobs, and saved preferences from this browser? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await resetEntireDatabase();
      resetTokensForTesting();
      setDeleteSuccess(true);
      showNotification({
        type: 'success',
        title: 'All Local Data Deleted',
        message: 'Your browser storage has been completely erased.',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: 'Could not erase browser database. Please clear browser site data manually.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Privacy Policy & Compliance
            </h1>
            <p className="text-xs text-slate-300">
              Effective Date: November 2026 | Last Updated: November 2026
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-2">
          At <strong>Vocal Remover</strong> (operated by <strong>Ayesha Tech Studio</strong>), your privacy and
          data security are our top priorities. This document explains our data practices, our commitment to
          data minimization, and your legal rights under applicable privacy legislation (including GDPR, CCPA,
          and the Digital Personal Data Protection Act).
        </p>
      </div>

      {/* 1. Verified Business Details */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Building className="w-4 h-4 text-blue-400" />
          <span>1. Business Ownership & Contact Information</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Business / Studio Name</span>
            <p className="text-white font-bold">Ayesha Tech Studio</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Proprietor / Operating Contact</span>
            <p className="text-white font-bold">Feroz Nadaf</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Email Support</span>
            <p className="text-blue-400 font-mono">
              <a href="mailto:ayeshatechstudio@gmail.com" className="hover:underline">
                ayeshatechstudio@gmail.com
              </a>
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Phone & WhatsApp Support</span>
            <p className="text-emerald-400 font-mono">
              <a href="tel:+919743247790" className="hover:underline">
                +91 9743247790
              </a>
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 sm:col-span-2">
            <span className="text-slate-400 font-medium">Operating Jurisdiction & Payment Processing</span>
            <p className="text-white">
              Karnataka, India &bull; Payment Mode: <span className="text-slate-200 font-semibold">Secure Direct QR Pay (Ayesha Tech Studio)</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Data Minimization & Local Processing */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span>2. Data Minimization & On-Device Processing</span>
        </h2>
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            We strictly believe in <strong>data minimization</strong>: we never collect, transmit, or store
            unnecessary user data.
          </p>
          <ul className="space-y-2 list-disc list-inside text-slate-300">
            <li>
              <strong className="text-white">Your Audio Never Leaves Your Computer:</strong> All audio
              processing is performed locally directly on your own computer or device without transmitting audio to the cloud.
            </li>
            <li>
              <strong className="text-white">No Cloud Storage of Audio:</strong> Separated stem WAV files and
              project metadata are stored strictly inside your browser's private IndexedDB database on your own device.
            </li>
            <li>
              <strong className="text-white">Device ID:</strong> We generate a local anonymous device identifier
              stored in your browser solely for the purpose of validating one-time token recharge vouchers.
            </li>
          </ul>
        </div>
      </div>

      {/* 3. Third-Party SDK Audit */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-blue-400" />
          <span>3. Third-Party SDK Audit & Zero-Tracking Guarantee</span>
        </h2>
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            We conducted a complete third-party SDK audit across our repository:
          </p>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Zero Advertising SDKs or Tracking Beacons</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Vocal Remover contains no Google Analytics, Meta (Facebook) Pixel, TikTok tracking, Sentry profiling,
              or cross-site advertising scripts. We do not sell, rent, or share personal data with data brokers.
            </p>
          </div>
        </div>
      </div>

      {/* 4. No Hidden Fees & No Dark Patterns */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" />
          <span>4. Transparent Pricing, No Hidden Fees & No Dark Patterns</span>
        </h2>
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            We strictly reject deceptive design practices (dark patterns):
          </p>
          <ul className="space-y-2 list-disc list-inside text-slate-300">
            <li>
              <strong className="text-white">Affordable & Simple Token Activation:</strong> Tokens and unlimited licenses can be activated directly with valid codes. There are no convenience fees, platform taxes, or
              hidden maintenance charges.
            </li>
            <li>
              <strong className="text-white">No Subscriptions or Auto-Renewals:</strong> Tokens are bought on
              an as-needed basis via direct instant payment. We never ask for your credit card details, and there are zero
              recurring auto-debits.
            </li>
            <li>
              <strong className="text-white">5 Free Tokens:</strong> Every new visitor receives 5 free conversion
              tokens automatically on their first visit without requiring payment information or registration.
            </li>
          </ul>
        </div>
      </div>

      {/* 5. Age Consent & Children's Data */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-400" />
          <span>5. Age Consent & Children's Data Protection</span>
        </h2>
        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>
            Vocal Remover is designed for general audiences interested in music editing, remixing, and karaoke.
            The application is intended for users aged <strong>13 and older</strong> (or 18+ for initiating
            online transactions). We do not knowingly target, market to, or collect any personal information from children
            under 13 years of age.
          </p>
        </div>
      </div>

      {/* 6. Email Communication & Unsubscribe Policy */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          <span>6. Email Policy & Unsubscribe Rights</span>
        </h2>
        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>
            We maintain a strict anti-spam policy. We do not operate marketing email blasts, newsletters, or
            promotional mailing lists. Any email correspondence sent from{' '}
            <code className="text-slate-200 font-mono">ayeshatechstudio@gmail.com</code> is strictly transactional
            in response to customer inquiries or voucher fulfillment.
          </p>
          <p>
            To stop receiving any further communication or request deletion of email records, simply reply with
            "Unsubscribe" or email{' '}
            <a href="mailto:ayeshatechstudio@gmail.com?subject=Unsubscribe%20Request" className="text-blue-400 hover:underline">
              ayeshatechstudio@gmail.com
            </a>
            .
          </p>
        </div>
      </div>

      {/* 7. Font & Asset Licensing */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-blue-400" />
          <span>7. Font & Image Licensing</span>
        </h2>
        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>
            All assets utilized across Vocal Remover are fully licensed:
          </p>
          <ul className="space-y-1.5 list-disc list-inside text-slate-300">
            <li>
              <strong className="text-white">Typography:</strong> Native system font stack
              (<code className="font-mono text-slate-200">-apple-system, BlinkMacSystemFont, Segoe UI, Roboto</code>),
              which requires zero third-party font licensing or external font downloads.
            </li>
            <li>
              <strong className="text-white">Icons:</strong> Lucide React icons licensed under the permissive
              ISC open-source license.
            </li>
            <li>
              <strong className="text-white">Logo & Branding:</strong> Proprietary artwork owned by Ayesha Tech Studio.
            </li>
          </ul>
        </div>
      </div>

      {/* 8. Right to Erasure & Data Deletion Request */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>8. Right to Erasure & Data Deletion Request</span>
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          You have the complete right under GDPR (Article 17) and the DPDP Act to request deletion of all data
          associated with your usage:
        </p>

        {/* Option A: One-Click Local Database Purge */}
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Option A: Erase All Local Browser Data (Instant)
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Instantly deletes all saved projects, stems, audio blobs, settings, and tokens from this browser.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePurgeAllLocalData}
            disabled={isDeleting || deleteSuccess}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : deleteSuccess ? 'Data Successfully Erased' : 'Erase All Local Data Now'}</span>
          </button>
        </div>

        {/* Option B: Email Support Deletion Request */}
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Option B: Request Customer Support Record Deletion
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              To delete any WhatsApp or email correspondence, send a formal request to our privacy team.
            </p>
          </div>

          <a
            href="mailto:ayeshatechstudio@gmail.com?subject=Data%20Deletion%20Request%20-%20Vocal%20Remover&body=Hello%20Ayesha%20Tech%20Studio%2C%20please%20delete%20all%20correspondence%20and%20support%20records%20associated%20with%20my%20email%2Fphone."
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Submit Data Deletion Request via Email</span>
          </a>
        </div>
      </div>

      {/* Return Home Button */}
      <div className="pt-4 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-sm"
        >
          <span>Return to Vocal Remover</span>
        </Link>
      </div>
    </div>
  );
};
