# Plan : Simulateur salaire, Chronometre action, Autocomplete selects

## Vue d'ensemble

Trois ameliorations UX/fonctionnelles pour l'ATS :
1. **Simulateur cout total employeur** — estimation automatique via l'API URSSAF dans la fiche candidat
2. **Chronometre d'action** — mesure du temps passe par action avec KPI dashboard
3. **Autocomplete dans la modale action** — recherche dynamique pour Candidat, Decideur, Entreprise

---

## Fonctionnalite 1 : Simulateur cout total employeur

### Objectif
Quand un salaire brut est renseigne dans la fiche candidat (Package & Remuneration), afficher automatiquement le cout total employeur. Utilise un simulateur externe (URSSAF) pour rester a jour avec le droit du travail sans maintenance manuelle.

### Architecture

| Decision | Choix |
|----------|-------|
| Source de calcul | **API REST mon-entreprise.urssaf.fr** (service public, maintenu par l'URSSAF/beta.gouv) |
| Declenchement | Automatique au chargement de la fiche + apres modification du salaire |
| Cache | En memoire (`_urssafCache`) par montant mensuel, evite les appels repetes |
| Fallback | Message "Simulation indisponible" si l'API echoue ou CORS bloque |

### API URSSAF

**Endpoint** : `POST https://mon-entreprise.urssaf.fr/api/v1/evaluate`

**Payload** :
```json
{
  "expressions": ["salarié . coût total employeur"],
  "situation": {
    "salarié . contrat . salaire brut": "5000 €/mois"
  }
}
```

**Reponse** : Le champ `evaluate[0].nodeValue` contient le cout mensuel en euros.

**Documentation** :
- API : https://mon-entreprise.urssaf.fr/d%C3%A9veloppeur/api
- Swagger : https://mon-entreprise.urssaf.fr/api/v1/doc/
- Regle "cout total employeur" : https://mon-entreprise.urssaf.fr/documentation/salari%C3%A9/co%C3%BBt-total-employeur

### Fichiers modifies

**`js/candidat-detail.js`**
- Fonction `fetchCoutEmployeur(salaireBrutAnnuelKE)` en debut de fichier (hors IIFE)
  - Convertit le package K€ annuel → €/mois
  - Appelle l'API URSSAF
  - Parse le resultat, convertit en K€/an
  - Cache en memoire par montant
- Dans `renderProfil()` : ajout d'un conteneur `#urssaf-cout-employeur` sous les totaux de package
- Apres `UI.inlineEdit('profil-package-fields')` : appel asynchrone de la simulation
- Affichage : encart bleu clair avec icone, valeur en K€/an, mention "estimation URSSAF"

### Affichage

```
┌──────────────────────────────────────────────────┐
│ 🏛️  COUT TOTAL EMPLOYEUR (ESTIMATION URSSAF)    │
│     85 K€ / an                                    │
│     Estimation basee sur le brut annuel de 60 K€  │
│     (cadre, sans convention collective specifique) │
└──────────────────────────────────────────────────┘
```

### Note CORS
L'API URSSAF est concue pour etre appelee depuis des sites tiers. Si toutefois des restrictions CORS bloquent l'appel navigateur, creer un proxy Netlify Function dans `netlify/functions/urssaf-proxy.js` (~15 lignes).

---

## Fonctionnalite 2 : Chronometre d'action

### Objectif
Permettre de mesurer le temps passe sur chaque action (appel, email, visio...) via un chronometre start/pause/reset integre dans la modale d'action. Le temps est sauvegarde et affiche dans les KPI du dashboard.

### Architecture

| Decision | Choix |
|----------|-------|
| Stockage timer en cours | `localStorage` (cle `ats_action_timer`) — survit a la fermeture de modale |
| Stockage duree finale | Champ `duree_minutes` sur l'enregistrement action |
| Format timer | MM:SS (ou H:MM:SS si > 1h) |
| KPI dashboard | Somme des `duree_minutes` des actions "Fait" de la semaine |

### Modele de donnees

Nouveau champ sur les actions :
```javascript
{
  duree_minutes: number | null  // Duree en minutes (arrondi au superieur)
}
```
Pas de migration necessaire — le Store JSON accepte les nouveaux champs dynamiquement.

### State localStorage

```javascript
{
  actionId: 'act_xxx' | null,    // null pour une nouvelle action
  startedAt: 1709500000000,      // Date.now() du dernier demarrage
  accumulatedSeconds: 0,         // Secondes accumulees (pause/resume)
  running: true                  // En cours ou en pause
}
```

### Fichiers modifies

**`js/actions.js`**
- Fonctions helper en debut de fichier (hors IIFE) :
  - `getTimerState()` / `setTimerState(state)` : lecture/ecriture localStorage
  - `formatTimer(totalSeconds)` : formatte en MM:SS ou H:MM:SS
- Dans `showActionModal()` : HTML du chronometre (encart bleu clair, boutons Demarrer/Pause/Reset)
- Logique timer dans un `setTimeout` :
  - Start : `setInterval(updateDisplay, 1000)`, enregistre `startedAt`
  - Pause : accumule les secondes, arrete l'intervalle
  - Reset : remet a 00:00
  - Restauration : reprend un timer en cours si meme action
- `onSave` : calcule `duree_minutes` depuis le timer state, nettoie le localStorage
- Colonne "Duree" dans le tableau des actions

**`js/dashboard.js`**
- Dans `renderKPIs()` : calcul `weekMinutes` = somme `duree_minutes` des actions faites cette semaine
- Affichage dans `#kpi-temps` (format Xh ou X min)

**`index.html`**
- 5e carte KPI "Temps passe" avec `id="kpi-temps"` et sous-texte "cette semaine"

**`css/style.css`**
- `.kpi-card:nth-child(5) { border-left-color: #f97316; }` (orange)

### Interface chronometre

```
┌──────────────────────────────────┐
│         Temps passe              │
│          05:32                   │
│   [Pause]  [Reset]              │
│   Precedemment : 12 min         │
└──────────────────────────────────┘
```

---

## Fonctionnalite 3 : Autocomplete dans la modale action

### Objectif
Remplacer les `<select>` HTML statiques pour Candidat, Decideur et Entreprise dans la modale d'action par des champs de recherche avec dropdown dynamique. Facilite la selection quand la base contient beaucoup d'enregistrements.

### Architecture

| Decision | Choix |
|----------|-------|
| Composant | `UI.searchableSelect()` — nouveau composant generique reutilisable |
| Pattern | Adapte de `UI.entrepriseAutocomplete()` et `UI.candidatAutocomplete()` existants |
| Stockage valeur | `container._getSelectedId()` — expose l'ID selectionne via le DOM |
| Champs convertis | Candidat, Decideur, Entreprise (Mission garde en `<select>`) |

### Composant `UI.searchableSelect(containerId, options)`

**Parametres** :
```javascript
{
  items: [{ id, label, sub }],  // Donnees a filtrer
  selectedId: string | null,    // Valeur pre-selectionnee
  placeholder: string,          // Texte placeholder
  emptyLabel: string,           // Label pour l'option "aucun" (defaut: "— Aucun —")
  onSelect: Function            // Callback optionnel lors de la selection
}
```

**Comportement** :
- Remplace le contenu du container par un `<input type="text">` + bouton clear
- Sur `focus` : affiche les 15 premiers items
- Sur `input` : filtre par label + sub, affiche les 10 premiers resultats
- Sur `mousedown` d'un item : selectionne, ferme le dropdown
- Option "Aucun" en haut pour vider la selection
- Sur `blur` sans selection : revient a vide
- Bouton `x` pour effacer la selection
- Item selectionne surligne en jaune pale avec bordure gauche `--primary`
- `container._getSelectedId()` retourne l'ID selectionne

### Classes CSS

```css
.ss-wrapper    /* Wrapper relatif contenant input + clear */
.ss-input      /* Input de recherche, full-width */
.ss-clear      /* Bouton x positionne absolu a droite */
.ss-dropdown   /* Dropdown positionne absolu, z-index 300, max-height 220px */
.ss-item       /* Item de dropdown (8px 12px, cursor pointer) */
.ss-item-selected   /* Item selectionne (fond jaune, bordure gauche) */
.ss-item-none       /* Option "Aucun" (gris, italique) */
.ss-item-empty      /* Message "Aucun resultat" */
.ss-item-sub        /* Texte secondaire (poste, fonction, secteur) */
```

### Fichiers modifies

**`js/components.js`**
- Nouvelle fonction `searchableSelect()` ajoutee avant le `return` de l'IIFE UI
- Exportee dans le `return { ... }` du module

**`js/actions.js`**
- HTML : `<select id="a-candidat">` → `<div id="ac-candidat"></div>` (idem decideur, entreprise)
- Initialisation dans un `setTimeout(50ms)` apres ouverture modale :
  - `UI.searchableSelect('ac-candidat', { items: candidats.map(...), ... })`
  - `UI.searchableSelect('ac-decideur', { items: decideurs.map(...), ... })`
  - `UI.searchableSelect('ac-entreprise', { items: entreprises.map(...), ... })`
- `onSave` : lecture via `document.getElementById('ac-candidat')?._getSelectedId?.()` au lieu de `.value`

**`css/style.css`**
- Styles `.ss-*` pour le composant searchable select

---

## Resume des fichiers modifies

| Fichier | F1 | F2 | F3 |
|---------|:--:|:--:|:--:|
| `js/candidat-detail.js` | X | | |
| `js/actions.js` | | X | X |
| `js/components.js` | | | X |
| `js/dashboard.js` | | X | |
| `index.html` | | X | |
| `css/style.css` | | X | X |

## Points d'attention

- **CORS URSSAF** : L'API est publique mais tester en conditions reelles. Proxy Netlify Function si necessaire.
- **Timer persistence** : Le timer localStorage est lie a un `actionId`. Si l'utilisateur ouvre une autre action, l'ancien timer est ignore.
- **Draft auto-save** : Le systeme de brouillon de la modale ne sauvegarde pas les champs searchableSelect (pas de `<select>` ni `<input>` avec ID connu). Acceptable car les champs relationnels changent peu.
- **Performance** : Le searchableSelect charge tous les items en memoire (OK pour des centaines, a revoir si des milliers).
