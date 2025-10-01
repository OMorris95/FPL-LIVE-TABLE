# Live FPL Stats - Development Roadmap

**Domain:** livefplstats.com
**Status:** Active Development
**Last Updated:** October 2025

---

## 🎯 Project Vision

Live FPL Stats aims to become the premier free FPL statistics and analytics platform following the shutdown of fplstatistics.com. We provide comprehensive, real-time Fantasy Premier League data with a clean, modern interface - completely free with no paywalls.

### Key Differentiators
- ✅ **100% Free** - No premium tiers or paywalls (unlike Fantasy Football Fix, Scout)
- ✅ **Live League Focus** - Real-time league tables with autosubs and bonus tracking
- ✅ **Modern UI** - Fire gradient theme, clean design, mobile-responsive
- ✅ **Copyright Compliant** - No FPL player images, text-only implementation
- ✅ **Comprehensive** - Combines best features from multiple paid platforms

---

## 📊 Current Features (Sprint 1 - ✅ COMPLETED)

### ✅ Home Page
- League ID input with instant loading
- Manager ID input for personal stats (coming soon)
- Clean, compact two-card layout
- Responsive design

### ✅ Live League Table
- Real-time points calculation
- Live bonus points integration
- Auto-substitution tracking
- Rank change indicators
- Chip usage display
- Last updated timestamp with manual refresh

### ✅ Dream Team
- Optimal XI from league squads
- Formation optimization (tests all 7 valid formations)
- Player of the Week badge
- Top 3 performers showcase
- Gameweek-specific analysis

### ✅ League Stats
- Captain pick analytics with distribution charts
- Ownership statistics (most owned players)
- Differential finder (low ownership players)
- Chip usage tracking (BB, TC, FH, WC)

### ✅ Manager Comparison
- Head-to-head analysis
- Squad overlap calculator
- Captain comparison
- Transfer cost analysis
- Current gameweek breakdown

---

## 🚀 Sprint 2: Core Manager Features (Week 2)

**Priority:** HIGH
**Target:** 5-7 days
**Goal:** Build personal manager dashboard and fixture planning tools

### Feature 1: My Stats Page 🆕
**File:** `js/pages/my-stats.js`
**Route:** `/my-stats`

**Features to Implement:**
- [ ] Manager ID input and validation
- [ ] Overall rank history graph (line chart)
  - Current rank vs. previous gameweeks
  - Rank percentile calculator
  - Best/worst rank tracking
- [ ] Gameweek performance table
  - Points per gameweek
  - Rank change per gameweek
  - Points vs. average comparison
- [ ] Team value tracker
  - Current team value
  - Historical team value graph
  - Value change over time
- [ ] Captain performance analytics
  - Success rate (captain returned points)
  - Total captain points
  - Best/worst captain picks
- [ ] Chip usage history
  - Which gameweeks chips were used
  - Points gained from chips
  - Remaining chips available
- [ ] Season summary stats
  - Total transfers made
  - Transfer cost (hits taken)
  - Average gameweek points
  - Highest/lowest gameweek score

**API Endpoints Required:**
- `/api/entry/{manager_id}/history/` - Overall history
- `/api/entry/{manager_id}/history-new/` - Season history
- `/api/entry/{manager_id}/event/{gw}/picks/` - Gameweek picks

**Design Notes:**
- Use fire gradient for stat cards
- Line graphs for rank/value tracking (use Chart.js or similar)
- Color-code positive/negative changes
- Responsive grid layout

---

### Feature 2: Fixture Difficulty Rating (FDR) Matrix
**File:** `js/pages/fixtures.js`
**Route:** `/fixtures`

**Features to Implement:**
- [ ] FDR matrix display (5 gameweeks ahead)
  - All 20 teams in rows
  - Next 5 fixtures in columns
  - Color-coded difficulty:
    - 🟢 Green (1-2): Easy
    - 🟡 Yellow (3): Medium
    - 🟠 Orange (4): Hard
    - 🔴 Red (5): Very Hard
- [ ] Position-specific filters
  - Attack difficulty (for forwards/mids)
  - Defense difficulty (for defenders/GK)
  - Overall difficulty
