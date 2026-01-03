self.addEventListener('fetch', (event) => {
    // This can be empty for a basic install, 
    // but it's required to trigger the "Add to Home Screen" prompt.
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}