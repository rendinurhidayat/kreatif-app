import { Linking } from 'react-native';

import type { Project } from './proyek';

// 0812-3456 7890 menjadi 6281234567890 (format WhatsApp)
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('62')) return d;
  if (d.startsWith('0')) return `62${d.slice(1)}`;
  return `62${d}`;
}

export const openWhatsApp = (phone: string, text = '') =>
  Linking.openURL(`https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`);

export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);

export function mapsLink(location: string | null, mapsUrl?: string | null) {
  if (mapsUrl) return mapsUrl;
  if (!location) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
export const formatTime = (t: string | null) => hhmm(t).replace(':', '.');

// Tautan "tambah ke Google Calendar". Tanpa jam dibuat sebagai acara seharian.
export function calendarLink(p: Project, kind: 'shooting' | 'deadline') {
  const date = kind === 'shooting' ? p.shoot_date : p.deadline;
  if (!date) return null;
  const ymd = date.replace(/-/g, '');
  let dates: string;
  if (kind === 'shooting' && p.shoot_time) {
    const start = hhmm(p.shoot_time);
    const [h, m] = start.split(':').map(Number);
    const end = p.shoot_end ? hhmm(p.shoot_end) : `${String(Math.min(h + 2, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    dates = `${ymd}T${start.replace(':', '')}00/${ymd}T${end.replace(':', '')}00`;
  } else {
    const next = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 1);
    const n = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    dates = `${ymd}/${n}`;
  }
  const title = `${kind === 'shooting' ? 'Shooting' : 'Deadline'}: ${p.title}`;
  const details = [
    p.client && `Klien: ${p.client}`,
    p.client_phone && `No HP: ${p.client_phone}`,
    p.notes,
    p.links,
  ]
    .filter(Boolean)
    .join('\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates, ctz: 'Asia/Jakarta', details });
  if (p.location) q.set('location', p.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
