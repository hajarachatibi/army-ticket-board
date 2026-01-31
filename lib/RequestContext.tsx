"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchRequestsForTicket as fetchRequestsForTicketApi,
  insertRequest,
  updateRequestStatus,
} from "@/lib/supabase/requests";

export type RequestStatus = "pending" | "accepted" | "rejected" | "closed";

export type Request = {
  id: string;
  ticketId: string;
  requesterId: string;
  requesterUsername: string;
  status: RequestStatus;
  acceptedBy: string | null;
  createdAt: number;
  event: string;
  seatPreference: string;
};

type RequestContextValue = {
  requestsByTicket: Record<string, Request[]>;
  fetchRequestsForTicket: (ticketId: string) => Promise<void>;
  fetchRequestsForTickets: (ticketIds: string[]) => Promise<void>;
  addRequest: (
    ticketId: string,
    requesterId: string,
    requesterUsername: string,
    event?: string | null,
    seatPreference?: string | null,
    options?: { status?: "accepted"; acceptedBy?: string },
    turnstileToken?: string | null
  ) => Promise<Request | null>;
  updateStatus: (
    requestId: string,
    status: "accepted" | "rejected" | "closed",
    acceptedBy?: string,
    ticketIdHint?: string
  ) => Promise<void>;
  closeRequest: (requestId: string, ticketIdHint?: string) => Promise<void>;
  reopenRequest: (requestId: string, acceptedBy: string, ticketIdHint?: string) => Promise<void>;
  getRequestsForTicket: (ticketId: string) => Request[];
  getAcceptedOpenRequestForTicket: (ticketId: string) => Request | null;
  canUserChat: (ticketId: string, userId: string, ownerId: string | null) => boolean;
};

const RequestContext = createContext<RequestContextValue | null>(null);

export function RequestProvider({ children }: { children: ReactNode }) {
  const [requestsByTicket, setRequestsByTicket] = useState<Record<string, Request[]>>({});

  const fetchRequestsForTicket = useCallback(async (ticketId: string) => {
    const { data, error } = await fetchRequestsForTicketApi(ticketId);
    if (error) {
      if (process.env.NODE_ENV === "development") console.error("[RequestContext] fetchRequestsForTicket:", error);
      return;
    }
    setRequestsByTicket((prev) => ({ ...prev, [ticketId]: data }));
  }, []);

  const fetchRequestsForTickets = useCallback(async (ticketIds: string[]) => {
    const uniq = [...new Set(ticketIds)];
    const next: Record<string, Request[]> = {};
    await Promise.all(
      uniq.map(async (id) => {
        const { data } = await fetchRequestsForTicketApi(id);
        next[id] = data;
      })
    );
    setRequestsByTicket((prev) => ({ ...prev, ...next }));
  }, []);

  const addRequest = useCallback(
    async (
      ticketId: string,
      requesterId: string,
      requesterUsername: string,
      event?: string | null,
      seatPreference?: string | null,
      options?: { status?: "accepted"; acceptedBy?: string },
      turnstileToken?: string | null
    ): Promise<Request | null> => {
      const { data, error } = await insertRequest({
        ticketId,
        requesterId,
        requesterUsername,
        event: event ?? "—",
        seatPreference: seatPreference ?? "—",
        status: options?.status,
        acceptedBy: options?.acceptedBy,
        turnstileToken: turnstileToken ?? null,
      });
      if (error) {
        if (process.env.NODE_ENV === "development") console.error("[RequestContext] addRequest:", error);
        return null;
      }
      if (data) {
        setRequestsByTicket((prev) => ({
          ...prev,
          [ticketId]: [data, ...(prev[ticketId] ?? [])],
        }));
        return data;
      }
      return null;
    },
    []
  );

  const updateStatus = useCallback(
    async (
      requestId: string,
      status: "accepted" | "rejected" | "closed",
      acceptedBy?: string,
      ticketIdHint?: string
    ) => {
      let ticketId = ticketIdHint ?? null;
      if (!ticketId) {
        for (const tid of Object.keys(requestsByTicket)) {
          if (requestsByTicket[tid].some((r) => r.id === requestId)) {
            ticketId = tid;
            break;
          }
        }
      }
      const { error } = await updateRequestStatus(requestId, status, acceptedBy);
      if (error) {
        if (process.env.NODE_ENV === "development") console.error("[RequestContext] updateStatus:", error);
        return;
      }
      if (ticketId) await fetchRequestsForTicket(ticketId);
    },
    [fetchRequestsForTicket, requestsByTicket]
  );

  const closeRequest = useCallback(
    async (requestId: string, ticketIdHint?: string) => {
      await updateStatus(requestId, "closed", undefined, ticketIdHint);
    },
    [updateStatus]
  );

  const reopenRequest = useCallback(
    async (requestId: string, acceptedBy: string, ticketIdHint?: string) => {
      await updateStatus(requestId, "accepted", acceptedBy, ticketIdHint);
    },
    [updateStatus]
  );

  const getRequestsForTicket = useCallback(
    (ticketId: string): Request[] => {
      const list = requestsByTicket[ticketId] ?? [];
      return [...list].sort((a, b) => b.createdAt - a.createdAt);
    },
    [requestsByTicket]
  );

  const getAcceptedOpenRequestForTicket = useCallback(
    (ticketId: string): Request | null => {
      const list = requestsByTicket[ticketId] ?? [];
      return list.find((r) => r.status === "accepted") ?? null;
    },
    [requestsByTicket]
  );

  const canUserChat = useCallback(
    (ticketId: string, userId: string, ownerId: string | null): boolean => {
      const list = requestsByTicket[ticketId] ?? [];
      return list.some(
        (r) =>
          r.status === "accepted" &&
          (r.requesterId === userId || (r.acceptedBy != null && r.acceptedBy === userId))
      );
    },
    [requestsByTicket]
  );

  const value = useMemo(
    () => ({
      requestsByTicket,
      fetchRequestsForTicket,
      fetchRequestsForTickets,
      addRequest,
      updateStatus,
      closeRequest,
      reopenRequest,
      getRequestsForTicket,
      getAcceptedOpenRequestForTicket,
      canUserChat,
    }),
    [
      requestsByTicket,
      fetchRequestsForTicket,
      fetchRequestsForTickets,
      addRequest,
      updateStatus,
      closeRequest,
      reopenRequest,
      getRequestsForTicket,
      getAcceptedOpenRequestForTicket,
      canUserChat,
    ]
  );

  return (
    <RequestContext.Provider value={value}>{children}</RequestContext.Provider>
  );
}

export function useRequest() {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error("useRequest must be used within RequestProvider");
  return ctx;
}
