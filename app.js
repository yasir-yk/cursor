// Simple, dependency-free gallery with slider + filters

const CATEGORIES = [
  { id: 'nature', label: 'Nature' },
  { id: 'city', label: 'City' },
  { id: 'people', label: 'People' },
  { id: 'animals', label: 'Animals' },
  { id: 'travel', label: 'Travel' },
];

const SLIDE_COUNT = 12; // total slides generated

function buildImgUrl(theme, seed, w = 1000, h = 800) {
  // Using Unsplash random source by theme; seed busts cache to keep images distinct
  const q = encodeURIComponent(theme);
  return `https://source.unsplash.com/${w}x${h}/?${q}&sig=${seed}`;
}

// Prefer local images if present; fall back to remote Unsplash
function localImagePath(seed) {
  // Name your files as: ./images/img-1.jpg, img-2.jpg, ...
  // This cycles deterministically based on seed to spread choices.
  const index = (seed % 20) + 1; // supports img-1.jpg .. img-20.jpg
  return `./images/img-${index}.jpg`;
}

function setImageSource(img, theme, seed) {
  let usedFallback = false;
  const fallback = buildImgUrl(theme, seed);
  const local = localImagePath(seed);
  // Try local first
  img.src = local;
  img.addEventListener(
    'error',
    function handleError() {
      if (usedFallback) return;
      usedFallback = true;
      img.removeEventListener('error', handleError);
      img.src = fallback;
    },
    { once: true }
  );
}

function pickRandomThemes(max = 2) {
  const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
  const count = Math.random() > 0.5 ? 2 : 1;
  return shuffled.slice(0, Math.min(max, count)).map(x => x.id);
}

function createSlideElement(slideIndex, tags) {
  const seedBase = slideIndex * 1000 + 100; // ensure different images per slide
  const themeForImage = (idx) => tags[idx % tags.length];

  const slide = document.createElement('article');
  slide.className = 'slide';
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');
  slide.dataset.tags = tags.join(',');

  const header = document.createElement('div');
  header.className = 'slide-header';
  const title = document.createElement('div');
  title.textContent = `Slide ${slideIndex + 1}`;
  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'tags';
  tags.forEach(t => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = CATEGORIES.find(c => c.id === t)?.label || t;
    tagsWrap.appendChild(el);
  });
  header.appendChild(title);
  header.appendChild(tagsWrap);

  const collage = document.createElement('div');
  collage.className = 'collage';

  const imgClasses = ['lt', 'lb', 'center', 'rt', 'rb'];
  imgClasses.forEach((cls, i) => {
    const box = document.createElement('div');
    box.className = `box ${cls}`;
    const img = document.createElement('img');
    img.alt = `${themeForImage(i)} photo`;
    img.loading = 'lazy';
    setImageSource(img, themeForImage(i), seedBase + i);
    box.appendChild(img);
    collage.appendChild(box);
  });

  slide.appendChild(header);
  slide.appendChild(collage);
  return slide;
}

function buildSlides(viewport, { count = SLIDE_COUNT } = {}) {
  viewport.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const tags = pickRandomThemes();
    viewport.appendChild(createSlideElement(i, tags));
  }
}

function buildFilterChips(container) {
  const makeChip = (id, label) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.dataset.tag = id;
    btn.textContent = label;
    btn.setAttribute('aria-pressed', 'false');
    return btn;
  };

  // Add an All chip first
  const allChip = document.createElement('button');
  allChip.className = 'chip';
  allChip.type = 'button';
  allChip.dataset.tag = 'all';
  allChip.textContent = 'All';
  allChip.setAttribute('aria-pressed', 'true');
  container.appendChild(allChip);

  CATEGORIES.forEach(c => container.appendChild(makeChip(c.id, c.label)));
}

function applyFilters(viewport, selectedTags) {
  const slides = [...viewport.querySelectorAll('.slide')];
  const emptyState = document.getElementById('emptyState');
  if (selectedTags.size === 0) {
    slides.forEach(s => (s.hidden = false));
    emptyState.hidden = slides.length !== 0;
    // Update progress/count after filter changes
    updateProgress(viewport);
    return;
  }

  let visibleCount = 0;
  slides.forEach(s => {
    const tags = (s.dataset.tags || '').split(',').filter(Boolean);
    const show = tags.some(t => selectedTags.has(t));
    s.hidden = !show;
    if (show) visibleCount++;
  });
  emptyState.hidden = visibleCount !== 0;
  updateProgress(viewport);
}

function setupFilterInteractions(viewport) {
  const chips = document.getElementById('filterChips');
  const selected = new Set();

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tag = btn.dataset.tag;

    if (tag === 'all') {
      selected.clear();
      // reset all chips
      chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tag === 'all' ? 'true' : 'false'));
      applyFilters(viewport, selected);
      // scroll to first visible slide
      scrollToNextVisible(viewport, 1);
      return;
    }

    // toggle chip
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');

    // unpress All
    const allChip = chips.querySelector('button[data-tag="all"]');
    allChip.setAttribute('aria-pressed', 'false');

    if (pressed) selected.delete(tag); else selected.add(tag);

    // if none selected, flip All back on
    if (selected.size === 0) {
      allChip.setAttribute('aria-pressed', 'true');
    }

    applyFilters(viewport, selected);
    scrollToNextVisible(viewport, 1);
  });
}

