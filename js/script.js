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

  // Hero: left column slides in from the left, right column from the right, on load
  gsap.to('#hero [data-slide="left"]', { x:0, opacity:1, duration:1, ease:'power3.out', delay:.15 });
  gsap.to('#hero [data-slide="right"]', { x:0, opacity:1, duration:1, ease:'power3.out', delay:.3 });

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

  // HIW cards — slide in from below on entry (staggered), then image-parallax for depth
  const hiwCards = document.querySelectorAll('.hiw-card');
  const hiwImgs  = document.querySelectorAll('.hiw-card__img');

  // Stage 1: cards start hidden below, rise up in sequence
  gsap.set(hiwCards, { y: 100, opacity: 0 });
  ScrollTrigger.create({
    trigger: '.hiw__grid',
    start: 'top 82%',
    once: true,
    onEnter: () => {
      gsap.to(hiwCards, {
        y: 0,
        opacity: 1,
        duration: 1.0,
        ease: 'power3.out',
        stagger: 0.2
      });
    }
  });

  // Stage 2: only the inner image drifts — no conflict with the card entry
  const imgSpeeds = [25, 15, 32]; // positive = drift down as you scroll past
  hiwImgs.forEach((img, i) => {
    gsap.fromTo(img,
      { yPercent: -15 },
      {
        yPercent: imgSpeeds[i] ?? 20,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.hiw-card'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5
        }
      }
    );
  });

  // Hero card stack parallax
  gsap.to('.hero__card--back', { y: 40, scrollTrigger: { trigger:'.hero', start:'top top', end:'bottom top', scrub:true } });
  gsap.to('.hero__card--front', { y: -20, scrollTrigger: { trigger:'.hero', start:'top top', end:'bottom top', scrub:true } });

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


/* ---------------- Portfolio gallery: cinematic reveal + scroll parallax + magnetic hover ----------------
   Cards stagger in from below with a blur-clear on scroll enter. Each card
   drifts at a slightly different speed on scroll for a depth-layer parallax.
   Hovering lifts a card with cursor-tracked 3D tilt + amber glow while other
   cards dim — grid layout means zero overlap and zero fighting. */
if (isDesktop && window.gsap && window.ScrollTrigger) {
  (function workGallery() {
    const grid = document.getElementById('work-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.w-card'));

    // Initial hidden state — scale+blur only, so parallax (yPercent) never conflicts
    gsap.set(cards, { autoAlpha: 0, scale: 0.88, filter: 'blur(12px)', transformOrigin: 'center bottom' });

    const heading = document.querySelectorAll('#work .eyebrow, #work .section-head h2');

    // Cinematic stagger reveal
    ScrollTrigger.create({
      trigger: grid, start: 'top 82%', once: true,
      onEnter: () => {
        gsap.fromTo(heading,
          { opacity: 0, y: 30, filter: 'blur(14px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: .08 }
        );
        gsap.to(cards, {
          autoAlpha: 1, scale: 1, filter: 'blur(0px)',
          duration: 1.1, ease: 'power4.out',
          stagger: { each: 0.1, from: 'start' }
        });
      }
    });

    // Premium Inner-Image Parallax
    // Scales the image slightly larger than the card and shifts it on scroll
    cards.forEach((card) => {
      const media = card.querySelector('.w-card__media');
      if (!media) return;
      
      // Make the image taller so we have room to parallax
      gsap.set(media, { height: '120%', top: '-10%' });
      
      gsap.to(media, {
        yPercent: 20, // Moves from top:-10% (0) to a positive shift
        ease: 'none',
        scrollTrigger: {
          trigger: card,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  })();
}

/* ---------------- Work filters ---------------- */
const chips = document.querySelectorAll('.chip');
const wCards = document.querySelectorAll('.w-card');
const grid = document.getElementById('work-grid');

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    if (chip.classList.contains('is-active')) return;
    
    chips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    const filter = chip.dataset.filter;
    
    if (window.gsap && grid) {
      const oldHeight = grid.offsetHeight;
      
      // Fade out the entire grid quickly
      gsap.to(grid, {
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
          // Lock height to prevent page jump
          grid.style.height = oldHeight + 'px';
          
          wCards.forEach(card => {
            const show = filter === 'all' || card.dataset.cat === filter;
            card.classList.toggle('is-hidden', !show);
            // Ensure cards are fully visible when the grid fades back in
            gsap.set(card, { opacity: 1, scale: 1 });
          });
          
          // Measure the new natural height
          grid.style.height = 'auto';
          const newHeight = grid.offsetHeight;
          grid.style.height = oldHeight + 'px';
          
          // Smoothly animate to the new height while fading back in
          gsap.to(grid, {
            opacity: 1,
            height: newHeight,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
              grid.style.height = 'auto'; // Release height lock
              if (window.ScrollTrigger) ScrollTrigger.refresh(); // Update parallax calculations
            }
          });
        }
      });
    } else {
      wCards.forEach(card => {
        const show = filter === 'all' || card.dataset.cat === filter;
        card.classList.toggle('is-hidden', !show);
      });
    }
  });
});

