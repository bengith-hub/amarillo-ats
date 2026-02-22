// Amarillo ATS — Backup Monitor
// Shows a warning banner on every page if no successful backup in the last 48 hours.
// Reads the backup status from the JSONBin backup bin.

const BackupMonitor = (() => {

  const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Re-check every hour
  const LS_STATUS_KEY = 'ats_backup_status_cache';
  const LS_DISMISSED_KEY = 'ats_backup_alert_dismissed';

  let _bannerEl = null;

  function _getCachedStatus() {
    try {
      const raw = localStorage.getItem(LS_STATUS_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      // Cache valid for 1 hour
      if (Date.now() - cached._fetchedAt < CHECK_INTERVAL_MS) return cached;
    } catch (_) {}
    return null;
  }

  function _cacheStatus(status) {
    try {
      localStorage.setItem(LS_STATUS_KEY, JSON.stringify({ ...status, _fetchedAt: Date.now() }));
    } catch (_) {}
  }

  async function fetchBackupStatus() {
    // Use cached if fresh enough
    const cached = _getCachedStatus();
    if (cached) return cached;

    const backupBinId = (typeof ATS_CONFIG !== 'undefined' && ATS_CONFIG.bins && ATS_CONFIG.bins.backups)
      ? ATS_CONFIG.bins.backups : '';

    if (!backupBinId) return null;

    const apiKey = (typeof ATS_CONFIG !== 'undefined' && ATS_CONFIG.apiKey) ? ATS_CONFIG.apiKey : '';
    if (!apiKey) return null;

    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${backupBinId}/latest`, {
        headers: { 'X-Master-Key': apiKey }
      });

      if (!res.ok) return null;

      const data = await res.json();
      const record = data.record || {};
      const status = record.status || {};

      _cacheStatus(status);
      return status;
    } catch (_) {
      return null;
    }
  }

  function isBackupStale(status) {
    if (!status || !status.last_success) return true;

    const lastSuccess = new Date(status.last_success).getTime();
    return (Date.now() - lastSuccess) > STALE_THRESHOLD_MS;
  }

  function _formatTimeAgo(isoStr) {
    if (!isoStr) return 'jamais';
    const diff = Date.now() - new Date(isoStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  }

  function _createBanner(status) {
    if (_bannerEl) return;

    const lastSuccess = status && status.last_success
      ? _formatTimeAgo(status.last_success)
      : 'jamais';

    const hasError = status && status.result === 'error';
    const errorMsg = hasError && status.error ? ` — Erreur : ${status.error}` : '';

    const banner = document.createElement('div');
    banner.id = 'backup-alert-banner';
    banner.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        color: #fff; padding: 10px 24px;
        display: flex; align-items: center; justify-content: center; gap: 12px;
        font-family: Inter, sans-serif; font-size: 0.8125rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        animation: backupBannerSlide 0.3s ease-out;
      ">
        <span style="font-size:1.1rem;">&#9888;&#65039;</span>
        <span>
          <strong>Backup en panne</strong> — Dernier backup r&eacute;ussi : ${lastSuccess}${errorMsg}.
          <a href="referentiels.html" style="color:#fecaca;text-decoration:underline;margin-left:4px;">V&eacute;rifier</a>
        </span>
        <button id="backup-alert-dismiss" style="
          background: rgba(255,255,255,0.2); border: none; color: #fff;
          padding: 4px 12px; border-radius: 4px; cursor: pointer;
          font-size: 0.75rem; margin-left: 8px; flex-shrink: 0;
        ">Fermer</button>
      </div>
    `;

    // Add slide animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes backupBannerSlide {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #backup-alert-banner + .main-content,
      #backup-alert-banner ~ .main-content { padding-top: calc(var(--topbar-height, 60px) + 40px) !important; }
      body.has-backup-alert .main-content { margin-top: 40px; }
    `;
    document.head.appendChild(style);
    document.body.prepend(banner);
    document.body.classList.add('has-backup-alert');
    _bannerEl = banner;

    // Dismiss handler — hide for 24h
    document.getElementById('backup-alert-dismiss').addEventListener('click', () => {
      banner.remove();
      document.body.classList.remove('has-backup-alert');
      _bannerEl = null;
      localStorage.setItem(LS_DISMISSED_KEY, Date.now().toString());
    });
  }

  function _isDismissed() {
    const dismissed = localStorage.getItem(LS_DISMISSED_KEY);
    if (!dismissed) return false;
    // Re-show after 24h
    return (Date.now() - parseInt(dismissed)) < 24 * 60 * 60 * 1000;
  }

  async function check() {
    if (_isDismissed()) return;

    const status = await fetchBackupStatus();
    // If no backup bin configured, don't show alert (backup not set up yet)
    if (status === null) return;

    if (isBackupStale(status)) {
      _createBanner(status);
    }
  }

  // Auto-check when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(check, 2000));
  } else {
    setTimeout(check, 2000);
  }

  return { check, fetchBackupStatus, isBackupStale };

})();
