import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Row, SafeTop, T } from '../components/ui';
import { tap } from '../lib/haptic';
import { supabase } from '../lib/supabase';
import { fonts, radius, space, useColors } from '../lib/theme';

type Msg = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  'Proyek apa yang deadline minggu ini?',
  'Berapa laba bisnis bulan ini?',
  'Invoice mana yang belum dibayar?',
  'Buatkan pesan tagihan sopan untuk klien',
];

export default function Asisten() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Msg>>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(content: string) {
    const question = content.trim();
    if (!question || busy) return;
    tap();
    const next: Msg[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setText('');
    setError(null);
    setBusy(true);
    let data: { reply?: string; error?: string } | null = null;
    let reason: string | undefined;
    try {
      const res = await supabase.functions.invoke<{ reply?: string; error?: string }>('asisten', {
        body: { messages: next },
        timeout: 60000,
      });
      data = res.data;
      reason = data?.error;
      if (res.error) {
        // Pesan error dari fungsi ada di body respons
        const status = (res.error as { context?: Response }).context?.status;
        const body = await (res.error as { context?: Response }).context?.json?.().catch(() => null);
        reason =
          body?.error ??
          (status === 404
            ? 'Fungsi "asisten" belum ada di Supabase. Deploy dulu lewat Edge Functions.'
            : `Asisten error${status ? ` ${status}` : ''}: ${res.error.message}`);
      }
    } catch (e) {
      reason = `Tidak ada respons dari asisten (${(e as Error).message}). Cek koneksi atau log fungsi di Supabase.`;
    } finally {
      setBusy(false);
    }
    if (reason || !data?.reply) {
      setError(reason ?? 'Tidak ada jawaban.');
      setMessages(messages);
      setText(question);
      return;
    }
    setMessages([...next, { role: 'assistant', content: data.reply.replace(/\*\*/g, '') }]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeTop />
      <Row style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: c.border }}>
        <IconButton name="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1 }}>
          <T variant="heading">Asisten AI</T>
          <T variant="small">Tanya soal proyek, keuangan, atau minta ide</T>
        </View>
        {messages.length > 0 && <IconButton name="refresh" onPress={() => setMessages([])} />}
      </Row>

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: c.pastelIndigo,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
              }}
            >
              <Ionicons name="sparkles" size={28} color={c.indigo} />
            </View>
            <T variant="muted" style={{ textAlign: 'center', marginBottom: space.sm }}>
              Asisten membaca data proyek dan keuanganmu untuk menjawab. Coba salah satu:
            </T>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg }}
              >
                <T>{s}</T>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: mine ? c.accent : c.surface,
                borderRadius: radius.lg,
                borderBottomRightRadius: mine ? 6 : radius.lg,
                borderBottomLeftRadius: mine ? radius.lg : 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <T color={mine ? '#FFFFFF' : c.text} style={{ lineHeight: 22 }}>
                {item.content}
              </T>
            </Animated.View>
          );
        }}
        ListFooterComponent={
          <>
            {busy && (
              <Row style={{ marginTop: space.md }}>
                <ActivityIndicator color={c.accent} />
                <T variant="small">Sedang berpikir...</T>
              </Row>
            )}
            {error && (
              <T color={c.expense} style={{ marginTop: space.md }}>
                {error}
              </T>
            )}
          </>
        }
      />

      <Row
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: Math.max(insets.bottom, space.md),
          borderTopWidth: 0.5,
          borderTopColor: c.border,
          alignItems: 'flex-end',
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Tulis pertanyaan..."
          placeholderTextColor={c.muted}
          multiline
          style={{
            flex: 1,
            maxHeight: 120,
            fontFamily: fonts.text,
            fontSize: 16,
            color: c.text,
            backgroundColor: c.surface,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 11,
            paddingBottom: 11,
          }}
        />
        <Pressable
          onPress={() => send(text)}
          disabled={busy || text.trim() === ''}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: busy || text.trim() === '' ? c.surface : c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-up" size={22} color={busy || text.trim() === '' ? c.muted : '#FFFFFF'} />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}
