-- ============================================================
-- YA Core VRP - Supabase Database Setup
-- Run this ENTIRE script in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create role enum type
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'volunteer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE: profiles_core
-- ============================================
CREATE TABLE IF NOT EXISTS profiles_core (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'volunteer',
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: profiles_data
-- ============================================
CREATE TABLE IF NOT EXISTS profiles_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  alt_phone TEXT DEFAULT '',
  email_secondary TEXT DEFAULT '',
  address_line1 TEXT DEFAULT '',
  address_line2 TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  country TEXT DEFAULT '',
  date_of_birth DATE,
  gender TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  blood_type TEXT DEFAULT '',
  emergency_contact_name TEXT DEFAULT '',
  emergency_contact_phone TEXT DEFAULT '',
  emergency_contact_relation TEXT DEFAULT '',
  uniform_size TEXT DEFAULT '',
  t_shirt_size TEXT DEFAULT '',
  shoe_size TEXT DEFAULT '',
  cap_size TEXT DEFAULT '',
  skills TEXT DEFAULT '',
  languages TEXT DEFAULT '',
  certifications TEXT DEFAULT '',
  dietary_reqs TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  medical_conditions TEXT DEFAULT '',
  medications TEXT DEFAULT '',
  availability TEXT DEFAULT '',
  preferred_location TEXT DEFAULT '',
  preferred_shift TEXT DEFAULT '',
  transportation TEXT DEFAULT '',
  has_vehicle BOOLEAN DEFAULT FALSE,
  vehicle_type TEXT DEFAULT '',
  license_number TEXT DEFAULT '',
  years_of_experience INTEGER DEFAULT 0,
  previous_events TEXT DEFAULT '',
  specializations TEXT DEFAULT '',
  education TEXT DEFAULT '',
  occupation TEXT DEFAULT '',
  organization TEXT DEFAULT '',
  department TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  social_media TEXT DEFAULT '',
  reference_name TEXT DEFAULT '',
  reference_phone TEXT DEFAULT '',
  volunteer_id_number TEXT DEFAULT '',
  joining_date DATE,
  status TEXT DEFAULT 'active',
  zone_assigned TEXT DEFAULT '',
  team_assigned TEXT DEFAULT '',
  accommodation_needed BOOLEAN DEFAULT FALSE,
  accommodation_details TEXT DEFAULT '',
  travel_mode TEXT DEFAULT '',
  arrival_date DATE,
  departure_date DATE,
  special_needs TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: profiles_sensitive (Admin-Only)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles_sensitive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  id_proof_url TEXT DEFAULT '',
  id_proof_type TEXT DEFAULT '',
  id_proof_number TEXT DEFAULT '',
  background_check_status TEXT DEFAULT 'pending',
  background_check_date DATE,
  background_check_notes TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  flag_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: inventory_logs
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  issued_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_user_item_year ON inventory_logs(user_id, item_type, year);
CREATE INDEX IF NOT EXISTS idx_profiles_core_user_id ON profiles_core(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_core_role ON profiles_core(role);
CREATE INDEX IF NOT EXISTS idx_profiles_data_user_id ON profiles_data(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_sensitive_user_id ON profiles_sensitive(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- profiles_core RLS
ALTER TABLE profiles_core ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own core profile"
  ON profiles_core FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all core profiles"
  ON profiles_core FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Users can update own core profile"
  ON profiles_core FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all core profiles"
  ON profiles_core FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Allow insert for new profiles"
  ON profiles_core FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- profiles_data RLS
ALTER TABLE profiles_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile data"
  ON profiles_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile data"
  ON profiles_data FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Users can update own profile data"
  ON profiles_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all profile data"
  ON profiles_data FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Users can insert own profile data"
  ON profiles_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- profiles_sensitive RLS (ADMIN ONLY - Volunteers get 403)
ALTER TABLE profiles_sensitive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view sensitive data"
  ON profiles_sensitive FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Only admins can update sensitive data"
  ON profiles_sensitive FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Only admins can insert sensitive data"
  ON profiles_sensitive FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

-- inventory_logs RLS
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory"
  ON inventory_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all inventory"
  ON inventory_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

CREATE POLICY "Admins can insert inventory"
  ON inventory_logs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.user_id = auth.uid() AND pc.role = 'admin')
  );

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles_core (user_id, full_name, role, qr_code_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'volunteer',
    NEW.id::TEXT
  );

  INSERT INTO profiles_data (user_id)
  VALUES (NEW.id);

  INSERT INTO profiles_sensitive (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- DONE! Tables, RLS, and triggers are set up.
-- ============================================
