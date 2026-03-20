import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { light, dark } from '../theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState(null);

  useEffect(() => {
    SecureStore.getItemAsync('theme').then(v => { if (v) setMode(v); }).catch(() => {});
  }, []);

  const isDark = mode ? mode === 'dark' : systemScheme === 'dark';
  const theme = isDark ? dark : light;

  const toggleTheme = async () => {
    const next = isDark ? 'light' : 'dark';
    setMode(next);
    await SecureStore.setItemAsync('theme', next);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
