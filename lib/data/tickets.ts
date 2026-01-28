export type TicketType = "Seat" | "Standing";
export type TicketStatus = "Available" | "Sold";

export type Ticket = {
  id: string;
  event: string;
  city: string;
  day: string;
  vip: boolean;
  quantity: number;
  section: string;
  row: string;
  seat: string;
  type: TicketType;
  status: TicketStatus;
  ownerId: string | null;
  /** Face value price per ticket. */
  price: number;
  /** ISO 4217 currency code (e.g. USD, EUR, GBP, KRW). */
  currency: string;
};
