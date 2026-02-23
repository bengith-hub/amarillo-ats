// Amarillo ATS — Scheduled Backup to Google Drive
// Runs daily at 3:00 AM.
// 1. Downloads all entity data from JSONBin
// 2. Uploads a full backup snapshot to Google Drive
// 3. Cleans up old snapshots (keeps last 7)
// 4. Records status metadata in the backup bin for frontend monitoring
// 5. Sends alerts on failure (webhook + email)
//
// Required env vars for Google Drive backup:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Optional env vars:
//   GOOGLE_DRIVE_BACKUP_FOLDER — Drive folder ID (auto-created if missing)
//   JSONBIN_BACKUP_BIN — backup metadata bin (auto-created if missing)
//   BACKUP_ALERT_WEBHOOK — Slack/webhook URL for failure alerts
//   BACKUP_ALERT_EMAIL — email address for failure alerts

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

// ─── Helpers ────────────────────────────────────────────

async function fetchWithDelay(url, options, delayMs = 300) {
  await new Promise(r => setTimeout(r, delayMs));
  const res = await fetch(url, options);
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2000));
    return fetch(url, options);
  }
  return res;
}

// ─── Google OAuth2 ──────────────────────────────────────

async function getGoogleAccessToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    return null;
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text().catch(() => '');
    throw new Error(`Google OAuth2 token refresh failed (${tokenRes.status}): ${err}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

// ─── Google Drive ───────────────────────────────────────

async function findDriveFolder(accessToken, folderName) {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return (data.files && data.files.length > 0) ? data.files[0].id : null;
}

async function createDriveFolder(accessToken, folderName) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Failed to create Drive folder (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function getOrCreateBackupFolder(accessToken) {
  // Use env var if set
  const envFolder = process.env.GOOGLE_DRIVE_BACKUP_FOLDER;
  if (envFolder) {
    // Verify it still exists
    const checkRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${envFolder}?fields=id,trashed`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (checkRes.ok) {
      const meta = await checkRes.json();
      if (!meta.trashed) return envFolder;
    }
    console.warn('GOOGLE_DRIVE_BACKUP_FOLDER folder not found or trashed, searching by name...');
  }

  // Search by name
  const folderId = await findDriveFolder(accessToken, 'Amarillo Backups');
  if (folderId) return folderId;

  // Create it
  const newId = await createDriveFolder(accessToken, 'Amarillo Backups');
  console.log(`Backup folder created on Drive: ${newId} — Set GOOGLE_DRIVE_BACKUP_FOLDER=${newId} in env vars to speed up.`);
  return newId;
}

async function uploadToDrive(accessToken, folderId, fileName, jsonContent) {
  const boundary = 'backup_boundary_' + Date.now();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    jsonContent,
    `--${boundary}--`
  ].join('\r\n');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Drive upload failed (${res.status}): ${err}`);
  }

  return await res.json();
}

async function listDriveBackups(accessToken, folderId) {
  const query = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=50`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

async function deleteDriveFile(accessToken, fileId) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
}

// ─── Alerts ─────────────────────────────────────────────

async function sendAlertWebhook(errorMessage) {
  const webhookUrl = process.env.BACKUP_ALERT_WEBHOOK;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Amarillo ATS — Echec du backup automatique\n${new Date().toISOString()}\nErreur : ${errorMessage}`,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Amarillo ATS — Echec du backup automatique*\n${new Date().toISOString()}\nErreur : ${errorMessage}`
          }
        }]
      })
    });
    console.log('Alert webhook sent');
  } catch (e) {
    console.error('Failed to send alert webhook:', e.message);
  }
}

