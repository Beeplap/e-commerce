"use client";

import { useCallback, useState } from "react";
import { DateDisplay } from "@/components/ui/displays";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ui-foreground">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ui-secondary">
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
          <p className="py-12 text-center text-sm text-ui-muted">
            No notifications yet.
          </p>
        )}
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`border-b border-ui-border py-5 motion-safe:transition-colors duration-[var(--ui-duration-fast)] ${
              notification.is_read ? "" : "bg-ui-selected px-3"
            }`}
          >
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!notification.is_read && (
                    <span className="text-ui-caption font-medium text-ui-accent">
                      Unread
                    </span>
                  )}
                  <span className="font-semibold text-ui-foreground text-sm">
                    {notification.title}
                  </span>
                  <span className="text-ui-caption text-ui-secondary">
                    {notification.notification_type
                      .replaceAll("_", " ")
                      .toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ui-secondary">
                  {notification.body}
                </p>
                <p className="mt-1.5 text-xs text-ui-muted">
                  <DateDisplay value={notification.created_at} />
                </p>
              </div>
              {!notification.is_read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(notification.id)}
                  className="shrink-0 text-xs text-ui-accent hover:text-ui-accent font-medium"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {notificationsQuery.data.count > 25 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ui-secondary">
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
