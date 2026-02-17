require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../')));

// API routes
app.use('/api', apiRoutes);

// Serve index.html for all other routes (SPA routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`FPL Backend server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});

// Legacy cron jobs (replaced by DB-backed equivalents)
// require('./cron/updateOwnership');      // REPLACED by managerScrapeCron + ownershipService
// require('./cron/syncWeeklyData');       // REPLACED by bootstrapCron
// require('./cron/trackTransfers');       // DISABLED: Needs fixing
// require('./cron/smartPlayerDataSync');  // REPLACED by bootstrapCron + playerHistorySync
require('./cron/verifyPriceChanges');   // Price verification & reset (Daily 2:45 AM) - still needed

// New DB-backed cron jobs
require('./cron/bootstrapCron');       // Bootstrap sync (every 6h, every 10min live)
require('./cron/managerScrapeCron');    // Top 10k scrape (hourly after deadline)
require('./cron/liveDataCron');         // Live player data (every 30s during live GW)

// Periodic cache cleanup
const { cleanExpiredCache } = require('./services/cacheService');
setInterval(cleanExpiredCache, 15 * 60 * 1000); // Every 15 min
