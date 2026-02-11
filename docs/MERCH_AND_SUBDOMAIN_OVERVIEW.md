# Merch & subdomain expansion – overview and migration

This document outlines the plan to add **BTS merch** alongside tickets/listings, introduce a **home domain** (army-board.com), and optionally split traffic by **subdomains** (ticket.army-board.com, merch.army-board.com). It also suggests the best architecture and a migration path so users are not disrupted.

---

## 1. Target state

| Purpose | Domain | Content |
|--------|--------|--------|
| **Home / hub** | `army-board.com` | Landing with two (later three) entry points: **Listings**, **Merch**, and later **Events** |
| **Tickets / listings** | `ticket.army-board.com` (or `army-ticket-board.com` during transition) | Current ticket/listings flow unchanged |
| **Merch** | `merch.army-board.com` | BTS merch selling – same flow as listings (post item, connections, bonding, chat) but with **categories and subcategories** |
| **Events** (future) | TBD | Different flow; out of scope here |

- **Users**: Same accounts everywhere. One login, one profile; used on both ticket and merch subdomains.
- **Merch**: Same high-level process as listings (create listing → connections → bonding → preview → socials → agreement → chat). Differences: **categories/subcategories** and merch-specific fields (e.g. condition, item type), not a different “product type” in the sense of auth or connections.

---

## 2. Recommendation: one project, one database

**Recommendation: keep a single Next.js project and one Supabase database.** Add merch as a first-class “product type” (e.g. `listings`-like table or a `type` on listings) and use routing/subdomains to separate tickets vs merch in the UI.

### Why one project + one DB

1. **Shared users and auth** – No syncing users, sessions, or profiles across apps. Same `user_profiles`, same onboarding, same RLS.
2. **Reuse connections flow** – Bonding, preview, socials, agreement, chat, limits, and locks are identical. One codebase for connection RPCs, triggers, and UI components.
3. **Simpler deployment and env** – One Vercel project, one Supabase project, one set of env vars and cron jobs.
4. **Easier cross-linking** – “My Listings” and “My Merch” can live under the same account; home page can link to both subdomains without cross-app auth.
5. **Lower maintenance** – One codebase to upgrade (e.g. connection flow, security, notifications).

### When a separate project might make sense

- Merch (or events) diverges strongly (different stack, team, or release cycle).
- You need strict isolation (e.g. compliance, different regions).
- Traffic/scale demands separate scaling.

For “same process as listings, same users,” a single project is the better default.

---

## 3. High-level project structure (single repo)

```
army-ticket-board/                    # or rename to army-board
├── app/
│   ├── (ticket)/                     # or route group / ticket
│   │   ├── tickets/                  # current listings UI
│   │   ├── connections/
│   │   └── ...
│   ├── (merch)/
│   │   ├── merch/                    # merch browse, post, connections
│   │   │   ├── categories/
│   │   │   └── ...
│   │   └── ...
│   ├── api/
│   │   ├── listings/                 # existing
│   │   ├── merch/                    # merch CRUD (or extend listings with type=merch)
│   │   └── ...
│   └── page.tsx                     # home: redirect by subdomain or show hub
├── components/
│   ├── ...                          # shared (auth, layout, connection components)
│   ├── merch/                       # merch-specific (category picker, merch cards)
│   └── ...
├── lib/
│   └── ...
└── supabase/
    └── migrations/
        ├── ...                      # existing
        └── xxx_merch_*.sql          # merch tables (or listing type + categories)
```

**Database:**

- **Option A – Separate `merch_listings` table**: Mirrors `listings` + `listing_seats` but with `category_id`, `subcategory_id`, and merch-specific fields. Separate `merch_connections` or re-use `connections` with `listing_id` → nullable and `merch_listing_id` (more duplication of connection logic).
- **Option B – Single `listings` table with `type` (recommended): Add `type` (`'ticket' | 'merch'`), and for `type = 'merch'` add `category_id`, `subcategory_id`, and optional merch fields. Same `connections` table (connection is “about” a listing, whether ticket or merch). Categories/subcategories in `merch_categories` and `merch_subcategories`. Browse and RPCs filter by `type` and category when relevant.

Recommendation: **Option B** (one `listings` table with `type` + categories for merch) keeps connections, limits, and notifications unified and avoids duplicating connection logic.

---

## 4. Subdomains and home page

- **army-board.com**: Home page. Shows two (later three) buttons: **Listings** → `ticket.army-board.com`, **Merch** → `merch.army-board.com`. No auth required to view this page; auth required when entering either subdomain.
- **ticket.army-board.com**: Current ticket/listings app (same UI and routes as today, possibly with a small “Merch” link in header to merch subdomain).
- **merch.army-board.com**: Same app, but default route or layout shows merch (filter `type = 'merch'`), categories, subcategories, and merch-specific post/edit flows.

