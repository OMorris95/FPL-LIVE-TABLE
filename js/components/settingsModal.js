// Settings Modal Component
// Allows users to edit their Manager ID and League ID

/**
 * Opens the settings modal
 */
function openSettingsModal() {
    // Check if modal already exists
    let modal = document.getElementById('settings-modal');

    if (!modal) {
        // Create modal
        modal = createSettingsModal();
        document.body.appendChild(modal);
    }

    // Load current values from localStorage
    const managerId = localStorage.getItem('fpl_manager_id') || '';
    const leagueId = localStorage.getItem('fpl_league_id') || '';

    // Populate form
    const managerInput = document.getElementById('settings-manager-id');
    const leagueInput = document.getElementById('settings-league-id');

    if (managerInput) managerInput.value = managerId;
    if (leagueInput) leagueInput.value = leagueId;

    // Show modal
    modal.style.display = 'flex';

    // Attach event listeners
    attachSettingsModalListeners();
}

/**
 * Closes the settings modal
 */
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Creates the settings modal HTML
 */
function createSettingsModal() {
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'modal-overlay';

    modal.innerHTML = `
        <div class="modal-content settings-modal-content">
            <div class="modal-header">
                <h2>Settings</h2>
                <button class="modal-close" id="settings-modal-close" aria-label="Close settings">&times;</button>
            </div>

            <div class="modal-body">
                <form id="settings-form" class="settings-form">
                    <div class="settings-form-group">
                        <label for="settings-manager-id">Manager ID</label>
                        <input
                            type="text"
                            id="settings-manager-id"
                            class="settings-input"
                            placeholder="123456"
                            required
                        />
                        <span class="input-help">Find in your team URL: .../entry/123456/...</span>
                    </div>

                    <div class="settings-form-group">
                        <label for="settings-league-id">League ID (Optional)</label>
                        <input
                            type="text"
                            id="settings-league-id"
                            class="settings-input"
                            placeholder="789012"
                        />
                        <span class="input-help">Find in league URL: .../leagues/789012/...</span>
                    </div>
                </form>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn-secondary" id="settings-cancel-btn">Cancel</button>
                <button type="submit" form="settings-form" class="btn-primary" id="settings-save-btn">Save</button>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Attaches event listeners to modal elements
 */
function attachSettingsModalListeners() {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-modal-close');
    const cancelBtn = document.getElementById('settings-cancel-btn');
    const form = document.getElementById('settings-form');

    // Close button
    if (closeBtn) {
        closeBtn.onclick = closeSettingsModal;
    }

    // Cancel button
    if (cancelBtn) {
        cancelBtn.onclick = closeSettingsModal;
    }

    // Close on overlay click
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeSettingsModal();
            }
        };
    }

    // Form submission
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await handleSettingsSave();
        };
    }
}

/**
 * Handles saving settings
 */
async function handleSettingsSave() {
    const managerInput = document.getElementById('settings-manager-id');
    const leagueInput = document.getElementById('settings-league-id');

    const managerId = managerInput.value.trim();
    const leagueId = leagueInput.value.trim();

    // Validate manager ID
    if (!managerId) {
        alert('Please enter a Manager ID');
        return;
    }

    // Save to localStorage
    localStorage.setItem('fpl_manager_id', managerId);
    localStorage.setItem('fpl_league_id', leagueId);

    // Close modal
    closeSettingsModal();

    // Trigger myStats refresh if component exists
    const myStatsCard = document.getElementById('my-stats-card');
    if (myStatsCard) {
        // Re-initialize myStats component
        await initializeMyStats('my-stats-card');
    }

    // Show success message (optional)
    console.log('Settings saved successfully');
}

/**
 * Initialize settings modal on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    // Create modal container (hidden by default)
    const modal = createSettingsModal();
    modal.style.display = 'none';
    document.body.appendChild(modal);
});