async function sendAlertEmail(errorMessage) {
  let accessToken;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (_) {
    return;
  }
  if (!accessToken) return;

  const alertEmail = process.env.BACKUP_ALERT_EMAIL || 'benjamin.fetu@amarillosearch.com';

  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const subject = `[Amarillo ATS] Echec du backup automatique — ${dateStr}`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#dc2626;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">Amarillo ATS — Alerte Backup</h2>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p style="color:#dc2626;font-weight:600;font-size:16px;margin-top:0;">Le backup automatique a echoue</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Date</td><td style="padding:8px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Erreur</td><td style="padding:8px 0;color:#dc2626;font-weight:600;">${errorMessage}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:14px;margin-bottom:0;">
            Verifiez la configuration dans <strong>Netlify > Site settings > Environment variables</strong>
            et consultez les logs dans <strong>Netlify > Functions</strong>.
          </p>
        </div>
      </div>
    `;

    const mimeMessage = [
      `To: ${alertEmail}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(htmlBody)))
    ].join('\r\n');

    const raw = btoa(mimeMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (sendRes.ok) {
      console.log('Alert email sent to', alertEmail);
    } else {
      console.error('Failed to send alert email:', sendRes.status);
    }
  } catch (e) {
    console.error('Failed to send alert email:', e.message);
  }
}

// ─── JSONBin backup bin ─────────────────────────────────

async function getOrCreateBackupBin(apiKey) {
  const envBin = process.env.JSONBIN_BACKUP_BIN;
  if (envBin) return envBin;

  console.log('JSONBIN_BACKUP_BIN not set — creating backup bin...');
  const res = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': apiKey,
      'X-Bin-Name': 'amarillo-backups'
    },
    body: JSON.stringify({ snapshots: [], status: {} })
  });

  if (!res.ok) throw new Error(`Failed to create backup bin: ${res.status}`);

  const data = await res.json();
  const binId = data.metadata.id;
  console.log(`Backup bin created: ${binId} — Set JSONBIN_BACKUP_BIN=${binId} in Netlify env vars.`);
  return binId;
}

// ─── Main handler ───────────────────────────────────────

