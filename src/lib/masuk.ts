import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// Login Google. Di web halaman pindah ke Google lalu kembali; di HP lewat jendela login di dalam app.
export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }
  const redirectTo = Linking.createURL('/login');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return;
  const params = new URL(res.url).searchParams;
  const code = params.get('code');
  if (params.get('error_description')) throw new Error(params.get('error_description')!);
  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    if (e) throw e;
  }
}

// 0812..., 812..., +62812... menjadi +62812...
export function toE164(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return `+62${digits}`;
}

export async function sendPhoneCode(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
  if (error) throw error;
}

export async function verifyPhoneCode(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token, type: 'sms' });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/sandi` : Linking.createURL('/sandi');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}
