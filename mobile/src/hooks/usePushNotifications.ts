import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useNotificationStore } from '../stores/notificationStore';
import api from '../services/api';

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

// Set the default notification behaviour (show banner even when app is in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35', // BER brand accent
    });
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted.');
    return null;
  }

  // Retrieve the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: undefined, // Uses the project ID from app.json / app.config.ts
  });

  return tokenData.data;
}

/**
 * Persist the push token on the backend so the server can send push
 * notifications to this device.
 */
async function savePushTokenToServer(pushToken: string): Promise<void> {
  try {
    await api.put('/users/me/push-token', {
      pushToken,
    });
  } catch {
    // Non-critical – the token will be re-sent next time the hook mounts
    console.warn('Failed to persist push token on server.');
  }
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  const notificationListenerRef =
    useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef =
    useRef<Notifications.EventSubscription | null>(null);

  const incrementUnread = useNotificationStore((s) => s.incrementUnread);

  useEffect(() => {
    // Register and persist push token
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        savePushTokenToServer(token);
      }
    });

    // Listener: notification received while app is in foreground
    notificationListenerRef.current =
      Notifications.addNotificationReceivedListener((incoming) => {
        setNotification(incoming);
        incrementUnread();
      });

    // Listener: user tapped on a notification
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((_response) => {
        // Navigation to a specific screen based on the notification payload
        // can be handled here or via a navigation ref. Intentionally left
        // as a no-op so it can be wired up when the navigation layer is ready.
      });

    return () => {
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(
          notificationListenerRef.current,
        );
      }
      if (responseListenerRef.current) {
        Notifications.removeNotificationSubscription(
          responseListenerRef.current,
        );
      }
    };
  }, [incrementUnread]);

  return { expoPushToken, notification } as const;
}
