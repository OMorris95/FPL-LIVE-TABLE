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

## Future Charts

### Placeholder Charts (To Be Implemented)

**Chart 3-6:** Currently display placeholder data with Chart.js examples
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
