import React from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const NotificationContainer: React.FC = () => {
  const { notifications, dismissNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {notifications.map((n) => {
        let Icon = Info;
        let borderClass = 'border-blue-500/40';
        let bgClass = 'bg-[#0F172A]';
        let textIconColor = 'text-blue-400';

        if (n.type === 'success') {
          Icon = CheckCircle2;
          borderClass = 'border-emerald-500/40';
          textIconColor = 'text-emerald-400';
        } else if (n.type === 'warning') {
          Icon = AlertTriangle;
          borderClass = 'border-amber-500/40';
          textIconColor = 'text-amber-400';
        } else if (n.type === 'error') {
          Icon = AlertCircle;
          borderClass = 'border-rose-500/40';
          textIconColor = 'text-rose-400';
        }

        return (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${borderClass} ${bgClass} shadow-xl transition-all duration-150 animate-in fade-in slide-in-from-bottom-2`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${textIconColor}`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white tracking-tight">{n.title}</h4>
              {n.message && <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(n.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

