/* ============================================================
   USSEY — interactions
============================================================ */
document.getElementById('year').textContent = new Date().getFullYear();

const root = document.documentElement;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = window.matchMedia('(pointer: fine) and (min-width: 900px)').matches;
const isDesktopFan = window.matchMedia('(pointer: fine) and (min-width: 1100px)').matches;

/* ---------------- Theme toggle ---------------- */
(function themeInit(){
  const stored = localStorage.getItem('ussey-theme');
  const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.setAttribute('data-theme', stored || system || 'dark');

  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('ussey-theme', next);
    if (window.gsap) gsap.fromTo(btn, {rotate:-25}, {rotate:0, duration:.5, ease:'back.out(2)'});
    document.dispatchEvent(new CustomEvent('ussey-theme-change'));
  });
})();

/* ---------------- Nav scroll state + mobile menu ---------------- */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 40);
}, { passive:true });

const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');
burger.addEventListener('click', () => mobileMenu.classList.toggle('is-open'));
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('is-open')));

/* ---------------- Animated gradient blobs (hero only) ---------------- */
(function fluidCanvas(){
  const canvas = document.getElementById('fluid-canvas');
  const hero = document.getElementById('hero');
  if (!canvas || !hero || window.getComputedStyle(canvas).display === 'none') return;
  const ctx = canvas.getContext('2d');
  const RENDER_SCALE = 0.45; // draw at a fraction of the real size; the blur filter hides the softness
  let w, h, dpr = Math.min(window.devicePixelRatio || 1, 1);

  function resize(){
    w = hero.offsetWidth; h = hero.offsetHeight;
    canvas.width = w * dpr * RENDER_SCALE; canvas.height = h * dpr * RENDER_SCALE;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr * RENDER_SCALE, 0, 0, dpr * RENDER_SCALE, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const colors = ['#f2a93b', '#e2542d', '#3fa9dc'];
  const blobs = colors.map((c, i) => ({
    color: c, baseX: 0.2 + i * 0.3, baseY: 0.3 + (i % 2) * 0.4,
    r: 0.35 + i * 0.05, speed: 0.00012 + i * 0.00004, offset: i * 120
  }));

  let raf, lastDraw = 0;
  const FRAME_MS = 1000 / 30; // 30fps is plenty for slow-drifting blobs

  function draw(t){
    raf = requestAnimationFrame(draw);
    if (t - lastDraw < FRAME_MS) return;
    lastDraw = t;

    ctx.clearRect(0, 0, w, h);
    blobs.forEach(b => {
      const x = (b.baseX + Math.sin(t * b.speed + b.offset) * 0.12) * w;
      const y = (b.baseY + Math.cos(t * b.speed * 1.3 + b.offset) * 0.12) * h;
      const r = b.r * Math.max(w, h);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, b.color + 'aa');
      grad.addColorStop(1, b.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (!prefersReduced) raf = requestAnimationFrame(draw);
  else draw(0);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!prefersReduced) raf = requestAnimationFrame(draw);
  });
})();

/* ---------------- Mouse-reactive grid background (desktop only) ----------------
   The grid stays invisible by default. Moving the cursor spawns short,
   soft-edged flashes that fade out quickly — not a lingering trail.
   Clicking a primary button spawns a bigger flash; settling the scroll
   position spawns a gentle one. Disabled on touch devices / small screens. */
(function gridCanvas(){
  const canvas = document.getElementById('grid-canvas');
  if (!isDesktop || prefersReduced) { canvas.style.display = 'none'; return; }

  const ctx = canvas.getContext('2d');
  let w, h, dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const gridBuffer = document.createElement('canvas');
  const gridCtx = gridBuffer.getContext('2d');
  const trailBuffer = document.createElement('canvas');
  const trailCtx = trailBuffer.getContext('2d');

  const CELL = 44;

  function getGridColor(){
    return getComputedStyle(root).getPropertyValue('--grid-line').trim() || 'rgba(150,150,150,0.2)';
  }

  function resize(){
    w = window.innerWidth; h = window.innerHeight;
    [canvas, gridBuffer, trailBuffer].forEach(c => {
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid();
  }

  function drawGrid(){
    gridCtx.clearRect(0, 0, w, h);
    gridCtx.strokeStyle = getGridColor();
    gridCtx.lineWidth = 0.75;
    gridCtx.beginPath();
    for (let x = 0; x <= w; x += CELL){ gridCtx.moveTo(x, 0); gridCtx.lineTo(x, h); }
    for (let y = 0; y <= h; y += CELL){ gridCtx.moveTo(0, y); gridCtx.lineTo(w, y); }
    gridCtx.stroke();
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('ussey-theme-change', drawGrid);

  // Spawns one soft, deep-fade radial burst that the decay loop then erodes away.
  function spawnFlash(x, y, radius, peak){
    trailCtx.globalCompositeOperation = 'source-over';
    const grad = trailCtx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0,    `rgba(255,255,255,${peak})`);
    grad.addColorStop(0.35, `rgba(255,255,255,${peak * 0.5})`);
    grad.addColorStop(0.7,  `rgba(255,255,255,${peak * 0.15})`);
    grad.addColorStop(1,    'rgba(255,255,255,0)');
    trailCtx.fillStyle = grad;
    trailCtx.beginPath();
    trailCtx.arc(x, y, radius, 0, Math.PI * 2);
    trailCtx.fill();
  }

  let lastMouse = { x: w / 2, y: h / 2 };
  let lastFlashTime = 0;
  let looping = false;

  function ensureLoop(){
    if (!looping) { looping = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('mousemove', (e) => {
    lastMouse = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    if (now - lastFlashTime > 55) { // throttle so we don't over-saturate
      spawnFlash(e.clientX, e.clientY, 150, 0.55);
      lastFlashTime = now;
      ensureLoop();
    }
  }, { passive:true });

  // Quick, stronger flash on primary CTA clicks.
  document.querySelectorAll('.btn--solid, .nav__cta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      spawnFlash(e.clientX, e.clientY, 260, 0.9);
      ensureLoop();
    });
  });

  // Helper to get caret coordinates inside an input/textarea
  let caretDiv;
  function getCaretXY(input) {
    if (!caretDiv) {
      caretDiv = document.createElement('div');
      caretDiv.style.position = 'absolute';
      caretDiv.style.visibility = 'hidden';
      caretDiv.style.pointerEvents = 'none';
      document.body.appendChild(caretDiv);
    }
    const style = window.getComputedStyle(input);
    const props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent', 'boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderWidth', 'lineHeight'];
    props.forEach(p => caretDiv.style[p] = style[p]);
    
    caretDiv.style.width = style.width;
    caretDiv.style.whiteSpace = input.tagName === 'INPUT' ? 'nowrap' : 'pre-wrap';
    caretDiv.style.wordWrap = input.tagName === 'INPUT' ? 'normal' : 'break-word';
    
    caretDiv.textContent = input.value.substring(0, input.selectionEnd);
    const span = document.createElement('span');
    span.textContent = '.'; 
    caretDiv.appendChild(span);
    
    return {
      x: span.offsetLeft,
      y: span.offsetTop + (parseInt(style.fontSize) || 16) / 2
    };
  }

  // Flash exactly where the character is typed in the contact form
  document.querySelectorAll('.cta__form input, .cta__form textarea').forEach(input => {
    input.addEventListener('input', (e) => {
      const rect = e.target.getBoundingClientRect();
      const caret = getCaretXY(e.target);
      
      const x = rect.left + caret.x - e.target.scrollLeft;
      const y = rect.top + caret.y - e.target.scrollTop;
      
      const now = performance.now();
      if (now - lastFlashTime > 55) {
        spawnFlash(x, y, 150, 0.55);
        lastFlashTime = now;
        ensureLoop();
      }
    });
  });

  // A gentle flash once scrolling settles — never while actively scrolling.
  let scrollIdleTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      spawnFlash(lastMouse.x, lastMouse.y, 220, 0.4);
      ensureLoop();
    }, 220);
  }, { passive:true });

  function tick(){
    // Fast decay — flashes clear out within a few hundred ms, never linger.
    trailCtx.globalCompositeOperation = 'destination-out';
    trailCtx.fillStyle = 'rgba(0,0,0,0.09)';
    trailCtx.fillRect(0, 0, w, h);

    // Compose: mask the grid by whatever's left of the trail
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(trailBuffer, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(gridBuffer, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Stop scheduling frames once everything's faded out — this is the
    // fix for the constant full-viewport redraw that was causing the lag.
    if (performance.now() - lastFlashTime > 1000) {
      looping = false;
      ctx.clearRect(0, 0, w, h);
      return;
    }
    requestAnimationFrame(tick);
  }
})();

