/* Playback is reader-initiated. Keep independent demos from playing together. */
(() => {
  'use strict';
  const videos = Array.from(document.querySelectorAll('.demo-video'));
  videos.forEach(video => {
    video.addEventListener('play', () => {
      videos.forEach(other => { if (other !== video) other.pause(); });
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
  });
})();
