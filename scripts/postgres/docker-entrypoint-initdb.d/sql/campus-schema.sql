-- a2ui_campus database schema
-- Campus assistant tables: facilities, reservations, payments

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'gym' | 'study_room' | 'lab'
  location VARCHAR(255),
  capacity INTEGER,
  available BOOLEAN DEFAULT TRUE
);

-- Reservations table
-- Note: user_id and facility_id are not cross-database foreign keys.
-- user_id references users in a2ui_core (enforced at application layer).
-- facility_id references facilities in this database.
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date VARCHAR(50) NOT NULL, -- YYYY-MM-DD
  time_slot VARCHAR(50) NOT NULL, -- e.g. '09:00-11:00'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
-- Note: user_id references users in a2ui_core (enforced at application layer).
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'tuition' | 'utility' | 'network'
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'paid' | 'failed'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facilities_type ON facilities(type);
CREATE INDEX IF NOT EXISTS idx_facilities_available ON facilities(available);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_facility_id ON reservations(facility_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
