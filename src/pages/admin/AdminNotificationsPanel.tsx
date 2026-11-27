import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Clock3 } from 'lucide-react';
import { apiRequest } from '../../services/api';

interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  eventType: string;
  isRead: boolean;
  createdAt: string;
}

export function AdminNotificationsPanel() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => apiRequest<NotificationRecord[]>('/admin/notifications'),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
  const notifications = data?.data || [];
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const markRead = async (id: number) => {
    setActionPending(`read:${id}`);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiRequest(`/admin/notifications/${id}/read`, { method: 'PATCH' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
      setActionMessage('Notification marked as read.');
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'The notification could not be updated.');
    } finally {
      setActionPending(null);
    }
  };

  const markAllRead = async () => {
    setActionPending('all');
    setActionError(null);
    setActionMessage(null);
    try {
      await apiRequest('/admin/notifications/read-all', { method: 'PATCH' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
      setActionMessage('All notifications have been marked as read.');
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'Notifications could not be updated.');
    } finally {
      setActionPending(null);
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-semibold">Notifications Centre</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Administrative alerts and updates for your account.</p>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={actionPending !== null || !notifications.some((item) => !item.isRead)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-white/5"
        >
          <CheckCheck className="h-4 w-4" /> {actionPending === 'all' ? 'Updating…' : 'Mark all as read'}
        </button>
      </header>
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
      {actionMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{actionMessage}</p>}
      {isPending && <p role="status" className="rounded-xl border border-slate-200 p-5 text-sm">Loading notifications…</p>}
      {isError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error instanceof Error ? error.message : 'Unable to load notifications.'}</p>}
      {!isPending && !isError && notifications.length === 0 && (
        <div className="hb-panel flex flex-col items-center gap-2 p-10 text-center">
          <Bell className="h-8 w-8 text-slate-400" />
          <p className="font-semibold">You are all caught up.</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">New administrative notifications will appear here.</p>
        </div>
      )}
      <div className="space-y-3">
        {notifications.map((item) => (
          <article key={item.id} className={`hb-panel flex flex-wrap items-start gap-4 p-4 ${item.isRead ? 'opacity-75' : 'border-sky-300/60 dark:border-sky-300/20'}`}>
            <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-100/80 text-sky-800 dark:bg-sky-300/10 dark:text-sky-200">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{item.title}</h2>
                {!item.isRead && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-300/10 dark:text-sky-200">NEW</span>}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.message}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 className="h-3 w-3" />{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            {!item.isRead && <button type="button" disabled={actionPending !== null} onClick={() => void markRead(item.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-50 dark:border-slate-700">{actionPending === `read:${item.id}` ? 'Updating…' : 'Mark read'}</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
