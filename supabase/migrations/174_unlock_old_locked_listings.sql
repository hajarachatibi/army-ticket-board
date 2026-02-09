-- Unlock listings that were locked under the old "one active connection per listing" rule.
-- With the new rule (3 active connections per seller total, no per-listing lock), these
-- should be active and have no locked_by.

-- Set status to active and clear lock fields for listings currently marked locked
UPDATE public.listings
SET status = 'active', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
WHERE status = 'locked';

-- Clear stale locked_by on listings that are active but still have lock fields set
UPDATE public.listings
SET locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
WHERE status = 'active' AND (locked_by IS NOT NULL OR locked_at IS NOT NULL OR lock_expires_at IS NOT NULL);
