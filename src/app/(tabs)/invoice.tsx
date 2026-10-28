import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Card, Chips, Empty, ErrorText, Fab, FadeIn, Num, Page, Pill, Row, StatCard, SwipeRow, T } from '../../components/ui';
import { success, warn } from '../../lib/haptic';
import { invoiceStatuses, markPaid, totals, type Invoice, type InvoiceStatus } from '../../lib/invoice';
import { formatDate, rupiah, today } from '../../lib/keuangan';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function Invoices() {
  const c = useColors();
  const [items, setItems] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'belum'>('belum');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) setError(error.message);
    else {
      setItems(data as Invoice[]);
      setError(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function paid(inv: Invoice) {
    showAlert('Tandai lunas?', `${rupiah(totals(inv).due)} dicatat sebagai pemasukan Bisnis hari ini.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Tandai lunas',
        onPress: async () => {
          try {
            await markPaid(inv);
            success();
            load();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  }

  function remove(inv: Invoice) {
    warn();
    showAlert('Hapus invoice?', inv.number, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setItems(items.filter((x) => x.id !== inv.id));
          await supabase.from('invoices').delete().eq('id', inv.id);
        },
      },
    ]);
  }

  const unpaid = items.filter((i) => i.status !== 'lunas');
  const outstanding = unpaid.reduce((s, i) => s + totals(i).due, 0);
  const now = today();
  const late = unpaid.filter((i) => i.due_date && i.due_date < now);
  const paidThisMonth = items
    .filter((i) => i.status === 'lunas' && i.issue_date.startsWith(now.slice(0, 7)))
    .reduce((s, i) => s + totals(i).total, 0);
  const shown = filter === 'belum' ? unpaid : items.filter((i) => i.status === filter);

  return (
    <Page title="Invoice" scroll={false}>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120, gap: space.sm }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.muted} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <StatCard
              value={outstanding}
              label={`Belum dibayar · ${unpaid.length} invoice${late.length ? `, ${late.length} lewat tempo` : ''}`}
              icon="time-outline"
              tone={c.pastelBlue}
              iconColor={c.accent}
            />
            <StatCard
              value={paidThisMonth}
              label="Lunas, invoice bulan ini"
              icon="checkmark-done-outline"
              tone={c.pastelIndigo}
              iconColor={c.indigo}
            />
            <Chips
              scroll
              options={[{ value: 'belum' as const, label: 'Belum lunas' }, ...invoiceStatuses]}
              value={filter}
              onChange={setFilter}
            />
            <ErrorText>{error}</ErrorText>
          </View>
        }
        ListEmptyComponent={loading ? undefined : <Empty icon="document-text-outline" text="Belum ada invoice." />}
        renderItem={({ item, index }) => {
          const { total, due } = totals(item);
          const isLate = item.status !== 'lunas' && item.due_date !== null && item.due_date < now;
          const tone = item.status === 'lunas' ? 'good' : isLate ? 'bad' : item.status === 'terkirim' ? 'info' : 'neutral';
          return (
            <FadeIn index={index}>
              <SwipeRow
                left={item.status !== 'lunas' ? { label: 'Lunas', icon: 'checkmark', color: c.income, onPress: () => paid(item) } : undefined}
                right={{ label: 'Hapus', icon: 'trash-outline', color: c.expense, onPress: () => remove(item) }}
              >
                <Card
                  style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
                  onPress={() => router.push({ pathname: '/invoice/form', params: { id: item.id } })}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Num size={13} color={c.accent}>
                      #{item.number.replace('INV-', '')}
                    </Num>
                    <Pill
                      label={isLate ? 'Lewat tempo' : invoiceStatuses.find((s) => s.value === item.status)!.label}
                      tone={tone}
                    />
                  </Row>
                  <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
                    <T variant="heading" numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>
                      {item.client}
                    </T>
                    <Num size={16} weight="bold">
                      {rupiah(item.status === 'lunas' ? total : due)}
                    </Num>
                  </Row>
                  <T variant="small" color={isLate ? c.expense : undefined}>
                    {item.status === 'lunas'
                      ? `Diterbitkan ${formatDate(item.issue_date)}`
                      : item.due_date
                        ? `Jatuh tempo ${formatDate(item.due_date)}`
                        : `Diterbitkan ${formatDate(item.issue_date)}`}
                  </T>
                </Card>
              </SwipeRow>
            </FadeIn>
          );
        }}
      />
      <Fab onPress={() => router.push('/invoice/form')} />
    </Page>
  );
}
