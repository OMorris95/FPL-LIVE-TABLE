// Chart Factory
// Utilities for creating and managing Chart.js instances with state management

// ============================================
// CHART REGISTRY
// ============================================

// Track all active charts for cleanup and theme updates
const chartRegistry = new Map();

/**
 * Registers a chart instance with its custom options
 * @param {string} id - Chart identifier
 * @param {object} chartInstance - Chart.js instance
 * @param {function} configFn - Config function used to create the chart
 * @param {object} customOptions - Custom options passed during creation
 */
function registerChart(id, chartInstance, configFn = null, customOptions = {}) {
    chartRegistry.set(id, {
        chart: chartInstance,
        configFn: configFn,
        customOptions: customOptions
    });
}

/**
 * Unregisters and destroys a chart
 * @param {string} id - Chart identifier
 */
function unregisterChart(id) {
    const entry = chartRegistry.get(id);
    if (entry) {
        entry.chart.destroy();
        chartRegistry.delete(id);
    }
}

/**
 * Destroys all registered charts
 */
function destroyAllCharts() {
    chartRegistry.forEach((entry, id) => {
        entry.chart.destroy();
    });
    chartRegistry.clear();
}

/**
 * Gets a chart instance by ID
 * @param {string} id - Chart identifier
 * @returns {object|null} - Chart instance or null
 */
function getChart(id) {
    const entry = chartRegistry.get(id);
    return entry ? entry.chart : null;
}

// ============================================
// CHART CREATION
// ============================================

/**
 * Creates a responsive chart with auto-cleanup
 * @param {string} canvasId - ID of canvas element
 * @param {function} configFn - Function that returns chart configuration (from chartConfig.js)
 * @param {object} data - Initial chart data
 * @param {object} options - Custom options
 * @returns {object} - Chart instance with helper methods
 */
function createChart(canvasId, configFn, data, options = {}) {
    // Get canvas element
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element #${canvasId} not found`);
        return null;
    }

    // Destroy existing chart if present
    unregisterChart(canvasId);

    // Get context
    const ctx = canvas.getContext('2d');

    // Create chart configuration
    const config = configFn(data, options);

    // Create Chart.js instance
    const chart = new Chart(ctx, config);

    // Stop Chart.js's internal ResizeObserver to prevent zoom-triggered resizes
    // Block all resize attempts to keep charts stable during zoom
    chart.resize = function() {
        // Do nothing - completely block resize
        return;
    };

    // Register chart with config function and custom options
    registerChart(canvasId, chart, configFn, options);

    // Return chart with helper methods
    return {
        chart,

        /**
         * Updates chart data
         * @param {object} newData - New chart data
         */
        updateData(newData) {
            chart.data = newData;
            chart.update('none'); // Update without animation
        },

        /**
         * Updates chart options
         * @param {object} newOptions - New options
         */
        updateOptions(newOptions) {
            chart.options = getDefaultChartOptions(newOptions);
            chart.update('none');
        },

        /**
         * Destroys the chart
         */
        destroy() {
            unregisterChart(canvasId);
        },

        /**
         * Refreshes chart (useful after theme change)
         */
        refresh() {
            const currentData = chart.data;
            const currentOptions = chart.options;
            unregisterChart(canvasId);
            return createChart(canvasId, configFn, currentData, currentOptions);
        }
    };
}

/**
 * Creates a chart that auto-updates when appState changes
 * @param {string} canvasId - ID of canvas element
 * @param {function} configFn - Function that returns chart configuration
 * @param {function} dataFn - Function that generates data from state: dataFn(state) => data
 * @param {object} options - Custom options
 * @returns {object} - Chart instance with unsubscribe method
 */
function createStatefulChart(canvasId, configFn, dataFn, options = {}) {
    // Create initial chart
    const initialData = dataFn(appState);
    const chartInstance = createChart(canvasId, configFn, initialData, options);

    if (!chartInstance) {
        return null;
    }

    // Subscribe to state changes
    const unsubscribe = appState.subscribe((state) => {
        const newData = dataFn(state);
        chartInstance.updateData(newData);
    });

    // Return chart with enhanced destroy method
    return {
        ...chartInstance,
        destroy() {
            unsubscribe();
            unregisterChart(canvasId);
        }
    };
}

