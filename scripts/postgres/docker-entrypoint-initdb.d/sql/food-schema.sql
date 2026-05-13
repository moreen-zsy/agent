-- a2ui_food database schema
-- Food ordering tables: dishes, orders, order_status_history, user_addresses

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
  order_no VARCHAR(32) NOT NULL UNIQUE,
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'
  address TEXT,
  phone VARCHAR(20),
  contact_name VARCHAR(100),
  note TEXT,
  delivery_type VARCHAR(20) DEFAULT 'delivery',
  estimated_time TIMESTAMP WITH TIME ZONE,
  payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid' | 'paid' | 'refunded'
  payment_method VARCHAR(20), -- 'wechat' | 'alipay' | 'cash'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  prev_status VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User addresses table
-- Note: user_id references users in a2ui_core (enforced at application layer).
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  label VARCHAR(50), -- '家' | '公司' | '学校'
  address TEXT NOT NULL,
  phone VARCHAR(20),
  contact_name VARCHAR(100),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);
CREATE INDEX IF NOT EXISTS idx_dishes_available ON dishes(available);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
