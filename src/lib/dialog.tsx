import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, View, type AlertButton } from 'react-native';

import { T } from '../components/ui';
import { radius, space, useColors } from './theme';

type Dialog = { title: string; message?: string; buttons: AlertButton[] };

let show: ((d: Dialog | null) => void) | null = null;

// Pengganti Alert.alert yang juga jalan di web (Alert bawaan tidak muncul di browser)
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);
  show?.({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

// Dipasang sekali di layout utama
export function DialogHost() {
  const c = useColors();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  useEffect(() => {
    show = setDialog;
    return () => {
      show = null;
    };
  }, []);

  if (Platform.OS !== 'web' || !dialog) return null;

  const close = (b?: AlertButton) => {
    setDialog(null);
    b?.onPress?.();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={() => close()}>
      <Pressable
        onPress={() => close()}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: space.lg }}
      >
        <Pressable style={{ backgroundColor: c.bg, borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
          <T variant="heading" style={{ textAlign: 'center' }}>
            {dialog.title}
          </T>
          {dialog.message ? (
            <T variant="muted" style={{ textAlign: 'center' }}>
              {dialog.message}
            </T>
          ) : null}
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {dialog.buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => close(b)}
                style={{
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: b.style === 'destructive' ? c.expenseSoft : c.surface,
                }}
              >
                <T
                  color={b.style === 'destructive' ? c.expense : b.style === 'cancel' ? c.muted : c.text}
                  style={{ fontWeight: '600' }}
                >
                  {b.text}
                </T>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
