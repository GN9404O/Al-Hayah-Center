import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppSettings } from '../types';

interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ id: docSnap.id, ...docSnap.data() } as AppSettings);
      } else {
        // Initialize default settings if they don't exist
        const defaultSettings = {
          systemName: 'إديو سنتر',
          systemDescription: 'منصة التعلم المتكاملة',
          updatedAt: serverTimestamp()
        };
        // Only attempt to initialize if possible, catch errors if unauthorized
        setDoc(doc(db, 'settings', 'app_config'), defaultSettings).catch(() => {
          // If we can't write, just use default settings locally
          setSettings({ id: 'app_config', ...defaultSettings } as any);
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Settings onSnapshot error:", error);
      setLoading(false);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (settings?.systemName) {
      document.title = settings.systemName;
    }
  }, [settings?.systemName]);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
