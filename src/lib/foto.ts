import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

// Pilih foto dari galeri, potong persegi, unggah ke Storage, lalu simpan alamatnya di profil
export async function changeAvatar(userId: string): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const type = asset.mimeType ?? 'image/jpeg';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: type, upsert: true });
  if (error) throw error;
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const [a, b] = await Promise.all([
    supabase.auth.updateUser({ data: { avatar_url: url } }),
    supabase.from('profiles').update({ avatar_url: url }).eq('id', userId),
  ]);
  if (a.error ?? b.error) throw a.error ?? b.error;
  return url;
}
