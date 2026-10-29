import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { brand, Wordmark } from "../components/brand";
import { useAuth } from "../lib/auth";
import { tap } from "../lib/haptic";
import {
  resetPassword,
  sendPhoneCode,
  signInWithGoogle,
  verifyPhoneCode,
} from "../lib/masuk";
import { supabase } from "../lib/supabase";
import { fonts } from "../lib/theme";

type Mode = "masuk" | "daftar" | "hp" | "kode" | "lupa";

const copy: Record<Mode, { title: string; sub: string }> = {
  masuk: {
    title: "Selamat datang kembali",
    sub: "Masuk untuk lanjut mengelola job-mu",
  },
  daftar: {
    title: "Mulai gratis.",
    sub: "Kelola job, tim, dan keuangan di satu tempat.",
  },
  hp: { title: "Masuk dengan no HP", sub: "Kami kirim kode lewat SMS" },
  kode: { title: "Masukkan kode", sub: "Cek SMS di HP-mu" },
  lupa: {
    title: "Lupa password?",
    sub: "Kami kirim link untuk membuat password baru",
  },
};

export default function Login() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("masuk");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  function go(next: Mode) {
    tap();
    setError(null);
    setInfo(null);
    setMode(next);
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(translate((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  const submit = () =>
    run("utama", async () => {
      if (mode === "masuk") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else if (mode === "daftar") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMode("masuk");
          setInfo("Akun dibuat. Cek email untuk konfirmasi, lalu masuk.");
        }
      } else if (mode === "hp") {
        await sendPhoneCode(phone);
        setMode("kode");
      } else if (mode === "kode") {
        await verifyPhoneCode(phone, code.trim());
      } else {
        await resetPassword(email);
        setMode("masuk");
        setInfo("Link reset sudah dikirim. Buka email-mu.");
      }
    });

  const ready =
    mode === "masuk"
      ? email.includes("@") && password.length >= 6
      : mode === "daftar"
        ? email.includes("@") && password.length >= 6 && name.trim() !== ""
        : mode === "hp"
          ? phone.replace(/\D/g, "").length >= 9
          : mode === "kode"
            ? code.trim().length >= 6
            : email.includes("@");

  const action = {
    masuk: "Masuk",
    daftar: "Daftar",
    hp: "Kirim kode",
    kode: "Verifikasi",
    lupa: "Kirim link reset",
  }[mode];

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Bagian atas bergradasi dengan logo */}
          <LinearGradient
            colors={[brand.heroTop, brand.heroBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: insets.top + 12,
              paddingBottom: 64,
              paddingHorizontal: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 40,
              }}
            >
              {mode !== "masuk" && mode !== "daftar" ? (
                <Pressable
                  onPress={() => go(mode === "kode" ? "hp" : "masuk")}
                  hitSlop={12}
                >
                  <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </Pressable>
              ) : (
                <View />
              )}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: fonts.text,
                    fontSize: 14,
                  }}
                >
                  {mode === "daftar"
                    ? "Sudah punya akun?"
                    : "Belum punya akun?"}
                </Text>
                <Pressable
                  onPress={() => go(mode === "daftar" ? "masuk" : "daftar")}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.16)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: fonts.text,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {mode === "daftar" ? "Masuk" : "Daftar"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <Animated.View
              entering={FadeIn.duration(500)}
              style={{ alignItems: "center", marginTop: 36 }}
            >
              <Wordmark size={40} />
            </Animated.View>
          </LinearGradient>

          {/* Kartu di belakang memberi kesan tumpukan */}
          <View
            style={{
              marginTop: -50,
              marginHorizontal: 22,
              height: 24,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: "rgba(124,92,255,0.35)",
            }}
          />
          <View
            style={{
              flex: 1,
              marginTop: -12,
              backgroundColor: brand.sheet,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 24,
              paddingTop: 32,
              paddingBottom: insets.bottom + 24,
              gap: 14,
            }}
          >
            <Animated.View
              key={mode}
              entering={FadeInDown.duration(300)}
              style={{ alignItems: "center", gap: 6, marginBottom: 10 }}
            >
              <Text
                style={{
                  color: brand.text,
                  fontFamily: fonts.text,
                  fontSize: 26,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {copy[mode].title}
              </Text>
              <Text
                style={{
                  color: brand.muted,
                  fontFamily: fonts.text,
                  fontSize: 15,
                  textAlign: "center",
                }}
              >
                {mode === "kode" ? `Kode dikirim ke ${phone}` : copy[mode].sub}
              </Text>
            </Animated.View>

            {mode === "daftar" && (
              <BrandField
                label="Nama kamu"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            )}
            {(mode === "masuk" || mode === "daftar" || mode === "lupa") && (
              <BrandField
                label="Alamat email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            )}
            {(mode === "masuk" || mode === "daftar") && (
              <PasswordField
                value={password}
                onChangeText={setPassword}
                strength={mode === "daftar"}
              />
            )}
            {mode === "hp" && (
              <BrandField
                label="No HP"
                prefix="+62"
                placeholder="812 3456 7890"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            )}
            {mode === "kode" && (
              <BrandField
                label="Kode 6 digit"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
              />
            )}

            {error && (
              <Text
                style={{
                  color: "#FF7A85",
                  fontFamily: fonts.text,
                  fontSize: 14,
                }}
              >
                {error}
              </Text>
            )}
            {info && (
              <Text
                style={{
                  color: "#5EE3A1",
                  fontFamily: fonts.text,
                  fontSize: 14,
                }}
              >
                {info}
              </Text>
            )}

            <GradientButton
              title={action}
              onPress={submit}
              loading={busy === "utama"}
              disabled={!ready}
            />

            {mode === "masuk" && (
              <Pressable
                onPress={() => go("lupa")}
                style={{ alignSelf: "center", padding: 6 }}
              >
                <Text
                  style={{
                    color: brand.muted,
                    fontFamily: fonts.text,
                    fontSize: 15,
                  }}
                >
                  Lupa password?
                </Text>
              </Pressable>
            )}
            {mode === "kode" && (
              <Pressable
                onPress={() => run("utama", () => sendPhoneCode(phone))}
                style={{ alignSelf: "center", padding: 6 }}
              >
                <Text
                  style={{
                    color: brand.muted,
                    fontFamily: fonts.text,
                    fontSize: 15,
                  }}
                >
                  Kirim ulang kode
                </Text>
              </Pressable>
            )}

            {(mode === "masuk" || mode === "daftar") && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: brand.border,
                    }}
                  />
                  <Text
                    style={{
                      color: brand.muted,
                      fontFamily: fonts.text,
                      fontSize: 13,
                    }}
                  >
                    {mode === "daftar"
                      ? "Atau daftar dengan"
                      : "Atau masuk dengan"}
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: brand.border,
                    }}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <SocialButton
                    label="Google"
                    icon={<GoogleIcon />}
                    loading={busy === "google"}
                    onPress={() => run("google", signInWithGoogle)}
                  />
                  <SocialButton
                    label="No HP"
                    icon={
                      <Ionicons
                        name="phone-portrait-outline"
                        size={20}
                        color={brand.text}
                      />
                    }
                    onPress={() => go("hp")}
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Pesan error Supabase yang sering muncul, dalam Bahasa Indonesia
function translate(msg: string) {
  if (/invalid login credentials/i.test(msg))
    return "Email atau password salah.";
  if (/email not confirmed/i.test(msg))
    return "Email belum dikonfirmasi. Cek kotak masuk email-mu.";
  if (/already registered/i.test(msg))
    return "Email ini sudah terdaftar. Silakan masuk.";
  if (/provider is not enabled|unsupported provider/i.test(msg))
    return "Metode login ini belum diaktifkan di Supabase.";
  if (/sms|phone/i.test(msg) && /provider|disabled|unsupported/i.test(msg))
    return "Login no HP belum diaktifkan. Perlu mengatur penyedia SMS di Supabase.";
  if (/token has expired|invalid/i.test(msg) && /otp|token/i.test(msg))
    return "Kode salah atau sudah kedaluwarsa.";
  return msg;
}

function BrandField({
  label,
  prefix,
  right,
  style,
  ...props
}: TextInputProps & { label: string; prefix?: string; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  return (
    <View
      style={{
        backgroundColor: brand.field,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: focus ? brand.violet : brand.border,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: brand.muted, fontFamily: fonts.text, fontSize: 12 }}
        >
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {prefix && (
            <Text
              style={{
                color: brand.text,
                fontFamily: fonts.text,
                fontSize: 16,
              }}
            >
              {prefix}
            </Text>
          )}
          <TextInput
            placeholderTextColor="#555A6E"
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            style={[
              {
                flex: 1,
                color: brand.text,
                fontFamily: fonts.text,
                fontSize: 16,
                paddingVertical: 4,
              },
              style,
            ]}
            {...props}
          />
        </View>
      </View>
      {right}
    </View>
  );
}

function PasswordField({
  value,
  onChangeText,
  strength,
}: {
  value: string;
  onChangeText: (s: string) => void;
  strength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const score = [
    value.length >= 8,
    /[A-Z]/.test(value) && /[a-z]/.test(value),
    /\d|[^A-Za-z]/.test(value),
  ].filter(Boolean).length;
  const label = ["Lemah", "Lemah", "Sedang", "Kuat"][score];
  const color = ["#FF7A85", "#FF7A85", "#F5B544", "#5EE3A1"][score];
  return (
    <BrandField
      label="Password"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!show}
      autoComplete="password"
      autoCapitalize="none"
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {strength && value.length > 0 && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 14,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor:
                      i <= Math.max(score, 1) ? color : brand.border,
                  }}
                />
              ))}
              <Text
                style={{
                  color,
                  fontFamily: fonts.text,
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                {label}
              </Text>
            </View>
          )}
          <Pressable onPress={() => setShow(!show)} hitSlop={10}>
            <Ionicons
              name={show ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={brand.muted}
            />
          </Pressable>
        </View>
      }
    />
  );
}

function GradientButton({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <LinearGradient
        colors={[brand.indigo, brand.violet, brand.pink]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 14, paddingVertical: 17, alignItems: "center" }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            style={{
              color: "#FFFFFF",
              fontFamily: fonts.text,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function SocialButton({
  label,
  icon,
  onPress,
  loading,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: brand.border,
        backgroundColor: pressed ? brand.field : "transparent",
      })}
    >
      {loading ? <ActivityIndicator color={brand.text} /> : icon}
      <Text
        style={{
          color: brand.text,
          fontFamily: fonts.text,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}
