# TransformerPath.com - Production Deployment Guide

## 🎯 Deployment Overview

Choose your hosting platform based on your needs:

| Platform | Cost | Ease | Scalability | Recommendation |
|----------|------|------|-------------|-----------------|
| **DigitalOcean** | $50-150/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Best for SaaS |
| **AWS** | $100-500/mo | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Large scale |
| **Heroku** | $150-300/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Quick launch |
| **Google Cloud** | $100-400/mo | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Enterprise |

---

## 🟦 Option 1: DigitalOcean App Platform (Recommended)

### Benefits
✅ Simplest setup (~30 minutes)  
✅ Auto-scaling  
✅ Built-in SSL  
✅ GitHub integration  
✅ Managed database  

### Step 1: Prepare Your Repository

```bash
# Navigate to your project
cd /Users/nishadpathak/Documents/Claude/Projects/Transformer\ Equipments/transformerpath

# Initialize git if needed
git init
git add .
git commit -m "Initial TransformerPath platform"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/transformerpath.git
git push -u origin main
```

### Step 2: Create DigitalOcean Account

1. Sign up: https://m.do.co/c/5c87c73e6db9 (includes $200 credit)
2. Add payment method
3. Create new project "TransformerPath"

### Step 3: Create App Platform Application

1. In DigitalOcean dashboard, click "Create" > "Apps"
2. Select your GitHub repository
3. Configure as follows:

**Service 1: Backend API (Node.js)**
```
Name: transformerpath-api
Source: GitHub repository
Build command: npm install
Run command: node backend-server.js
HTTP port: 3001
```

**Service 2: PostgreSQL Database**
```
Name: transformerpath-db
Database: PostgreSQL 15
Cluster name: transformerpath-postgres
```

**Service 3: Static Frontend**
```
Name: transformerpath-web
Source: GitHub (frontend folder)
Build command: (leave blank)
Serve static site
Output directory: ./
```

### Step 4: Configure Environment Variables

In App Platform dashboard, add environment variables:

```
DATABASE_URL=postgresql://app:PASSWORD@db-postgresql-nyc1-1.ondigitalocean.com:25060/transformerpath
JWT_SECRET=your_super_secret_key_here
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
SENDGRID_API_KEY=SG.your_key
NODE_ENV=production
```

### Step 5: Deploy

1. Click "Create App"
2. Wait for build & deployment (~5 minutes)
3. View logs in dashboard
4. Test at provided URL

### Step 6: Set Up Custom Domain

1. Go to App Settings > Domains
2. Add your domain: `transformerpath.com`
3. Update DNS at your registrar (Namecheap, GoDaddy, etc.)
4. Wait for DNS propagation (~24 hours)

### Step 7: Enable HTTPS

DigitalOcean automatically provides free SSL certificates for your domain.

---

## 🟨 Option 2: AWS (EC2 + RDS)

### Prerequisites
- AWS account
- Basic knowledge of AWS console

### Step 1: Create RDS Database

1. RDS Dashboard > Create Database
2. Settings:
   - Engine: PostgreSQL
   - Version: 15.x
   - Instance: db.t3.micro (free tier)
   - DB name: transformerpath
   - Master username: app_user
   - Password: Generate strong password
3. Save connection string

### Step 2: Create EC2 Instance

1. EC2 Dashboard > Launch Instance
2. Settings:
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t3.micro (free tier) or t3.small
   - Key pair: Create and download
   - Security group: Allow 80, 443, 3001
3. Launch instance

### Step 3: Connect & Deploy

```bash
# Connect to instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y nodejs npm git docker.io docker-compose

# Clone repository
git clone https://github.com/yourusername/transformerpath.git
cd transformerpath

# Configure environment
cp .env.example .env
# Edit .env with RDS connection string
nano .env

# Install Node dependencies
npm install

# Start application with PM2 (process manager)
sudo npm install -g pm2
pm2 start backend-server.js
pm2 startup
pm2 save

# Start Nginx reverse proxy
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 4: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/transformerpath

# Paste this configuration:
```

```nginx
server {
    listen 80;
    server_name transformerpath.com www.transformerpath.com;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location / {
        root /home/ubuntu/transformerpath/frontend;
        try_files $uri /index.html;
    }
}
```

### Step 5: Enable HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d transformerpath.com

# Auto-renew
sudo systemctl start certbot.timer
sudo systemctl enable certbot.timer
```

### Step 6: Update DNS

1. Route53 > Create hosted zone for your domain
2. Add A record pointing to EC2 elastic IP
3. Update nameservers at domain registrar

---

## 🟪 Option 3: Heroku

### Step 1: Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

### Step 2: Create Heroku App

```bash
heroku login
heroku create transformerpath
```

### Step 3: Add PostgreSQL Database

```bash
heroku addons:create heroku-postgresql:hobby-dev
```

### Step 4: Configure Environment Variables

```bash
heroku config:set \
  JWT_SECRET="your_secret_key" \
  STRIPE_SECRET_KEY="sk_live_key" \
  STRIPE_PUBLISHABLE_KEY="pk_live_key" \
  SENDGRID_API_KEY="SG.key" \
  NODE_ENV="production"