- [ ] Home/Away indicators
- [ ] Fixture ticker breakdown
  - Shows opponent strength
  - Recent form integration
- [ ] Blank/Double gameweek planner
  - Highlight BGW/DGW teams
  - Chip strategy suggestions

**API Endpoints Required:**
- `/api/bootstrap-static/` - Team data and fixtures
- `/api/fixtures/` - Upcoming fixture list

**Design Notes:**
- Scrollable table for mobile
- Hover tooltips for detailed fixture info
- Sort by difficulty (best to worst fixtures)
- Export to image feature (for sharing)

---

### Feature 3: Enhanced Navigation
**File:** `index.html`

**Updates Required:**
- [ ] Add "My Stats" to nav bar
- [ ] Add "Fixtures" to nav bar
- [ ] Update all page headers: "FPL Stats Hub" → "Live FPL Stats"
- [ ] Update document titles
- [ ] Add footer with copyright and links

---

## 📈 Sprint 3: Player Intelligence (Week 3)

**Priority:** HIGH
**Target:** 5-7 days
**Goal:** Build comprehensive player search and analysis tools

### Feature 4: Player Stats Hub
**File:** `js/pages/players.js`
**Route:** `/players`

**Features to Implement:**
- [ ] Player search functionality
  - Search by name
  - Filter by position (GK/DEF/MID/FWD)
  - Filter by team
  - Filter by price range
  - Sort by: points, form, value, xG, xA
- [ ] Player detail cards
  - Current form (last 5 GWs)
  - Total points, goals, assists
  - xG, xA, xGI stats
  - Shots on target, big chances
  - Minutes played
  - Bonus points system (BPS)
  - Upcoming fixtures (FDR)
  - Ownership percentage
  - Price and price trends
  - Set piece taker status
- [ ] Advanced stats section
  - Shots per 90 minutes
  - Expected points (xP)
  - Points per million
  - Clean sheet probability (defenders/GK)
  - Goal involvement (goals + assists)
- [ ] Set piece takers database
  - Penalty takers by team
  - Free kick takers
  - Corner takers
  - Priority order (1st, 2nd choice)

**API Endpoints Required:**
- `/api/bootstrap-static/` - Player data
- `/api/element-summary/{player_id}/` - Detailed player stats
- External: Understat.com API for xG/xA (or scrape)

**Design Notes:**
- Grid/list view toggle
- Player cards with team colors
- Mobile-friendly filters (collapsible)
- Pagination for large result sets

---

### Feature 5: Player Comparison Tool
**File:** `js/pages/players.js` (same page, different view)
**Route:** `/players/compare`

**Features to Implement:**
- [ ] Compare up to 4 players side-by-side
- [ ] Select players from dropdown/search
- [ ] Comparison table with:
  - Price
  - Total points
  - Form (last 5 GWs)
  - Goals, assists
  - xG, xA
  - Minutes played
  - Upcoming fixtures
  - Ownership %
  - Points per million
- [ ] Visual comparison (bar charts)
- [ ] "Better pick" recommendations

**Design Notes:**
- Responsive columns (stack on mobile)
- Highlight best stat in each row (green)
- Export comparison as image

---

### Feature 6: Price Change Predictor
**File:** `js/pages/price-predictor.js`
**Route:** `/prices`

**Features to Implement:**
- [ ] Price change predictions for tonight
  - Players predicted to rise
  - Players predicted to fall
  - Target percentage (0-100%)
- [ ] Net transfers tracking
  - Transfers in
  - Transfers out
  - Net transfers
- [ ] Historical price graphs
  - Price over season
  - Price change dates
  - Correlation with form
- [ ] Watchlist feature
  - Add players to personal watchlist
  - Local storage persistence
  - Alert indicators for watched players
- [ ] Price change history
  - When player changed price
  - Number of rises/falls this season
  - Total price change

**Algorithm Notes:**
- Use net transfers data from FPL API
- Track transfer deltas every hour
- Machine learning model (optional, advanced):
  - Features: net transfers, ownership %, form, fixtures
  - Train on historical price changes
  - Predict probability of rise/fall
