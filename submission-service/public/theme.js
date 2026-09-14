try {
  const theme = localStorage.getItem('rlebench-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch { /* The saved theme is optional. */ }
