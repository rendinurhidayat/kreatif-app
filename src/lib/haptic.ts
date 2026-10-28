import * as Haptics from 'expo-haptics';

// Getaran halus sebagai umpan balik; diabaikan bila perangkat tidak mendukung
export const tap = () => Haptics.selectionAsync().catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const warn = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
