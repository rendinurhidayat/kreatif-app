import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { Button, Card, DateField, ErrorText, Field, Form, MoneyField, Row, Segmented, T } from '../../components/ui';
import { success } from '../../lib/haptic';
import { today } from '../../lib/keuangan';
import { supabase } from '../../lib/supabase';
import { useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function HutangForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useColors();
  const [direction, setDirection] = useState<'hutang' | 'piutang'>('piutang');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [paid, setPaid] = useState(false);
  const [wasPaid, setWasPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setDirection(data.direction);
        setPerson(data.person);
        setAmount(data.amount);
        setDueDate(data.due_date ?? '');
        setNote(data.note ?? '');
        setPaid(data.paid);
        setWasPaid(data.paid);
      });
  }, [id]);

  const valid = amount > 0 && person.trim() !== '';

  async function write(recordTransaction: boolean) {
    setBusy(true);
    const row = { direction, person: person.trim(), amount, due_date: dueDate || null, note: note.trim() || null, paid };
    const res = id ? await supabase.from('debts').update(row).eq('id', id) : await supabase.from('debts').insert(row);
    if (!res.error && recordTransaction) {
      // Pelunasan dicatat ke buku Bisnis
      await supabase.from('transactions').insert({
        book: 'bisnis',
        type: direction === 'piutang' ? 'masuk' : 'keluar',
        amount,
        category: 'Lainnya',
        note: `${direction === 'piutang' ? 'Pelunasan piutang' : 'Bayar hutang'} · ${person.trim()}`,
        date: today(),
      });
    }
    setBusy(false);
    if (res.error) setError(res.error.message);
    else {
      success();
      router.back();
    }
  }

  function save() {
    if (paid && !wasPaid) {
      showAlert('Catat ke keuangan Bisnis?', 'Pelunasan ini bisa sekalian dicatat sebagai transaksi.', [
        { text: 'Tidak', onPress: () => write(false) },
        { text: 'Catat', onPress: () => write(true) },
      ]);
    } else {
      write(false);
    }
  }

  function remove() {
    showAlert('Hapus catatan ini?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('debts').delete().eq('id', id!);
          router.back();
        },
      },
    ]);
  }

  return (
    <Form title={id ? 'Edit catatan' : 'Hutang / piutang'}>
      <Segmented
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'piutang', label: 'Orang berhutang ke saya' },
          { value: 'hutang', label: 'Saya berhutang' },
        ]}
      />
      <MoneyField label="Jumlah" value={amount} onChange={setAmount} big />
      <Field label="Nama orang atau klien" value={person} onChangeText={setPerson} />
      <DateField label="Jatuh tempo" value={dueDate} onChange={setDueDate} optional />
      <Field label="Catatan" placeholder="Opsional" value={note} onChangeText={setNote} />
      {id && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T>Sudah lunas</T>
            <Switch value={paid} onValueChange={setPaid} trackColor={{ true: c.income }} />
          </Row>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Simpan" onPress={save} loading={busy} disabled={!valid} />
      {id && <Button title="Hapus" variant="danger" onPress={remove} />}
    </Form>
  );
}
