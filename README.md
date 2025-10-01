# FPL Stats Hub

A comprehensive Fantasy Premier League statistics and analysis platform featuring live league tables, dream team calculations, league analytics, and manager comparisons.

## Features

### ✅ Phase 1 Complete

#### 🏠 Home Page
- League ID input with instant access
- Feature overview and navigation

#### 📊 Live League Table
- Real-time league standings with live points
- Auto-subs calculation
- Player-by-player breakdown for each manager
- Expandable team details showing Starting XI, bench, chips, and transfer costs

#### ⭐ Dream Team
- Optimal XI calculator using all players from league managers' squads
- Automatic formation optimization (tests all valid FPL formations)
- Player of the Week highlighting with detailed stats
- Visual pitch display with player positions
- Top 3 performers showcase

#### 📈 League Statistics
- **Captain Analytics**: Most captained players with success rates
- **Ownership Tracker**: Most owned players and unique differentials
- **Chip Usage**: Real-time tracking of Bench Boost, Triple Captain, Free Hit, and Wildcard usage
- Visual distributions and percentage breakdowns

#### 🔄 Manager Comparison
- Head-to-head analysis between any two managers
- Squad overlap visualization (shared vs unique players)
- Points comparison and current gameweek details
- Captain choices, chip usage, and transfer costs comparison

## Project Structure

```
FPL-LIVE-TABLE/
├── index.html                    # Main entry point
├── css/
│   └── styles.css               # All styling
├── js/
│   ├── api.js                   # FPL API helper functions
│   ├── dreamteam.js             # Dream team calculation logic
│   ├── router.js                # Client-side routing
│   ├── app.js                   # Application initialization
│   └── pages/
│       ├── home.js              # Home page
│       ├── live-table.js        # Live league table
│       ├── dream-team.js        # Dream team page
│       ├── league-stats.js      # League statistics
│       └── comparison.js        # Manager comparison
├── fpl-discord-bot/             # Separate Discord bot project
└── README.md                    # This file
```

## Installation & Usage

### Local Development

**Method 1: Direct File (Simplest)**
1. Clone or download this repository
2. Open `index.html` in a web browser
3. The router will automatically use hash-based URLs (e.g., `#/live-table`)
4. Enter your FPL League ID and start exploring

**Method 2: Local Server (Recommended)**
1. Run `python serve.py` or double-click `serve.bat` (Windows)
2. Open http://localhost:8000 in your browser
3. Get the full experience with clean URLs like `/live-table`
4. Better for testing before deployment

### Finding Your League ID
1. Go to https://fantasy.premierleague.com/
2. Navigate to your league
3. Look at the URL: `https://fantasy.premierleague.com/leagues/YOUR_LEAGUE_ID/standings/c`
4. The number is your League ID
5. Enter it on the FPL Stats Hub homepage

### Hosting

This is a static site that can be hosted on:
- **GitHub Pages**: Push to a GitHub repo and enable Pages
- **Netlify**: Drag and drop the folder or connect your Git repo
- **Vercel**: Similar to Netlify
- **Any static hosting service**

## Configuration

### Router Modes

The router automatically detects the environment:
- **Local Files (`file://`)**: Uses hash-based routing (`#/page`)
- **Web Server (`http://` or `https://`)**: Uses clean URLs (`/page`)

No configuration needed - it just works!

### CORS Proxy

The site uses a CORS proxy to access the FPL API from the browser. Current proxy: `https://corsproxy.io/`

If you encounter issues, you can change the proxy in `js/api.js`:

```javascript
const CORS_PROXY = 'https://corsproxy.io/?';
```

Alternative proxies:
- `https://api.allorigins.win/raw?url=`
- `https://corsproxy.io/?`
- Host your own CORS proxy

## Technical Details

### Technologies Used
- **Vanilla JavaScript** - No frameworks, pure JS
- **Client-Side Routing** - SPA navigation without page reloads
- **FPL API** - Official Fantasy Premier League API
- **CSS Grid & Flexbox** - Responsive layouts

### API Endpoints Used

- `bootstrap-static/` - Players, teams, gameweeks
- `event/{gw}/live/` - Live gameweek data
- `leagues-classic/{id}/standings/` - League standings
- `entry/{id}/event/{gw}/picks/` - Manager picks
- `entry/{id}/history/` - Manager history

### Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Roadmap

### Phase 2: General FPL Stats (Coming Soon)
- Player statistics hub with search
- Fixture difficulty tracker
- Price change tracker
- Gameweek overview with top performers

### Phase 3: Enhanced UI/UX (Coming Soon)
- Charts and data visualization
- Dark/light mode toggle
- Mobile responsive improvements
- Shareable league URLs

### Phase 4: Advanced Features (Future)
- Transfer planner
- Chip strategy advisor
- Image generation for team graphics
- Historical data analysis

## Discord Bot Integration

This project includes a companion Discord bot (`fpl-discord-bot/`) that:
- Generates team lineup images
- Shows league dream teams
- Tracks captain choices
- Displays player ownership

The bot and website share similar logic but are separate projects.

## Contributing

Feel free to fork and improve! Some areas for contribution:
- Additional statistics and analytics
- Chart/graph visualizations
- Mobile UI improvements
- New features from the roadmap

## License

Free to use and modify. Built for the FPL community!

## Credits

- FPL API: Fantasy Premier League (official)
- Inspired by community tools like LiveFPL, FPL Review, and others

---

Built with ⚽ for the FPL community
