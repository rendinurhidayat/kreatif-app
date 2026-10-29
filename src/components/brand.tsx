import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Warna tetap untuk layar merek (login, loading), selalu gelap
export const brand = {
  bg: '#0B0C10',
  sheet: '#13141C',
  field: '#1A1C26',
  border: '#2A2D3A',
  text: '#F4F5FA',
  muted: '#8E92A6',
  indigo: '#4F46E5',
  violet: '#7C5CFF',
  pink: '#C084FC',
  heroTop: '#3B2FC9',
  heroBottom: '#17123F',
};

const mark = require('../../assets/splash-icon.png');

export function Logo({ size = 40 }: { size?: number }) {
  return <Image source={mark} style={{ width: size, height: size }} resizeMode="contain" />;
}

export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }}>
      <View
        style={{
          width: size * 1.1,
          height: size * 1.1,
          borderRadius: size * 0.32,
          backgroundColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Logo size={size * 0.9} />
      </View>
      <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: size, letterSpacing: -1 }}>
        Jobsly
      </Text>
    </View>
  );
}

// Layar loading bermerek: sama dengan splash bawaan supaya perpindahannya mulus
export function BrandSplash() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.86, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 0.6 + pulse.value * 0.4 }));
  return (
    <View style={{ flex: 1, backgroundColor: brand.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={style}>
        <Logo size={140} />
      </Animated.View>
    </View>
  );
}
