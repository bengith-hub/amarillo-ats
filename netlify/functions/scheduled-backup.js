// Amarillo ATS — Scheduled Backup Function
// Runs daily at 3:00 AM to create a data snapshot in a dedicated backup bin.
// Keeps the last 7 snapshots with automatic rotation.
// Records backup status for frontend monitoring.
// Sends alert via webhook on failure (if BACKUP_ALERT_WEBHOOK is configured).
// Sends alert email via Gmail API on failure (if GOOGLE_REFRESH_TOKEN is configured).

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
        // Slack-compatible format
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
    // 1. Exchange refresh token for access token
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

    // 2. Build email
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

    // 3. Send via Gmail API
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

// Update backup status metadata in the backup bin
async function updateBackupStatus(backupBin, apiKey, status, container) {
  container.status = status;

  try {
    await fetch(`${JSONBIN_BASE}/${backupBin}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
      },
      body: JSON.stringify(container)
    });
  } catch (e) {
    console.error('Failed to update backup status:', e.message);
  }
}

export default async function handler(req) {
  const apiKey = process.env.JSONBIN_API_KEY || '$2a$10$FvDIogJwH4l87MiEdExg6udcabOSwaFpjoL1xTc5KQgUojd6JA4Be';
  const backupBin = process.env.JSONBIN_BACKUP_BIN;

  if (!backupBin) {
    const errMsg = 'JSONBIN_BACKUP_BIN environment variable not set';
    console.error(errMsg);
    await Promise.all([
      sendAlertWebhook(errMsg),
      sendAlertEmail(errMsg)
    ]);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }

  const headers = { 'X-Master-Key': apiKey };

  // Read existing container first (for status tracking even on failure)
  let container = { snapshots: [], status: {} };
  try {
    const backupRes = await fetchWithDelay(`${JSONBIN_BASE}/${backupBin}/latest`, { headers });
    if (backupRes.ok) {
      const backupData = await backupRes.json();
      container = backupData.record || { snapshots: [], status: {} };
      if (!container.status) container.status = {};
    }
  } catch (e) {
    console.warn('Could not read backup bin:', e.message);
  }

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

    // 2. Create new snapshot
    const snapshot = {
      id: 'snap_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      date: new Date().toISOString(),
      source: 'cron',
      counts,
      data
    };

    container.snapshots.unshift(snapshot);

    // 3. Rotate — keep only last N snapshots
    if (container.snapshots.length > MAX_SNAPSHOTS) {
      container.snapshots = container.snapshots.slice(0, MAX_SNAPSHOTS);
    }

    // 4. Update status — success
    container.status = {
      last_success: new Date().toISOString(),
      last_run: new Date().toISOString(),
      result: 'ok',
      error: null
    };

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

    // Record failure status
    container.status = {
      ...container.status,
      last_run: new Date().toISOString(),
      result: 'error',
      error: error.message
    };
    await updateBackupStatus(backupBin, apiKey, container.status, container);

    // Send alerts (webhook + email)
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
