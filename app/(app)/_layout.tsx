import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { Copy } from '@/constants/copy';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

/**
 * Authenticated route group. Redirects to login if the user is not signed in.
 * All children of this group receive a guaranteed non-null session via useAuthSession().
 */
export default function AppLayout(): React.JSX.Element | null {
  const { status } = useAuthSession();

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Redirect href="/(public)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0F0F0F', borderTopColor: '#2A2A2A' },
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: '#525252',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: Copy.tabs.home,
          tabBarIcon: ({ size }: { size: number }) => <Text style={{ fontSize: size }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: Copy.tabs.chat,
          tabBarIcon: ({ size }: { size: number }) => <Text style={{ fontSize: size }}>💬</Text>,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: Copy.tabs.collection,
          tabBarIcon: ({ size }: { size: number }) => <Text style={{ fontSize: size }}>🎲</Text>,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: Copy.tabs.account,
          tabBarIcon: ({ size }: { size: number }) => <Text style={{ fontSize: size }}>👤</Text>,
        }}
      />
      <Tabs.Screen name="stats" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="plays" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="game" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="intent" options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
