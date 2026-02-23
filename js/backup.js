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

  // ─── JSONBin Snapshots ──────────────────────────────────

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

      // Create the backup bin on first use
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

    // Ensure API module knows about this bin
    const apiCfg = API.getConfig();
    if (!apiCfg.bins.backups) {
      apiCfg.bins.backups = binId;
      API.saveConfig(apiCfg);
    }

    return binId;
  }

  async function _fetchSnapshots() {
    const binId = await _getBackupsBin();
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': ATS_CONFIG.apiKey }
    });

    if (!res.ok) {
      if (res.status === 404) return { snapshots: [] };
      throw new Error(`Erreur lecture snapshots : ${res.status}`);
    }

    const result = await res.json();
    return result.record || { snapshots: [] };
  }

  async function _saveSnapshots(container) {
    const binId = await _getBackupsBin();
    const payload = JSON.stringify(container);
    const sizeKB = Math.round(payload.length / 1024);
    console.log(`Saving snapshots to ${binId}, payload: ${sizeKB} KB`);

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
      console.error(`Snapshot save failed: ${res.status} — ${detail} (payload: ${sizeKB} KB)`);
      throw new Error(`Sauvegarde snapshot échouée (${res.status}) : ${detail || 'erreur inconnue'}`);
    }
    return true;
  }

  async function createSnapshot(source = 'manual') {
    const data = {};
    const counts = {};

    // Fetch fresh data from JSONBin for accuracy
    for (const entity of ENTITIES) {
      data[entity] = Store.get(entity);
      counts[entity] = data[entity].length;
      await new Promise(r => setTimeout(r, 300));
    }

    const snapshot = {
      id: 'snap_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      date: new Date().toISOString(),
      source,
      counts,
      data
    };

    const container = await _fetchSnapshots();
    container.snapshots.unshift(snapshot);

    // Keep only last N snapshots
    if (container.snapshots.length > MAX_SNAPSHOTS) {
      container.snapshots = container.snapshots.slice(0, MAX_SNAPSHOTS);
    }

    // Update status for monitoring
    container.status = {
      last_success: new Date().toISOString(),
      last_run: new Date().toISOString(),
      result: 'ok',
      error: null
    };

    await _saveSnapshots(container);

    localStorage.setItem('ats_backup_last_success', new Date().toISOString());
    localStorage.removeItem('ats_backup_last_error');

    return snapshot;
  }

  async function listSnapshots() {
    const container = await _fetchSnapshots();
    // Return without the heavy data field
    return (container.snapshots || []).map(s => ({
      id: s.id,
      date: s.date,
      source: s.source,
      counts: s.counts
    }));
  }

  async function getSnapshot(snapshotId) {
    const container = await _fetchSnapshots();
    return (container.snapshots || []).find(s => s.id === snapshotId) || null;
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
