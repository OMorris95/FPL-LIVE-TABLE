# FPL Stats VPS Commands Reference

## Server Details
- **Host:** 157.180.23.250
- **Port:** 1022
- **User:** root
- **Frontend Path:** /var/www/fpl-stats/frontend/
- **Backend Path:** /var/www/fpl-stats/backend/

---

## Deploy Frontend (Upload & Fix Permissions)

### Upload All JS Files + Index
```powershell
scp -P 1022 -r js root@157.180.23.250:/var/www/fpl-stats/frontend/ && ssh -p 1022 root@157.180.23.250 "chown -R www-data:www-data /var/www/fpl-stats/frontend/js && chmod -R 755 /var/www/fpl-stats/frontend/js"

scp -P 1022 index.html root@157.180.23.250:/var/www/fpl-stats/frontend/ && ssh -p 1022 root@157.180.23.250 "chmod 644 /var/www/fpl-stats/frontend/index.html"
```

### Upload CSS Files
```powershell
scp -P 1022 -r css root@157.180.23.250:/var/www/fpl-stats/frontend/ && ssh -p 1022 root@157.180.23.250 "chown -R www-data:www-data /var/www/fpl-stats/frontend/css && chmod -R 755 /var/www/fpl-stats/frontend/css"
```

### Upload Single Backend File (Example)
```powershell
scp -P 1022 backend/routes/api.js root@157.180.23.250:/var/www/fpl-stats/backend/routes/
```

---

## Manual Permission Fixes (If Needed)

### SSH into VPS
```powershell
ssh -p 1022 root@157.180.23.250
```

### Fix Frontend Permissions
```bash
cd /var/www/fpl-stats/frontend
chown -R www-data:www-data js/ css/ index.html
chmod -R 755 js/ css/
chmod 644 index.html
```

### Fix Backend Permissions
```bash
cd /var/www/fpl-stats/backend
chown -R www-data:www-data .
chmod -R 755 .
```

---

## Restart Backend Server

### If using PM2
```bash
pm2 restart fpl-backend
pm2 logs fpl-backend
pm2 status
```

### If using npm directly
```bash
cd /var/www/fpl-stats/backend
npm restart
```

---

## Check Server Status

### View Backend Logs
```bash
pm2 logs fpl-backend --lines 50
```

### Check Nginx Status
```bash
systemctl status nginx
```

### Check File Permissions
```bash
ls -la /var/www/fpl-stats/frontend/
ls -la /var/www/fpl-stats/frontend/js/
```
