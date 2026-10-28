import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, FlatList, Platform, RefreshControl, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Empty,
  ErrorText,
  Fab,
  FadeIn,
  Field,
  IconButton,
  Num,
  Page,
  Pill,
  Row,
  Segmented,
  T,
} from '../../components/ui';
import { success } from '../../lib/haptic';
import { formatDate, formatDay, today } from '../../lib/keuangan';
import { getMyTeam, kindLabel, statuses, statusLabel, type Project, type Status, type Team } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { space, useColors, type Colors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

type Agenda = { key: string; date: string; label: string; project: Project };

function statusColor(c: Colors, s: Status) {
  const map: Record<Status, string> = {
    brief: c.muted,
    praproduksi: c.plum,
    shooting: c.accent,
    editing: c.indigo,
    revisi: c.warning,
    selesai: c.teal,
    lunas: c.income,
  };
  return map[s];
}

const COLUMN = 288;

export default function Proyek() {
  const c = useColors();
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<'papan' | 'jadwal'>('papan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getMyTeam();
      setTeam(t);
      if (t) {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('team_id', t.id)
          .order('deadline', { ascending: true, nullsFirst: false });
        if (error) throw error;
        setProjects(data as Project[]);
      }
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

  async function createTeam() {
    const { error } = await supabase.from('teams').insert({ name: teamName.trim() });
    if (error) setError(error.message);
    else load();
  }

  async function move(p: Project, status: Status) {
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, status } : x)));
    success();
    await supabase.from('projects').update({ status }).eq('id', p.id);
  }

  // Tekan lama kartu untuk memindahkan tahapan
  function chooseStatus(p: Project) {
    const options = statuses.filter((s) => s.value !== p.status);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: `Pindahkan "${p.title}"`, options: [...options.map((o) => o.label), 'Batal'], cancelButtonIndex: options.length },
        (i) => i < options.length && move(p, options[i].value),
      );
    } else {
      showAlert(`Pindahkan "${p.title}"`, undefined, [
        ...options.map((o) => ({ text: o.label, onPress: () => move(p, o.value) })),
        { text: 'Batal', style: 'cancel' as const },
      ]);
    }
  }

  if (team === undefined) {
    return (
      <Page title="Proyek">
        {error ? (
          <>
            <ErrorText>{error}</ErrorText>
            <Button title="Coba lagi" variant="secondary" onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={c.accent} style={{ marginTop: 48 }} />
        )}
      </Page>
    );
  }

  if (team === null) {
    return (
      <Page title="Proyek">
        <Card style={{ gap: space.md }} tone={c.pastelBlue}>
          <T variant="heading">Buat tim dulu</T>
          <T variant="muted">Proyek disimpan di dalam tim. Anggota bisa diundang lewat email kapan saja.</T>
          <Field label="Nama tim" placeholder="Misal: Ongstoree Studio" value={teamName} onChangeText={setTeamName} />
          <ErrorText>{error}</ErrorText>
          <Button title="Buat tim" onPress={createTeam} disabled={teamName.trim() === ''} />
        </Card>
      </Page>
    );
  }

  const now = today();
  const agenda: Agenda[] = projects
    .flatMap((p) => [
      p.shoot_date ? { key: `${p.id}-s`, date: p.shoot_date, label: 'Shooting', project: p } : null,
      p.deadline ? { key: `${p.id}-d`, date: p.deadline, label: 'Deadline', project: p } : null,
    ])
    .filter((a): a is Agenda => a !== null && a.date >= now && a.project.status !== 'lunas')
    .sort((a, b) => a.date.localeCompare(b.date));

  const refresh = <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.muted} />;

  const card = (item: Project, i: number) => {
    const late = item.deadline && item.deadline < now && !['selesai', 'lunas'].includes(item.status);
    return (
      <FadeIn key={item.id} index={i}>
        <Card
          style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
          onPress={() => router.push(`/proyek/${item.id}`)}
          onLongPress={() => chooseStatus(item)}
        >
          <T variant="heading" numberOfLines={2} style={{ fontSize: 16 }}>
            {item.title}
          </T>
          <T variant="small" numberOfLines={1}>
            {[item.client, kindLabel(item.kind)].filter(Boolean).join(' · ')}
          </T>
          {(item.shoot_date || item.deadline) && (
            <Row style={{ marginTop: space.sm, flexWrap: 'wrap', gap: 6 }}>
              {item.shoot_date && <Pill label={`Shoot ${formatDate(item.shoot_date)}`} tone="info" />}
              {item.deadline && <Pill label={`DL ${formatDate(item.deadline)}`} tone={late ? 'bad' : 'neutral'} />}
            </Row>
          )}
        </Card>
      </FadeIn>
    );
  };

  return (
    <Page
      title={team.name}
      subtitle="Proyek"
      scroll={false}
      action={
        <Row>
          <IconButton
            name="cloud-upload-outline"
            outline
            onPress={() => router.push({ pathname: '/proyek/impor', params: { team: team.id } })}
          />
          <IconButton name="people-outline" outline onPress={() => router.push('/tim')} />
        </Row>
      }
    >
      <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'papan', label: 'Papan' },
            { value: 'jadwal', label: 'Jadwal' },
          ]}
        />
        <ErrorText>{error}</ErrorText>
        {view === 'papan' && projects.length > 0 && (
          <T variant="small">Geser ke samping untuk tahapan lain. Tekan lama kartu untuk memindahkan.</T>
        )}
      </View>

      {view === 'papan' ? (
        projects.length === 0 && !loading ? (
          <Empty icon="folder-open-outline" text="Belum ada proyek. Tekan + untuk membuat, atau ikon awan untuk impor dari CSV." />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={COLUMN + space.md}
            decelerationRate="fast"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md }}
          >
            {statuses.map((s) => {
              const list = projects.filter((p) => p.status === s.value);
              return (
                <View key={s.value} style={{ width: COLUMN, flex: 1 }}>
                  <Row style={{ marginBottom: space.sm, gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(c, s.value) }} />
                    <T variant="heading" style={{ fontSize: 15 }}>
                      {statusLabel(s.value)}
                    </T>
                    <Num size={13} color={c.muted}>
                      {list.length}
                    </Num>
                  </Row>
                  <ScrollView
                    style={{ flex: 1, backgroundColor: c.surface, borderRadius: 18 }}
                    contentContainerStyle={{ padding: 8, gap: 8, paddingBottom: 96 }}
                    refreshControl={refresh}
                    showsVerticalScrollIndicator={false}
                  >
                    {list.map(card)}
                    {list.length === 0 && (
                      <T variant="small" style={{ textAlign: 'center', paddingVertical: 32 }}>
                        Kosong
                      </T>
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        )
      ) : (
        <FlatList
          data={agenda}
          keyExtractor={(a) => a.key}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120, gap: space.sm }}
          refreshControl={refresh}
          ListEmptyComponent={loading ? undefined : <Empty icon="calendar-outline" text="Tidak ada jadwal ke depan." />}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <Card onPress={() => router.push(`/proyek/${item.project.id}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="small">{formatDay(item.date)}</T>
                  <Pill label={item.label} tone={item.label === 'Deadline' ? 'bad' : 'info'} />
                </Row>
                <T variant="heading" numberOfLines={1}>
                  {item.project.title}
                </T>
                <T variant="small">{statusLabel(item.project.status)}</T>
              </Card>
            </FadeIn>
          )}
        />
      )}
      <Fab onPress={() => router.push({ pathname: '/proyek/form', params: { team: team.id } })} />
    </Page>
  );
}
