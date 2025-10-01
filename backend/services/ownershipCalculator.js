/**
 * Calculates ownership percentages from manager picks data
 * Returns array of players sorted by ownership percentage
 */
function calculateOwnership(managerPicksArray) {
    const playerCount = {};
    const totalManagers = managerPicksArray.length;

    // Count how many times each player appears
    managerPicksArray.forEach(managerData => {
        managerData.picks.forEach(pick => {
            const playerId = pick.element;
            if (!playerCount[playerId]) {
                playerCount[playerId] = 0;
            }
            playerCount[playerId]++;
        });
    });

    // Calculate ownership percentages
    const ownershipData = [];
    for (const [playerId, count] of Object.entries(playerCount)) {
        const ownershipPercent = ((count / totalManagers) * 100).toFixed(2);
        ownershipData.push({
            player_id: parseInt(playerId),
            ownership_count: count,
            ownership_percent: parseFloat(ownershipPercent)
        });
    }

    // Sort by ownership percentage (highest first)
    ownershipData.sort((a, b) => b.ownership_percent - a.ownership_percent);

    return ownershipData;
}

/**
 * Calculates ownership for all three tiers from the same dataset
 * Single fetch approach: get top 10k once, filter in memory
 */
function calculateAllTierOwnership(allManagerPicks) {
    console.log('Calculating ownership for all tiers...');

    // Top 100
    const top100Picks = allManagerPicks.slice(0, 100);
    const top100Ownership = calculateOwnership(top100Picks);
    console.log(`Top 100: ${top100Ownership.length} unique players`);

    // Top 1k
    const top1kPicks = allManagerPicks.slice(0, 1000);
    const top1kOwnership = calculateOwnership(top1kPicks);
    console.log(`Top 1k: ${top1kOwnership.length} unique players`);

    // Top 10k
    const top10kOwnership = calculateOwnership(allManagerPicks);
    console.log(`Top 10k: ${top10kOwnership.length} unique players`);

    return {
        top100: top100Ownership,
        top1k: top1kOwnership,
        top10k: top10kOwnership
    };
}

module.exports = {
    calculateOwnership,
    calculateAllTierOwnership
};
