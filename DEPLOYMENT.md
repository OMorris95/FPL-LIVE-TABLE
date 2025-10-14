# Hetzner VPS Deployment Guide - FPL Live Stats

## Architecture Overview

**Current Setup:**
- **Frontend**: Static HTML/CSS/JS making direct API calls to FPL API via CORS proxy (corsproxy.io)
- **Backend**: Node.js Express server serving API endpoints and running cron jobs
- **Issue**: Relies on third-party CORS proxy which could be unreliable

**Production Setup:**
- **Domain**: `fpl.yourdomain.com` (or subdomain of your choice)
- **Nginx**: Reverse proxy handling both frontend and backend
- **Frontend**: Static files served by Nginx
- **Backend**: Node.js app managed by PM2, serving `/api/*` endpoints
- **SSL**: Let's Encrypt SSL certificate
- **API Calls**: Direct from user's browser to FPL API (REMOVE CORS proxy dependency)

---

## Phase 1: Pre-Deployment Preparation

### 1.1 Update Frontend API Configuration

**File**: `js/api.js`

Remove CORS proxy dependency:
```javascript
// Change from:
const CORS_PROXY = 'https://corsproxy.io/?';
const API_BASE_URL = `${CORS_PROXY}https://fantasy.premierleague.com/api/`;

// To:
const API_BASE_URL = 'https://fantasy.premierleague.com/api/';
```

**Why**: FPL API supports CORS for browser requests, so no proxy needed. This keeps API calls from user's IP while being more reliable.

### 1.2 Create Environment Config for Backend

**File**: `backend/.env`
```env
PORT=3001
NODE_ENV=production
```

### 1.3 Create PM2 Ecosystem File

**File**: `backend/ecosystem.config.js`
```javascript
module.exports = {
  apps: [{
    name: 'fpl-backend',
    script: './server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z'
  }]
};
```

### 1.4 Create Nginx Configuration File

**File**: `nginx-config.txt` (for reference)
```nginx
server {
    listen 80;
    server_name fpl.yourdomain.com;  # Replace with your actual domain

    root /var/www/fpl-stats/frontend;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Phase 2: VPS Setup

### 2.1 Install Required Software

SSH into your VPS and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx (if not already installed)
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2.2 Create Application Directory

```bash
sudo mkdir -p /var/www/fpl-stats
sudo chown -R $USER:$USER /var/www/fpl-stats
```

---

## Phase 3: Deploy Backend

### 3.1 Upload Backend Files

From your local machine:

```bash
# Navigate to project directory
cd C:\Users\Owen\Downloads\Programming\FPL-LIVE-TABLE

# Upload backend files (replace with your VPS details)
rsync -avz --exclude 'node_modules' backend/ user@your-vps-ip:/var/www/fpl-stats/backend/
```

### 3.2 Install Dependencies & Setup

On the VPS:

```bash
cd /var/www/fpl-stats/backend
npm install --production
mkdir -p logs
mkdir -p data
```

### 3.3 Start Backend with PM2

```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Enable PM2 to start on system boot
pm2 startup
# Follow the instructions output by the command above
```

### 3.4 Verify Backend is Running

```bash
# Check status
pm2 status

# View logs
pm2 logs fpl-backend

# Check if backend is responding
curl http://localhost:3001/api/status
```

---

## Phase 4: Deploy Frontend

### 4.1 Upload Frontend Files

From your local machine:

```bash
# Upload frontend files
rsync -avz --exclude 'backend' --exclude 'node_modules' --exclude '.git' \
  index.html js/ css/ logotest3.png user@your-vps-ip:/var/www/fpl-stats/frontend/
```

### 4.2 Verify Files

On the VPS:

```bash
ls -la /var/www/fpl-stats/frontend/
# Should see: index.html, js/, css/, logotest3.png
```

---

## Phase 5: Nginx Configuration

### 5.1 Create Nginx Site Config

```bash
sudo nano /etc/nginx/sites-available/fpl-stats
```

Paste the nginx configuration from Phase 1.4 (replace `fpl.yourdomain.com` with your actual domain).

### 5.2 Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/fpl-stats /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### 5.3 Verify Nginx Status

```bash
sudo systemctl status nginx
```

---

## Phase 6: DNS Configuration

### 6.1 Add DNS A Record

In your domain provider's DNS settings:
- **Type**: A Record
- **Name**: `fpl` (or your chosen subdomain)
- **Value**: Your VPS IP address
- **TTL**: 300 (or default)

Wait 5-30 minutes for DNS propagation.

### 6.2 Verify DNS

```bash
# Check if DNS has propagated
nslookup fpl.yourdomain.com
```

---

## Phase 7: SSL Setup

### 7.1 Configure SSL with Let's Encrypt

```bash
sudo certbot --nginx -d fpl.yourdomain.com
```

Follow the prompts:
1. Enter email address
2. Agree to terms
3. Choose whether to redirect HTTP to HTTPS (recommended: Yes)

Certbot will automatically:
- Obtain SSL certificate
- Modify Nginx configuration for HTTPS
- Set up auto-renewal

### 7.2 Verify SSL

Visit `https://fpl.yourdomain.com` in your browser - you should see the site with a valid SSL certificate.

### 7.3 Test Auto-Renewal

```bash
# Dry run of certificate renewal
sudo certbot renew --dry-run
```

---

## Phase 8: Testing

### 8.1 Test Backend API

```bash
# Test status endpoint
curl https://fpl.yourdomain.com/api/status

# Should return JSON with current gameweek info
```

### 8.2 Test Frontend

1. Open `https://fpl.yourdomain.com` in browser
2. Open browser DevTools (F12)
3. Check Console for errors
4. Verify FPL API calls work without CORS proxy
5. Enter a league ID and test functionality

### 8.3 Test Cron Jobs

```bash
# Check PM2 logs for cron job execution
pm2 logs fpl-backend --lines 100

# Look for cron job messages
```

---

## Phase 9: Monitoring & Maintenance

### 9.1 Monitor Backend

```bash
# Check process status
pm2 status

# View live logs
pm2 logs fpl-backend

# Real-time monitoring dashboard
pm2 monit

# View specific log files
tail -f /var/www/fpl-stats/backend/logs/out.log
tail -f /var/www/fpl-stats/backend/logs/err.log
```

### 9.2 Restart Backend

```bash
# Restart application
pm2 restart fpl-backend

# Reload (zero-downtime restart)
pm2 reload fpl-backend
```

### 9.3 Update Deployment

Create a deployment script for easy updates:

**File**: `/var/www/fpl-stats/deploy.sh`
```bash
#!/bin/bash
set -e

echo "🚀 Deploying FPL Stats..."

# Pull latest code (if using git)
# cd /var/www/fpl-stats
# git pull

# Update backend
echo "📦 Installing backend dependencies..."
cd /var/www/fpl-stats/backend
npm install --production

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart fpl-backend

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x /var/www/fpl-stats/deploy.sh
```

### 9.4 View Backend Data

```bash
# Check ownership data files
ls -lh /var/www/fpl-stats/backend/data/

# View a data file
cat /var/www/fpl-stats/backend/data/ownership_10k_gw15.json | jq
```

---

## Phase 10: Alternative - Backend CORS Proxy (If Needed)

If FPL API blocks direct browser requests, use the backend as a proxy.

### 10.1 Add Proxy Route to Backend

**File**: `backend/routes/api.js`

Add this route:
```javascript
const axios = require('axios');

router.get('/fpl-proxy/*', async (req, res) => {
    const fplPath = req.params[0];
    const fplUrl = `https://fantasy.premierleague.com/api/${fplPath}`;

    try {
        const response = await axios.get(fplUrl);
        res.json(response.data);
    } catch (error) {
        console.error('FPL proxy error:', error.message);
        res.status(500).json({ error: 'FPL API error' });
    }
});
```

### 10.2 Update Frontend

**File**: `js/api.js`

```javascript
// Use backend proxy instead of direct calls
const API_BASE_URL = '/api/fpl-proxy/';
```

### 10.3 Deploy Changes

```bash
# Upload updated files
rsync -avz backend/routes/api.js user@your-vps-ip:/var/www/fpl-stats/backend/routes/
rsync -avz js/api.js user@your-vps-ip:/var/www/fpl-stats/frontend/js/

