export type TicketType = "Seat" | "Standing";
export type TicketStatus = "Available" | "Requested" | "Reported" | "Sold";

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
  /** Face value price per ticket (e.g. USD). */
  price: number;
};
