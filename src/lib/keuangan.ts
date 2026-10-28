
import { supabase } from './supabase';
import { saveText } from './simpan';

export type Book = 'pribadi' | 'bisnis';
export type TxType = 'masuk' | 'keluar';

export type Transaction = {
  id: string;
  book: Book;
  type: TxType;
  amount: number;
  category: string;
  note: string | null;
  date: string;
  project_id: string | null;
  projects: { title: string } | null;
};

export type Debt = {
  id: string;
  direction: 'hutang' | 'piutang';
  person: string;
  amount: number;
  due_date: string | null;
  note: string | null;
  paid: boolean;
};

export const books: { value: Book; label: string }[] = [
  { value: 'bisnis', label: 'Bisnis' },
  { value: 'pribadi', label: 'Pribadi' },
];

export const TRANSFER = 'Pindah buku';

export const categories: Record<Book, Record<TxType, string[]>> = {
  bisnis: {
    masuk: ['Proyek video', 'Proyek foto', 'Jasa editing', 'Sewa alat', 'Lainnya'],
    keluar: [
      'Sewa alat',
      'Transport',
      'Kru lepas',
      'Langganan software',
      'Penyimpanan',
      'Servis alat',
      'Beli alat',
      'Konsumsi',
      'Iklan',
      'Pajak',
      'Lainnya',
    ],
  },
  pribadi: {
    masuk: ['Gaji dari bisnis', 'Hadiah', 'Lainnya'],
    keluar: ['Makan', 'Transport', 'Tagihan', 'Belanja', 'Hiburan', 'Kesehatan', 'Tabungan', 'Lainnya'],
  },
};

export function rupiah(n: number) {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${digits}`;
}

// "1.250.000" -> 1250000
export function parseRupiah(text: string) {
  return Number(text.replace(/\D/g, '')) || 0;
}

const pad = (x: number) => String(x).padStart(2, '0');

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const monthsLong = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

export function formatDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const day = days[new Date(y, m - 1, d).getDay()];
  if (iso === today()) return 'Hari ini';
  return `${day}, ${d} ${months[m - 1]}`;
}

// "2026-10" -> "Oktober 2026"
export function monthName(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${monthsLong[m - 1]} ${y}`;
}

export function monthShort(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${months[m - 1]} ${String(y).slice(2)}`;
}

// Geser bulan: shiftMonth("2026-01", -1) -> "2025-12"
export function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function lastDay(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${pad(new Date(y, m, 0).getDate())}`;
}

export async function loadMonth(book: Book, ym: string) {
  const [txs, all] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, projects(title)')
      .eq('book', book)
      .gte('date', `${ym}-01`)
      .lte('date', lastDay(ym))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('transactions').select('type, amount').eq('book', book).lte('date', lastDay(ym)),
  ]);
  if (txs.error) throw txs.error;
  if (all.error) throw all.error;

  const saldo = all.data.reduce((s, t) => s + (t.type === 'masuk' ? t.amount : -t.amount), 0);
  const list = txs.data as Transaction[];
  const masuk = list.filter((t) => t.type === 'masuk').reduce((s, t) => s + t.amount, 0);
  const keluar = list.filter((t) => t.type === 'keluar').reduce((s, t) => s + t.amount, 0);
  return { transactions: list, saldo, masuk, keluar };
}

// Kelompokkan transaksi per tanggal untuk daftar
export function byDay(list: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const t of list) map.set(t.date, [...(map.get(t.date) ?? []), t]);
  return [...map.entries()].map(([date, data]) => ({ title: date, data }));
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Ekspor transaksi ke file CSV (bisa dibuka di Excel / Google Sheets) lalu bagikan
export async function exportCsv(fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, book, type, category, amount, note, projects(title)')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date');
  if (error) throw error;
  const header = ['Tanggal', 'Buku', 'Jenis', 'Kategori', 'Jumlah', 'Proyek', 'Catatan'];
  const rows = (data as any[]).map((t) =>
    [
      t.date,
      t.book,
      t.type,
      t.category,
      t.type === 'masuk' ? t.amount : -t.amount,
      (Array.isArray(t.projects) ? t.projects[0] : t.projects)?.title ?? '',
      t.note ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  await saveText(
    `keuangan-${fromDate}-sd-${toDate}.csv`,
    [header.join(','), ...rows].join('\n'),
    'text/csv',
    'public.comma-separated-values-text',
  );
}
