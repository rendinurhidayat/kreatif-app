import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Button,
  Card,
  Chips,
  DateField,
  ErrorText,
  Field,
  Form,
  IconButton,
  MoneyField,
  Num,
  Row,
  Section,
  T,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { success } from '../../lib/haptic';
import {
  getBusiness,
  invoiceStatuses,
  markPaid,
  nextNumber,
  openPrintWindow,
  shareInvoicePdf,
  totals,
  unmarkPaid,
  type Invoice,
  type InvoiceStatus,
  type Item,
} from '../../lib/invoice';
import { rupiah, today } from '../../lib/keuangan';
import { getMyTeam } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

const emptyItem: Item = { desc: '', qty: 1, price: 0 };

export default function InvoiceForm() {
  const params = useLocalSearchParams<{ id?: string; project?: string }>();
  const { session } = useAuth();
  const c = useColors();
  const senderName = session?.user.user_metadata?.full_name || session?.user.email || '';

  const [id, setId] = useState<string | undefined>(params.id);
  const [number, setNumber] = useState('');
  const [client, setClient] = useState('');
  const [projectId, setProjectId] = useState<string | null>(params.project ?? null);
  const [projects, setProjects] = useState<{ value: string; label: string; client: string | null }[]>([]);
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyTeam()
      .then((team) =>
        team
          ? supabase
              .from('projects')
              .select('id, title, client')
              .eq('team_id', team.id)
              .order('created_at', { ascending: false })
              .limit(30)
          : null,
      )
      .then((res) => {
        const list = (res?.data ?? []).map((p) => ({ value: p.id, label: p.title, client: p.client }));
        setProjects(list);
        // Dari halaman proyek: isi otomatis nama klien dan baris pertama
        if (!params.id && params.project) {
          const p = list.find((x) => x.value === params.project);
          if (p) {
            setClient(p.client ?? '');
            setItems([{ desc: p.label, qty: 1, price: 0 }]);
          }
        }
      })
      .catch(() => {});

    if (params.id) {
      supabase
        .from('invoices')
        .select('*')
        .eq('id', params.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const inv = data as Invoice;
          setNumber(inv.number);
          setClient(inv.client);
          setProjectId(inv.project_id);
          setItems(inv.items.length ? inv.items : [{ ...emptyItem }]);
          setDiscount(inv.discount);
          setPaidAmount(inv.paid_amount);
          setIssueDate(inv.issue_date);
          setDueDate(inv.due_date ?? '');
          setNotes(inv.notes ?? '');
          setTerms(inv.terms ?? '');
          setStatus(inv.status);
          setTransactionId(inv.transaction_id);
        });
    } else {
      nextNumber().then(setNumber);
      getBusiness().then((b) => setTerms(b.terms ?? ''));
    }
  }, [params.id, params.project]);

  const cleanItems = items.filter((i) => i.desc.trim() && i.price > 0).map((i) => ({ ...i, desc: i.desc.trim() }));
  const current: Invoice = {
    id: id ?? '',
    number: number.trim(),
    client: client.trim(),
    project_id: projectId,
    items: cleanItems,
    discount,
    paid_amount: paidAmount,
    issue_date: issueDate,
    due_date: dueDate || null,
    notes: notes.trim() || null,
    terms: terms.trim() || null,
    status,
    transaction_id: transactionId,
  };
  const { subtotal, total, due } = totals(current);
  const valid = current.client !== '' && current.number !== '' && cleanItems.length > 0;
  const locked = status === 'lunas';

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  // Simpan lalu kembalikan id invoice
  async function persist(nextStatus = status): Promise<string | null> {
    const { id: _, transaction_id: __, ...row } = current;
    const res = id
      ? await supabase.from('invoices').update({ ...row, status: nextStatus }).eq('id', id).select('id').single()
      : await supabase.from('invoices').insert({ ...row, status: nextStatus }).select('id').single();
    if (res.error) {
      setError(res.error.message);
      return null;
    }
    setId(res.data.id);
    setStatus(nextStatus);
    return res.data.id;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      if (await persist()) {
        success();
        router.back();
      }
    });

  const share = () => {
    const win = openPrintWindow();
    run('share', async () => {
      const next = status === 'draft' ? 'terkirim' : status;
      const savedId = await persist(next);
      if (!savedId) return win?.close();
      await shareInvoicePdf({ ...current, id: savedId, status: next }, senderName, win);
    });
  };

  const togglePaid = () =>
    run('paid', async () => {
      if (locked) {
        await unmarkPaid(current);
        setStatus('terkirim');
        setTransactionId(null);
        return;
      }
      const savedId = await persist();
      if (!savedId) return;
      await markPaid({ ...current, id: savedId });
      success();
      router.back();
    });

  function confirmPaid() {
    if (locked) {
      showAlert('Batalkan status lunas?', 'Pemasukan yang tercatat otomatis akan dihapus.', [
        { text: 'Tidak', style: 'cancel' },
        { text: 'Batalkan', style: 'destructive', onPress: togglePaid },
      ]);
    } else {
      showAlert('Tandai lunas?', `${rupiah(due)} akan dicatat sebagai pemasukan Bisnis hari ini.`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tandai lunas', onPress: togglePaid },
      ]);
    }
  }

  function remove() {
    showAlert('Hapus invoice?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('invoices').delete().eq('id', id!);
          router.back();
        },
      },
    ]);
  }

  return (
    <Form>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small">{number}</T>
        <T variant="small" color={locked ? c.income : undefined}>
          {invoiceStatuses.find((s) => s.value === status)!.label}
        </T>
      </Row>

      <Field label="Klien" placeholder="Nama klien atau perusahaan" value={client} onChangeText={setClient} />
      {projects.length > 0 && (
        <>
          <T variant="label">Proyek (opsional)</T>
          <Chips
            scroll
            options={projects}
            value={projectId}
            onChange={(pid) => setProjectId(pid === projectId ? null : pid)}
          />
        </>
      )}

      <Section title="Rincian" />
      {items.map((it, i) => (
        <Card key={i} style={{ gap: space.sm }}>
          <Field
            label="Deskripsi"
            placeholder="Misal: Video highlight 3 menit"
            value={it.desc}
            onChangeText={(v) => updateItem(i, { desc: v })}
          />
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ width: 84 }}>
              <Field
                label="Qty"
                keyboardType="number-pad"
                value={String(it.qty || '')}
                onChangeText={(v) => updateItem(i, { qty: Number(v.replace(/\D/g, '')) || 0 })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <MoneyField label="Harga" value={it.price} onChange={(n) => updateItem(i, { price: n })} />
            </View>
            {items.length > 1 && (
              <IconButton name="trash-outline" onPress={() => setItems(items.filter((_, j) => j !== i))} />
            )}
          </Row>
        </Card>
      ))}
      <Pressable onPress={() => setItems([...items, { ...emptyItem }])}>
        <T style={{ fontWeight: '600' }}>+ Tambah baris</T>
      </Pressable>

      <Row>
        <View style={{ flex: 1 }}>
          <MoneyField label="Diskon" value={discount} onChange={setDiscount} />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyField label="Sudah dibayar (DP)" value={paidAmount} onChange={setPaidAmount} />
        </View>
      </Row>

      <Card tone={c.pastelBlue}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small">Subtotal</T>
          <T variant="small">{rupiah(subtotal)}</T>
        </Row>
        {discount > 0 && (
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="small">Diskon</T>
            <T variant="small">-{rupiah(discount)}</T>
          </Row>
        )}
        {paidAmount > 0 && (
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="small">Total {rupiah(total)}, sudah dibayar</T>
            <T variant="small">-{rupiah(paidAmount)}</T>
          </Row>
        )}
        <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
          <T variant="heading">{paidAmount > 0 ? 'Sisa tagihan' : 'Total'}</T>
          <Num size={22} weight="bold">
            {rupiah(due)}
          </Num>
        </Row>
      </Card>

      <DateField label="Tanggal invoice" value={issueDate} onChange={setIssueDate} />
      <DateField label="Jatuh tempo" value={dueDate} onChange={setDueDate} optional />
      <Field label="Catatan" placeholder="Opsional" multiline value={notes} onChangeText={setNotes} />
      <Field
        label="Terms and Conditions"
        multiline
        value={terms}
        onChangeText={setTerms}
        style={{ minHeight: 160, fontSize: 14 }}
      />
      <T variant="small">Teks bawaan bisa diubah di Akun, Profil dan usaha.</T>

      <ErrorText>{error}</ErrorText>
      <Button
        title="Bagikan PDF"
        icon="share-outline"
        onPress={share}
        loading={busy === 'share'}
        disabled={!valid || busy !== null}
      />
      <Button title="Simpan" variant="secondary" onPress={save} loading={busy === 'save'} disabled={!valid || busy !== null} />
      <Button
        title={locked ? 'Batalkan lunas' : 'Tandai lunas'}
        variant="secondary"
        icon={locked ? 'arrow-undo-outline' : 'checkmark-circle-outline'}
        onPress={confirmPaid}
        loading={busy === 'paid'}
        disabled={!valid || busy !== null}
      />
      {id && <Button title="Hapus invoice" variant="danger" onPress={remove} />}
    </Form>
  );
}
