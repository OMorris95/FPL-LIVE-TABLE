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

// Start cron jobs
require('./cron/updateOwnership');      // Top 10k ownership (Saturdays 2 AM)
require('./cron/trackTransfers');       // Transfer tracking (Every 30 mins)
require('./cron/verifyPriceChanges');   // Price verification & reset (Daily 3 AM)
