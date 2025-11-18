# FPL Chart Calculations Documentation

This document explains how each chart in the LiveFPLStats application calculates and displays data.

---

## 1. Player Performance Comparison Chart

**Location:** Homepage - Chart 1
**File:** `js/components/playerComparisonChart.js`
**Purpose:** Compare multiple players' performance across various metrics over time

### Data Source
- FPL API: `element-summary/{playerId}/` endpoint
- Uses `history` array for gameweek-by-gameweek stats

### Available Metrics
- **Total Points** (`total_points`) - Actual FPL points scored each gameweek
- **xGI** (`expected_goal_involvements`) - Expected Goals + Expected Assists
- **xG** (`expected_goals`) - Expected Goals (probability of shot resulting in goal)
- **xA** (`expected_assists`) - Expected Assists (probability of creating assist)
- **Goals** (`goals_scored`) - Actual goals scored
- **Assists** (`assists`) - Actual assists provided
- **Bonus** (`bonus`) - Bonus points awarded
- **ICT Index** (`ict_index`) - Influence, Creativity, Threat combined metric
- **BPS** (`bps`) - Bonus Points System score

### Features
- Multi-player comparison (up to 5 players)
- Range selection: 5GW, 10GW, or Full Season
- Line chart with different colors for each player
- Null values for gameweeks where player didn't play

### Calculation
No complex calculations - displays raw API data directly from FPL's official statistics.

---

## 2. Expected Points vs Actual Points Chart

**Location:** Homepage - Chart 2
**File:** `js/components/expectedPointsChart.js`
**Utility:** `js/utils/expectedPoints.js`
**Purpose:** Compare a player's actual FPL points against their expected points based on underlying statistics

### Data Source
- FPL API: `element-summary/{playerId}/` endpoint
- Uses `history` array for gameweek-by-gameweek stats
- Player position from `bootstrap-static` data

### Expected Points Calculation Formula

#### Base Points (Appearance)
```
If minutes >= 60: +2 points
If 0 < minutes < 60: +1 point
If minutes = 0: 0 points (return early)
```

#### Expected Goal Points
```
Expected Goal Points = xG × Position Multiplier

Position Multipliers:
- GKP (1): 6 points per goal
- DEF (2): 6 points per goal
- MID (3): 5 points per goal
- FWD (4): 4 points per goal
```

#### Expected Assist Points
```
Expected Assist Points = xA × 3
(Same for all positions)
```

#### Expected Clean Sheet Points (GKP, DEF, MID only)
```
Only awarded if minutes >= 60

Clean Sheet Probability = e^(-xGC)
(Poisson distribution: probability of 0 goals conceded given xGC)

Expected CS Points = P(CS) × CS Points for Position

CS Points by Position:
- GKP (1): 4 points
- DEF (2): 4 points
- MID (3): 1 point
- FWD (4): 0 points (no clean sheet points)
```

#### Total Expected Points
```
xPts = Base Points
     + (xG × Goal Multiplier)
     + (xA × 3)
     + (P(CS) × CS Points)
```

**Note:** Bonus points are excluded from expected points calculation as they depend on too many factors beyond xG/xA.

### Performance Indicator Calculation
```
Average Difference = Σ(Actual Points - Expected Points) / Number of Games Played

Where:
- Games Played = gameweeks with minutes > 0 in selected range
- Positive value = Overperforming (green indicator)
- Negative value = Underperforming (red indicator)
- Zero = On target (neutral indicator)
```

### Chart Display
- **Blue solid line:** Actual points per gameweek
- **Orange dashed line:** Expected points per gameweek
- **Performance Box:** Shows average pts/game difference with color coding

### Limitations
1. Uses player's xGC (expected goals conceded) as proxy for opponent attacking threat
   - More accurate would be opponent team's actual xG, but not available in FPL API
2. Bonus points excluded due to complexity (BPS uses 30+ metrics)
3. Goalkeeper saves points not included in expected calculation
4. Does not account for captaincy, triple captain, or bench boost chips

### Example Calculation

**Mohamed Salah (FWD) - Gameweek 15:**
- Minutes: 90
- xG: 0.65
- xA: 0.32
- xGC: 1.2 (not used for FWD)

