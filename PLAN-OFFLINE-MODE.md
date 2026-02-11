# Plan : Mode Hors Ligne — Amarillo ATS

## Objectif
Permettre l'utilisation complète de l'ATS sans connexion internet (consultation ET saisie), avec synchronisation automatique au retour en ligne — comme Notion.

---

## Analyse de l'existant

L'architecture actuelle est déjà **~80% compatible** avec le mode hors ligne :

| Composant | Statut actuel | À modifier |
|-----------|--------------|------------|
| localStorage cache | TTL 5 min, puis expire | Supprimer TTL si offline |
| `Store.add/update/remove` | Écrit en cache local puis sync API | Ajouter file d'attente si offline |
| `Store.load` | Fallback sur cache stale si API échoue | Déjà OK |
| Assets statiques (HTML/JS/CSS) | Chargés depuis le serveur | Service Worker pour cache |
| Indicateur online/offline | Absent | À créer |

---

## Étapes d'implémentation

### Phase 1 — Détection online/offline + Store résilient
**Fichier : `js/store.js`**

1. **Ajouter un flag `isOnline`** basé sur `navigator.onLine` + événements `online`/`offline`
2. **Supprimer le TTL quand offline** : si `!isOnline`, toujours retourner le cache localStorage sans vérifier le timestamp
3. **File d'attente de sync** (`syncQueue`) :
   - Quand une opération `add/update/remove` échoue (ou qu'on est offline), stocker l'opération dans `localStorage` sous la clé `ats_sync_queue`
   - Format : `[{ action: 'update', entity: 'candidats', id: '...', data: {...}, timestamp: ... }]`
   - Au retour en ligne, rejouer la queue dans l'ordre chronologique

```javascript
// Pseudo-code des modifications store.js

let isOnline = navigator.onLine;
window.addEventListener('online', () => { isOnline = true; processQueue(); });
window.addEventListener('offline', () => { isOnline = false; });

function queueOperation(op) {
  const queue = JSON.parse(localStorage.getItem('ats_sync_queue') || '[]');
  queue.push({ ...op, timestamp: Date.now() });
  localStorage.setItem('ats_sync_queue', JSON.stringify(queue));
}

async function processQueue() {
  const queue = JSON.parse(localStorage.getItem('ats_sync_queue') || '[]');
  if (!queue.length) return;

  // Regrouper par entité pour éviter le rate-limit JSONBin
  const byEntity = {};
  queue.forEach(op => {
    byEntity[op.entity] = byEntity[op.entity] || [];
    byEntity[op.entity].push(op);
  });

  for (const entity of Object.keys(byEntity)) {
    const data = get(entity); // données locales déjà à jour
    await API.updateBin(entity, data); // un seul appel par entité
    await sleep(1200); // respect rate-limit JSONBin (1 req/sec free tier)
  }

  localStorage.removeItem('ats_sync_queue');
  emit('_sync', { status: 'done' });
}
```

**Modifier `add`, `update`, `remove`** :
- Toujours écrire en cache local immédiatement (déjà le cas)
- Si offline ou si l'appel API échoue → `queueOperation()` au lieu de juste `console.error`
- Pas de blocage de l'UI, l'utilisateur continue à travailler

---

### Phase 2 — Service Worker (cache des assets)
**Nouveau fichier : `sw.js` (à la racine)**

Le Service Worker met en cache tous les fichiers statiques pour que l'app se charge même sans internet.

```javascript
// Pseudo-code sw.js
const CACHE_NAME = 'amarillo-ats-v1';
const ASSETS = [
  '/', '/index.html', '/candidats.html', '/candidat.html',
  '/entreprises.html', '/entreprise.html', '/decideurs.html',
  '/decideur.html', '/missions.html', '/mission.html',
  '/actions.html', '/facturation.html', '/referentiels.html',
  '/js/api.js', '/js/store.js', '/js/config.js',
  '/js/components.js', '/js/referentiels.js', '/js/templates.js',
  '/js/dashboard.js', '/js/candidats.js', '/js/candidat-detail.js',
  '/js/entreprises.js', '/js/decideurs.js', '/js/missions.js',
  '/js/actions.js',
  '/css/style.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  // Strategy: Network-first pour les HTML, Cache-first pour JS/CSS
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
```

**Enregistrement** (ajouter dans chaque page HTML ou dans un script commun) :
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

### Phase 3 — Indicateur UI online/offline/sync
**Fichier : `js/components.js`**

Ajouter un indicateur visuel dans la barre de navigation :

| État | Affichage |
|------|-----------|
| En ligne, tout synchro | Pastille verte + "En ligne" |
| En ligne, sync en cours | Pastille orange + "Synchronisation..." |
| Hors ligne, queue vide | Pastille grise + "Hors ligne" |
| Hors ligne, modifs en attente | Pastille orange + "Hors ligne • 3 modifs en attente" |
| Erreur de sync | Pastille rouge + "Erreur de sync" + bouton réessayer |

```html
<!-- À ajouter dans la nav de chaque page -->
<span id="sync-indicator" class="sync-indicator">
  <span class="sync-dot"></span>
  <span class="sync-label">En ligne</span>
</span>
```

---

### Phase 4 — Gestion des conflits
**Stratégie : Last-Write-Wins (simple)**

Pour un utilisateur unique, la stratégie la plus simple est suffisante :
- Le cache local est toujours considéré comme la source de vérité
- Au retour en ligne, les données locales écrasent les données distantes
- Pas besoin de merge complexe (un seul utilisateur)

Si un jour l'ATS devient multi-utilisateur :
- Ajouter un champ `version` ou `updated_at` par enregistrement
- Comparer avant d'écraser
- Afficher un dialogue de résolution si conflit

---

## Ordre de priorité

| Priorité | Phase | Effort estimé | Impact |
|----------|-------|--------------|--------|
| 1 | Phase 1 — Store résilient | ~2h | Permet d'ajouter/modifier des données offline |
| 2 | Phase 3 — Indicateur UI | ~30min | L'utilisateur sait s'il est online/offline |
| 3 | Phase 2 — Service Worker | ~1h | L'app se charge sans internet |
| 4 | Phase 4 — Conflits | ~30min | Sécurité pour le futur multi-user |

**Total estimé : ~4h de développement**

---

## Contraintes techniques à garder en tête

1. **Rate-limit JSONBin** : 1 requête/sec sur le plan gratuit → la sync de la queue doit être séquentielle avec délai de 1.2s entre chaque appel
2. **Taille localStorage** : ~5-10 MB selon les navigateurs → surveiller la taille des données (actuellement très loin de la limite)
3. **Service Worker HTTPS** : fonctionne uniquement en HTTPS (OK, `ats.amarillosearch.com` est déjà en HTTPS)
4. **Mise à jour du cache SW** : incrémenter `CACHE_NAME` à chaque déploiement pour forcer le rafraîchissement

---

## Tests à prévoir

- [ ] Créer/modifier/supprimer un candidat en mode avion → vérifier que les données persistent
- [ ] Revenir en ligne → vérifier que la sync se fait automatiquement
- [ ] Recharger la page en mode avion → vérifier que l'app se charge
- [ ] Simuler une erreur API → vérifier que la queue stocke l'opération
- [ ] Vérifier que l'indicateur UI reflète bien l'état
- [ ] Tester sur mobile (Safari iOS, Chrome Android)
