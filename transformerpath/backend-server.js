/**
 * TransformerPath.com Backend API Server
 * Complete Express.js server with all endpoints
 *
 * Setup:
 * 1. npm install express cors dotenv bcryptjs jsonwebtoken pg
 * 2. Create .env file with DB_URL, JWT_SECRET, STRIPE_KEY
 * 3. node backend-server.js
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '24h';

// ==================== AUTH MIDDLEWARE ====================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ==================== UTILITY FUNCTIONS ====================

async function findUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ==================== AUTH ENDPOINTS ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, company, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, company, subscription_tier, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, first_name, last_name, company, subscription_tier`,
      [email, hashedPassword, firstName, lastName, company || null, 'free']
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        subscription_tier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        subscription_tier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    // TODO: Generate reset token and send email
    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    res.status(500).json({ message: 'Password reset failed' });
  }
});

// ==================== USER ENDPOINTS ====================

// Get user profile
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      company: user.company,
      subscription_tier: user.subscription_tier,
      subscription_expires: user.subscription_expires,
      created_at: user.created_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update user profile
app.put('/api/user', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, company } = req.body;
    const result = await pool.query(
      `UPDATE users
       SET first_name = $1, last_name = $2, company = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [firstName, lastName, company, req.user.id]
    );

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      company: user.company
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Change password
app.post('/api/user/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await findUserById(req.user.id);

    const passwordMatch = await comparePassword(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Get user activity
app.get('/api/user/activity', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM user_progress
       WHERE user_id = $1
       ORDER BY last_accessed DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activity' });
  }
});

// ==================== COURSES ENDPOINTS ====================

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
});

// Get course details
app.get('/api/courses/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch course' });
  }
});

// Get chapters
app.get('/api/chapters', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    const isPro = user.subscription_tier === 'pro' || user.subscription_tier === 'enterprise';

    let query = 'SELECT * FROM chapters WHERE is_free = true';
    if (isPro) {
      query = 'SELECT * FROM chapters';
    }

    const result = await pool.query(query + ' ORDER BY chapter_number');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch chapters' });
  }
});

// Get chapter content
app.get('/api/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM chapters WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const chapter = result.rows[0];
    if (!chapter.is_free) {
      const user = await findUserById(req.user.id);
      if (user.subscription_tier !== 'pro' && user.subscription_tier !== 'enterprise') {
        return res.status(403).json({ message: 'Pro subscription required' });
      }
    }

    res.json(chapter);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch chapter' });
  }
});

// Mark chapter complete
app.post('/api/chapters/:id/mark-complete', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO user_progress (user_id, chapter_id, completed, last_accessed)
       VALUES ($1, $2, true, NOW())
       ON CONFLICT (user_id, chapter_id)
       DO UPDATE SET completed = true, last_accessed = NOW()`,
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Chapter marked as complete' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update progress' });
  }
});

// Get user progress
app.get('/api/user/progress', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch progress' });
  }
});

// ==================== ARTICLES ENDPOINTS ====================

// Get articles
app.get('/api/articles', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    const isPro = user.subscription_tier === 'pro' || user.subscription_tier === 'enterprise';

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM articles WHERE is_premium = false';
    let params = [];

    if (req.query.category) {
      query += ' AND category = $' + (params.length + 1);
      params.push(req.query.category);
    }

    if (req.query.region) {
      query += ' AND region = $' + (params.length + 1);
      params.push(req.query.region);
    }

    query += ' ORDER BY published_date DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch articles' });
  }
});

// Get article detail
app.get('/api/articles/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM articles WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch article' });
  }
});

// Search articles
app.get('/api/articles/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const result = await pool.query(
      `SELECT * FROM articles
       WHERE title ILIKE $1 OR content ILIKE $1
       ORDER BY published_date DESC`,
      [`%${query}%`]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search articles' });
  }
});

// ==================== EVENTS ENDPOINTS ====================

// Get events
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

// Get event detail
app.get('/api/events/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch event' });
  }
});

// RSVP to event
app.post('/api/events/:id/register', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO event_registrations (user_id, event_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Successfully registered for event' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register for event' });
  }
});

// Get user's events
app.get('/api/user/events', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.* FROM events e
       JOIN event_registrations er ON e.id = er.event_id
       WHERE er.user_id = $1
       ORDER BY e.event_date`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user events' });
  }
});

// ==================== MANUFACTURERS ENDPOINTS ====================

// Get manufacturers
app.get('/api/manufacturers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM manufacturers';
    let params = [];

    if (req.query.region) {
      query += ' WHERE region = $' + (params.length + 1);
      params.push(req.query.region);
    }

    if (req.query.type) {
      if (params.length > 0) query += ' AND';
      else query += ' WHERE';
      query += ' product_type = $' + (params.length + 1);
      params.push(req.query.type);
    }

    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch manufacturers' });
  }
});

// Get manufacturer detail
app.get('/api/manufacturers/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM manufacturers WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Manufacturer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch manufacturer' });
  }
});

// Contact manufacturer
app.post('/api/manufacturers/:id/contact', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const user = await findUserById(req.user.id);

    // TODO: Send email to manufacturer
    res.json({ message: 'Contact request sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send contact request' });
  }
});

// ==================== BILLING ENDPOINTS ====================

// Get subscription plans
app.get('/api/billing/plans', (req, res) => {
  res.json([
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'free'
    },
    {
      id: 'pro_yearly',
      name: 'Pro',
      price: 199,
      interval: 'year'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: null,
      interval: 'custom'
    }
  ]);
});

// Create subscription
app.post('/api/billing/subscribe', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.body;

    if (planId !== 'pro_yearly') {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    // TODO: Create Stripe checkout session
    const sessionId = 'cs_test_PLACEHOLDER';

    res.json({ sessionId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create subscription' });
  }
});

// Cancel subscription
app.post('/api/billing/cancel', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE subscriptions SET status = $1 WHERE user_id = $2',
      ['canceled', req.user.id]
    );

    res.json({ message: 'Subscription canceled' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// Get invoices
app.get('/api/billing/invoices', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
});

// Stripe webhook
app.post('/api/billing/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    // TODO: Verify Stripe signature and process webhook
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await findUserById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, subscription_tier, created_at FROM users'
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get analytics (admin only)
app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE subscription_tier = 'pro') as pro_users,
        (SELECT COUNT(*) FROM user_progress WHERE completed = true) as chapters_completed,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_revenue
    `);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`TransformerPath API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
