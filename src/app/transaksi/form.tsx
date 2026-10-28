import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';


import { Button, Chips, DateField, ErrorText, Field, Form, MoneyField, Segmented, T } from '../../components/ui';
import { success } from '../../lib/haptic';
import { books, categories, TRANSFER, today, type Book, type TxType } from '../../lib/keuangan';
import { getMyTeam } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/dialog';

type Mode = TxType | 'pindah';

export default function TransaksiForm() {
  const params = useLocalSearchParams<{ id?: string; book?: Book }>();
  const editing = !!params.id;
  const [book, setBook] = useState<Book>(params.book === 'pribadi' ? 'pribadi' : 'bisnis');
  const [mode, setMode] = useState<Mode>('keluar');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      supabase
        .from('transactions')
        .select('*')
        .eq('id', params.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setBook(data.book);
          setMode(data.type);
          setAmount(data.amount);
          setCategory(data.category);
          setNote(data.note ?? '');
          setDate(data.date);
          setProjectId(data.project_id);
        });
    }
    // Proyek aktif untuk menandai pemasukan bisnis
    getMyTeam()
      .then((team) =>
        team
          ? supabase
              .from('projects')
              .select('id, title')
              .eq('team_id', team.id)
              .order('created_at', { ascending: false })
              .limit(20)
          : null,
      )
      .then((res) => setProjects((res?.data ?? []).map((p) => ({ value: p.id, label: p.title }))))
      .catch(() => setProjects([]));
  }, [params.id]);

  const isTransfer = mode === 'pindah';
  const type: TxType = isTransfer ? 'keluar' : mode;
  const other: Book = book === 'bisnis' ? 'pribadi' : 'bisnis';
  const linkProject = book === 'bisnis' && mode === 'masuk' && projects.length > 0;
  const valid = amount > 0 && (isTransfer || category !== '');

  const options = categories[book][type].includes(category) || !category
    ? categories[book][type]
    : [...categories[book][type], category];

  async function save() {
    setBusy(true);
    setError(null);
    let res;
    if (isTransfer) {
      // Pindah saldo: keluar dari satu buku, masuk ke buku lain
      const label = book === 'bisnis' ? 'Gaji dari bisnis' : TRANSFER;
      res = await supabase.from('transactions').insert([
        { book, type: 'keluar', amount, category: TRANSFER, note: note.trim() || `Ke ${other}`, date },
        { book: other, type: 'masuk', amount, category: label, note: note.trim() || `Dari ${book}`, date },
      ]);
    } else {
      const row = {
        book,
        type,
        amount,
        category,
        note: note.trim() || null,
        date,
        project_id: linkProject ? projectId : null,
      };
      res = editing
        ? await supabase.from('transactions').update(row).eq('id', params.id!)
        : await supabase.from('transactions').insert(row);
    }
    setBusy(false);
    if (res.error) setError(res.error.message);
    else {
      success();
      router.back();
    }
  }

  function remove() {
    showAlert('Hapus transaksi?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('transactions').delete().eq('id', params.id!);
          router.back();
        },
      },
    ]);
  }

  return (
    <Form title={editing ? 'Edit transaksi' : 'Transaksi baru'}>
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setCategory('');
        }}
        options={[
          { value: 'keluar', label: 'Keluar' },
          { value: 'masuk', label: 'Masuk' },
          ...(editing ? [] : [{ value: 'pindah' as const, label: 'Pindah' }]),
        ]}
      />
      <MoneyField label="Jumlah" value={amount} onChange={setAmount} big />

      <T variant="label">{isTransfer ? 'Dari buku' : 'Buku'}</T>
      <Chips
        options={books}
        value={book}
        onChange={(b) => {
          setBook(b);
          setCategory('');
        }}
      />
      {isTransfer ? (
        <T variant="muted">
          Saldo pindah dari {book} ke {other}. Contoh: ambil gaji dari bisnis ke pribadi.
        </T>
      ) : (
        <>
          <T variant="label">Kategori</T>
          <Chips options={options.map((x) => ({ value: x, label: x }))} value={category} onChange={setCategory} />
        </>
      )}

      {linkProject && (
        <>
          <T variant="label">Dari proyek (opsional)</T>
          <Chips
            scroll
            options={projects}
            value={projectId}
            onChange={(id) => setProjectId(id === projectId ? null : id)}
          />
        </>
      )}

      <DateField label="Tanggal" value={date} onChange={setDate} />
      <Field label="Catatan" placeholder="Opsional" value={note} onChangeText={setNote} />
      <ErrorText>{error}</ErrorText>
      <Button title="Simpan" onPress={save} loading={busy} disabled={!valid} />
      {editing && <Button title="Hapus" variant="danger" onPress={remove} />}
    </Form>
  );
}