```
Base Points: 2 (played 60+ mins)
Expected Goals: 0.65 × 4 = 2.6 points
Expected Assists: 0.32 × 3 = 0.96 points
Expected CS: 0 (forwards don't get CS points)

Total Expected Points = 2 + 2.6 + 0.96 = 5.56 points
```

If Salah scored 8 actual points that gameweek:
```
Difference = 8 - 5.56 = +2.44 (overperforming)
```

---

## 3. Player Stats Radar Chart

**Location:** Homepage - Chart 3
**Files:** `js/components/playerRadarChart.js`, `js/utils/radarStats.js`, `js/chartConfig.js`
**Purpose:** Visualize player performance across multiple metrics, normalized against the best players in their position. **Supports comparing up to 2 players** (same position only).

### Features
- **Two-Player Comparison:** Compare up to 2 players side-by-side
- **Position Restriction:** Second player must be same position as first
- **Color Coding:** Player 1 (Red/Pink), Player 2 (Blue)
- **Custom Tooltips:** Show both normalized (0-100) and raw values
- **Clean Visualization:** No axis numbers, only radial grid lines

### Data Source
- **Full Season:** `bootstrap-static` data (season totals)
- **Last 5GW/10GW:** `element-summary/{playerId}/history` for selected players
- Normalization always uses season maximums for consistency

### Stats by Position

#### Forwards (6 stats):
1. **Goals** - Goals scored
2. **Assists** - Assists provided
3. **Minutes Per Game** - Average minutes when playing
4. **Discipline** - Weighted cards (inverted: fewer = better)
5. **BPS** - Bonus Points System score
6. **ICT Index** - Influence, Creativity, Threat combined

#### Midfielders (7 stats):
1. **Goals** - Goals scored
2. **Assists** - Assists provided
3. **Minutes Per Game** - Average minutes when playing
4. **Discipline** - Weighted cards (inverted: fewer = better)
5. **Clean Sheets** - Clean sheets kept
6. **BPS** - Bonus Points System score
7. **ICT Index** - Influence, Creativity, Threat combined

#### Defenders (7 stats):
1. **Goals** - Goals scored
2. **Assists** - Assists provided
3. **Minutes Per Game** - Average minutes when playing
4. **Discipline** - Weighted cards (inverted: fewer = better)
5. **Clean Sheets** - Clean sheets kept
6. **BPS** - Bonus Points System score
7. **ICT Index** - Influence, Creativity, Threat combined

#### Goalkeepers (7 stats):
1. **Clean Sheets** - Clean sheets kept
2. **Saves** - Total saves made
3. **BPS** - Bonus Points System score
4. **Discipline** - Weighted cards (inverted: fewer = better)
5. **% Games Played** - Percentage of total gameweeks played
6. **Goals Prevented** - Goals conceded (inverted: fewer = better)
7. **Penalties Saved** - Penalties saved

### Calculation Formulas

#### Weighted Cards (Discipline)
```
Weighted Cards = Yellow Cards + (Red Cards × 3)
```
- Weights red cards more heavily due to severity
- Yellow card = 1 point, Red card = 3 points

#### Minutes Per Game
```
Minutes Per Game = Total Minutes / Games Played

Where Games Played = count of gameweeks with minutes > 0
```
- Only counts games where player actually played
- Excludes gameweeks where minutes = 0

#### % Games Played (GKP only)
```
% Games Played = (Games Played / Total Gameweeks) × 100
```
- Shows how often the goalkeeper plays
- Important for rotation risk assessment

### Normalization Logic

All stats are normalized to a 0-100 scale based on position maximums:

#### Standard Stats (Higher is Better)
```
Normalized Value = (Player Value / Position Max) × 100

Example: If max goals for FWD is 20, player with 10 goals gets:
= (10 / 20) × 100 = 50
```

#### Inverted Stats (Lower is Better)
For **Discipline** (cards) and **Goals Prevented** (goals conceded):
```
Normalized Value = ((Position Max - Player Value) / (Position Max - Position Min)) × 100

Example: If cards range from 0 (min) to 12 (max), player with 3 cards gets:
= ((12 - 3) / (12 - 0)) × 100 = 75

Player with 0 cards (best discipline) gets:
= ((12 - 0) / (12 - 0)) × 100 = 100
```

