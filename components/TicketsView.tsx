"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import ReportModal from "@/components/ReportModal";
import SellTicketDisclaimerModal from "@/components/SellTicketDisclaimerModal";
import SellTicketModal from "@/components/SellTicketModal";
import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { useNotifications } from "@/lib/NotificationContext";
import { useRequest } from "@/lib/RequestContext";
import { formatPrice } from "@/lib/data/currencies";
import { fetchProfile } from "@/lib/data/user_profiles";
import { pushPendingForUser } from "@/lib/notificationsStorage";
import type { Ticket, TicketStatus } from "@/lib/data/tickets";
import { closeAllChatsForTicket } from "@/lib/supabase/chats";
import { fetchReportedTicketIds } from "@/lib/supabase/reports";
import {
  deleteTicket as deleteTicketApi,
  fetchTickets,
  fetchTicketsPage,
  insertTicket as insertTicketApi,
  TICKETS_PAGE_SIZE,
  updateTicket as updateTicketApi,
} from "@/lib/supabase/tickets";

export default function TicketsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn } = useAuth();
  const { add: addNotification } = useNotifications();
  const { addRequest } = useRequest();
  const {
    activeChatId,
    createChat,
    fetchChatsForUser,
    getChatById,
    getChatsForUser,
    getOpenChatForTicket,
    getOpenChatsForTicket,
    openChatModal,
    closeChatModal,
  } = useChat();

  const requireUser = useCallback(
    (fn: () => void) => {
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }
      fn();
    },
    [isLoggedIn, router]
  );
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [vipFilter, setVipFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [rowFilter, setRowFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [qtyFilter, setQtyFilter] = useState<string>("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellDisclaimerOpen, setSellDisclaimerOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"browse" | "my">("browse");
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Ticket | null>(null);
  const [requestedTicketIds, setRequestedTicketIds] = useState<Set<string>>(new Set());
  const [activityFilter, setActivityFilter] = useState<"all" | "contacted" | "reported">("all");
  const [reportedTicketIds, setReportedTicketIds] = useState<Set<string>>(new Set());

  const buildFilters = useCallback(
    () => ({
      ownerId: viewMode === "my" && user?.id ? user.id : null,
      event: eventFilter === "all" ? null : eventFilter,
      status: statusFilter === "all" ? null : statusFilter,
      city: cityFilter === "all" ? null : cityFilter,
      day: dayFilter === "all" ? null : dayFilter,
      vip: vipFilter === "all" ? null : vipFilter === "yes",
      section: sectionFilter === "all" ? null : sectionFilter,
      row: rowFilter === "all" ? null : rowFilter,
      type: typeFilter === "all" ? null : typeFilter,
      quantity: qtyFilter === "all" ? null : Number(qtyFilter),
    }),
    [
      viewMode,
      user?.id,
      eventFilter,
      statusFilter,
      cityFilter,
      dayFilter,
      vipFilter,
      sectionFilter,
      rowFilter,
      typeFilter,
      qtyFilter,
    ]
  );

  const loadTickets = useCallback(
    async (append: boolean) => {
      const useActivityFilter = viewMode === "browse" && user && activityFilter !== "all";
      if (useActivityFilter) {
        setTicketsLoading(true);
        setTicketsError(null);
        const { data, error } = await fetchTickets();
        setTicketsLoading(false);
        if (error) setTicketsError(error);
        else {
          setTickets(data);
          setTotalCount(data.length);
          setHasMore(false);
        }
        return;
      }
      const offset = append ? page * TICKETS_PAGE_SIZE : 0;
      if (append) setLoadingMore(true);
      else {
        setTicketsLoading(true);
        setTicketsError(null);
      }
      const filters = buildFilters();
      const { data, error, total } = await fetchTicketsPage({
        limit: TICKETS_PAGE_SIZE,
        offset,
        filters,
      });
      if (append) setLoadingMore(false);
      else setTicketsLoading(false);
      if (error) {
        setTicketsError(error);
        if (!append) setTickets([]);
        return;
      }
      setTicketsError(null);
      if (append) {
        setTickets((prev) => [...prev, ...data]);
      } else {
        setTickets(data);
      }
      setTotalCount(total);
      setHasMore(offset + data.length < total);
    },
    [viewMode, user, activityFilter, page, buildFilters]
  );

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [
    viewMode,
    eventFilter,
    statusFilter,
    cityFilter,
    dayFilter,
    vipFilter,
    sectionFilter,
    rowFilter,
    typeFilter,
    qtyFilter,
    activityFilter,
  ]);

  useEffect(() => {
    if (page === 0) loadTickets(false);
    else loadTickets(true);
  }, [page, loadTickets]);

  useEffect(() => {
    const view = searchParams.get("view");
    const ticket = searchParams.get("ticket");
    if (view === "my") {
      if (!isLoggedIn) {
        router.replace("/login");
        return;
      }
      setViewMode("my");
    }
    if (ticket) setActiveTicketId(ticket);
  }, [searchParams, isLoggedIn, router]);

  useEffect(() => {
    if (!user?.id) return;
    fetchReportedTicketIds(user.id).then(({ data }) => {
      setReportedTicketIds(new Set(data));
    });
  }, [user?.id]);

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

  const contactedTicketIds = useMemo(() => {
    if (!user?.id) return new Set<string>();
    const chats = getChatsForUser(user.id);
    return new Set(chats.filter((c) => c.buyerId === user.id).map((c) => c.ticketId));
  }, [user?.id, getChatsForUser]);

  const filtered = useMemo(() => {
    const base = filterBase;
    let list = base.filter((t) => {
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
    if (viewMode === "browse" && user && activityFilter !== "all") {
      if (activityFilter === "contacted") {
        list = list.filter((t) => contactedTicketIds.has(t.id));
      } else if (activityFilter === "reported") {
        list = list.filter((t) => reportedTicketIds.has(t.id));
      }
    }
    return list;
  }, [
    filterBase,
    viewMode,
    user,
    activityFilter,
    contactedTicketIds,
    reportedTicketIds,
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

  const openChat = (t: Ticket) =>
    requireUser(() => {
      if (!user) return;
      const chat = getOpenChatForTicket(t.id, user.id);
      if (chat) openChatModal(chat.id);
    });

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === activeTicketId),
    [tickets, activeTicketId]
  );
  const hasOpenChat = (t: Ticket) =>
    !!user && !!getOpenChatForTicket(t.id, user.id);

  /** True only when we are the buyer who sent the request (not the seller). */
  const weSentRequest = (t: Ticket) => {
    if (!user) return false;
    if (requestedTicketIds.has(t.id)) return true;
    const chat = getOpenChatForTicket(t.id, user.id);
    return !!chat && chat.buyerId === user.id;
  };

  const handleBuy = useCallback(
    async (t: Ticket) => {
      if (!user || !t.ownerId || t.status === "Sold") return;
      setRequestedTicketIds((prev) => new Set(prev).add(t.id));
      const ticketId = t.id;
      const ownerId = t.ownerId;
      const ticketSummary = [t.event, t.city, t.day].filter(Boolean).join(" · ") || ticketId;
      const req = await addRequest(
        ticketId,
        user.id,
        user.username,
        t.event ?? "—",
        "—",
        { status: "accepted", acceptedBy: ownerId }
      );
      if (!req) return;
      const { data: sellerProfile } = await fetchProfile(ownerId);
      const sellerUsername = sellerProfile?.username ?? "Seller";
      const chat = await createChat({
        requestId: req.id,
        ticketId,
        buyerId: user.id,
        sellerId: ownerId,
        buyerUsername: user.username,
        sellerUsername,
        ticketSummary,
      });
      if (t.status === "Available") {
        setTickets((prev) =>
          prev.map((x) => (x.id === ticketId ? { ...x, status: "Contacted" as const } : x))
        );
      }
      pushPendingForUser(ownerId, {
        type: "request_received",
        ticketId,
        message: `${user.username} wants to buy your ticket: ${ticketSummary}. You can chat now.`,
        ticketSummary,
      });
      addNotification({
        type: "request_received",
        ticketId,
        message: "Chat opened. You can message the seller.",
        ticketSummary,
      });
      if (chat) openChatModal(chat.id);
    },
    [user, addRequest, createChat, openChatModal, addNotification]
  );

  const openReport = (t: Ticket) => requireUser(() => {
    setActiveTicketId(t.id);
    setReportOpen(true);
  });
  const openSell = () => requireUser(() => setSellDisclaimerOpen(true));

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

    const closeErr = await closeAllChatsForTicket(t.id);
    if (closeErr && process.env.NODE_ENV === "development") {
      console.warn("[TicketsView] closeAllChatsForTicket:", closeErr);
    }
    if (user) void fetchChatsForUser(user.id);

    const activeChat = activeChatId ? getChatById(activeChatId) : null;
    if (activeChat?.ticketId === t.id) closeChatModal();
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
                  router.push("/login");
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
        {viewMode === "browse" && isLoggedIn && (
          <FilterSelect
            label="Show"
            value={activityFilter}
            onChange={(v) => setActivityFilter(v as "all" | "contacted" | "reported")}
            options={["all", "contacted", "reported"]}
            labelMap={{ all: "All", contacted: "Contacted", reported: "Reported" }}
          />
        )}
        <FilterSelect label="Event" value={eventFilter} onChange={setEventFilter} options={["all", ...events]} />
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={["all", "Available", "Contacted", "Reported", "Sold"]} />
        <FilterSelect label="City" value={cityFilter} onChange={setCityFilter} options={["all", ...cities]} />
        <FilterSelect label="Day" value={dayFilter} onChange={setDayFilter} options={["all", ...days]} />
        <FilterSelect label="VIP" value={vipFilter} onChange={setVipFilter} options={["all", "yes", "no"]} />
        <FilterSelect label="Section" value={sectionFilter} onChange={setSectionFilter} options={["all", ...sections]} />
        <FilterSelect label="Row" value={rowFilter} onChange={setRowFilter} options={["all", ...rows]} />
        <FilterSelect label="Seat type" value={typeFilter} onChange={setTypeFilter} options={["all", "Seat", "Standing"]} />
        <FilterSelect label="Qty" value={qtyFilter} onChange={setQtyFilter} options={["all", ...quantities.map(String)]} />
      </div>

      <div className="rounded-xl border border-army-purple/15 bg-white shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
        {ticketsLoading ? (
          <p className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
            Loading tickets…
          </p>
        ) : (
          <>
            {totalCount > 0 && (
              <p className="border-b border-army-purple/10 px-4 py-2 text-sm text-neutral-600 dark:border-army-purple/15 dark:text-neutral-400">
                Showing 1–{tickets.length} of {totalCount} ticket{totalCount !== 1 ? "s" : ""}
              </p>
            )}
            {/* Mobile: cards — no horizontal scroll, actions visible */}
            <div className="space-y-3 p-4 md:hidden">
              {sorted.length === 0 ? (
                <p className="py-6 text-center text-neutral-500 dark:text-neutral-400">
                  {tickets.length === 0 ? "No tickets listed yet." : "No tickets match the filters."}
                </p>
              ) : (
                sorted.map((row) => (
                  <TicketCard
                    key={row.id}
                    ticket={row}
                    viewMode={viewMode}
                    isOwnTicket={row.ownerId === user?.id}
                    hasOpenChat={hasOpenChat(row)}
                    requestSent={weSentRequest(row)}
                    openChatsCount={getOpenChatsForTicket(row.id).length}
                    onBuy={() => requireUser(() => handleBuy(row))}
                    onOpenChat={() => openChat(row)}
                    onReport={() => openReport(row)}
                    onMarkSold={() => handleMarkSold(row)}
                    onEdit={() => openEdit(row)}
                    onDelete={() => setDeleteConfirm(row)}
                  />
                ))
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
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
                      <Td>{row.price != null && row.price > 0 ? formatPrice(row.price, row.currency ?? "USD") : "—"}</Td>
                      <Td>{row.section}</Td>
                      <Td>{row.row}</Td>
                      <Td>{row.seat}</Td>
                      <Td>{row.type}</Td>
                      <Td><StatusBadge status={row.status} /></Td>
                      <td className="flex flex-wrap items-center gap-2 px-4 py-3">
                        {viewMode === "browse" ? (
                          row.ownerId === user?.id ? (
                            <span className="text-sm text-neutral-500 dark:text-neutral-400">
                              Your listing
                            </span>
                          ) : (
                          <>
                            {row.status === "Sold" ? (
                              <button type="button" disabled title="Ticket is sold" className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                                Contact
                              </button>
                            ) : weSentRequest(row) ? (
                              <button type="button" disabled title="Message sent" className="cursor-not-allowed rounded-lg border-2 border-army-purple/40 bg-army-purple/10 px-3 py-2 text-sm font-medium text-army-purple dark:border-army-400/50 dark:bg-army-purple/20 dark:text-army-300">
                                Message sent
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => requireUser(() => handleBuy(row))}
                                className="rounded-lg bg-army-purple px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-army-700 dark:bg-army-600 dark:hover:bg-army-500"
                              >
                                Contact
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
                                className="rounded-lg border-2 border-army-purple bg-transparent px-3 py-2 text-sm font-semibold text-army-purple transition-colors hover:bg-army-purple/10 dark:border-army-400 dark:text-army-300 dark:hover:bg-army-purple/20"
                              >
                                Chat
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                title="Click Contact to open chat with seller"
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
                          )
                        ) : (
                          <>
                            {row.status === "Sold" ? null : (
                              <Link
                                href={
                                  getOpenChatsForTicket(row.id).length > 0
                                    ? `/chats?ticket=${row.id}`
                                    : "/chats"
                                }
                                className="rounded-lg border-2 border-army-purple bg-transparent px-3 py-2 text-sm font-semibold text-army-purple transition-colors hover:bg-army-purple/10 dark:border-army-400 dark:text-army-300 dark:hover:bg-army-purple/20"
                              >
                                Chats{(() => {
                                  const n = getOpenChatsForTicket(row.id).length;
                                  return n > 0 ? ` (${n})` : "";
                                })()}
                              </Link>
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
              {sorted.length === 0 && (
                <p className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                  {tickets.length === 0 ? "No tickets listed yet." : "No tickets match the filters."}
                </p>
              )}
            </div>
            {hasMore && !loadingMore && (
              <div className="border-t border-army-purple/10 px-4 py-4 dark:border-army-purple/15">
                <button
                  type="button"
                  onClick={loadMore}
                  className="btn-army-outline mx-auto block w-full max-w-xs"
                >
                  Load more
                </button>
              </div>
            )}
            {loadingMore && (
              <p className="border-t border-army-purple/10 px-4 py-4 text-center text-sm text-neutral-500 dark:border-army-purple/15 dark:text-neutral-400">
                Loading…
              </p>
            )}
          </>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        ticket={activeTicket}
        onReported={(ticketId) => {
          setTickets((prev) =>
            prev.map((t) => (t.id === ticketId ? { ...t, status: "Reported" as const } : t))
          );
          setReportedTicketIds((prev) => new Set(prev).add(ticketId));
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

type TicketCardProps = {
  ticket: Ticket;
  viewMode: "browse" | "my";
  isOwnTicket: boolean;
  hasOpenChat: boolean;
  requestSent: boolean;
  openChatsCount: number;
  onBuy: () => void;
  onOpenChat: () => void;
  onReport: () => void;
  onMarkSold: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function TicketCard({
  ticket,
  viewMode,
  isOwnTicket,
  hasOpenChat,
  requestSent,
  openChatsCount,
  onBuy,
  onOpenChat,
  onReport,
  onMarkSold,
  onEdit,
  onDelete,
}: TicketCardProps) {
  const sold = ticket.status === "Sold";
  const priceStr = ticket.price != null && ticket.price > 0 ? formatPrice(ticket.price, ticket.currency ?? "USD") : "—";
  const meta = [ticket.city, ticket.day].filter(Boolean).join(" · ") || "—";
  const details = [ticket.section, ticket.row, ticket.seat, ticket.type].filter(Boolean).join(" · ") || "—";

  return (
    <div
      className={`rounded-xl border p-4 ${
        ticket.status === "Reported"
          ? "border-army-400/40 bg-gradient-to-br from-army-200/30 to-army-300/20 dark:from-army-900/30 dark:to-army-800/20"
          : ticket.status === "Sold"
            ? "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
            : "border-army-purple/15 bg-white dark:border-army-purple/25 dark:bg-neutral-900"
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-army-purple dark:text-army-200">{ticket.event}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{meta}</p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span>VIP {ticket.vip ? "Yes" : "No"}</span>
          <span>Qty {ticket.quantity}</span>
          <span>{priceStr}</span>
          {details !== "—" && <span>{details}</span>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {viewMode === "browse" ? (
          isOwnTicket ? (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Your listing
            </span>
          ) : (
          <>
            {sold ? (
              <button type="button" disabled className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                Contact
              </button>
            ) : requestSent ? (
              <button type="button" disabled title="Message sent" className="cursor-not-allowed rounded-lg border-2 border-army-purple/40 bg-army-purple/10 px-3 py-2 text-sm font-medium text-army-purple dark:border-army-400/50 dark:bg-army-purple/20 dark:text-army-300">
                Message sent
              </button>
            ) : (
              <button
                type="button"
                onClick={onBuy}
                className="rounded-lg bg-army-purple px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-army-700 dark:bg-army-600 dark:hover:bg-army-500"
              >
                Contact
              </button>
            )}
            {sold ? (
              <button type="button" disabled className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                Chat
              </button>
            ) : hasOpenChat ? (
              <button
                type="button"
                onClick={onOpenChat}
                className="rounded-lg border-2 border-army-purple bg-transparent px-3 py-2 text-sm font-semibold text-army-purple transition-colors hover:bg-army-purple/10 dark:border-army-400 dark:text-army-300 dark:hover:bg-army-purple/20"
              >
                Chat
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="Click Contact to open chat with seller"
                className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500"
              >
                Chat
              </button>
            )}
            {sold ? (
              <button type="button" disabled className="cursor-not-allowed rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-600 dark:text-neutral-500">
                Report
              </button>
            ) : (
              <button
                type="button"
                onClick={onReport}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Report
              </button>
            )}
          </>
          )
        ) : (
          <>
            {!sold && (
              <Link
                href={openChatsCount > 0 ? `/chats?ticket=${ticket.id}` : "/chats"}
                className="rounded-lg border-2 border-army-purple bg-transparent px-3 py-2 text-sm font-semibold text-army-purple transition-colors hover:bg-army-purple/10 dark:border-army-400 dark:text-army-300 dark:hover:bg-army-purple/20"
              >
                Chats{openChatsCount > 0 ? ` (${openChatsCount})` : ""}
              </Link>
            )}
            {!sold && (
              <button type="button" onClick={onMarkSold} className="rounded-lg px-3 py-2 text-sm font-semibold text-army-600 transition-colors hover:bg-army-200/40 dark:text-army-400 dark:hover:bg-army-800/30">
                Mark sold
              </button>
            )}
            <button type="button" onClick={onEdit} className="btn-army-ghost rounded-lg px-3 py-2 text-sm">
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labelMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labelMap?: Record<string, string>;
}) {
  const id = `filter-${label.toLowerCase().replace(/\s/g, "-")}`;
  const display = (o: string) => (labelMap && labelMap[o]) ?? (o === "all" ? "All" : o);
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
            {display(o)}
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
    Contacted: "bg-army-400/30 text-army-900 dark:bg-army-500/30 dark:text-army-100",
    Reported: "bg-army-600/40 text-white dark:bg-army-500/50",
    Sold: "bg-neutral-300 text-neutral-700 dark:bg-neutral-600 dark:text-neutral-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}>
      {status}
    </span>
  );
}
