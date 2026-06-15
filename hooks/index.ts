import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { DayStats, WeekStats, Category, DURATION_MINUTES } from '@/types';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isWithinInterval } from 'date-fns';

export function useWeeklyStats(): WeekStats | null {
  const { entries } = useStore();
  const [stats, setStats] = useState<WeekStats | null>(null);

  useEffect(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const dailyStats: DayStats[] = weekDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const entry = entries.find((e) => e.date === dateStr);

      const categories: Record<Category, number> = {
        development: 0,
        meeting: 0,
        support: 0,
        training: 0,
        documentation: 0,
        research: 0,
        personal: 0,
        other: 0,
      };

      let totalMinutes = 0;

      if (entry) {
        entry.tasks.forEach((task) => {
          const mins = task.duration === 'custom'
            ? (task.customDuration || 0)
            : DURATION_MINUTES[task.duration];
          categories[task.category] += mins;
          totalMinutes += mins;
        });
      }

      return {
        date: dateStr,
        taskCount: entry?.tasks.length || 0,
        totalMinutes,
        validated: entry?.validated || false,
        categories,
      };
    });

    const weekEntries = entries.filter((e) => {
      const entryDate = new Date(e.date);
      return isWithinInterval(entryDate, { start: weekStart, end: weekEnd });
    });

    const categoryBreakdown: Record<Category, number> = {
      development: 0,
      meeting: 0,
      support: 0,
      training: 0,
      documentation: 0,
      research: 0,
      personal: 0,
      other: 0,
    };

    weekEntries.forEach((entry) => {
      entry.tasks.forEach((task) => {
        const mins = task.duration === 'custom'
          ? (task.customDuration || 0)
          : DURATION_MINUTES[task.duration];
        categoryBreakdown[task.category] += mins;
      });
    });

    setStats({
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      totalTasks: dailyStats.reduce((sum, d) => sum + d.taskCount, 0),
      totalMinutes: dailyStats.reduce((sum, d) => sum + d.totalMinutes, 0),
      validatedDays: dailyStats.filter((d) => d.validated).length,
      dailyStats,
      categoryBreakdown,
    });
  }, [entries]);

  return stats;
}

export function useNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || permission !== 'granted') return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from API
      const response = await fetch('/api/notifications');
      const { data: vapidKey } = await response.json();

      if (!vapidKey) {
        console.warn('VAPID public key not configured');
        return null;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      setSubscription(sub);
      return sub;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return null;
    }
  }, [isSupported, permission]);

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
