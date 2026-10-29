import { supabase } from './supabase';

export type Status = 'brief' | 'praproduksi' | 'shooting' | 'editing' | 'revisi' | 'selesai' | 'lunas';
export type Kind = 'video' | 'foto' | 'editing' | 'lainnya';

export const statuses: { value: Status; label: string }[] = [
  { value: 'brief', label: 'Brief' },
  { value: 'praproduksi', label: 'Pra-produksi' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'editing', label: 'Editing' },
  { value: 'revisi', label: 'Revisi' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'lunas', label: 'Lunas' },
];

export const kinds: { value: Kind; label: string }[] = [
  { value: 'video', label: 'Video' },
  { value: 'foto', label: 'Foto' },
  { value: 'editing', label: 'Editing' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const statusLabel = (s: Status) => statuses.find((x) => x.value === s)?.label ?? s;
export const kindLabel = (k: Kind) => kinds.find((x) => x.value === k)?.label ?? k;

export type Team = { id: string; name: string; owner_id: string };

export type Project = {
  id: string;
  team_id: string;
  title: string;
  client: string | null;
  kind: Kind;
  status: Status;
  shoot_date: string | null;
  deadline: string | null;
  links: string | null;
  notes: string | null;
  client_phone: string | null;
  location: string | null;
  maps_url: string | null;
  shoot_time: string | null;
  shoot_end: string | null;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  assignee: string | null;
  due_date: string | null;
  done: boolean;
};

export type Member = { user_id: string; full_name: string | null; avatar_url: string | null };

// Untuk sekarang satu pengguna memakai satu tim (tim pertama yang diikuti)
export async function getMyTeam(): Promise<Team | null> {
  const { data, error } = await supabase.from('teams').select('*').order('created_at').limit(1);
  if (error) throw error;
  return (data?.[0] as Team) ?? null;
}

export async function loadMembers(teamId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id, profiles(full_name, avatar_url)')
    .eq('team_id', teamId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { user_id: m.user_id, full_name: p?.full_name ?? null, avatar_url: p?.avatar_url ?? null };
  });
}
