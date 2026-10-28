import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BarChart, DonutChart, LineChart } from '../../components/charts';
import { Avatar, Card, Empty, ErrorText, ListItem, Pill, Row, SafeTop, Section, Segmented, StatCard, T, useScrolled } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { loadDashboard, type Dashboard } from '../../lib/dashboard';
import { formatDay, monthShort, rupiah } from '../../lib/keuangan';
import { palette, space, useColors } from '../../lib/theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi,';
  if (h < 15) return 'Selamat siang,';
  if (h < 19) return 'Selamat sore,';
  return 'Selamat malam,';
}

export default function Beranda() {
  const c = useColors();
  const { scrolled, ...scrollProps } = useScrolled();
  const { session } = useAuth();
  const name = session?.user.user_metadata?.full_name || session?.user.email?.split('@')[0] || '';
  const [data, setData] = useState<Dashboard | null>(null);
  const [flow, setFlow] = useState<'masuk' | 'keluar'>('masuk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadDashboard());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const labels = data?.perMonth.map((m) => monthShort(m.month).split(' ')[0]) ?? [];
  const colors = palette(c);
  const block = (i: number) => FadeInDown.delay(i * 70).duration(400);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <SafeTop line={scrolled} />
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      {...scrollProps}
      contentContainerStyle={{ paddingTop: space.md, paddingHorizontal: space.lg, paddingBottom: 40, gap: space.md }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.muted} />}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <T variant="display" style={{ fontWeight: '700' }}>
            {greeting()}
          </T>
          <T variant="display" numberOfLines={1}>
            {name.split(' ')[0]} 👋
          </T>
        </View>
        <Row>
          <Pressable
            onPress={() => router.push('/asisten')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: c.pastelIndigo,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="sparkles" size={20} color={c.indigo} />
          </Pressable>
          <Avatar name={name} onPress={() => router.push('/akun')} />
        </Row>
      </Row>

      <ErrorText>{error}</ErrorText>

      <Animated.View entering={block(0)} style={{ gap: space.md }}>
        <StatCard
          value={data?.income ?? 0}
          label="Pemasukan bisnis bulan ini"
          icon="trending-up"
          tone={c.pastelBlue}
          iconColor={c.accent}
          onPress={() => router.push('/keuangan')}
        />
        <StatCard
          value={data?.profit ?? 0}
          label="Laba bulan ini"
          icon="pie-chart-outline"
          tone={c.pastelIndigo}
          iconColor={c.indigo}
          onPress={() => router.push('/laporan')}
        />
        <Row style={{ gap: space.md }}>
          <StatCard
            compact
            value={data?.unpaid ?? 0}
            label={`Invoice belum dibayar (${data?.unpaidCount ?? 0})`}
            icon="document-text-outline"
            tone={c.pastelTeal}
            iconColor={c.teal}
            onPress={() => router.push('/invoice')}
          />
          <StatCard
            compact
            value={String(data?.activeProjects ?? 0)}
            label="Proyek aktif"
            icon="folder-open-outline"
            tone={c.pastelPlum}
            iconColor={c.plum}
            onPress={() => router.push('/proyek')}
          />
        </Row>
      </Animated.View>

      <Animated.View entering={block(1)}>
        <Section title="Pendapatan" />
        <View style={{ marginTop: space.md }}>
          {data && (
            <BarChart
              labels={labels}
              series={[
                { name: 'Masuk', color: c.indigo, values: data.perMonth.map((m) => m.masuk) },
                { name: 'Keluar', color: c.accent, values: data.perMonth.map((m) => m.keluar) },
              ]}
            />
          )}
        </View>
      </Animated.View>

      <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />

      <Animated.View entering={block(2)}>
        <Section
          title="Cashflow"
          action={
            <Segmented
              small
              value={flow}
              onChange={setFlow}
              options={[
                { value: 'masuk', label: 'Masuk' },
                { value: 'keluar', label: 'Keluar' },
              ]}
            />
          }
        />
        <View style={{ marginTop: space.md }}>
          {data && (
            <LineChart
              key={flow}
              labels={labels}
              series={[
                {
                  name: flow === 'masuk' ? 'Masuk' : 'Keluar',
                  color: c.accent,
                  values: data.perMonth.map((m) => (flow === 'masuk' ? m.masuk : m.keluar)),
                },
                {
                  name: flow === 'masuk' ? 'Keluar' : 'Masuk',
                  color: c.indigo,
                  dashed: true,
                  values: data.perMonth.map((m) => (flow === 'masuk' ? m.keluar : m.masuk)),
                },
              ]}
            />
          )}
        </View>
      </Animated.View>

      <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />

      <Animated.View entering={block(3)}>
        <Section title="Pengeluaran" action={<T variant="small">6 bulan</T>} />
        <View style={{ marginTop: space.md }}>
          {data && data.expenses.length > 0 ? (
            <DonutChart
              centerLabel="6 bulan"
              data={data.expenses.map((e, i) => ({ ...e, color: colors[i % colors.length] }))}
            />
          ) : (
            <T variant="small">Belum ada pengeluaran bisnis.</T>
          )}
        </View>
      </Animated.View>

      {data && data.agenda.length > 0 && (
        <Animated.View entering={block(4)} style={{ gap: space.sm }}>
          <Section title="Jadwal terdekat" />
          {data.agenda.map((a) => (
            <Card key={a.project.id + a.label} onPress={() => router.push(`/proyek/${a.project.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="small">{formatDay(a.date)}</T>
                <Pill label={a.label} tone={a.label === 'Deadline' ? 'bad' : 'info'} />
              </Row>
              <T variant="heading" numberOfLines={1}>
                {a.project.title}
              </T>
            </Card>
          ))}
        </Animated.View>
      )}

      <Animated.View entering={block(5)}>
        <Section
          title="Transaksi"
          action={
            <Pressable onPress={() => router.push('/keuangan')} hitSlop={8}>
              <T variant="small" color={c.accent} style={{ fontWeight: '600' }}>
                Lihat semua
              </T>
            </Pressable>
          }
        />
        {data && data.recent.length === 0 && <Empty icon="receipt-outline" text="Belum ada transaksi." />}
        {data?.recent.map((t) => (
          <ListItem
            key={t.id}
            title={t.category}
            subtitle={`${formatDay(t.date)} · ${t.book === 'bisnis' ? 'Bisnis' : 'Pribadi'}`}
            right={`${t.type === 'masuk' ? '+' : '-'}${rupiah(t.amount)}`}
            rightColor={t.type === 'masuk' ? c.income : c.text}
            rightSub={<Pill label={t.type === 'masuk' ? 'Masuk' : 'Keluar'} tone={t.type === 'masuk' ? 'good' : 'neutral'} />}
            icon={t.type === 'masuk' ? 'arrow-down' : 'arrow-up'}
            iconBg={t.type === 'masuk' ? c.incomeSoft : c.surface}
            iconColor={t.type === 'masuk' ? c.income : c.text}
            onPress={() => router.push({ pathname: '/transaksi/form', params: { id: t.id } })}
          />
        ))}
      </Animated.View>
    </ScrollView>
    </View>
  );
}
