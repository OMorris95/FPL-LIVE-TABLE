# Backend Implementation Plan - Top Manager Ownership System

## 🎯 Goal
Build a Node.js backend to fetch and serve FPL top 100/1k/10k ownership data, replacing the current overall ownership display on the template page.

## 📋 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Phase 1: Backend Setup](#phase-1-backend-setup--structure)
- [Phase 2: Core Services](#phase-2-core-backend-services)
- [Phase 3: API Endpoints](#phase-3-api-endpoints)
- [Phase 4: Automated Data Collection](#phase-4-automated-data-collection-cron)
- [Phase 5: Frontend Integration](#phase-5-frontend-integration)
- [Phase 6: Hetzner VPS Deployment](#phase-6-hetzner-vps-deployment)
- [Phase 7: Testing & Optimization](#phase-7-testing--optimization)
- [Timeline & Costs](#timeline--costs)

---

## Architecture Overview

### Tech Stack
- **Backend**: Node.js + Express
- **Data Storage**: JSON files (no database needed)
- **Cron**: node-cron for automated updates
- **Deployment**: Hetzner VPS (Ubuntu 22.04)
- **Process Manager**: PM2
- **Web Server**: Nginx (frontend + API proxy)

### Data Flow
```
FPL API (League 314)
  → Backend Fetcher (200 API calls)
    → Get 10k Manager IDs
      → Fetch 10k Manager Picks (10k API calls)
        → Calculate Ownership (Top 100/1k/10k)
          → Save to JSON files
            → Serve via Express API
              → Frontend displays with tier selector
```

### Key Optimization ✅
**Single Fetch Approach** (corrected):
1. Fetch top 10k manager IDs ONCE (pages 1-200 of league 314)
2. Fetch all 10k manager picks ONCE
3. Filter in memory for top 100/1k/10k
4. Calculate ownership for each tier from same dataset

---

## Phase 1: Backend Setup & Structure

### 1.1 Directory Restructure
- [ ] Create `backend/` directory in project root
- [ ] Move existing files to `frontend/` directory
- [ ] Create backend subdirectories

**Target Structure:**
```
FPL-LIVE-TABLE/
├── frontend/                    # Existing files moved here
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── logotest3.png
│
├── backend/                     # NEW
│   ├── server.js               # Express server entry point
│   ├── package.json
│   ├── .env
│   ├── .gitignore
│   │
│   ├── services/               # Business logic
│   │   ├── fplDataFetcher.js   # Fetch from FPL API
│   │   ├── ownershipCalculator.js  # Calculate ownership
│   │   └── dataStorage.js      # Save/load JSON
│   │
│   ├── routes/                 # API routes
│   │   └── api.js
│   │
│   ├── cron/                   # Scheduled tasks
│   │   └── updateOwnership.js
│   │
│   ├── config/                 # Configuration
│   │   └── config.js
│   │
│   ├── data/                   # Stored ownership data
│   │   ├── top100-gw15.json
│   │   ├── top1k-gw15.json
│   │   └── top10k-gw15.json
│   │
│   ├── logs/                   # Application logs
│   │   └── cron.log
│   │
│   └── utils/                  # Helper functions
│       ├── logger.js
│       └── rateLimiter.js
│
├── BACKEND_IMPLEMENTATION_PLAN.md  # This file
└── README.md
```

### 1.2 Initialize Backend
- [ ] Create `backend/` directory
- [ ] Run `npm init -y` in backend directory
- [ ] Install dependencies

**Dependencies:**
```bash
cd backend
npm install express axios node-cron dotenv cors compression
npm install --save-dev nodemon
```

### 1.3 Package.json Scripts
- [ ] Add development and production scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "cron": "node cron/updateOwnership.js",
    "test": "node test/testFetcher.js"
  }
}
```

### 1.4 Environment Configuration
- [ ] Create `.env` file
- [ ] Add environment variables

```env
PORT=3000
NODE_ENV=development
FPL_API_BASE=https://fantasy.premierleague.com/api
CORS_PROXY=https://corsproxy.io/?
RATE_LIMIT_DELAY_MS=500
LOG_LEVEL=info
```

### 1.5 Git Configuration
- [ ] Create `backend/.gitignore`

```gitignore
node_modules/
.env
logs/*.log
data/*.json
*.log
.DS_Store
```

---

## Phase 2: Core Backend Services

### 2.1 FPL Data Fetcher (`services/fplDataFetcher.js`)

**Functions to Implement:**

- [ ] **`getTop10kManagerIds()`**
  - Fetch pages 1-200 of league 314
  - Extract manager IDs from each page
  - Return array of 10,000 manager IDs sorted by rank

- [ ] **`getManagerPicks(managerId, gameweek)`**
  - Fetch specific manager's team for gameweek
  - Return picks, captain, vice, chips, formation

- [ ] **`fetchAllManagerPicks(managerIds, gameweek)`**
  - Batch fetch all manager picks with rate limiting
  - Include progress logging
  - Handle errors gracefully

- [ ] **`getCurrentGameweek()`**
  - Fetch from bootstrap-static
  - Return current/next gameweek ID

**Code Template:**
```javascript
const axios = require('axios');
const { sleep } = require('../utils/rateLimiter');
const logger = require('../utils/logger');

const FPL_API_BASE = 'https://fantasy.premierleague.com/api';
const RATE_LIMIT_DELAY = 500; // 500ms = 2 req/sec

async function getTop10kManagerIds() {
  logger.info('Starting to fetch top 10k manager IDs from league 314...');
  const managerIds = [];

  // Fetch pages 1-200 (50 managers per page = 10,000 total)
  for (let page = 1; page <= 200; page++) {
    try {
      const url = `${FPL_API_BASE}/leagues-classic/314/standings/?page_standings=${page}`;
      const response = await axios.get(url);

      const standings = response.data.standings.results;
      standings.forEach(entry => {
        managerIds.push({
          id: entry.entry,
          rank: entry.rank,
          total_points: entry.total
        });
      });

      logger.info(`Fetched page ${page}/200 (${managerIds.length} managers)`);
      await sleep(RATE_LIMIT_DELAY); // Rate limiting

    } catch (error) {
      logger.error(`Failed to fetch page ${page}: ${error.message}`);
      // Retry logic here
    }
  }

  logger.info(`Successfully fetched ${managerIds.length} manager IDs`);
  return managerIds;
}

async function getManagerPicks(managerId, gameweek) {
  const url = `${FPL_API_BASE}/entry/${managerId}/event/${gameweek}/picks/`;
  const response = await axios.get(url);
  return response.data;
}

async function fetchAllManagerPicks(managerIds, gameweek) {
  logger.info(`Fetching picks for ${managerIds.length} managers...`);
  const allPicks = [];

  for (let i = 0; i < managerIds.length; i++) {
    try {
      const picks = await getManagerPicks(managerIds[i].id, gameweek);
      allPicks.push({
        managerId: managerIds[i].id,
        rank: managerIds[i].rank,
        picks: picks.picks,
        captain: picks.picks.find(p => p.is_captain)?.element,
        viceCaptain: picks.picks.find(p => p.is_vice_captain)?.element,
        chip: picks.active_chip
      });

      if ((i + 1) % 100 === 0) {
        logger.info(`Progress: ${i + 1}/${managerIds.length} managers`);
      }

      await sleep(RATE_LIMIT_DELAY);

    } catch (error) {
      logger.error(`Failed to fetch picks for manager ${managerIds[i].id}: ${error.message}`);
    }
  }

  logger.info(`Successfully fetched ${allPicks.length} manager picks`);
  return allPicks;
}

async function getCurrentGameweek() {
  const url = `${FPL_API_BASE}/bootstrap-static/`;
  const response = await axios.get(url);
  const currentEvent = response.data.events.find(e => e.is_current);
  return currentEvent ? currentEvent.id : response.data.events.find(e => e.is_next)?.id;
}

module.exports = {
  getTop10kManagerIds,
  getManagerPicks,
  fetchAllManagerPicks,
  getCurrentGameweek
};
```

**Checklist:**
- [ ] Implement getTop10kManagerIds()
- [ ] Implement getManagerPicks()
- [ ] Implement fetchAllManagerPicks()
- [ ] Implement getCurrentGameweek()
- [ ] Add retry logic for failed requests
- [ ] Add progress logging
- [ ] Test with small sample first (e.g., 100 managers)

---

### 2.2 Ownership Calculator (`services/ownershipCalculator.js`)

**Functions to Implement:**

- [ ] **`calculateOwnership(managerPicks)`**
  - Count how many managers own each player
  - Calculate ownership percentage
  - Calculate captain percentage
  - Calculate effective ownership (EO)
  - Return ownership data object

**Data Structure:**
```javascript
{
  "gameweek": 15,
  "updated_at": "2025-01-15T10:30:00Z",
  "tier": "top10k",
  "total_managers": 10000,
  "players": {
    "123": {  // player_id
      "selected": 8550,           // count of managers who own
      "ownership_percent": 85.5,
      "captained": 4520,          // count captained
      "captain_percent": 45.2,
      "vice_captained": 1200,
      "vice_percent": 12.0,
      "effective_ownership": 130.7,  // ownership + captain + (vice * 0.5)
      "in_starting_xi": 8200,     // count in starting 11 (not benched)
      "starting_xi_percent": 82.0
    }
  }
}
```

**Code Template:**
```javascript
const logger = require('../utils/logger');

function calculateOwnership(managerPicks, tier, gameweek) {
  logger.info(`Calculating ownership for ${managerPicks.length} managers (${tier})`);

  const playerStats = {};
  const totalManagers = managerPicks.length;

  // Initialize all players
  managerPicks.forEach(manager => {
    manager.picks.forEach(pick => {
      const playerId = pick.element;
      if (!playerStats[playerId]) {
        playerStats[playerId] = {
          selected: 0,
          captained: 0,
          vice_captained: 0,
          in_starting_xi: 0
        };
      }

      // Count ownership
      playerStats[playerId].selected++;

      // Count if in starting XI (position 1-11)
      if (pick.position <= 11) {
        playerStats[playerId].in_starting_xi++;
      }

      // Count captain
      if (pick.is_captain) {
        playerStats[playerId].captained++;
      }

      // Count vice captain
      if (pick.is_vice_captain) {
        playerStats[playerId].vice_captained++;
      }
    });
  });

  // Calculate percentages
  const playersArray = Object.entries(playerStats).map(([playerId, stats]) => {
    const ownershipPercent = (stats.selected / totalManagers) * 100;
    const captainPercent = (stats.captained / totalManagers) * 100;
    const vicePercent = (stats.vice_captained / totalManagers) * 100;
    const startingXIPercent = (stats.in_starting_xi / totalManagers) * 100;

    // Effective Ownership = ownership + captain + (vice * 0.5)
    const effectiveOwnership = ownershipPercent + captainPercent + (vicePercent * 0.5);

    return {
      player_id: parseInt(playerId),
      selected: stats.selected,
      ownership_percent: parseFloat(ownershipPercent.toFixed(2)),
      captained: stats.captained,
      captain_percent: parseFloat(captainPercent.toFixed(2)),
      vice_captained: stats.vice_captained,
      vice_percent: parseFloat(vicePercent.toFixed(2)),
      effective_ownership: parseFloat(effectiveOwnership.toFixed(2)),
      in_starting_xi: stats.in_starting_xi,
      starting_xi_percent: parseFloat(startingXIPercent.toFixed(2))
    };
  });

  // Sort by ownership descending
  playersArray.sort((a, b) => b.ownership_percent - a.ownership_percent);

  const result = {
    gameweek: gameweek,
    updated_at: new Date().toISOString(),
    tier: tier,
    total_managers: totalManagers,
    players: playersArray
  };

  logger.info(`Ownership calculation complete: ${playersArray.length} players`);
  return result;
}

module.exports = {
  calculateOwnership
};
```

**Checklist:**
- [ ] Implement calculateOwnership()
- [ ] Add ownership percentage calculation
- [ ] Add captain tracking
- [ ] Add vice-captain tracking
- [ ] Calculate effective ownership (EO)
- [ ] Track starting XI vs bench
- [ ] Sort players by ownership descending
- [ ] Test with sample data

---

### 2.3 Data Storage (`services/dataStorage.js`)

**Functions to Implement:**

- [ ] **`saveOwnershipData(tier, gameweek, data)`**
  - Save ownership data to JSON file
  - Filename format: `top{tier}-gw{gameweek}.json`

- [ ] **`loadOwnershipData(tier, gameweek)`**
  - Load ownership data from JSON file
  - Return null if not found

- [ ] **`getLatestOwnershipData(tier)`**
  - Get most recent ownership data for tier
  - Check all gameweek files

- [ ] **`dataExists(tier, gameweek)`**
  - Check if data file exists

**Code Template:**
```javascript
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    logger.error(`Failed to create data directory: ${error.message}`);
  }
}

async function saveOwnershipData(tier, gameweek, data) {
  await ensureDataDir();

  const filename = `top${tier}-gw${gameweek}.json`;
  const filepath = path.join(DATA_DIR, filename);

  try {
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    logger.info(`Saved ownership data: ${filename}`);
    return true;
  } catch (error) {
    logger.error(`Failed to save ${filename}: ${error.message}`);
    return false;
  }
}

async function loadOwnershipData(tier, gameweek) {
  const filename = `top${tier}-gw${gameweek}.json`;
  const filepath = path.join(DATA_DIR, filename);

  try {
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn(`Could not load ${filename}: ${error.message}`);
    return null;
  }
}

async function getLatestOwnershipData(tier) {
  try {
    const files = await fs.readdir(DATA_DIR);
    const tierFiles = files.filter(f => f.startsWith(`top${tier}-gw`) && f.endsWith('.json'));

    if (tierFiles.length === 0) {
      return null;
    }

    // Sort by gameweek number (extract from filename)
    tierFiles.sort((a, b) => {
      const gwA = parseInt(a.match(/gw(\d+)/)[1]);
      const gwB = parseInt(b.match(/gw(\d+)/)[1]);
      return gwB - gwA; // Descending
    });

    const latestFile = tierFiles[0];
    const filepath = path.join(DATA_DIR, latestFile);
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);

  } catch (error) {
    logger.error(`Failed to get latest data for ${tier}: ${error.message}`);
    return null;
  }
}

async function dataExists(tier, gameweek) {
  const filename = `top${tier}-gw${gameweek}.json`;
  const filepath = path.join(DATA_DIR, filename);

  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  saveOwnershipData,
  loadOwnershipData,
  getLatestOwnershipData,
  dataExists
};
```

**Checklist:**
- [ ] Implement saveOwnershipData()
- [ ] Implement loadOwnershipData()
- [ ] Implement getLatestOwnershipData()
- [ ] Implement dataExists()
- [ ] Create data/ directory
- [ ] Test file read/write operations

---

### 2.4 Utility Functions

#### Rate Limiter (`utils/rateLimiter.js`)
- [ ] Implement sleep function for rate limiting

```javascript
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { sleep };
```

#### Logger (`utils/logger.js`)
- [ ] Implement simple logger

```javascript
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/app.log');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

  // Console output
  console.log(logMessage.trim());

  // File output
  fs.appendFileSync(LOG_FILE, logMessage);
}

module.exports = {
  info: (msg) => log('info', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('error', msg)
};
```

---

## Phase 3: API Endpoints

### 3.1 Express Server Setup (`server.js`)

- [ ] Create Express app
- [ ] Add middleware (CORS, compression, JSON)
- [ ] Setup routes
- [ ] Add error handling
- [ ] Start server

**Code Template:**
```javascript
const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🚀 Backend API running at http://localhost:${PORT}`);
});
```

**Checklist:**
- [ ] Create server.js
- [ ] Add Express and middleware
- [ ] Add health check endpoint
- [ ] Add error handling
- [ ] Test server starts successfully

---

### 3.2 API Routes (`routes/api.js`)

**Endpoints to Implement:**

- [ ] **GET `/api/ownership/:tier`**
  - Returns ownership data for tier (100, 1k, 10k)
  - Uses latest gameweek data available

- [ ] **GET `/api/ownership/:tier/:gameweek`**
  - Returns ownership data for specific tier and gameweek

- [ ] **GET `/api/status`**
  - Returns current gameweek and data availability

- [ ] **POST `/api/ownership/update`** (optional, for manual trigger)
  - Triggers ownership data update
  - Protected by API key

**Code Template:**
```javascript
const express = require('express');
const router = express.Router();
const { loadOwnershipData, getLatestOwnershipData, dataExists } = require('../services/dataStorage');
const { getCurrentGameweek } = require('../services/fplDataFetcher');
const logger = require('../utils/logger');

// GET /api/ownership/:tier
// Returns latest ownership data for tier
router.get('/ownership/:tier', async (req, res) => {
  try {
    const { tier } = req.params;

    // Validate tier
    if (!['100', '1k', '10k'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Use: 100, 1k, or 10k' });
    }

    const data = await getLatestOwnershipData(tier);

    if (!data) {
      return res.status(404).json({ error: `No ownership data available for top ${tier}` });
    }

    res.json(data);

  } catch (error) {
    logger.error(`Error fetching ownership: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch ownership data' });
  }
});

// GET /api/ownership/:tier/:gameweek
// Returns ownership data for specific tier and gameweek
router.get('/ownership/:tier/:gameweek', async (req, res) => {
  try {
    const { tier, gameweek } = req.params;

    // Validate tier
    if (!['100', '1k', '10k'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Use: 100, 1k, or 10k' });
    }

    const data = await loadOwnershipData(tier, parseInt(gameweek));

    if (!data) {
      return res.status(404).json({
        error: `No ownership data available for top ${tier} GW${gameweek}`
      });
    }

    res.json(data);

  } catch (error) {
    logger.error(`Error fetching ownership: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch ownership data' });
  }
});

// GET /api/status
// Returns current gameweek and data availability
router.get('/status', async (req, res) => {
  try {
    const currentGW = await getCurrentGameweek();

    const availability = {
      top100: await dataExists('100', currentGW),
      top1k: await dataExists('1k', currentGW),
      top10k: await dataExists('10k', currentGW)
    };

    res.json({
      current_gameweek: currentGW,
      data_available: availability,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Error fetching status: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

module.exports = router;
```

**Checklist:**
- [ ] Create routes/api.js
- [ ] Implement GET /api/ownership/:tier
- [ ] Implement GET /api/ownership/:tier/:gameweek
- [ ] Implement GET /api/status
- [ ] Add input validation
- [ ] Add error handling
- [ ] Test all endpoints with Postman/curl

---

## Phase 4: Automated Data Collection (Cron)

### 4.1 Main Update Script (`cron/updateOwnership.js`)

**Process Flow:**
1. Get current gameweek
2. Check if data already exists for this GW
3. If not, fetch top 10k manager IDs
4. Fetch all 10k manager picks
5. Calculate ownership for top 100, 1k, and 10k
6. Save all three tiers to JSON files

**Code Template:**
```javascript
const { getTop10kManagerIds, fetchAllManagerPicks, getCurrentGameweek } = require('../services/fplDataFetcher');
const { calculateOwnership } = require('../services/ownershipCalculator');
const { saveOwnershipData, dataExists } = require('../services/dataStorage');
const logger = require('../utils/logger');

async function updateAllOwnership() {
  const startTime = Date.now();
  logger.info('========================================');
  logger.info('Starting ownership data update...');

  try {
    // 1. Get current gameweek
    const gameweek = await getCurrentGameweek();
    logger.info(`Current gameweek: ${gameweek}`);

    // 2. Check if data already exists
    const top10kExists = await dataExists('10k', gameweek);
    if (top10kExists) {
      logger.info(`Data for GW${gameweek} already exists. Skipping update.`);
      return;
    }

    // 3. Fetch top 10k manager IDs from league 314
    logger.info('Fetching top 10k manager IDs...');
    const top10kIds = await getTop10kManagerIds();
    logger.info(`Fetched ${top10kIds.length} manager IDs`);

    // 4. Fetch all manager picks
    logger.info('Fetching all manager picks...');
    const allPicks = await fetchAllManagerPicks(top10kIds, gameweek);
    logger.info(`Fetched ${allPicks.length} manager picks`);

    // 5. Calculate ownership for each tier (using same dataset!)
    logger.info('Calculating ownership for all tiers...');

    // Top 100
    const top100Picks = allPicks.slice(0, 100);
    const top100Ownership = calculateOwnership(top100Picks, '100', gameweek);
    await saveOwnershipData('100', gameweek, top100Ownership);

    // Top 1k
    const top1kPicks = allPicks.slice(0, 1000);
    const top1kOwnership = calculateOwnership(top1kPicks, '1k', gameweek);
    await saveOwnershipData('1k', gameweek, top1kOwnership);

    // Top 10k
    const top10kOwnership = calculateOwnership(allPicks, '10k', gameweek);
    await saveOwnershipData('10k', gameweek, top10kOwnership);

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    logger.info(`✅ Ownership update complete! Duration: ${duration} minutes`);
    logger.info('========================================');

  } catch (error) {
    logger.error(`❌ Ownership update failed: ${error.message}`);
    logger.error(error.stack);
  }
}

// If run directly (not via cron)
if (require.main === module) {
  updateAllOwnership()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error(`Fatal error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { updateAllOwnership };
```

**Checklist:**
- [ ] Create cron/updateOwnership.js
- [ ] Implement updateAllOwnership()
- [ ] Add gameweek check
- [ ] Add data existence check (avoid duplicates)
- [ ] Save all three tiers
- [ ] Add logging and timing
- [ ] Test manual run: `node cron/updateOwnership.js`

---

### 4.2 Cron Schedule (Add to `server.js`)

- [ ] Add cron job to server.js

```javascript
const cron = require('node-cron');
const { updateAllOwnership } = require('./cron/updateOwnership');

// Run every Saturday at 2:00 AM
// Cron format: minute hour day month weekday
cron.schedule('0 2 * * 6', async () => {
  logger.info('Cron job triggered: updating ownership data...');
  await updateAllOwnership();
}, {
  timezone: "Europe/London" // FPL deadline timezone
});

logger.info('Cron job scheduled: Saturdays at 2:00 AM GMT');
```

**Schedule Options:**
- **Production**: `'0 2 * * 6'` - Every Saturday 2 AM
- **Testing**: `'*/30 * * * *'` - Every 30 minutes
- **Manual**: Just run `node cron/updateOwnership.js`

**Checklist:**
- [ ] Add cron to server.js
- [ ] Set correct timezone (Europe/London)
- [ ] Test cron triggers correctly
- [ ] Verify data updates after cron runs

---

## Phase 5: Frontend Integration

### 5.1 Update Template Page

#### Add Tier Selector UI (`js/pages/template.js`)

- [ ] Add tier selector buttons to HTML
- [ ] Add tier state management
- [ ] Add tier switching functionality

**HTML Addition:**
```javascript
// Add after card-header in renderTemplateTracker()
<div class="tier-selector mb-md">
  <button class="tier-btn active" data-tier="10k">Top 10k</button>
  <button class="tier-btn" data-tier="1k">Top 1k</button>
  <button class="tier-btn" data-tier="100">Top 100</button>
</div>
```

**CSS Addition to `styles.css`:**
```css
/* Tier Selector */
.tier-selector {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.tier-btn {
  padding: 0.75rem 1.5rem;
  background: var(--card-bg-elevated);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-color);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tier-btn:hover {
  border-color: var(--accent-gold);
  transform: translateY(-2px);
}

.tier-btn.active {
  background: var(--accent-gold);
  color: var(--bg-color);
  border-color: var(--accent-gold);
}

.tier-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### 5.2 Backend API Integration

- [ ] Create API configuration file
- [ ] Add fetch function for ownership data
- [ ] Update template page to use backend data

**Create `js/config.js`:**
```javascript
const API_CONFIG = {
  BASE_URL: process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com/api'
    : 'http://localhost:3000/api'
};
```

**Update `template.js`:**
```javascript
// At top of file
let currentTier = '10k';
let ownershipCache = {};

async function fetchOwnershipData(tier) {
  // Check cache first
  if (ownershipCache[tier]) {
    return ownershipCache[tier];
  }

  try {
    const response = await fetch(`http://localhost:3000/api/ownership/${tier}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch ownership data: ${response.status}`);
    }

    const data = await response.json();
    ownershipCache[tier] = data; // Cache it
    return data;

  } catch (error) {
    console.error('Error fetching ownership:', error);
    // Fallback to overall ownership
    return null;
  }
}

// Update renderTemplatePage to use backend data
async function renderTemplatePage() {
  const app = document.getElementById('app');
  const nav = document.getElementById('main-nav');

  nav.style.display = 'block';

  app.innerHTML = `
    <div class="text-center mt-2">
      <div class="spinner"></div>
      <p class="loading-text">Loading template team data...</p>
    </div>
  `;

  try {
    // Fetch ownership from backend
    const ownershipData = await fetchOwnershipData(currentTier);

    if (!ownershipData) {
      throw new Error('Failed to load ownership data');
    }

    const bootstrapData = await getBootstrapData();
    const playerMap = createPlayerMap(bootstrapData);
    const teamMap = createTeamMap(bootstrapData);

    renderTemplateTracker(ownershipData, playerMap, teamMap);

  } catch (error) {
    console.error('Error loading template team:', error);
    app.innerHTML = `
      <div class="card text-center">
        <h2 class="text-error">Error Loading Template Team</h2>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Update renderTemplateTracker to use ownership data
function renderTemplateTracker(ownershipData, playerMap, teamMap) {
  const app = document.getElementById('app');

  // Get top players by ownership from backend data
  const topPlayers = ownershipData.players
    .filter(p => p.ownership_percent >= 50)
    .map(ownershipPlayer => {
      const player = playerMap[ownershipPlayer.player_id];
      return {
        ...player,
        ownership_percent: ownershipPlayer.ownership_percent,
        captain_percent: ownershipPlayer.captain_percent,
        effective_ownership: ownershipPlayer.effective_ownership
      };
    });

  // Group by position
  const byPosition = {
    1: topPlayers.filter(p => p.element_type === 1).slice(0, 2),
    2: topPlayers.filter(p => p.element_type === 2).slice(0, 5),
    3: topPlayers.filter(p => p.element_type === 3).slice(0, 5),
    4: topPlayers.filter(p => p.element_type === 4).slice(0, 3)
  };

  app.innerHTML = `
    <div class="template-container">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Template Team Tracker</h2>
          <p class="subtitle">
            Top manager ownership • Updated: ${new Date(ownershipData.updated_at).toLocaleString()}
          </p>
        </div>

        <!-- Tier Selector -->
        <div class="tier-selector">
          <button class="tier-btn ${currentTier === '10k' ? 'active' : ''}" data-tier="10k">
            Top 10k
          </button>
          <button class="tier-btn ${currentTier === '1k' ? 'active' : ''}" data-tier="1k">
            Top 1k
          </button>
          <button class="tier-btn ${currentTier === '100' ? 'active' : ''}" data-tier="100">
            Top 100
          </button>
        </div>

        <!-- Rest of template display -->
        ${renderTemplateSquad(byPosition, teamMap)}
        ${renderOwnershipTables(ownershipData, playerMap, teamMap)}
      </div>
    </div>
  `;

  // Add tier button event listeners
  document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const newTier = e.target.dataset.tier;
      if (newTier !== currentTier) {
        currentTier = newTier;

        // Show loading
        document.querySelectorAll('.tier-btn').forEach(b => b.disabled = true);

        // Fetch new data and re-render
        await renderTemplatePage();
      }
    });
  });
}
```

**Checklist:**
- [ ] Add tier selector UI to template page
- [ ] Add CSS styling for tier buttons
- [ ] Create fetchOwnershipData() function
- [ ] Update renderTemplatePage() to use backend API
- [ ] Update renderTemplateTracker() to use ownership data
- [ ] Add tier switching functionality
- [ ] Add loading states during tier switch
- [ ] Add error handling for API failures
- [ ] Add caching to avoid redundant fetches
- [ ] Test tier switching works correctly

---

### 5.3 Update Template Display

- [ ] Update ownership display to show EO (Effective Ownership)
- [ ] Add "Last Updated" timestamp
- [ ] Update subtitle to clarify it's top manager ownership

**Updated Player Card:**
```javascript
function renderTemplatePlayerCard(player, teamMap) {
  const team = teamMap[player.team];

  return `
    <div class="template-player-card">
      <div class="flex justify-between items-start mb-xs">
        <div style="flex: 1;">
          <div class="player-name">${player.first_name.charAt(0)}. ${player.second_name}</div>
          <div class="text-xs text-tertiary">${team.short_name}</div>
        </div>
        <div class="text-right">
          <div class="text-secondary text-base-sm" style="font-weight: 700;">
            £${(player.now_cost / 10).toFixed(1)}m
          </div>
        </div>
      </div>
      <div class="flex justify-between items-center">
        <div>
          <div class="ownership-badge ${getOwnershipClass(player.ownership_percent)}">
            ${player.ownership_percent.toFixed(1)}% owned
          </div>
          ${player.captain_percent > 5 ? `
            <div class="text-xs text-gold mt-xs">
              ${player.captain_percent.toFixed(1)}% (C)
            </div>
          ` : ''}
        </div>
        <div class="text-right">
          <div class="text-base-sm text-tertiary">
            ${player.total_points} pts
          </div>
          <div class="text-xs text-secondary">
            EO: ${player.effective_ownership.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  `;
}
```

**Checklist:**
- [ ] Update player cards to show EO
- [ ] Add captain percentage display
- [ ] Update "Last Updated" timestamp
- [ ] Update page subtitle
- [ ] Test display with real backend data

---

## Phase 6: Hetzner VPS Deployment

### 6.1 VPS Setup

#### Order VPS
- [ ] Go to Hetzner Cloud Console
- [ ] Create new project: "FPL-Stats"
- [ ] Order CX11 server (€4.15/month)
- [ ] Select Ubuntu 22.04 LTS
- [ ] Add SSH key
- [ ] Note IP address

#### Initial Server Setup
- [ ] SSH into server: `ssh root@your-server-ip`
- [ ] Update system:
```bash
apt update && apt upgrade -y
```
- [ ] Set timezone:
```bash
timedatectl set-timezone Europe/London
```

#### Install Node.js
- [ ] Install Node.js 20.x:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Verify installation
npm --version
```

#### Install Nginx
- [ ] Install Nginx:
```bash
apt install -y nginx
systemctl status nginx  # Check it's running
```

#### Install PM2
- [ ] Install PM2 globally:
```bash
npm install -g pm2
```

**Checklist:**
- [ ] VPS ordered and accessible
- [ ] System updated
- [ ] Timezone set to Europe/London
- [ ] Node.js installed
- [ ] Nginx installed and running
- [ ] PM2 installed

---

### 6.2 Deploy Application

#### Create Directory Structure
- [ ] Create app directories:
```bash
mkdir -p /var/www/livefplstats
cd /var/www/livefplstats
```

#### Upload Files
- [ ] Upload frontend to `/var/www/livefplstats/frontend`
- [ ] Upload backend to `/var/www/livefplstats/backend`

**Options for upload:**
1. **Git (Recommended)**:
```bash
cd /var/www/livefplstats
git clone https://github.com/yourusername/FPL-LIVE-TABLE.git .
```

2. **SCP**:
```bash
# From local machine
scp -r frontend/ root@your-server-ip:/var/www/livefplstats/
scp -r backend/ root@your-server-ip:/var/www/livefplstats/
```

3. **SFTP** (use FileZilla or similar)

#### Install Backend Dependencies
- [ ] Install npm packages:
```bash
cd /var/www/livefplstats/backend
npm install --production
```

#### Configure Environment
- [ ] Create `.env` file:
```bash
cd /var/www/livefplstats/backend
nano .env
```

**Add:**
```env
PORT=3000
NODE_ENV=production
FPL_API_BASE=https://fantasy.premierleague.com/api
RATE_LIMIT_DELAY_MS=500
LOG_LEVEL=info
```

**Checklist:**
- [ ] App directories created
- [ ] Files uploaded
- [ ] Backend dependencies installed
- [ ] Environment configured

---

### 6.3 Configure Nginx

- [ ] Create Nginx config:
```bash
nano /etc/nginx/sites-available/livefplstats
```

**Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or use IP: your-server-ip

    # Frontend
    root /var/www/livefplstats/frontend;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] Enable site:
```bash
ln -s /etc/nginx/sites-available/livefplstats /etc/nginx/sites-enabled/
```

- [ ] Test Nginx config:
```bash
nginx -t
```

- [ ] Restart Nginx:
```bash
systemctl restart nginx
```

**Checklist:**
- [ ] Nginx config created
- [ ] Site enabled
- [ ] Config tested successfully
- [ ] Nginx restarted

---

### 6.4 Start Backend with PM2

- [ ] Start backend:
```bash
cd /var/www/livefplstats/backend
pm2 start server.js --name fpl-backend
```

- [ ] Configure auto-start on reboot:
```bash
pm2 startup
pm2 save
```

- [ ] Check status:
```bash
pm2 status
pm2 logs fpl-backend
```

**Useful PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs fpl-backend   # View logs
pm2 restart fpl-backend # Restart app
pm2 stop fpl-backend   # Stop app
pm2 delete fpl-backend # Remove from PM2
```

**Checklist:**
- [ ] Backend started with PM2
- [ ] Auto-startup configured
- [ ] Backend running without errors
- [ ] Logs show server started

---

### 6.5 Test Deployment

- [ ] Test frontend loads: `http://your-server-ip`
- [ ] Test API responds: `http://your-server-ip/api/status`
- [ ] Test template page loads
- [ ] Test tier switching works
- [ ] Check PM2 logs for errors

**Checklist:**
- [ ] Frontend accessible
- [ ] API responding
- [ ] Template page working
- [ ] No errors in logs

---

### 6.6 Setup SSL (Optional but Recommended)

- [ ] Install Certbot:
```bash
apt install -y certbot python3-certbot-nginx
```

- [ ] Get SSL certificate:
```bash
certbot --nginx -d your-domain.com
```

- [ ] Test auto-renewal:
```bash
certbot renew --dry-run
```

**Checklist:**
- [ ] SSL certificate obtained
- [ ] HTTPS working
- [ ] Auto-renewal configured

---

## Phase 7: Testing & Optimization

### 7.1 Backend Testing

#### Manual Test
- [ ] Run manual update:
```bash
cd /var/www/livefplstats/backend
node cron/updateOwnership.js
```
- [ ] Check logs for errors
- [ ] Verify JSON files created in `data/`
- [ ] Check file sizes are reasonable

#### API Testing
- [ ] Test GET /api/status
```bash
curl http://localhost:3000/api/status
```
- [ ] Test GET /api/ownership/10k
```bash
curl http://localhost:3000/api/ownership/10k
```
- [ ] Test invalid tier returns 400
```bash
curl http://localhost:3000/api/ownership/invalid
```

**Checklist:**
- [ ] Manual update runs successfully
- [ ] Data files created correctly
- [ ] API endpoints respond correctly
- [ ] Error handling works

---

### 7.2 Frontend Testing

- [ ] Test template page loads
- [ ] Test tier buttons are visible
- [ ] Test clicking each tier button
- [ ] Test loading states show
- [ ] Test ownership data displays correctly
- [ ] Test with different screen sizes (mobile/desktop)

**Checklist:**
- [ ] All tier buttons work
- [ ] Data loads correctly
- [ ] UI responsive on mobile
- [ ] No console errors

---

### 7.3 Performance Optimization

#### Caching
- [ ] Add frontend cache in localStorage:
```javascript
// Cache ownership data for 1 hour
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function getCachedData(tier) {
  const cached = localStorage.getItem(`ownership_${tier}`);
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  const age = Date.now() - timestamp;

  if (age > CACHE_DURATION) {
    localStorage.removeItem(`ownership_${tier}`);
    return null;
  }

  return data;
}

function setCachedData(tier, data) {
  localStorage.setItem(`ownership_${tier}`, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
}
```

#### Compression
- [ ] Verify compression middleware is working
- [ ] Check response sizes in browser devtools

#### Rate Limiting Optimization
- [ ] Monitor API call duration during cron
- [ ] If too slow, increase rate limit gradually
- [ ] If getting errors, decrease rate limit

**Checklist:**
- [ ] Frontend caching implemented
- [ ] Response compression verified
- [ ] Rate limiting optimized
- [ ] Update duration < 4 hours

---

### 7.4 Monitoring

#### Setup Basic Monitoring
- [ ] Create monitoring script:
```bash
nano /var/www/livefplstats/monitor.sh
```

```bash
#!/bin/bash
# Check if backend is running
if ! pm2 status | grep -q "fpl-backend.*online"; then
  echo "Backend is down! Restarting..."
  pm2 restart fpl-backend
  # Optional: send alert email
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "Warning: Disk usage is ${DISK_USAGE}%"
fi
```

- [ ] Make executable: `chmod +x /var/www/livefplstats/monitor.sh`
- [ ] Add to crontab to run every 5 minutes:
```bash
crontab -e
# Add line:
*/5 * * * * /var/www/livefplstats/monitor.sh >> /var/www/livefplstats/backend/logs/monitor.log 2>&1
```

#### Log Rotation
- [ ] Setup log rotation for app logs:
```bash
nano /etc/logrotate.d/livefplstats
```

```
/var/www/livefplstats/backend/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

**Checklist:**
- [ ] Monitoring script created
- [ ] Cron job added
- [ ] Log rotation configured
- [ ] Monitoring working

---

## Timeline & Costs

### Development Timeline

**Week 1: Backend Core** (20-30 hours)
- [x] Day 1-2: Setup structure, dependencies
- [ ] Day 3-4: Implement fplDataFetcher.js
- [ ] Day 5-6: Implement ownershipCalculator.js
- [ ] Day 7: Implement dataStorage.js, test with sample

**Week 2: API & Cron** (15-20 hours)
- [ ] Day 1-2: Create Express server and routes
- [ ] Day 3-4: Implement cron job
- [ ] Day 5: Test full update cycle (top 10k)
- [ ] Day 6-7: Bug fixes and optimization

**Week 3: Frontend & Deploy** (15-20 hours)
- [ ] Day 1-2: Update template.js with backend integration
- [ ] Day 3: Add tier selector UI
- [ ] Day 4: VPS setup and deployment
- [ ] Day 5: Nginx config and PM2 setup
- [ ] Day 6-7: Testing, monitoring, optimization

**Total: ~50-70 hours over 3 weeks**

---

### Infrastructure Costs

**Monthly:**
- Hetzner VPS CX11: **€4.15/month** ($4.50)
- Domain (optional): ~€10/year (~$1/month)
- **Total: ~€5.15/month ($5.50)**

**One-Time:**
- Domain registration: ~€10/year (optional)

**Total First Year: ~€70 ($75)**

---

## Success Checklist

### Backend
- [ ] Backend API running on port 3000
- [ ] Cron job scheduled for Saturdays 2 AM
- [ ] Top 10k ownership data updates weekly
- [ ] JSON files stored correctly
- [ ] API endpoints respond < 500ms
- [ ] Logs show no errors

### Frontend
- [ ] Template page loads ownership from backend
- [ ] Tier selector buttons visible
- [ ] Can switch between top 100/1k/10k
- [ ] Data updates when switching tiers
- [ ] Loading states show during fetches
- [ ] Works on mobile and desktop

### Deployment
- [ ] VPS accessible and running
- [ ] Nginx serving frontend
- [ ] Backend running via PM2
- [ ] Auto-restart on reboot configured
- [ ] Monitoring script running
- [ ] SSL certificate installed (optional)

### Quality
- [ ] No console errors
- [ ] API responds quickly (< 500ms)
- [ ] Cron update completes in < 4 hours
- [ ] Logs are clean and informative
- [ ] Error handling works correctly

---

## Troubleshooting Guide

### Common Issues

**Backend won't start:**
```bash
cd /var/www/livefplstats/backend
pm2 logs fpl-backend
# Check for:
# - Missing dependencies: npm install
# - Port in use: Change PORT in .env
# - Syntax errors: Check logs
```

**API returns 404:**
```bash
# Check backend is running
pm2 status

# Check Nginx config
nginx -t
cat /etc/nginx/sites-enabled/livefplstats

# Check API endpoint
curl http://localhost:3000/api/status
```

**Ownership update fails:**
```bash
# Check logs
tail -100 /var/www/livefplstats/backend/logs/app.log

# Common causes:
# - FPL API rate limiting: Increase RATE_LIMIT_DELAY_MS
# - Network issues: Check internet connection
# - Disk full: df -h
```

**Frontend can't connect to backend:**
```javascript
// Check API URL in template.js
// Development: http://localhost:3000/api
// Production: http://your-server-ip/api or https://your-domain.com/api
```

**Cron not running:**
```bash
# Check cron logs
pm2 logs fpl-backend

# Verify timezone
timedatectl

# Test manual run
node /var/www/livefplstats/backend/cron/updateOwnership.js
```

---

## Next Steps After Implementation

### Phase 8: Enhancements (Future)
- [ ] Add historical gameweek data
- [ ] Add differential calculator (EO vs overall ownership)
- [ ] Add captain stats by tier
- [ ] Add chip usage stats by tier
- [ ] Add player ownership trends over time
- [ ] Add comparison view (100 vs 1k vs 10k vs overall)
- [ ] Add ownership change alerts
- [ ] Add export to CSV functionality
- [ ] Optimize rate limiting with proxy rotation
- [ ] Add Redis caching for faster API responses

### Phase 9: Analytics (Future)
- [ ] Track API usage
- [ ] Monitor update duration trends
- [ ] Alert on failed updates
- [ ] Dashboard for admin monitoring

---

## Resources & References

**FPL API:**
- League 314: `https://fantasy.premierleague.com/api/leagues-classic/314/standings/?page_standings={page}`
- Manager Picks: `https://fantasy.premierleague.com/api/entry/{id}/event/{gw}/picks/`
- Bootstrap: `https://fantasy.premierleague.com/api/bootstrap-static/`

**Tools:**
- Node.js: https://nodejs.org/
- Express: https://expressjs.com/
- PM2: https://pm2.keymetrics.io/
- Nginx: https://nginx.org/
- Hetzner: https://www.hetzner.com/cloud

**Documentation:**
- This plan: `BACKEND_IMPLEMENTATION_PLAN.md`
- Frontend docs: `README.md`

---

## Final Notes

This implementation will give your users:
✅ Real top manager ownership (not overall)
✅ Multiple tiers to choose from (100/1k/10k)
✅ Weekly automatic updates
✅ Fast, responsive UI
✅ Professional-grade backend
✅ Low cost (~$5/month)

**Remember:**
- Start with top 100 for testing (fastest)
- Scale to 10k once proven
- Monitor logs during first few updates
- Adjust rate limiting based on results
- Keep it simple - no database needed!

Good luck! 🚀
