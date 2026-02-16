(function () {
  function replaceImageWithAlt(img) {
    if (!img || img.dataset.fallbackApplied === 'true') return;
    const altText = (img.getAttribute('alt') || 'Image').trim();
    const fallback = document.createElement('span');
    fallback.className = 'rx-img-fallback';
    fallback.textContent = altText;
    img.dataset.fallbackApplied = 'true';
    img.replaceWith(fallback);
  }

  document.querySelectorAll('img[data-fallback="alt"]').forEach((img) => {
    img.addEventListener('error', () => replaceImageWithAlt(img));
    if (img.complete && img.naturalWidth === 0) replaceImageWithAlt(img);
  });

  const navToggle = document.getElementById('rxAdminNavToggle');
  const nav = document.getElementById('rxAdminNav');

  function setNavOpen(isOpen) {
    if (!navToggle || !nav) return;
    navToggle.setAttribute('aria-expanded', String(isOpen));
    nav.classList.toggle('rx-open', isOpen);
  }

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      setNavOpen(!isOpen);
    });
  }

  const actions = document.getElementById('rxAdminActions');

  function switchPanel(panelName) {
    document.querySelectorAll('.rx-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'panel-' + panelName);
    });

    document.querySelectorAll('.rx-action-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panel === panelName);
    });
  }

  if (actions) {
    actions.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-panel]');
      if (!btn) return;

      const panel = btn.dataset.panel;
      if (panel === 'logout') {
        // UI only: redirect to login if available.
        window.location.href = '/logout';
        return;
      }

      switchPanel(panel);
    });
  }

  const topbarDashboard = document.getElementById('rxTopbarDashboard');
  if (topbarDashboard) {
    topbarDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      switchPanel('overview');
      setNavOpen(false);
    });
  }

  const topbarLogout = document.getElementById('rxTopbarLogout');
  if (topbarLogout) {
    topbarLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/logout';
    });
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 720) setNavOpen(false);
  });

  // Default panel
  switchPanel('overview');
})();
