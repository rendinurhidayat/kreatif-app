import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Button, Chips, DateField, ErrorText, Field, Form, T, type IconName } from '../../components/ui';
import { success, tap } from '../../lib/haptic';
import { kinds, statuses, type Kind, type Status } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { radius, space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function ProyekForm() {
  const params = useLocalSearchParams<{ id?: string; team?: string }>();
  const editing = !!params.id;
  const [teamId, setTeamId] = useState(params.team ?? '');
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [kind, setKind] = useState<Kind>('video');
  const [status, setStatus] = useState<Status>('brief');
  const [shootDate, setShootDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [links, setLinks] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = useColors();

  useEffect(() => {
    if (!params.id) return;
    supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single()
      .then(({ data: p }) => {
        if (!p) return;
        setTeamId(p.team_id);
        setTitle(p.title);
        setClient(p.client ?? '');
        setKind(p.kind);
        setStatus(p.status);
        setShootDate(p.shoot_date ?? '');
        setDeadline(p.deadline ?? '');
        setLinks(p.links ?? '');
        setNotes(p.notes ?? '');
      });
  }, [params.id]);

  async function save() {
    setBusy(true);
    const row = {
      team_id: teamId,
      title: title.trim(),
      client: client.trim() || null,
      kind,
      status,
      shoot_date: shootDate || null,
      deadline: deadline || null,
      links: links.trim() || null,
      notes: notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from('projects').update(row).eq('id', params.id!);
      setBusy(false);
      if (error) return setError(error.message);
      success();
      router.back();
    } else {
      const { data, error } = await supabase.from('projects').insert(row).select('id').single();
      setBusy(false);
      if (error) return setError(error.message);
      success();
      router.replace(`/proyek/${data.id}`);
    }
  }

  function remove() {
    showAlert('Hapus proyek?', 'Semua tugas di proyek ini ikut terhapus.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('projects').delete().eq('id', params.id!);
          router.dismissAll();
        },
      },
    ]);
  }

  const kindIcon: Record<Kind, IconName> = {
    video: 'videocam-outline',
    foto: 'camera-outline',
    editing: 'cut-outline',
    lainnya: 'ellipsis-horizontal',
  };

  return (
    <Form>
      <View style={{ gap: space.md }}>
        <Field label="Nama proyek" placeholder="Misal: Prewedding Andi dan Sari" value={title} onChangeText={setTitle} />
        <Field label="Klien" placeholder="Opsional" value={client} onChangeText={setClient} />
      </View>

      <T variant="label">Jenis</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {kinds.map((k) => {
          const active = k.value === kind;
          return (
            <Pressable
              key={k.value}
              onPress={() => {
                tap();
                setKind(k.value);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 6,
                paddingVertical: 14,
                borderRadius: radius.md,
                backgroundColor: active ? c.primary : c.surface,
              }}
            >
              <Ionicons name={kindIcon[k.value]} size={22} color={active ? c.onPrimary : c.muted} />
              <T variant="small" color={active ? c.onPrimary : c.text} numberOfLines={1}>
                {k.label}
              </T>
            </Pressable>
          );
        })}
      </View>

      <T variant="label">Tahapan</T>
      <Chips options={statuses} value={status} onChange={setStatus} />

      <View style={{ gap: space.md }}>
        <DateField label="Tanggal shooting" value={shootDate} onChange={setShootDate} optional />
        <DateField label="Deadline" value={deadline} onChange={setDeadline} optional />
      </View>

      <View style={{ gap: space.md }}>
        <Field
          label="Link file (satu per baris)"
          placeholder="Google Drive, Frame.io, WeTransfer"
          autoCapitalize="none"
          multiline
          value={links}
          onChangeText={setLinks}
        />
        <Field label="Catatan" placeholder="Brief, lokasi, kebutuhan alat" multiline value={notes} onChangeText={setNotes} />
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title={editing ? 'Simpan perubahan' : 'Buat proyek'} onPress={save} loading={busy} disabled={title.trim() === ''} />
      {editing && <Button title="Hapus proyek" variant="danger" onPress={remove} />}
    </Form>
  );
}
