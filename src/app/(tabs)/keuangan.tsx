import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';

import {
  Card,
  Empty,
  ErrorText,
  Fab,
  FadeIn,
  IconButton,
  ListItem,
  Money,
  Page,
  Row,
  Segmented,
  SwipeRow,
  T,
} from '../../components/ui';
import { warn } from '../../lib/haptic';
import {
  books,
  byDay,
  formatDay,
  loadMonth,
  monthName,
  rupiah,
  shiftMonth,
  today,
  type Book,
  type Transaction,
} from '../../lib/keuangan';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function Keuangan() {
  const c = useColors();
  const [book, setBook] = useState<Book>('bisnis');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [items, setItems] = useState<Transaction[]>([]);
  const [sum, setSum] = useState({ saldo: 0, masuk: 0, keluar: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { transactions, ...s } = await loadMonth(book, month);
      setItems(transactions);
      setSum(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [book, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function remove(t: Transaction) {
    warn();
    showAlert('Hapus transaksi?', `${t.category} ${rupiah(t.amount)}`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setItems(items.filter((x) => x.id !== t.id));
          await supabase.from('transactions').delete().eq('id', t.id);
          load();
        },
      },
    ]);
  }

  const isThisMonth = month === today().slice(0, 7);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <Segmented value={book} onChange={setBook} options={books} />

      <Card tone={book === 'bisnis' ? c.pastelBlue : c.pastelIndigo} style={{ padding: 18 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small" color={c.text} style={{ opacity: 0.7 }}>
            Saldo {book}
          </T>
          <Row style={{ gap: 4 }}>
            <IconButton name="chevron-back" onPress={() => setMonth(shiftMonth(month, -1))} />
            <IconButton name="chevron-forward" onPress={() => !isThisMonth && setMonth(shiftMonth(month, 1))} />
          </Row>
        </Row>
        <Money value={sum.saldo} size={32} color={sum.saldo < 0 ? c.expense : c.text} />
        <T variant="small" color={c.text} style={{ opacity: 0.7, marginBottom: space.sm }}>
          s.d. akhir {monthName(month)}
        </T>
        <Row style={{ gap: space.md }}>
          <View style={{ flex: 1, backgroundColor: c.bg, borderRadius: 12, padding: 12 }}>
            <T variant="small">Masuk</T>
            <Money value={sum.masuk} size={16} color={c.income} />
          </View>
          <View style={{ flex: 1, backgroundColor: c.bg, borderRadius: 12, padding: 12 }}>
            <T variant="small">Keluar</T>
            <Money value={sum.keluar} size={16} color={c.expense} />
          </View>
        </Row>
      </Card>
      <ErrorText>{error}</ErrorText>
    </View>
  );

  return (
    <Page
      title="Keuangan"
      scroll={false}
      action={
        <Row>
          <IconButton name="swap-vertical-outline" outline onPress={() => router.push('/hutang')} label="Hutang" />
          <IconButton name="bar-chart-outline" outline onPress={() => router.push('/laporan')} />
        </Row>
      }
    >
      <SectionList
        sections={byDay(items)}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.muted} />}
        ListEmptyComponent={loading ? undefined : <Empty icon="receipt-outline" text="Belum ada transaksi bulan ini." />}
        renderSectionHeader={({ section }) => (
          <T variant="label" style={{ marginTop: space.lg }}>
            {formatDay(section.title)}
          </T>
        )}
        renderItem={({ item, index }) => (
          <FadeIn index={index}>
            <SwipeRow right={{ label: 'Hapus', icon: 'trash-outline', color: c.expense, onPress: () => remove(item) }}>
              <ListItem
                icon={item.type === 'masuk' ? 'arrow-down' : 'arrow-up'}
                iconBg={item.type === 'masuk' ? c.incomeSoft : c.surface}
                iconColor={item.type === 'masuk' ? c.income : c.text}
                title={item.category}
                subtitle={[item.projects?.title, item.note].filter(Boolean).join(' · ')}
                right={`${item.type === 'masuk' ? '+' : '-'}${rupiah(item.amount)}`}
                rightColor={item.type === 'masuk' ? c.income : c.text}
                onPress={() => router.push({ pathname: '/transaksi/form', params: { id: item.id } })}
              />
            </SwipeRow>
          </FadeIn>
        )}
      />
      <Fab onPress={() => router.push({ pathname: '/transaksi/form', params: { book } })} />
    </Page>
  );
}
