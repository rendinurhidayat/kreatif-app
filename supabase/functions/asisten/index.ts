// Asisten AI Jobsly. Dijalankan sebagai Supabase Edge Function bernama "asisten".
// Butuh salah satu secret: GEMINI_API_KEY (ada kuota gratis) atau ANTHROPIC_API_KEY (Claude, berbayar).
// Kalau dua-duanya diisi, Claude yang dipakai. Data dibaca memakai login pengguna, jadi aturan RLS tetap berlaku:
// anggota tim hanya melihat proyek tim, keuangan hanya terlihat oleh pemiliknya.
import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `Kamu adalah asisten di app "Jobsly", milik seorang editor, videografer, dan fotografer.
App ini mengelola proyek kreatif tim (tahapan brief, pra-produksi, shooting, editing, revisi, selesai, lunas),
tugas, invoice, serta keuangan Bisnis dan Pribadi yang terpisah, plus hutang dan piutang.

Cara menjawab:
- Pakai Bahasa Indonesia yang santai dan jelas. Jawaban singkat, langsung ke inti, cocok dibaca di HP.
- Untuk pertanyaan tentang data, jawab hanya dari DATA di bawah. Kalau datanya tidak ada, bilang terus terang.
- Tulis uang dalam format Rupiah, misalnya Rp 7.500.000. Tulis tanggal seperti 5 Nov 2026.
- Kamu tidak bisa mengubah data. Kalau diminta menambah atau mengubah sesuatu, jelaskan di menu mana caranya.
- Kamu juga boleh membantu hal kreatif umum: ide konsep, brief, caption, pesan ke klien, harga jasa, dan sejenisnya.
- Jangan pakai tabel markdown atau heading. Daftar pendek dengan tanda "-" boleh.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Belum login' }, 401);
  if (!Deno.env.get('ANTHROPIC_API_KEY') && !Deno.env.get('GEMINI_API_KEY')) {
    return json({ error: 'GEMINI_API_KEY atau ANTHROPIC_API_KEY belum diisi di Secrets Edge Functions.' }, 500);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: user } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
  if (!user.user) return json({ error: 'Sesi login tidak valid' }, 401);

  const { messages } = (await req.json()) as { messages: { role: 'user' | 'assistant'; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'Pesan kosong' }, 400);

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [profile, projects, tasks, transactions, debts, invoices] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.user.id).maybeSingle(),
    supabase
      .from('projects')
      .select('id, title, client, client_phone, kind, status, shoot_date, shoot_time, deadline, location, notes')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('tasks')
      .select('project_id, title, due_date, done, profiles(full_name)')
      .eq('done', false)
      .limit(200),
    supabase
      .from('transactions')
      .select('book, type, amount, category, note, date, projects(title)')
      .gte('date', since)
      .order('date', { ascending: false })
      .limit(400),
    supabase.from('debts').select('direction, person, amount, due_date, note').eq('paid', false),
    supabase
      .from('invoices')
      .select('number, client, items, discount, paid_amount, issue_date, due_date, status')
      .order('issue_date', { ascending: false })
      .limit(60),
  ]);

  const data = {
    hari_ini: today,
    nama_pengguna: profile.data?.full_name ?? null,
    proyek: projects.data ?? [],
    tugas_belum_selesai: tasks.data ?? [],
    transaksi_6_bulan: transactions.data ?? [],
    hutang_piutang_belum_lunas: debts.data ?? [],
    invoice_terbaru: invoices.data ?? [],
  };

  // Riwayat dibatasi 20 pesan terakhir supaya hemat
  const history = messages.slice(-20).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  const context = `DATA (JSON):\n${JSON.stringify(data)}`;
  try {
    const reply = Deno.env.get('ANTHROPIC_API_KEY')
      ? await askClaude(context, history)
      : await askGemini(context, history);
    return json({ reply: reply || 'Maaf, belum ada jawaban. Coba lagi ya.' });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'API key Claude tidak valid.' }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Terlalu banyak permintaan, coba sebentar lagi.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude error ${e.status}: ${e.message}` }, 502);
    if ((e as Error).name === 'TimeoutError') return json({ error: 'Gemini terlalu lama menjawab, coba lagi.' }, 504);
    return json({ error: (e as Error).message }, 500);
  }
});

type Turn = { role: 'user' | 'assistant'; content: string };

async function askClaude(context: string, history: Turn[]) {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM },
      { type: 'text', text: context },
    ],
    messages: history,
  });
  if (response.stop_reason === 'refusal') {
    return 'Maaf, aku tidak bisa membantu permintaan itu. Coba tanyakan dengan cara lain.';
  }
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim();
}

// Gemini lewat REST API. Kalau satu model sedang penuh (503) atau kuotanya habis (429),
// coba model berikutnya. Model utama bisa diganti dengan secret GEMINI_MODEL.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];

async function askGemini(context: string, history: Turn[]) {
  const custom = Deno.env.get('GEMINI_MODEL');
  const models = custom ? [custom, ...GEMINI_MODELS.filter((m) => m !== custom)] : GEMINI_MODELS;
  const deadline = Date.now() + 45000;
  let last = '';
  for (const model of models) {
    if (Date.now() > deadline) break;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
      signal: AbortSignal.timeout(Math.max(5000, deadline - Date.now())),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${context}` }] },
        contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 4000 },
      }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      const parts: { text?: string }[] = body?.candidates?.[0]?.content?.parts ?? [];
      return parts.map((p) => p.text ?? '').join('').trim();
    }
    last = `${res.status}: ${body?.error?.message ?? 'tidak diketahui'}`;
    // Model tidak tersedia, penuh, atau kuotanya habis: lanjut ke model berikutnya
    if (![404, 429, 500, 503].includes(res.status)) break;
  }
  if (last.startsWith('429')) throw new Error('Kuota gratis Gemini sedang habis, coba lagi beberapa menit lagi.');
  if (last.startsWith('503')) throw new Error('Server Gemini sedang penuh, coba lagi sebentar lagi.');
  throw new Error(`Gemini error ${last}`);
}
