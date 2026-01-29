-- Reset all currently-available tickets back to pending review (for scam prevention sweep).
-- This will remove them from Browse until re-approved by an admin.

UPDATE public.tickets
SET
  listing_status = 'pending_review',
  claimed_by = NULL,
  claimed_at = NULL,
  rejection_reason = NULL
WHERE status = 'Available'
  AND listing_status = 'approved';

