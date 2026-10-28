import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatDate, rupiah, today } from './keuangan';
import { supabase } from './supabase';

export type InvoiceStatus = 'draft' | 'terkirim' | 'lunas';
export type Item = { desc: string; qty: number; price: number };

export type Invoice = {
  id: string;
  number: string;
  client: string;
  project_id: string | null;
  items: Item[];
  discount: number;
  paid_amount: number;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  terms: string | null;
  status: InvoiceStatus;
  transaction_id: string | null;
};

export type Business = {
  business_name: string | null;
  contact: string | null;
  address: string | null;
  payment_info: string | null;
  terms: string | null;
};

export const invoiceStatuses: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'terkirim', label: 'Terkirim' },
  { value: 'lunas', label: 'Lunas' },
];

export const DEFAULT_TERMS = `1. Pembayaran DP 50% dilakukan sebelum jadwal shooting atau pengerjaan dimulai. DP tidak dapat dikembalikan.
2. Pelunasan dilakukan paling lambat pada tanggal jatuh tempo, sebelum file final dikirim.
3. Revisi maksimal 2 kali. Revisi tambahan atau perubahan konsep dikenakan biaya terpisah.
4. File final dikirim melalui link digital. File mentah (RAW) tidak termasuk, kecuali disepakati sebelumnya.
5. Perubahan jadwal paling lambat H-3. Pembatalan oleh klien membuat DP hangus.
6. Hak cipta karya tetap milik kreator. Kreator berhak menggunakan hasil karya untuk portofolio, kecuali ada kesepakatan lain.`;

export function totals(inv: Pick<Invoice, 'items' | 'discount' | 'paid_amount'>) {
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  const total = Math.max(0, subtotal - inv.discount);
  return { subtotal, total, due: Math.max(0, total - inv.paid_amount) };
}

export async function getBusiness(): Promise<Business> {
  const { data } = await supabase.from('business_settings').select('*').maybeSingle();
  return {
    business_name: data?.business_name ?? null,
    contact: data?.contact ?? null,
    address: data?.address ?? null,
    payment_info: data?.payment_info ?? null,
    terms: data?.terms ?? DEFAULT_TERMS,
  };
}

// INV-202610-003: nomor urut per bulan
export async function nextNumber() {
  const ym = today().slice(0, 7).replace('-', '');
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .like('number', `INV-${ym}-%`);
  return `INV-${ym}-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

export function invoiceHtml(inv: Invoice, biz: Business, fallbackName: string) {
  const { subtotal, total, due } = totals(inv);
  const name = biz.business_name || fallbackName;
  const items = inv.items
    .filter((i) => i.desc && i.price > 0)
    .map(
      (i) => `<tr><td>${esc(i.desc)}</td><td class="c">${i.qty}</td><td class="r">${rupiah(i.price)}</td>
      <td class="r">${rupiah(i.qty * i.price)}</td></tr>`,
    )
    .join('');
  const terms = (inv.terms ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l.replace(/^\d+[.)]\s*/, ''))}</li>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 48px; font-size: 12px; line-height: 1.5; }
  .muted { color: #8a8a88; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 18px; font-weight: 700; }
  .word { font-size: 34px; font-weight: 300; letter-spacing: 6px; text-align: right; }
  .meta { display: flex; justify-content: space-between; margin: 40px 0 24px; }
  .label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #8a8a88; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #8a8a88; font-weight: 500; text-align: left; padding: 8px 0; border-bottom: 1px solid #111; }
  td { padding: 12px 0; border-bottom: 1px solid #ececea; vertical-align: top; }
  .c { text-align: center; } .r { text-align: right; }
  .sum { margin-left: auto; width: 46%; margin-top: 16px; }
  .sum td { border: none; padding: 4px 0; }
  .grand td { border-top: 1px solid #111; padding-top: 10px; font-size: 15px; font-weight: 700; }
  .block { margin-top: 32px; }
  ol { margin: 0; padding-left: 16px; color: #555; font-size: 10.5px; }
  li { margin-bottom: 3px; }
  .status { display: inline-block; margin-top: 6px; padding: 2px 10px; border: 1px solid #111; border-radius: 99px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .foot { margin-top: 48px; text-align: center; color: #8a8a88; font-size: 10px; }
</style></head><body>
  <div class="top">
    <div>
      <div class="brand">${esc(name)}</div>
      ${biz.address ? `<div class="muted">${esc(biz.address)}</div>` : ''}
      ${biz.contact ? `<div class="muted">${esc(biz.contact)}</div>` : ''}
    </div>
    <div>
      <div class="word">INVOICE</div>
      <div class="r muted">${esc(inv.number)}</div>
      ${inv.status === 'lunas' ? '<div class="r"><span class="status">Lunas</span></div>' : ''}
    </div>
  </div>
  <div class="meta">
    <div><div class="label">Ditagihkan kepada</div><div style="font-size:14px;font-weight:600">${esc(inv.client)}</div></div>
    <div class="r">
      <div class="label">Tanggal</div><div>${formatDate(inv.issue_date)}</div>
      ${inv.due_date ? `<div class="label" style="margin-top:8px">Jatuh tempo</div><div>${formatDate(inv.due_date)}</div>` : ''}
    </div>
  </div>
  <table>
    <tr><th>Deskripsi</th><th class="c">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr>
    ${items}
  </table>
  <table class="sum">
    <tr><td class="muted">Subtotal</td><td class="r">${rupiah(subtotal)}</td></tr>
    ${inv.discount > 0 ? `<tr><td class="muted">Diskon</td><td class="r">-${rupiah(inv.discount)}</td></tr>` : ''}
    ${inv.paid_amount > 0 ? `<tr><td class="muted">Total</td><td class="r">${rupiah(total)}</td></tr><tr><td class="muted">Sudah dibayar</td><td class="r">-${rupiah(inv.paid_amount)}</td></tr>` : ''}
    <tr class="grand"><td>${inv.status === 'lunas' ? 'Lunas' : inv.paid_amount > 0 ? 'Sisa tagihan' : 'Total'}</td><td class="r">${rupiah(inv.status === 'lunas' ? total : due)}</td></tr>
  </table>
  ${biz.payment_info ? `<div class="block"><div class="label">Pembayaran</div><div>${esc(biz.payment_info)}</div></div>` : ''}
  ${inv.notes ? `<div class="block"><div class="label">Catatan</div><div>${esc(inv.notes)}</div></div>` : ''}
  ${terms ? `<div class="block"><div class="label">Terms and Conditions</div><ol>${terms}</ol></div>` : ''}
  <div class="foot">Terima kasih atas kepercayaan Anda.</div>
</body></html>`;
}

