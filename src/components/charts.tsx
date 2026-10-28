import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { tap } from '../lib/haptic';
import { rupiah } from '../lib/keuangan';
import { fonts, space, useColors } from '../lib/theme';
import { Num, Row, T } from './ui';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// 1250000 -> "1,3jt", 850000 -> "850rb"
export function compact(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const fmt = (x: number) => (x >= 10 ? Math.round(x).toString() : x.toFixed(1).replace('.0', '').replace('.', ','));
  if (a >= 1e9) return `${sign}${fmt(a / 1e9)}M`;
  if (a >= 1e6) return `${sign}${fmt(a / 1e6)}jt`;
  if (a >= 1e3) return `${sign}${fmt(a / 1e3)}rb`;
  return `${sign}${Math.round(a)}`;
}

// Skala sumbu Y yang rapi (0, 2jt, 4jt, ...)
function niceTicks(min: number, max: number, count = 4) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

export type Series = { name: string; color: string; values: number[]; dashed?: boolean };

function Legend({ series }: { series: Series[] }) {
  return (
    <Row style={{ gap: space.md }}>
      {series.map((s) => (
        <Row key={s.name} style={{ gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
          <T variant="small">{s.name}</T>
        </Row>
      ))}
    </Row>
  );
}

function Tooltip({ title, series, index }: { title: string; series: Series[]; index: number }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.tabBar, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
      <T variant="small" color="#B9BDC9">
        {title}
      </T>
      {series.map((s) => (
        <Row key={s.name} style={{ gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
          <Num size={13} color="#FFFFFF">
            {rupiah(s.values[index] ?? 0)}
          </Num>
        </Row>
      ))}
    </View>
  );
}

const PAD_LEFT = 44;
const PAD_BOTTOM = 26;

function Bar({ x, w, h, base, color, delay, faded }: { x: number; w: number; h: number; base: number; color: string; delay: number; faded: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [h, delay, p]);
  const props = useAnimatedProps(() => ({ y: base - h * p.value, height: Math.max(0, h * p.value) }));
  return <AnimatedRect x={x} width={w} rx={Math.min(4, w / 2)} fill={color} opacity={faded ? 0.3 : 1} animatedProps={props} />;
}

// Grafik batang berkelompok, ketuk bulan untuk melihat angkanya
export function BarChart({ labels, series, height = 200 }: { labels: string[]; series: Series[]; height?: number }) {
  const c = useColors();
  const { width, onLayout } = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1];
  const plotH = height - PAD_BOTTOM - 8;
  const plotW = Math.max(0, width - PAD_LEFT);
  const groupW = labels.length ? plotW / labels.length : 0;
  const barW = Math.min(14, (groupW * 0.62) / series.length);
  const y = (v: number) => 8 + plotH - (v / top) * plotH;

  return (
    <View style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Legend series={series} />
      </Row>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <G key={t}>
                <Line x1={PAD_LEFT} x2={width} y1={y(t)} y2={y(t)} stroke={c.border} strokeWidth={1} />
                <SvgText x={0} y={y(t) + 4} fontSize={10.5} fill={c.muted} fontFamily={fonts.num}>
                  {compact(t)}
                </SvgText>
              </G>
            ))}
            {labels.map((l, i) => {
              const gx = PAD_LEFT + i * groupW + (groupW - barW * series.length - 3 * (series.length - 1)) / 2;
              return (
                <G key={l + i}>
                  {series.map((s, k) => (
                    <Bar
                      key={s.name}
                      x={gx + k * (barW + 3)}
                      w={barW}
                      h={y(0) - y(s.values[i] ?? 0)}
                      base={y(0)}
                      color={s.color}
                      delay={i * 50}
                      faded={sel !== null && sel !== i}
                    />
                  ))}
                  <SvgText
                    x={PAD_LEFT + i * groupW + groupW / 2}
                    y={height - 6}
                    fontSize={11}
                    fill={sel === i ? c.text : c.muted}
                    fontWeight={sel === i ? '700' : '400'}
                    textAnchor="middle"
                    fontFamily={fonts.num}
                  >
                    {l}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        )}
        {/* Area ketuk per kelompok batang */}
        <View style={{ position: 'absolute', left: PAD_LEFT, top: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
          {labels.map((l, i) => (
            <Pressable
              key={l + i}
              style={{ flex: 1 }}
              onPress={() => {
                tap();
                setSel(sel === i ? null : i);
              }}
            />
          ))}
        </View>
        {sel !== null && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: Math.min(Math.max(PAD_LEFT, PAD_LEFT + sel * groupW + groupW / 2 - 70), Math.max(PAD_LEFT, width - 140)),
            }}
          >
            <Tooltip title={labels[sel]} series={series} index={sel} />
          </View>
        )}
      </View>
    </View>
  );
}

// Garis halus (kurva) melewati titik-titik
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.18;
    d += ` C${x1 + (x2 - x0) * t},${y1 + (y2 - y0) * t} ${x2 - (x3 - x1) * t},${y2 - (y3 - y1) * t} ${x2},${y2}`;
  }
  return d;
}

function AnimatedLine({ d, color, dashed, length }: { d: string; color: string; dashed?: boolean; length: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [d, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - p.value) }));
  if (dashed) return <Path d={d} stroke={color} strokeWidth={1.6} strokeDasharray="4 4" fill="none" />;
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={2.4}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={`${length} ${length}`}
      animatedProps={props}
    />
  );
}

