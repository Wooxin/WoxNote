import React, { createContext, useContext } from "react";
import type { Messages } from "../i18n";
import { messages } from "../i18n";
import { useSettings } from "../hooks/useSettings";

export type AppContextType = ReturnType<typeof useSettings> & {
  t: Messages;
};

const AppCtx = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const t = messages[settings.language];

  return (
    <AppCtx.Provider value={{ ...settings, t }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}