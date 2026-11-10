/* Progressive Web App helpers: offline banner, install prompt, notifications */
(function () {
  const offlineBanner = document.getElementById('offlineBanner');
  const installBanner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installBtn');
  const dismissInstallBtn = document.getElementById('dismissInstallBtn');
  const iosHint = document.getElementById('iosHint');
  const notifyBtn = document.getElementById('notifyBtn');

  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function setOffline(offline) {
    if (!offlineBanner) return;
    offlineBanner.hidden = !offline;
    document.body.classList.toggle('is-offline', offline);
  }

  function showCachedNotice() {
    if (!offlineBanner) return;
    offlineBanner.hidden = false;
    offlineBanner.textContent = '📡 Showing cached NASA data — you may be offline.';
    document.body.classList.add('is-offline');
  }

  // Online / offline
  setOffline(!navigator.onLine);
  window.addEventListener('online', () => {
    setOffline(false);
    if (offlineBanner) offlineBanner.textContent = "📡 You're offline — showing cached content when available.";
  });
  window.addEventListener('offline', () => setOffline(true));

  // Service worker messages (cache fallback while offline)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'OFFLINE_CACHE_HIT') {
        showCachedNotice();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  // Custom install prompt (Chrome / Edge / Android)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installBanner && !isStandalone()) {
      installBanner.hidden = false;
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (_) { /* ignore */ }
      deferredPrompt = null;
      if (installBanner) installBanner.hidden = true;
    });
  }

  if (dismissInstallBtn) {
    dismissInstallBtn.addEventListener('click', () => {
      if (installBanner) installBanner.hidden = true;
    });
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBanner) installBanner.hidden = true;
    if (iosHint) iosHint.hidden = true;
  });

  // iOS Safari has no beforeinstallprompt — show Add to Home Screen hint
  if (iosHint && isIos() && !isStandalone()) {
    iosHint.hidden = false;
  }

  // Notification permission + test notification (user gesture required)
  if (notifyBtn) {
    notifyBtn.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        alert('Notifications are not supported in this browser.');
        return;
      }
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        alert('Notification permission was not granted.');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('NASA Space Explorer', {
          body: 'You are all set! Offline caching and notifications work.',
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: 'space-explorer-test'
        });
      } catch (err) {
        // Fallback if SW notification fails
        new Notification('NASA Space Explorer', {
          body: 'You are all set! Offline caching and notifications work.',
          icon: 'icons/icon-192.png'
        });
      }
    });
  }
})();
