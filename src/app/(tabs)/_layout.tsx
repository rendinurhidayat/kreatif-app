import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { ActivityIndicator, View, type ColorValue } from 'react-native';

import type { IconName } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { tap } from '../../lib/haptic';
import { syncReminders } from '../../lib/pengingat';
import { fonts, useColors } from '../../lib/theme';

const icon =
  (name: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? (name.replace('-outline', '') as IconName) : name} size={23} color={color as string} />
  );

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const c = useColors();
  const userId = session?.user.id;

  // Pengingat dijadwalkan ulang setiap app dibuka
  useEffect(() => {
    if (userId) syncReminders(userId).catch(() => {});
  }, [userId]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenListeners={{ tabPress: () => tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopWidth: 0 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', fontFamily: fonts.text },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: icon('pie-chart-outline') }} />
      <Tabs.Screen name="proyek" options={{ title: 'Proyek', tabBarIcon: icon('folder-outline') }} />
      <Tabs.Screen name="keuangan" options={{ title: 'Keuangan', tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="invoice" options={{ title: 'Invoice', tabBarIcon: icon('document-text-outline') }} />
      <Tabs.Screen name="akun" options={{ title: 'Akun', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