- Simple threshold model:
  - Rise if net transfers > (ownership × 0.005)
  - Fall if net transfers < -(ownership × 0.005)

**API Endpoints Required:**
- `/api/bootstrap-static/` - Current prices
- `/api/event/{gw}/live/` - Transfers data
- Custom tracking: Store hourly snapshots

**Design Notes:**
- Color-coded arrows (green=rise, red=fall)
- Progress bars for target percentage
- Refresh every 30 minutes
- "Last updated" timestamp

---

## 🔧 Sprint 4: Advanced Planning Tools (Week 4)

**Priority:** MEDIUM
**Target:** 7-10 days
**Goal:** Build transfer planning and optimization tools

### Feature 7: Transfer Planner
**File:** `js/pages/transfer-planner.js`
**Route:** `/planner`

**Features to Implement:**
- [ ] Import current team (by manager ID)
- [ ] Multi-week planning (plan 5+ GWs ahead)
- [ ] Transfer suggestions
  - Based on fixtures
  - Based on form
  - Based on price rises
- [ ] Wildcard optimizer
  - Input budget
  - Position constraints (min/max per position)
  - Maximize projected points using Linear Programming
- [ ] Free Hit planner
  - Unlimited transfers for one week
  - Suggest optimal DGW/BGW team
- [ ] Bench Boost analyzer
  - Find best week based on bench strength
- [ ] Triple Captain analyzer
  - Show highest ceiling captain options
- [ ] Save multiple drafts
  - Compare side-by-side
  - Export/share drafts

**Optimization Algorithm:**
- Use simplex algorithm or Branch & Bound
- Constraints:
  - Budget: £100.0m
  - Players per team: max 3
  - Formation: min 1 GK, 3-5 DEF, 3-5 MID, 1-3 FWD
- Objective: Maximize sum of predicted points

**API Endpoints Required:**
- `/api/entry/{manager_id}/event/{gw}/picks/` - Current team
- `/api/bootstrap-static/` - Player data
- Predicted points from external source or custom model

**Design Notes:**
- Drag-and-drop interface (optional)
- Visual team formation display
- Color-coded by position
- Show remaining budget
- Show predicted points for each week

---

### Feature 8: Rotation Planner
**File:** `js/pages/rotation-planner.js`
**Route:** `/rotation`

**Features to Implement:**
- [ ] Show teams with fixture congestion
  - European competition teams
  - Cup matches
- [ ] Rotation risk indicators
  - High risk (likely to rotate)
  - Medium risk
  - Low risk (nailed starters)
- [ ] Bench value calculator
  - Show expected points from bench
  - Auto-sub predictions
- [ ] Playing time predictions
  - Minutes expected per player
  - Based on recent rotation patterns

**API Endpoints Required:**
- `/api/fixtures/` - Upcoming fixtures
- `/api/bootstrap-static/` - Player data
- External: European competition schedules

**Design Notes:**
- Calendar view of fixtures
- Color-coded rotation risk
- Tooltips with explanation
- Filter by team/position

---

## 📊 Sprint 5: Community Intelligence (Week 5)

**Priority:** MEDIUM
**Target:** 5-7 days
**Goal:** Template tracking, ownership, and live features

### Feature 9: Template Team Tracker
**File:** `js/pages/template.js`
**Route:** `/template`

**Features to Implement:**
- [ ] Top 10k ownership percentages
  - Most owned players (>70% = template)
  - Effective ownership (EO) calculator
    - EO = Ownership + Captain% + (TC% × 2)
- [ ] Template vs. Anti-template strategy
  - Show template team
  - Show best differentials to replace template
- [ ] Essential players tracker
  - Players >90% owned (must-haves)
- [ ] Ownership tiers
  - Essential (>70%)
  - Popular (40-70%)
  - Medium (15-40%)
  - Differential (<15%)
- [ ] Ownership change tracking
  - Rising ownership
  - Falling ownership

**API Endpoints Required:**
- `/api/bootstrap-static/` - Ownership data
- `/api/dream-team/{gw}/` - Top performers

**Design Notes:**
- Ownership percentage badges
- Color-coded tiers
- Compare your team vs. template
- Show % of top 10k who own each player