/* ---------------- GSAP: hero intro, reveals, parallax ---------------- */
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  // Hero intro: centered headline & CTA fade and slide up into view on load
  gsap.to('#hero [data-reveal], #hero [data-slide="left"]', { x:0, y:0, opacity:1, duration:1, ease:'power3.out', delay:.15 });

  // Hero circle: draw after 1s, hold 4s, then erase
  const circlePath = document.querySelector('.hero-highlight__path');
  if (circlePath) {
    // Set inline so GSAP can read them (overrides CSS values)
    circlePath.style.strokeDasharray = '1';
    circlePath.style.strokeDashoffset = '1';

    gsap.timeline({ delay: 1 })
      // Draw: dashoffset 1 → 0 over 1.2s
      .fromTo(circlePath,
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }
      )
      // Hold for 2 seconds (empty tween)
      .to(circlePath, { duration: 2 })
      // Erase: dashoffset 0 → -1 (draws in reverse), then fade to kill the linecap dot
      .to(circlePath, { strokeDashoffset: -1, duration: 0.8, ease: 'power2.in' })
      .to(circlePath, { opacity: 0, duration: 0.15 });
  }

  // Alternating and about sections: cross-fade-in triggered on scroll into view
  document.querySelectorAll('.alt, .about-hero').forEach(section => {
    const sides = section.querySelectorAll('[data-slide]');
    ScrollTrigger.create({
      trigger: section, start: 'top 75%', once: true,
      onEnter: () => gsap.to(sides, { x:0, opacity:1, duration:1, ease:'power3.out', stagger:0 })
    });
  });

  // Generic section reveals (portfolio cards are handled separately in fan mode)
  document.querySelectorAll('[data-reveal]').forEach(el => {
    if (isDesktop && el.closest('#work-grid')) return;
    gsap.to(el, {
      opacity:1, y:0, duration:.9, ease:'power3.out',
      scrollTrigger: { trigger: el, start:'top 88%' }
    });
  });

  // Parallax on alternating-section images
  document.querySelectorAll('.alt__media-inner').forEach(el => {
    gsap.to(el, {
      yPercent: -10,
      scrollTrigger: { trigger: el.closest('.alt'), start:'top bottom', end:'bottom top', scrub:true }
    });
  });

  // Hero card stack parallax
  if (document.querySelector('.hero__card--back')) {
    gsap.to('.hero__card--back', { y: 40, scrollTrigger: { trigger:'.hero', start:'top top', end:'bottom top', scrub:true } });
    gsap.to('.hero__card--front', { y: -20, scrollTrigger: { trigger:'.hero', start:'top top', end:'bottom top', scrub:true } });
  }

  // Stat counters
  document.querySelectorAll('.stat-tile').forEach(tile => {
    const numEl = tile.querySelector('.stat-tile__num');
    const barEl = tile.querySelector('.stat-tile__bar');
    if (!numEl) return;
    
    const target = +numEl.dataset.count;
    ScrollTrigger.create({
      trigger: tile, start: 'top 90%', once: true,
      onEnter: () => {
        // Slow start that accelerates (power3.in)
        gsap.fromTo(numEl, { innerText:0 }, {
          innerText: target, duration:1.6, ease:'power3.in', snap:{ innerText:1 },
          onUpdate: function(){ numEl.textContent = Math.round(this.targets()[0].innerText); }
        });
        
        // Bar grows from center out
        if (barEl) {
          gsap.set(barEl, { transformOrigin: 'center' });
          gsap.fromTo(barEl, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.25, duration: 1.4, ease: 'power2.inOut', delay: 0.2 });
        }
      }
    });
  });
} else {
  document.querySelectorAll('[data-reveal], [data-slide]').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
}


