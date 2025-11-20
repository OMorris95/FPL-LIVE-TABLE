// Chart Configuration
// Centralized chart styling and color schemes for both light and dark themes

// ============================================
// COLOR PALETTES
// ============================================

const COLORS = {
    // Light Theme Colors (Modern Neutral - Grays/Blues)
    light: {
        primary: '#3B82F6',      // Blue
        secondary: '#8B5CF6',    // Purple
        accent: '#06B6D4',       // Cyan
        success: '#10B981',      // Green
        warning: '#F59E0B',      // Amber
        danger: '#EF4444',       // Red

        // Chart line colors
        lines: [
            '#3B82F6',  // Blue
            '#8B5CF6',  // Purple
            '#06B6D4',  // Cyan
            '#10B981',  // Green
            '#F59E0B',  // Amber
            '#EC4899',  // Pink
        ],

        // Background/Grid
        gridColor: '#E5E7EB',
        textColor: '#374151',
        backgroundColor: '#FFFFFF',
        cardBackground: '#FFFFFF',
    },

    // Dark Theme Colors
    dark: {
        primary: '#60A5FA',      // Light Blue
        secondary: '#A78BFA',    // Light Purple
        accent: '#22D3EE',       // Light Cyan
        success: '#34D399',      // Light Green
        warning: '#FBBF24',      // Light Amber
        danger: '#F87171',       // Light Red

        // Chart line colors
        lines: [
            '#60A5FA',  // Light Blue
            '#A78BFA',  // Light Purple
            '#22D3EE',  // Light Cyan
            '#34D399',  // Light Green
            '#FBBF24',  // Light Amber
            '#F472B6',  // Light Pink
        ],

        // Background/Grid
        gridColor: '#374151',
        textColor: '#E5E7EB',
        backgroundColor: '#1F2937',
        cardBackground: '#111827',
    }
};

// ============================================
// GET CURRENT THEME COLORS
// ============================================

/**
 * Returns colors for the current theme (light/dark)
 * @returns {object} - Color palette for current theme
 */
function getThemeColors() {
    const isDark = document.documentElement.classList.contains('dark-theme');
    return isDark ? COLORS.dark : COLORS.light;
}

// ============================================
// DEFAULT CHART OPTIONS
// ============================================

/**
 * Returns default Chart.js options that work for both themes
 * @param {object} customOptions - Custom options to merge
 * @returns {object} - Complete Chart.js options
 */
function getDefaultChartOptions(customOptions = {}) {
    const colors = getThemeColors();

    const defaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: colors.textColor,
                    font: {
                        family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        size: 12,
                        weight: '500'
                    },
                    padding: 15,
                    usePointStyle: true,
                }
            },
            tooltip: {
                backgroundColor: colors.cardBackground,
                titleColor: colors.textColor,
                bodyColor: colors.textColor,
                borderColor: colors.gridColor,
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                titleFont: {
                    size: 13,
                    weight: '600'
                },
                bodyFont: {
                    size: 12
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: colors.gridColor,
                    drawBorder: false,
                },
                ticks: {
                    color: colors.textColor,
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                grid: {
                    color: colors.gridColor,
                    drawBorder: false,
                },
                ticks: {
                    color: colors.textColor,
                    font: {
                        size: 11
                    }
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        }
    };

    // Deep merge custom options
    return mergeDeep(defaults, customOptions);
}

/**
 * Deep merge two objects
 */
function mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = mergeDeep(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

// ============================================
// SAMPLE DATA GENERATORS
// ============================================

/**
 * Generates sample data for line charts
 * @param {number} points - Number of data points
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {array} - Array of random values
 */
function generateSampleData(points = 10, min = -50, max = 80) {
    return Array.from({ length: points }, () =>
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

/**
 * Generates gameweek labels
 * @param {number} count - Number of gameweeks
 * @returns {array} - Array of GW labels
 */
function generateGameweekLabels(count = 10) {
    return Array.from({ length: count }, (_, i) => `GW${i + 1}`);
}

/**
 * Generates month labels
 * @param {number} count - Number of months
 * @returns {array} - Array of month names
 */
function generateMonthLabels(count = 10) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months.slice(0, count);
}

// ============================================
// PRESET CHART CONFIGS
// ============================================

/**
 * Creates a line chart configuration
 * @param {object} data - Chart data
 * @param {object} options - Custom options
 * @returns {object} - Chart.js configuration
 */
function createLineChartConfig(data, options = {}) {
    const colors = getThemeColors();

    // Add colors to datasets if not provided
    if (data.datasets) {
        data.datasets.forEach((dataset, index) => {
            if (!dataset.borderColor) {
                dataset.borderColor = colors.lines[index % colors.lines.length];
            }
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = colors.lines[index % colors.lines.length] + '20'; // 20 = 12% opacity
            }

            // Default line styling
            dataset.tension = dataset.tension ?? 0;
            dataset.borderWidth = dataset.borderWidth ?? 2;
            dataset.pointRadius = dataset.pointRadius ?? 3;
            dataset.pointHoverRadius = dataset.pointHoverRadius ?? 6;
            dataset.fill = dataset.fill ?? false;
        });
    }

    return {
        type: 'line',
        data: data,
        options: getDefaultChartOptions(options)
    };
}

/**
 * Creates a bar chart configuration
 * @param {object} data - Chart data
 * @param {object} options - Custom options
 * @returns {object} - Chart.js configuration
 */
function createBarChartConfig(data, options = {}) {
    const colors = getThemeColors();

    // Add colors to datasets if not provided
    if (data.datasets) {
        data.datasets.forEach((dataset, index) => {
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = colors.lines[index % colors.lines.length];
            }
        });
    }

    return {
        type: 'bar',
        data: data,
        options: getDefaultChartOptions(options)
    };
}

/**
 * Creates a radar chart configuration
 * @param {object} data - Chart data
 * @param {object} options - Custom options
 * @returns {object} - Chart.js configuration
 */
function createRadarChartConfig(data, options = {}) {
    const colors = getThemeColors();

    // Add colors to datasets if not provided
    if (data.datasets) {
        data.datasets.forEach((dataset, index) => {
            if (!dataset.borderColor) {
                dataset.borderColor = colors.lines[index % colors.lines.length];
            }
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = colors.lines[index % colors.lines.length] + '30'; // 30 = 18% opacity
            }

            dataset.borderWidth = dataset.borderWidth ?? 2;
            dataset.pointRadius = dataset.pointRadius ?? 3;
            dataset.pointHoverRadius = dataset.pointHoverRadius ?? 6;
        });
    }

    // Radar-specific options
    const radarOptions = {
        scales: {
            x: {
                display: false  // Radar charts don't use x-axis
            },
            y: {
                display: false  // Radar charts don't use y-axis
            },
            r: {
                beginAtZero: true,
                max: 100,
                grid: {
                    display: true,
                    color: colors.gridColor,
                },
                ticks: {
                    display: true,  // Show the number labels on radial lines
                    stepSize: 20,
                    backdropColor: 'transparent',
                    color: colors.textColor,
                },
                pointLabels: {
                    display: true,  // Keep stat labels around perimeter
                    color: colors.textColor,
                    font: {
                        size: 12,
                        weight: '500'
                    }
                },
                angleLines: {
                    display: true,  // Keep lines from center to edge
                    color: colors.gridColor
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const playerName = context.dataset.label;
                        const normalizedValue = context.parsed.r.toFixed(1);
                        const rawValue = context.dataset.rawValues[context.dataIndex];

                        return `${playerName}: ${normalizedValue}/100 (${rawValue})`;
                    }
                }
            }
        }
    };

    return {
        type: 'radar',
        data: data,
        options: getDefaultChartOptions(mergeDeep(radarOptions, options))
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COLORS,
        getThemeColors,
        getDefaultChartOptions,
        generateSampleData,
        generateGameweekLabels,
        generateMonthLabels,
        createLineChartConfig,
        createBarChartConfig,
        createRadarChartConfig
    };
}
