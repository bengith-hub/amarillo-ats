// === RATTACHER CANDIDATS → ENTREPRISES ===
// Coller ce script dans la console (F12) sur n'importe quelle page de l'ATS
// Étape 1 : DRY RUN automatique (aperçu sans modification)
// Étape 2 : Taper rattacher() pour exécuter

(async function() {
  function normalize(str) {
    return (str || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  await Store.loadAll();
  const candidats = Store.get('candidats');
  const entreprises = Store.get('entreprises');

  console.log(`%c${candidats.length} candidats, ${entreprises.length} entreprises`, 'color:#60a5fa;font-weight:bold');

  // Index des entreprises par nom normalisé
  const entLookup = {};
  entreprises.forEach(e => {
    const key = normalize(e.nom);
    if (key) entLookup[key] = e;
  });

  let linked = 0, alreadyLinked = 0, noName = 0, noMatch = 0;
  const toLink = [];
  const unmatched = [];

  for (const c of candidats) {
    const fullName = `${c.prenom || ''} ${c.nom || ''}`.trim();

    if (c.entreprise_actuelle_id) {
      const ent = entreprises.find(e => e.id === c.entreprise_actuelle_id);
      if (ent) { alreadyLinked++; continue; }
    }

    const entName = c.entreprise_actuelle || c.entreprise_nom || '';
    if (!entName.trim()) { noName++; continue; }

    const key = normalize(entName);
    let match = entLookup[key];

    if (!match) {
      for (const e of entreprises) {
        const eKey = normalize(e.nom);
        if (eKey.includes(key) || key.includes(eKey)) { match = e; break; }
      }
    }

    if (match) {
      linked++;
      toLink.push({ candidat: c, match, fullName, entName });
      console.log(`%c  ✓ ${fullName}%c → "${entName}" → %c${match.nom}`, 'color:#4ade80', 'color:#e2e8f0', 'color:#4ade80;font-weight:bold');
    } else {
      noMatch++;
      unmatched.push({ fullName, entName });
      console.log(`%c  ✗ ${fullName}%c → "${entName}" → aucune correspondance`, 'color:#fb923c', 'color:#e2e8f0');
    }
  }

  console.log('\n%c=== RÉSULTAT (dry run) ===', 'color:#60a5fa;font-weight:bold;font-size:14px');
  console.log(`  Déjà rattachés : ${alreadyLinked}`);
  console.log(`%c  À rattacher : ${linked}`, 'color:#4ade80;font-weight:bold');
  console.log(`  Sans nom d'entreprise : ${noName}`);
  if (noMatch > 0) console.log(`%c  Sans correspondance : ${noMatch}`, 'color:#fb923c');

  if (unmatched.length > 0) {
    console.log('\n%cCandidats non matchés :', 'color:#fb923c;font-weight:bold');
    console.table(unmatched);
  }

  if (toLink.length === 0) {
    console.log('\n%cRien à rattacher !', 'color:#4ade80;font-weight:bold');
    return;
  }

  // Exposer la fonction d'exécution
  window.rattacher = async function() {
    console.log(`\n%c=== EXÉCUTION : rattachement de ${toLink.length} candidats ===`, 'color:#4ade80;font-weight:bold;font-size:14px');
    for (let i = 0; i < toLink.length; i++) {
      const { candidat: c, match, fullName } = toLink[i];
      await Store.update('candidats', c.id, { entreprise_actuelle_id: match.id });
      console.log(`  [${i+1}/${toLink.length}] ${fullName} → ${match.nom}`);
      await new Promise(r => setTimeout(r, 250));
    }
    console.log(`\n%c✓ Terminé ! ${toLink.length} candidats rattachés. Rechargez la page.`, 'color:#4ade80;font-weight:bold;font-size:14px');
  };

  console.log(`\n%c→ Tapez rattacher() pour exécuter le rattachement`, 'color:#FECC02;font-weight:bold;font-size:14px');
})();
