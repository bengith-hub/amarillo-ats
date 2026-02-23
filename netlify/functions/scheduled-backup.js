// Amarillo ATS — Scheduled Backup Status Check
// Runs daily at 3:00 AM to verify all entity bins are accessible.
// Records lightweight status metadata in the backup bin for frontend monitoring.
// Full snapshot data is stored on Google Drive (from the frontend UI).
// Sends alert via webhook on failure (if BACKUP_ALERT_WEBHOOK is configured).
// Sends alert email via Gmail API on failure (if GOOGLE_REFRESH_TOKEN is configured).

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

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

// Send alert to configured webhook on failure
async function sendAlertWebhook(errorMessage) {
  const webhookUrl = process.env.BACKUP_ALERT_WEBHOOK;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `⚠️ Amarillo ATS — Échec du backup automatique\n${new Date().toISOString()}\nErreur : ${errorMessage}`,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Amarillo ATS — Échec du backup automatique*\n📅 ${new Date().toISOString()}\n❌ Erreur : ${errorMessage}`
          }
        }]
      })
    });
    console.log('Alert webhook sent successfully');
  } catch (e) {
    console.error('Failed to send alert webhook:', e.message);
  }
}

// Send alert email via Gmail API using OAuth2 refresh token
async function sendAlertEmail(errorMessage) {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const alertEmail = process.env.BACKUP_ALERT_EMAIL || 'benjamin.fetu@amarillosearch.com';

  if (!refreshToken || !clientId || !clientSecret) {
    console.log('Gmail alert not configured (missing GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_SECRET)');
    return;
  }

  try {
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
      console.error('Failed to refresh Gmail token:', tokenRes.status);
      return;
    }

    const { access_token } = await tokenRes.json();

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
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (sendRes.ok) {
      console.log('Alert email sent successfully to', alertEmail);
    } else {
      console.error('Failed to send alert email:', sendRes.status);
    }
  } catch (e) {
    console.error('Failed to send alert email:', e.message);
  }
}

// Auto-create backup bin if none configured
async function getOrCreateBackupBin(apiKey) {
  const envBin = process.env.JSONBIN_BACKUP_BIN;
  if (envBin) return envBin;

  console.log('JSONBIN_BACKUP_BIN not set — creating backup bin automatically...');
  const res = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': apiKey,
      'X-Bin-Name': 'amarillo-backups'
    },
    body: JSON.stringify({ snapshots: [], status: {} })
  });

  if (!res.ok) {
    throw new Error(`Failed to create backup bin: ${res.status}`);
  }

  const data = await res.json();
  const binId = data.metadata.id;
  console.log(`Backup bin created: ${binId} — Add JSONBIN_BACKUP_BIN=${binId} to Netlify env vars to avoid re-creation.`);
  return binId;
}

export default async function handler(req) {
  const apiKey = process.env.JSONBIN_API_KEY || '$2a$10$FvDIogJwH4l87MiEdExg6udcabOSwaFpjoL1xTc5KQgUojd6JA4Be';

  let backupBin;
  try {
    backupBin = await getOrCreateBackupBin(apiKey);
  } catch (e) {
    const errMsg = `Cannot get/create backup bin: ${e.message}`;
    console.error(errMsg);
    await Promise.all([
      sendAlertWebhook(errMsg),
      sendAlertEmail(errMsg)
    ]);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }

  const headers = { 'X-Master-Key': apiKey };

  // Read existing metadata from backup bin
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
    // Verify all entity bins are accessible and count records
    const counts = {};
    let errors = [];

    for (const [entity, cfg] of Object.entries(ENTITY_BINS)) {
      const binId = process.env[cfg.env] || cfg.default;

      const res = await fetchWithDelay(`${JSONBIN_BASE}/${binId}/latest`, { headers });
      if (!res.ok) {
        console.warn(`Failed to fetch ${entity}: ${res.status}`);
        errors.push(`${entity}: ${res.status}`);
        counts[entity] = 0;
        continue;
      }

      const result = await res.json();
      const records = result.record || [];
      counts[entity] = Array.isArray(records) ? records.length : 0;
    }

    if (errors.length > 0) {
      throw new Error(`Bins inaccessibles : ${errors.join(', ')}`);
    }

    // Update status — success (lightweight, no full data)
    const now = new Date().toISOString();
    meta.status = {
      last_success: now,
      last_run: now,
      result: 'ok',
      error: null,
      counts
    };

    // Save lightweight metadata back to backup bin
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

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log(`Backup check OK: ${totalRecords} records across ${Object.keys(counts).length} entities`);

    return new Response(JSON.stringify({
      status: 'ok',
      totalRecords,
      counts,
      snapshotsOnDrive: meta.snapshots.length
    }));

  } catch (error) {
    console.error('scheduled-backup error:', error);

    // Record failure status
    meta.status = {
      ...meta.status,
      last_run: new Date().toISOString(),
      result: 'error',
      error: error.message
    };

    // Try to save error status
    try {
      await fetch(`${JSONBIN_BASE}/${backupBin}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify(meta)
      });
    } catch (_) {
      console.error('Could not even save error status');
    }

    // Send alerts
    await Promise.all([
      sendAlertWebhook(error.message),
      sendAlertEmail(error.message)
    ]);

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export const config = {
  schedule: "0 3 * * *" // Daily at 3:00 AM
};
