import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

// Pulsing glow border — clean mobile equivalent of the website tracing animation
export default function TracingBorder({ color = '#38bdf8' }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(56,189,248,0.2)', 'rgba(56,189,248,0.9)'] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.6] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor,
          shadowColor: color,
          shadowOpacity,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
        },
      ]}
    />
  );
}
