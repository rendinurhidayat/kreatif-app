import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { tap } from "../lib/haptic";
import { monthName, shiftMonth, today } from "../lib/keuangan";
import { fonts, radius, space, useColors } from "../lib/theme";
import { T } from "./ui";

export type DayMark = { shoot?: boolean; deadline?: boolean; late?: boolean };

const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// Kalender satu bulan, minggu dimulai Senin. Titik biru = shooting, titik ungu/merah = deadline.
export function MonthCalendar({
  month,
  onMonth,
  selected,
  onSelect,
  marks,
}: {
  month: string; // TTTT-BB
  onMonth: (m: string) => void;
  selected: string;
  onSelect: (iso: string) => void;
  marks: Record<string, DayMark>;
}) {
  const c = useColors();
  const now = today();
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
  while (cells.length % 7) cells.push(null);

  const nav = (n: number) => {
    tap();
    onMonth(shiftMonth(month, n));
  };

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable onPress={() => nav(-1)} hitSlop={10} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            onMonth(now.slice(0, 7));
            onSelect(now);
          }}
        >
          <T variant="heading" style={{ fontSize: 16 }}>
            {monthName(month)}
          </T>
        </Pressable>
        <Pressable onPress={() => nav(1)} hitSlop={10} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {days.map((d) => (
          <Text
            key={d}
            style={{
              flex: 1,
              textAlign: "center",
              color: c.muted,
              fontFamily: fonts.text,
              fontSize: 12,
            }}
          >
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((iso, i) => {
            if (!iso) return <View key={i} style={{ flex: 1, height: 46 }} />;
            const active = iso === selected;
            const isToday = iso === now;
            const mark = marks[iso];
            return (
              <Pressable
                key={iso}
                onPress={() => {
                  tap();
                  onSelect(iso);
                }}
                style={{
                  flex: 1,
                  height: 46,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? c.accent : "transparent",
                    borderWidth: isToday && !active ? 1.5 : 0,
                    borderColor: c.accent,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: active ? fonts.numBold : fonts.num,
                      fontSize: 14,
                      color: active ? "#FFFFFF" : c.text,
                    }}
                  >
                    {Number(iso.slice(8))}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 3,
                    height: 5,
                    marginTop: 1,
                  }}
                >
                  {mark?.shoot && (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: c.accent,
                      }}
                    />
                  )}
                  {mark?.deadline && (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: mark.late ? c.expense : c.plum,
                      }}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View
        style={{
          flexDirection: "row",
          gap: space.lg,
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        <Legend color={c.accent} label="Shooting" />
        <Legend color={c.plum} label="Deadline" />
        <Legend color={c.expense} label="Terlambat" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
      />
      <T variant="small">{label}</T>
    </View>
  );
}