function scrollByOne(viewport, direction = 1) {
  const slides = [...viewport.querySelectorAll('.slide')].filter(s => !s.hidden);
  if (slides.length === 0) return;

  // Find the slide currently most centered in the viewport
  const viewportRect = viewport.getBoundingClientRect();
  const centerX = viewport.scrollLeft + viewportRect.width / 2;

  let closestIdx = 0;
  let minDist = Infinity;
  slides.forEach((s, idx) => {
    const rect = s.getBoundingClientRect();
    const slideCenter = viewport.scrollLeft + (rect.left - viewportRect.left) + rect.width / 2;
    const d = Math.abs(slideCenter - centerX);
    if (d < minDist) { minDist = d; closestIdx = idx; }
  });

  const targetIdx = Math.min(slides.length - 1, Math.max(0, closestIdx + direction));
  slides[targetIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function scrollToNextVisible(viewport, direction = 1) {
  scrollByOne(viewport, direction);
}

function setupNav(viewport) {
  const prev = document.getElementById('btnPrev');
  const next = document.getElementById('btnNext');

  prev.addEventListener('click', () => scrollByOne(viewport, -1));
  next.addEventListener('click', () => scrollByOne(viewport, 1));

  // Keyboard support
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByOne(viewport, -1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollByOne(viewport, 1); }
  });

  // Drag to scroll (mouse)
  let isDown = false;
  let startX = 0;
  let startScroll = 0;
  viewport.addEventListener('mousedown', (e) => {
    isDown = true; startX = e.clientX; startScroll = viewport.scrollLeft; viewport.classList.add('dragging');
  });
  window.addEventListener('mouseup', () => { isDown = false; viewport.classList.remove('dragging'); });
  window.addEventListener('mousemove', (e) => {
    if (!isDown) return; const dx = e.clientX - startX; viewport.scrollLeft = startScroll - dx; 
  });

  // Touch drag
  let tStartX = 0; let tStartScroll = 0;
  viewport.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; tStartX = t.clientX; tStartScroll = viewport.scrollLeft;
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; const dx = t.clientX - tStartX; viewport.scrollLeft = tStartScroll - dx; 
  }, { passive: true });
}

// Convert vertical wheel scroll to horizontal movement in the viewport
function setupWheelScroll(viewport) {
  viewport.addEventListener(
    'wheel',
    (e) => {
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);
      // If the gesture is predominantly vertical, translate to horizontal
      if (absDeltaY > absDeltaX) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      } else if (e.deltaX !== 0) {
        // Horizontal wheel gestures (e.g., shift+wheel) should also not bubble to page
        e.preventDefault();
        viewport.scrollLeft += e.deltaX;
      }
    },
    { passive: false }
  );
}

// Helpers to compute visible slides and active index
function getVisibleSlides(viewport) {
  return [...viewport.querySelectorAll('.slide')].filter(s => !s.hidden);
}

function findClosestVisibleIndex(viewport) {
  const slides = getVisibleSlides(viewport);
  if (slides.length === 0) return -1;
  const viewportRect = viewport.getBoundingClientRect();
  const centerX = viewport.scrollLeft + viewportRect.width / 2;
  let closestIdx = 0;
  let minDist = Infinity;
  slides.forEach((s, idx) => {
    const rect = s.getBoundingClientRect();
    const slideCenter = viewport.scrollLeft + (rect.left - viewportRect.left) + rect.width / 2;
    const d = Math.abs(slideCenter - centerX);
    if (d < minDist) { minDist = d; closestIdx = idx; }
  });
  return closestIdx;
}

// Update progress bar width, counter text, and active slide highlight
function updateProgress(viewport) {
  const progressBar = document.getElementById('scrollProgressBar');
  const currentEl = document.getElementById('currentSlide');
  const totalEl = document.getElementById('totalSlides');
  if (!progressBar || !currentEl || !totalEl) return;

  const slides = getVisibleSlides(viewport);
  const totalVisible = slides.length;
  totalEl.textContent = String(totalVisible);

  // Progress along scrollable width
  const maxScrollable = Math.max(1, viewport.scrollWidth - viewport.clientWidth);
  const ratio = Math.max(0, Math.min(1, viewport.scrollLeft / maxScrollable));
  progressBar.style.width = `${ratio * 100}%`;

  // Active index and highlighting
  slides.forEach(s => s.classList.remove('is-active'));
  const activeIdx = findClosestVisibleIndex(viewport);
  const currentIndexHuman = activeIdx === -1 ? 0 : activeIdx + 1;
  currentEl.textContent = String(currentIndexHuman);
  if (activeIdx >= 0) {
    slides[activeIdx].classList.add('is-active');
  }
}

function setupProgress(viewport) {
  let rafId = 0;
  const onScroll = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateProgress(viewport);
    });
  };
  viewport.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // Initialize
  updateProgress(viewport);
}

function main() {
  const viewport = document.getElementById('sliderViewport');
  const chips = document.getElementById('filterChips');
  buildFilterChips(chips);
  buildSlides(viewport);
  setupFilterInteractions(viewport);
  setupNav(viewport);
  setupWheelScroll(viewport);
  setupProgress(viewport);
}

window.addEventListener('DOMContentLoaded', main);
