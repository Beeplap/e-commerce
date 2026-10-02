"use client";

import { useCallback, useState } from "react";
import {
  ApiErrorState,
  LoadingState,
  secondaryButton,
} from "@/components/ui/primitives";
import { errorMessage, notificationsApi } from "@/lib/api/client";
import type { Notification } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useAuth } from "@/features/auth/auth-provider";

export function NotificationsPanel() {
  const { state } = useAuth();
  const userId = state.kind === "authenticated" ? state.user.id : null;
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadNotifications = useCallback(
    (signal: AbortSignal) => notificationsApi.list(page, signal),
    [page],
  );
  const notificationsQuery = useApiQuery(
    userId ? `${userId}:notifications:${page}` : null,
    loadNotifications,
  );

  async function handleMarkRead(notificationId: string) {
    setActionError(null);
    try {
      await notificationsApi.markRead(notificationId);
      notificationsQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function handleMarkAllRead() {
    setSubmitting(true);
    setActionError(null);
    try {
      await notificationsApi.markAllRead();
      notificationsQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (notificationsQuery.kind === "error")
    return (
      <div className="mx-auto max-w-2xl py-12">
        <ApiErrorState
          error={notificationsQuery.error}
          onRetry={notificationsQuery.retry}
        />
      </div>
    );
  if (notificationsQuery.kind === "loading") return <LoadingState />;

  const notifications: Notification[] = notificationsQuery.data.results;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={submitting}
            onClick={handleMarkAllRead}
            className={secondaryButton}
          >
            {submitting ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {notifications.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            No notifications yet.
          </p>
        )}
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-xl border p-4 transition-colors ${
              notification.is_read
                ? "border-slate-200 bg-white"
                : "border-teal-200 bg-teal-50"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!notification.is_read && (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full bg-teal-600 shrink-0"
                    />
                  )}
                  <span className="font-semibold text-slate-900 text-sm">
                    {notification.title}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {notification.notification_type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {notification.body}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
              {!notification.is_read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(notification.id)}
                  className="shrink-0 text-xs text-teal-700 hover:text-teal-900 font-medium"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {notificationsQuery.data.count > 25 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className={secondaryButton}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(notificationsQuery.data.count / 25)}
          </span>
          <button
            type="button"
            disabled={page * 25 >= notificationsQuery.data.count}
            onClick={() => setPage((p) => p + 1)}
            className={secondaryButton}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
