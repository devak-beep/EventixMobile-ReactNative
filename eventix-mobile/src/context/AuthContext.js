import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getUserById } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          // refresh from API
          getUserById(parsed._id)
            .then(res => { setUser(res.data); SecureStore.setItemAsync('user', JSON.stringify(res.data)); })
            .catch(() => {});
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const login = async (userData) => {
    setUser(userData);
    await SecureStore.setItemAsync('user', JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    await SecureStore.deleteItemAsync('user');
  };

  const updateUser = async (userData) => {
    setUser(userData);
    await SecureStore.setItemAsync('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
