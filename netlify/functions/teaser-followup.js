// Amarillo ATS — Teaser Follow-up Scheduled Function
// Runs daily at 8:00 AM to check for due teaser relances.
//
// V1: Creates CRM actions "Relance teaser à faire" (no auto email send).
// The actual email send is done manually from the ATS UI.

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

export default async function handler(req) {
  const apiKey = process.env.JSONBIN_API_KEY;
  const candidatsBin = process.env.JSONBIN_CANDIDATS_BIN;
  const actionsBin = process.env.JSONBIN_ACTIONS_BIN;

  if (!apiKey || !candidatsBin || !actionsBin) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Fetch candidats
    const candidatsRes = await fetch(`${JSONBIN_BASE}/${candidatsBin}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!candidatsRes.ok) throw new Error(`Failed to fetch candidats: ${candidatsRes.status}`);
    const candidatsData = await candidatsRes.json();
    const candidats = candidatsData.record || [];

    // 2. Fetch actions
    const actionsRes = await fetch(`${JSONBIN_BASE}/${actionsBin}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!actionsRes.ok) throw new Error(`Failed to fetch actions: ${actionsRes.status}`);
    const actionsData = await actionsRes.json();
    const actions = actionsData.record || [];

    // 3. Process teaser relances
    let updatedCandidats = false;
    const newActions = [];

    for (const c of candidats) {
      if (!c.presentations) continue;

      let candidatUpdated = false;
      for (let i = 0; i < c.presentations.length; i++) {
        const p = c.presentations[i];
        if (p.type !== 'teaser') continue;
        if (p.email_status !== 'sent') continue;
        if (!p.relance_auto) continue;
        if (!p.relance_prevue || p.relance_prevue > today) continue;

        if ((p.nb_relances || 0) >= 2) {
          // Max relances reached — mark as no-reply
          c.presentations[i] = { ...p, email_status: 'no-reply', statut_retour: 'Sans réponse' };
          candidatUpdated = true;

          newActions.push({
            id: 'act_cron_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            action: `Teaser sans réponse — ${p.entreprise_nom || p.decideur_email || ''}`,
            type_action: 'Retour teaser',
            canal: 'Email',
            statut: 'Fait',
            priorite: null,
            date_action: today,
            date_relance: null,
            candidat_id: c.id,
            decideur_id: p.decideur_id || null,
            mission_id: null,
            entreprise_id: p.entreprise_id || null,
            reponse: false,
            message_notes: `Teaser marqué "sans réponse" après ${p.nb_relances || 0} relances (automatique).`,
            next_step: '',
            phase: '', finalite: '', objectif: '', moment_suivi: ''
          });

        } else {
          // Create follow-up action
          const nextRelance = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

          c.presentations[i] = {
            ...p,
            nb_relances: (p.nb_relances || 0) + 1,
            derniere_relance: today,
            relance_prevue: nextRelance
          };
          candidatUpdated = true;

          newActions.push({
            id: 'act_cron_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            action: `Relance teaser à faire — ${p.entreprise_nom || p.decideur_email || ''}`,
            type_action: 'Relance teaser',
            canal: 'Email',
            statut: 'À faire',
            priorite: 'Haute',
            date_action: today,
            date_relance: nextRelance,
            candidat_id: c.id,
            decideur_id: p.decideur_id || null,
            mission_id: null,
            entreprise_id: p.entreprise_id || null,
            reponse: false,
            message_notes: `Relance automatique #${(p.nb_relances || 0) + 1}.\nTeaser envoyé le ${p.date_envoi}.\nDécideur : ${p.decideur_nom || ''} (${p.decideur_email || ''})`,
            next_step: 'Envoyer la relance email depuis l\'ATS',
            phase: '', finalite: '', objectif: '', moment_suivi: ''
          });
        }
      }

      if (candidatUpdated) updatedCandidats = true;
    }

    // 4. Save updated candidats
    if (updatedCandidats) {
      const updateRes = await fetch(`${JSONBIN_BASE}/${candidatsBin}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify(candidats)
      });
      if (!updateRes.ok) throw new Error(`Failed to update candidats: ${updateRes.status}`);
    }

    // 5. Save new actions
    if (newActions.length > 0) {
      const allActions = [...actions, ...newActions];
      const actionsUpdateRes = await fetch(`${JSONBIN_BASE}/${actionsBin}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify(allActions)
      });
      if (!actionsUpdateRes.ok) throw new Error(`Failed to update actions: ${actionsUpdateRes.status}`);
    }

    return new Response(JSON.stringify({
      processed: newActions.length,
      message: `${newActions.length} teaser action(s) created`
    }));

  } catch (error) {
    console.error('teaser-followup error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export const config = {
  schedule: "0 8 * * *" // Daily at 8:00 AM
};