/* ============================================================
   How We Work — Vertical Timeline Animations
   Uses IntersectionObserver for entrance reveals.
   Scroll-fill on rail via requestAnimationFrame.
   Per-step node lighting and active-step pulse.
   Respects prefers-reduced-motion, no-JS fallback.
============================================================ */
(function initHIWTimeline() {
  const timeline = document.querySelector('.hiw__timeline');
  if (!timeline) return;

  const steps   = Array.from(timeline.querySelectorAll('.hiw__step'));
  const section = document.querySelector('.hiw');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth < 768;

  /* ── No-JS fallback: body gets .hiw-anim-ready only via JS ── */
  document.body.classList.add('hiw-anim-ready');

  /* ── Reduced-motion: simple fade, no transform ─────────────── */
  if (reducedMotion) {
    const style = document.createElement('style');
    style.textContent = `
      body.hiw-anim-ready .hiw__circle,
      body.hiw-anim-ready .hiw__text {
        opacity: 0; transform: none !important;
      }
      .hiw__circle.is-visible,
      .hiw__text.is-visible {
        opacity: 1 !important; transform: none !important;
        transition: opacity 0.5s ease !important;
      }
      .hiw__node.is-active::before {
        animation: none !important;
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Per-step IntersectionObserver (entrance reveals) ──────── */
  const stepObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const step   = entry.target;
      const circle = step.querySelector('.hiw__circle');
      const text   = step.querySelector('.hiw__text');

      if (circle) circle.classList.add('is-visible');
      if (text) {
        setTimeout(() => text.classList.add('is-visible'), 175);
      }

      stepObserver.unobserve(step);
    });
  }, {
    threshold: 0.15
  });

  steps.forEach(step => stepObserver.observe(step));

  /* ── Measure rail height from first node to last node on mobile ── */
  function syncRailDimensions() {
    if (!isMobile() || steps.length < 2) return;
    const firstNode = steps[0].querySelector('.hiw__node');
    const lastNode  = steps[steps.length - 1].querySelector('.hiw__node');
    if (firstNode && lastNode) {
      const span = lastNode.offsetTop - firstNode.offsetTop;
      if (span > 0) {
        timeline.style.setProperty('--hiw-rail-height', `${span}px`);
      }
    }
  }

  syncRailDimensions();
  window.addEventListener('resize', syncRailDimensions, { passive: true });

  /* ── Scroll-driven Progress Line & Active Step Pulse ────────── */
  let ticking = false;

  function updateScrollProgress() {
    ticking = false;
    const viewH = window.innerHeight;

    if (isMobile() && steps.length >= 2) {
      const firstNode = steps[0].querySelector('.hiw__node');
      const lastNode  = steps[steps.length - 1].querySelector('.hiw__node');

      if (firstNode && lastNode) {
        const triggerY = viewH * 0.55; // Focal trigger line
        const firstRect = firstNode.getBoundingClientRect();
        const lastRect  = lastNode.getBoundingClientRect();
        const totalSpan = lastRect.top - firstRect.top;

        let progress = 0;
        if (totalSpan > 0) {
          const scrolled = triggerY - firstRect.top;
          progress = Math.max(0, Math.min(1, scrolled / totalSpan));
        } else {
          progress = firstRect.top <= triggerY ? 1 : 0;
        }

        timeline.style.setProperty('--hiw-scale', progress.toFixed(4));

        // Light up each node as the fill reaches or passes it
        steps.forEach((step) => {
          const node = step.querySelector('.hiw__node');
          if (!node) return;
          const nRect = node.getBoundingClientRect();
          if (nRect.top <= triggerY) {
            node.classList.add('is-lit');
          }
        });

        // Active-step pulse: exactly one node pulses at a time
        if (!reducedMotion) {
          let activeIdx = -1;
          let minDist = Infinity;

          steps.forEach((step, idx) => {
            const node = step.querySelector('.hiw__node');
            if (!node) return;
            const nRect = node.getBoundingClientRect();
            // In view check
            if (nRect.top <= viewH * 0.85 && nRect.bottom >= viewH * 0.15) {
              const dist = Math.abs(nRect.top - triggerY);
              if (dist < minDist) {
                minDist = dist;
                activeIdx = idx;
              }
            }
          });

          steps.forEach((step, idx) => {
            const node = step.querySelector('.hiw__node');
            if (!node) return;
            node.classList.toggle('is-active', idx === activeIdx);
          });
        }
      }
    } else {
      // Desktop progress calculation
      const rect = section ? section.getBoundingClientRect() : timeline.getBoundingClientRect();
      const rawPct = (viewH - rect.top) / (rect.height + viewH);
      const pct = Math.max(0, Math.min(1, rawPct));
      timeline.style.setProperty('--hiw-progress', (pct * 100).toFixed(1) + '%');
      timeline.style.setProperty('--hiw-scale', pct.toFixed(4));
    }
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateScrollProgress);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  updateScrollProgress();
})();


/* ---------------- Homepage Featured Masonry Gallery ---------------- */
// Breakpoint constants
const BREAKPOINT_TABLET = 768;
const BREAKPOINT_DESKTOP = 1024;

// Masonry configuration by screen size
const HOME_GALLERY = {
  mobile:  { columns: 2, limit: 4 },
  tablet:  { columns: 2, limit: 4 },
  desktop: { columns: 3, limit: 5 }
};

// 5 chosen item IDs in fixed order (NO shuffle).
// The first 4 are also the tablet & mobile set.
//   1. proj-01: 'Arches Built for the Littles' (Brand Identity, Arches)  - ratio: 1.25 (800x1000)
//   2. proj-06: 'OLBR Buffalo Chicken Wings' (Food & Dining, OLBR)      - ratio: 1.776 (800x1421)
//   3. proj-08: 'OLBR Pocket Pizza Campaign' (Packaging, OLBR)          - ratio: 1.7775 (800x1422)
//   4. proj-05: 'Arches Happy Independence Day' (Flyer & Print, Arches) - ratio: 1.25 (900x1125)
//   5. proj-11: 'Arches Gather the Squad' (Social Media, Arches)        - ratio: 1.25 (800x1000)
const HOME_FEATURED_IDS = [
  'proj-01',
  'proj-06',
  'proj-08',
  'proj-05',
  'proj-11'
];

// Mapping from real data categories to homepage filter chips (All, Logo, Branding, Print)
const CATEGORY_TO_FILTER_MAP = {
  'Brand Identity': 'brand',
  'Packaging': 'brand',
  'Flyer & Print': 'print'
  // Food & Dining, Social Media: visible under 'All'.
  // Logo: 0 matching cards among the 5 featured, chip is hidden automatically.
};

function escapeCardHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const mqDesktop = window.matchMedia(`(min-width: ${BREAKPOINT_DESKTOP}px)`);
const mqTablet = window.matchMedia(`(min-width: ${BREAKPOINT_TABLET}px) and (max-width: ${BREAKPOINT_DESKTOP - 1}px)`);
const mqMobile = window.matchMedia(`(max-width: ${BREAKPOINT_TABLET - 1}px)`);

function getGalleryLayout() {
  if (mqDesktop.matches) return { name: 'desktop', ...HOME_GALLERY.desktop };
  if (mqTablet.matches) return { name: 'tablet', ...HOME_GALLERY.tablet };
  return { name: 'mobile', ...HOME_GALLERY.mobile };
}

let currentWorkFilter = 'all';
let currentLayoutName = getGalleryLayout().name;

function createCardElement(project, isEager) {
  const card = document.createElement('article');
  card.className = 'w-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.dataset.id = project.id;
  const mappedCat = CATEGORY_TO_FILTER_MAP[project.category] || '';
  if (mappedCat) card.dataset.cat = mappedCat;

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'w-card__media-wrap';
  // Reserve exact aspect-ratio space to prevent layout shifts
  mediaWrap.style.aspectRatio = `${project.width} / ${project.height}`;

  const skeleton = document.createElement('div');
  skeleton.className = 'gallery-skeleton w-card__skeleton';
  skeleton.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.className = 'w-card__img';
  img.alt = project.title || 'Project poster';
  img.width = project.width;
  img.height = project.height;

  // Use thumbnails only
  const targetSrc = project.thumbSrc;

  if (isEager) {
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
  } else {
    img.loading = 'lazy';
    img.setAttribute('decoding', 'async');
  }

  const onLoaded = () => {
    img.classList.add('is-loaded');
    skeleton.classList.add('is-hidden');
  };

  const onError = () => {
    console.warn(`[Work Gallery] Failed to load image at: ${targetSrc}`);
    skeleton.classList.add('is-hidden');
    const fallback = document.createElement('div');
    fallback.className = 'w-card__fallback';
    fallback.setAttribute('aria-label', 'Image unavailable');
    fallback.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
      <span>${escapeCardHtml(project.title)}</span>
    `;
    mediaWrap.appendChild(fallback);
  };

  img.addEventListener('load', onLoaded);
  img.addEventListener('error', onError);

  img.src = targetSrc;
  if (img.complete && img.naturalWidth > 0) {
    onLoaded();
  }

  mediaWrap.appendChild(skeleton);
  mediaWrap.appendChild(img);

  const caption = document.createElement('div');
  caption.className = 'w-card__caption';
  caption.innerHTML = `
    <span class="w-card__cat">${escapeCardHtml(project.category)}</span>
    <h3 class="w-card__title">${escapeCardHtml(project.title)}</h3>
  `;

  card.appendChild(mediaWrap);
  card.appendChild(caption);

  return card;
}

function buildMasonryDOM(projectsToDisplay, layout) {
  const grid = document.getElementById('work-grid');
  if (!grid) return;

  grid.style.setProperty('--masonry-cols', layout.columns);
  grid.innerHTML = '';

  const numCols = layout.columns;
  const colElements = [];
  const colHeights = new Array(numCols).fill(0);

  for (let c = 0; c < numCols; c++) {
    const colDiv = document.createElement('div');
    colDiv.className = 'work__masonry-col';
    colDiv.dataset.colIndex = c;
    colElements.push(colDiv);
    grid.appendChild(colDiv);
  }

  // Estimated caption height relative to column width (roughly 60px / 320px = 0.19)
  const CAPTION_RATIO = layout.columns === 3 ? 0.19 : 0.24;
  const GAP_RATIO = layout.columns === 3 ? 0.07 : 0.08;

  projectsToDisplay.forEach((project, idx) => {
    // Top row cards (first card in each column) use eager loading
    const isEager = idx < numCols;
    const cardEl = createCardElement(project, isEager);

    // Find the currently shortest column
    let minCol = 0;
    let minH = colHeights[0];
    for (let c = 1; c < numCols; c++) {
      if (colHeights[c] < minH) {
        minH = colHeights[c];
        minCol = c;
      }
    }

    colElements[minCol].appendChild(cardEl);

    // Compute aspect ratio (height / width) + estimated caption height
    const ratio = (project.height && project.width) ? (project.height / project.width) : 1.25;
    colHeights[minCol] += ratio + CAPTION_RATIO + (colHeights[minCol] > 0 ? GAP_RATIO : 0);
  });
}

function renderHomeMasonryGallery(animate = false) {
  const grid = document.getElementById('work-grid');
  if (!grid) return;

  const allProjects = window.GALLERY_PROJECTS || [];
  if (!allProjects.length) return;

  const layout = getGalleryLayout();

  // Resolve the 5 featured projects from shared data
  const featuredProjects = HOME_FEATURED_IDS.map(id => allProjects.find(p => p.id === id)).filter(Boolean);

  // Update filter chip visibility based on the 5 featured items
  const availableFilterValues = new Set(['all']);
  featuredProjects.forEach(project => {
    const mapped = CATEGORY_TO_FILTER_MAP[project.category];
    if (mapped) availableFilterValues.add(mapped);
  });

  const chips = document.querySelectorAll('.work__filters .chip');
  chips.forEach(chip => {
    const fVal = chip.dataset.filter;
    if (fVal && !availableFilterValues.has(fVal)) {
      chip.style.display = 'none';
    } else {
      chip.style.display = '';
    }
  });

  // Filter projects according to active chip
  const matchingProjects = featuredProjects.filter(project => {
    if (currentWorkFilter === 'all') return true;
    const mapped = CATEGORY_TO_FILTER_MAP[project.category];
    return mapped === currentWorkFilter;
  });

  // Limit applies after filtering (desktop: 5, tablet/mobile: 4)
  const projectsToDisplay = matchingProjects.slice(0, layout.limit);

  if (animate && window.gsap) {
    const oldHeight = grid.offsetHeight;
    grid.style.height = oldHeight + 'px';

    gsap.to(grid, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        buildMasonryDOM(projectsToDisplay, layout);
        grid.style.height = 'auto';
        const newHeight = grid.offsetHeight;
        grid.style.height = oldHeight + 'px';

        gsap.to(grid, {
          opacity: 1,
          height: newHeight,
          duration: 0.35,
          ease: 'power2.out',
          onComplete: () => {
            grid.style.height = 'auto';
            if (window.ScrollTrigger) ScrollTrigger.refresh();
          }
        });
      }
    });
  } else {
    buildMasonryDOM(projectsToDisplay, layout);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
}

