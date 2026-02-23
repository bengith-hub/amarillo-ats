// Amarillo ATS — Teaser Follow-up Scheduled Function
// Runs daily at 8:00 AM to check for due teaser relances.
//
// V2: Uses Netlify Blobs instead of JSONBin.
// V1: Creates CRM actions "Relance teaser à faire" (no auto email send).
// The actual email send is done manually from the ATS UI.

import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  const today = new Date().toISOString().split('T')[0];

  try {
    const store = getStore("ats-data");

    // 1. Fetch candidats
    const candidats = await store.get("candidats", { type: "json" }) || [];

    // 2. Fetch actions
    const actions = await store.get("actions", { type: "json" }) || [];

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
      await store.setJSON("candidats", candidats);
    }

    // 5. Save new actions
    if (newActions.length > 0) {
      const allActions = [...actions, ...newActions];
      await store.setJSON("actions", allActions);
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
