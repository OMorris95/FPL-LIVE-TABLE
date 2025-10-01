// Home Page - League Selection
async function renderHomePage() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="home-container">
            <div class="hero-section text-center mb-2">
                <h1 style="font-size: 3rem; color: var(--secondary-color); margin-bottom: 1rem;">
                    FPL Stats Hub
                </h1>
                <p style="font-size: 1.2rem; color: #aaa; margin-bottom: 2rem;">
                    Your comprehensive Fantasy Premier League statistics and analysis platform
                </p>
            </div>

            <div class="card" style="max-width: 500px; margin: 0 auto;">
                <div class="card-header">
                    <h2 class="card-title">Enter Your League</h2>
                </div>
                <form id="league-form">
                    <div class="form-group">
                        <label class="form-label" for="league-id-input">
                            League ID
                        </label>
                        <input
                            type="number"
                            id="league-id-input"
                            class="form-input"
                            placeholder="e.g., 314"
                            required
                        />
                        <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">
                            Find your League ID in the URL of your FPL league page
                        </p>
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%;">
                        Load League
                    </button>
                </form>
            </div>

            <div class="features-grid grid-3 mt-2">
                <div class="card">
                    <h3 style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                        📊 Live League Table
                    </h3>
                    <p style="color: #aaa;">
                        Real-time league standings with live points, auto-subs, and detailed team breakdowns
                    </p>
                </div>
                <div class="card">
                    <h3 style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                        ⭐ Dream Team
                    </h3>
                    <p style="color: #aaa;">
                        View the optimal XI from your league each gameweek, plus Player of the Week
                    </p>
                </div>
                <div class="card">
                    <h3 style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                        📈 League Analytics
                    </h3>
                    <p style="color: #aaa;">
                        Captain picks, ownership stats, chip usage, and comprehensive league insights
                    </p>
                </div>
                <div class="card">
                    <h3 style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                        🔄 Manager Comparison
                    </h3>
                    <p style="color: #aaa;">
                        Head-to-head analysis between any two managers in your league
                    </p>
                </div>
                <div class="card">
                    <h3 style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                        📅 Fixture Analysis
                    </h3>
                    <p style="color: #aaa;">
                        Fixture difficulty ratings and schedule planning tools (coming soon)
                    </p>
                </div>
                <div class="card">
                    <h3 style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                        💰 Player Stats
                    </h3>
                    <p style="color: #aaa;">
                        Comprehensive player statistics, form tracking, and price changes (coming soon)
                    </p>
                </div>
            </div>
        </div>
    `;

    // Handle form submission
    const form = document.getElementById('league-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leagueId = document.getElementById('league-id-input').value;

        if (leagueId) {
            // Store league ID and navigate to live table
            router.setLeagueId(leagueId);
            router.navigate('/live-table', { leagueId });
        }
    });
}

// Register home route
router.addRoute('/', renderHomePage);