export default async function handler(req) {
  const apiKey = process.env.JSONBIN_API_KEY || '$2a$10$FvDIogJwH4l87MiEdExg6udcabOSwaFpjoL1xTc5KQgUojd6JA4Be';
  const headers = { 'X-Master-Key': apiKey };

  // 1. Get/create backup metadata bin
  let backupBin;
  try {
    backupBin = await getOrCreateBackupBin(apiKey);
  } catch (e) {
    const errMsg = `Cannot get/create backup bin: ${e.message}`;
    console.error(errMsg);
    await Promise.all([sendAlertWebhook(errMsg), sendAlertEmail(errMsg)]);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }

  // 2. Read existing metadata
  let meta = { snapshots: [], status: {} };
  try {
    const backupRes = await fetchWithDelay(`${JSONBIN_BASE}/${backupBin}/latest`, { headers });
    if (backupRes.ok) {
      const backupData = await backupRes.json();
      meta = backupData.record || { snapshots: [], status: {} };
      if (!meta.status) meta.status = {};
      if (!meta.snapshots) meta.snapshots = [];
    }
  } catch (e) {
    console.warn('Could not read backup bin:', e.message);
  }

  try {
    // 3. Download all entity data from JSONBin
    const data = {};
    const counts = {};
    const errors = [];

    for (const [entity, cfg] of Object.entries(ENTITY_BINS)) {
      const binId = process.env[cfg.env] || cfg.default;
      const res = await fetchWithDelay(`${JSONBIN_BASE}/${binId}/latest`, { headers });

      if (!res.ok) {
        console.warn(`Failed to fetch ${entity}: ${res.status}`);
        errors.push(`${entity}: ${res.status}`);
        data[entity] = [];
        counts[entity] = 0;
        continue;
      }

      const result = await res.json();
      const records = result.record || [];
      data[entity] = Array.isArray(records) ? records : [];
      counts[entity] = data[entity].length;
    }

    if (errors.length > 0) {
      throw new Error(`Bins inaccessibles : ${errors.join(', ')}`);
    }

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`Downloaded ${totalRecords} records across ${Object.keys(counts).length} entities`);

    // 4. Upload to Google Drive
    let driveFileId = null;
    let driveFileName = null;
    let driveUploadOk = false;

    const accessToken = await getGoogleAccessToken();

    if (accessToken) {
      try {
        const folderId = await getOrCreateBackupFolder(accessToken);

        const snapshotId = 'snap_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toISOString().slice(11, 16).replace(':', 'h');
        driveFileName = `amarillo-snapshot-${dateStr}-${timeStr}.json`;

        const backup = {
          _meta: {
            version: '1.0',
            id: snapshotId,
            date: now.toISOString(),
            source: 'scheduled',
            counts
          },
          data
        };

        const jsonContent = JSON.stringify(backup);
        const uploaded = await uploadToDrive(accessToken, folderId, driveFileName, jsonContent);
        driveFileId = uploaded.id;
        driveUploadOk = true;

        console.log(`Backup uploaded to Drive: ${driveFileName} (${uploaded.id})`);

        // 5. Add snapshot to metadata
        meta.snapshots.unshift({
          id: snapshotId,
          date: now.toISOString(),
          source: 'scheduled',
          counts,
          driveFileId: uploaded.id,
          driveFileName
        });

        // 6. Clean up old snapshots (keep last MAX_SNAPSHOTS)
        if (meta.snapshots.length > MAX_SNAPSHOTS) {
          const toRemove = meta.snapshots.splice(MAX_SNAPSHOTS);
          for (const old of toRemove) {
            if (old.driveFileId) {
              try {
                await deleteDriveFile(accessToken, old.driveFileId);
                console.log(`Deleted old snapshot from Drive: ${old.driveFileName || old.driveFileId}`);
              } catch (e) {
                console.warn(`Could not delete old Drive file ${old.driveFileId}:`, e.message);
              }
            }
          }
        }
      } catch (e) {
        console.error('Google Drive upload failed:', e.message);
        // Continue — still record status as health-check-only success
      }
    } else {
      console.log('Google Drive not configured (missing GOOGLE_REFRESH_TOKEN/CLIENT_ID/CLIENT_SECRET) — skipping Drive upload, health check only.');
    }

    // 7. Update status metadata
    const now = new Date().toISOString();
    meta.status = {
      last_success: now,
      last_run: now,
      result: 'ok',
      error: null,
      counts,
      drive_backup: driveUploadOk,
      drive_file: driveFileName
    };

    // 8. Save metadata to JSONBin
    await new Promise(r => setTimeout(r, 500));
    const saveRes = await fetch(`${JSONBIN_BASE}/${backupBin}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
      },
      body: JSON.stringify(meta)
    });

    if (!saveRes.ok) {
      throw new Error(`Failed to save backup status: ${saveRes.status}`);
    }

    console.log(`Backup complete: ${totalRecords} records, Drive upload: ${driveUploadOk ? 'OK' : 'skipped'}, snapshots: ${meta.snapshots.length}`);

    return new Response(JSON.stringify({
      status: 'ok',
      totalRecords,
      counts,
      driveBackup: driveUploadOk,
      driveFile: driveFileName,
      snapshotsOnDrive: meta.snapshots.length
    }));

  } catch (error) {
    console.error('scheduled-backup error:', error);

    // Record failure
    meta.status = {
      ...meta.status,
      last_run: new Date().toISOString(),
      result: 'error',
      error: error.message
    };

    try {
      await fetch(`${JSONBIN_BASE}/${backupBin}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
        body: JSON.stringify(meta)
      });
    } catch (_) {
      console.error('Could not save error status');
    }

    await Promise.all([sendAlertWebhook(error.message), sendAlertEmail(error.message)]);

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export const config = {
  schedule: "0 3 * * *" // Daily at 3:00 AM
};
