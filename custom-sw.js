const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

const TRANSLATIONS = {
  en: {
    title: 'New Content Available!',
    body: (count) => `New history data has been added! (${count} items)`
  },
  ja: {
    title: '新しい更新があります',
    body: (count) => `${count}件の新しいデータが見つかりました。`
  }
};

let lastKnownData = null;
let currentLanguage = 'en';

async function checkForUpdates() {
  try {
    const response = await fetch(new URL('/tweets/months-years.json', self.location.origin).href);
    if (!response.ok) return;

    const data = await response.json();
    console.log('Checked for updates. Items:', data.length);
    
    const currentDataStr = JSON.stringify(data);
    const lastDataStr = lastKnownData ? JSON.stringify(lastKnownData) : null;

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    // Check if app is open and visible
    const isAppVisible = clients.some(client => client.visibilityState === 'visible');

    if (lastDataStr && currentDataStr !== lastDataStr) {
        console.log('Update detected! firing notification');
        
        // Notify all clients to show Toast (they will decide if they are active)
        clients.forEach(client => {
            client.postMessage({
                type: 'SW_UPDATE_AVAILABLE',
                count: data.length
            });
        });

        // Only show system notification if app is NOT visible
        if (!isAppVisible && self.Notification.permission === 'granted') {
            const texts = TRANSLATIONS[currentLanguage] || TRANSLATIONS['en'];
            self.registration.showNotification(texts.title, {
              body: texts.body(data.length),
              icon: '/pwa-192x192.png',
              requireInteraction: true
            });
        }
    } else if (!lastKnownData) {
        console.log('Initial data loaded.');
    } else {
        console.log('No changes detected.');
    }

    lastKnownData = data;
    
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    console.log('SW: Received TEST_NOTIFICATION request');
    if (self.Notification.permission === 'granted') {
      console.log('SW: Permission granted, attempting to show notification...');
      self.registration.showNotification('Test Notification', {
        body: 'This is a test notification from the Service Worker!',
        icon: '/pwa-192x192.png',
        requireInteraction: true // Keep it visible
      })
      .then(() => {
        console.log('SW: Notification promise resolved.');
        event.source.postMessage({ 
            type: 'SW_UPDATE_CHECK', 
            data: { length: 'SUCCESS: Notification shown' } 
        });
      })
      .catch((err) => {
        console.error('SW: Notification failed:', err);
        event.source.postMessage({ 
            type: 'SW_UPDATE_CHECK', 
            data: { length: 'FAILED: ' + err.message } 
        });
      });
    } else {
      console.warn('SW: Notification permission is:', self.Notification.permission);
      event.source.postMessage({ 
          type: 'SW_UPDATE_CHECK', 
          data: { length: 'PERMISSION DENIED: ' + self.Notification.permission } 
      });
    }
  }
  
  if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
    console.log('Manual update check triggered');
    checkForUpdates();
  }
  
  if (event.data && event.data.type === 'SET_LANGUAGE') {
    console.log('SW: Language set to', event.data.lang);
    currentLanguage = event.data.lang;
  }
});

setInterval(checkForUpdates, CHECK_INTERVAL);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
    event.waitUntil(clients.claim());
    checkForUpdates();
});
