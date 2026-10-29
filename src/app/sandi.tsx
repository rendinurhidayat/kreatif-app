import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, ErrorText, Field, Form, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { success } from '../lib/haptic';
import { supabase } from '../lib/supabase';

// Dibuka dari link "lupa password" di email
export default function PasswordBaru() {
  const { session } = useAuth();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Di HP kode dari link ditukar dulu jadi sesi login (di web sudah otomatis)
  useEffect(() => {
    if (code && !session) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => error && setError(error.message));
    }
  }, [code, session]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    success();
    router.replace('/');
  }

  return (
    <Form title="Buat password baru">
      <T variant="muted">Minimal 6 karakter. Setelah disimpan kamu langsung masuk.</T>
      <Field label="Password baru" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <Button title="Simpan password" onPress={save} loading={busy} disabled={!session || password.length < 6} />
    </Form>
  );
}
