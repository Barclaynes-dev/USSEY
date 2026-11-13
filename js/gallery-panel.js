/**
 * ============================================================
 * Ussey Portfolio — "View More Work" Slide-over & Lightbox
 * ============================================================
 */

(function initGallery() {
  'use strict';

  // ── State Variables ───────────────────────────────────────
  const allProjects = window.GALLERY_PROJECTS || [];
  let shuffledProjects = [...allProjects];
  let filteredProjects = [...shuffledProjects];
  let activeCategories = new Set();
  let searchQuery = '';
  let renderedCount = 0;
  const BATCH_SIZE = 20;

  let isPanelOpen = false;
  let isViewerOpen = false;
  let isFilterDialogOpen = false;
  let currentViewerIndex = 0;
  let savedScrollY = 0;
  let panelTriggerBtn = null;
  let viewerTriggerCard = null;
  let lastShuffledIds = [];

  let debounceTimer = null;
  let sentinelObserver = null;

  // ── DOM Element Cache ─────────────────────────────────────
  let panel, panelCloseBtn, panelScroll, masonryGrid, sentinelEl, spinnerEl, emptyEl;
  let headerEl, searchInput, searchClearBtn, countBadgeEl, chipsRowEl, chipsWrapEl;
  let filterToggleBtn, filterDialog, filterBackdrop, filterCloseBtn, filterListEl, filterClearBtn;
  let viewer, viewerCloseBtn, viewerPrevBtn, viewerNextBtn;
  let viewerImg, viewerThumb, viewerShimmer, viewerCounter, viewerTitle, viewerCat, viewerDesc, viewerTags;
  let viewerInfo, viewerImgContainer;
  let viewerLoadRequestId = 0;

  function cacheDom() {
    panel = document.getElementById('gallery-panel');
    headerEl = document.getElementById('gallery-panel-header');
    panelCloseBtn = document.getElementById('gallery-panel-close');
    panelScroll = document.getElementById('gallery-panel-scroll');
    masonryGrid = document.getElementById('gallery-masonry');
    sentinelEl = document.getElementById('gallery-sentinel');
    spinnerEl = document.getElementById('gallery-spinner');
    emptyEl = document.getElementById('gallery-empty');

    searchInput = document.getElementById('gallery-search-input');
    searchClearBtn = document.getElementById('gallery-search-clear');
    countBadgeEl = document.getElementById('gallery-count-badge');
    chipsRowEl = document.getElementById('gallery-chips-row');
    chipsWrapEl = document.getElementById('gallery-chips-wrap');

    filterToggleBtn = document.getElementById('gallery-filter-toggle');
    filterDialog = document.getElementById('gallery-filter-dialog');
    filterBackdrop = document.getElementById('gallery-filter-backdrop');
    filterCloseBtn = document.getElementById('gallery-filter-close');
    filterListEl = document.getElementById('gallery-filter-list');
    filterClearBtn = document.getElementById('gallery-filter-clear');

    viewer = document.getElementById('gallery-viewer');
    viewerCloseBtn = document.getElementById('gallery-viewer-close');
    viewerPrevBtn = document.getElementById('gallery-viewer-prev');
    viewerNextBtn = document.getElementById('gallery-viewer-next');
    viewerImg = document.getElementById('gallery-viewer-img');
    viewerThumb = document.getElementById('gallery-viewer-thumb');
    viewerShimmer = document.getElementById('gallery-viewer-shimmer');
    viewerCounter = document.getElementById('gallery-viewer-counter');
    viewerTitle = document.getElementById('gallery-viewer-title');
    viewerCat = document.getElementById('gallery-viewer-cat');
    viewerDesc = document.getElementById('gallery-viewer-desc');
    viewerTags = document.getElementById('gallery-viewer-tags');
    viewerInfo = document.querySelector('.gallery-viewer__info');
    viewerImgContainer = document.getElementById('gallery-viewer-img-container');
  }

  // ── Scroll Locking Helper ─────────────────────────────────
  function lockBodyScroll() {
    // 1. Save scroll position right before the drawer opens
    savedScrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;

    // 2. Compensate scrollbar width so the desktop layout doesn't shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // 3. Lock scroll on html and body without setting position: fixed (which would reset scroll to 0)
    document.documentElement.classList.add('gallery-locked');
    document.body.classList.add('gallery-locked');
  }

  function unlockBodyScroll() {
    // 1. Temporarily disable smooth scroll behavior on html and body so restore is instantaneous
    const originalHtmlScrollBehavior = document.documentElement.style.scrollBehavior;
    const originalBodyScrollBehavior = document.body.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';

    // 2. Remove lock classes and layout shift compensations
    document.documentElement.classList.remove('gallery-locked');
    document.body.classList.remove('gallery-locked');
    document.body.style.paddingRight = '';
    document.body.style.top = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // 3. Instantly restore scroll position in the exact same frame
    try {
      window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
    } catch (e) {
      window.scrollTo(0, savedScrollY);
    }

    // 4. Restore original scroll behavior after current execution frame
    requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = originalHtmlScrollBehavior;
      document.body.style.scrollBehavior = originalBodyScrollBehavior;
    });
  }

  // ── Fisher-Yates Shuffle & Category Clumping Smoothing ─────
  function fisherYatesShuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function smoothCategoryClumping(list) {
    // Make sure the same category doesn't appear more than twice in a row among the first 8 items
    const maxCheck = Math.min(8, list.length);
    for (let i = 2; i < maxCheck; i++) {
      if (
        list[i].category &&
        list[i].category === list[i - 1].category &&
        list[i].category === list[i - 2].category
      ) {
        // Find a later item (from i + 1 onwards) with a different category to swap with
        let swapIndex = -1;
        for (let j = i + 1; j < list.length; j++) {
          if (list[j].category && list[j].category !== list[i].category) {
            swapIndex = j;
            break;
          }
        }
        if (swapIndex !== -1) {
          const temp = list[i];
          list[i] = list[swapIndex];
          list[swapIndex] = temp;
        }
      }
    }
    return list;
  }

  function isSameOrder(a, bIds) {
    if (!a || !bIds || a.length !== bIds.length || a.length <= 1) return false;
    return a.every((item, idx) => item.id === bIds[idx]);
  }

  function shuffleGalleryProjects() {
    if (allProjects.length <= 1) {
      shuffledProjects = [...allProjects];
      return;
    }

    let shuffled = fisherYatesShuffle(allProjects);
    shuffled = smoothCategoryClumping(shuffled);

    // If with few items the new shuffle matches the previous one, reshuffle once more
    if (lastShuffledIds.length > 0 && isSameOrder(shuffled, lastShuffledIds)) {
      shuffled = fisherYatesShuffle(allProjects);
      shuffled = smoothCategoryClumping(shuffled);
    }

    lastShuffledIds = shuffled.map(p => p.id);
    shuffledProjects = shuffled;
  }

  // ── Data-Driven Categories ────────────────────────────────
  function getUniqueCategories() {
    const cats = new Set();
    allProjects.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }

  function renderCategoryControls() {
    const categories = getUniqueCategories();

    // 1. Horizontal chips row
    chipsRowEl.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = `gallery-chip ${activeCategories.size === 0 ? 'is-active' : ''}`;
    allChip.textContent = 'All Categories';
    allChip.setAttribute('aria-pressed', activeCategories.size === 0 ? 'true' : 'false');
    allChip.addEventListener('click', () => {
      activeCategories.clear();
      updateFilterControls();
      applyFilters();
    });
    chipsRowEl.appendChild(allChip);

    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `gallery-chip ${activeCategories.has(cat) ? 'is-active' : ''}`;
      chip.textContent = cat;
      chip.setAttribute('aria-pressed', activeCategories.has(cat) ? 'true' : 'false');
      chip.addEventListener('click', () => {
        toggleCategory(cat);
      });
      chipsRowEl.appendChild(chip);
    });

    // Removable / Clear all chip
    if (activeCategories.size > 0 || searchQuery.trim() !== '') {
      const clearChip = document.createElement('button');
      clearChip.type = 'button';
      clearChip.className = 'gallery-chip gallery-chip--clear';
      clearChip.innerHTML = 'Clear filters ✕';
      clearChip.setAttribute('aria-label', 'Clear all active filters');
      clearChip.addEventListener('click', resetAllFilters);
      chipsRowEl.appendChild(clearChip);
    }

    // 2. Filter dialog category list
    filterListEl.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `gallery-chip ${activeCategories.has(cat) ? 'is-active' : ''}`;
      btn.textContent = cat;
      btn.setAttribute('aria-pressed', activeCategories.has(cat) ? 'true' : 'false');
      btn.addEventListener('click', () => {
        toggleCategory(cat);
      });
      filterListEl.appendChild(btn);
    });
  }

  function toggleCategory(cat) {
    if (activeCategories.has(cat)) {
      activeCategories.delete(cat);
    } else {
      activeCategories.add(cat);
    }
    updateFilterControls();
    applyFilters();
  }

  function updateFilterControls() {
    // Re-render chips row & dialog chips to reflect active states
    renderCategoryControls();

    // Update filter toggle button label and badge
    const badge = filterToggleBtn ? filterToggleBtn.querySelector('.gallery-filter-badge') : null;
    const label = filterToggleBtn ? filterToggleBtn.querySelector('.gallery-filter-label') : null;

    if (activeCategories.size > 0) {
      filterToggleBtn.classList.add('is-active');
      if (label) {
        label.textContent = `Filter · ${activeCategories.size}`;
      }
      if (badge) {
        badge.textContent = activeCategories.size;
        badge.style.display = 'inline-flex';
      }
    } else {
      filterToggleBtn.classList.remove('is-active');
      if (label) {
        label.textContent = 'Filter';
      }
      if (badge) {
        badge.style.display = 'none';
      }
    }
  }

  function resetAllFilters() {
    activeCategories.clear();
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.remove('is-visible');
    updateFilterControls();
    applyFilters();
  }

  // ── Filtering Logic ───────────────────────────────────────
  function applyFilters() {
    const q = searchQuery.toLowerCase().trim();

    filteredProjects = shuffledProjects.filter(item => {
      // Category match: if no active categories, matches all; else item must match one of the active categories
      const catMatch = activeCategories.size === 0 || activeCategories.has(item.category);

      // Search match: title or tags or description
      let searchMatch = true;
      if (q !== '') {
        const titleMatch = item.title && item.title.toLowerCase().includes(q);
        const tagMatch = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
        const catTextMatch = item.category && item.category.toLowerCase().includes(q);
        searchMatch = titleMatch || tagMatch || catTextMatch;
      }

      return catMatch && searchMatch;
    });

    // Update counts
    updateCountDisplay();

    // Reset render batch
    renderedCount = 0;
    masonryGrid.innerHTML = '';

    // Scroll panel back to top and show chips
    if (panel) panel.scrollTop = 0;
    showStrip();

    if (filteredProjects.length === 0) {
      emptyEl.classList.add('is-visible');
      sentinelEl.style.display = 'none';
    } else {
      emptyEl.classList.remove('is-visible');
      sentinelEl.style.display = 'flex';
      renderNextBatch();
    }
  }

  function updateCountDisplay() {
    const countText = `${filteredProjects.length} ${filteredProjects.length === 1 ? 'project' : 'projects'}`;
    if (countBadgeEl) {
      countBadgeEl.textContent = countText;
    }
  }

  // ── Card Creation & Shimmer Crossfade ─────────────────────
  function createCardElement(project, index) {
    const item = document.createElement('article');
    item.className = 'gallery-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `View ${project.title} - ${project.category}`);
    item.dataset.index = index;
    item.dataset.id = project.id;

    // Media wrapper with natural aspect ratio to eliminate layout shift
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'gallery-item__media-wrap';
    const aspectRatio = (project.width && project.height)
      ? `${project.width} / ${project.height}`
      : '4 / 3';
    mediaWrap.style.aspectRatio = aspectRatio;

    // Skeleton shimmer placeholder
    const skeleton = document.createElement('div');
    skeleton.className = 'gallery-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    mediaWrap.appendChild(skeleton);

    // Image element with lazy loading
    const img = document.createElement('img');
    img.className = 'gallery-item__img';
    img.src = project.thumbSrc;
    img.alt = project.title || 'Portfolio project';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = project.width || 800;
    img.height = project.height || 600;

    // Crossfade on load
    img.onload = () => {
      img.classList.add('is-loaded');
      setTimeout(() => {
        if (skeleton && skeleton.parentNode) {
          skeleton.style.opacity = '0';
          setTimeout(() => skeleton.remove(), 350);
        }
      }, 80);
    };

    // Robust fallback if image fails to load
    img.onerror = () => {
      console.warn(`[Project Archive] Failed to load thumbnail at path: ${project.thumbSrc}`);
      if (skeleton && skeleton.parentNode) skeleton.remove();
      img.remove();
      const fallback = document.createElement('div');
      fallback.className = 'gallery-item__fallback';
      fallback.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="gallery-item__fallback-icon">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span class="gallery-item__fallback-title">${project.title || 'Untitled Project'}</span>
      `;
      mediaWrap.appendChild(fallback);
    };

    // If cached and already complete
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('is-loaded');
      if (skeleton && skeleton.parentNode) skeleton.remove();
    }

    mediaWrap.appendChild(img);

    // Desktop hover overlay
    const overlay = document.createElement('div');
    overlay.className = 'gallery-item__overlay';
    overlay.innerHTML = `
      <span class="gallery-item__cat">${project.category || ''}</span>
      <h3 class="gallery-item__title">${project.title || ''}</h3>
      ${project.tags && project.tags.length ? `
        <div class="gallery-item__tags">
          ${project.tags.slice(0, 3).map(t => `<span class="gallery-item__tag">${t}</span>`).join('')}
        </div>
      ` : ''}
    `;
    mediaWrap.appendChild(overlay);

    item.appendChild(mediaWrap);

    // Mobile permanent caption bar (no hover needed on mobile)
    const mobileBar = document.createElement('div');
    mobileBar.className = 'gallery-item__mobile-bar';
    mobileBar.innerHTML = `
      <span class="gallery-item__cat">${project.category || ''}</span>
      <h3 class="gallery-item__title">${project.title || ''}</h3>
    `;
    item.appendChild(mobileBar);

    // Click & Keyboard interactions
    const openLightbox = () => {
      viewerTriggerCard = item;
      openViewerById(project.id);
    };

    item.addEventListener('click', openLightbox);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox();
      }
    });

    return item;
  }

  // ── Infinite Scroll Batch Rendering ───────────────────────
  function renderNextBatch() {
    if (renderedCount >= filteredProjects.length) {
      if (spinnerEl) spinnerEl.classList.remove('is-visible');
      if (sentinelEl) sentinelEl.style.display = 'none';
      return;
    }

    // Only show spinner if there is another batch to fetch later
    if (spinnerEl && renderedCount + BATCH_SIZE < filteredProjects.length) {
      spinnerEl.classList.add('is-visible');
    }

    const nextBatch = filteredProjects.slice(renderedCount, renderedCount + BATCH_SIZE);
    const fragment = document.createDocumentFragment();

    nextBatch.forEach((proj, idx) => {
      const card = createCardElement(proj, renderedCount + idx);
      fragment.appendChild(card);
    });

    masonryGrid.appendChild(fragment);
    renderedCount += nextBatch.length;

    if (spinnerEl) spinnerEl.classList.remove('is-visible');

    // Clean stop when all items loaded — no sentinel, no extra skeletons
    if (renderedCount >= filteredProjects.length) {
      if (sentinelEl) sentinelEl.style.display = 'none';
      if (sentinelObserver && sentinelEl) {
        sentinelObserver.unobserve(sentinelEl);
      }
    } else {
      if (sentinelEl) sentinelEl.style.display = 'flex';
      if (sentinelObserver && sentinelEl) {
        sentinelObserver.observe(sentinelEl);
      }
    }
  }

  function setupInfiniteScrollObserver() {
    if ('IntersectionObserver' in window) {
      sentinelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && isPanelOpen && renderedCount < filteredProjects.length) {
            renderNextBatch();
          }
        });
      }, {
        root: panel,
        rootMargin: '400px',
        threshold: 0.05
      });

      if (sentinelEl && renderedCount < filteredProjects.length) {
        sentinelObserver.observe(sentinelEl);
      }
    }
  }

  // ── Lightbox Slider (Viewer) ──────────────────────────────
  function openViewerById(id) {
    const idx = filteredProjects.findIndex(p => p.id === id);
    if (idx !== -1) {
      if (masonryGrid) {
        const card = masonryGrid.querySelector(`.gallery-item[data-id="${id}"]`);
        if (card) viewerTriggerCard = card;
      }
      openViewer(idx);
    }
  }

  function openViewer(index) {
    if (index < 0 || index >= filteredProjects.length) return;
    currentViewerIndex = index;
    isViewerOpen = true;

    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');
    updateViewerContent();

    // Trap focus inside viewer
    if (viewerCloseBtn) viewerCloseBtn.focus();
  }

  function closeViewer() {
    if (!isViewerOpen) return;
    const currentProject = filteredProjects[currentViewerIndex];
    isViewerOpen = false;
    viewer.classList.remove('is-open');
    viewer.setAttribute('aria-hidden', 'true');

    // Return focus to corresponding card in gallery by ID without scrolling
    let targetCard = viewerTriggerCard;
    if (currentProject && masonryGrid) {
      const match = masonryGrid.querySelector(`.gallery-item[data-id="${currentProject.id}"]`);
      if (match) targetCard = match;
    }

    if (targetCard && typeof targetCard.focus === 'function') {
      try {
        targetCard.focus({ preventScroll: true });
      } catch (e) {
        targetCard.focus();
      }
    }
  }

  function updateViewerContent() {
    const project = filteredProjects[currentViewerIndex];
    if (!project) return;

    // Counter "1 / 13" with dynamic actual count
    if (viewerCounter) {
      viewerCounter.textContent = `${currentViewerIndex + 1} / ${filteredProjects.length}`;
    }

    // Prev / Next button visibility
    if (viewerPrevBtn) {
      viewerPrevBtn.style.display = filteredProjects.length <= 1 ? 'none' : 'flex';
    }
    if (viewerNextBtn) {
      viewerNextBtn.style.display = filteredProjects.length <= 1 ? 'none' : 'flex';
    }

    // Maintain aspect ratio immediately so layout doesn't jump during thumbnail/full swap
    if (viewerImgContainer && project.width && project.height) {
      viewerImgContainer.style.aspectRatio = `${project.width} / ${project.height}`;
    }

    // Maintain request ID to avoid race conditions when clicking next/prev rapidly
    const thisRequestId = ++viewerLoadRequestId;

    // 1. Immediately show cached thumbnail stretched in place so there's never a blank screen
    if (viewerThumb) {
      viewerThumb.src = project.thumbSrc;
      viewerThumb.classList.remove('is-hidden');
    }
    // 2. Show loading shimmer on top of the thumbnail
    if (viewerShimmer) {
      viewerShimmer.classList.add('is-active');
    }
    viewerImg.classList.remove('is-loaded');

    // Crossfade text smoothly in sync with image
    if (viewerInfo) {
      viewerInfo.classList.remove('is-loaded');
    }

    // 3. Load the Full image asynchronously
    const fullImg = new Image();
    fullImg.decoding = 'async';
    fullImg.src = project.fullSrc;

    const onFullImageReady = () => {
      if (thisRequestId !== viewerLoadRequestId) return;
      viewerImg.src = fullImg.src;
      viewerImg.alt = project.title || 'Portfolio project';
      viewerImg.classList.add('is-loaded');
      if (viewerShimmer) viewerShimmer.classList.remove('is-active');
      if (viewerThumb) viewerThumb.classList.add('is-hidden');
    };

    fullImg.onload = onFullImageReady;
    fullImg.onerror = () => {
      if (thisRequestId !== viewerLoadRequestId) return;
      console.warn(`[Project Archive] Failed to load full image at path: ${project.fullSrc}`);
      // Fallback gracefully to thumbnail
      viewerImg.src = project.thumbSrc;
      viewerImg.alt = project.title || 'Portfolio project';
      viewerImg.classList.add('is-loaded');
      if (viewerShimmer) viewerShimmer.classList.remove('is-active');
    };

    if (fullImg.complete && fullImg.naturalWidth > 0) {
      onFullImageReady();
    }

    // Metadata
    viewerCat.textContent = project.category || '';
    viewerTitle.textContent = project.title || '';
    viewerDesc.textContent = project.description || '';

    // Tags
    viewerTags.innerHTML = '';
    if (project.tags && project.tags.length) {
      project.tags.forEach(t => {
        const pill = document.createElement('span');
        pill.className = 'gallery-viewer__tag-pill';
        pill.textContent = t;
        viewerTags.appendChild(pill);
      });
    }

    // Reset scroll position of text panel and trigger smooth crossfade
    if (viewerInfo) {
      viewerInfo.scrollTop = 0;
      requestAnimationFrame(() => {
        viewerInfo.classList.add('is-loaded');
      });
    }

    // Preload next and previous images only
    preloadAdjacentImages();
  }

  function preloadAdjacentImages() {
    if (filteredProjects.length <= 1) return;
    const nextIdx = (currentViewerIndex + 1) % filteredProjects.length;
    const prevIdx = (currentViewerIndex - 1 + filteredProjects.length) % filteredProjects.length;

    if (filteredProjects[nextIdx] && filteredProjects[nextIdx].fullSrc) {
      const nextImg = new Image();
      nextImg.src = filteredProjects[nextIdx].fullSrc;
    }
    if (filteredProjects[prevIdx] && filteredProjects[prevIdx].fullSrc) {
      const prevImg = new Image();
      prevImg.src = filteredProjects[prevIdx].fullSrc;
    }
  }

  function viewerNext() {
    if (filteredProjects.length <= 1) return;
    currentViewerIndex = (currentViewerIndex + 1) % filteredProjects.length;
    updateViewerContent();
  }

  function viewerPrev() {
    if (filteredProjects.length <= 1) return;
    currentViewerIndex = (currentViewerIndex - 1 + filteredProjects.length) % filteredProjects.length;
    updateViewerContent();
  }

  // ── Touch Swipe Gestures for Lightbox ─────────────────────
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  function setupViewerTouchGestures() {
    viewer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    viewer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      handleViewerSwipe();
    }, { passive: true });
  }

  function handleViewerSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Swipe down to dismiss
    if (diffY > 80 && Math.abs(diffX) < 60) {
      closeViewer();
      return;
    }

    // Swipe left / right to navigate
    if (Math.abs(diffX) > 45 && Math.abs(diffY) < 60) {
      if (diffX > 0) {
        viewerPrev();
      } else {
        viewerNext();
      }
    }
  }

  // ── Filter Dialog & Bottom Sheet ──────────────────────────
  function openFilterDialog() {
    isFilterDialogOpen = true;

    // Update aria-expanded on filter toggle
    if (filterToggleBtn) {
      filterToggleBtn.setAttribute('aria-expanded', 'true');
    }

    // Position under filter toggle button on desktop
    if (window.innerWidth >= 768 && filterToggleBtn && filterDialog) {
      const rect = filterToggleBtn.getBoundingClientRect();
      filterDialog.style.top = (rect.bottom + 8) + 'px';
      filterDialog.style.right = (window.innerWidth - rect.right) + 'px';
      filterDialog.style.left = 'auto';
      filterDialog.style.bottom = 'auto';
    } else if (filterDialog) {
      filterDialog.style.top = '';
      filterDialog.style.right = '';
      filterDialog.style.left = '';
      filterDialog.style.bottom = '';
    }

    if (filterDialog) {
      filterDialog.classList.add('is-open');
      filterDialog.setAttribute('aria-hidden', 'false');
    }
    showStrip();
    if (filterBackdrop) {
      filterBackdrop.classList.add('is-open');
      filterBackdrop.setAttribute('aria-hidden', 'false');
    }
    if (filterCloseBtn) filterCloseBtn.focus();
  }

  function closeFilterDialog() {
    isFilterDialogOpen = false;

    // Update aria-expanded on filter toggle
    if (filterToggleBtn) {
      filterToggleBtn.setAttribute('aria-expanded', 'false');
    }

    if (filterDialog) {
      filterDialog.classList.remove('is-open');
      filterDialog.setAttribute('aria-hidden', 'true');
    }
    if (filterBackdrop) {
      filterBackdrop.classList.remove('is-open');
      filterBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (filterToggleBtn && isPanelOpen && !isViewerOpen) {
      try {
        filterToggleBtn.focus({ preventScroll: true });
      } catch (e) {
        filterToggleBtn.focus();
      }
    }
  }

  // ── Slide-Over Panel Open & Close ─────────────────────────
  function openPanel(triggerBtn) {
    if (isPanelOpen) return;
    isPanelOpen = true;
    panelTriggerBtn = triggerBtn || document.activeElement;

    // Ensure filter bottom sheet is closed on open
    closeFilterDialog();

    lockBodyScroll();

    // Fresh Fisher-Yates shuffle on every open
    shuffleGalleryProjects();

    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');

    // Populate and apply filters with shuffled order
    renderCategoryControls();
    applyFilters();

    // Reset panel scroll to top & ensure chips strip is shown
    if (panel) panel.scrollTop = 0;
    showStrip();
    requestAnimationFrame(() => {
      updateHeaderHeights();
    });

    // Focus panel so keyboard scrolling works immediately
    panel.setAttribute('tabindex', '-1');
    setTimeout(() => {
      try { panel.focus({ preventScroll: true }); } catch(e) {}
    }, 50);

    // Focus close button for accessibility without causing page scroll
    setTimeout(() => {
      if (panelCloseBtn) {
        try {
          panelCloseBtn.focus({ preventScroll: true });
        } catch (e) {
          panelCloseBtn.focus();
        }
      }
    }, 100);
  }

  function closePanel() {
    if (!isPanelOpen) return;

    // If lightbox is open, close lightbox first
    if (isViewerOpen) {
      closeViewer();
      return;
    }

    if (isFilterDialogOpen) {
      closeFilterDialog();
    }

    isPanelOpen = false;

    // Instantly restore scroll position before / in the same frame the drawer starts sliding out
    unlockBodyScroll();

    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');

    // Return focus to triggering button without causing page scroll
    if (panelTriggerBtn && typeof panelTriggerBtn.focus === 'function') {
      try {
        panelTriggerBtn.focus({ preventScroll: true });
      } catch (e) {
        panelTriggerBtn.focus();
      }
    }
  }

  // ── Keyboard Navigation & Focus Trap ──────────────────────
  function setupKeyboardHandling() {
    window.addEventListener('keydown', (e) => {
      // Escape key closes topmost layer
      if (e.key === 'Escape') {
        if (isViewerOpen) {
          e.preventDefault();
          closeViewer();
          return;
        }
        if (isFilterDialogOpen) {
          e.preventDefault();
          closeFilterDialog();
          return;
        }
        if (isPanelOpen) {
          e.preventDefault();
          closePanel();
          return;
        }
      }

      // Viewer arrow keys
      if (isViewerOpen) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          viewerNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          viewerPrev();
        }
      }

      // Focus trap for panel
      if (isPanelOpen && !isViewerOpen && e.key === 'Tab') {
        trapFocus(panel, e);
      } else if (isViewerOpen && e.key === 'Tab') {
        trapFocus(viewer, e);
      }
    });
  }

  function trapFocus(container, event) {
    const focusable = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ── Wire Everything Together ──────────────────────────────
  function init() {
    cacheDom();
    if (!panel) return;

    // Immediately update count badge on DOM ready
    updateCountDisplay();

    // 1. Wire existing "View more work" button
    const viewMoreButtons = document.querySelectorAll('.work__more, [data-gallery-open]');
    viewMoreButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openPanel(btn);
      });
    });

    // 2. Panel close
    if (panelCloseBtn) {
      panelCloseBtn.addEventListener('click', closePanel);
    }

    // 2b. Mobile logo home-link: close drawer, then navigate to #top (no smooth scroll)
    const logoLink = document.getElementById('gallery-panel-logo');
    if (logoLink) {
      logoLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Close the drawer (restores body scroll and scroll position) then jump to top
        if (isPanelOpen) {
          closePanel();
        }
        // Disable smooth scroll, jump to top, then restore whatever behavior was set
        const prevBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        // Restore in next frame so CSS smooth-scroll re-enables after the jump
        requestAnimationFrame(() => {
          document.documentElement.style.scrollBehavior = prevBehavior;
        });
      });
    }

    // 3. Search input with debounce ~250ms
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const val = e.target.value;
        if (searchClearBtn) {
          searchClearBtn.classList.toggle('is-visible', val.length > 0);
        }
        debounceTimer = setTimeout(() => {
          searchQuery = val;
          applyFilters();
        }, 250);
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        searchClearBtn.classList.remove('is-visible');
        applyFilters();
        if (searchInput) searchInput.focus();
      });
    }

    // 4. Filter toggle dialog
    if (filterToggleBtn) {
      filterToggleBtn.addEventListener('click', () => {
        if (isFilterDialogOpen) {
          closeFilterDialog();
        } else {
          openFilterDialog();
        }
      });
    }

    if (filterCloseBtn) filterCloseBtn.addEventListener('click', closeFilterDialog);
    if (filterBackdrop) filterBackdrop.addEventListener('click', closeFilterDialog);
    const filterApplyBtn = document.getElementById('gallery-filter-apply');
    if (filterApplyBtn) filterApplyBtn.addEventListener('click', closeFilterDialog);
    if (filterClearBtn) {
      filterClearBtn.addEventListener('click', () => {
        activeCategories.clear();
        updateFilterControls();
        applyFilters();
      });
    }

    // 5. Empty state reset button
    const emptyResetBtn = document.getElementById('gallery-empty-reset');
    if (emptyResetBtn) {
      emptyResetBtn.addEventListener('click', resetAllFilters);
    }

    // 6. Viewer controls
    if (viewerCloseBtn) viewerCloseBtn.addEventListener('click', closeViewer);
    if (viewerPrevBtn) viewerPrevBtn.addEventListener('click', viewerPrev);
    if (viewerNextBtn) viewerNextBtn.addEventListener('click', viewerNext);

    // 7. Touch and keyboard
    setupViewerTouchGestures();
    setupKeyboardHandling();
    setupInfiniteScrollObserver();
    setupChipsScrollBehavior();
    updateHeaderHeights();

    // 8. Hash deep link support
    checkHashDeepLink();
    window.addEventListener('hashchange', checkHashDeepLink);
  }

  // ── URL Hash Deep Linking ─────────────────────────────────
  function checkHashDeepLink() {
    const rawHash = (window.location.hash || '').replace(/^#/, '').trim();
    if (!rawHash) return;

    let targetId = rawHash;
    if (rawHash.startsWith('project=')) {
      targetId = rawHash.replace('project=', '');
    } else if (rawHash.startsWith('project-') && !allProjects.some(p => p.id === rawHash)) {
      targetId = rawHash.replace('project-', '');
    }

    const found = allProjects.find(p => p.id === targetId || p.id === rawHash);
    if (found) {
      if (!isPanelOpen) {
        openPanel();
      }
      setTimeout(() => {
        openViewerById(found.id);
      }, 60);
    }
  }

  // ── Header & Strip Heights Measurement ────────────────────
  function updateHeaderHeights() {
    if (!panel) return;
    const topbar = panel.querySelector('.gallery-panel__topbar');
    if (topbar) {
      const rect = topbar.getBoundingClientRect();
      const topbarH = rect.height || topbar.offsetHeight;
      if (topbarH > 0) {
        panel.style.setProperty('--topbar-height', `${topbarH}px`);
        document.documentElement.style.setProperty('--topbar-height', `${topbarH}px`);
      }
    }
    if (chipsWrapEl && !isStripHidden) {
      const stripRect = chipsWrapEl.getBoundingClientRect();
      const stripH = stripRect.height || chipsWrapEl.offsetHeight;
      if (stripH > 0) {
        panel.style.setProperty('--strip-height', `${stripH}px`);
        document.documentElement.style.setProperty('--strip-height', `${stripH}px`);
      }
    }
  }

  // ── Chips Strip Visibility (Overlay Transition) ───────────
  let isStripHidden = false;
  let stripTransitionTimer = null;

  function hideStrip() {
    if (isStripHidden) return;
    isStripHidden = true;
    if (chipsWrapEl) chipsWrapEl.classList.add('is-hidden');
    if (headerEl) {
      headerEl.classList.add('is-strip-hidden');
      headerEl.classList.add('is-header-hidden');
    }

    clearTimeout(stripTransitionTimer);
    stripTransitionTimer = setTimeout(() => {
      if (isStripHidden && chipsWrapEl) {
        chipsWrapEl.style.visibility = 'hidden';
        chipsWrapEl.setAttribute('aria-hidden', 'true');
        chipsWrapEl.setAttribute('inert', '');
      }
    }, 280);
  }

  function showStrip() {
    clearTimeout(stripTransitionTimer);
    if (chipsWrapEl) {
      chipsWrapEl.style.visibility = 'visible';
      chipsWrapEl.removeAttribute('inert');
      chipsWrapEl.setAttribute('aria-hidden', 'false');
      chipsWrapEl.classList.remove('is-hidden');
    }
    if (headerEl) {
      headerEl.classList.remove('is-strip-hidden');
      headerEl.classList.remove('is-header-hidden');
    }
    isStripHidden = false;
  }

  // ── Chips hide/show on scroll ─────────────────────────────
  function setupChipsScrollBehavior() {
    if (!panel || !chipsWrapEl) return;

    let lastScrollY = 0;
    let rafId = null;
    const THRESHOLD = 10;

    function shouldKeepChipsVisible() {
      return (
        isFilterDialogOpen ||
        (searchInput && document.activeElement === searchInput) ||
        panel.scrollTop < 1
      );
    }

    panel.addEventListener('scroll', () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const currentY = panel.scrollTop;
        const delta = currentY - lastScrollY;

        if (currentY <= 1) {
          // Always show at top
          showStrip();
        } else if (!shouldKeepChipsVisible() && delta > THRESHOLD) {
          hideStrip();
        } else if (delta < -THRESHOLD) {
          showStrip();
        }

        lastScrollY = currentY;
      });
    }, { passive: true });

    // Always show chips when search is focused
    if (searchInput) {
      searchInput.addEventListener('focus', () => {
        showStrip();
      });
    }

    // Keep heights in sync on window resize
    window.addEventListener('resize', () => {
      updateHeaderHeights();
    }, { passive: true });

    // Keep heights in sync on font load
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        updateHeaderHeights();
      });
    }

    // Observe size changes directly if supported
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        updateHeaderHeights();
      });
      const topbar = panel.querySelector('.gallery-panel__topbar');
      if (topbar) ro.observe(topbar);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

