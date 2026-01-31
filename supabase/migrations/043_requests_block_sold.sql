-- Important: once a ticket is Sold, no new requests allowed.
-- Also: only allow requests for approved listings.

DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.status = 'Available'
        AND t.listing_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "requests_insert_anon" ON public.requests;
CREATE POLICY "requests_insert_anon"
  ON public.requests FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND requester_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.status = 'Available'
        AND t.listing_status = 'approved'
    )
  );

