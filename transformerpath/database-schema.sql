-- TransformerPath.com PostgreSQL Database Schema
-- Complete schema with all tables, indexes, and relationships

-- ===================== USERS & AUTH =====================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company VARCHAR(255),
  avatar_url VARCHAR(500),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_expires DATE,
  stripe_customer_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier);
CREATE INDEX idx_users_stripe ON users(stripe_customer_id);

-- ===================== COURSES & CHAPTERS =====================

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  cover_image_url VARCHAR(500),
  duration_hours INT,
  difficulty_level VARCHAR(50),
  price DECIMAL(10,2) DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id),
  chapter_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  content TEXT,
  video_url VARCHAR(500),
  duration_minutes INT,
  is_free BOOLEAN DEFAULT false,
  order_index INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chapters_course ON chapters(course_id);
CREATE INDEX idx_chapters_free ON chapters(is_free);
CREATE UNIQUE INDEX idx_chapters_unique ON chapters(course_id, chapter_number);

-- ===================== USER PROGRESS =====================

CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id),
  completed BOOLEAN DEFAULT false,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  last_accessed TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_chapter ON user_progress(chapter_id);
CREATE UNIQUE INDEX idx_user_progress_unique ON user_progress(user_id, chapter_id);

-- ===================== DAILY INTEL / ARTICLES =====================

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  excerpt TEXT,
  content TEXT,
  source VARCHAR(255),
  source_url VARCHAR(500),
  author VARCHAR(100),
  category VARCHAR(100),
  region VARCHAR(100),
  tags TEXT,
  cover_image_url VARCHAR(500),
  published_date DATE NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  views INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_articles_date ON articles(published_date DESC);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_region ON articles(region);
CREATE INDEX idx_articles_premium ON articles(is_premium);

-- ===================== SAVED ARTICLES =====================

CREATE TABLE IF NOT EXISTS saved_articles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id),
  saved_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_saved_articles_unique ON saved_articles(user_id, article_id);

-- ===================== EVENTS & REGISTRATIONS =====================

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  description TEXT,
  event_date TIMESTAMP NOT NULL,
  duration_minutes INT,
  location VARCHAR(255),
  type VARCHAR(50),
  is_premium BOOLEAN DEFAULT false,
  max_attendees INT,
  cover_image_url VARCHAR(500),
  registration_open BOOLEAN DEFAULT true,
  zoom_link VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_premium ON events(is_premium);

CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id),
  registered_at TIMESTAMP DEFAULT NOW(),
  attended BOOLEAN DEFAULT false
);

CREATE UNIQUE INDEX idx_event_reg_unique ON event_registrations(user_id, event_id);

-- ===================== MANUFACTURERS =====================

CREATE TABLE IF NOT EXISTS manufacturers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  logo_url VARCHAR(500),
  description TEXT,
  website VARCHAR(500),
  email VARCHAR(255),
  phone VARCHAR(20),
  country VARCHAR(100),
  region VARCHAR(100),
  product_type VARCHAR(100),
  capacity_range VARCHAR(100),
  certifications TEXT,
  rating DECIMAL(3,2),
  reviews_count INT DEFAULT 0,
  founded_year INT,
  employee_count INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_manufacturers_region ON manufacturers(region);
CREATE INDEX idx_manufacturers_type ON manufacturers(product_type);
CREATE INDEX idx_manufacturers_country ON manufacturers(country);

-- ===================== TOOLS & CALCULATORS =====================

CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  description TEXT,
  tool_type VARCHAR(100),
  is_free BOOLEAN DEFAULT false,
  url VARCHAR(500),
  icon_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===================== SUBSCRIPTIONS & PAYMENTS =====================

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255),
  plan_tier VARCHAR(50),
  status VARCHAR(50),
  current_period_start DATE,
  current_period_end DATE,
  auto_renew BOOLEAN DEFAULT true,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  subscription_id INTEGER REFERENCES subscriptions(id),
  stripe_payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(10),
  status VARCHAR(50),
  invoice_number VARCHAR(100),
  invoice_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ===================== DOWNLOADS & RESOURCES =====================

CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  resource_name VARCHAR(255),
  file_url VARCHAR(500),
  file_size_bytes INT,
  downloaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_downloads_user ON downloads(user_id);

-- ===================== ADMIN & LOGGING =====================

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id),
  action VARCHAR(255),
  entity_type VARCHAR(100),
  entity_id INTEGER,
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_date ON admin_logs(created_at DESC);

-- ===================== API KEYS =====================

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255),
  name VARCHAR(255),
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- ===================== NOTIFICATIONS =====================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100),
  title VARCHAR(255),
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ===================== SAMPLE DATA =====================

-- Insert sample courses
INSERT INTO courses (title, slug, description, price, is_free)
VALUES (
  'Transformer Design Masterclass',
  'tx-design-masterclass',
  'Complete guide to transformer design from electromagnetic principles to manufacturing',
  199,
  false
) ON CONFLICT DO NOTHING;

-- Insert sample free chapters
INSERT INTO chapters (course_id, chapter_number, title, slug, is_free)
SELECT id, 1, 'Introduction to Transformers', 'intro', true FROM courses WHERE slug = 'tx-design-masterclass'
ON CONFLICT DO NOTHING;

INSERT INTO chapters (course_id, chapter_number, title, slug, is_free)
SELECT id, 2, 'Electromagnetic Principles', 'em-principles', true FROM courses WHERE slug = 'tx-design-masterclass'
ON CONFLICT DO NOTHING;

INSERT INTO chapters (course_id, chapter_number, title, slug, is_free)
SELECT id, 3, 'Thermal Modeling', 'thermal-modeling', true FROM courses WHERE slug = 'tx-design-masterclass'
ON CONFLICT DO NOTHING;

-- Insert sample tools
INSERT INTO tools (name, slug, description, tool_type, is_free)
VALUES
  ('Thermal Rise Calculator', 'thermal-calc', 'Calculate transformer temperature rise', 'calculator', true),
  ('Core Loss Calculator', 'core-loss-calc', 'Compute core losses and efficiency', 'calculator', true),
  ('Impedance Calculator', 'impedance-calc', 'Calculate short-circuit impedance', 'calculator', false)
ON CONFLICT DO NOTHING;

-- ===================== VIEWS =====================

CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT up.chapter_id) as chapters_completed,
  COUNT(DISTINCT er.event_id) as events_attended,
  COUNT(DISTINCT sa.article_id) as articles_saved
FROM users u
LEFT JOIN user_progress up ON u.id = up.user_id AND up.completed = true
LEFT JOIN event_registrations er ON u.id = er.user_id AND er.attended = true
LEFT JOIN saved_articles sa ON u.id = sa.user_id
GROUP BY u.id, u.email, u.subscription_tier;

CREATE OR REPLACE VIEW revenue_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  COUNT(DISTINCT user_id) as unique_users
FROM payments
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ===================== TRIGGERS =====================

CREATE OR REPLACE FUNCTION update_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_updated_at();

CREATE TRIGGER trigger_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION update_user_updated_at();

CREATE TRIGGER trigger_chapters_updated_at
BEFORE UPDATE ON chapters
FOR EACH ROW
EXECUTE FUNCTION update_user_updated_at();

-- ===================== GRANTS (for app user) =====================

-- Create app user if doesn't exist
DO $$
BEGIN
  CREATE USER app_user WITH PASSWORD 'secure_password_here';
EXCEPTION WHEN DUPLICATE_OBJECT THEN
  NULL;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