# Restart backend
ssh user@your-vps-ip 'pm2 restart fpl-backend'
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs for errors
pm2 logs fpl-backend --err

# Try running directly to see errors
cd /var/www/fpl-stats/backend
node server.js
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify backend port matches nginx config
netstat -tlnp | grep 3001
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### CORS Errors

- Check browser console for specific error
- Verify FPL API is being called directly (no corsproxy.io)
- If needed, implement backend proxy (Phase 10)

---

## Summary of Benefits

✅ **No Third-Party Dependencies**: Removes corsproxy.io reliance
✅ **User IP for API Calls**: Browser makes direct calls to FPL API
✅ **SSL/HTTPS**: Secure connection
✅ **Same Origin**: No CORS issues between frontend/backend
✅ **Auto-Restart**: PM2 ensures backend stays running
✅ **Cron Jobs Work**: Backend runs continuously with scheduled tasks
✅ **Multi-Site Support**: Nginx handles multiple domains on same VPS
✅ **Easy Updates**: Simple deployment script for future updates
✅ **Auto-SSL Renewal**: Certbot handles certificate renewal automatically

This approach gives you maximum reliability while keeping API rate limiting distributed across users.

---

## Quick Reference Commands

```bash
# Check backend status
pm2 status

# View backend logs
pm2 logs fpl-backend

# Restart backend
pm2 restart fpl-backend

# Check nginx status
sudo systemctl status nginx

# Reload nginx config
sudo systemctl reload nginx

# Test nginx config
sudo nginx -t

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check SSL certificates
sudo certbot certificates

# Manual deploy
cd /var/www/fpl-stats
./deploy.sh
```
