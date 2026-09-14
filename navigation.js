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

  const contact = document.getElementById('navContact');
  if (contact) {
    const dialog = document.createElement('dialog');
    dialog.id = 'contactDialog';
    dialog.className = 'contact-dialog';
    dialog.setAttribute('aria-labelledby', 'contactTitle');
    dialog.innerHTML = `
      <div class="contact-dialog-header">
        <h2 id="contactTitle">Contact</h2>
        <form method="dialog">
          <button class="contact-dialog-close" type="submit" aria-label="Close contact panel" autofocus>Close <span aria-hidden="true">×</span></button>
        </form>
      </div>
      <dl class="contact-list">
        <div><dt>Haitong Ma</dt><dd><a href="mailto:haitongma@g.harvard.edu">haitongma@g.harvard.edu</a></dd></div>
        <div><dt>Chenxiao Gao</dt><dd><a href="mailto:cgao@gatech.edu">cgao@gatech.edu</a></dd></div>
        <div><dt>Rushi Qiang</dt><dd><a href="mailto:rqiang6@gatech.edu">rqiang6@gatech.edu</a></dd></div>
      </dl>`;
    document.body.append(dialog);
    contact.addEventListener('click', () => {
      setOpen(false);
      dialog.showModal();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      (compact.matches ? button : contact).focus();
    });
  }
})();
