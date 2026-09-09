/* Accessible, reader-initiated controls. Native video controls remain the
   fallback when JavaScript is unavailable. Recordings have no audio track. */
(() => {
  'use strict';
  const videos = Array.from(document.querySelectorAll('.demo-video'));
  const paths = {
    play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    replay: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    collapse: '<path d="M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  const time = value => {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  videos.forEach(video => {
    const figure = video.closest('.demo-figure');
    if (!figure) return;
    const player = document.createElement('div');
    player.className = 'demo-player';
    player.innerHTML = `
      <div class="demo-stage">
        <button class="demo-cover-play" type="button" aria-label="Play video">${icon('play')}<span class="demo-cover-label">Play film</span></button>
      </div>
      <div class="demo-controls" role="group" aria-label="Video controls">
        <button class="demo-control demo-toggle" type="button" aria-label="Play video" title="Play">${icon('play')}</button>
        <input class="demo-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Video progress" aria-valuetext="0:00"/>
        <span class="demo-clock"><span class="demo-elapsed">0:00</span><span class="demo-time-divider" aria-hidden="true">/</span><span class="demo-total"></span></span>
        <button class="demo-control demo-fullscreen" type="button" aria-label="Enter fullscreen" title="Fullscreen">${icon('expand')}</button>
      </div>
      <p class="demo-player-status" role="status" aria-live="polite" hidden></p>`;
    const stage = player.querySelector('.demo-stage');
    const controls = player.querySelector('.demo-controls');
    const cover = player.querySelector('.demo-cover-play');
    const toggle = player.querySelector('.demo-toggle');
    const seek = player.querySelector('.demo-seek');
    const elapsed = player.querySelector('.demo-elapsed');
    const total = player.querySelector('.demo-total');
    const fullscreen = player.querySelector('.demo-fullscreen');
    const status = player.querySelector('.demo-player-status');
    const download = figure.querySelector('.demo-download');
    let pendingSeek = null;
    let loadRequested = false;
    const duration = () => Number.isFinite(video.duration) && video.duration > 0
      ? video.duration : Number(video.dataset.duration) || 0;
    const announce = message => { status.textContent = message; status.hidden = !message; };

    const updateTime = () => {
      const length = duration();
      const current = pendingSeek === null ? video.currentTime || 0 : pendingSeek;
      const progress = length ? Math.min(100, Math.max(0, current / length * 100)) : 0;
      seek.value = String(Math.round(progress * 10));
      seek.style.setProperty('--played', `${progress}%`);
      seek.setAttribute('aria-valuetext', `${time(current)} of ${time(length)}`);
      elapsed.textContent = time(current);
      total.textContent = time(length);
      seek.disabled = !length;
    };
    const updatePlayback = () => {
      const stopped = video.paused || video.ended;
      player.classList.toggle('is-playing', !stopped);
      player.classList.toggle('is-ended', video.ended);
      const name = video.ended ? 'replay' : stopped ? 'play' : 'pause';
      const label = video.ended ? 'Replay video' : stopped ? 'Play video' : 'Pause video';
      toggle.innerHTML = icon(name);
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      cover.setAttribute('aria-label', label);
      cover.querySelector('svg').outerHTML = icon(video.ended ? 'replay' : 'play');
      cover.querySelector('span').textContent = video.ended ? 'Replay film' : 'Play film';
      if (!stopped && document.activeElement === cover) toggle.focus({preventScroll: true});
      cover.hidden = !stopped;
      if (stopped) player.classList.remove('is-loading');
    };
    const togglePlayback = async () => {
      announce('');
      if (!video.paused && !video.ended) { video.pause(); return; }
      if (video.error) { loadRequested = false; video.load(); }
      if (video.ended) video.currentTime = 0;
      try { await video.play(); }
      catch (error) {
        // A deliberate pause while a play request is pending is not an error.
        if (error.name !== 'AbortError') announce('Playback could not start. Try again or download the video.');
        updatePlayback();
      }
    };
    const seekTo = seconds => {
      const target = Math.min(duration(), Math.max(0, seconds));
      if (video.readyState === 0) {
        pendingSeek = target;
        if (!loadRequested) { loadRequested = true; video.load(); }
      } else video.currentTime = target;
      updateTime();
    };

    toggle.addEventListener('click', togglePlayback);
    cover.addEventListener('click', togglePlayback);
    video.addEventListener('click', togglePlayback);
    seek.addEventListener('input', () => seekTo(Number(seek.value) / 1000 * duration()));
    seek.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      seekTo((pendingSeek === null ? video.currentTime : pendingSeek) + (event.key === 'ArrowRight' ? 5 : -5));
    });
    video.addEventListener('loadedmetadata', () => {
      if (pendingSeek !== null) { video.currentTime = Math.min(pendingSeek, duration()); pendingSeek = null; }
      updateTime();
    });
    ['durationchange', 'timeupdate', 'seeked'].forEach(event => video.addEventListener(event, updateTime));
    ['play', 'pause', 'ended'].forEach(event => video.addEventListener(event, updatePlayback));
    video.addEventListener('play', () => videos.forEach(other => { if (other !== video) other.pause(); }));
    video.addEventListener('waiting', () => { if (!video.paused) player.classList.add('is-loading'); });
    video.addEventListener('playing', () => { player.classList.remove('is-loading'); announce(''); });
    video.addEventListener('error', () => {
      pendingSeek = null;
      loadRequested = false;
      video.pause();
      updatePlayback();
      player.classList.remove('is-loading');
      announce('This video could not load. Use the download button to open the recording.');
    });
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === player) await document.exitFullscreen();
        else if (player.requestFullscreen) await player.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch { announce('Fullscreen is unavailable here. You can open the recording with the download button.'); }
    });
    document.addEventListener('fullscreenchange', () => {
      const active = document.fullscreenElement === player;
      fullscreen.innerHTML = icon(active ? 'collapse' : 'expand');
      fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
      fullscreen.title = active ? 'Exit fullscreen' : 'Fullscreen';
    });
    if (!player.requestFullscreen && !video.webkitEnterFullscreen) fullscreen.hidden = true;

    video.parentNode.insertBefore(player, video);
    stage.prepend(video);
    if (download) {
      download.classList.add('demo-control');
      download.setAttribute('aria-label', 'Download video');
      download.title = 'Download video';
      download.innerHTML = icon('download');
      controls.append(download);
    }
    updateTime();
    updatePlayback();
    video.controls = false;
    figure.classList.add('has-custom-player');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
  });
})();
