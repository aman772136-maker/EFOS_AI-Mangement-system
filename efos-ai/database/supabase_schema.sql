-- ==========================================================
-- EFOS AI - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor if you want to
-- manually set up or verify all tables and sample data.
-- ==========================================================

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT DEFAULT NULL,
  qualification TEXT DEFAULT NULL,
  source TEXT DEFAULT 'website',
  course_interest TEXT DEFAULT NULL,
  status TEXT DEFAULT 'New',
  lead_score INTEGER DEFAULT 0,
  score_category TEXT DEFAULT NULL,
  website_visits INTEGER DEFAULT 0,
  brochure_downloaded BOOLEAN DEFAULT FALSE,
  age INTEGER DEFAULT NULL,
  last_message TEXT DEFAULT NULL,
  last_message_channel TEXT DEFAULT NULL,
  last_message_at TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Counselors Table
CREATE TABLE IF NOT EXISTS counselors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'active'
);

-- 3. Counselor Assignments Table
CREATE TABLE IF NOT EXISTS counselor_assignments (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  counselor_name TEXT,
  assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  notified BOOLEAN DEFAULT FALSE
);

-- 4. Counselor Config Table
CREATE TABLE IF NOT EXISTS counselor_config (
  id INTEGER PRIMARY KEY,
  assignmentMode TEXT,
  counselors TEXT,
  roundRobin TEXT
);

-- 5. Seed Initial Counselors (if empty)
INSERT INTO counselors (id, name, email, status)
VALUES 
  (1, 'Alex Johnson', 'alex@efos.ai', 'active'),
  (2, 'Sarah Martinez', 'sarah@efos.ai', 'active'),
  (3, 'Mike Chen', 'mike@efos.ai', 'active')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for counselors
SELECT setval(pg_get_serial_sequence('counselors', 'id'), COALESCE(max(id), 1)) FROM counselors;