---

### Feature 10: Budget Bargains Finder
**File:** `js/pages/bargains.js`
**Route:** `/bargains`

**Features to Implement:**
- [ ] Filter by price bracket
  - £4.5m defenders
  - £5.0m-£5.5m midfielders
  - £6.0m-£7.0m forwards
- [ ] Value metrics
  - Points per million
  - Form per million
  - Minutes per million
- [ ] Form vs. fixtures analysis
  - Good form + good fixtures = bargain
- [ ] Differential bargains
  - Low ownership + good value
- [ ] Upcoming fixtures (next 5 GWs)
- [ ] Budget enablers
  - £4.5m bench fodder who play
  - Rotating budget options

**API Endpoints Required:**
- `/api/bootstrap-static/` - Player data
- FDR from fixtures page

**Design Notes:**
- Sort by value metrics
- Green highlighting for best bargains
- Show ownership % for differential hunting
- Position tabs (GK, DEF, MID, FWD)

---

### Feature 11: Live Features Enhancement
**File:** Update existing `js/pages/live-table.js`

**Features to Add:**
- [ ] Real-time bonus point tracking
  - Live BPS leaders
  - Provisional bonus (3, 2, 1)
  - Updates every 5 minutes during matches
- [ ] Auto-sub predictions
  - Who's likely to be subbed on
  - Expected bench points
- [ ] Live rank tracking
  - Overall rank during gameweek
  - Red/green arrows for rank changes
- [ ] Push notification system (optional)
  - Notify when player scores
  - Notify on price change
  - Notify before deadline
  - Requires user opt-in

**API Endpoints Required:**
- `/api/event/{gw}/live/` - Live gameweek data
- `/api/fixtures/?event={gw}` - Match status

**Design Notes:**
- Auto-refresh every 60 seconds during live matches
- Pause auto-refresh when matches finished
- Visual indicator for live updates
- Show match status (kickoff times, live, finished)

---

## 🎨 Sprint 6: Content & Polish (Week 6)

**Priority:** LOW
**Target:** 3-5 days
**Goal:** Captaincy tools, injury tracker, and final polish

### Feature 12: Captaincy Analytics
**File:** `js/pages/captaincy.js`
**Route:** `/captaincy`

**Features to Implement:**
- [ ] Captaincy recommendations for current GW
  - Expected points (xP)
  - Fixture difficulty
  - Recent form
  - Safety vs. differential
- [ ] Historical captain performance
  - Top captains this season
  - Points per captaincy
  - Blank rate
- [ ] Captain ownership tracking
  - Top 10k captain picks
  - Effective ownership impact
- [ ] Safety rating
  - Safe picks (>40% ownership)
  - Differential picks (<20% ownership)
- [ ] Ceiling vs. floor analysis
  - High ceiling (explosive potential)
  - High floor (reliable returns)

**API Endpoints Required:**
- `/api/bootstrap-static/` - Player data
- Custom model for xP predictions

**Design Notes:**
- Green/amber/red safety indicators
- Recommended captain with explanation
- Top 3 captain options
- Differential captain section

---

### Feature 13: Injury & Suspension Tracker
**File:** `js/pages/injuries.js`
**Route:** `/injuries`

**Features to Implement:**
- [ ] Current injuries by team
  - Player name
  - Injury type
  - Expected return date
  - Status (out, doubtful, 75% chance)
- [ ] Suspensions tracker
  - Red card suspensions
  - Yellow card accumulation
  - Games remaining in ban
- [ ] Impact on FPL
  - Ownership of injured players
  - Suggested replacements
- [ ] Return dates calendar
  - When players expected back
- [ ] News aggregation
  - Pull from official team news
  - Pull from FPL API news

**API Endpoints Required:**
- `/api/bootstrap-static/` - Player status, news
- External scraping: Premier League injury news

**Design Notes:**
- Team-by-team accordion view
- Color-coded severity (red=out, orange=doubtful, yellow=75%)
- Filter by position
- Sort by return date

---

### Feature 14: Final Polish
**Files:** Multiple

**Tasks:**
- [ ] Add meta tags for SEO
  - Title, description, keywords
  - Open Graph tags for social sharing
  - Schema.org structured data