**Edge Case:** If max = min (all players have same value):
- Standard stats: return 0
- Inverted stats: return 100

### Position Comparison

Players are **only compared to others in their position**:
- Forwards compared to forwards
- Midfielders compared to midfielders
- Defenders compared to defenders
- Goalkeepers compared to goalkeepers

This ensures fair comparison (e.g., a defender's 5 goals is more impressive relative to other defenders than a forward's 5 goals relative to other forwards).

### Range Selection

**Full Season:**
- Uses `bootstrap-static` season totals
- Fast - no additional API calls
- Normalization uses season maximums

**Last 5GW / Last 10GW:**
- Fetches player's `element-summary` history
- Sums stats over selected gameweek range
- **Normalization still uses season maximums** for consistency
- This means a player's radar shape won't change as dramatically with range selection

### Example Calculation

**Erling Haaland (FWD) - Full Season:**
- Goals: 18 (Position max: 20)
- Assists: 4 (Position max: 10)
- Mins/Game: 85 (Position max: 90)
- Weighted Cards: 2 (Position range: 0-8)
- BPS: 450 (Position max: 500)
- ICT: 180 (Position max: 200)

**Normalized Values:**
```
Goals: (18 / 20) × 100 = 90
Assists: (4 / 10) × 100 = 40
Mins/Game: (85 / 90) × 100 = 94
Discipline: ((8 - 2) / 8) × 100 = 75  (inverted)
BPS: (450 / 500) × 100 = 90
ICT: (180 / 200) × 100 = 90
```

**Radar Result:** Strong in goals, BPS, ICT, and minutes. Weaker in assists. Good discipline.

### Tooltip Format

When hovering over a data point on the radar, the tooltip displays:
```
[Player Name]: [Normalized]/100 ([Raw Value with Unit])
```

**Examples:**
- **Goals:** "Haaland: 90.0/100 (18 goals)"
- **Discipline:** "Van Dijk: 75.0/100 (2 cards)"
- **Mins/Game:** "Salah: 94.0/100 (85.0 mins/game)"
- **% Games Played:** "Alisson: 88.0/100 (88.0%)"
- **ICT Index:** "De Bruyne: 92.0/100 (184.5 ICT)"

This provides context by showing both the normalized score (for comparison) and the actual statistic value.

### Two-Player Comparison

**Adding Players:**
1. Search and select first player - Chart displays with red/pink coloring
2. Search and select second player - Must be same position
3. Both players overlay on same radar with different colors

**Position Validation:**
- If second player is different position, shows alert:
  ```
  Players must be in the same position for comparison.
  First player: [Position Name]
  Selected player: [Position Name]
  ```

**Color Scheme:**
- **Player 1 (First):** Red border (`#ef4444`), Pink fill (`rgba(239, 68, 68, 0.2)`)
- **Player 2 (Second):** Blue border (`#3b82f6`), Blue fill (`rgba(59, 130, 246, 0.2)`)

**Removing Players:**
- Click × on player chip to remove
- Chart updates to show remaining player(s)

**Limitations:**
- Maximum 2 players
- Players must be same position (GKP, DEF, MID, or FWD)
- Uses same stats for both players (position-specific)

---

## Future Charts

### Placeholder Charts (To Be Implemented)

**Chart 4-6:** Currently display placeholder data with Chart.js examples
- Will be replaced with FPL-specific analytics
- Potential ideas:
  - Form vs Fixtures difficulty
  - Price changes tracker
  - Captain picks analyzer
  - Template team ownership
  - Budget optimization
  - Transfer trends

---

## Data Caching

All chart data is cached using session storage:
- Player history: 7 days
- Bootstrap static: 24 hours
- Live gameweek: 60 seconds (if active), 7 days (if finished)

This reduces API calls and improves performance.

---

## Related Files

- `js/api.js` - API fetching and caching logic
- `js/chartConfig.js` - Chart.js configuration presets
- `js/chartFactory.js` - Chart creation utilities
- `js/chartExpander.js` - Full-screen chart modal
- `css/styles.css` - Chart styling and responsive design

---

*Last Updated: 2025-11-17*
