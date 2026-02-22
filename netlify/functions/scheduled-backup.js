// Amarillo ATS — Scheduled Backup Function
// Runs daily at 3:00 AM to create a data snapshot in a dedicated backup bin.
// Keeps the last 7 snapshots with automatic rotation.

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';
const MAX_SNAPSHOTS = 7;

// All entity bins (same values as config.js, overridable via env vars)
const ENTITY_BINS = {
  candidats:    { env: 'JSONBIN_CANDIDATS_BIN',    default: '698a4deeae596e708f1e4f33' },
  entreprises:  { env: 'JSONBIN_ENTREPRISES_BIN',  default: '698a4deed0ea881f40ade47b' },
  decideurs:    { env: 'JSONBIN_DECIDEURS_BIN',    default: '698a4deeae596e708f1e4f36' },
  missions:     { env: 'JSONBIN_MISSIONS_BIN',     default: '698a4defd0ea881f40ade47f' },
  actions:      { env: 'JSONBIN_ACTIONS_BIN',       default: '698a4defd0ea881f40ade482' },
  facturation:  { env: 'JSONBIN_FACTURATION_BIN',  default: '698a4e0043b1c97be9727eb2' },
  references:   { env: 'JSONBIN_REFERENCES_BIN',   default: '698a4e0143b1c97be9727eb5' },
  notes:        { env: 'JSONBIN_NOTES_BIN',         default: '698a4df143b1c97be9727ea2' }
};

async function fetchWithDelay(url, options, delayMs = 300) {
  await new Promise(r => setTimeout(r, delayMs));
  const res = await fetch(url, options);
  if (res.status === 429) {
    // Rate limited — wait and retry once
    await new Promise(r => setTimeout(r, 2000));
    return fetch(url, options);
  }
  return res;
}

export default async function handler(req) {
  const apiKey = process.env.JSONBIN_API_KEY || '$2a$10$FvDIogJwH4l87MiEdExg6udcabOSwaFpjoL1xTc5KQgUojd6JA4Be';
  const backupBin = process.env.JSONBIN_BACKUP_BIN;

  if (!backupBin) {
    console.error('JSONBIN_BACKUP_BIN not configured');
    return new Response(JSON.stringify({
      error: 'JSONBIN_BACKUP_BIN environment variable not set'
    }), { status: 500 });
  }

  const headers = { 'X-Master-Key': apiKey };

  try {
    // 1. Fetch all entities
    const data = {};
    const counts = {};

    for (const [entity, cfg] of Object.entries(ENTITY_BINS)) {
      const binId = process.env[cfg.env] || cfg.default;

      const res = await fetchWithDelay(`${JSONBIN_BASE}/${binId}/latest`, { headers });
      if (!res.ok) {
        console.warn(`Failed to fetch ${entity}: ${res.status}`);
        data[entity] = [];
        counts[entity] = 0;
        continue;
      }

      const result = await res.json();
      data[entity] = result.record || [];
      counts[entity] = data[entity].length;
    }

    // 2. Read existing snapshots from backup bin
    let container = { snapshots: [] };
    const backupRes = await fetchWithDelay(`${JSONBIN_BASE}/${backupBin}/latest`, { headers });

    if (backupRes.ok) {
      const backupData = await backupRes.json();
      container = backupData.record || { snapshots: [] };
    }

    // 3. Create new snapshot
    const snapshot = {
      id: 'snap_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      date: new Date().toISOString(),
      source: 'cron',
      counts,
      data
    };

    container.snapshots.unshift(snapshot);

    // 4. Rotate — keep only last N snapshots
    if (container.snapshots.length > MAX_SNAPSHOTS) {
      container.snapshots = container.snapshots.slice(0, MAX_SNAPSHOTS);
    }

    // 5. Save back to backup bin
    await new Promise(r => setTimeout(r, 500));
    const saveRes = await fetch(`${JSONBIN_BASE}/${backupBin}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
      },
      body: JSON.stringify(container)
    });

    if (!saveRes.ok) {
      throw new Error(`Failed to save backup: ${saveRes.status}`);
    }

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log(`Backup snapshot created: ${snapshot.id} (${totalRecords} records, ${container.snapshots.length} snapshots total)`);

    return new Response(JSON.stringify({
      snapshotId: snapshot.id,
      totalRecords,
      snapshotsCount: container.snapshots.length,
      counts
    }));

  } catch (error) {
    console.error('scheduled-backup error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export const config = {
  schedule: "0 3 * * *" // Daily at 3:00 AM
};
