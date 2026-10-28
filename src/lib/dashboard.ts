import { totals, type Invoice } from './invoice';
import { lastDay, shiftMonth, today, TRANSFER, type Transaction } from './keuangan';
import { getMyTeam, type Project } from './proyek';
import { supabase } from './supabase';

export type MonthSum = { month: string; masuk: number; keluar: number };

// Ringkasan untuk Beranda: 6 bulan buku Bisnis, invoice, proyek
export async function loadDashboard() {
  const thisMonth = today().slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5));
  const from = `${months[0]}-01`;

  const team = await getMyTeam().catch(() => null);
  const [tx, recent, inv, proj] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount, category, date')
      .eq('book', 'bisnis')
      .neq('category', TRANSFER)
      .gte('date', from)
      .lte('date', lastDay(thisMonth)),
    supabase
      .from('transactions')
      .select('*, projects(title)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('invoices').select('*').neq('status', 'lunas'),
    team
      ? supabase.from('projects').select('*').eq('team_id', team.id).neq('status', 'lunas')
      : Promise.resolve({ data: [] as Project[], error: null }),
  ]);
  for (const r of [tx, recent, inv, proj]) if (r.error) throw r.error;

  const rows = tx.data ?? [];
  const perMonth: MonthSum[] = months.map((m) => {
    const inMonth = rows.filter((r) => r.date.startsWith(m));
    return {
      month: m,
      masuk: inMonth.filter((r) => r.type === 'masuk').reduce((s, r) => s + r.amount, 0),
      keluar: inMonth.filter((r) => r.type === 'keluar').reduce((s, r) => s + r.amount, 0),
    };
  });

  const byCategory = new Map<string, number>();
  for (const r of rows.filter((r) => r.type === 'keluar')) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);
  }
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  // Empat kategori terbesar, sisanya digabung
  const expenses = sorted.slice(0, 4).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) expenses.push({ label: 'Lainnya', value: rest });

  const invoices = (inv.data ?? []) as Invoice[];
  const projects = (proj.data ?? []) as Project[];
  const now = today();
  const agenda = projects
    .flatMap((p) => [
      p.shoot_date ? { date: p.shoot_date, label: 'Shooting', project: p } : null,
      p.deadline ? { date: p.deadline, label: 'Deadline', project: p } : null,
    ])
    .filter((a): a is { date: string; label: string; project: Project } => a !== null && a.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const current = perMonth[perMonth.length - 1];
  return {
    team,
    perMonth,
    expenses,
    expenseTotal: sorted.reduce((s, [, v]) => s + v, 0),
    income: current.masuk,
    profit: current.masuk - current.keluar,
    unpaid: invoices.reduce((s, i) => s + totals(i).due, 0),
    unpaidCount: invoices.length,
    activeProjects: projects.length,
    recent: (recent.data ?? []) as Transaction[],
    agenda,
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
