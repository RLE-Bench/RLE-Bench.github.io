(() => {
  'use strict';
  const theme = document.getElementById('themeToggle');
  theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('rlebench-theme', next); } catch (_) { /* Storage is optional. */ }
  });
  if (!navigator.clipboard?.writeText) return;
  document.querySelectorAll('.copy-button').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const code = button.closest('.command').querySelector('code');
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = 'Copied';
        document.getElementById('copy-status').textContent = 'Command copied to clipboard.';
      } catch (_) {
        button.textContent = 'Select text';
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        document.getElementById('copy-status').textContent = 'Copy unavailable. Command selected; use your keyboard to copy.';
      }
      setTimeout(() => { button.textContent = 'Copy'; }, 2000);
    });
  });
})();
