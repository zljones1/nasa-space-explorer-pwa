# NASA Space Explorer (PWA) 🚀

Progressive Web App version of my NASA Astronomy Picture of the Day gallery for the UNIV 4900 **LevelUp: PWA-ify Your NASA App** extra credit.

This is a **separate** copy of the original app so the live non-PWA site stays untouched.

- **This PWA live site:** https://zljones1.github.io/nasa-space-explorer-pwa/
- **Original (unchanged) site:** https://zljones1.github.io/nasa-space-explorer/
- **Original repo:** https://github.com/zljones1/nasa-space-explorer

## App features
- Pick a start date and the app gets **9 days in a row** of APOD pictures from NASA's live API
- **Random 9** button loads nine surprise pictures from the archive
- Gallery cards with modal details, video support, hover zoom, and a random space fact
- NASA brand colors (`#0B3D91`, `#FC3D21`) and fonts (Inter / Public Sans)
- Uses NASA's current WordPress APOD API (`science.nasa.gov/wp-json/wp/v2/apod-basic`), with a timeout and a course-backup fallback only when the live feed is down

## PWA features (LevelUp)
- **Web App Manifest** (`manifest.json`) — `display: "standalone"`, relative `start_url` / `scope` (`./`), theme/background colors, 192 & 512 icons (any + maskable)
- **Service worker** (`sw.js`) — caches the app shell cache-first; NASA API + image hosts network-first with cache fallback; versioned caches cleaned on activate
- **Offline indicator** — sticky banner when `navigator.onLine` is false, plus a notice when the SW serves cached API/media
- **Custom install prompt** — captures `beforeinstallprompt`, shows an in-app **Install App** banner; hides after install. On iOS Safari, shows **Share → Add to Home Screen**
- **Notifications** — **Enable Notifications** button (user gesture) requests permission and shows a test notification via the service worker

## Phone demo video checklist (≈30 seconds)
1. Open the live PWA URL on your phone browser.
2. Show the **Install App** banner (Android/Chrome) or the iOS **Add to Home Screen** hint, then install / add to home screen.
3. Launch the app from the home screen so it opens **standalone** (no browser chrome).
4. Load some space images while online, then turn on **Airplane Mode** and reload — the shell still loads and the offline banner appears.
5. Tap **Enable Notifications**, allow permission, and show the test notification.
6. Stop recording. Submit the **repo link + video** on HQ yourself (do not have anyone else submit for you).

## API key
A personal key from https://api.nasa.gov is in `const API_KEY` at the top of `js/script.js`. After NASA's September 2026 APOD site migration, the legacy `api.nasa.gov/planetary/apod` endpoint often returns a "NASA Science" logo instead of the real picture, so this PWA requests each date from the new official API.