/* ---------------- Testimonial Marquee + Arrows ---------------- */
(function testimonialMarquee(){
  const track = document.getElementById('t-track');
  if (!track) return;
  const originalCards = Array.from(track.querySelectorAll('.t-card'));
  
  // Clone cards to create infinite scrolling effect
  originalCards.forEach(card => {
    const clone = card.cloneNode(true);
    clone.removeAttribute('data-reveal');
    clone.style.opacity = '1';
    clone.style.transform = 'none';
    track.appendChild(clone);
  });
  originalCards.forEach(card => {
    const clone = card.cloneNode(true);
    clone.removeAttribute('data-reveal');
    clone.style.opacity = '1';
    clone.style.transform = 'none';
    track.appendChild(clone);
  });

  let speed = 0.8; // Slowed down slightly
  let scrollPos = 0;
  let setWidth = 0;

  // Mobile gets a discrete "story-style" carousel instead of the continuous
  // auto-scroll marquee below — everything desktop-related stays untouched.
  const isMobileT = window.matchMedia('(max-width: 768px)').matches;
  
  requestAnimationFrame(() => {
    if (originalCards.length > 1) {
      setWidth = (originalCards[1].offsetLeft - originalCards[0].offsetLeft) * originalCards.length;
    } else {
      setWidth = track.scrollWidth / 3;
    }
    scrollPos = setWidth;
    track.scrollLeft = setWidth;
  });

  let isHovered = false;
  let isDragging = false;
  let startX;
  let scrollLeftStart;

  // Track dragging
  track.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.pageX - track.offsetLeft;
    scrollLeftStart = track.scrollLeft;
  });
  track.addEventListener('mouseleave', () => {
    isDragging = false;
    isHovered = false;
  });
  track.addEventListener('mouseup', () => {
    isDragging = false;
  });
  track.addEventListener('mouseenter', () => {
    isHovered = true;
  });
  track.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 2;
    track.scrollLeft = scrollLeftStart - walk;
    scrollPos = track.scrollLeft;
  });

  function loop() {
    if (setWidth === 0) {
      requestAnimationFrame(loop);
      return;
    }
    
    // Only auto-scroll if not interacted with or animated
    if (!isHovered && !isDragging && (!window.gsap || !gsap.isTweening(track))) {
      scrollPos += speed;
      
      // If we scroll past the second set, jump back to the first clone
      if (scrollPos >= setWidth * 2) {
        scrollPos -= setWidth;
      } 
      // If we scroll backwards past the first clone, jump forward
      else if (scrollPos <= 0) {
        scrollPos += setWidth;
      }
      
      track.scrollLeft = scrollPos;
    } else {
      // Keep scrollPos synced with user interactions and wrap it if dragged
      scrollPos = track.scrollLeft;
      
      if (scrollPos >= setWidth * 2) {
        scrollPos -= setWidth;
        track.scrollLeft = scrollPos;
      } else if (scrollPos <= 0) {
        scrollPos += setWidth;
        track.scrollLeft = scrollPos;
      }
    }
    requestAnimationFrame(loop);
  }
  if (!isMobileT) requestAnimationFrame(loop);

  // Arrows
  const btnPrev = document.querySelector('.t-arrow--prev');
  const btnNext = document.querySelector('.t-arrow--next');
  if (btnPrev && btnNext && !isMobileT) {
    btnPrev.addEventListener('click', () => {
      if (window.gsap) {
        gsap.to(track, { 
          scrollLeft: track.scrollLeft - 360, 
          duration: 0.6, 
          ease: 'power2.out',
          onUpdate: () => scrollPos = track.scrollLeft
        });
      } else {
        track.scrollBy({ left: -360, behavior: 'smooth' });
      }
    });
    btnNext.addEventListener('click', () => {
      if (window.gsap) {
        gsap.to(track, { 
          scrollLeft: track.scrollLeft + 360, 
          duration: 0.6, 
          ease: 'power2.out',
          onUpdate: () => scrollPos = track.scrollLeft
        });
      } else {
        track.scrollBy({ left: 360, behavior: 'smooth' });
      }
    });
  }

  /* ---------------- Mobile story-style carousel ----------------
     One card visible at a time, auto-advances every 4s, arrows still
     work and reset the timer, and a segmented progress bar at the
     bottom tracks position — wrapping back to the first card (and
     resetting the bar) once you pass the last one. */
  if (isMobileT && btnPrev && btnNext) {
    const progressWrap = document.getElementById('t-progress');
    const mobileCards = originalCards; // clones are hidden via CSS, only the 6 real cards are used here
    const segments = progressWrap ? Array.from(progressWrap.querySelectorAll('.t-progress__fill')) : [];
    const DURATION = 4000;
    let index = 0;
    let timer;

    function updateProgress(){
      segments.forEach((seg, i) => {
        if (window.gsap) gsap.killTweensOf(seg);
        if (i < index) {
          seg.style.width = '100%';
        } else if (i === index) {
          if (window.gsap) {
            gsap.fromTo(seg, { width: '0%' }, { width: '100%', duration: DURATION / 1000, ease: 'none' });
          } else {
            seg.style.width = '100%';
          }
        } else {
          seg.style.width = '0%';
        }
      });
    }

    function startTimer(){
      clearTimeout(timer);
      timer = setTimeout(() => goTo(index + 1), DURATION);
    }

    function goTo(i){
      index = (i + mobileCards.length) % mobileCards.length;
      const x = -index * track.clientWidth;
      if (window.gsap) {
        gsap.to(track, { x, duration: 0.5, ease: 'power3.inOut' });
      } else {
        track.style.transform = `translateX(${x}px)`;
      }
      updateProgress();
      startTimer();
    }

    btnPrev.addEventListener('click', () => goTo(index - 1));
    btnNext.addEventListener('click', () => goTo(index + 1));

    window.addEventListener('resize', () => {
      const x = -index * track.clientWidth;
      if (window.gsap) gsap.set(track, { x }); else track.style.transform = `translateX(${x}px)`;
    });

    requestAnimationFrame(() => {
      updateProgress();
      startTimer();
    });
  }
})();