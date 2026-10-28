import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Avatar, Card, ListItem, Page, Row, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { isEnabled, remindersSupported, setEnabled, syncReminders } from '../../lib/pengingat';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';
import { showAlert } from '../../lib/dialog';

export default function Akun() {
  const { session } = useAuth();
  const user = session?.user;
  const c = useColors();
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    isEnabled().then(setReminders);
  }, []);

  async function toggle(on: boolean) {
    setReminders(on);
    await setEnabled(on);
  }

  function signOut() {
    showAlert('Keluar dari akun?', undefined, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <Page title="Akun">
      <Card tone={c.pastelIndigo} onPress={() => router.push('/profil')}>
        <Row style={{ gap: space.md }}>
          <Avatar name={user?.user_metadata?.full_name || user?.email || ''} size={52} />
          <View style={{ flex: 1 }}>
            <T variant="heading">{user?.user_metadata?.full_name || 'Tanpa nama'}</T>
            <T variant="small">{user?.email}</T>
          </View>
        </Row>
      </Card>

      <Card style={{ paddingVertical: space.xs }}>
        <ListItem
          icon="briefcase-outline"
          title="Profil dan usaha"
          subtitle="Nama, kontak, rekening, Terms and Conditions"
          right="›"
          onPress={() => router.push('/profil')}
        />
        <ListItem icon="sparkles-outline" title="Asisten AI" subtitle="Tanya soal proyek dan keuangan" right="›" onPress={() => router.push('/asisten')} />
        <ListItem icon="people-outline" title="Tim" subtitle="Anggota dan undangan" right="›" onPress={() => router.push('/tim')} />
        <ListItem
          icon="swap-vertical-outline"
          title="Hutang dan piutang"
          right="›"
          onPress={() => router.push('/hutang')}
        />
        <ListItem icon="bar-chart-outline" title="Laporan dan ekspor" right="›" onPress={() => router.push('/laporan')} />
      </Card>

      {remindersSupported && (
        <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Pengingat</T>
          <Switch value={reminders} onValueChange={toggle} trackColor={{ true: c.accent }} />
        </Row>
        <T variant="small">
          Jam 09:00 sehari sebelum shooting dan deadline, serta pada hari jatuh tempo tugas, hutang, dan invoice.
        </T>
      </Card>

      {reminders && (
        <Card onPress={() => syncReminders(user?.id).then(() => showAlert('Pengingat diperbarui'))}>
          <T>Perbarui pengingat sekarang</T>
        </Card>
      )}
        </>
      )}

      <Card onPress={signOut}>
        <T style={{ fontWeight: '600' }} color={c.expense}>
          Keluar
        </T>
      </Card>
      <T variant="small" style={{ textAlign: 'center', marginTop: space.md }}>
        Kreatif 1.0 · tampilan mengikuti mode terang/gelap iPhone
      </T>
    </Page>
  );
}
