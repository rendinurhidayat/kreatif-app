import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { MonthCalendar, type DayMark } from "../../components/calendar";
import {
  Button,
  Card,
  Chips,
  Empty,
  ErrorText,
  Fab,
  FadeIn,
  Field,
  IconButton,
  Num,
  Page,
  Pill,
  Row,
  Section,
  Segmented,
  T,
} from "../../components/ui";
import { success, tap } from "../../lib/haptic";
import { formatDate, formatDay, monthName, today } from "../../lib/keuangan";
import { formatTime } from "../../lib/kontak";
import {
  getMyTeam,
  kindLabel,
  kinds,
  statuses,
  statusLabel,
  type Kind,
  type Project,
  type Status,
  type Team,
} from "../../lib/proyek";
import { supabase } from "../../lib/supabase";
import { fonts, radius, space, useColors, type Colors } from "../../lib/theme";
import { showAlert } from "../../lib/dialog";

type Agenda = {
  key: string;
  date: string;
  label: string;
  time: string | null;
  project: Project;
};
type TimeFilter = "semua" | "minggu" | "bulan" | "telat";

function statusColor(c: Colors, s: Status) {
  const map: Record<Status, string> = {
    brief: c.muted,
    praproduksi: c.plum,
    shooting: c.accent,
    editing: c.indigo,
    revisi: c.warning,
    selesai: c.teal,
    lunas: c.income,
  };
  return map[s];
}

const COLUMN = 288;

