import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, router, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../lib/auth';
import { DialogHost } from '../lib/dialog';
import { fonts, useColors, useIsDark } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const c = useColors();
  const dark = useIsDark();
  const [loaded] = useFonts({ PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.border, primary: c.accent },
  };
  // Header padat dengan garis bawah supaya isi tidak tertimpa
  const bar = {
    headerShown: true,
    headerTransparent: false,
    headerLargeTitle: false,
    headerShadowVisible: true,
    headerStyle: { backgroundColor: c.bg },
    headerTintColor: c.accent,
  };
  // Di web tidak ada gestur tutup/kembali bawaan, jadi tambahkan tombolnya
  const backButton = (label: string) =>
    Platform.OS === 'web'
      ? {
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 2 }}
            >
              <Ionicons name="chevron-back" size={22} color={c.accent} />
              <Text style={{ color: c.accent, fontFamily: fonts.text, fontSize: 16 }}>{label}</Text>
            </Pressable>
          ),
        }
      : {};
  const modal = {
    ...bar,
    ...backButton('Tutup'),
    presentation: 'modal' as const,
    headerTitleStyle: { fontFamily: fonts.text, fontWeight: '600' as const },
  };
  // Panel dari bawah untuk input cepat. Di web tampil sebagai halaman biasa dengan tombol tutup.
  const sheet =
    Platform.OS === 'web'
      ? { ...bar, ...backButton('Tutup'), title: '' }
      : {
          presentation: 'formSheet' as const,
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          headerShown: false,
        };
  const push = {
    ...bar,
    ...backButton('Kembali'),
    headerBackTitle: 'Kembali',
    headerTitleStyle: { fontFamily: fonts.text, fontWeight: '600' as const },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <AuthProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, headerShadowVisible: false, animation: 'default' }}>
            <Stack.Screen name="transaksi/form" options={sheet} />
            <Stack.Screen name="hutang/index" options={{ ...push, title: 'Hutang dan piutang' }} />
            <Stack.Screen name="hutang/form" options={sheet} />
            <Stack.Screen name="laporan" options={{ ...push, title: 'Laporan' }} />
            <Stack.Screen name="proyek/form" options={{ ...modal, title: 'Proyek' }} />
            <Stack.Screen name="proyek/impor" options={{ ...modal, title: 'Impor proyek' }} />
            <Stack.Screen name="proyek/[id]" options={{ ...push, title: '' }} />
            <Stack.Screen name="proyek/tugas" options={sheet} />
            <Stack.Screen name="tim" options={{ ...push, title: 'Tim' }} />
            <Stack.Screen name="invoice/form" options={{ ...modal, title: 'Invoice' }} />
            <Stack.Screen name="profil" options={{ ...push, title: 'Profil dan usaha' }} />
          </Stack>
          <DialogHost />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
