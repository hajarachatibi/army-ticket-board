# Connections flow & limitations

This document describes the connection lifecycle and the main business rules (limits, locks, timeouts).

---

## 1. Stage flow (high level)

```mermaid
flowchart LR
  subgraph request["Request"]
    A[pending_seller]
  end
  subgraph active["Active (listing locked)"]
    B[bonding]
    C[preview]
    D[comfort]
    E[social]
    F[agreement]
    G[chat_open]
  end
  subgraph terminal["Terminal"]
    H[ended]
    I[expired]
    J[declined]
  end

  A -->|Seller accepts| B
  A -->|Seller declines| J
  A -->|Timeout 24h| I

  B --> C
  C -->|Both comfortable| E
  C -->|Either not comfortable| H
  C -->|Timeout 24h| I
  E --> F
  F --> G
  G -->|User ends / sold / removed| H
  G -->|Chat inactive 24h| H
```

---

## 2. Detailed stage flow (with actors)

```mermaid
stateDiagram-v2
  [*] --> pending_seller: Buyer requests (CONNECT)

  pending_seller --> declined: Seller declines
  pending_seller --> expired: 24h no response
  pending_seller --> bonding: Seller accepts\n(listing LOCKED)

  bonding --> preview: Both submit 3 bonding answers
  bonding --> expired: 24h timeout

  preview --> social: Both answer "comfortable"
  preview --> ended: Either answers "not comfortable"
  preview --> expired: 24h timeout

  social --> agreement: Both choose share socials (or both no)
  social --> expired: 24h timeout

  agreement --> chat_open: Both confirm match
  agreement --> expired: 24h timeout

  chat_open --> ended: User ends / listing sold or removed
  chat_open --> ended: Chat inactive 24h (cron)

  ended --> [*]
  expired --> [*]
  declined --> [*]
```

---

## 3. Limitations (rules)

```mermaid
flowchart TB
  subgraph buyer["BUYER limits"]
    B1["Max 3 active connection requests at a time"]
    B2["Stages that count: pending_seller, bonding, preview, comfort, social, agreement, chat_open"]
    B3["Only 1 request per listing (no duplicate request to same listing)"]
    B4["Cannot connect to own listing"]
    B5["Onboarding + terms + user agreement must be completed"]
  end

  subgraph seller["SELLER limits"]
    S1["Only 1 active accepted connection at a time (across all their listings)"]
    S2["To accept a new request: must end or finish current bonding→chat_open connection first"]
    S3["Can have many pending_seller (waiting list) on same listing"]
  end

  subgraph listing["LISTING state"]
    L1["Available: status = active, not locked"]
    L2["Locked: when seller accepts one buyer (locked_by = that buyer_id)"]
    L3["Other buyers can still be in pending_seller (waiting list) for that listing"]
    L4["Cannot connect if: sold, removed, processing, or locked"]
  end

  subgraph timeouts["TIMEOUTS"]
    T1["pending_seller: 24h → expired"]
    T2["bonding / preview / social / agreement: 24h → expired (listing unlocked)"]
    T3["chat_open: 24h no message → ended (cron), listing unlocked"]
    T4["Listing lock: 24h from accept (lock_expires_at)"]
  end
```

---

## 4. Summary table

| Rule | Detail |
|------|--------|
| **Buyer: max active requests** | 3 total (any mix of pending_seller, bonding, preview, comfort, social, agreement, chat_open). |
| **Buyer: per listing** | At most one connection per listing in those stages (unique on `(listing_id, buyer_id)` where stage is active). |
| **Seller: one active deal** | Seller can have only one connection in bonding→chat_open at a time. Other requests stay in waiting list (pending_seller). |
| **Listing lock** | When seller accepts, listing becomes `locked` and `locked_by = buyer`. Only that buyer’s connection progresses; others stay pending_seller. |
| **Stage timeouts** | pending_seller, bonding, preview, social, agreement: 24h each. After timeout, connection goes to expired (or ended) and listing is unlocked if it was locked. |
| **Chat inactivity** | If chat_open and no message for 24h, cron can set connection to ended and unlock listing. |
| **End / release** | Buyer or seller can end connection (release); listing unlocks if it was locked by that connection. |

---

## 5. Notifications (relevant to flow)

- **Seller accepts one buyer** → Accepted buyer and seller get “Connection accepted”. All other buyers for that listing (waiting list) get “You’re on the waiting list”.
- **Connection ended** → Only the party who did *not* end it gets a notification, with a reason (e.g. seller ended, buyer ended, listing sold, listing removed by seller/admin).
