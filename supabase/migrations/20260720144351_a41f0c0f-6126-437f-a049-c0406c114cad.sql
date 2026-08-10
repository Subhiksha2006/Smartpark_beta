
-- Roles
CREATE TYPE public.app_role AS ENUM ('driver', 'admin');
CREATE TYPE public.slot_status AS ENUM ('available', 'occupied', 'reserved');
CREATE TYPE public.booking_status AS ENUM ('reserved', 'active', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  vehicle_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Profiles RLS
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles RLS
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Parking slots
CREATE TABLE public.parking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  sensor_id TEXT UNIQUE,
  status public.slot_status NOT NULL DEFAULT 'available',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parking_slots TO authenticated;
GRANT ALL ON public.parking_slots TO service_role;
ALTER TABLE public.parking_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots_select_all_authenticated" ON public.parking_slots FOR SELECT TO authenticated USING (true);

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT NOT NULL UNIQUE DEFAULT ('BK' || lpad((floor(random()*1000000))::text, 6, '0')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.parking_slots(id),
  vehicle_number TEXT NOT NULL,
  estimated_duration_hours NUMERIC(6,2) NOT NULL DEFAULT 1,
  status public.booking_status NOT NULL DEFAULT 'reserved',
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  duration_minutes INT,
  amount NUMERIC(10,2),
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_select_own_or_admin" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_update_own_or_admin" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Sensor events
CREATE TABLE public.sensor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id TEXT NOT NULL,
  occupied BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sensor_events TO authenticated;
GRANT ALL ON public.sensor_events TO service_role;
ALTER TABLE public.sensor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sensor_events_admin_read" ON public.sensor_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_slots_updated BEFORE UPDATE ON public.parking_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Handle new user: create profile + role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, vehicle_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'vehicle_number'
  );
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'driver');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed slots
INSERT INTO public.parking_slots (code, sensor_id) VALUES
  ('A1', 'sensor_a1'), ('A2', 'sensor_a2'), ('A3', 'sensor_a3'),
  ('A4', 'sensor_a4'), ('A5', 'sensor_a5'), ('A6', 'sensor_a6'),
  ('B1', 'sensor_b1'), ('B2', 'sensor_b2'), ('B3', 'sensor_b3'),
  ('B4', 'sensor_b4'), ('B5', 'sensor_b5'), ('B6', 'sensor_b6');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