// Di web, jendela sebaiknya dibuka langsung saat tombol ditekan (openPrintWindow) supaya tidak diblokir browser
export function openPrintWindow() {
  return Platform.OS === 'web' ? window.open('', '_blank') : null;
}

export async function shareInvoicePdf(inv: Invoice, fallbackName: string, printWindow?: Window | null) {
  if (Platform.OS === 'web') {
    const win = printWindow ?? window.open('', '_blank');
    const biz = await getBusiness();
    if (!win) throw new Error('Izinkan pop-up di browser untuk membuka invoice.');
    win.document.write(invoiceHtml(inv, biz, fallbackName));
    win.document.close();
    win.document.title = inv.number;
    // Dari dialog cetak pilih "Simpan sebagai PDF" atau bagikan
    setTimeout(() => win.print(), 300);
    return;
  }
  const biz = await getBusiness();
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(inv, biz, fallbackName) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: inv.number });
}

const categoryForKind: Record<string, string> = {
  video: 'Proyek video',
  foto: 'Proyek foto',
  editing: 'Jasa editing',
};

// Tandai lunas: catat sisa tagihan sebagai pemasukan Bisnis
export async function markPaid(inv: Invoice) {
  const { due } = totals(inv);
  let category = 'Lainnya';
  if (inv.project_id) {
    const { data } = await supabase.from('projects').select('kind').eq('id', inv.project_id).maybeSingle();
    category = categoryForKind[data?.kind ?? ''] ?? 'Lainnya';
  }
  let transaction_id: string | null = null;
  if (due > 0) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        book: 'bisnis',
        type: 'masuk',
        amount: due,
        category,
        note: `${inv.number} · ${inv.client}`,
        date: today(),
        project_id: inv.project_id,
      })
      .select('id')
      .single();
    if (error) throw error;
    transaction_id = data.id;
  }
  const { error } = await supabase.from('invoices').update({ status: 'lunas', transaction_id }).eq('id', inv.id);
  if (error) throw error;
}

// Batalkan lunas: hapus pemasukan yang dibuat otomatis
export async function unmarkPaid(inv: Invoice) {
  if (inv.transaction_id) await supabase.from('transactions').delete().eq('id', inv.transaction_id);
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'terkirim', transaction_id: null })
    .eq('id', inv.id);
  if (error) throw error;
}
