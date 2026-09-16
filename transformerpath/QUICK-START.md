# TransformerPath.com - Quick Start Guide

## ⚡ Get Running in 5 Minutes (Docker)

### Prerequisites
- Docker Desktop (https://www.docker.com/products/docker-desktop)
- Docker Compose (included with Docker Desktop)

### Start the Platform

```bash
# Navigate to project directory
cd /Users/nishadpathak/Documents/Claude/Projects/Transformer\ Equipments/transformerpath

# Copy environment file
cp .env.example .env

# Edit .env with your settings (especially Stripe keys)
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Access the Platform

- **Frontend**: http://localhost
- **API**: http://localhost:3001/api
- **Database**: localhost:5432
- **Health Check**: http://localhost:3001/api/health

### Initial Setup

```bash
# The database schema is automatically created on first run
# Wait for "service healthy" in logs (~30 seconds)

# Verify database connection
docker-compose exec postgres psql -U app_user -d transformerpath -c "SELECT * FROM users;"

# View Nginx logs
docker-compose logs nginx
```

### Test Login

1. Open http://localhost
2. Go to Register page
3. Create account
4. Login with credentials

### Stop Platform

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

---

## 🔧 Local Development (Without Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 15
- npm/yarn

### Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Create PostgreSQL database
createdb transformerpath

# 3. Initialize schema
psql transformerpath < database-schema.sql

# 4. Copy and configure environment
cp .env.example .env
# Edit .env file with your local settings

# 5. Start backend server
npm start
# Or with auto-reload:
npm run dev

# 6. In another terminal, serve frontend
# Using Python 3:
cd frontend && python -m http.server 8000
# Or using Node:
npx http-server frontend

# 7. Open browser
open http://localhost:8000
```

---

## 📋 Configuration

### Update .env for Development

```env
NODE_ENV=development
DATABASE_URL=postgresql://app_user:password@localhost:5432/transformerpath
JWT_SECRET=dev-secret-key-change-in-production
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
```

### Get Stripe Test Keys

1. Go to https://dashboard.stripe.com
2. Sign up or login
3. Navigate to "Developers" > "API keys"
4. Copy test keys (starts with `sk_test_` and `pk_test_`)

### Get SendGrid API Key

1. Go to https://sendgrid.com
2. Create account or login
3. Create API key in "Settings" > "API Keys"

---

## 🧪 Testing

### Create Test User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "company": "Test Corp",
    "password": "SecurePassword123!"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

Copy the returned `token` and use in API calls:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/user
```

### Test Database

```bash
# Connect to database
psql transformerpath -U app_user

# View users
SELECT * FROM users;

# View courses
SELECT * FROM courses;

# Exit
\q
```

---

## 🚀 Deploy to Production

### Option 1: DigitalOcean (Recommended)

1. Create DigitalOcean account (https://m.do.co)
2. Create App (connect to GitHub repository)
3. Configure environment variables in dashboard
4. Deploy from GitHub with auto-deploys

See `DEPLOYMENT.md` for detailed guide.

### Option 2: Docker to Any Server

```bash
# Build image
docker build -t transformerpath:latest .

# Push to registry
docker tag transformerpath:latest your-registry/transformerpath:latest
docker push your-registry/transformerpath:latest

# Deploy with docker-compose on server
ssh your-server
docker-compose pull
docker-compose up -d
```

---

## 🔍 Troubleshooting

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3002
```

### Database Connection Failed

```bash
# Check if database is running
docker-compose ps

# View database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### Can't Connect to Database Locally

```bash
# Verify PostgreSQL is running
psql --version

# Connect with verbose output
psql -h localhost -U app_user -d transformerpath -c "SELECT NOW();"

# Check connection string in .env
```

### Frontend showing 404

Make sure:
1. Nginx container is running: `docker-compose ps`
2. Frontend files are in correct path
3. Check nginx logs: `docker-compose logs nginx`
4. Restart nginx: `docker-compose restart nginx`

### API returning 500 errors

```bash
# Check backend logs
docker-compose logs backend

# Make sure database is healthy
docker-compose exec postgres psql -U app_user -d transformerpath -c "SELECT 1;"

# Restart backend
docker-compose restart backend
```

---

## 📚 Next Steps

1. **Read**: `INTEGRATION-GUIDE.md` (high-level overview)
2. **Read**: `DEPLOYMENT.md` (production setup)
3. **Read**: `docs/API.md` (API reference)
4. **Customize**: Update branding, logo, colors
5. **Configure**: Set up Stripe, email, analytics
6. **Test**: Create accounts, test payments
7. **Deploy**: Push to production

---

## 💬 Support

- **Documentation**: See `docs/` folder
- **API Reference**: `docs/API.md`
- **Deployment Guide**: `DEPLOYMENT.md`
- **Integration**: `INTEGRATION-GUIDE.md`
- **Project Summary**: `PROJECT_SUMMARY.md`

---

## ⚡ Quick Commands

```bash
# Docker commands
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # View live logs
docker-compose ps             # Show status
docker-compose restart        # Restart services

# Database
docker-compose exec postgres psql -U app_user -d transformerpath

# Backend
npm install                   # Install dependencies
npm start                     # Start server
npm run dev                   # Development with auto-reload

# Cleanup
docker-compose down -v        # Remove everything including data
```

Enjoy building with TransformerPath! 🚀
