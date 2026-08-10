
-- 1. New booking code default: PK{year}-{6 digits}
ALTER TABLE public.bookings
  ALTER COLUMN booking_code SET DEFAULT ('PK' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 1000000))::text, 6, '0'));

-- 2. Exit request flag (driver-initiated manual exit)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS exit_requested boolean NOT NULL DEFAULT false;

-- 3. Slot status sync trigger
CREATE OR REPLACE FUNCTION public.sync_slot_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'reserved' THEN
      UPDATE public.parking_slots SET status = 'reserved' WHERE id = NEW.slot_id;
    ELSIF NEW.status = 'active' THEN
      UPDATE public.parking_slots SET status = 'occupied' WHERE id = NEW.slot_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'active' THEN
        UPDATE public.parking_slots SET status = 'occupied' WHERE id = NEW.slot_id;
      ELSIF NEW.status = 'completed' OR NEW.status = 'cancelled' THEN
        UPDATE public.parking_slots SET status = 'available' WHERE id = NEW.slot_id;
      ELSIF NEW.status = 'reserved' THEN
        UPDATE public.parking_slots SET status = 'reserved' WHERE id = NEW.slot_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_sync_slot_status ON public.bookings;
CREATE TRIGGER bookings_sync_slot_status
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_slot_status();

-- 4. Reconcile existing rows so state is consistent
UPDATE public.parking_slots ps SET status = 'available'
WHERE NOT EXISTS (
  SELECT 1 FROM public.bookings b
  WHERE b.slot_id = ps.id AND b.status IN ('reserved','active')
);
UPDATE public.parking_slots ps SET status = 'reserved'
WHERE EXISTS (SELECT 1 FROM public.bookings b WHERE b.slot_id = ps.id AND b.status = 'reserved')
  AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.slot_id = ps.id AND b.status = 'active');
UPDATE public.parking_slots ps SET status = 'occupied'
WHERE EXISTS (SELECT 1 FROM public.bookings b WHERE b.slot_id = ps.id AND b.status = 'active');
