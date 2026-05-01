-- a2ui_food database schema
-- Food ordering tables: dishes, orders

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dishes table
CREATE TABLE IF NOT EXISTS dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  full_description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image TEXT,
  category VARCHAR(50) NOT NULL,
  tags JSONB,
  ingredients JSONB,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
-- Note: user_id references users in a2ui_core, but cross-database foreign keys
-- are not supported. Integrity is enforced at application layer.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);
CREATE INDEX IF NOT EXISTS idx_dishes_available ON dishes(available);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
