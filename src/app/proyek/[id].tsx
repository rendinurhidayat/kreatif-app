import { Ionicons } from "@expo/vector-icons";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";

import {
  Button,
  Card,
  Chips,
  Empty,
  ErrorText,
  FadeIn,
  Form,
  IconButton,
  Num,
  Row,
  Section,
  SwipeRow,
  T,
} from "../../components/ui";
import { tap, warn } from "../../lib/haptic";
import { formatDate, today } from "../../lib/keuangan";
import {
  calendarLink,
  callPhone,
  formatTime,
  mapsLink,
  openWhatsApp,
} from "../../lib/kontak";
import {
  kindLabel,
  loadMembers,
  statuses,
  type Member,
  type Project,
  type Status,
  type Task,
} from "../../lib/proyek";
import { supabase } from "../../lib/supabase";
import { space, useColors } from "../../lib/theme";
import { showAlert } from "../../lib/dialog";

export default function ProyekDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: p, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !p) {
      setError(error?.message ?? "Proyek tidak ditemukan.");
      return;
    }
    setProject(p as Project);
    const [{ data: t }, m] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("done")
        .order("due_date", { nullsFirst: false }),
      loadMembers(p.team_id),
    ]);
    setTasks((t as Task[]) ?? []);
    setMembers(m);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!project) {
    return (
      <Form>
        <ErrorText>{error}</ErrorText>
      </Form>
    );
  }

  const memberName = (uid: string | null) =>
    members.find((m) => m.user_id === uid)?.full_name || null;

  async function setStatus(value: Status) {
    setProject({ ...project!, status: value });
    await supabase.from("projects").update({ status: value }).eq("id", id);
  }

  async function toggle(t: Task) {
    tap();
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id);
  }

  function removeTask(t: Task) {
    warn();
    showAlert("Hapus tugas?", t.title, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setTasks(tasks.filter((x) => x.id !== t.id));
          await supabase.from("tasks").delete().eq("id", t.id);
        },
      },
    ]);
  }

  const links = (project.links ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const doneCount = tasks.filter((t) => t.done).length;
  const now = today();

  const maps = mapsLink(project.location, project.maps_url);

  return (
    <Form>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ marginRight: Platform.OS === "web" ? space.lg : 0 }}>
              <IconButton
                name="create-outline"
                onPress={() =>
                  router.push({ pathname: "/proyek/form", params: { id } })
                }
              />
            </View>
          ),
        }}
      />
      <View style={{ gap: 4 }}>
        <T variant="title">{project.title}</T>
        <T variant="muted">
          {[project.client, kindLabel(project.kind)]
            .filter(Boolean)
            .join(" · ")}
        </T>
      </View>

      {(project.shoot_date || project.deadline) && (
        <Row style={{ alignItems: "stretch" }}>
          {project.shoot_date && (
            <Card style={{ flex: 1 }} tone={c.pastelBlue}>
              <T variant="small">Shooting</T>
              <Num size={16} weight="bold">
                {formatDate(project.shoot_date)}
              </Num>
              {project.shoot_time && (
                <T variant="small" color={c.text}>
                  {formatTime(project.shoot_time)}
                  {project.shoot_end
                    ? `–${formatTime(project.shoot_end)}`
                    : ""}{" "}
                  WIB
                </T>
              )}
              <CalendarLink url={calendarLink(project, "shooting")} />
            </Card>
          )}
          {project.deadline && (
            <Card style={{ flex: 1 }} tone={c.pastelPlum}>
              <T variant="small">Deadline</T>
              <Num
                size={16}
                weight="bold"
                color={
                  project.deadline < now && project.status !== "lunas"
                    ? c.expense
                    : undefined
                }
              >
                {formatDate(project.deadline)}
              </Num>
              <CalendarLink url={calendarLink(project, "deadline")} />
            </Card>
          )}
        </Row>
      )}

      {(project.client || project.client_phone) && (
        <Card style={{ gap: space.md }}>
          <Row>
            <Ionicons name="person-circle-outline" size={22} color={c.muted} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "600" }}>{project.client || "Klien"}</T>
              {project.client_phone && (
                <T variant="small">{project.client_phone}</T>
              )}
            </View>
          </Row>
          {project.client_phone && (
            <Row>
              <View style={{ flex: 1 }}>
                <Button
                  title="Telepon"
                  variant="secondary"
                  icon="call-outline"
                  onPress={() => callPhone(project.client_phone!)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="WhatsApp"
                  variant="accent"
                  icon="logo-whatsapp"
                  onPress={() =>
                    openWhatsApp(
                      project.client_phone!,
                      `Halo ${project.client ?? ""}, terkait ${project.title}: `,
                    )
                  }
                />
              </View>
            </Row>
          )}
        </Card>
      )}

      {maps && (
        <Card onPress={() => Linking.openURL(maps)}>
          <Row>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: c.pastelTeal,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="location" size={20} color={c.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "600" }} numberOfLines={2}>
                {project.location || "Lokasi"}
              </T>
              <T variant="small">Buka di Google Maps</T>
            </View>
            <Ionicons name="open-outline" size={18} color={c.muted} />
          </Row>
        </Card>
      )}

      <Section title="Tahapan" />
      <Chips options={statuses} value={project.status} onChange={setStatus} />

      <Section
        title={`Tugas ${tasks.length ? `${doneCount}/${tasks.length}` : ""}`}
        action={
          <IconButton
            name="add"
            label="Tugas"
            onPress={() =>
              router.push({
                pathname: "/proyek/tugas",
                params: { project: id, team: project.team_id },
              })
            }
          />
        }
      />
      {tasks.length === 0 && (
        <Empty icon="checkbox-outline" text="Belum ada tugas." />
      )}
      {tasks.length > 0 && (
        <View
          style={{
            height: 6,
            backgroundColor: c.surface,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${(doneCount / tasks.length) * 100}%`,
              height: "100%",
              backgroundColor: c.income,
              borderRadius: 3,
            }}
          />
        </View>
      )}
      {tasks.map((t, i) => {
        const late = !t.done && t.due_date !== null && t.due_date < now;
        return (
          <FadeIn key={t.id} index={i}>
            <SwipeRow
              left={{
                label: t.done ? "Buka" : "Selesai",
                icon: t.done ? "arrow-undo-outline" : "checkmark",
                color: c.income,
                onPress: () => toggle(t),
              }}
              right={{
                label: "Hapus",
                icon: "trash-outline",
                color: c.expense,
                onPress: () => removeTask(t),
              }}
            >
              <Row
                style={{
                  gap: space.md,
                  paddingVertical: 10,
                  backgroundColor: c.bg,
                }}
              >
                <Pressable onPress={() => toggle(t)} hitSlop={10}>
                  <Ionicons
                    name={t.done ? "checkmark-circle" : "ellipse-outline"}
                    size={26}
                    color={t.done ? c.income : c.muted}
                  />
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({
                      pathname: "/proyek/tugas",
                      params: { id: t.id, project: id, team: project.team_id },
                    })
                  }
                >
                  <T
                    style={
                      t.done
                        ? { textDecorationLine: "line-through", color: c.muted }
                        : undefined
                    }
                  >
                    {t.title}
                  </T>
                  {(t.assignee || t.due_date) && (
                    <T variant="small" color={late ? c.expense : undefined}>
                      {[
                        memberName(t.assignee),
                        t.due_date && formatDate(t.due_date),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </T>
                  )}
                </Pressable>
              </Row>
            </SwipeRow>
          </FadeIn>
        );
      })}

      {links.length > 0 && <Section title="File" />}
      {links.map((l) => (
        <Card
          key={l}
          onPress={() =>
            Linking.openURL(l.startsWith("http") ? l : `https://${l}`)
          }
        >
          <Row>
            <Ionicons name="link-outline" size={18} color={c.text} />
            <T numberOfLines={1} style={{ flex: 1 }}>
              {l.replace(/^https?:\/\//, "")}
            </T>
          </Row>
        </Card>
      ))}

      {project.notes && (
        <>
          <Section title="Catatan" />
          <T>{project.notes}</T>
        </>
      )}

      <View style={{ marginTop: space.lg }}>
        <Button
          title="Buat invoice"
          icon="document-text-outline"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/invoice/form", params: { project: id } })
          }
        />
      </View>
    </Form>
  );
}

// Tombol kecil "+ Google Calendar" di kartu tanggal
function CalendarLink({ url }: { url: string | null }) {
  const c = useColors();
  if (!url) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      hitSlop={8}
      style={{ marginTop: 6 }}
    >
      <Row style={{ gap: 4 }}>
        <Ionicons name="add-circle-outline" size={15} color={c.accent} />
        <T variant="small" color={c.accent} style={{ fontWeight: "600" }}>
          Google Calendar
        </T>
      </Row>
    </Pressable>
  );
}
