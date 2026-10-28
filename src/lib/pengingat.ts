import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getMyTeam } from './proyek';
import { supabase } from './supabase';

// Pengingat terjadwal hanya ada di app iPhone/Android, tidak di versi web
export const remindersSupported = Platform.OS !== 'web';

if (remindersSupported) Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const KEY = 'pengingat-aktif';
const MAX = 60; // iOS membatasi 64 notifikasi terjadwal

export async function isEnabled() {
  return (await AsyncStorage.getItem(KEY)) !== 'off';
}

export async function setEnabled(on: boolean) {
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
  await syncReminders();
}

// Jam 09:00 pada tanggal (TTTT-BB-HH), mundur sejumlah hari
function at9(iso: string, daysBefore: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d - daysBefore, 9, 0, 0);
}

type Reminder = { date: Date; title: string; body: string };

// Jadwalkan ulang semua pengingat dari data terbaru
export async function syncReminders(userId?: string) {
  if (!remindersSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await isEnabled())) return;

  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    const req = await Notifications.requestPermissionsAsync();
    if (!req.granted) return;
  }

  const list: Reminder[] = [];
  const team = await getMyTeam();
  if (team) {
    const { data: projects } = await supabase
      .from('projects')
      .select('title, shoot_date, deadline, status')
      .eq('team_id', team.id)
      .neq('status', 'lunas');
    for (const p of projects ?? []) {
      if (p.shoot_date) list.push({ date: at9(p.shoot_date, 1), title: 'Shooting besok', body: p.title });
      if (p.deadline && p.status !== 'selesai') {
        list.push({ date: at9(p.deadline, 1), title: 'Deadline besok', body: p.title });
      }
    }
    if (userId) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('title, due_date')
        .eq('assignee', userId)
        .eq('done', false)
        .not('due_date', 'is', null);
      for (const t of tasks ?? []) {
        list.push({ date: at9(t.due_date, 0), title: 'Tugas jatuh tempo hari ini', body: t.title });
      }
    }
  }

  const { data: debts } = await supabase
    .from('debts')
    .select('person, direction, due_date')
    .eq('paid', false)
    .not('due_date', 'is', null);
  for (const d of debts ?? []) {
    list.push({
      date: at9(d.due_date, 0),
      title: d.direction === 'hutang' ? 'Bayar hutang hari ini' : 'Tagih piutang hari ini',
      body: d.person,
    });
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('number, client, due_date')
    .neq('status', 'lunas')
    .not('due_date', 'is', null);
  for (const i of invoices ?? []) {
    list.push({ date: at9(i.due_date, 0), title: 'Invoice jatuh tempo hari ini', body: `${i.number} · ${i.client}` });
  }

  const now = Date.now();
  const upcoming = list
    .filter((r) => r.date.getTime() > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX);

  for (const r of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
    });
  }
}