// ============================================
// THEME MANAGEMENT
// ============================================

/**
 * Updates all charts when theme changes
 * Call this when switching between light/dark theme
 */
function updateChartsForTheme() {
    chartRegistry.forEach((entry, id) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;

        // Get current data, config function, and custom options
        const data = entry.chart.data;
        const configFn = entry.configFn;
        const customOptions = entry.customOptions;

        // Destroy the old chart
        entry.chart.destroy();

        const ctx = canvas.getContext('2d');

        // Recreate chart with same config function and custom options
        // This preserves settings like reverse: true on y-axis
        const config = configFn ? configFn(data, customOptions) : null;

        if (!config) {
            console.warn(`No config function stored for chart: ${id}`);
            return;
        }

        const newChart = new Chart(ctx, config);

        // Re-register with same config function and options
        chartRegistry.set(id, {
            chart: newChart,
            configFn: configFn,
            customOptions: customOptions
        });
    });
}

// ============================================
// SAMPLE CHART CREATORS
// ============================================

/**
 * Creates a sample line chart with placeholder data
 * @param {string} canvasId - Canvas element ID
 * @param {string} title - Chart title
 * @returns {object} - Chart instance
 */
function createSampleLineChart(canvasId, title = 'Sample Line Chart') {
    const data = {
        labels: generateGameweekLabels(10),
        datasets: [
            {
                label: 'Dataset 1',
                data: generateSampleData(10, 20, 80),
            },
            {
                label: 'Dataset 2',
                data: generateSampleData(10, 15, 75),
            }
        ]
    };

    return createChart(canvasId, createLineChartConfig, data, {
        plugins: {
            title: {
                display: true,
                text: title,
                color: getThemeColors().textColor,
                font: {
                    size: 16,
                    weight: '600'
                },
                padding: {
                    bottom: 20
                }
            }
        }
    });
}

/**
 * Creates a sample radar chart with placeholder data
 * @param {string} canvasId - Canvas element ID
 * @param {string} title - Chart title
 * @returns {object} - Chart instance
 */
function createSampleRadarChart(canvasId, title = 'Sample Radar Chart') {
    const data = {
        labels: ['Attack', 'Defense', 'Form', 'Value', 'Fixtures', 'Ownership'],
        datasets: [
            {
                label: 'Dataset 1',
                data: [75, 82, 68, 90, 55, 70],
            }
        ]
    };

    return createChart(canvasId, createRadarChartConfig, data, {
        plugins: {
            title: {
                display: true,
                text: title,
                color: getThemeColors().textColor,
                font: {
                    size: 16,
                    weight: '600'
                },
                padding: {
                    bottom: 20
                }
            }
        }
    });
}

/**
 * Creates a sample bar chart with placeholder data
 * @param {string} canvasId - Canvas element ID
 * @param {string} title - Chart title
 * @returns {object} - Chart instance
 */
function createSampleBarChart(canvasId, title = 'Sample Bar Chart') {
    const data = {
        labels: ['GK', 'DEF', 'MID', 'FWD'],
        datasets: [
            {
                label: 'Points',
                data: [25, 180, 215, 145],
            }
        ]
    };

    return createChart(canvasId, createBarChartConfig, data, {
        plugins: {
            title: {
                display: true,
                text: title,
                color: getThemeColors().textColor,
                font: {
                    size: 16,
                    weight: '600'
                },
                padding: {
                    bottom: 20
                }
            }
        }
    });
}

// ============================================
// CLEANUP ON PAGE NAVIGATION
// ============================================

// Auto-cleanup when navigating to new page
if (typeof router !== 'undefined') {
    // Hook into router to destroy charts on navigation
    const originalNavigate = router.navigate;
    router.navigate = function(...args) {
        destroyAllCharts();
        return originalNavigate.apply(this, args);
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        registerChart,
        unregisterChart,
        destroyAllCharts,
        getChart,
        createChart,
        createStatefulChart,
        updateChartsForTheme,
        createSampleLineChart,
        createSampleRadarChart,
        createSampleBarChart
    };
}
