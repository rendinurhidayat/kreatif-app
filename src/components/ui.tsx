import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '../lib/haptic';
import { formatDate, parseRupiah, rupiah, today } from '../lib/keuangan';
import { fonts, makeStyles, radius, space, useColors, useIsDark } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TVariant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label';

export function T({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  adjustsFontSizeToFit,
  minimumFontScale,
}: {
  variant?: TVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}) {
  const s = useStyles();
  return (
    <Text
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      style={[s[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

// Angka (saldo, total, jumlah) memakai Plus Jakarta Sans
export function Num({
  children,
  size = 16,
  weight = 'semibold',
  color,
  style,
  numberOfLines = 1,
}: {
  children: ReactNode;
  size?: number;
  weight?: 'semibold' | 'bold' | 'heavy';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useColors();
  const family = weight === 'heavy' ? fonts.numHeavy : weight === 'bold' ? fonts.numBold : fonts.num;
  return (
    <Text
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={numberOfLines === 1}
      minimumFontScale={0.6}
      style={[
        { fontFamily: family, fontSize: size, color: color ?? c.text, letterSpacing: size > 24 ? -0.6 : -0.2 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Angka yang "berjalan" saat nilainya berubah
export function useCountUp(value: number, duration = 650) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const t0 = Date.now();
    let frame: number;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

export function Money({ value, size = 32, color, signed }: { value: number; size?: number; color?: string; signed?: boolean }) {
  const shown = useCountUp(value);
  return (
    <Num size={size} weight="bold" color={color}>
      {signed && value > 0 ? '+' : ''}
      {rupiah(shown)}
    </Num>
  );
}

// Halaman tab dengan judul besar
// Batas atas tetap (area jam/notch) supaya isi yang digulir tidak menabrak status bar
export function SafeTop({ line }: { line?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        height: insets.top,
        backgroundColor: c.bg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: line ? c.border : 'transparent',
        zIndex: 2,
      }}
    />
  );
}

// Garis batas muncul setelah layar digulir
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > 4;
    if (next !== scrolled) setScrolled(next);
  };
  return { scrolled, onScroll, scrollEventThrottle: 16 };
}

export function Page({
  title,
  subtitle,
  action,
  children,
  scroll = true,
  header,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
}) {
  const s = useStyles();
  const { scrolled, ...scrollProps } = useScrolled();
  const top = (
    <View style={[s.pageHeader, { paddingTop: space.md }]}>
      {header ?? (
        <View style={{ flex: 1 }}>
          {subtitle && <T variant="muted">{subtitle}</T>}
          <T variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {title}
          </T>
        </View>
      )}
      {action}
    </View>
  );
  if (!scroll) {
    return (
      <View style={s.page}>
        <SafeTop />
        {top}
        {children}
      </View>
    );
  }
  return (
    <View style={s.page}>
      <SafeTop line={scrolled} />
      <ScrollView
        style={s.page}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
      >
        {top}
        <View style={s.pageBody}>{children}</View>
      </ScrollView>
    </View>
  );
}

// Isi layar form/detail. title dipakai untuk panel dari bawah (tanpa header bawaan)
export function Form({ children, title }: { children: ReactNode; title?: string }) {
  const s = useStyles();
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={[s.pageBody, { paddingTop: title ? space.xl : space.lg, paddingBottom: 80 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
    >
      {title && <T variant="title">{title}</T>}
      {children}
    </ScrollView>
  );
}

// Kartu dengan efek mengecil halus saat ditekan
export function Card({
  children,
  style,
  onPress,
  onLongPress,
  tone,
  flex,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: string;
  flex?: boolean;
}) {
  const s = useStyles();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const base = [s.card, tone ? { backgroundColor: tone } : null, flex ? { flex: 1 } : null, style];
  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      style={flex ? { flex: 1 } : undefined}
      onPress={onPress}
      onLongPress={
        onLongPress &&
        (() => {
          tap();
          onLongPress();
        })
      }
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 15, stiffness: 300 }))}
    >
      <Animated.View style={[base, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// Kartu ringkasan berwarna pastel seperti dashboard
export function StatCard({
  value,
  label,
  icon,
  tone,
  iconColor,
  onPress,
  compact,
}: {
  value: number | string;
  label: string;
  icon: IconName;
  tone: string;
  iconColor: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  const c = useColors();
  return (
    <Card tone={tone} onPress={onPress} flex={compact} style={{ padding: compact ? 14 : 18 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 4 }}>
          {typeof value === 'number' ? (
            <Money value={value} size={compact ? 18 : 26} />
          ) : (
            <Num size={compact ? 18 : 26} weight="bold">
              {value}
            </Num>
          )}
          <T variant="small" color={c.text} style={{ opacity: 0.75 }}>
            {label}
          </T>
        </View>
        <View
          style={{
            width: compact ? 40 : 52,
            height: compact ? 40 : 52,
            borderRadius: 12,
            backgroundColor: c.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={compact ? 20 : 26} color={iconColor} />
        </View>
      </Row>
    </Card>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const s = useStyles();
  const c = useColors();
  const bg =
    variant === 'primary' ? c.primary : variant === 'accent' ? c.accent : variant === 'danger' ? c.expenseSoft : c.surface;
  const fg =
    variant === 'primary' ? c.onPrimary : variant === 'accent' ? '#FFFFFF' : variant === 'danger' ? c.expense : c.text;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg },
        (disabled || loading) && { opacity: 0.4 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row style={{ justifyContent: 'center' }}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  outline,
}: {
  name: IconName;
  onPress: () => void;
  label?: string;
  outline?: boolean;
}) {
  const s = useStyles();
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [s.iconButton, outline && s.iconOutline, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={name} size={20} color={c.text} />
      {label && <Text style={s.iconLabel}>{label}</Text>}
    </Pressable>
  );
}

export function Avatar({ name, onPress, size = 44 }: { name: string; onPress?: () => void; size?: number }) {
  const c = useColors();
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.indigo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontFamily: fonts.numBold, fontSize: size * 0.38 }}>{initials}</Text>
      </View>
    </Pressable>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  const s = useStyles();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[s.fab, animated]} entering={FadeInDown.springify().damping(14)}>
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        onPressIn={() => (scale.value = withSpring(0.9))}
        onPressOut={() => (scale.value = withSpring(1))}
        style={s.fabInner}
      >
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

// Item daftar muncul berurutan
export function FadeIn({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 35).duration(320)}>{children}</Animated.View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const s = useStyles();
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <T variant="label">{label}</T>
      <TextInput
        style={[
          s.input,
          focus && { borderColor: c.accent },
          props.multiline && { minHeight: 92, textAlignVertical: 'top' },
          style,
        ]}
        placeholderTextColor={c.muted}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...props}
      />
    </View>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  big,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  big?: boolean;
}) {
  return (
    <Field
      label={label}
      placeholder="Rp 0"
      keyboardType="number-pad"
      value={value ? rupiah(value) : ''}
      onChangeText={(t) => onChange(parseRupiah(t))}
      style={{ fontFamily: big ? fonts.numBold : fonts.num, fontSize: big ? 30 : 16, paddingVertical: big ? 18 : 13 }}
    />
  );
}

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Pemilih tanggal bawaan iPhone/Android. value '' berarti kosong.
export function DateField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean;
}) {
  const s = useStyles();
  const c = useColors();
  const dark = useIsDark();
  const [open, setOpen] = useState(false);
  const current = value ? toDate(value) : toDate(today());

  function press() {
    tap();
    if (Platform.OS === 'web') return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (e, d) => e.type === 'set' && d && onChange(toIso(d)),
      });
    } else {
      if (!value) onChange(toIso(current));
      setOpen(!open);
    }
  }

  return (
    <View style={{ gap: space.xs }}>
      <T variant="label">{label}</T>
      <Row>
        <Pressable onPress={press} style={[s.input, { flex: 1 }, open && { borderColor: c.accent }]}>
          <Row>
            <Ionicons name="calendar-outline" size={18} color={value ? c.accent : c.muted} />
            <T color={value ? c.text : c.muted}>{value ? formatDate(value) : 'Pilih tanggal'}</T>
          </Row>
          {/* Di web, input tanggal bawaan browser yang transparan menutupi tombol ini */}
          {Platform.OS === 'web' &&
            createElement('input', {
              type: 'date',
              value,
              onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
              style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, fontSize: 16, cursor: 'pointer' },
            })}
        </Pressable>
        {optional && value !== '' && (
          <IconButton
            name="close"
            onPress={() => {
              onChange('');
              setOpen(false);
            }}
          />
        )}
      </Row>
      {open && Platform.OS === 'ios' && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <DateTimePicker
            value={current}
            mode="date"
            display="inline"
            themeVariant={dark ? 'dark' : 'light'}
            accentColor={c.accent}
            onChange={(_, d) => {
              if (d) onChange(toIso(d));
              setOpen(false);
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  small?: boolean;
}) {
  const s = useStyles();
  return (
    <View style={[s.segmented, small && { alignSelf: 'flex-start' }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[s.segment, small ? { paddingHorizontal: 12, paddingVertical: 6 } : { flex: 1 }, active && s.segmentActive]}
          >
            <Text style={[s.segmentText, small && { fontSize: 12 }, active && s.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<V extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  scroll?: boolean;
}) {
  const s = useStyles();
  const chips = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={o.value}
        onPress={() => {
          tap();
          onChange(o.value);
        }}
        style={[s.chip, active && s.chipActive]}
      >
        <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={s.chips}>{chips}</View>;
}

export function ListItem({
  title,
  subtitle,
  right,
  rightColor,
  rightSub,
  icon,
  iconColor,
  iconBg,
  onPress,
  dim,
}: {
  title: string;
  subtitle?: string | null;
  right?: string;
  rightColor?: string;
  rightSub?: ReactNode;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  onPress?: () => void;
  dim?: boolean;
}) {
  const s = useStyles();
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.listItem, pressed && { opacity: 0.6 }, dim && { opacity: 0.45 }]}
    >
      {icon && (
        <View style={[s.listIcon, iconBg ? { backgroundColor: iconBg } : null]}>
          <Ionicons name={icon} size={18} color={iconColor ?? c.text} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={1} style={{ fontWeight: '500' }}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {(right !== undefined || rightSub) && (
        <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 160 }}>
          {right !== undefined && (
            <Num size={15} color={rightColor}>
              {right}
            </Num>
          )}
          {rightSub}
        </View>
      )}
    </Pressable>
  );
}

type SwipeAction = { label: string; icon: IconName; color: string; onPress: () => void };

// Geser item ke kiri/kanan untuk aksi cepat
export function SwipeRow({ children, left, right }: { children: ReactNode; left?: SwipeAction; right?: SwipeAction }) {
  const c = useColors();
  const ref = useRef<SwipeableMethods>(null);
  const render = (a: SwipeAction, side: 'left' | 'right') => () => (
    <Pressable
      onPress={() => {
        tap();
        ref.current?.close();
        a.onPress();
      }}
      style={{
        backgroundColor: a.color,
        width: 88,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: radius.md,
        marginLeft: side === 'right' ? space.sm : 0,
        marginRight: side === 'left' ? space.sm : 0,
        marginVertical: 4,
      }}
    >
      <Ionicons name={a.icon} size={20} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600', fontFamily: fonts.text }}>{a.label}</Text>
    </Pressable>
  );
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      overshootFriction={8}
      onSwipeableWillOpen={() => tap()}
      renderLeftActions={left ? render(left, 'left') : undefined}
      renderRightActions={right ? render(right, 'right') : undefined}
    >
      <View style={{ backgroundColor: c.bg }}>{children}</View>
    </ReanimatedSwipeable>
  );
}

export function Section({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ marginTop: space.lg, justifyContent: 'space-between' }}>
      <T variant="heading">{title}</T>
      {action}
    </Row>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  const c = useColors();
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', paddingVertical: 48, gap: space.md }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={28} color={c.muted} />
      </View>
      <T variant="muted" style={{ textAlign: 'center' }}>
        {text}
      </T>
    </Animated.View>
  );
}