- [ ] Create footer
  - Links to all pages
  - Copyright notice
  - Data source attribution (FPL API)
  - Contact/feedback form
  - GitHub link
- [ ] Add 404 page
- [ ] Add loading skeletons
  - Replace spinners with skeleton screens
- [ ] Optimize performance
  - Lazy load images (if any added later)
  - Minify CSS/JS for production
  - Enable gzip compression
  - Add service worker for offline capability
- [ ] Mobile optimization
  - Test all features on mobile
  - Fix any layout issues
  - Ensure touch-friendly buttons
- [ ] Accessibility improvements
  - Add ARIA labels
  - Keyboard navigation
  - Screen reader support
  - Color contrast checks
- [ ] Analytics setup
  - Google Analytics or Plausible
  - Track feature usage
  - Track page views
  - Track user retention

---

## 🔬 Future Enhancements (Backlog)

### Advanced Features (Post-Launch)
- [ ] Email newsletter system
  - Weekly tips
  - Price change alerts
  - Deadline reminders
- [ ] Social features
  - Share team to image
  - League invites
  - Community tips
- [ ] AI Assistant Manager
  - ML-powered transfer suggestions
  - Optimal team builder
  - Weekly recommendations
- [ ] Historical analysis
  - Previous season data
  - All-time best managers
  - Historical player performance
- [ ] API for developers
  - Public API endpoints
  - Documentation
  - Rate limiting
- [ ] Premium features (optional monetization)
  - Ad-free experience
  - Priority API access
  - Advanced analytics exports

### Content Additions
- [ ] Blog section
  - FPL strategy articles
  - Gameweek reviews
  - Player spotlights
- [ ] Video tutorials
  - How to use each feature
  - FPL strategy guides
- [ ] Community forum
  - Discussion boards
  - League recruitment
  - Tips sharing

---

## 🛠️ Technical Stack

### Frontend
- **Vanilla JavaScript** - No frameworks, pure JS
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, fire gradient theme
- **Chart.js** - Graphs and visualizations (to be added)

### Backend
- **None** - Fully client-side application
- **CORS Proxy** - https://corsproxy.io/
- **FPL API** - Official Fantasy Premier League endpoints

### Hosting
- **Domain** - livefplstats.com
- **Hosting** - TBD (Netlify, Vercel, GitHub Pages)
- **CDN** - Cloudflare (recommended)

### Development Tools
- **Git** - Version control
- **VS Code** - Primary editor
- **Chrome DevTools** - Debugging
- **Lighthouse** - Performance audits

---

## 📋 Testing Checklist

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Feature Testing
- [ ] All pages load correctly
- [ ] Navigation works (no broken links)
- [ ] API calls succeed
- [ ] Error handling works
- [ ] Loading states display
- [ ] Data updates correctly
- [ ] Charts render properly
- [ ] Forms validate input
- [ ] Local storage persists

### Performance Testing
- [ ] Page load time <2s
- [ ] API response time <1s
- [ ] No memory leaks
- [ ] Efficient re-renders
- [ ] Smooth animations (60fps)

### Accessibility Testing
- [ ] Screen reader compatible
- [ ] Keyboard navigable
- [ ] Color contrast passes WCAG AA
- [ ] Focus indicators visible
- [ ] ARIA labels present

---

## 📊 Success Metrics

### User Engagement
- **Target:** 1,000 daily active users within 3 months
- **Target:** 5,000 pageviews per day
- **Target:** Average session duration >5 minutes
- **Target:** Return user rate >40%

### Performance
- **Target:** Page load time <2 seconds
- **Target:** API response time <1 second
- **Target:** Uptime >99.5%

### Feature Adoption
- **Target:** 60% of users visit Live Table
- **Target:** 40% of users visit My Stats
- **Target:** 30% of users use Player Search
- **Target:** 20% of users use Transfer Planner

### SEO
- **Target:** Rank top 10 for "FPL statistics"
- **Target:** Rank top 5 for "FPL price predictor"
- **Target:** Rank top 10 for "FPL fixture difficulty"

---

## 🗓️ Timeline Summary