// Grafik garis dengan area, ketuk untuk melihat nilai per bulan
export function LineChart({ labels, series, height = 200 }: { labels: string[]; series: Series[]; height?: number }) {
  const c = useColors();
  const { width, onLayout } = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(1, ...all));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotH = height - PAD_BOTTOM - 8;
  const plotW = Math.max(0, width - PAD_LEFT - 8);
  const x = (i: number) => PAD_LEFT + (labels.length > 1 ? (i / (labels.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => 8 + plotH - ((v - lo) / (hi - lo)) * plotH;
  const main = series.find((s) => !s.dashed) ?? series[0];

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={main.color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={main.color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={PAD_LEFT} x2={width} y1={y(t)} y2={y(t)} stroke={c.border} strokeWidth={1} />
              <SvgText x={0} y={y(t) + 4} fontSize={10.5} fill={c.muted} fontFamily={fonts.num}>
                {compact(t)}
              </SvgText>
            </G>
          ))}
          {series.map((s) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const d = smoothPath(pts);
            return (
              <G key={s.name}>
                {!s.dashed && pts.length > 1 && (
                  <Path d={`${d} L${pts[pts.length - 1][0]},${y(lo)} L${pts[0][0]},${y(lo)} Z`} fill="url(#area)" />
                )}
                <AnimatedLine d={d} color={s.color} dashed={s.dashed} length={plotW * 2.5 + plotH * 2} />
              </G>
            );
          })}
          {sel !== null && (
            <G>
              <Line x1={x(sel)} x2={x(sel)} y1={8} y2={y(lo)} stroke={c.muted} strokeDasharray="3 3" />
              {series.map((s) => (
                <Circle key={s.name} cx={x(sel)} cy={y(s.values[sel] ?? 0)} r={5} fill={c.bg} stroke={s.color} strokeWidth={2.5} />
              ))}
            </G>
          )}
          {labels.map((l, i) => (
            <SvgText
              key={l + i}
              x={x(i)}
              y={height - 6}
              fontSize={11}
              fill={sel === i ? c.text : c.muted}
              fontWeight={sel === i ? '700' : '400'}
              textAnchor="middle"
              fontFamily={fonts.num}
            >
              {l}
            </SvgText>
          ))}
        </Svg>
      )}
      <View style={{ position: 'absolute', left: PAD_LEFT - plotW / labels.length / 2, top: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
        {labels.map((l, i) => (
          <Pressable
            key={l + i}
            style={{ flex: 1 }}
            onPress={() => {
              tap();
              setSel(sel === i ? null : i);
            }}
          />
        ))}
      </View>
      {sel !== null && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: Math.min(Math.max(PAD_LEFT, x(sel) - 70), Math.max(PAD_LEFT, width - 140)) }}
        >
          <Tooltip title={labels[sel]} series={series} index={sel} />
        </View>
      )}
    </View>
  );
}

function Arc({ r, stroke, len, offset, color, active, delay }: { r: number; stroke: number; len: number; offset: number; color: string; active: boolean; delay: number }) {
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [len, delay, p]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [Math.max(0, len * p.value - 3), circ] }));
  return (
    <AnimatedCircle
      r={r}
      cx={0}
      cy={0}
      fill="none"
      stroke={color}
      strokeWidth={active ? stroke + 4 : stroke}
      strokeLinecap="round"
      strokeDashoffset={-offset}
      animatedProps={props}
    />
  );
}

// Donut pengeluaran dengan keterangan, ketuk kategori untuk menyorot
export function DonutChart({
  data,
  centerLabel,
  size = 150,
}: {
  data: { label: string; value: number; color: string }[];
  centerLabel: string;
  size?: number;
}) {
  const c = useColors();
  const [sel, setSel] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const stroke = 14;
  const r = size / 2 - stroke / 2 - 4;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const shown = sel === null ? total : data[sel].value;

  return (
    <Row style={{ gap: space.lg, alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <G x={size / 2} y={size / 2} rotation={-90}>
            <Circle r={r} fill="none" stroke={c.border} strokeWidth={stroke} />
            {total > 0 &&
              data.map((d, i) => {
                const len = (d.value / total) * circ;
                const offset = acc;
                acc += len;
                return (
                  <Arc
                    key={d.label}
                    r={r}
                    stroke={stroke}
                    len={len}
                    offset={offset}
                    color={d.color}
                    active={sel === i}
                    delay={i * 80}
                  />
                );
              })}
          </G>
        </Svg>
        <Num size={17} weight="bold">
          {compact(shown)}
        </Num>
        <T variant="small" numberOfLines={1} style={{ maxWidth: size - 40, textAlign: 'center' }}>
          {sel === null ? centerLabel : data[sel].label}
        </T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {data.map((d, i) => (
          <Pressable
            key={d.label}
            onPress={() => {
              tap();
              setSel(sel === i ? null : i);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 7,
              borderBottomWidth: i < data.length - 1 ? 1 : 0,
              borderBottomColor: c.border,
              opacity: sel === null || sel === i ? 1 : 0.4,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: d.color }} />
            <T variant="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>
              {d.label}
            </T>
            <Num size={12.5}>{compact(d.value)}</Num>
          </Pressable>
        ))}
      </View>
    </Row>
  );
}
