"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ReportModal from "@/components/ReportModal";
import RequestModal from "@/components/RequestModal";
import SellTicketDisclaimerModal from "@/components/SellTicketDisclaimerModal";
import SellTicketModal from "@/components/SellTicketModal";
import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { useRequest } from "@/lib/RequestContext";
import type { Ticket, TicketStatus } from "@/lib/data/tickets";
import {
  deleteTicket as deleteTicketApi,
  fetchTickets,
  insertTicket as insertTicketApi,
  updateTicket as updateTicketApi,
} from "@/lib/supabase/tickets";

export default function TicketsView() {
  const { user, isLoggedIn, openAuthModal } = useAuth();
  const {
    canUserChat,
    getRequestsForTicket,
    fetchRequestsForTickets,
  } = useRequest();
  const { getOpenChatForTicket, openChatModal } = useChat();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    const { data, error } = await fetchTickets();
    setTicketsLoading(false);
    if (error) setTicketsError(error);
    else setTickets(data);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [vipFilter, setVipFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [rowFilter, setRowFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [qtyFilter, setQtyFilter] = useState<string>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellDisclaimerOpen, setSellDisclaimerOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"browse" | "my">("browse");
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Ticket | null>(null);

  const myTickets = useMemo(
    () => (user ? tickets.filter((t) => t.ownerId === user.id) : []),
    [tickets, user]
  );

  const filterBase = viewMode === "my" ? myTickets : tickets;
  const events = useMemo(() => {
    const s = new Set(filterBase.map((t) => t.event));
    return Array.from(s).sort();
  }, [filterBase]);
  const cities = useMemo(() => {
    const s = new Set(filterBase.map((t) => t.city));
    return Array.from(s).sort();
  }, [filterBase]);
  const days = useMemo(() => {
    const s = new Set(filterBase.map((t) => t.day));
    return Array.from(s).sort();
  }, [filterBase]);
  const sections = useMemo(() => {
    const s = new Set(filterBase.map((t) => t.section));
    return Array.from(s).sort();
  }, [filterBase]);
  const rows = useMemo(() => {
    const s = new Set(filterBase.map((t) => t.row));
    return Array.from(s).sort();
  }, [filterBase]);
  const quantities = useMemo(() => {
    const s = new Set(filterBase.map((t) => t.quantity));
    return Array.from(s).sort((a, b) => a - b);
  }, [filterBase]);

  const filtered = useMemo(() => {
    const base = filterBase;
    return base.filter((t) => {
      if (eventFilter !== "all" && t.event !== eventFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (cityFilter !== "all" && t.city !== cityFilter) return false;
      if (dayFilter !== "all" && t.day !== dayFilter) return false;
      if (vipFilter !== "all") {
        const v = vipFilter === "yes";
        if (t.vip !== v) return false;
      }
      if (sectionFilter !== "all" && t.section !== sectionFilter) return false;
      if (rowFilter !== "all" && t.row !== rowFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (qtyFilter !== "all" && t.quantity !== Number(qtyFilter)) return false;
      return true;
    });
  }, [
    filterBase,
    eventFilter,
    statusFilter,
    cityFilter,
    dayFilter,
    vipFilter,
    sectionFilter,
    rowFilter,
    typeFilter,
    qtyFilter,
  ]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.status === "Sold" && b.status !== "Sold") return 1;
      if (a.status !== "Sold" && b.status === "Sold") return -1;
      return 0;
    });
  }, [filtered]);

  useEffect(() => {
    if (viewMode === "my" && myTickets.length > 0) {
      fetchRequestsForTickets(myTickets.map((t) => t.id));
    }
  }, [viewMode, myTickets, fetchRequestsForTickets]);

  const requireLogin = (action: () => void) => {
    if (!isLoggedIn) {
      openAuthModal("login");
      return;
    }
    action();
  };

  const openChat = (t: Ticket) =>
    requireLogin(() => {
      if (!user) return;
      const chat = getOpenChatForTicket(t.id, user.id);
      if (chat) openChatModal(chat.id);
    });

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === activeTicketId),
    [tickets, activeTicketId]
  );
  const chatAllowed = (t: Ticket) =>
    !!user && canUserChat(t.id, user.id, t.ownerId);
  const hasOpenChat = (t: Ticket) =>
    !!user && !!getOpenChatForTicket(t.id, user.id);

  const openRequest = (id: string) => requireLogin(() => {
    setActiveTicketId(id);
    setRequestOpen(true);
  });
  const openReport = (t: Ticket) => requireLogin(() => {
    setActiveTicketId(t.id);
    setReportOpen(true);
  });
  const openSell = () =>
    requireLogin(() => setSellDisclaimerOpen(true));

  const acceptSellDisclaimer = () => {
    setSellDisclaimerOpen(false);
    setEditTicket(null);
    setSellOpen(true);
  };

  const openEdit = (t: Ticket) => {
    setEditTicket(t);
    setSellOpen(true);
  };
  const closeSellModal = () => {
    setSellOpen(false);
    setEditTicket(null);
  };

  const handleDelete = async (t: Ticket) => {
    const { error } = await deleteTicketApi(t.id);
    if (error) {
      setTicketsError(error);
      return;
    }
    setTickets((prev) => prev.filter((x) => x.id !== t.id));
    setDeleteConfirm(null);
  };
  const handleMarkSold = async (t: Ticket) => {
    const { data, error } = await updateTicketApi(t.id, { status: "Sold" });
    if (error) {
      setTicketsError(error);
      return;
    }
    if (data) setTickets((prev) => prev.map((x) => (x.id === t.id ? data : x)));
  };
  const handleTicketUpdated = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <div className="space-y-6">
      {ticketsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {ticketsError}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold text-army-purple">Tickets</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="View mode"
            className="flex rounded-lg border border-army-purple/20 bg-white dark:border-army-purple/30 dark:bg-neutral-900"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "browse"}
              onClick={() => setViewMode("browse")}
              className={`rounded-l-lg px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === "browse"
                  ? "bg-army-purple text-white"
                  : "text-army-purple hover:bg-army-purple/10 dark:hover:bg-army-purple/20"
              }`}
            >
              Browse
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "my"}
              onClick={() => {
                if (viewMode === "my") return;
                if (!isLoggedIn) {
                  openAuthModal("login");
                  return;
                }
                setViewMode("my");
              }}
              className={`rounded-r-lg px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === "my"
                  ? "bg-army-purple text-white"
                  : "text-army-purple hover:bg-army-purple/10 dark:hover:bg-army-purple/20"
              }`}
            >
              My tickets
            </button>
          </div>
          <button type="button" onClick={openSell} className="btn-army">
            Sell ticket
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-army-purple/15 bg-white p-4 dark:border-army-purple/25 dark:bg-neutral-900">
        <FilterSelect label="Event" value={eventFilter} onChange={setEventFilter} options={["all", ...events]} />
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={["all", "Available", "Requested", "Reported", "Sold"]} />
        <FilterSelect label="City" value={cityFilter} onChange={setCityFilter} options={["all", ...cities]} />
        <FilterSelect label="Day" value={dayFilter} onChange={setDayFilter} options={["all", ...days]} />
        <FilterSelect label="VIP" value={vipFilter} onChange={setVipFilter} options={["all", "yes", "no"]} />
        <FilterSelect label="Section" value={sectionFilter} onChange={setSectionFilter} options={["all", ...sections]} />
        <FilterSelect label="Row" value={rowFilter} onChange={setRowFilter} options={["all", ...rows]} />
        <FilterSelect label="Seat type" value={typeFilter} onChange={setTypeFilter} options={["all", "Seat", "Standing"]} />
        <FilterSelect label="Qty" value={qtyFilter} onChange={setQtyFilter} options={["all", ...quantities.map(String)]} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-army-purple/15 bg-white shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
        {ticketsLoading ? (
          <p className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
            Loading tickets…
          </p>
        ) : (
          <>
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25">
              <Th>Event</Th>
              <Th>City</Th>
              <Th>Day</Th>
              <Th>VIP</Th>
              <Th>Qty</Th>
              <Th>Price</Th>
              <Th>Section</Th>
              <Th>Row</Th>
              <Th>Seat</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-army-purple/10 transition-colors last:border-0 hover:bg-army-purple/5 dark:border-army-purple/15 ${
                  row.status === "Reported"
                    ? "bg-gradient-to-r from-army-200/40 to-army-300/20 dark:from-army-900/30 dark:to-army-800/20"
                    : row.status === "Sold"
                      ? "bg-neutral-100 dark:bg-neutral-800/50"
                      : ""
                }`}
              >
                <Td>{row.event}</Td>
                <Td>{row.city}</Td>
                <Td>{row.day}</Td>
                <Td>{row.vip ? "Yes" : "No"}</Td>
                <Td>{row.quantity}</Td>
                <Td>{row.price != null && row.price > 0 ? String(row.price) : "—"}</Td>
                <Td>{row.section}</Td>
                <Td>{row.row}</Td>
                <Td>{row.seat}</Td>
                <Td>{row.type}</Td>
                <Td><StatusBadge status={row.status} /></Td>
                <td className="flex flex-wrap items-center gap-2 px-4 py-3">
                  {viewMode === "browse" ? (
                    <>
                      {row.status === "Sold" ? (
                        <button type="button" disabled title="Ticket is sold" className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                          Request
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openRequest(row.id)}
                          className="rounded-lg bg-army-purple px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-army-700 dark:bg-army-600 dark:hover:bg-army-500"
                        >
                          Request
                        </button>
                      )}
                      {row.status === "Sold" ? (
                        <button type="button" disabled title="Ticket is sold" className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                          Chat
                        </button>
                      ) : chatAllowed(row) ? (
                        <button
                          type="button"
                          onClick={() => openChat(row)}
                          className="rounded-lg border-2 border-army-purple bg-transparent px-3 py-2 text-sm font-semibold text-army-purple transition-colors hover:bg-army-purple/10 dark:border-army-400 dark:text-army-300 dark:hover:bg-army-purple/20"
                        >
                          Chat
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Request must be accepted before you can chat"
                          className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500"
                        >
                          Chat
                        </button>
                      )}
                      {row.status === "Sold" ? (
                        <button type="button" disabled title="Ticket is sold" className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                          Report
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReport(row)}
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          Report
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {row.status === "Sold" ? (
                        <button type="button" disabled title="Ticket is sold" className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                          Requests ({getRequestsForTicket(row.id).length})
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTicketId(row.id);
                            setRequestOpen(true);
                          }}
                          className="rounded-lg border-2 border-army-purple bg-transparent px-3 py-2 text-sm font-semibold text-army-purple transition-colors hover:bg-army-purple/10 dark:border-army-400 dark:text-army-300 dark:hover:bg-army-purple/20"
                        >
                          Requests ({getRequestsForTicket(row.id).length})
                        </button>
                      )}
                      {row.status === "Sold" ? (
                        <button type="button" disabled title="Ticket is sold" className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                          Chat
                        </button>
                      ) : hasOpenChat(row) ? (
                        <button
                          type="button"
                          onClick={() => openChat(row)}
                          className="rounded-lg bg-army-purple px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-army-700 dark:bg-army-600 dark:hover:bg-army-500"
                        >
                          Chat
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Accept a request to open chat"
                          className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500"
                        >
                          Chat
                        </button>
                      )}
                      {row.status !== "Sold" && (
                        <button type="button" onClick={() => handleMarkSold(row)} className="rounded-lg px-2 py-1 text-xs font-semibold text-army-600 hover:bg-army-200/40 dark:text-army-400 dark:hover:bg-army-800/30">
                          Mark sold
                        </button>
                      )}
                      <button type="button" onClick={() => openEdit(row)} className="btn-army-ghost rounded-lg px-2 py-1 text-xs">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(row)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
            {tickets.length === 0 ? "No tickets listed yet." : "No tickets match the filters."}
          </p>
        )}
          </>
        )}
      </div>

      <RequestModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        ticket={activeTicket}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        ticket={activeTicket}
        onReported={(ticketId) => {
          setTickets((prev) =>
            prev.map((t) => (t.id === ticketId ? { ...t, status: "Reported" as const } : t))
          );
        }}
      />
      <SellTicketDisclaimerModal
        open={sellDisclaimerOpen}
        onClose={() => setSellDisclaimerOpen(false)}
        onAccept={acceptSellDisclaimer}
      />
      <SellTicketModal
        open={sellOpen}
        onClose={closeSellModal}
        editTicket={editTicket}
        onTicketAdded={(t) => setTickets((prev) => [t, ...prev])}
        onTicketUpdated={handleTicketUpdated}
      />
      {deleteConfirm && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="modal-panel w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-confirm-title" className="font-display text-lg font-bold text-army-purple">
              Delete listing?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {deleteConfirm.event} — {deleteConfirm.city}, {deleteConfirm.day}. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-army-outline">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const id = `filter-${label.toLowerCase().replace(/\s/g, "-")}`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-army-purple">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-army w-auto py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "all" ? "All" : o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-sm font-bold uppercase tracking-wide text-army-purple">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 ${className}`}>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    Available: "bg-army-200/50 text-army-800 dark:bg-army-300/30 dark:text-army-200",
    Requested: "bg-army-400/30 text-army-900 dark:bg-army-500/30 dark:text-army-100",
    Reported: "bg-army-600/40 text-white dark:bg-army-500/50",
    Sold: "bg-neutral-300 text-neutral-700 dark:bg-neutral-600 dark:text-neutral-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}>
      {status}
    </span>
  );
}