// Label status kecil berwarna, seperti "Completed" pada contoh
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'bad' | 'info' | 'warn' }) {
  const c = useColors();
  const map = {
    neutral: [c.surface, c.muted],
    good: [c.incomeSoft, c.income],
    bad: [c.expenseSoft, c.expense],
    info: [c.pastelBlue, c.accent],
    warn: [c.pastelPlum, c.plum],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={{ color: fg, fontSize: 11, fontWeight: '600', fontFamily: fonts.text }}>{label}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  return children ? <T color={c.expense}>{children}</T> : null;
}

const useStyles = makeStyles((c) => ({
  display: { fontFamily: fonts.text, fontSize: 30, fontWeight: '700', color: c.text, letterSpacing: -0.6 },
  title: { fontFamily: fonts.text, fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.text, fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.2 },
  body: { fontFamily: fonts.text, fontSize: 16, color: c.text },
  muted: { fontFamily: fonts.text, fontSize: 15, color: c.muted },
  small: { fontFamily: fonts.text, fontSize: 13, color: c.muted },
  label: { fontFamily: fonts.text, fontSize: 13, color: c.muted, fontWeight: '500' },
  page: { flex: 1, backgroundColor: c.bg },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  pageBody: { paddingHorizontal: space.lg, gap: space.md },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  button: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.text, fontSize: 16, fontWeight: '600' },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 11,
    height: 40,
    minWidth: 40,
    justifyContent: 'center',
  },
  iconOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
  iconLabel: { fontFamily: fonts.text, color: c.text, fontSize: 14, fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
    shadowColor: c.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderRadius: 30,
    backgroundColor: c.accent,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.text,
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: c.text,
  },
  segmented: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.sm, padding: 3 },
  segment: { paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentActive: {
    backgroundColor: c.bg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontFamily: fonts.text, color: c.muted, fontWeight: '500', fontSize: 14 },
  segmentTextActive: { color: c.text, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: c.primary },
  chipText: { fontFamily: fonts.text, color: c.text, fontSize: 14 },
  chipTextActive: { color: c.onPrimary, fontWeight: '600' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
