/* Hero previews use the same task assets, without loading offscreen videos. */
(() => {
  'use strict';
  const carousel = document.getElementById('task-video-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.atlas-strip');
  const cards = Array.from(track.querySelectorAll('.atlas-tile'));
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
  let direction = 1;
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
  const advance = direction => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    if (!max) return;
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    const end = track.scrollLeft >= max - 2;
    const start = track.scrollLeft <= 2;
    const left = direction > 0 && end ? 0 : direction < 0 && start ? max
      : Math.max(0, Math.min(max, track.scrollLeft + direction * step));
    track.scrollTo({left, behavior: reduced.matches ? 'instant' : 'smooth'});
  };
  const canScroll = () => !paused && !hovering && !focused && !interacting && !pointerHeld && inView && !document.hidden;
  const tick = now => {
    frame = null;
    if (!canScroll()) { lastTime = null; return; }
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    const delta = lastTime === null ? 0 : Math.min(now - lastTime, 50);
    lastTime = now;
    position += direction * delta * 0.036;
    if (position >= max) { position = max; direction = -1; }
    if (position <= 0) { position = 0; direction = 1; }
    track.scrollLeft = position;
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
      track.scrollTo({left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: 'instant'});
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
