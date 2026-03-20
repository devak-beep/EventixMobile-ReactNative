import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing } from '../theme';

function SkeletonBox({ width, height, style }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [theme.skeleton, theme.skeletonHighlight] });

  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: bg }, style]} />;
}

export function EventCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <SkeletonBox width="100%" height={160} style={{ borderRadius: 0 }} />
      <View style={styles.body}>
        <SkeletonBox width="70%" height={18} style={{ marginBottom: spacing.sm }} />
        <SkeletonBox width="45%" height={14} style={{ marginBottom: spacing.sm }} />
        <SkeletonBox width="90%" height={12} style={{ marginBottom: spacing.xs }} />
        <SkeletonBox width="80%" height={12} style={{ marginBottom: spacing.md }} />
        <View style={styles.row}>
          <SkeletonBox width={60} height={20} />
          <SkeletonBox width={80} height={14} />
        </View>
      </View>
    </View>
  );
}

export function BookingCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: spacing.md }]}>
      <View style={styles.row}>
        <SkeletonBox width="55%" height={18} />
        <SkeletonBox width={80} height={22} style={{ borderRadius: radius.full }} />
      </View>
      <SkeletonBox width="40%" height={13} style={{ marginTop: spacing.sm }} />
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <SkeletonBox width={70} height={13} />
        <SkeletonBox width={50} height={13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, marginBottom: spacing.md },
  body: { padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
