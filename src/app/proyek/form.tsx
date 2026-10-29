import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, View } from "react-native";

import {
  Button,
  Chips,
  DateField,
  ErrorText,
  Field,
  Form,
  FormSection,
  T,
  TimeField,
  type IconName,
} from "../../components/ui";
import { success, tap } from "../../lib/haptic";
import { mapsLink } from "../../lib/kontak";
import { kinds, statuses, type Kind, type Status } from "../../lib/proyek";
import { supabase } from "../../lib/supabase";
import { radius, space, useColors } from "../../lib/theme";
import { showAlert } from "../../lib/dialog";

export default function ProyekForm() {
  const params = useLocalSearchParams<{ id?: string; team?: string }>();
  const editing = !!params.id;
  const [teamId, setTeamId] = useState(params.team ?? "");
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [kind, setKind] = useState<Kind>("video");
  const [status, setStatus] = useState<Status>("brief");
  const [shootDate, setShootDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [location, setLocation] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [shootTime, setShootTime] = useState("");
  const [shootEnd, setShootEnd] = useState("");
  const [links, setLinks] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = useColors();

  useEffect(() => {
    if (!params.id) return;
    supabase
      .from("projects")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data: p }) => {
        if (!p) return;
        setTeamId(p.team_id);
        setTitle(p.title);
        setClient(p.client ?? "");
        setKind(p.kind);
        setStatus(p.status);
        setShootDate(p.shoot_date ?? "");
        setDeadline(p.deadline ?? "");
        setClientPhone(p.client_phone ?? "");
        setLocation(p.location ?? "");
        setMapsUrl(p.maps_url ?? "");
        setShootTime(p.shoot_time?.slice(0, 5) ?? "");
        setShootEnd(p.shoot_end?.slice(0, 5) ?? "");
        setLinks(p.links ?? "");
        setNotes(p.notes ?? "");
      });
  }, [params.id]);

  async function save() {
    setBusy(true);
    const row = {
      team_id: teamId,
      title: title.trim(),
      client: client.trim() || null,
      kind,
      status,
      shoot_date: shootDate || null,
      deadline: deadline || null,
      links: links.trim() || null,
      notes: notes.trim() || null,
      client_phone: clientPhone.trim() || null,
      location: location.trim() || null,
      maps_url: mapsUrl.trim() || null,
      shoot_time: shootTime || null,
      shoot_end: shootEnd || null,
    };
    if (editing) {
      const { error } = await supabase
        .from("projects")
        .update(row)
        .eq("id", params.id!);
      setBusy(false);
      if (error) return setError(error.message);
      success();
      router.back();
    } else {
      const { data, error } = await supabase
        .from("projects")
        .insert(row)
        .select("id")
        .single();
      setBusy(false);
      if (error) return setError(error.message);
      success();
      router.replace(`/proyek/${data.id}`);
    }
  }

  function remove() {
    showAlert("Hapus job?", "Semua tugas di job ini ikut terhapus.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await supabase.from("projects").delete().eq("id", params.id!);
          router.dismissAll();
        },
      },
    ]);
  }

  const kindIcon: Record<Kind, IconName> = {
    video: "videocam-outline",
    foto: "camera-outline",
    editing: "cut-outline",
    lainnya: "ellipsis-horizontal",
  };

  const maps = mapsLink(location.trim() || null, mapsUrl.trim() || null);

  return (
    <Form>
      <FormSection icon="briefcase-outline" title="Info job">
        <Field
          label="Nama job"
          placeholder="Misal: Prewedding Andi dan Sari"
          value={title}
          onChangeText={setTitle}
        />
        <T variant="label">Jenis</T>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {kinds.map((k) => {
            const active = k.value === kind;
            return (
              <Pressable
                key={k.value}
                onPress={() => {
                  tap();
                  setKind(k.value);
                }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  backgroundColor: active ? c.primary : c.surface,
                }}
              >
                <Ionicons
                  name={kindIcon[k.value]}
                  size={22}
                  color={active ? c.onPrimary : c.muted}
                />
                <T
                  variant="small"
                  color={active ? c.onPrimary : c.text}
                  numberOfLines={1}
                >
                  {k.label}
                </T>
              </Pressable>
            );
          })}
        </View>
        <T variant="label">Tahapan</T>
        <Chips options={statuses} value={status} onChange={setStatus} />
      </FormSection>

      <FormSection
        icon="person-outline"
        title="Klien"
        hint="Tim bisa langsung telepon atau WhatsApp klien"
      >
        <Field
          label="Nama klien"
          placeholder="Opsional"
          value={client}
          onChangeText={setClient}
        />
        <Field
          label="No HP / WhatsApp"
          placeholder="0812 3456 7890"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={clientPhone}
          onChangeText={setClientPhone}
        />
      </FormSection>

      <FormSection
        icon="location-outline"
        title="Lokasi"
        hint="Tersambung ke Google Maps"
      >
        <Field
          label="Tempat atau alamat"
          placeholder="Misal: Gedung Sate, Bandung"
          value={location}
          onChangeText={setLocation}
        />
        <Field
          label="Link Google Maps (opsional)"
          placeholder="Tempel link dari tombol Bagikan di Google Maps"
          autoCapitalize="none"
          keyboardType="url"
          value={mapsUrl}
          onChangeText={setMapsUrl}
        />
        {maps && (
          <Button
            title="Cek di Google Maps"
            variant="secondary"
            icon="map-outline"
            onPress={() => Linking.openURL(maps)}
          />
        )}
      </FormSection>

      <FormSection
        icon="calendar-outline"
        title="Jadwal"
        hint="Bisa ditambahkan ke Google Calendar dari halaman job"
      >
        <DateField
          label="Tanggal shooting"
          value={shootDate}
          onChange={setShootDate}
          optional
        />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <TimeField label="Mulai" value={shootTime} onChange={setShootTime} />
          <TimeField label="Selesai" value={shootEnd} onChange={setShootEnd} />
        </View>
        <DateField
          label="Deadline"
          value={deadline}
          onChange={setDeadline}
          optional
        />
      </FormSection>

      <FormSection icon="document-text-outline" title="File dan catatan">
        <Field
          label="Link file (satu per baris)"
          placeholder="Google Drive, Frame.io, WeTransfer"
          autoCapitalize="none"
          multiline
          value={links}
          onChangeText={setLinks}
        />
        <Field
          label="Catatan"
          placeholder="Brief, kebutuhan alat, kru"
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </FormSection>

      <ErrorText>{error}</ErrorText>
      <Button
        title={editing ? "Simpan perubahan" : "Buat job"}
        onPress={save}
        loading={busy}
        disabled={title.trim() === ""}
      />
      {editing && (
        <Button title="Hapus job" variant="danger" onPress={remove} />
      )}
    </Form>
  );
}
