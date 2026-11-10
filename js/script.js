// ===== SETTINGS =====
// Free NASA key from https://api.nasa.gov. The legacy APOD endpoint at
// api.nasa.gov/planetary/apod now returns NASA-logo placeholders after the
// Sept 2026 WordPress migration, so this app uses the new official API:
// https://science.nasa.gov/wp-json/wp/v2/apod-basic
const API_KEY = 'cnLCrFMcjD9gRdz9TMHnrFWj7Dz6gGmLJTfCddfW';
const NEW_API_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const LEGACY_API_URL = 'https://api.nasa.gov/planetary/apod';
const BACKUP_URL = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';
const FETCH_TIMEOUT_MS = 12000;

// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
// - Keep the end date 8 days after the start, so we always ask for 9 days in a row
setupDateInputs(startInput, endInput);

// Other page elements we need
const button = document.getElementById('getImagesBtn');
const randomBtn = document.getElementById('randomBtn');
const gallery = document.getElementById('gallery');
const modal = document.getElementById('modal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const closeModalBtn = document.getElementById('closeModal');
const notice = document.getElementById('notice');

// ===== DID YOU KNOW? =====
const facts = [
  'One day on Venus is longer than one year on Venus.',
  'Neutron stars are so dense that a teaspoon would weigh about a billion tons.',
  'The footprints on the Moon will likely last millions of years because there is no wind.',
  'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.',
  'Jupiter has the shortest day of any planet: about 10 hours.',
  'The Milky Way contains an estimated 100 to 400 billion stars.',
  'NASA\'s Voyager 1 is the most distant human-made object, over 15 billion miles away.'
];
document.getElementById('factText').textContent =
  facts[Math.floor(Math.random() * facts.length)];

// ===== FETCH HELPERS =====
async function fetchJson(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) {
      const error = new Error(`Request failed (status ${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// The new API's date/start_date/count query params are currently ignored on
// the list endpoint, but /apod-basic/YYMMDD returns the real picture for that day.
function dateToApodId(date) {
  return date.replace(/-/g, '').slice(2);
}

function eachDate(start, end) {
  const dates = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function isPlaceholderItem(item) {
  if (!item) return true;
  const haystack = `${item.title || ''} ${item.url || ''} ${item.hdurl || ''}`;
  return item.title === 'NASA Science' || /nasa-logo/i.test(haystack);
}

function isMediaFile(url) {
  if (!url) return false;
  if (/nasa-logo/i.test(url)) return false;
  return (
    /\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff|mp4|webm)(\?|$)/i.test(url) ||
    url.includes('assets.science.nasa.gov') ||
    url.includes('apod.nasa.gov') ||
    url.includes('web.archive.org')
  );
}

function sizedImage(url, width) {
  if (!url || !url.includes('assets.science.nasa.gov')) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('w', String(width));
    parsed.searchParams.delete('h');
    return parsed.toString();
  } catch {
    return url;
  }
}

function stripHtml(text) {
  const div = document.createElement('div');
  div.innerHTML = text || '';
  return (div.textContent || '')
    .replace(/^\s*Explanation:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractVideoUrl(html) {
  if (!html) return '';
  const mp4 = html.match(/https?:\/\/[^"'>\s]+\.mp4(?:\?[^"'>\s]*)?/i);
  if (mp4) return mp4[0].replace(/&amp;/g, '&');
  const yt = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]+/i);
  if (yt) return yt[0].replace(/&amp;/g, '&');
  const vimeo = html.match(/https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?\d+/i);
  if (vimeo) return vimeo[0].replace(/&amp;/g, '&');
  return '';
}

function normalizeItem(item) {
  const imageUrl = isMediaFile(item.hdurl)
    ? item.hdurl
    : (isMediaFile(item.url) ? item.url : (item.hdurl || item.url || ''));
  const videoUrl = extractVideoUrl(item.basic_html) ||
    (/\.(mp4|webm)(\?|$)/i.test(item.hdurl || '') ? item.hdurl : '') ||
    (/\.(mp4|webm)(\?|$)/i.test(item.url || '') ? item.url : '');
  const isVideo = item.media_type === 'video' || Boolean(videoUrl);
  return {
    date: item.date,
    title: item.title,
    explanation: stripHtml(item.explanation),
    media_type: isVideo ? 'video' : (item.media_type || 'image'),
    url: videoUrl || imageUrl,
    hdurl: imageUrl,
    thumbnail_url: item.thumbnail_url || (imageUrl ? sizedImage(imageUrl, 800) : ''),
    permalink: item.permalink || (isMediaFile(item.url) ? '' : item.url) || ''
  };
}

async function fetchOneDate(date) {
  const url = `${NEW_API_URL}/${dateToApodId(date)}?api_key=${API_KEY}`;
  try {
    const item = await fetchJson(url);
    if (isPlaceholderItem(item)) return null;
    return item;
  } catch (err) {
    if (err.status === 404) return null; // that day's picture isn't posted yet
    throw err;
  }
}

async function fetchRangeFromNewApi(start, end) {
  const dates = eachDate(start, end);
  const settled = await Promise.allSettled(dates.map((date) => fetchOneDate(date)));
  const items = [];
  let hardFailures = 0;
  let lastError = null;
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      if (result.value && !isPlaceholderItem(result.value)) {
        items.push(normalizeItem(result.value));
      }
    } else {
      hardFailures += 1;
      lastError = result.reason;
    }
  }
  if (items.length === 0 && hardFailures > 0) {
    throw lastError || new Error('NASA API failed');
  }
  return items;
}

function randomArchiveDates(count) {
  const start = new Date('1995-06-16T00:00:00Z').getTime();
  const end = Date.now() - 86400000; // yesterday, so we skip an unpublished today
  const dates = new Set();
  let guard = 0;
  while (dates.size < count && guard++ < count * 30) {
    const t = start + Math.floor(Math.random() * (end - start));
    dates.add(new Date(t).toISOString().slice(0, 10));
  }
  return [...dates];
}

async function fetchRandomFromNewApi(wanted = 9) {
  const have = [];
  const tried = new Set();
  let rounds = 0;
  while (have.length < wanted && rounds++ < 4) {
    const batch = randomArchiveDates(wanted - have.length + 4)
      .filter((date) => !tried.has(date));
    batch.forEach((date) => tried.add(date));
    const settled = await Promise.allSettled(batch.map((date) => fetchOneDate(date)));
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const item = result.value;
      if (!item || isPlaceholderItem(item)) continue;
      have.push(normalizeItem(item));
      if (have.length >= wanted) break;
    }
  }
  if (have.length === 0) {
    throw new Error('NASA sent no real pictures');
  }
  return have;
}

// Last-ditch attempt at the legacy API in case it starts working again.
async function fetchFromLegacyApi(start, end) {
  const url = `${LEGACY_API_URL}?api_key=${API_KEY}&start_date=${start}&end_date=${end}`;
  const data = await fetchJson(url);
  const items = Array.isArray(data) ? data : [data];
  return items.filter((item) => !isPlaceholderItem(item)).map(normalizeItem);
}

// Course backup: only show entries that actually fall in the chosen dates.
// If none match, do not pretend the whole 9-item archive is that date range.
async function fetchBackupInRange(start, end) {
  const all = await fetchJson(BACKUP_URL);
  const inRange = all.filter((item) => item.date >= start && item.date <= end);
  return inRange.map(normalizeItem);
}

function showNotice(text) {
  if (!text) {
    notice.hidden = true;
    notice.textContent = '';
    return;
  }
  notice.textContent = text;
  notice.hidden = false;
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  if (randomBtn) randomBtn.disabled = isLoading;
}

async function getSpaceImages(options = {}) {
  const random = Boolean(options.random);
  gallery.innerHTML = '<p class="loading">🔄 Loading space photos…</p>';
  showNotice('');
  setLoading(true);

  let start = startInput.value;
  let end = endInput.value;
  if (start && end && start > end) [start, end] = [end, start];

  try {
    let items = [];
    let source = 'live';

    try {
      items = random
        ? await fetchRandomFromNewApi(9)
        : await fetchRangeFromNewApi(start, end);

      // If the range came back empty (for example, today's picture isn't up
      // yet and the other days failed), try the legacy API, then the backup.
      if (!random && items.length === 0) {
        try {
          const legacy = await fetchFromLegacyApi(start, end);
          if (legacy.length > 0) items = legacy;
        } catch (legacyError) {
          console.warn('Legacy NASA API failed:', legacyError.message);
        }
        if (items.length === 0) {
          const backup = await fetchBackupInRange(start, end);
          if (backup.length > 0) {
            items = backup;
            source = 'backup';
          }
        }
      }
    } catch (liveError) {
      console.warn('Live NASA API failed:', liveError.message);
      if (random) {
        throw liveError;
      }
      try {
        const legacy = await fetchFromLegacyApi(start, end);
        if (legacy.length > 0) {
          items = legacy;
        } else {
          throw liveError;
        }
      } catch (legacyError) {
        const backup = await fetchBackupInRange(start, end);
        if (backup.length > 0) {
          items = backup;
          source = 'backup';
        } else {
          showNotice('🛰️ NASA\'s live picture feed couldn\'t be reached, and the course backup archive has no photos in that date range. Try another range, or tap Random 9.');
          gallery.innerHTML = '<p class="error">No images found for those dates.</p>';
          return;
        }
      }
    }

    if (source === 'backup') {
      showNotice('🛰️ NASA\'s live picture feed is down right now, so you\'re seeing backup APOD photos from the course archive for this date range.');
    } else if (random) {
      showNotice('🎲 Here are 9 random Astronomy Pictures of the Day from NASA\'s archive.');
    }

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    showGallery(items);
  } catch (error) {
    gallery.innerHTML = `<p class="error">⚠️ Couldn't load images. ${error.message}. Please try again.</p>`;
  } finally {
    setLoading(false);
  }
}

button.addEventListener('click', () => getSpaceImages({ random: false }));
if (randomBtn) {
  randomBtn.addEventListener('click', () => getSpaceImages({ random: true }));
}

// Load the default 9 days as soon as the page opens
getSpaceImages();

// ===== BUILD THE GALLERY =====
function showGallery(items) {
  gallery.innerHTML = '';

  if (items.length === 0) {
    gallery.innerHTML = '<p class="error">No images found for those dates.</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('button');
    card.className = 'gallery-item';
    card.type = 'button';
    card.setAttribute('aria-label', `Open details for ${item.title}`);

    const isVideo = item.media_type === 'video';
    const imgSrc = isVideo
      ? (item.thumbnail_url || sizedImage(item.hdurl, 800))
      : sizedImage(item.url || item.hdurl, 800);

    card.innerHTML = `
      <div class="thumb">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="useArchivedImage(this)" />`
          : '<div class="no-thumb">🎬 Video</div>'}
        ${isVideo ? '<span class="badge">▶ Video</span>' : ''}
      </div>
      <p class="title">${escapeHTML(item.title)}</p>
      <p class="date">${item.date}</p>
    `;

    card.addEventListener('click', () => openModal(item));
    gallery.appendChild(card);
  });
}

// ===== MODAL =====
function openModal(item) {
  const mediaUrl = item.url || item.hdurl;
  if (item.media_type === 'video') {
    if (/\.(mp4|webm)(\?|$)/i.test(mediaUrl || '')) {
      modalMedia.innerHTML = `<video src="${mediaUrl}" controls playsinline poster="${item.thumbnail_url || item.hdurl || ''}"></video>`;
    } else if (/youtube\.com|youtu\.be|vimeo\.com/.test(mediaUrl || '')) {
      modalMedia.innerHTML = `<iframe src="${mediaUrl}" title="${escapeHTML(item.title)}" allowfullscreen></iframe>`;
    } else if (item.permalink) {
      modalMedia.innerHTML = `<a class="video-link" href="${item.permalink}" target="_blank" rel="noopener">▶ Watch this video</a>`;
    } else {
      modalMedia.innerHTML = `<a class="video-link" href="${mediaUrl}" target="_blank" rel="noopener">▶ Watch this video</a>`;
    }
  } else {
    modalMedia.innerHTML = `<img src="${item.hdurl || item.url}" alt="${escapeHTML(item.title)}" onerror="useArchivedImage(this)" />`;
  }
  modalTitle.textContent = item.title;
  modalDate.textContent = item.date;
  modalExplanation.textContent = item.explanation;
  modal.hidden = false;
  closeModalBtn.focus();
}

function closeModal() {
  modal.hidden = true;
  modalMedia.innerHTML = ''; // stops any video that was playing
}

closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// NASA moved APOD to science.nasa.gov, so the old apod.nasa.gov image links in
// the data file no longer load. If an image fails, try the saved copy from the
// Internet Archive's Wayback Machine instead (only once, to avoid a loop).
function useArchivedImage(img) {
  if (img.dataset.triedArchive) return;
  img.dataset.triedArchive = 'yes';
  img.src = 'https://web.archive.org/web/2025if_/' + img.src;
}
