import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, View } from 'react-native';

import { Button, ErrorText, Field, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { space, useColors } from '../lib/theme';

export default function Login() {
  const { session } = useAuth();
  const c = useColors();
  const [mode, setMode] = useState<'masuk' | 'daftar'>('masuk');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === 'masuk'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name.trim() } },
          });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === 'daftar' && !data.session) {
      setMessage('Akun dibuat. Cek email untuk konfirmasi, lalu masuk.');
      setMode('masuk');
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }}>
        <View style={{ gap: space.xs, marginBottom: space.lg }}>
          <T variant="display">Kreatif</T>
          <T variant="muted">Proyek, keuangan, dan invoice dalam satu app.</T>
        </View>
        {mode === 'daftar' && <Field label="Nama" value={name} onChangeText={setName} />}
        <Field
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          placeholder="Minimal 6 karakter"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
        <ErrorText>{message}</ErrorText>
        <Button
          title={mode === 'masuk' ? 'Masuk' : 'Daftar'}
          onPress={submit}
          loading={busy}
          disabled={!email || password.length < 6}
        />
        <Pressable onPress={() => setMode(mode === 'masuk' ? 'daftar' : 'masuk')}>
          <T variant="muted" style={{ textAlign: 'center' }}>
            {mode === 'masuk' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
