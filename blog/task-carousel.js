/* Hero previews use the same task assets, without loading offscreen videos. */
(() => {
  'use strict';
  const carousel = document.getElementById('task-video-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.atlas-strip');
  const cards = Array.from(track.querySelectorAll('.atlas-tile'));
  // A copy on either side gives native scrolling room in both directions.
  const copies = () => cards.map(card => {
    const copy = card.cloneNode(true);
    copy.classList.add('atlas-copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.tabIndex = -1;
    return copy;
  });
  track.prepend(...copies());
  track.append(...copies());
  const videos = Array.from(track.querySelectorAll('video'));
  const controls = carousel.querySelector('.atlas-controls');
  const pause = controls.querySelector('[data-carousel="pause"]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set();
  let paused = reduced.matches;
  let hovering = false;
  let focused = false;
  let inView = false;
  let frame = null;
  let lastTime = null;
  let position = track.scrollLeft;
  let cycle = 0;
  let stepFrame = null;
  let resumeTimer = null;
  let interacting = false;
  let pointerHeld = false;

  const updateVideos = () => videos.forEach(video => {
    const shouldPlay = !paused && inView && !document.hidden && visible.has(video);
    if (shouldPlay && video.paused) {
      video.muted = true;
      video.play().then(() => {
        if (paused || !inView || document.hidden || !visible.has(video)) video.pause();
      }).catch(() => {}); // Keep the poster when autoplay is unavailable.
    } else if (!shouldPlay) video.pause();
  });
  const wrap = left => cycle ? cycle + ((left - cycle) % cycle + cycle) % cycle : left;
  const normalize = () => {
    const left = wrap(track.scrollLeft);
    if (Math.abs(left - track.scrollLeft) > 1) {
      // Keep the same recording time when crossing between identical copies.
      const shift = Math.round((left - track.scrollLeft) / cycle) * cards.length;
      const tiles = Array.from(track.children);
      tiles.forEach((tile, index) => {
        const source = tile.querySelector('video');
        const target = tiles[index + shift]?.querySelector('video');
        if (source && target && visible.has(source)) target.currentTime = source.currentTime;
      });
      track.scrollTo({left, behavior: 'instant'});
    }
    return left;
  };
  const measure = () => {
    const previousCycle = cycle;
    cycle = cards[0].offsetLeft - track.children[0].offsetLeft;
    if (!cycle) return;
    const left = previousCycle ? track.scrollLeft / previousCycle * cycle : cycle;
    track.scrollTo({left: wrap(left), behavior: 'instant'});
    position = track.scrollLeft;
  };
  const cancelStep = () => {
    if (stepFrame !== null) cancelAnimationFrame(stepFrame);
    stepFrame = null;
  };
  const advance = direction => {
    cancelStep();
    if (!cycle) return;
    const start = normalize();
    const distance = direction * (cards[1].offsetLeft - cards[0].offsetLeft);
    if (reduced.matches) {
      track.scrollTo({left: start + distance, behavior: 'instant'});
      normalize();
      return;
    }
    const began = performance.now();
    const animate = now => {
      const progress = Math.min((now - began) / 320, 1);
      track.scrollTo({left: start + distance * (1 - Math.pow(1 - progress, 3)), behavior: 'instant'});
      if (progress < 1) stepFrame = requestAnimationFrame(animate);
      else { stepFrame = null; normalize(); }
    };
    stepFrame = requestAnimationFrame(animate);
  };
  const canScroll = () => !paused && !hovering && !focused && !interacting && !pointerHeld && inView && !document.hidden;
  const tick = now => {
    frame = null;
    if (!canScroll()) { lastTime = null; return; }
    const delta = lastTime === null ? 0 : Math.min(now - lastTime, 50);
    lastTime = now;
    position += delta * 0.036;
    track.scrollLeft = position;
    const normalized = normalize();
    if (Math.abs(normalized - position) > 1) position = normalized;
    frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    position = track.scrollLeft;
    if (canScroll()) frame = requestAnimationFrame(tick);
  };
  const stopAutomatic = () => {
    cancelStep();
    interacting = true;
    clearTimeout(resumeTimer);
    schedule();
    resumeTimer = setTimeout(() => { interacting = false; schedule(); }, 1800);
  };
  const refresh = () => {
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Play video previews and enable automatic scrolling' : 'Pause video previews and automatic scrolling');
    updateVideos();
    schedule();
  };
  track.classList.add('is-auto-scrolling');
  measure();
  track.addEventListener('scroll', () => {
    if (stepFrame === null) normalize();
  }, {passive: true});
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
  else window.addEventListener('resize', measure);
  controls.hidden = false;
  controls.querySelector('[data-carousel="previous"]').addEventListener('click', () => { stopAutomatic(); advance(-1); });
  controls.querySelector('[data-carousel="next"]').addEventListener('click', () => { stopAutomatic(); advance(1); });
  pause.addEventListener('click', () => { paused = !paused; refresh(); });
  track.addEventListener('pointerdown', () => { pointerHeld = true; stopAutomatic(); }, {passive: true});
  const releasePointer = () => { if (pointerHeld) { pointerHeld = false; stopAutomatic(); } };
  document.addEventListener('pointerup', releasePointer);
  document.addEventListener('pointercancel', releasePointer);
  track.addEventListener('wheel', stopAutomatic, {passive: true});
  track.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    stopAutomatic();
    if (event.key === 'Home' || event.key === 'End') {
      track.scrollTo({left: event.key === 'Home' ? cycle : cycle + cards[cards.length - 1].offsetLeft - cards[0].offsetLeft, behavior: 'instant'});
    } else advance(event.key === 'ArrowRight' ? 1 : -1);
  });
  carousel.addEventListener('mouseenter', () => { hovering = true; schedule(); });
  carousel.addEventListener('mouseleave', () => { hovering = false; schedule(); });
  carousel.addEventListener('focusin', () => { focused = Boolean(carousel.querySelector(':focus-visible')); schedule(); });
  carousel.addEventListener('focusout', event => { focused = carousel.contains(event.relatedTarget); schedule(); });
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', () => { paused = reduced.matches; refresh(); });

  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      updateVideos();
    }, {threshold: 0.5});
    videos.forEach(video => videoObserver.observe(video));
    const carouselObserver = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      updateVideos();
      schedule();
    }, {threshold: 0.15});
    carouselObserver.observe(carousel);
  } else {
    // Native playback remains available if viewport observation is unsupported.
    videos.forEach(video => { video.controls = true; });
    pause.hidden = true;
  }
  refresh();
})();
