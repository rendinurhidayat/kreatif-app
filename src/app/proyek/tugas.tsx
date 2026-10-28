import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';


import { Button, Chips, DateField, ErrorText, Field, Form, T } from '../../components/ui';
import { success } from '../../lib/haptic';
import { loadMembers, type Member } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/dialog';

export default function TugasForm() {
  const { id, project, team } = useLocalSearchParams<{ id?: string; project: string; team: string }>();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers(team).then(setMembers).catch(() => {});
    if (!id) return;
    supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setTitle(data.title);
        setAssignee(data.assignee);
        setDue(data.due_date ?? '');
      });
  }, [id, team]);

  async function save() {
    setBusy(true);
    const row = { project_id: project, title: title.trim(), assignee, due_date: due || null };
    const res = id ? await supabase.from('tasks').update(row).eq('id', id) : await supabase.from('tasks').insert(row);
    setBusy(false);
    if (res.error) setError(res.error.message);
    else {
      success();
      router.back();
    }
  }

  function remove() {
    showAlert('Hapus tugas?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('tasks').delete().eq('id', id!);
          router.back();
        },
      },
    ]);
  }

  return (
    <Form title={id ? 'Edit tugas' : 'Tugas baru'}>
      <Field label="Tugas" placeholder="Misal: Color grading" value={title} onChangeText={setTitle} autoFocus={!id} />
      <T variant="label">Dikerjakan oleh</T>
      <Chips
        options={members.map((m) => ({ value: m.user_id, label: m.full_name || 'Anggota' }))}
        value={assignee}
        onChange={(uid) => setAssignee(uid === assignee ? null : uid)}
      />
      <DateField label="Deadline" value={due} onChange={setDue} optional />
      <ErrorText>{error}</ErrorText>
      <Button title="Simpan" onPress={save} loading={busy} disabled={title.trim() === ''} />
      {id && <Button title="Hapus tugas" variant="danger" onPress={remove} />}
    </Form>
  );
}
