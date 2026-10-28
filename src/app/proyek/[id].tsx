import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Button, Card, Chips, Empty, ErrorText, FadeIn, Form, IconButton, Num, Row, Section, SwipeRow, T } from '../../components/ui';
import { tap, warn } from '../../lib/haptic';
import { formatDate, today } from '../../lib/keuangan';
import { kindLabel, loadMembers, statuses, type Member, type Project, type Status, type Task } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function ProyekDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: p, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error || !p) {
      setError(error?.message ?? 'Proyek tidak ditemukan.');
      return;
    }
    setProject(p as Project);
    const [{ data: t }, m] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', id).order('done').order('due_date', { nullsFirst: false }),
      loadMembers(p.team_id),
    ]);
    setTasks((t as Task[]) ?? []);
    setMembers(m);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!project) {
    return (
      <Form>
        <ErrorText>{error}</ErrorText>
      </Form>
    );
  }

  const memberName = (uid: string | null) => members.find((m) => m.user_id === uid)?.full_name || null;

  async function setStatus(value: Status) {
    setProject({ ...project!, status: value });
    await supabase.from('projects').update({ status: value }).eq('id', id);
  }

  async function toggle(t: Task) {
    tap();
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from('tasks').update({ done: !t.done }).eq('id', t.id);
  }

  function removeTask(t: Task) {
    warn();
    showAlert('Hapus tugas?', t.title, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setTasks(tasks.filter((x) => x.id !== t.id));
          await supabase.from('tasks').delete().eq('id', t.id);
        },
      },
    ]);
  }

  const links = (project.links ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const doneCount = tasks.filter((t) => t.done).length;
  const now = today();

  return (
    <Form>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton name="create-outline" onPress={() => router.push({ pathname: '/proyek/form', params: { id } })} />
          ),
        }}
      />
      <View style={{ gap: 4 }}>
        <T variant="title">{project.title}</T>
        <T variant="muted">{[project.client, kindLabel(project.kind)].filter(Boolean).join(' · ')}</T>
      </View>

      {(project.shoot_date || project.deadline) && (
        <Row>
          {project.shoot_date && (
            <Card style={{ flex: 1 }} tone={c.pastelBlue}>
              <T variant="small">Shooting</T>
              <Num size={16} weight="bold">
                {formatDate(project.shoot_date)}
              </Num>
            </Card>
          )}
          {project.deadline && (
            <Card style={{ flex: 1 }} tone={c.pastelPlum}>
              <T variant="small">Deadline</T>
              <Num size={16} weight="bold" color={project.deadline < now && project.status !== 'lunas' ? c.expense : undefined}>
                {formatDate(project.deadline)}
              </Num>
            </Card>
          )}
        </Row>
      )}

      <Section title="Tahapan" />
      <Chips options={statuses} value={project.status} onChange={setStatus} />

      <Section
        title={`Tugas ${tasks.length ? `${doneCount}/${tasks.length}` : ''}`}
        action={
          <IconButton
            name="add"
            label="Tugas"
            onPress={() => router.push({ pathname: '/proyek/tugas', params: { project: id, team: project.team_id } })}
          />
        }
      />
      {tasks.length === 0 && <Empty icon="checkbox-outline" text="Belum ada tugas." />}
      {tasks.length > 0 && (
        <View style={{ height: 6, backgroundColor: c.surface, borderRadius: 3, overflow: 'hidden' }}>
          <View
            style={{ width: `${(doneCount / tasks.length) * 100}%`, height: '100%', backgroundColor: c.income, borderRadius: 3 }}
          />
        </View>
      )}
      {tasks.map((t, i) => {
        const late = !t.done && t.due_date !== null && t.due_date < now;
        return (
          <FadeIn key={t.id} index={i}>
            <SwipeRow
              left={{
                label: t.done ? 'Buka' : 'Selesai',
                icon: t.done ? 'arrow-undo-outline' : 'checkmark',
                color: c.income,
                onPress: () => toggle(t),
              }}
              right={{ label: 'Hapus', icon: 'trash-outline', color: c.expense, onPress: () => removeTask(t) }}
            >
              <Row style={{ gap: space.md, paddingVertical: 10, backgroundColor: c.bg }}>
                <Pressable onPress={() => toggle(t)} hitSlop={10}>
                  <Ionicons
                    name={t.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={t.done ? c.income : c.muted}
                  />
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({ pathname: '/proyek/tugas', params: { id: t.id, project: id, team: project.team_id } })
                  }
                >
                  <T style={t.done ? { textDecorationLine: 'line-through', color: c.muted } : undefined}>{t.title}</T>
                  {(t.assignee || t.due_date) && (
                    <T variant="small" color={late ? c.expense : undefined}>
                      {[memberName(t.assignee), t.due_date && formatDate(t.due_date)].filter(Boolean).join(' · ')}
                    </T>
                  )}
                </Pressable>
              </Row>
            </SwipeRow>
          </FadeIn>
        );
      })}

      {links.length > 0 && <Section title="File" />}
      {links.map((l) => (
        <Card key={l} onPress={() => Linking.openURL(l.startsWith('http') ? l : `https://${l}`)}>
          <Row>
            <Ionicons name="link-outline" size={18} color={c.text} />
            <T numberOfLines={1} style={{ flex: 1 }}>
              {l.replace(/^https?:\/\//, '')}
            </T>
          </Row>
        </Card>
      ))}

      {project.notes && (
        <>
          <Section title="Catatan" />
          <T>{project.notes}</T>
        </>
      )}

      <View style={{ marginTop: space.lg }}>
        <Button
          title="Buat invoice"
          icon="document-text-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/invoice/form', params: { project: id } })}
        />
      </View>
    </Form>
  );
}