| Sprint | Duration | Focus Area | Key Deliverables |
|--------|----------|------------|------------------|
| Sprint 1 | ✅ Done | Foundation | Home, Live Table, Dream Team, League Stats, Comparison |
| Sprint 2 | Week 2 | Manager Tools | My Stats, FDR Matrix, Navigation Updates |
| Sprint 3 | Week 3 | Player Intelligence | Player Hub, Comparison, Price Predictor |
| Sprint 4 | Week 4 | Planning Tools | Transfer Planner, Rotation Planner, Optimizers |
| Sprint 5 | Week 5 | Community Features | Template Tracker, Bargains, Live Enhancements |
| Sprint 6 | Week 6 | Content & Polish | Captaincy, Injuries, Final Polish, Launch |

**Total Timeline:** 6-7 weeks from start to launch

---

## 🎯 Competitive Analysis

### vs. Fantasy Football Fix (fantasyfootballfix.com)
**Their Strengths:**
- Established brand
- AI Assistant Manager
- Browser extension
- Push notifications

**Our Advantages:**
- Completely free (they're £15-25/year)
- Cleaner, modern UI
- Faster performance (no bloat)
- Live league focus (unique feature)

### vs. Fantasy Football Scout (fantasyfootballscout.co.uk)
**Their Strengths:**
- Premium content and articles
- Predicted lineups
- Opta stats integration
- Large community

**Our Advantages:**
- Free access to all tools
- Better price predictor
- More comprehensive league stats
- Modern tech stack

### vs. LiveFPL (livefpl.net)
**Their Strengths:**
- Excellent price predictor
- Live league tables
- Clean interface

**Our Advantages:**
- More features (they're focused on live data)
- Better player search
- Transfer planning tools
- Manager dashboard

### vs. FPL Analytics (fplanalytics.com)
**Their Strengths:**
- Data visualizations
- Historical analysis

**Our Advantages:**
- Better UX/UI
- More actionable insights
- Planning tools
- Real-time features

---

## 📝 Notes & Decisions

### Design Principles
1. **Speed First** - Every feature must load in <2 seconds
2. **Mobile-First** - Design for mobile, enhance for desktop
3. **Data-Driven** - All recommendations backed by data
4. **Free Forever** - Core features always free (optional premium later)
5. **Copyright Compliance** - No FPL images, respect API rate limits

### API Rate Limiting
- FPL API has no official rate limit, but be respectful
- Cache responses for 5 minutes minimum
- Use local storage to reduce API calls
- Implement exponential backoff on errors

### Monetization Strategy (Future)
- **Phase 1:** Build user base, everything free
- **Phase 2:** Add non-intrusive ads (if needed)
- **Phase 3:** Optional premium tier (ad-free, advanced exports)
- **Phase 4:** Affiliate partnerships (FPL content creators)

### Branding
- **Name:** Live FPL Stats
- **Domain:** livefplstats.com
- **Tagline:** "Your Free FPL Command Center"
- **Colors:** Fire gradient (#ffc500 to #c21500)
- **Tone:** Helpful, data-driven, not clickbait

---

## 🤝 Contributing

This is currently a solo project, but contributions welcome after MVP launch.

### How to Contribute
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

### Code Standards
- Use vanilla JavaScript (ES6+)
- Comment complex logic
- Follow existing file structure
- Test on multiple browsers
- Keep performance in mind

---

## 📞 Contact & Support

- **Developer:** [Your Name]
- **Email:** [TBD]
- **GitHub:** [TBD]
- **Twitter/X:** [TBD]

---

## 🏆 Credits & Acknowledgments

### Data Sources
- **Fantasy Premier League Official API** - All player and team data
- **Understat** - xG and xA statistics
- **FPL Community** - Feature inspiration and feedback

### Inspiration
- FPL Statistics (RIP) - Original inspiration
- LiveFPL - Live table concept
- Fantasy Football Fix - Feature set inspiration
- FPL Reddit community - Feature requests

---

**Last Updated:** October 2025
**Version:** 2.0
**Status:** 🟢 Active Development

---

*This roadmap is a living document and will be updated as development progresses.*
