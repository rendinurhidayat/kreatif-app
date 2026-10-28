import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Simpan teks (misalnya CSV) lalu bagikan. Di web langsung diunduh lewat browser.
export async function saveText(name: string, text: string, mimeType: string, UTI?: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, UTI });
}

// Baca isi file yang dipilih lewat DocumentPicker
export async function readText(uri: string) {
  if (Platform.OS === 'web') return (await fetch(uri)).text();
  return new File(uri).text();
}
