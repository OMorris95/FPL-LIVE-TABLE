// Main App Initialization

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('FPL Stats Hub initializing...');

    // Initialize router
    router.init();

    console.log('FPL Stats Hub ready!');
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
