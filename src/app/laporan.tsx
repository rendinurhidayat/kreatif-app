import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";

import { BarChart, DonutChart, LineChart } from "../components/charts";
import {
  Button,
  Card,
  ErrorText,
  Money,
  Num,
  Row,
  Segmented,
  T,
} from "../components/ui";
import {
  books,
  exportCsv,
  lastDay,
  monthName,
  monthShort,
  rupiah,
  shiftMonth,
  today,
  TRANSFER,
  type Book,
} from "../lib/keuangan";
import { kindLabel, kinds, type Kind, type Status } from "../lib/proyek";
import { supabase } from "../lib/supabase";
import { palette, radius, space, useColors } from "../lib/theme";

type TxRow = {
  type: "masuk" | "keluar";
  amount: number;
  category: string;
  date: string;
  projects: { title: string } | null;
};

type JobRow = {
  client: string | null;
  kind: Kind;
  status: Status;
  shoot_date: string | null;
  deadline: string | null;
};

export default function Laporan() {
  const c = useColors();
  const colors = palette(c);
  const [book, setBook] = useState<Book>("bisnis");
  const [range, setRange] = useState<"1" | "6" | "12">("1");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const thisMonth = today().slice(0, 7);
  const months = Array.from({ length: Number(range) }, (_, i) =>
    shiftMonth(thisMonth, i - Number(range) + 1),
  );
  const from = `${months[0]}-01`;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("type, amount, category, date, projects(title)")
      .eq("book", book)
      .gte("date", from)
      .neq("category", TRANSFER);
    if (error) setError(error.message);
    else setRows(data as unknown as TxRow[]);
    // Rekap job: dihitung dari tanggal shooting, atau deadline kalau belum ada jadwal shooting
    const res = await supabase
      .from("projects")
      .select("client, kind, status, shoot_date, deadline");
    if (!res.error) setJobs(res.data as JobRow[]);
  }, [book, from]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const perMonth = months.map((m) => {
    const inMonth = rows.filter((r) => r.date.startsWith(m));
    return {
      month: m,
      masuk: inMonth
        .filter((r) => r.type === "masuk")
        .reduce((s, r) => s + r.amount, 0),
      keluar: inMonth
        .filter((r) => r.type === "keluar")
        .reduce((s, r) => s + r.amount, 0),
    };
  });
  const max = Math.max(1, ...perMonth.flatMap((p) => [p.masuk, p.keluar]));
  const totalMasuk = perMonth.reduce((s, p) => s + p.masuk, 0);
  const totalKeluar = perMonth.reduce((s, p) => s + p.keluar, 0);
  const net = totalMasuk - totalKeluar;

  const byCategory = group(
    rows.filter((r) => r.type === "keluar"),
    (r) => r.category,
  );
  const byProject = group(
    rows.filter((r) => r.type === "masuk" && r.projects),
    (r) => r.projects!.title,
  );

  const end = lastDay(thisMonth);
  const jobsInRange = jobs.filter((j) => {
    const d = j.shoot_date ?? j.deadline;
    return d && d >= from && d <= end;
  });
  const jobsDone = jobsInRange.filter(
    (j) => j.status === "selesai" || j.status === "lunas",
  ).length;
  const jobsPaid = jobsInRange.filter((j) => j.status === "lunas").length;
  const jobsByKind = kinds
    .map(
      (k) =>
        [
          k.value,
          jobsInRange.filter((j) => j.kind === k.value).length,
        ] as const,
    )
    .filter(([, n]) => n > 0);
  const clientCount = new Map<string, number>();
  for (const j of jobsInRange)
    if (j.client)
      clientCount.set(j.client, (clientCount.get(j.client) ?? 0) + 1);
  const topClients = [...clientCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const label =
    range === "1"
      ? monthName(thisMonth)
      : `${monthName(months[0])} sampai ${monthName(thisMonth)}`;

  async function exportFile() {
    setExporting(true);
    try {
      await exportCsv(from, lastDay(thisMonth));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: space.lg,
        gap: space.md,
        paddingBottom: 60,
      }}
    >
      <Segmented value={book} onChange={setBook} options={books} />
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: "1", label: "Bulan ini" },
          { value: "6", label: "6 bulan" },
          { value: "12", label: "1 tahun" },
        ]}
      />
      <ErrorText>{error}</ErrorText>

      <Card tone={c.pastelBlue}>
        <T variant="small">
          {book === "bisnis" ? "Laba" : "Selisih"} · {label}
        </T>
        <Money value={net} size={30} color={net >= 0 ? c.income : c.expense} />
        <T variant="small">
          Masuk {rupiah(totalMasuk)} · Keluar {rupiah(totalKeluar)}
        </T>
      </Card>

      <Card
        style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
      >
        <T variant="heading">Rekap job</T>
        <T variant="small">
          Dihitung dari tanggal shooting (atau deadline) di periode ini.
        </T>
        <Row style={{ marginTop: space.md, gap: space.sm }}>
          <Stat label="Job" value={jobsInRange.length} tone={c.pastelIndigo} />
          <Stat label="Selesai" value={jobsDone} tone={c.incomeSoft} />
          <Stat label="Lunas" value={jobsPaid} tone={c.pastelBlue} />
        </Row>
        {jobsByKind.map(([k, n]) => (
          <Bar
            key={k}
            label={kindLabel(k)}
            value={n}
            max={jobsInRange.length}
            color={c.indigo}
            format={(v) => `${v} job`}
          />
        ))}
        {topClients.length > 0 && (
          <>
            <T
              variant="small"
              color={c.text}
              style={{ marginTop: space.md, fontWeight: "600" }}
            >
              Klien terbanyak
            </T>
            {topClients.map(([name, n]) => (
              <Row
                key={name}
                style={{ justifyContent: "space-between", marginTop: 6 }}
              >
                <T numberOfLines={1} style={{ flex: 1 }}>
                  {name}
                </T>
                <Num size={13}>{`${n} job`}</Num>
              </Row>
            ))}
          </>
        )}
      </Card>

      <Card
        style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
      >
        <T variant="heading">Per bulan</T>
        <T variant="small">Ketuk bulan untuk melihat angkanya.</T>
        <View style={{ marginTop: space.md }}>
          <BarChart
            labels={perMonth.map((p) => monthShort(p.month).split(" ")[0])}
            series={[
              {
                name: "Masuk",
                color: c.indigo,
                values: perMonth.map((p) => p.masuk),
              },
              {
                name: "Keluar",
                color: c.accent,
                values: perMonth.map((p) => p.keluar),
              },
            ]}
          />
        </View>
      </Card>

      <Card
        style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
      >
        <T variant="heading">Cashflow bersih</T>
        <View style={{ marginTop: space.md }}>
          <LineChart
            labels={perMonth.map((p) => monthShort(p.month).split(" ")[0])}
            series={[
              {
                name: "Bersih",
                color: c.accent,
                values: perMonth.map((p) => p.masuk - p.keluar),
              },
            ]}
          />
        </View>
      </Card>

      <Card
        style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
      >
        <T variant="heading">Pengeluaran per kategori</T>
        {byCategory.length === 0 ? (
          <T variant="small">Belum ada pengeluaran.</T>
        ) : (
          <View style={{ marginTop: space.md }}>
            <DonutChart
              centerLabel={
                range === "1"
                  ? "Bulan ini"
                  : range === "12"
                    ? "1 tahun"
                    : "6 bulan"
              }
              data={byCategory
                .slice(0, 6)
                .map(([label, value], i) => ({
                  label,
                  value,
                  color: colors[i % colors.length],
                }))}
            />
          </View>
        )}
      </Card>

      {book === "bisnis" && (
        <Card
          style={{
            backgroundColor: c.bg,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <T variant="heading">Pemasukan per proyek</T>
          {byProject.length === 0 && (
            <T variant="small">
              Tandai pemasukan ke proyek supaya muncul di sini.
            </T>
          )}
          {byProject.map(([name, total]) => (
            <Bar
              key={name}
              label={name}
              value={total}
              max={byProject[0][1]}
              color={c.income}
            />
          ))}
        </Card>
      )}

      <Button
        title="Ekspor CSV (Excel)"
        icon="download-outline"
        variant="secondary"
        onPress={exportFile}
        loading={exporting}
      />
      <T variant="small" style={{ textAlign: "center" }}>
        Berisi semua transaksi Bisnis dan Pribadi pada periode ini.
      </T>
    </ScrollView>
  );
}

function group(rows: TxRow[], key: (r: TxRow) => string) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + r.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tone,
        borderRadius: radius.md,
        padding: space.md,
        gap: 2,
      }}
    >
      <Num size={22}>{String(value)}</Num>
      <T variant="small">{label}</T>
    </View>
  );
}

function Bar({
  label,
  value,
  max,
  color,
  format = rupiah,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  format?: (v: number) => string;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6, marginTop: space.sm }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T variant="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </T>
        <Num size={12.5}>{format(value)}</Num>
      </Row>
      <View
        style={{
          height: 6,
          backgroundColor: c.border,
          borderRadius: radius.pill,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${(value / Math.max(1, max)) * 100}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: radius.pill,
          }}
        />
      </View>
    </View>
  );
}
