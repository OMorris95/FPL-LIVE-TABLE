# FPL Backend Service

Backend service for fetching and storing FPL top manager ownership data.

## Setup

```bash
cd backend
npm install
```

## Run

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## API Endpoints

### Get Ownership Data
```
GET /api/ownership/:tier/:gameweek
```
- `tier`: 100, 1k, or 10k
- `gameweek`: 1-38

Example: `GET /api/ownership/10k/15`

### Get Latest Ownership Data
```
GET /api/ownership/:tier/latest
```

Example: `GET /api/ownership/10k/latest`

### Get Update Status
```
GET /api/status
```

Returns current gameweek and last update status.

## Architecture

**Single Fetch Approach:**
1. Fetch top 10k manager IDs once (pages 1-200 of global league 314)
2. Fetch all 10k manager picks once
3. Calculate ownership for all tiers from same dataset:
   - Top 100: `.slice(0, 100)`
   - Top 1k: `.slice(0, 1000)`
   - Top 10k: all data

**Cron Schedule:**
- Runs every Saturday at 2:00 AM
- Updates ownership data for current gameweek

**Data Storage:**
- JSON files in `data/` directory
- Format: `ownership_[tier]_gw[gameweek].json`