// Initial render
renderHomeMasonryGallery(false);

// Staggered entrance reveal on scroll
if (window.gsap && window.ScrollTrigger) {
  const grid = document.getElementById('work-grid');
  if (grid) {
    const heading = document.querySelectorAll('#work .eyebrow, #work .section-head h2');
    ScrollTrigger.create({
      trigger: grid,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.fromTo(heading,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }
        );
        gsap.fromTo(grid.querySelectorAll('.w-card'),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }
        );
      }
    });
  }
}

// Media query change handlers (no polling, no resize listener spam)
function handleLayoutChange() {
  const newLayout = getGalleryLayout();
  if (newLayout.name !== currentLayoutName) {
    currentLayoutName = newLayout.name;
    renderHomeMasonryGallery(false);
  }
}

[mqDesktop, mqTablet, mqMobile].forEach(mq => {
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handleLayoutChange);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(handleLayoutChange);
  }
});

// Wire filter chips
const filterChips = document.querySelectorAll('.work__filters .chip');
filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    if (chip.classList.contains('is-active')) return;

    filterChips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    currentWorkFilter = chip.dataset.filter || 'all';
    renderHomeMasonryGallery(true);
  });
});

/* ============================================================
   Testimonials — Seamless Desktop Marquee + Mobile Slideshow
   ============================================================ */
