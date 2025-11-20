import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as Notifications from 'expo-notifications';
import "../global.css";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Decide how notification should be presented when app is in foreground
    console.log('Handling notification:', notification);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowList: true,
      shouldShowBanner: true,
    };
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, segments, isLoading]);

  useEffect(() => {
    // Request permissions
    Notifications.requestPermissionsAsync();

    // Listener for when notification is received (foreground)
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      alert(`Got notification: ${notification.request.content.title}`);
    });

    // Listener for when user interacts with notification (tap, etc)
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // ඔබට මෙහිදී navigation, data handling වගේ වැඩ කරන්න පුළුවන්
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
