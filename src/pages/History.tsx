import React, { useState } from 'react';
import { useJobStore } from '../store/useJobStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import type { ProcessingJob } from '../types';
import {
  History as HistoryIcon,
  Search,
  Trash2,
  Terminal,
  Clock,
  Cpu,
  Layers,
  Zap,
  FileText,
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { jobs, deleteJob, clearJobs, statusFilter, setStatusFilter, searchQuery, setSearchQuery } =
    useJobStore();
  const { showNotification } = useNotificationStore();

  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && job.status === 'completed') ||
      (statusFilter === 'queued' && job.status === 'queued') ||
      (statusFilter === 'failed' && job.status === 'failed') ||
      (statusFilter === 'cancelled' && job.status === 'cancelled');

    return matchesSearch && matchesStatus;
  });

  const handleClearAll = async () => {
    try {
      await clearJobs();
      setShowClearConfirm(false);
      showNotification({
        type: 'info',
        title: 'History Cleared',
        message: 'All processing history records have been cleared.',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Clear Failed',
        message: 'Failed to clear history log.',
      });
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await deleteJob(id);
      showNotification({
        type: 'success',
        title: 'Job Record Removed',
        message: 'Job was removed from history.',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not remove job record.',
      });
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <HistoryIcon className="w-6 h-6 text-[#7357F5]" />
            <span>Processing History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete audit trail of all separation jobs, runtimes, models and execution states.
          </p>
        </div>

        {jobs.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-xs font-medium text-slate-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-colors w-fit"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Job ID, project or file name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#151F30] border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-[#7357F5] transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#151F30] border border-white/10 self-start md:self-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'completed', label: 'Completed' },
            { id: 'queued', label: 'Queued (Stage 2)' },
            { id: 'failed', label: 'Failed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-gradient-to-r from-[#7357F5] to-[#3984FF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* History Jobs List */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={searchQuery || statusFilter !== 'all' ? 'No Matching Jobs' : 'No Processing History'}
          description={
            searchQuery || statusFilter !== 'all'
              ? 'No job entries match your filter criteria.'
              : 'Separation jobs and execution logs will appear here once you initiate processing in New Separation.'
          }
        />
      ) : (
        <div className="bg-[#151F30] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="divide-y divide-white/5">
            {filteredJobs.map((job) => {
              const dateStr = new Date(job.startedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={job.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#182338] transition-colors"
                >
                  {/* Left Job Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7357F5]/20 to-[#3984FF]/20 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {job.mode === 'quick-local' ? (
                        <Zap className="w-5 h-5 text-[#16C784]" />
                      ) : job.mode === 'multi-stem' ? (
                        <Layers className="w-5 h-5 text-[#3984FF]" />
                      ) : (
                        <Cpu className="w-5 h-5 text-[#7357F5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white truncate">{job.projectName}</h4>
                        <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                          {job.id}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="truncate max-w-[220px]" title={job.fileName}>
                          {job.fileName}
                        </span>
                        <span>•</span>
                        <span className="text-slate-300 font-mono text-[11px]">{job.engine}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {dateStr}
                        </span>
                        {job.durationSeconds && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-emerald-400">{job.durationSeconds}s run</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Status & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
                    <StatusBadge status={job.status} />

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#3984FF]" />
                        <span>Logs</span>
                      </button>

                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete log record"
                        aria-label="Delete log record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Execution Logs Modal */}
      <Modal
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        title="Execution Log & Diagnostics"
        subtitle={selectedJob ? `Job ID: ${selectedJob.id} • ${selectedJob.projectName}` : ''}
        maxWidth="lg"
      >
        {selectedJob && (
          <div className="space-y-4 text-xs">
            <div className="bg-[#101827] rounded-xl p-4 border border-white/10 space-y-2">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Target Engine:</span>
                <span className="font-mono text-white">{selectedJob.engine}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Mode:</span>
                <span className="font-mono text-[#7357F5] uppercase">{selectedJob.mode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Status:</span>
                <StatusBadge status={selectedJob.status} />
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Execution Timestamp:</span>
                <span className="font-mono text-white">{selectedJob.startedAt}</span>
              </div>
            </div>

            {/* Terminal logs view */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Terminal className="w-3.5 h-3.5 text-[#7357F5]" />
                <span>Console Output</span>
              </div>
              <div className="bg-[#080D18] border border-white/10 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1 max-h-48 overflow-y-auto">
                {selectedJob.logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-slate-600 select-none">{index + 1}.</span>
                    <span className="text-slate-300">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Processing History"
        subtitle="Remove all historical execution records"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Are you sure you want to delete all job execution history records? Your saved audio projects and
            separated files will not be affected.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