(function initTestimonials() {
  const track = document.getElementById('t-track');
  const progWrap = document.getElementById('t-progress');
  const btnPrev = document.querySelector('.t-arrow--prev');
  const btnNext = document.querySelector('.t-arrow--next');
  const section = document.querySelector('.testimonials');
  if (!track) return;

  const BREAKPOINT = 767;
  const isMobile = () => window.innerWidth <= BREAKPOINT;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Grab pure original cards from HTML (6 cards)
  const originalCards = Array.from(track.querySelectorAll('.t-card'));
  const CARD_COUNT = originalCards.length;

  // 2. Clone cards for desktop marquee (2 sets of clones = 18 cards total)
  const desktopClones = [];
  [1, 2].forEach(() => {
    originalCards.forEach(card => {
      const clone = card.cloneNode(true);
      clone.classList.add('t-card--desktop-clone');
      clone.removeAttribute('data-reveal');
      clone.style.opacity = '1';
      clone.style.transform = 'none';
      track.appendChild(clone);
      desktopClones.push(clone);
    });
  });

  // Ensure all cards are visible
  originalCards.forEach(c => {
    c.style.opacity = '1';
    c.style.transform = 'none';
  });

  /* ──────────────────────────────────────────────────────────
     DESKTOP MARQUEE CONTROLLER (Continuous Smooth Auto-Scroll)
     ────────────────────────────────────────────────────────── */
  let marqueeSpeed = 0.8;
  let scrollPos = 0;
  let setWidth = 0;
  let isHovered = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragScrollStart = 0;
  let marqueeRafId = null;
  let isMarqueeActive = false;

  function measureSetWidth() {
    if (originalCards.length > 1 && originalCards[1].offsetLeft > originalCards[0].offsetLeft) {
      return (originalCards[1].offsetLeft - originalCards[0].offsetLeft) * originalCards.length;
    }
    return track.scrollWidth > 0 ? track.scrollWidth / 3 : 2184;
  }

  function startDesktopMarquee() {
    if (isMarqueeActive) return;
    isMarqueeActive = true;

    // Show desktop clones
    desktopClones.forEach(c => { c.style.display = ''; c.style.flex = ''; c.style.width = ''; c.style.margin = ''; });
    originalCards.forEach(c => { c.style.display = ''; c.style.flex = ''; c.style.width = ''; c.style.margin = ''; });

    track.style.display = 'flex';
    track.style.width = '100%';
    track.style.transform = 'none';
    track.style.transition = 'none';
    track.style.overflowX = 'scroll';
    track.style.overflowY = 'hidden';

    // Hide mobile progress bar on desktop
    if (progWrap) {
      progWrap.style.display = 'none';
      progWrap.setAttribute('aria-hidden', 'true');
    }

    requestAnimationFrame(() => {
      setWidth = measureSetWidth();
      if (setWidth > 0) {
        scrollPos = setWidth;
        track.scrollLeft = setWidth;
      }
    });

    function marqueeLoop() {
      if (!isMarqueeActive) return;

      if (setWidth === 0) {
        setWidth = measureSetWidth();
      }

      if (setWidth > 0) {
        if (!isHovered && !isDragging) {
          scrollPos += marqueeSpeed;
          if (scrollPos >= setWidth * 2) scrollPos -= setWidth;
          else if (scrollPos <= 0) scrollPos += setWidth;
          track.scrollLeft = scrollPos;
        } else {
          scrollPos = track.scrollLeft;
          if (scrollPos >= setWidth * 2) {
            scrollPos -= setWidth;
            track.scrollLeft = scrollPos;
          } else if (scrollPos <= 0) {
            scrollPos += setWidth;
            track.scrollLeft = scrollPos;
          }
        }
      }

      marqueeRafId = requestAnimationFrame(marqueeLoop);
    }

    cancelAnimationFrame(marqueeRafId);
    marqueeRafId = requestAnimationFrame(marqueeLoop);
  }

  function stopDesktopMarquee() {
    isMarqueeActive = false;
    cancelAnimationFrame(marqueeRafId);
  }

  // Desktop drag listeners
  track.addEventListener('mousedown', e => {
    if (isMobile()) return;
    isDragging = true;
    dragStartX = e.pageX - track.offsetLeft;
    dragScrollStart = track.scrollLeft;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  track.addEventListener('mouseenter', () => { if (!isMobile()) isHovered = true; });
  track.addEventListener('mouseleave', () => { if (!isMobile()) { isHovered = false; isDragging = false; } });
  track.addEventListener('mousemove', e => {
    if (isMobile() || !isDragging) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    track.scrollLeft = dragScrollStart - (x - dragStartX) * 1.8;
    scrollPos = track.scrollLeft;
  });

  /* ──────────────────────────────────────────────────────────
     MOBILE SLIDESHOW CONTROLLER (Autoplay, Progress Bars, Loop)
     ────────────────────────────────────────────────────────── */
  const SLIDE_MS = 5000;
  const TRANS_MS = 450;
  let isMobileActive = false;
  let curIdx = 0;
  let loopClone = null;
  let segs = [];
  let segFills = [];
  let autoTimer = null;
  let animStart = null;
  let pausedAt = null;
  let isSectionVisible = true;
  let isTabVisible = true;
  let isHolding = false;
  let isTransitioning = false;

  function buildMobileProgress() {
    if (!progWrap) return;
    progWrap.innerHTML = '';
    progWrap.style.display = 'flex';
    progWrap.setAttribute('role', 'group');
    progWrap.setAttribute('aria-label', 'Testimonial progress');
    progWrap.setAttribute('aria-hidden', 'false');
    segs = [];
    segFills = [];

    for (let i = 0; i < CARD_COUNT; i++) {
      const seg = document.createElement('button');
      seg.type = 'button';
      seg.className = 't-progress__seg';
      seg.setAttribute('aria-label', `Go to testimonial ${i + 1} of ${CARD_COUNT}`);

      const fill = document.createElement('span');
      fill.className = 't-progress__fill';
      seg.appendChild(fill);
      progWrap.appendChild(seg);

      segs.push(seg);
      segFills.push(fill);

      seg.addEventListener('click', () => {
        if (isMobile()) jumpToMobileCard(i);
      });
    }
  }

  function updateMobileBars(activeIdx) {
    segs.forEach((seg, i) => {
      seg.classList.toggle('is-done', i < activeIdx);
      seg.classList.toggle('is-active', i === activeIdx);
      seg.classList.toggle('is-future', i > activeIdx);
      seg.setAttribute('aria-current', i === activeIdx ? 'true' : 'false');
    });
    segFills.forEach((f, i) => {
      f.style.animation = 'none';
      f.style.transform = i < activeIdx ? 'scaleX(1)' : 'scaleX(0)';
    });
    if (!reducedMotion && segFills[activeIdx]) {
      const activeFill = segFills[activeIdx];
      void activeFill.offsetWidth; // flush reflow
      activeFill.style.transform = '';
      activeFill.style.animation = `t-fill ${SLIDE_MS}ms linear forwards`;
    }
  }

  function slideToSlot(slot) {
    if (reducedMotion) {
      originalCards.forEach((c, i) => {
        const visible = i === (slot % CARD_COUNT);
        c.style.opacity = visible ? '1' : '0';
        c.style.pointerEvents = visible ? 'auto' : 'none';
      });
      curIdx = slot % CARD_COUNT;
    } else {
      const totalSlots = loopClone ? CARD_COUNT + 1 : CARD_COUNT;
      track.style.transform = `translateX(-${slot * (100 / totalSlots)}%)`;
      if (slot < CARD_COUNT) curIdx = slot;
    }
    updateMobileBars(slot % CARD_COUNT);
  }

  function startMobileTimer() {
    clearTimeout(autoTimer);
    animStart = performance.now();
    pausedAt = null;

    autoTimer = setTimeout(() => {
      if (!isMobileActive) return;
      const nextIdx = (curIdx + 1) % CARD_COUNT;

      if (nextIdx === 0 && !reducedMotion && loopClone) {
        // Continuous forward loop: slide into clone of card 0
        isTransitioning = true;
        track.style.transition = `transform ${TRANS_MS}ms cubic-bezier(.22,1,.36,1)`;
        slideToSlot(CARD_COUNT); // card 0 clone

        setTimeout(() => {
          // Invisibly snap to real slot 0
          track.style.transition = 'none';
          slideToSlot(0);
          curIdx = 0;
          void track.offsetWidth;
          track.style.transition = `transform ${TRANS_MS}ms cubic-bezier(.22,1,.36,1)`;
          isTransitioning = false;
          startMobileTimer();
        }, TRANS_MS + 20);
      } else {
        slideToSlot(nextIdx);
        startMobileTimer();
      }
    }, SLIDE_MS);
  }

  function jumpToMobileCard(idx) {
    if (isTransitioning) return;
    clearTimeout(autoTimer);
    curIdx = ((idx % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
    slideToSlot(curIdx);
    startMobileTimer();
  }

  function pauseMobile() {
    if (pausedAt !== null) return;
    clearTimeout(autoTimer);
    pausedAt = performance.now() - (animStart || performance.now());
    if (!reducedMotion && segFills[curIdx]) {
      const f = segFills[curIdx];
      const pct = Math.min(pausedAt / SLIDE_MS, 1);
      f.style.animation = 'none';
      f.style.transform = `scaleX(${pct})`;
    }
  }

  function resumeMobile() {
    if (pausedAt === null) return;
    const remaining = Math.max(SLIDE_MS - pausedAt, 0);
    pausedAt = null;
    animStart = performance.now() - (SLIDE_MS - remaining);

    if (!reducedMotion && segFills[curIdx]) {
      const f = segFills[curIdx];
      void f.offsetWidth;
      f.style.transform = '';
      f.style.animation = `t-fill ${remaining}ms linear forwards`;
    }

    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      jumpToMobileCard((curIdx + 1) % CARD_COUNT);
    }, remaining);
  }

  function checkMobilePause() {
    if (!isMobileActive) return;
    if (isHolding || !isSectionVisible || !isTabVisible) pauseMobile();
    else resumeMobile();
  }

  function startMobileSlideshow() {
    if (isMobileActive) return;
    isMobileActive = true;

    // Hide desktop clones completely on mobile
    desktopClones.forEach(c => { c.style.display = 'none'; });

    // Clean track position
    track.scrollLeft = 0;

    if (reducedMotion) {
      track.style.position = 'relative';
      track.style.width = '100%';
      track.style.transform = 'none';
      track.style.overflow = 'hidden';
      originalCards.forEach((c, i) => {
        c.style.display = '';
        c.style.position = i === 0 ? 'relative' : 'absolute';
        c.style.inset = '0';
        c.style.flex = '0 0 calc(100% - 28px)';
        c.style.width = 'calc(100% - 28px)';
        c.style.margin = '0 auto';
        c.style.opacity = i === 0 ? '1' : '0';
        c.style.transition = `opacity ${TRANS_MS}ms ease`;
        c.style.pointerEvents = i === 0 ? 'auto' : 'none';
      });
    } else {
      // Loop clone of card 0 at the end
      if (!loopClone) {
        loopClone = originalCards[0].cloneNode(true);
        loopClone.setAttribute('aria-hidden', 'true');
        loopClone.removeAttribute('data-reveal');
        loopClone.style.opacity = '1';
        loopClone.style.transform = 'none';
        track.appendChild(loopClone);
      }
      loopClone.style.display = '';

      const totalSlots = CARD_COUNT + 1;
      const slotPct = 100 / totalSlots;

      track.style.display = 'flex';
      track.style.width = `${totalSlots * 100}%`;
      track.style.transition = `transform ${TRANS_MS}ms cubic-bezier(.22,1,.36,1)`;
      track.style.transform = 'translateX(0)';
      track.style.overflow = 'visible';

      [...originalCards, loopClone].forEach(c => {
        c.style.display = '';
        c.style.flex = `0 0 calc(${slotPct}% - 28px)`;
        c.style.width = `calc(${slotPct}% - 28px)`;
        c.style.margin = '0 14px';
        c.style.opacity = '1';
        c.style.transform = 'none';
        c.style.pointerEvents = 'auto';
      });
    }

    buildMobileProgress();
    curIdx = 0;
    isTransitioning = false;
    slideToSlot(0);
    startMobileTimer();
  }

  function stopMobileSlideshow() {
    if (!isMobileActive) return;
    isMobileActive = false;
    clearTimeout(autoTimer);
    isTransitioning = false;

    if (loopClone && loopClone.parentNode === track) {
      track.removeChild(loopClone);
    }
    loopClone = null;

    if (progWrap) {
      progWrap.innerHTML = '';
      progWrap.style.display = 'none';
    }

    originalCards.forEach(c => {
      c.style.display = '';
      c.style.position = '';
      c.style.inset = '';
      c.style.flex = '';
      c.style.width = '';
      c.style.margin = '';
      c.style.opacity = '1';
      c.style.transform = 'none';
      c.style.transition = '';
      c.style.pointerEvents = 'auto';
    });

    track.style.display = '';
    track.style.width = '';
    track.style.transition = '';
    track.style.transform = '';
    track.style.overflow = '';
    track.style.position = '';
  }

  /* ──────────────────────────────────────────────────────────
     UNIFIED ARROW BUTTONS & INTERACTION
     ────────────────────────────────────────────────────────── */
  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.preventDefault();
      if (isMobile()) {
        jumpToMobileCard(curIdx - 1);
      } else {
        // Desktop smooth scroll backwards by one card width
        isHovered = true;
        track.scrollBy({ left: -364, behavior: 'smooth' });
        setTimeout(() => {
          scrollPos = track.scrollLeft;
          isHovered = false;
        }, 500);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.preventDefault();
      if (isMobile()) {
        jumpToMobileCard(curIdx + 1);
      } else {
        // Desktop smooth scroll forwards by one card width
        isHovered = true;
        track.scrollBy({ left: 364, behavior: 'smooth' });
        setTimeout(() => {
          scrollPos = track.scrollLeft;
          isHovered = false;
        }, 500);
      }
    });
  }

  // Mobile Touch Swipe & Press-and-Hold
  let touchStartX = 0, touchStartY = 0;
  track.addEventListener('touchstart', e => {
    if (isMobile()) {
      isHolding = true;
      checkMobilePause();
    }
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });

  track.addEventListener('touchend', e => {
    if (isMobile()) {
      isHolding = false;
      checkMobilePause();
      const dx = touchStartX - e.changedTouches[0].clientX;
      const dy = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        jumpToMobileCard(dx > 0 ? curIdx + 1 : curIdx - 1);
      }
    }
  }, { passive: true });

  track.addEventListener('touchcancel', () => {
    if (isMobile()) {
      isHolding = false;
      checkMobilePause();
    }
  }, { passive: true });

  // Hold with mouse on mobile / tablet touch simulation
  track.addEventListener('mousedown', () => {
    if (isMobile()) {
      isHolding = true;
      checkMobilePause();
    }
  });
  window.addEventListener('mouseup', () => {
    if (isMobile() && isHolding) {
      isHolding = false;
      checkMobilePause();
    }
  });

  // Pause when off-screen or tab hidden
  if (section && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      isSectionVisible = entries[0].isIntersecting;
      checkMobilePause();
    }, { threshold: 0.15 }).observe(section);
  }

  document.addEventListener('visibilitychange', () => {
    isTabVisible = document.visibilityState === 'visible';
    checkMobilePause();
  });

  /* ──────────────────────────────────────────────────────────
     RESPONSIVE SWITCHER (Handles resize / initial load)
     ────────────────────────────────────────────────────────── */
  function syncMode() {
    if (isMobile()) {
      stopDesktopMarquee();
      startMobileSlideshow();
    } else {
      stopMobileSlideshow();
      startDesktopMarquee();
    }
  }

  syncMode();
  window.addEventListener('resize', syncMode);
})();
