// ===== SETTINGS =====
// 🔑 API KEY: paste your own free key from https://api.nasa.gov here.
// DEMO_KEY works for testing, but NASA limits it to about 30 requests per hour.
const API_KEY = 'DEMO_KEY';
const API_URL = 'https://api.nasa.gov/planetary/apod';

// Backup data from the course. We only use this if NASA's live feed is down.
const BACKUP_URL = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

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
const gallery = document.getElementById('gallery');
const modal = document.getElementById('modal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const closeModalBtn = document.getElementById('closeModal');

// ===== DID YOU KNOW? =====
// A list of fun facts. One is picked at random each time the page loads.
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

// ===== FETCH IMAGES =====
const notice = document.getElementById('notice');
button.addEventListener('click', getSpaceImages);

// Ask NASA's live API for every picture from the start date to the end date
async function fetchFromNasa(start, end) {
  const url = `${API_URL}?api_key=${API_KEY}&start_date=${start}&end_date=${end}&thumbs=true`;
  const response = await fetch(url);
  if (!response.ok) {
    // 429 means the API key hit its rate limit
    throw new Error(`NASA API error (status ${response.status})`);
  }
  return response.json();
}

// NASA's feed sometimes sends back "placeholder" entries: every item is titled
// "NASA Science" and the picture is just the NASA logo. This checks for that.
function isPlaceholder(items) {
  return items.length === 0 || items.every((item) =>
    item.title === 'NASA Science' || (item.url || '').includes('nasa-logo'));
}

// Load the course backup file and pick entries in the chosen dates.
// If none match, show all of the backup entries so the gallery is never empty.
async function fetchBackup(start, end) {
  const response = await fetch(BACKUP_URL);
  if (!response.ok) throw new Error(`Backup data error (status ${response.status})`);
  const all = await response.json();
  const inRange = all.filter((item) => item.date >= start && item.date <= end);
  return inRange.length > 0 ? inRange : all;
}

async function getSpaceImages() {
  // 1. Show the loading message BEFORE we start fetching
  gallery.innerHTML = '<p class="loading">🔄 Loading space photos…</p>';
  notice.hidden = true;
  button.disabled = true;

  let start = startInput.value;
  let end = endInput.value;
  if (start > end) [start, end] = [end, start]; // fix dates picked backwards

  try {
    let items;
    try {
      // 2. Try NASA's live API first
      items = await fetchFromNasa(start, end);
      if (isPlaceholder(items)) throw new Error('NASA sent placeholder data');
      // Drop any single placeholder entries mixed in with real ones
      items = items.filter((item) =>
        item.title !== 'NASA Science' && !(item.url || '').includes('nasa-logo'));
    } catch (liveError) {
      // 3. Live feed is down or rate-limited, so use the backup data instead
      console.warn('Using backup data:', liveError.message);
      items = await fetchBackup(start, end);
      notice.textContent = '🛰️ NASA\'s live picture feed is down right now, so you\'re seeing backup APOD photos from the course archive.';
      notice.hidden = false;
    }

    // 4. Show newest first, then build the gallery (this replaces the loading message)
    items.sort((a, b) => b.date.localeCompare(a.date));
    showGallery(items);
  } catch (error) {
    gallery.innerHTML = `<p class="error">⚠️ Couldn't load images. ${error.message}. Please try again.</p>`;
  } finally {
    button.disabled = false;
  }
}

// Load the default 9 days as soon as the page opens
getSpaceImages();

// ===== BUILD THE GALLERY =====
// Create one card for each matching entry.
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

    // Videos don't have a normal image, so use the thumbnail (if NASA gives one)
    const isVideo = item.media_type === 'video';
    const imgSrc = isVideo ? item.thumbnail_url : item.url;

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

    // Clicking a card opens the modal with more details
    card.addEventListener('click', () => openModal(item));
    gallery.appendChild(card);
  });
}

// ===== MODAL =====
function openModal(item) {
  if (item.media_type === 'video') {
    // Embed YouTube/Vimeo videos; otherwise give a link to watch it
    if (/youtube\.com|vimeo\.com/.test(item.url)) {
      modalMedia.innerHTML = `<iframe src="${item.url}" title="${escapeHTML(item.title)}" allowfullscreen></iframe>`;
    } else {
      modalMedia.innerHTML = `<a class="video-link" href="${item.url}" target="_blank" rel="noopener">▶ Watch this video</a>`;
    }
  } else {
    // Use the high-resolution image when available
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

// Close with the X button, by clicking the dark background, or with Escape
closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

// Small helper so titles with quotes or < > can't break our HTML
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
