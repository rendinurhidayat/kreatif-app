import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Empty, Fab, FadeIn, ListItem, Pill, Row, Segmented, StatCard, SwipeRow } from '../../components/ui';
import { success, warn } from '../../lib/haptic';
import { formatDate, rupiah, today, type Debt } from '../../lib/keuangan';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function Hutang() {
  const c = useColors();
  const [items, setItems] = useState<Debt[]>([]);
  const [filter, setFilter] = useState<'aktif' | 'lunas'>('aktif');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('debts')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    setItems((data as Debt[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function togglePaid(d: Debt) {
    success();
    setItems(items.map((x) => (x.id === d.id ? { ...x, paid: !x.paid } : x)));
    await supabase.from('debts').update({ paid: !d.paid }).eq('id', d.id);
  }

  function remove(d: Debt) {
    warn();
    showAlert('Hapus catatan ini?', d.person, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setItems(items.filter((x) => x.id !== d.id));
          await supabase.from('debts').delete().eq('id', d.id);
        },
      },
    ]);
  }

  const open = items.filter((d) => !d.paid);
  const hutang = open.filter((d) => d.direction === 'hutang').reduce((s, d) => s + d.amount, 0);
  const piutang = open.filter((d) => d.direction === 'piutang').reduce((s, d) => s + d.amount, 0);
  const shown = items.filter((d) => (filter === 'lunas' ? d.paid : !d.paid));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={shown}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.muted} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <Row style={{ gap: space.md }}>
              <StatCard compact value={piutang} label="Piutang ke saya" icon="arrow-down" tone={c.pastelTeal} iconColor={c.teal} />
              <StatCard compact value={hutang} label="Hutang saya" icon="arrow-up" tone={c.pastelPlum} iconColor={c.plum} />
            </Row>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'aktif', label: 'Belum lunas' },
                { value: 'lunas', label: 'Lunas' },
              ]}
            />
          </View>
        }
        ListEmptyComponent={loading ? undefined : <Empty icon="checkmark-circle-outline" text="Tidak ada catatan." />}
        renderItem={({ item, index }) => {
          const late = !item.paid && item.due_date !== null && item.due_date < today();
          return (
            <FadeIn index={index}>
              <SwipeRow
                left={{
                  label: item.paid ? 'Belum' : 'Lunas',
                  icon: item.paid ? 'arrow-undo-outline' : 'checkmark',
                  color: c.income,
                  onPress: () => togglePaid(item),
                }}
                right={{ label: 'Hapus', icon: 'trash-outline', color: c.expense, onPress: () => remove(item) }}
              >
                <ListItem
                  icon={item.direction === 'hutang' ? 'arrow-up' : 'arrow-down'}
                  iconBg={item.direction === 'hutang' ? c.pastelPlum : c.pastelTeal}
                  iconColor={item.direction === 'hutang' ? c.plum : c.teal}
                  title={item.person}
                  subtitle={[item.due_date && `Jatuh tempo ${formatDate(item.due_date)}`, item.note].filter(Boolean).join(' · ')}
                  right={rupiah(item.amount)}
                  rightSub={
                    <Pill
                      label={item.paid ? 'Lunas' : late ? 'Lewat tempo' : item.direction === 'hutang' ? 'Hutang' : 'Piutang'}
                      tone={item.paid ? 'good' : late ? 'bad' : 'neutral'}
                    />
                  }
                  dim={item.paid}
                  onPress={() => router.push({ pathname: '/hutang/form', params: { id: item.id } })}
                />
              </SwipeRow>
            </FadeIn>
          );
        }}
      />
      <Fab onPress={() => router.push('/hutang/form')} />
    </View>
  );
}