**Implementation:**

- **Next.js**: Single app. Use **middleware** or **host / headers** to detect `request.nextUrl.hostname`:
  - `army-board.com` → show hub (or redirect to ticket or merch if you want a default).
  - `ticket.army-board.com` → serve ticket app (layout or base path for tickets).
  - `merch.army-board.com` → serve merch app (layout or base path for merch).
- **Vercel**: Add `army-board.com`, `ticket.army-board.com`, `merch.army-board.com` to the same project; no separate “project” needed.
- **Auth**: Supabase auth is domain-agnostic. Set cookie domain to `.army-board.com` so one login works across `ticket.army-board.com` and `merch.army-board.com`. Configure Supabase “Redirect URLs” to include both subdomains.

---

## 5. Migration steps (minimal user impact)

### Phase 1 – Prepare (no user-facing change)

1. **Domain**: Register or configure `army-board.com` and subdomains `ticket.army-board.com`, `merch.army-board.com` (DNS).
2. **DB**: Add migrations for merch (e.g. `listings.type`, `merch_categories`, `merch_subcategories`, and any merch-only columns). Backfill existing rows as `type = 'ticket'`.
3. **Code**: Implement merch in the same repo (categories, subcategories, merch post/edit, browse filtered by `type = 'merch'`). Keep feature behind a flag or only reachable via direct path (e.g. `/merch`) so current users are unaffected.

### Phase 2 – Subdomains and home (optional; can be after merch launch)

1. **Vercel**: Add `army-board.com`, `ticket.army-board.com`, `merch.army-board.com` to the same Vercel project; point DNS to Vercel.
2. **Middleware**: Route by host to hub vs ticket vs merch.
3. **Auth**: Set cookie domain to `.army-board.com` and add redirect URLs for both subdomains. Existing users keep logging in; next time they log in they get a cookie valid for both subdomains.
4. **Redirects**: From `army-ticket-board.com`:
   - 301 redirect `army-ticket-board.com` → `ticket.army-board.com` (or to `army-board.com` with a “Go to Listings” that goes to ticket subdomain). Keep this redirect for a long time so old links and bookmarks still work.

### Phase 3 – User communication

1. **Announce**: “We’re now army-board.com: Listings and Merch in one place. Your account and listings are unchanged; you can use ticket.army-board.com (or army-board.com → Listings).”
2. **In-app**: Small banner or footer link: “New: BTS Merch at merch.army-board.com” and “Home: army-board.com”.

### What users notice

- **If you only add merch under current domain**: Users see a new “Merch” entry (menu or home) and new flows; no change to existing ticket URLs or login.
- **If you add subdomains**: After redirects and cookie domain are set, users might land on `ticket.army-board.com` or `army-board.com`; login and data stay the same; no re-registration.

---

## 6. Merch-specific design (short)

- **Categories / subcategories**: Tables `merch_categories` and `merch_subcategories`; listing has `category_id`, `subcategory_id` (for `type = 'merch'`).
- **Same as listings**: Post flow, connections, bonding, preview, socials, agreement, chat, limits (e.g. 3 active listings, 3 connections), lock rules, notifications. Reuse RPCs and UI; branch only where merch fields or category filters are needed.
- **Browse**: Merch browse page filters `listings.type = 'merch'` and optionally by category/subcategory; otherwise same pattern as ticket browse.

---

## 7. Future: Events

- **Events** can be a third entry on the hub (`army-board.com`) and later a subdomain (e.g. `events.army-board.com`) if needed.
- Likely different model (events vs listings vs merch), so may warrant its own tables and flows; still can share users and auth from the same project and DB.

---

## 8. Summary

| Topic | Suggestion |
|-------|------------|
| **Project** | One Next.js project, one Supabase DB |
| **Listings vs merch** | Same `listings` table with `type` ('ticket' \| 'merch'); categories/subcategories for merch only |
| **Connections** | Reuse existing connections flow for merch |
| **Domains** | army-board.com (hub), ticket.army-board.com (listings), merch.army-board.com (merch) |
| **Migration** | Add merch in code + DB; then add subdomains and redirects; set cookie domain so one login works everywhere |
| **User impact** | Minimal: redirects preserve old URLs; no re-registration; optional banner for new merch and hub |

This gives you a clear path to add BTS merch with the same process as listings, share users and connections, and optionally move to army-board.com and subdomains with a low-friction migration.
