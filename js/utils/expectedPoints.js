// Expected FPL Points Calculator
// Calculates what a player's FPL points "should have been" based on xG, xA, and xGC

/**
 * FPL Points by position for goals
 */
const GOAL_POINTS = {
    1: 6,  // GKP
    2: 6,  // DEF
    3: 5,  // MID
    4: 4   // FWD
};

/**
 * FPL Points for clean sheets by position
 */
const CLEAN_SHEET_POINTS = {
    1: 4,  // GKP
    2: 4,  // DEF
    3: 1,  // MID
    4: 0   // FWD
};

/**
 * Calculate expected points for a single gameweek
 * @param {object} gwData - Gameweek history data
 * @param {number} position - Player position type (1=GKP, 2=DEF, 3=MID, 4=FWD)
 * @returns {number} - Expected FPL points
 */
function calculateGameweekExpectedPoints(gwData, position) {
    let expectedPoints = 0;

    // Base points for appearance
    if (gwData.minutes >= 60) {
        expectedPoints += 2;
    } else if (gwData.minutes > 0) {
        expectedPoints += 1;
    } else {
        // Didn't play, return 0
        return 0;
    }

    // Expected goal points
    const xG = parseFloat(gwData.expected_goals || 0);
    expectedPoints += xG * GOAL_POINTS[position];

    // Expected assist points (3 points for all positions)
    const xA = parseFloat(gwData.expected_assists || 0);
    expectedPoints += xA * 3;

    // Expected clean sheet points (for GKP, DEF, MID only)
    if (position <= 3 && gwData.minutes >= 60) {
        const xGC = parseFloat(gwData.expected_goals_conceded || 0);
        // Poisson distribution: P(0 goals | xGC) = e^(-xGC)
        const cleanSheetProbability = Math.exp(-xGC);
        expectedPoints += cleanSheetProbability * CLEAN_SHEET_POINTS[position];
    }

    // TODO: Could add expected save points for GKP in future
    // Bonus points excluded as requested

    return expectedPoints;
}

/**
 * Calculate expected points for all gameweeks in player history
 * @param {object} playerHistory - Player history data from element-summary API
 * @param {number} position - Player position type
 * @returns {array} - Array of {gw, actualPoints, expectedPoints} objects
 */
function calculateAllExpectedPoints(playerHistory, position) {
    if (!playerHistory || !playerHistory.history) {
        return [];
    }

    return playerHistory.history.map(gwData => ({
        gw: gwData.round,
        actualPoints: gwData.total_points,
        expectedPoints: calculateGameweekExpectedPoints(gwData, position),
        minutes: gwData.minutes,
        xG: parseFloat(gwData.expected_goals || 0),
        xA: parseFloat(gwData.expected_assists || 0),
        xGC: parseFloat(gwData.expected_goals_conceded || 0)
    }));
}

/**
 * Calculate average points difference (actual vs expected)
 * @param {array} pointsData - Array from calculateAllExpectedPoints
 * @param {number} startGw - Start gameweek
 * @param {number} endGw - End gameweek
 * @returns {number} - Average difference (positive = overperforming)
 */
function calculateAverageDifference(pointsData, startGw, endGw) {
    const filteredData = pointsData.filter(d =>
        d.gw >= startGw && d.gw <= endGw && d.minutes > 0
    );

    if (filteredData.length === 0) return 0;

    const totalDifference = filteredData.reduce((sum, d) =>
        sum + (d.actualPoints - d.expectedPoints), 0
    );

    return totalDifference / filteredData.length;
}
