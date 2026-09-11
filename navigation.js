(() => {
  'use strict';
  const menu = document.getElementById('siteNav');
  const button = document.getElementById('menuToggle');
  if (!menu || !button) return;
  const header = document.getElementById('siteHeader');
  header.classList.add('navigation-ready');
  button.hidden = false;
  function setOpen(open) {
    menu.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    setOpen(open);
    if (open) menu.querySelector('a[href]')?.focus();
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a[href]')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener('focusin', event => {
    if (!menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  const compact = matchMedia('(max-width: 900px), (orientation: portrait)');
  compact.addEventListener('change', () => setOpen(false));
})();
