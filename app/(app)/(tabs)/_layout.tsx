import { Tabs } from 'expo-router';
import type React from 'react';
import { Text } from 'react-native';

import { Copy } from '@/constants/copy';

/** Bottom tab bar for the authenticated section. */
export default function TabsLayout(): React.JSX.Element {
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
    </Tabs>
  );
}
