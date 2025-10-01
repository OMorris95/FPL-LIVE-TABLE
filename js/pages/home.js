// Home Page - League Selection
async function renderHomePage() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="home-container" style="max-width: 1000px; margin: 0 auto; padding-top: 2rem;">
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Enter League ID</h2>
                    </div>
                    <form id="league-form">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <input
                                type="number"
                                id="league-id-input"
                                class="form-input form-input-compact"
                                placeholder="e.g., 314"
                                required
                            />
                        </div>

                        <button type="submit" class="btn-primary" style="width: 100%;">
                            Load League
                        </button>
                    </form>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Enter Manager ID</h2>
                    </div>
                    <form id="manager-form">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <input
                                type="number"
                                id="manager-id-input"
                                class="form-input form-input-compact"
                                placeholder="e.g., 123456"
                                required
                            />
                        </div>

                        <button type="submit" class="btn-primary" style="width: 100%;">
                            Load Manager
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Handle league form submission
    const leagueForm = document.getElementById('league-form');
    leagueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leagueId = document.getElementById('league-id-input').value;

        if (leagueId) {
            // Store league ID and navigate to live table
            router.setLeagueId(leagueId);
            router.navigate('/live-table', { leagueId });
        }
    });

    // Handle manager form submission
    const managerForm = document.getElementById('manager-form');
    managerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const managerId = document.getElementById('manager-id-input').value;

        if (managerId) {
            // TODO: Navigate to manager dashboard when implemented
            alert('Manager dashboard coming soon! Manager ID: ' + managerId);
        }
    });
}

// Register home route
router.addRoute('/', renderHomePage);
