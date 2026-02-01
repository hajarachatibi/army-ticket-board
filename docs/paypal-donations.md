# PayPal donations (secure Smart Buttons)

## What you get

- **Client-side PayPal Smart Buttons** rendered in a confirmation modal on `/support`
- **Server-side order creation + capture** (PayPal secret stays on server)
- **Server-side verification** that the captured payment matches your configured amount (and optional merchant id)
- A simple **thank-you page** at `/support/thank-you`

## 1) Create / configure your PayPal Business account

1. Use a **PayPal Business** account (not Personal).
2. In PayPal Developer Dashboard, create an app to obtain:
   - **Client ID** (public)
   - **Secret** (server-only)
3. (Recommended) Copy your **Merchant ID** (used to lock payee).

## 2) Environment variables

Add these to your hosting provider (or `.env.local` for local dev):

```bash
# Show /support page
NEXT_PUBLIC_ENABLE_SUPPORT_PAGE=true

# Public (safe in browser)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID

# Server-only (NEVER expose to client)
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_SECRET

# Optional but recommended: lock payee to your business merchant id
PAYPAL_MERCHANT_ID=YOUR_MERCHANT_ID

# sandbox | live (defaults to sandbox if unset)
PAYPAL_ENV=sandbox

# Donation amount is user-entered, but still enforced server-side.
# Currency is user-selectable, but only from a server-controlled allowlist.
DONATION_CURRENCY=USD
DONATION_ALLOWED_CURRENCIES=USD,EUR,GBP

# Donation mode:
# - custom: user can type an amount (min/max enforced server-side)
# - tiers: user can pick preset amounts from DONATION_TIERS
DONATION_MODE=custom

# Default shown in the UI input (also used if user leaves it blank)
DONATION_AMOUNT=5.00

# Server-enforced bounds for custom amounts
DONATION_MIN_AMOUNT=1.00
DONATION_MAX_AMOUNT=500.00

# Optional wallets (eligibility varies)
# Examples: "applepay" or "applepay,googlepay"
NEXT_PUBLIC_PAYPAL_ENABLE_FUNDING=applepay,googlepay
```

## 3) How this prevents “button hijacking”

This integration is designed so the **browser cannot choose where funds go**:

- The browser never sees your **PayPal secret**.
- The browser **does not send** the donation amount/currency/payee to PayPal.
- Instead, the browser calls your server routes:
  - `POST /api/paypal/create-order`
  - `POST /api/paypal/capture-order`
- Those routes create/capture orders using your secret and **enforce**:
  - The **donation bounds** (`DONATION_MIN_AMOUNT`/`DONATION_MAX_AMOUNT`) in custom mode
  - The **currency allowlist** (`DONATION_ALLOWED_CURRENCIES`)
  - The **payee** (optionally locked to `PAYPAL_MERCHANT_ID`)

Even if a malicious user tampers with the client JavaScript, your server still creates an order for **your** PayPal account and only for the configured amount.

## 4) Notes on cards / Apple Pay / Google Pay

- **Cards**: The modal renders both a PayPal button and a Card button. Card eligibility varies by country/account settings.
- **Apple Pay / Google Pay**: Only appears when enabled in PayPal and when the donor/device is eligible. You can toggle additional wallets with `NEXT_PUBLIC_PAYPAL_ENABLE_FUNDING`.

