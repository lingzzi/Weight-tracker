// sw.js
self.addEventListener('install', (event) => {
    self.skipWaiting(); // 强制跳过等待，立即激活
    console.log('Service Worker installed.');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
});

self.addEventListener('fetch', (event) => {
    // 暂时留空，但必须存在以满足 PWA 安装要求
});