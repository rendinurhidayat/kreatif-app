import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorText, Form, ListItem, Pill, Row, T } from '../../components/ui';
import { success } from '../../lib/haptic';
import { formatDate } from '../../lib/keuangan';
import { readCsv, shareTemplate, toProjects, type ImportRow } from '../../lib/impor';
import { kindLabel, statusLabel } from '../../lib/proyek';
import { supabase } from '../../lib/supabase';
import { space, useColors } from '../../lib/theme';

export default function ImporProyek() {
  const c = useColors();
  const { team } = useLocalSearchParams<{ team: string }>();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = rows.filter((r) => !r.problem);
  const broken = rows.length - ready.length;

  async function choose() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'public.comma-separated-values-text'],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    try {
      const { rows, missingTitle } = toProjects(await readCsv(asset.uri));
      if (missingTitle) {
        setRows([]);
        return setError('Kolom "Nama" tidak ditemukan. Baris pertama file harus berisi judul kolom seperti di template.');
      }
      setFileName(asset.name);
      setRows(rows);
    } catch (e) {
      setError(`File tidak bisa dibaca: ${(e as Error).message}`);
    }
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from('projects')
      .insert(ready.map(({ problem: _, ...r }) => ({ ...r, team_id: team })));
    setBusy(false);
    if (error) return setError(error.message);
    success();
    router.back();
  }

  return (
    <Form>
      <Card tone={c.pastelBlue} style={{ gap: space.sm }}>
        <T variant="heading">Impor dari Google Sheets atau Excel</T>
        <T variant="small" color={c.text}>
          1. Isi sheet dengan kolom: Nama, Klien, Jenis, Tahapan, Shooting, Deadline, Link, Catatan. Hanya Nama yang wajib.
        </T>
        <T variant="small" color={c.text}>
          2. Google Sheets: File {'>'} Download {'>'} CSV. Excel: Save As {'>'} CSV.
        </T>
        <T variant="small" color={c.text}>
          3. Pilih file CSV itu di sini. Tanggal boleh 2026-11-20 atau 20/11/2026.
        </T>
      </Card>

      <Button title={fileName ? 'Pilih file lain' : 'Pilih file CSV'} icon="document-text-outline" onPress={choose} />
      <Button title="Unduh template" variant="secondary" icon="download-outline" onPress={() => shareTemplate()} />
      <ErrorText>{error}</ErrorText>

      {rows.length > 0 && (
        <>
          <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
            <T variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {fileName}
            </T>
            <Pill label={`${ready.length} siap`} tone="good" />
            {broken > 0 && <Pill label={`${broken} dilewati`} tone="bad" />}
          </Row>
          <View>
            {rows.map((r, i) => (
              <ListItem
                key={i}
                icon={r.problem ? 'alert-circle-outline' : 'folder-outline'}
                iconColor={r.problem ? c.expense : c.accent}
                iconBg={r.problem ? c.expenseSoft : c.pastelBlue}
                title={r.title || `Baris ${i + 2}`}
                subtitle={
                  r.problem ??
                  [r.client, kindLabel(r.kind), statusLabel(r.status), r.deadline && `DL ${formatDate(r.deadline)}`]
                    .filter(Boolean)
                    .join(' · ')
                }
                dim={!!r.problem}
              />
            ))}
          </View>
          <Button
            title={`Impor ${ready.length} proyek`}
            onPress={save}
            loading={busy}
            disabled={ready.length === 0}
          />
        </>
      )}
    </Form>
  );
}
