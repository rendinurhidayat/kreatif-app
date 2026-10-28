import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, ErrorText, Field, Form, Section, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { success } from '../lib/haptic';
import { DEFAULT_TERMS, getBusiness } from '../lib/invoice';
import { supabase } from '../lib/supabase';

export default function Profil() {
  const { session } = useAuth();
  const user = session?.user;
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [business, setBusiness] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState('');
  const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBusiness().then((b) => {
      setBusiness(b.business_name ?? '');
      setContact(b.contact ?? '');
      setAddress(b.address ?? '');
      setPayment(b.payment_info ?? '');
      setTerms(b.terms ?? DEFAULT_TERMS);
    });
  }, []);

  async function save() {
    if (!user) return;
    setBusy(true);
    setError(null);
    const fullName = name.trim();
    // Nama tampil untuk tim disimpan di profil dan data login
    const [a, b, c] = await Promise.all([
      supabase.auth.updateUser({ data: { full_name: fullName } }),
      supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id),
      supabase.from('business_settings').upsert({
        owner_id: user.id,
        business_name: business.trim() || null,
        contact: contact.trim() || null,
        address: address.trim() || null,
        payment_info: payment.trim() || null,
        terms: terms.trim() || null,
        updated_at: new Date().toISOString(),
      }),
    ]);
    setBusy(false);
    const err = a.error ?? b.error ?? c.error;
    if (err) setError(err.message);
    else {
      success();
      router.back();
    }
  }

  return (
    <Form>
      <Field label="Nama kamu" value={name} onChangeText={setName} />
      <Section title="Usaha (tampil di invoice)" />
      <Field label="Nama usaha" placeholder="Misal: Ongstoree Visual" value={business} onChangeText={setBusiness} />
      <Field
        label="Kontak"
        placeholder="WhatsApp, email, Instagram"
        multiline
        value={contact}
        onChangeText={setContact}
      />
      <Field label="Alamat" placeholder="Opsional" multiline value={address} onChangeText={setAddress} />
      <Field
        label="Info pembayaran"
        placeholder="Misal: BCA 1234567890 a.n. Rendi"
        multiline
        value={payment}
        onChangeText={setPayment}
      />
      <Field
        label="Terms and Conditions bawaan"
        multiline
        value={terms}
        onChangeText={setTerms}
        style={{ minHeight: 200, fontSize: 14 }}
      />
      <T variant="small">Satu poin per baris. Dipakai otomatis di setiap invoice baru.</T>
      <Button title="Pakai teks bawaan" variant="secondary" onPress={() => setTerms(DEFAULT_TERMS)} />
      <ErrorText>{error}</ErrorText>
      <Button title="Simpan" onPress={save} loading={busy} />
    </Form>
  );
}
