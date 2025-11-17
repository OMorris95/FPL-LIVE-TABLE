// Chart Expander - Full Screen Chart Viewer
// Allows users to expand charts to full-screen view (desktop only)

/**
 * Initializes expand buttons on all chart cards
 * Call this after charts are rendered
 */
function initializeChartExpanders() {
    // Find all chart cards
    const chartCards = document.querySelectorAll('.chart-card');

    chartCards.forEach(card => {
        const header = card.querySelector('.chart-card-header');
        const canvas = card.querySelector('canvas');
        const titleElement = card.querySelector('.chart-card-title');

        if (!canvas || !header || !titleElement) return;

        // Check if expand button already exists
        if (header.querySelector('.chart-expand-btn')) return;

        // Create expand button
        const expandBtn = document.createElement('button');
        expandBtn.className = 'chart-expand-btn';
        expandBtn.innerHTML = '⛶';
        expandBtn.title = 'Expand chart to full screen';
        expandBtn.setAttribute('aria-label', 'Expand chart to full screen');

        // Click handler
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openChartFullscreen(canvas.id, titleElement.textContent);
        });

        // Add button to header
        header.appendChild(expandBtn);
    });
}

/**
 * Opens a chart in full-screen modal
 * @param {string} canvasId - ID of the original canvas element
 * @param {string} chartTitle - Title of the chart
 */
function openChartFullscreen(canvasId, chartTitle) {
    // Get original chart instance
    const originalChart = getChart(canvasId);

    if (!originalChart) {
        console.error(`Chart ${canvasId} not found in registry`);
        return;
    }

    // Create modal
    const modal = createChartModal(chartTitle);
    document.body.appendChild(modal);

    // Small delay to allow DOM to render before creating chart
    setTimeout(() => {
        const modalCanvas = document.getElementById('fullscreen-chart-canvas');

        if (!modalCanvas) {
            console.error('Modal canvas not found');
            return;
        }

        // Get chart configuration
        const chartType = originalChart.config.type;
        const chartData = JSON.parse(JSON.stringify(originalChart.data)); // Deep clone
        const chartOptions = JSON.parse(JSON.stringify(originalChart.options)); // Deep clone

        // Create chart configuration
        let config;

        try {
            switch(chartType) {
                case 'line':
                    config = createLineChartConfig(chartData, chartOptions);
                    break;
                case 'radar':
                    config = createRadarChartConfig(chartData, chartOptions);
                    break;
                case 'bar':
                    config = createBarChartConfig(chartData, chartOptions);
                    break;
                default:
                    config = {
                        type: chartType,
                        data: chartData,
                        options: chartOptions
                    };
            }

            // Create the full-screen chart
            const ctx = modalCanvas.getContext('2d');
            const fullscreenChart = new Chart(ctx, config);

            // Store chart instance on modal for cleanup
            modal._chartInstance = fullscreenChart;

            // Setup close handlers
            setupModalCloseHandlers(modal);

        } catch (error) {
            console.error('Error creating fullscreen chart:', error);
            document.body.removeChild(modal);
        }
    }, 50);
}

/**
 * Creates the modal DOM structure
 * @param {string} chartTitle - Title for the modal
 * @returns {HTMLElement} - Modal element
 */
function createChartModal(chartTitle) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay chart-modal-overlay';

    modal.innerHTML = `
        <div class="modal-chart-fullscreen">
            <div class="modal-header">
                <h3 class="modal-title">${chartTitle}</h3>
                <button class="modal-close chart-modal-close" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body chart-modal-body">
                <div class="chart-container-fullscreen">
                    <canvas id="fullscreen-chart-canvas"></canvas>
                </div>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Sets up event handlers for closing the modal
 * @param {HTMLElement} modal - Modal element
 */
function setupModalCloseHandlers(modal) {
    const closeBtn = modal.querySelector('.chart-modal-close');
    const modalContent = modal.querySelector('.modal-chart-fullscreen');

    // Close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeChartModal(modal);
        });
    }

    // Click outside modal (backdrop)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeChartModal(modal);
        }
    });

    // ESC key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeChartModal(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };

    document.addEventListener('keydown', escHandler);

    // Store handler for cleanup
    modal._escHandler = escHandler;
}

/**
 * Closes and cleans up the chart modal
 * @param {HTMLElement} modal - Modal element to close
 */
function closeChartModal(modal) {
    // Destroy chart instance
    if (modal._chartInstance) {
        modal._chartInstance.destroy();
        modal._chartInstance = null;
    }

    // Remove ESC key listener
    if (modal._escHandler) {
        document.removeEventListener('keydown', modal._escHandler);
    }

    // Remove modal from DOM
    document.body.removeChild(modal);
}