```

### Step 5: Deploy

```bash
# Deploy to Heroku
git push heroku main

# View logs
heroku logs --tail

# Visit your app
heroku open
```

### Step 6: Set Up Custom Domain

```bash
heroku domains:add www.transformerpath.com
heroku domains:add transformerpath.com
```

Update DNS with CNAME records provided by Heroku.

---

## 🔒 Security Checklist

Before going live:

- [ ] Change all default passwords in `.env`
- [ ] Enable HTTPS/SSL certificate
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable HSTS headers
- [ ] Configure firewall rules
- [ ] Enable database backups
- [ ] Set up monitoring/alerting
- [ ] Enable security headers (CSP, X-Frame-Options, etc.)
- [ ] Implement DDoS protection (Cloudflare)
- [ ] Regular security updates

---

## 💾 Database Backups

### DigitalOcean
- Automatic backups enabled by default
- Retention: 7 days
- Manage in Database dashboard

### AWS RDS
```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier transformerpath \
  --db-snapshot-identifier transformerpath-backup-$(date +%Y%m%d)
```

### Heroku
```bash
# Create backup
heroku pg:backups:capture

# List backups
heroku pg:backups

# Download backup
heroku pg:backups:download
```

---

## 🔍 Monitoring & Logging

### DigitalOcean
- Built-in monitoring in App Platform
- Error tracking: Configure SendGrid alerts
- Performance: Monitor in dashboard

### AWS
```bash
# View CloudWatch logs
aws logs tail /aws/lambda/transformerpath --follow
```

### Heroku
```bash
# View logs
heroku logs --tail
heroku logs --dyno worker
```

---

## 🚀 Zero-Downtime Deployment

### Rolling Deployments

```bash
# DigitalOcean handles automatically

# AWS with Auto Scaling Group
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name transformerpath-asg \
  --desired-capacity 2

# Deploy to one instance, test, then others
```

---

## 💰 Cost Estimation (Monthly)

### DigitalOcean
- App Platform: $12/mo (2 containers)
- Managed Database: $15/mo
- **Total: ~$30-50/mo**

### AWS
- EC2 (t3.small): $20/mo
- RDS (db.t3.micro): $30/mo
- EBS Storage: $5/mo
- **Total: ~$55-100/mo**

### Heroku
- Dyno (Standard-1x): $50/mo
- PostgreSQL (Standard 0): $50/mo
- **Total: ~$100-150/mo**

---

## 🧪 Test Before Production

### Load Testing

```bash
# Install Apache Bench
brew install httpd

# Test endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 https://transformerpath.com/api/health

# Using wrk
brew install wrk
wrk -t4 -c100 -d30s https://transformerpath.com/api/health
```

### Monitor During Launch

- Check error logs in real-time
- Monitor database connections
- Watch API response times
- Test payment flow end-to-end
- Verify emails are sending
- Check SSL certificate validity

---

## 🎯 Post-Deployment Checklist

- [ ] Verify homepage loads
- [ ] Test user registration
- [ ] Test login flow
- [ ] Test payment flow (test mode)
- [ ] Verify emails sending
- [ ] Check API response times
- [ ] Verify database backups
- [ ] Set up monitoring
- [ ] Configure status page
- [ ] Document access procedures
- [ ] Share deployment details with team

---

## 🚨 Rollback Procedures

### DigitalOcean
```bash
# Redeploy previous version
git revert HEAD
git push origin main
# Wait for auto-deployment
```

### AWS
```bash
# Restore previous AMI
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-1234567890abcdef0 \
  --os-user ec2-user \
  --ssh-public-key file://my-key.pub

# Or launch new instance from old AMI
```

### Heroku
```bash
# Check releases
heroku releases

# Rollback to previous release
heroku releases:rollback v123
```

---

## 📞 Support & Maintenance

### Daily
- Monitor error logs
- Check uptime status
- Review user reports

### Weekly
- Update dependencies
- Review analytics
- Check database performance

### Monthly
- Security audit
- Backup verification
- Cost optimization
- Capacity planning

---

## 📚 Additional Resources

- DigitalOcean Docs: https://docs.digitalocean.com
- AWS Documentation: https://docs.aws.amazon.com
- Heroku Documentation: https://devcenter.heroku.com
- Node.js Best Practices: https://nodejs.org
- PostgreSQL Docs: https://www.postgresql.org/docs

---

**Estimated deployment time: 30 minutes to 2 hours depending on platform**

Need help? See `QUICK-START.md` for local development setup.
