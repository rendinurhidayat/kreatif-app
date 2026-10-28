import { kinds, statuses, type Kind, type Status } from './proyek';
import { readText, saveText } from './simpan';

export type ImportRow = {
  title: string;
  client: string | null;
  kind: Kind;
  status: Status;
  shoot_date: string | null;
  deadline: string | null;
  links: string | null;
  notes: string | null;
  problem: string | null;
};

// Pemisah koma atau titik koma (Excel versi Indonesia memakai titik koma)
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// Nama kolom yang dikenali, bebas huruf besar kecil dan spasi
const columns: Record<keyof Omit<ImportRow, 'problem'>, string[]> = {
  title: ['nama', 'namaproyek', 'proyek', 'judul', 'title', 'project'],
  client: ['klien', 'client', 'customer', 'pelanggan'],
  kind: ['jenis', 'tipe', 'kind', 'type'],
  status: ['tahapan', 'status', 'tahap', 'stage'],
  shoot_date: ['shooting', 'tanggalshooting', 'tglshooting', 'shootdate', 'jadwalshooting'],
  deadline: ['deadline', 'tenggat', 'duedate', 'tanggaldeadline'],
  links: ['link', 'links', 'linkfile', 'file'],
  notes: ['catatan', 'notes', 'keterangan', 'note'],
};

function pick<V extends string>(options: { value: V; label: string }[], raw: string, fallback: V): V | null {
  const key = norm(raw);
  if (key === '') return fallback;
  return options.find((o) => norm(o.value) === key || norm(o.label) === key)?.value ?? null;
}

// Terima 2026-11-05, 05/11/2026, 5-11-2026
export function parseDate(raw: string): string | null | undefined {
  const s = raw.trim();
  if (s === '') return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

export function toProjects(table: string[][]): { rows: ImportRow[]; missingTitle: boolean } {
  const [header, ...body] = table;
  if (!header) return { rows: [], missingTitle: true };
  const index = Object.fromEntries(
    Object.entries(columns).map(([field, names]) => [field, header.findIndex((h) => names.includes(norm(h)))]),
  ) as Record<keyof typeof columns, number>;
  if (index.title < 0) return { rows: [], missingTitle: true };

  const get = (r: string[], field: keyof typeof columns) => (index[field] >= 0 ? (r[index[field]] ?? '').trim() : '');
  const rows = body.map((r): ImportRow => {
    const problems: string[] = [];
    const kind = pick(kinds, get(r, 'kind'), 'video');
    const status = pick(statuses, get(r, 'status'), 'brief');
    const shoot = parseDate(get(r, 'shoot_date'));
    const deadline = parseDate(get(r, 'deadline'));
    if (get(r, 'title') === '') problems.push('nama kosong');
    if (!kind) problems.push(`jenis "${get(r, 'kind')}" tidak dikenal`);
    if (!status) problems.push(`tahapan "${get(r, 'status')}" tidak dikenal`);
    if (shoot === undefined) problems.push('tanggal shooting salah');
    if (deadline === undefined) problems.push('deadline salah');
    return {
      title: get(r, 'title'),
      client: get(r, 'client') || null,
      kind: kind ?? 'lainnya',
      status: status ?? 'brief',
      shoot_date: shoot ?? null,
      deadline: deadline ?? null,
      links: get(r, 'links') || null,
      notes: get(r, 'notes') || null,
      problem: problems.length ? problems.join(', ') : null,
    };
  });
  return { rows, missingTitle: false };
}

export async function readCsv(uri: string) {
  return parseCsv(await readText(uri));
}

export async function shareTemplate() {
  await saveText(
    'template-proyek.csv',
    [
      'Nama,Klien,Jenis,Tahapan,Shooting,Deadline,Link,Catatan',
      'Prewedding Andi dan Sari,Andi,Video,Brief,2026-11-20,2026-12-05,,Lokasi Bandung',
      'Foto produk Kopi Senja,Kopi Senja,Foto,Shooting,25/11/2026,,https://drive.google.com/...,20 foto',
    ].join('\n'),
    'text/csv',
    'public.comma-separated-values-text',
  );
}