export default function Proyek() {
  const c = useColors();
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"papan" | "kalender" | "jadwal">("papan");
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [kindFilter, setKindFilter] = useState<Kind | "semua">("semua");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("semua");
  const [selected, setSelected] = useState(today());
  const [calMonth, setCalMonth] = useState(today().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getMyTeam();
      setTeam(t);
      if (t) {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("team_id", t.id)
          .order("deadline", { ascending: true, nullsFirst: false });
        if (error) throw error;
        setProjects(data as Project[]);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function createTeam() {
    const { error } = await supabase
      .from("teams")
      .insert({ name: teamName.trim() });
    if (error) setError(error.message);
    else load();
  }

  async function move(p: Project, status: Status) {
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, status } : x)));
    success();
    await supabase.from("projects").update({ status }).eq("id", p.id);
  }

  // Tekan lama kartu untuk memindahkan tahapan
  function chooseStatus(p: Project) {
    const options = statuses.filter((s) => s.value !== p.status);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Pindahkan "${p.title}"`,
          options: [...options.map((o) => o.label), "Batal"],
          cancelButtonIndex: options.length,
        },
        (i) => i < options.length && move(p, options[i].value),
      );
    } else {
      showAlert(`Pindahkan "${p.title}"`, undefined, [
        ...options.map((o) => ({
          text: o.label,
          onPress: () => move(p, o.value),
        })),
        { text: "Batal", style: "cancel" as const },
      ]);
    }
  }

  if (team === undefined) {
    return (
      <Page title="Proyek">
        {error ? (
          <>
            <ErrorText>{error}</ErrorText>
            <Button title="Coba lagi" variant="secondary" onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={c.accent} style={{ marginTop: 48 }} />
        )}
      </Page>
    );
  }

  if (team === null) {
    return (
      <Page title="Proyek">
        <Card style={{ gap: space.md }} tone={c.pastelBlue}>
          <T variant="heading">Buat tim dulu</T>
          <T variant="muted">
            Proyek disimpan di dalam tim. Anggota bisa diundang lewat email
            kapan saja.
          </T>
          <Field
            label="Nama tim"
            placeholder="Misal: Ongstoree Studio"
            value={teamName}
            onChangeText={setTeamName}
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title="Buat tim"
            onPress={createTeam}
            disabled={teamName.trim() === ""}
          />
        </Card>
      </Page>
    );
  }

  const now = today();
  const weekEnd = addDays(now, 7);
  const thisMonth = now.slice(0, 7);
  const q = query.trim().toLowerCase();
  const late = (p: Project) =>
    !!p.deadline &&
    p.deadline < now &&
    !["selesai", "lunas"].includes(p.status);
  const dates = (p: Project) =>
    [p.shoot_date, p.deadline].filter((d): d is string => !!d);
  const shown = projects.filter((p) => {
    if (
      q &&
      ![p.title, p.client, p.location].some((t) => t?.toLowerCase().includes(q))
    )
      return false;
    if (kindFilter !== "semua" && p.kind !== kindFilter) return false;
    if (
      timeFilter === "minggu" &&
      !dates(p).some((d) => d >= now && d <= weekEnd)
    )
      return false;
    if (
      timeFilter === "bulan" &&
      !dates(p).some((d) => d.startsWith(thisMonth))
    )
      return false;
    if (timeFilter === "telat" && !late(p)) return false;
    return true;
  });
  const activeFilters =
    (kindFilter !== "semua" ? 1 : 0) + (timeFilter !== "semua" ? 1 : 0);

  const agendaOf = (list: Project[]): Agenda[] =>
    list
      .flatMap((p) => [
        p.shoot_date
          ? {
              key: `${p.id}-s`,
              date: p.shoot_date,
              label: "Shooting",
              time: p.shoot_time,
              project: p,
            }
          : null,
        p.deadline
          ? {
              key: `${p.id}-d`,
              date: p.deadline,
              label: "Deadline",
              time: null,
              project: p,
            }
          : null,
      ])
      .filter((a): a is Agenda => a !== null)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.time ?? "").localeCompare(b.time ?? ""),
      );

  const allAgenda = agendaOf(shown);
  const upcoming = allAgenda.filter(
    (a) => a.date >= now && a.project.status !== "lunas",
  );
  const marks: Record<string, DayMark> = {};
  for (const a of allAgenda) {
    const m = (marks[a.date] ??= {});
    if (a.label === "Shooting") m.shoot = true;
    else {
      m.deadline = true;
      if (late(a.project)) m.late = true;
    }
  }
  const dayItems = allAgenda.filter((a) => a.date === selected);
  const monthItems = allAgenda.filter((a) => a.date.startsWith(calMonth));

  const refresh = (
    <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.muted} />
  );

  const card = (item: Project, i: number) => (
    <FadeIn key={item.id} index={i}>
      <Card
        style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}
        onPress={() => router.push(`/proyek/${item.id}`)}
        onLongPress={() => chooseStatus(item)}
      >
        <T variant="heading" numberOfLines={2} style={{ fontSize: 16 }}>
          {item.title}
        </T>
        <T variant="small" numberOfLines={1}>
          {[item.client, kindLabel(item.kind)].filter(Boolean).join(" · ")}
        </T>
        {item.location && (
          <Row style={{ gap: 4 }}>
            <Ionicons name="location-outline" size={13} color={c.muted} />
            <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
              {item.location}
            </T>
          </Row>
        )}
        {(item.shoot_date || item.deadline) && (
          <Row style={{ marginTop: space.sm, flexWrap: "wrap", gap: 6 }}>
            {item.shoot_date && (
              <Pill
                label={`Shoot ${formatDate(item.shoot_date)}${item.shoot_time ? ` ${formatTime(item.shoot_time)}` : ""}`}
                tone="info"
              />
            )}
            {item.deadline && (
              <Pill
                label={`DL ${formatDate(item.deadline)}`}
                tone={late(item) ? "bad" : "neutral"}
              />
            )}
          </Row>
        )}
      </Card>
    </FadeIn>
  );

  const agendaCard = (item: Agenda, index: number, showDate: boolean) => (
    <FadeIn key={item.key} index={index}>
      <Card
        onPress={() => router.push(`/proyek/${item.project.id}`)}
        style={{ flexDirection: "row", gap: space.md }}
      >
        <View
          style={{
            width: 4,
            borderRadius: 2,
            backgroundColor:
              item.label === "Deadline"
                ? late(item.project)
                  ? c.expense
                  : c.plum
                : c.accent,
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T variant="small">
              {[
                showDate ? formatDay(item.date) : null,
                item.time ? `${formatTime(item.time)} WIB` : null,
              ]
                .filter(Boolean)
                .join(" · ") ||
                (item.label === "Deadline" ? "Seharian" : "Jam belum diisi")}
            </T>
            <Pill
              label={item.label}
              tone={item.label === "Deadline" ? "bad" : "info"}
            />
          </Row>
          <T variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
            {item.project.title}
          </T>
          <T variant="small" numberOfLines={1}>
            {[
              item.project.client,
              item.project.location,
              statusLabel(item.project.status),
            ]
              .filter(Boolean)
              .join(" · ")}
          </T>
        </View>
      </Card>
    </FadeIn>
  );

  return (
    <Page
      title={team.name}
      subtitle="Job"
      scroll={false}
      action={
        <Row>
          <IconButton
            name="cloud-upload-outline"
            outline
            onPress={() =>
              router.push({
                pathname: "/proyek/impor",
                params: { team: team.id },
              })
            }
          />
          <IconButton
            name="people-outline"
            outline
            onPress={() => router.push("/tim")}
          />
        </Row>
      }
    >
      <View
        style={{
          paddingHorizontal: space.lg,
          gap: space.sm,
          paddingBottom: space.md,
        }}
      >
        <Row>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingHorizontal: 14,
            }}
          >
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari job, klien, lokasi"
              placeholderTextColor={c.muted}
              style={{
                flex: 1,
                paddingVertical: 11,
                fontFamily: fonts.text,
                fontSize: 16,
                color: c.text,
              }}
            />
            {query !== "" && (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={c.muted} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => {
              tap();
              setShowFilter(!showFilter);
            }}
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                showFilter || activeFilters ? c.primary : c.surface,
            }}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={showFilter || activeFilters ? c.onPrimary : c.text}
            />
            {activeFilters > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: c.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Num size={10} color="#FFFFFF">
                  {activeFilters}
                </Num>
              </View>
            )}
          </Pressable>
        </Row>
        {showFilter && (
          <View style={{ gap: space.sm }}>
            <Chips
              scroll
              options={[{ value: "semua", label: "Semua jenis" }, ...kinds]}
              value={kindFilter}
              onChange={setKindFilter}
            />
            <Chips
              scroll
              options={[
                { value: "semua", label: "Semua waktu" },
                { value: "minggu", label: "7 hari ke depan" },
                { value: "bulan", label: "Bulan ini" },
                { value: "telat", label: "Terlambat" },
              ]}
              value={timeFilter}
              onChange={setTimeFilter}
            />
          </View>
        )}
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "papan", label: "Papan" },
            { value: "kalender", label: "Kalender" },
            { value: "jadwal", label: "Jadwal" },
          ]}
        />
        <ErrorText>{error}</ErrorText>
        {(q || activeFilters > 0) && (
          <T variant="small">
            {shown.length} dari {projects.length} job
          </T>
        )}
      </View>

      {view === "papan" ? (
        projects.length === 0 && !loading ? (
          <Empty
            icon="folder-open-outline"
            text="Belum ada job. Tekan + untuk membuat, atau ikon awan untuk impor dari CSV."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={COLUMN + space.md}
            decelerationRate="fast"
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: space.lg,
              gap: space.md,
              paddingBottom: space.md,
            }}
          >
            {statuses.map((s) => {
              const list = shown.filter((p) => p.status === s.value);
              return (
                <View key={s.value} style={{ width: COLUMN, flex: 1 }}>
                  <Row style={{ marginBottom: space.sm, gap: 8 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: statusColor(c, s.value),
                      }}
                    />
                    <T variant="heading" style={{ fontSize: 15 }}>
                      {statusLabel(s.value)}
                    </T>
                    <Num size={13} color={c.muted}>
                      {list.length}
                    </Num>
                  </Row>
                  <ScrollView
                    style={{
                      flex: 1,
                      backgroundColor: c.surface,
                      borderRadius: 18,
                    }}
                    contentContainerStyle={{
                      padding: 8,
                      gap: 8,
                      paddingBottom: 96,
                    }}
                    refreshControl={refresh}
                    showsVerticalScrollIndicator={false}
                  >
                    {list.map(card)}
                    {list.length === 0 && (
                      <T
                        variant="small"
                        style={{ textAlign: "center", paddingVertical: 32 }}
                      >
                        Kosong
                      </T>
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        )
      ) : view === "kalender" ? (
        <ScrollView
          refreshControl={refresh}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: 120,
            gap: space.sm,
          }}
        >
          <MonthCalendar
            month={calMonth}
            onMonth={setCalMonth}
            selected={selected}
            onSelect={setSelected}
            marks={marks}
          />
          <Section title={formatDay(selected)} />
          {dayItems.length === 0 ? (
            <T variant="muted">Tidak ada jadwal di tanggal ini.</T>
          ) : (
            dayItems.map((a, i) => agendaCard(a, i, false))
          )}
          {monthItems.length > 0 && (
            <>
              <Section title={`Semua jadwal ${monthName(calMonth)}`} />
              {monthItems.map((a, i) => agendaCard(a, i, true))}
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(a) => a.key}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: 120,
            gap: space.sm,
          }}
          refreshControl={refresh}
          ListEmptyComponent={
            loading ? undefined : (
              <Empty
                icon="calendar-outline"
                text="Tidak ada jadwal ke depan."
              />
            )
          }
          renderItem={({ item, index }) => agendaCard(item, index, true)}
        />
      )}
      <Fab
        onPress={() =>
          router.push({ pathname: "/proyek/form", params: { team: team.id } })
        }
      />
    </Page>
  );
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
