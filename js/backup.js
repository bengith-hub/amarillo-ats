// Amarillo ATS — Backup & Restore Module
// Export/import local JSON, Google Drive backup, JSONBin snapshots.

const Backup = (() => {

  const ENTITIES = ['candidats', 'entreprises', 'decideurs', 'missions', 'actions', 'facturation', 'references', 'notes'];
  const MAX_SNAPSHOTS = 7;
  const LS_DRIVE_FOLDER = 'ats_backup_drive_folder';
  const LS_LAST_BACKUP = 'ats_last_backup_date';

  // ─── Export local ───────────────────────────────────────

  function exportAll() {
    const data = {};
    const counts = {};
    for (const entity of ENTITIES) {
      data[entity] = Store.get(entity);
      counts[entity] = data[entity].length;
    }

    const backup = {
      _meta: {
        version: '1.0',
        date: new Date().toISOString(),
        source: 'manual',
        counts
      },
      data
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `amarillo-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    localStorage.setItem(LS_LAST_BACKUP, now);
    localStorage.setItem('ats_backup_last_success', now);
    return counts;
  }

  // ─── Import / Parse file ────────────────────────────────

  function parseBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const result = validateBackup(parsed);
          resolve(result);
        } catch (err) {
          reject(new Error('Fichier JSON invalide : ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsText(file);
    });
  }

  function validateBackup(parsed) {
    const data = parsed.data || parsed;
    const counts = {};
    let totalRecords = 0;

    for (const entity of ENTITIES) {
      if (data[entity] && Array.isArray(data[entity])) {
        counts[entity] = data[entity].length;
        totalRecords += data[entity].length;
      } else {
        counts[entity] = 0;
      }
    }

    if (totalRecords === 0) {
      throw new Error('Aucune donnée reconnue dans le fichier');
    }

    return {
      data,
      meta: parsed._meta || null,
      counts,
      totalRecords
    };
  }

  // ─── Restore from data ─────────────────────────────────

  async function restoreFromData(data, onProgress) {
    let restored = 0;
    const total = ENTITIES.filter(e => data[e] && data[e].length > 0).length;

    for (const entity of ENTITIES) {
      if (!data[entity] || !Array.isArray(data[entity])) continue;

      if (onProgress) onProgress(entity, restored, total);

      await API.updateBin(entity, data[entity]);
      // Update local cache
      const key = `ats_data_${entity}`;
      localStorage.setItem(key, JSON.stringify({
        data: data[entity],
        timestamp: Date.now()
      }));

      restored++;
      await new Promise(r => setTimeout(r, 500)); // rate limit
    }

    if (onProgress) onProgress(null, restored, total);
    return restored;
  }

  // ─── Google Drive backup ────────────────────────────────

  async function _getOrCreateBackupFolder() {
    const savedId = localStorage.getItem(LS_DRIVE_FOLDER);

    // Verify saved folder still exists
    if (savedId) {
      try {
        const token = GoogleAuth.getAccessToken();
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${savedId}?fields=id,trashed`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const meta = await res.json();
          if (!meta.trashed) return savedId;
        }
      } catch (_) { /* folder gone, recreate */ }
    }

    const folder = await GoogleDrive.createFolder('Amarillo Backups');
    localStorage.setItem(LS_DRIVE_FOLDER, folder.id);
    return folder.id;
  }

  async function backupToGoogleDrive() {
    await GoogleAuth.authenticate();

    const folderId = await _getOrCreateBackupFolder();

    // Build backup data
    const data = {};
    const counts = {};
    for (const entity of ENTITIES) {
      data[entity] = Store.get(entity);
      counts[entity] = data[entity].length;
    }

    const backup = {
      _meta: {
        version: '1.0',
        date: new Date().toISOString(),
        source: 'google-drive',
        counts
      },
      data
    };

    const json = JSON.stringify(backup);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 16).replace(':', 'h');
    const fileName = `amarillo-backup-${dateStr}-${timeStr}.json`;

    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    const result = await GoogleDrive.uploadFile(file, folderId);

    const savedAt = new Date().toISOString();
    localStorage.setItem(LS_LAST_BACKUP, savedAt);
    localStorage.setItem('ats_backup_last_success', savedAt);

    return {
      fileName,
      url: result.url,
      counts
    };
  }

  async function listDriveBackups() {
    await GoogleAuth.authenticate();

    const folderId = localStorage.getItem(LS_DRIVE_FOLDER);
    if (!folderId) return [];

    const token = GoogleAuth.getAccessToken();
    const query = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=20`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error('Impossible de lister les backups Drive');
    const result = await res.json();
    return result.files || [];
  }

  async function restoreFromDrive(fileId) {
    await GoogleAuth.authenticate();

    const downloaded = await GoogleDrive.downloadFile(fileId);
    const text = await downloaded.blob.text();
    const parsed = JSON.parse(text);
    const validated = validateBackup(parsed);

    return validated;
  }

  // ─── Snapshots (Google Drive + JSONBin status) ─────────
  // Full snapshot data → Google Drive (no size limit)
  // Lightweight metadata + status → JSONBin (for monitoring dashboard)

  async function _getBackupsBin() {
    let binId = ATS_CONFIG.bins.backups;

    if (!binId) {
      // Check localStorage first (may have been created in a previous session)
      try {
        const saved = localStorage.getItem('ats_config');
        if (saved) {
          const cfg = JSON.parse(saved);
          if (cfg.bins && cfg.bins.backups) {
            binId = cfg.bins.backups;
            ATS_CONFIG.bins.backups = binId;
            const apiCfg = API.getConfig();
            apiCfg.bins = apiCfg.bins || {};
            apiCfg.bins.backups = binId;
            API.saveConfig(apiCfg);
            return binId;
          }
        }
      } catch (_) {}

      // Create the backup bin on first use (lightweight, metadata only)
      const res = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': ATS_CONFIG.apiKey,
          'X-Bin-Name': 'ats-backups'
        },
        body: JSON.stringify({ snapshots: [], status: {} })
      });

      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).message || ''; } catch (_) {}
        throw new Error(`Impossible de créer le bin backup (${res.status}) : ${detail}`);
      }

      const created = await res.json();
      binId = created.metadata.id;
      ATS_CONFIG.bins.backups = binId;

      // Sync to API module and localStorage
      const apiCfg = API.getConfig();
      apiCfg.bins = apiCfg.bins || {};
      apiCfg.bins.backups = binId;
      API.saveConfig(apiCfg);

      console.log('Backup bin created:', binId);
    }

    return binId;
  }

  async function _fetchBackupMeta() {
    const binId = await _getBackupsBin();
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': ATS_CONFIG.apiKey }
    });

    if (!res.ok) {
      if (res.status === 404) return { snapshots: [], status: {} };
      throw new Error(`Erreur lecture backup metadata : ${res.status}`);
    }

    const result = await res.json();
    return result.record || { snapshots: [], status: {} };
  }

  async function _saveBackupMeta(meta) {
    const binId = await _getBackupsBin();
    const payload = JSON.stringify(meta);

    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': ATS_CONFIG.apiKey
      },
      body: payload
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (_) {}
      console.error(`Backup meta save failed: ${res.status} — ${detail}`);
      throw new Error(`Sauvegarde métadonnées échouée (${res.status}) : ${detail || 'erreur inconnue'}`);
    }
    return true;
  }

  async function createSnapshot(source = 'manual') {
    // Require Google Drive for snapshot storage
    if (!GoogleAuth.isConfigured()) {
      throw new Error('Configurez Google (Drive) dans Configuration API pour utiliser les snapshots.');
    }
    await GoogleAuth.authenticate();

    const data = {};
    const counts = {};

    for (const entity of ENTITIES) {
      data[entity] = Store.get(entity);
      counts[entity] = data[entity].length;
      await new Promise(r => setTimeout(r, 300));
    }

    const snapshotId = 'snap_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const snapshotDate = new Date().toISOString();

    // 1. Upload full data to Google Drive
    const backup = {
      _meta: {
        version: '1.0',
        id: snapshotId,
        date: snapshotDate,
        source,
        counts
      },
      data
    };

    const folderId = await _getOrCreateBackupFolder();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 16).replace(':', 'h');
    const fileName = `amarillo-snapshot-${dateStr}-${timeStr}.json`;

    const json = JSON.stringify(backup);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    const driveResult = await GoogleDrive.uploadFile(file, folderId);

    // 2. Save lightweight metadata to JSONBin (no data field — stays small)
    const meta = await _fetchBackupMeta();
    meta.snapshots.unshift({
      id: snapshotId,
      date: snapshotDate,
      source,
      counts,
      driveFileId: driveResult.id,
      driveFileName: fileName
    });

    // Keep only last N snapshot references
    if (meta.snapshots.length > MAX_SNAPSHOTS) {
      meta.snapshots = meta.snapshots.slice(0, MAX_SNAPSHOTS);
    }

    // Update status for monitoring
    meta.status = {
      last_success: snapshotDate,
      last_run: snapshotDate,
      result: 'ok',
      error: null
    };

    await _saveBackupMeta(meta);

    localStorage.setItem('ats_backup_last_success', snapshotDate);
    localStorage.setItem(LS_LAST_BACKUP, snapshotDate);
    localStorage.removeItem('ats_backup_last_error');

    return { id: snapshotId, date: snapshotDate, source, counts, fileName };
  }

  async function listSnapshots() {
    const meta = await _fetchBackupMeta();
    return (meta.snapshots || []).map(s => ({
      id: s.id,
      date: s.date,
      source: s.source,
      counts: s.counts,
      driveFileId: s.driveFileId,
      driveFileName: s.driveFileName
    }));
  }

  async function getSnapshot(snapshotId) {
    // Find the snapshot metadata
    const meta = await _fetchBackupMeta();
    const snap = (meta.snapshots || []).find(s => s.id === snapshotId);
    if (!snap) return null;
    if (!snap.driveFileId) throw new Error('Ce snapshot n\'a pas de fichier Drive associé.');

    // Download full data from Google Drive
    await GoogleAuth.authenticate();
    const downloaded = await GoogleDrive.downloadFile(snap.driveFileId);
    const text = await downloaded.blob.text();
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;

    return {
      id: snap.id,
      date: snap.date,
      source: snap.source,
      counts: snap.counts,
      data
    };
  }

  // ─── Utilities ──────────────────────────────────────────

  function getLastBackupDate() {
    return localStorage.getItem(LS_LAST_BACKUP) || null;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return Math.round(kb) + ' Ko';
    return (kb / 1024).toFixed(1) + ' Mo';
  }

  return {
    exportAll,
    parseBackupFile,
    restoreFromData,
    backupToGoogleDrive,
    listDriveBackups,
    restoreFromDrive,
    createSnapshot,
    listSnapshots,
    getSnapshot,
    getLastBackupDate,
    formatDate,
    formatSize,
    ENTITIES
  };

})();
