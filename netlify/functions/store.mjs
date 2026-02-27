// Amarillo ATS — Netlify Blobs Store Function
// Replaces JSONBin as the storage backend.
// Auto-migrates data from JSONBin on first access per entity.

import { getStore } from "@netlify/blobs";

// JSONBin config for one-time migration (same values as config.js — already public)
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';
const JSONBIN_API_KEY = '$2a$10$FvDIogJwH4l87MiEdExg6udcabOSwaFpjoL1xTc5KQgUojd6JA4Be';
const JSONBIN_BINS = {
  candidats: '698a4deeae596e708f1e4f33',
  entreprises: '698a4deed0ea881f40ade47b',
  decideurs: '698a4deeae596e708f1e4f36',
  missions: '698a4defd0ea881f40ade47f',
  actions: '698a4defd0ea881f40ade482',
  facturation: '698a4e0043b1c97be9727eb2',
  references: '698a4e0143b1c97be9727eb5',
  notes: '698a4df143b1c97be9727ea2',
  dsi_sessions: '698880c7ae596e708f1a6944'
};

// Signal Engine entities (no JSONBin migration, born in Netlify Blobs)
const SIGNAL_ENTITIES = new Set(['signaux', 'watchlist', 'signal_config', 'entreprises_ecartees']);

const VALID_ENTITIES = new Set([...Object.keys(JSONBIN_BINS), ...SIGNAL_ENTITIES, '_backup_status']);

async function migrateFromJsonBin(entity) {
  const binId = JSONBIN_BINS[entity];
  if (!binId) return null;

  try {
    const res = await fetch(`${JSONBIN_BASE}/${binId}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.record || [];
  } catch (e) {
    console.error(`Migration fetch failed for ${entity}:`, e);
    return null;
  }
}

export default async function handler(req, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers });
  }

  const url = new URL(req.url);
  const entity = url.searchParams.get('entity');

  if (!entity || !VALID_ENTITIES.has(entity)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing entity parameter' }),
      { status: 400, headers }
    );
  }

  const store = getStore("ats-data");

  // GET — Read entity data
  if (req.method === 'GET') {
    try {
      let data = await store.get(entity, { type: 'json' });

      // Auto-migrate from JSONBin on first access (skip Signal Engine entities)
      if (data === null && !SIGNAL_ENTITIES.has(entity)) {
        console.log(`Blob empty for ${entity}, migrating from JSONBin...`);
        data = await migrateFromJsonBin(entity);
        if (data && Array.isArray(data) && data.length > 0) {
          await store.setJSON(entity, data);
          console.log(`Migrated ${entity}: ${data.length} records`);
        }
      }

      return new Response(JSON.stringify(data || []), { status: 200, headers });
    } catch (e) {
      console.error(`GET ${entity} error:`, e);
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 500, headers }
      );
    }
  }

  // PUT — Write entity data
  if (req.method === 'PUT') {
    try {
      const records = await req.json();
      await store.setJSON(entity, records);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch (e) {
      console.error(`PUT ${entity} error:`, e);
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers }
  );
}
