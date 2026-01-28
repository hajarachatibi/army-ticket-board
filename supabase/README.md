# Supabase schema for Army Ticket Board

## Run the migration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Paste and run `migrations/001_army_ticket_board_schema.sql`.
4. Then run `migrations/002_add_price_to_tickets.sql` to add the **price** column to `tickets`.
5. Run `migrations/003_chat_images.sql` to add **image_url** to `chat_messages` and create the **chat-attachments** storage bucket. If the bucket insert fails, create it manually in Dashboard → Storage.
6. Run `migrations/004_requests_buy_simplify.sql` to make `requests.event` and `requests.seat_preference` nullable (for the simple Buy flow).
7. Run `migrations/005_add_currency_to_tickets.sql` through `migrations/008_tickets_rls_fix.sql` in order (RLS fixes, currency).
8. Run `migrations/009_realtime_chat_messages.sql` to add `chat_messages` to the Realtime publication so new messages appear in the UI without refresh.
9. Run `migrations/010_requested_to_contacted.sql` to replace ticket status "Requested" with "Contacted".
10. Run `migrations/011_ticket_status_triggers.sql` so "Reported" persists (trigger on reports insert). "Contacted" is user-specific and not stored.
11. Run `migrations/012_remove_contacted_reported_status.sql` to remove Contacted and Reported statuses; keep only Available and Sold.
12. Run `migrations/016_ticket_filter_options_rpc.sql` to add `get_ticket_filter_options` RPC so filter dropdowns show all distinct values (not just the first page).
13. Run `migrations/017_banned_users.sql` to create `banned_users` and add the initial banned emails. Admins can manage bans later from the admin panel.
14. Run `migrations/018_admin_users_and_reports_rls.sql` to set admin users (tomkoods2020@gmail.com, achatibihajar@gmail.com) and allow admins to SELECT all reports. Ensure both have signed in at least once so they exist in `user_profiles`.
15. Run `migrations/019_admin_messages_and_rpcs.sql` to add `admin_messages`, `admin_ban_and_delete_user`, `admin_delete_ticket`, `admin_list_sellers` / `admin_list_buyers` / `admin_list_all_users`, and `admin_send_message` for the admin panel.
16. Run `migrations/020_user_profiles_last_login.sql` to add `last_login_at` to `user_profiles` (updated on each OAuth login).
17. Run `migrations/021_admin_pagination_user_details.sql` to add paged admin list RPCs (sellers, buyers, all users) with `created_at` / `last_login_at`, and send-to-all messaging RPCs.
18. Run `migrations/022_admin_search_reports_tickets_banned.sql` to add `admin_reports_with_details`, `admin_tickets_paged` (owner email, search by gmail), `admin_list_banned`, and user-list search (name/email). Replaces report/ticket fetches and extends user list RPCs with `p_search`.

**Google OAuth:** Enable **Google** in Supabase Dashboard → **Authentication** → **Providers** → **Google**. Add your Client ID and Secret from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Set **Redirect URL** in Google OAuth config to `https://<your-project-ref>.supabase.co/auth/v1/callback`. In Supabase → **Authentication** → **URL Configuration**, add your app redirect URLs (e.g. `http://localhost:3000/**`, `https://your-domain.com/**`). Profiles are created from the client when the user first signs in with Google (username = email, email from Google).

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
- **Reports**: Reporter, ticket owner, or admin can read; authenticated can insert own.
