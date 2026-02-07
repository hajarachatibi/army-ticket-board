"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/AuthContext";
import { ChatProvider } from "@/lib/ChatContext";
import { NotificationProvider } from "@/lib/NotificationContext";
import { RequestProvider } from "@/lib/RequestContext";
import { ThemeProvider } from "@/lib/ThemeContext";

import AppVersionChecker from "@/components/AppVersionChecker";
import ChatModal from "@/components/ChatModal";
import SyncDbNotifications from "@/components/SyncDbNotifications";
import SyncPendingNotifications from "@/components/SyncPendingNotifications";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <RequestProvider>
            <ChatProvider>
              <SyncPendingNotifications />
              <SyncDbNotifications />
              <AppVersionChecker />
              {children}
              <ChatModal />
            </ChatProvider>
          </RequestProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
