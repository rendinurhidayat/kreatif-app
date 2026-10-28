import { useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

const light = {
  bg: '#FFFFFF',
  surface: '#F3F5F9',
  text: '#0F1222',
  muted: '#7A8094',
  border: '#E8EBF2',
  primary: '#0F1222',
  onPrimary: '#FFFFFF',
  accent: '#1E9BE9',
  indigo: '#2E2BB8',
  teal: '#1FB5C9',
  plum: '#8C2F7A',
  pastelBlue: '#DDEFFC',
  pastelIndigo: '#E4E4FB',
  pastelTeal: '#DCF4F6',
  pastelPlum: '#F5E4F0',
  income: '#15A05A',
  incomeSoft: '#DDF5E8',
  expense: '#E5484D',
  expenseSoft: '#FDE4E4',
  warning: '#C27803',
  tabBar: '#111214',
  tabInactive: '#6B6F7A',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#0B0C10',
  surface: '#16181F',
  text: '#F2F3F7',
  muted: '#8A90A2',
  border: '#252833',
  primary: '#F2F3F7',
  onPrimary: '#0B0C10',
  accent: '#38B0F5',
  indigo: '#7C79F0',
  teal: '#3CCFE0',
  plum: '#D46BBE',
  pastelBlue: '#0F2C44',
  pastelIndigo: '#1F1F48',
  pastelTeal: '#0E363B',
  pastelPlum: '#36182F',
  income: '#3DD68C',
  incomeSoft: '#0F2E20',
  expense: '#FF6369',
  expenseSoft: '#3A1517',
  warning: '#F5B544',
  tabBar: '#000000',
  tabInactive: '#6B6F7A',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark() {
  return useColorScheme() === 'dark';
}

type Named<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

// Gaya yang mengikuti mode terang/gelap
export function makeStyles<const T extends Named<T>>(fn: (c: Colors) => T) {
  return () => {
    const c = useColors();
    return useMemo(() => StyleSheet.create(fn(c)), [c]);
  };
}

// Helvetica Neue untuk teks (bawaan iPhone), Plus Jakarta Sans untuk angka
export const fonts = {
  text: Platform.select({ ios: 'Helvetica Neue', web: '"Helvetica Neue", Helvetica, Arial, sans-serif', default: undefined }),
  num: 'PlusJakartaSans_600SemiBold',
  numBold: 'PlusJakartaSans_700Bold',
  numHeavy: 'PlusJakartaSans_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

// Warna kategori untuk grafik dan label
export function palette(c: Colors) {
  return [c.indigo, c.accent, c.teal, c.plum, c.warning, c.income, c.muted];
}
