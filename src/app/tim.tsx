import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';


import { Avatar, Button, Card, ErrorText, Field, Form, ListItem, Section, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { success } from '../lib/haptic';
import { getMyTeam, loadMembers, type Member, type Team } from '../lib/proyek';
import { supabase } from '../lib/supabase';
import { space } from '../lib/theme';
import { showAlert } from '../lib/dialog';

export default function Tim() {
  const { session } = useAuth();
  const me = session?.user.id;
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = await getMyTeam();
    setTeam(t);
    if (t) {
      setName(t.name);
      setMembers(await loadMembers(t.id));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!team) return <Form>{null}</Form>;
  const isOwner = team.owner_id === me;

  async function rename() {
    const { error } = await supabase.from('teams').update({ name: name.trim() }).eq('id', team!.id);
    if (error) setError(error.message);
    else {
      success();
      setMessage('Nama tim disimpan.');
    }
  }

  async function invite() {
    setError(null);
    setMessage(null);
    const { data, error } = await supabase.rpc('invite_member', { t: team!.id, member_email: email });
    if (error) setError(error.message);
    else if (data !== 'ok') setError(data as string);
    else {
      success();
      setMessage('Anggota ditambahkan.');
      setEmail('');
      load();
    }
  }

  function remove(m: Member) {
    const self = m.user_id === me;
    showAlert(self ? 'Keluar dari tim?' : `Keluarkan ${m.full_name || 'anggota'}?`, undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: self ? 'Keluar' : 'Keluarkan',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('team_members').delete().eq('team_id', team!.id).eq('user_id', m.user_id);
          if (self) router.back();
          else load();
        },
      },
    ]);
  }

  return (
    <Form>
      {isOwner ? (
        <>
          <Field label="Nama tim" value={name} onChangeText={setName} />
          {name.trim() !== team.name && <Button title="Simpan nama" variant="secondary" onPress={rename} />}
        </>
      ) : (
        <T variant="title">{team.name}</T>
      )}
      <T variant="small">Anggota bisa melihat dan mengubah proyek serta tugas. Keuangan dan invoice tetap privat.</T>

      <Section title={`Anggota ${members.length}`} />
      {members.map((m) => {
        const canRemove = m.user_id !== team.owner_id && (isOwner || m.user_id === me);
        return (
          <ListItem
            key={m.user_id}
            leading={<Avatar name={m.full_name || '?'} uri={m.avatar_url} size={36} />}
            title={`${m.full_name || 'Tanpa nama'}${m.user_id === me ? ' (kamu)' : ''}`}
            subtitle={m.user_id === team.owner_id ? 'Pemilik' : 'Anggota'}
            right={canRemove ? (m.user_id === me ? 'Keluar' : 'Keluarkan') : undefined}
            onPress={canRemove ? () => remove(m) : undefined}
          />
        );
      })}

      {isOwner && (
        <Card style={{ gap: space.md, marginTop: space.md }}>
          <T variant="heading">Undang anggota</T>
          <Field
            label="Email (orangnya harus sudah daftar di app)"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {message && <T variant="small">{message}</T>}
          <ErrorText>{error}</ErrorText>
          <Button title="Undang" onPress={invite} disabled={email.trim() === ''} />
        </Card>
      )}
    </Form>
  );
}
