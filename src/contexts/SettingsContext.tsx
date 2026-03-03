import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppSettings {
  defaultSeatGap: number;
  defaultTableGap: number;
  defaultRowGap: number;
  enableDragging: boolean;
  showReferenceObjects: boolean;
}

const STORAGE_KEY = 'teachmate_settings';

const defaultSettings: AppSettings = {
  defaultSeatGap: 10,
  defaultTableGap: 20,
  defaultRowGap: 20,
  enableDragging: true,
  showReferenceObjects: true,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

interface SettingsContextType {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const setSettings = (partial: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}