# Supabase schema for Army Ticket Board

## Run the migration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Paste and run `migrations/001_army_ticket_board_schema.sql`.
4. Then run `migrations/002_add_price_to_tickets.sql` to add the **price** column to `tickets`.
5. Run `migrations/003_chat_images.sql` to add **image_url** to `chat_messages` and create the **chat-attachments** storage bucket. If the bucket insert fails, create it manually in Dashboard → Storage.

Do **not** add a trigger on `auth.users` that inserts into `user_profiles`. Profiles are created from the client after signup.

## Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Extends `auth.users` (id, username, email, role). |
| `tickets` | Listed tickets; `owner_id` = seller. |
| `requests` | Buyer requests; seller accepts/rejects/closes. |
| `chats` | One per accepted request; seller can close. |
| `chat_messages` | Messages within a chat; optional `image_url` for attachments. |
| `reports` | Ticket reports (admin email via API). |

## Column mapping (DB → app)

- `seat_row` → `row` (SQL reserves `row`)
- `ticket_id` → `ticketId`
- `owner_id` → `ownerId`
- `requester_id` → `requesterId`
- `accepted_by` → `acceptedBy`
- `created_at` → `createdAt`
- `closed_at` → `closedAt`
- `request_id` → `requestId`
- `buyer_id` / `seller_id` → `buyerId` / `sellerId`
- `seat_preference` → `seatPreference`
- `ticket_summary` → `ticketSummary`
- etc. (snake_case → camelCase)

## RLS overview

- **Tickets**: `anon` + `authenticated` can SELECT (browse). Insert/update/delete only for owner.
- **user_profiles**: Authenticated can read all; insert/update own only.
- **Requests**: Requester, accepter, or ticket owner can read; requester can insert; ticket owner can update.
- **Chats**: Buyer/seller can read; seller can insert/update.
- **chat_messages**: Participant can read; participant can insert (only when chat is open).
- **Reports**: Reporter or ticket owner can read; authenticated can insert own.
