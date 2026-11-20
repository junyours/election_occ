// resources/js/contexts/NotificationContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { notificationAPI } from "../api/notifications";
import type { Notification } from "../api/notifications";

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: number) => Promise<void>;
    addNotification: (notification: Notification) => void;
    clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    unreadCount: 0,
    loading: false,
    fetchNotifications: async () => {},
    markAsRead: async () => {},
    markAllAsRead: async () => {},
    deleteNotification: async () => {},
    addNotification: () => {},
    clearNotifications: () => {},
});

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error(
            "useNotifications must be used within a NotificationProvider",
        );
    }
    return context;
};

const POLL_INTERVAL_MS = 10_000;
const POLL_INTERVAL_HIDDEN_MS = 60_000;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { user, isAuthenticated } = useAuth();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initialFetchDone, setInitialFetchDone] = useState(false);

    const lastSeenIdRef = useRef<number>(0);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    const fetchNotifications = useCallback(async () => {
        if (!user || !isAuthenticated) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [notifResponse, countResponse] = await Promise.all([
                notificationAPI.getAll(),
                notificationAPI.getUnreadCount(),
            ]);

            const data = notifResponse.data || [];
            setNotifications(data);
            setUnreadCount(countResponse.data?.unread_count || 0);

            if (data.length > 0) {
                lastSeenIdRef.current = Math.max(
                    ...data.map((n) => n.notification_id),
                );
            } else {
                lastSeenIdRef.current = 0;
            }

            setInitialFetchDone(true);
        } catch (error) {
            console.error("❌ Failed to fetch notifications:", error);
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
        }
    }, [user, isAuthenticated]);

    const pollForNew = useCallback(async () => {
        if (!user || !isAuthenticated) return;

        try {
            const response = await notificationAPI.poll(
                lastSeenIdRef.current,
            );
            const newNotifs = response.data.notifications || [];

            if (newNotifs.length > 0) {
                setNotifications((prev) => {
                    const existingIds = new Set(
                        prev.map((n) => n.notification_id),
                    );
                    const toAdd = newNotifs.filter(
                        (n) => !existingIds.has(n.notification_id),
                    );
                    return [...toAdd, ...prev];
                });

                lastSeenIdRef.current = Math.max(
                    lastSeenIdRef.current,
                    response.data.latest_id,
                );

                // ✅ If a candidate_approval notification arrived, refresh the user
                const hasApproval = newNotifs.some(
                    (n) => n.type === "candidate_approval",
                );
                if (hasApproval) {
                    window.dispatchEvent(new CustomEvent("user:refresh"));
                }
            }

            setUnreadCount(response.data.unread_count);
        } catch (error) {
            console.warn("⚠️ Notification poll failed");
        }
    }, [user, isAuthenticated]);

    useEffect(() => {
        if (!user || !isAuthenticated) return;

        isMountedRef.current = true;

        const tick = async () => {
            if (!isMountedRef.current) return;
            await pollForNew();
            const interval = document.hidden
                ? POLL_INTERVAL_HIDDEN_MS
                : POLL_INTERVAL_MS;
            pollTimerRef.current = setTimeout(tick, interval);
        };

        pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);

        return () => {
            isMountedRef.current = false;
            if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, [user, isAuthenticated, pollForNew]);

    useEffect(() => {
        if (user && isAuthenticated) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
            lastSeenIdRef.current = 0;
            setLoading(false);
        }
    }, [user, isAuthenticated, fetchNotifications]);

    const markAsRead = useCallback(async (id: number) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) =>
                    n.notification_id === id ? { ...n, is_read: true } : n,
                ),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Failed to mark as read:", error);
            throw error;
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true })),
            );
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to mark all as read:", error);
            throw error;
        }
    }, []);

    const deleteNotification = useCallback(
        async (id: number) => {
            try {
                await notificationAPI.delete(id);

                const deleted = notifications.find(
                    (n) => n.notification_id === id,
                );

                setNotifications((prev) =>
                    prev.filter((n) => n.notification_id !== id),
                );

                if (deleted && !deleted.is_read) {
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                }
            } catch (error) {
                console.error("Failed to delete notification:", error);
                throw error;
            }
        },
        [notifications],
    );

    const addNotification = useCallback((notification: Notification) => {
        setNotifications((prev) => {
            const exists = prev.some(
                (n) => n.notification_id === notification.notification_id,
            );
            if (exists) return prev;
            return [notification, ...prev];
        });
        setUnreadCount((prev) => prev + 1);
        lastSeenIdRef.current = Math.max(
            lastSeenIdRef.current,
            notification.notification_id,
        );
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
        lastSeenIdRef.current = 0;
        setInitialFetchDone(false);
    }, []);

    const value: NotificationContextType = {
        notifications,
        unreadCount,
        loading: loading && !initialFetchDone,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        addNotification,
        clearNotifications,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationProvider;