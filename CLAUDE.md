# Amarillo ATS — Guide pour Claude Code

> **IMPORTANT — Mise à jour obligatoire** : À chaque modification significative du code (nouvelle feature, nouveau module, changement d'architecture, nouvelle entité, nouveau champ de données), **ce fichier doit être mis à jour** dans le même commit. Cela garantit que chaque session Claude Code démarre avec une vision exacte du projet.

---

## Vue d'ensemble

**Amarillo ATS** est un Applicant Tracking System (ATS) mono-utilisateur développé pour **Benjamin Fetu** du cabinet **Amarillo Search**, spécialisé dans le recrutement par approche directe (chasse de têtes) sur les profils **DSI/CTO/CDO**.

Application web hébergée sur **Netlify** avec stockage serverless via **Netlify Blobs**.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Vanilla JS (ES2020+), pas de framework, pas de bundler |
| CSS | Tailwind CSS 3.4 + custom (`css/`) |
| Backend | Netlify Functions (serverless Node.js) |
| Stockage | Netlify Blobs (JSON) via `/.netlify/functions/store` |
| PDF | jsPDF — template "Talent à Impact" |
| Cartes | Leaflet.js + OpenRouteService |
| Auth | Google OAuth2 (Drive, Gmail) |
| APIs externes | Pappers (entreprises FR), OpenAI (parsing CV/entretiens) |
| Hébergement | Netlify |

---

## Architecture des fichiers

```
amarillo-ats/
├── *.html                    # Pages (liste + détail par entité)
├── js/                       # Modules frontend (IIFE, <script> tags)
│   ├── api.js                # Couche API — Netlify Blobs avec retry
│   ├── store.js              # Cache localStorage + state management
│   ├── config.js             # Configuration (clés, IDs bins)
│   ├── components.js         # Composants UI réutilisables
│   ├── routing.js            # Navigation entre pages
│   ├── referentiels.js       # Référentiels configurables (picklists)
│   ├── candidat-detail.js    # Page détail candidat (plus gros module)
│   ├── candidats.js          # Liste candidats + filtres
│   ├── entreprises.js        # Gestion entreprises + auto-découverte
│   ├── decideurs.js          # Base décideurs
│   ├── missions.js           # Gestion missions
│   ├── actions.js            # CRM — liste actions + filtres + chronomètre
│   ├── dashboard.js          # Dashboard KPIs (dont temps passé), actions urgentes
│   ├── carte.js              # Carte géographique entreprises
│   ├── pdf-engine.js         # Génération PDF "Talent à Impact"
│   ├── company-autofill.js   # Auto-complétion Pappers
│   ├── company-map-widget.js # Widget carte entreprise
│   ├── signal-engine.js      # Détection signaux business (presse)
│   ├── signal-regions.js     # Régions pour signaux
│   ├── cv-parser.js          # Extraction CV via OpenAI
│   ├── interview-analyzer.js # Analyse entretiens via IA
│   ├── dsi-scoring.js        # Scoring DSI candidats
│   ├── google-auth.js        # OAuth2 unifié Google
│   ├── gmail.js              # Intégration Gmail API
│   ├── google-drive.js       # Intégration Google Drive
│   ├── backup.js             # Gestion backup frontend
│   ├── backup-monitor.js     # Monitoring backups
│   ├── templates.js          # Templates email
│   ├── montserrat-font.js    # Police Montserrat (PDF)
│   └── playfair-font.js      # Police Playfair Display (PDF)
├── netlify/functions/         # Backend serverless
│   ├── store.mjs             # CRUD Netlify Blobs (endpoint principal)
│   ├── scheduled-backup.js   # Backup quotidien → Google Drive (cron)
│   ├── signal-scan.js        # Scan signaux presse (cron)
│   ├── teaser-followup.js    # Relances teasers automatiques (cron)
│   └── cors-proxy.js         # Proxy CORS pour APIs externes
├── css/                       # Tailwind + styles custom
├── Candidats/                 # Fiches candidats en markdown
├── scripts/                   # Scripts utilitaires
├── archive-notion/            # Exports Notion archivés
├── PLAN-OFFLINE-MODE.md       # Plan feature offline
├── PLAN-TEASER-PROFILES.md    # Plan feature teasers
├── amarillo-template-spec-final.md  # Spec template PDF
└── CLAUDE.md                  # Ce fichier — guide pour Claude Code
```

---

## Conventions de code

- **Modules** : Pattern IIFE — `const Module = (() => { ... return { publicMethod }; })()`
- **Pas de bundler** : Chaque module est un fichier `.js` chargé via `<script>` dans le HTML
- **Langue** : Noms de variables/fonctions en anglais, commentaires et UI en français
- **IDs** : Préfixe par entité — `can_`, `ent_`, `dec_`, `mis_`, `act_`
- **Dates** : Format ISO (strings) stockées dans les objets JSON

### Patterns d'appel API

```javascript
// Lecture (avec cache)
const candidats = await Store.getAll('candidats');

// Sauvegarde (cache + sync backend)
await Store.save('candidats', candidatsArray);

// API directe (sans cache)
const data = await API.getAll('candidats');
await API.save('candidats', data);
```

### Patterns UI

```javascript
// Tables
Components.renderTable(containerId, columns, data, options);

// Badges de statut
Components.badge(label, colorClass);

// Modals
Components.modal({ title, content, onConfirm });
```

---

## Modèle de données

### Entités principales (stockées dans Netlify Blobs)

Toutes les entités ont : `id`, `created_at`, `updated_at`

#### Candidats (`can_*`)
| Champ | Type | Description |
|-------|------|-------------|
| `prenom`, `nom` | string | Identité |
| `poste_actuel`, `poste_cible` | string | Postes actuel et cible |
| `entreprise_actuelle_id` | FK → entreprises | Entreprise actuelle |
| `entreprise_nom` | string | Nom entreprise (fallback) |
| `statut` | enum | To call, Approché, En qualification, Shortlisté, Présenté, Placé, Off market, Pas prioritaire |
| `niveau` | enum | Junior, Middle, Top |
| `diplome` | enum | Bac+2/3, Bac+4, Bac+5 |
| `origine` | string | Source du candidat |
| `profile_code` | string | Code profiling Amarillo |
| `open_to_work` | boolean | En recherche |
| `date_disponibilite` | date | Disponibilité |
| `date_naissance` | date | Naissance |
| `preavis` | string | Préavis |
| `ambassadeur` | enum | Non, Neutre, Oui |
| `recommande_par` | FK → candidats | Cooptation |
| `salaire_fixe_actuel`, `variable_actuel` | number | Rémunération actuelle (K€) |
| `package_souhaite_min`, `package_souhaite` | number | Package cible (K€) |
| `localisation` | string | Région |
| `email`, `telephone`, `linkedin` | string | Coordonnées |
| `adresse_ligne1`, `code_postal`, `ville` | string | Adresse |
| `google_drive_url` | string | Dossier Drive |
| `presentations` | array | Présentations (nested) |
| `entreprises_cibles` | array | Entreprises cibles |
| `notes` | string | Notes libres |

#### Entreprises (`ent_*`)
| Champ | Type | Description |
|-------|------|-------------|
| `nom` | string | Raison sociale |
| `secteur` | enum | Tech/SaaS, Conseil/ESN, Industrie, Finance/Banque, etc. |
| `taille` | enum | 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+ |
| `ca` | enum | Tranches CA (< 5M€ à 250M€+) |
| `priorite` | enum | 1-Veille → 5-Cœur de cible |
| `statut` | enum | À cibler, Ciblé, Prospection en cours, Client, Ancien client, Écarté |
| `localisation` | string | Région principale |
| `siege_adresse`, `siege_code_postal`, `siege_ville` | string | Siège |
| `telephone`, `site_web`, `linkedin` | string | Coordonnées |
| `groupe` | string | Groupe parent |
| `source` | string | Source découverte |
| `angle_approche` | string | Pitch d'approche |
| `_pappers_siren`, `_pappers_naf` | string | Données Pappers |
| `dernier_contact`, `prochaine_relance` | date | Suivi |
| `notes` | string | Notes |

#### Décideurs (`dec_*`)
| Champ | Type | Description |
|-------|------|-------------|
| `prenom`, `nom` | string | Identité |
| `entreprise_id` | FK → entreprises | Entreprise |
| `fonction` | string | Titre du poste |
| `fonction_macro` | enum | DSI/CIO, CTO, CDO, CISO/RSSI, DRH, DAF, CEO, COO, etc. |
| `niveau_hierarchique` | enum | COMEX, Direction, N-1, N-2, Opérationnel |
| `role_decision` | enum | Décideur, Influenceur, Prescripteur, Utilisateur |
| `niveau_relation` | enum | À contacter, Contacté, En relation, Champion |
| `priorite_prospection` | enum | Haute, Moyenne, Basse |
| `perimetre` | enum | France, Europe, International |
| `email`, `telephone`, `telephone_mobile`, `linkedin` | string | Coordonnées |
| `manager_direct_id` | FK → décideurs | Manager |
| `missions_ids` | FK[] → missions | Missions liées |
| `profil_candidat_id` | FK → candidats | Profil candidat lié |
| `dernier_contact`, `prochaine_relance` | date | Suivi |
| `notes_relation` | string | Notes |

#### Missions (`mis_*`)
| Champ | Type | Description |
|-------|------|-------------|
| `ref` | string | Référence mission |
| `nom` | string | Intitulé |
| `statut` | enum | Ciblage décideurs → Clôturée (10 étapes) |
| `niveau` | enum | Junior, Middle, Top |
| `priorite` | enum | Haute, Moyenne, Basse |
| `fee_estimee` | number | Fee estimée (€) |
| `taux_honoraires` | number | Taux honoraires (%, défaut 18) |
| `probabilite` | number | Probabilité succès (%) |
| `date_demarrage` | date | Date début |
| `duree_exclusivite_sem` | number | Exclusivité (semaines, défaut 6) |
| `exclusivite` | enum | Formelle, De fait |
| `garantie` | enum | 3 mois, 6 mois |
| `candidats_ids` | FK[] → candidats | Candidats liés |
| `decideurs_ids` | FK[] → décideurs | Décideurs liés |
| `candidat_place_id` | FK → candidats | Candidat placé |
| `factures_ids` | FK[] → facturation | Factures |
| `notes` | string | Notes |

#### Actions (`act_*`)
| Champ | Type | Description |
|-------|------|-------------|
| `action` | string | Description de l'action |
| `type_action` | enum | Prise de contact, Qualification, Présentation, Prospection, etc. |
| `canal` | enum | LinkedIn, Appel, Email, Visio, Physique, SMS, Autre |
| `statut` | enum | À faire, En cours, Fait, Annulé |
| `priorite` | enum | Haute, Moyenne, Basse |
| `date_action` | date | Date de l'action |
| `date_relance` | date | Date de relance |
| `candidat_id` | FK → candidats | Candidat lié (optionnel) |
| `decideur_id` | FK → décideurs | Décideur lié (optionnel) |
| `mission_id` | FK → missions | Mission liée (optionnel) |
| `entreprise_id` | FK → entreprises | Entreprise liée (optionnel) |
| `message_notes` | string | Notes détaillées |
| `reponse` | boolean | Réponse reçue |
| `next_step` | string | Prochaine étape |
| `duree_minutes` | number | Durée mesurée par le chronomètre (en minutes) |

#### Présentations (nested dans candidats.presentations[])
| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | ID unique |
| `type` | string | 'teaser' ou nom de mission |
| `entreprise_id` | FK → entreprises | Entreprise cible |
| `decideur_email` | string | Email décideur (teasers) |
| `date_envoi` | date | Date d'envoi |
| `statut_retour` | enum | En attente, Intéressé, Entretien planifié, Refusé, Offre |
| `anonymise` | boolean | Envoi anonymisé |
| `gmail_thread_id` | string | Référence thread Gmail |

#### Autres entités
- `facturation` — Suivi facturation/honoraires
- `references` — Référentiels configurables (picklists)
- `notes` — Notes globales

### Relations entre entités

```
Candidat ──→ Entreprise (entreprise_actuelle_id)
         ──→ Candidat (recommande_par, self-ref)
         ├── presentations[] ──→ Entreprise

Décideur ──→ Entreprise (entreprise_id)
         ──→ Décideur (manager_direct_id, self-ref)
         ──→ Mission[] (missions_ids)
         ──→ Candidat (profil_candidat_id)

Mission  ──→ Candidat[] (candidats_ids)
         ──→ Décideur[] (decideurs_ids)
         ──→ Candidat (candidat_place_id)
         ──→ Facturation[] (factures_ids)

Action   ──→ Candidat, Décideur, Mission, Entreprise (tous optionnels)
```

---

## Pages HTML

| Page | Fichier HTML | Module JS | Rôle |
|------|-------------|-----------|------|
| Dashboard | `index.html` | `dashboard.js` | KPIs, actions urgentes, résumé |
| Candidats | `candidats.html` | `candidats.js` | Liste avec filtres |
| Candidat | `candidat.html` | `candidat-detail.js` | Fiche détail complète |
| Entreprises | `entreprises.html` | `entreprises.js` | Liste + auto-découverte |
| Entreprise | `entreprise.html` | `entreprises.js` | Fiche détail |
| Décideurs | `decideurs.html` | `decideurs.js` | Liste décideurs |
| Décideur | `decideur.html` | `decideurs.js` | Fiche détail |
| Missions | `missions.html` | `missions.js` | Liste missions |
| Mission | `mission.html` | `missions.js` | Fiche détail |
| Actions | `actions.html` | `actions.js` | CRM / liste d'actions |
| Carte | `carte.html` | `carte.js` | Carte géographique |
| Signaux | `signaux.html` | `signal-engine.js` | Signaux business |
| Facturation | `facturation.html` | — | Suivi facturation |
| Référentiels | `referentiels.html` | `referentiels.js` | Config picklists |
| Teaser | `teaser-template.html` | — | Template teaser |

---

## Variables d'environnement (Netlify)

```
# Requis
GOOGLE_CLIENT_ID          — Client ID OAuth2 (GCP)
GOOGLE_CLIENT_SECRET      — Client secret OAuth2
GOOGLE_REFRESH_TOKEN      — Refresh token (scopes: drive.file, gmail.send)

# Optionnel
GOOGLE_DRIVE_BACKUP_FOLDER — ID dossier Drive pour backups
BACKUP_ALERT_WEBHOOK       — URL webhook Slack pour alertes
BACKUP_ALERT_EMAIL         — Email alertes (défaut: benjamin.fetu@amarillosearch.com)
```

---

## Features récentes

### Simulateur coût total employeur (fiche candidat)

Dans la carte "Package & Rémunération" de la fiche candidat, le coût total employeur est calculé automatiquement via l'**API URSSAF** (`mon-entreprise.urssaf.fr/api/v1/evaluate`). L'appel utilise l'expression publicodes `salarié . coût total employeur` avec le salaire brut annuel du candidat. Le résultat est affiché dans un encart bleu sous les totaux de package.

- **Fichier** : `js/candidat-detail.js` — fonction `fetchCoutEmployeur()` (hors IIFE)
- **API** : `POST https://mon-entreprise.urssaf.fr/api/v1/evaluate` — service public maintenu par l'URSSAF/beta.gouv
- **Cache** : En mémoire (`_urssafCache`) par montant mensuel
- **Déclenchement** : Au chargement de la fiche + après modification du salaire (`onAfterSave` du `UI.inlineEdit`)

### Chronomètre d'action

Chaque action dispose d'un chronomètre (Démarrer/Pause/Reset) intégré dans la modale de création/édition. Le temps mesuré est sauvegardé en `duree_minutes` sur l'enregistrement action.

- **Fichier** : `js/actions.js` — helpers `getTimerState()`, `setTimerState()`, `formatTimer()` (hors IIFE)
- **Persistance** : `localStorage` clé `ats_action_timer` (state : `actionId`, `startedAt`, `accumulatedSeconds`, `running`)
- **Tableau** : Colonne "Durée" dans la table des actions
- **Dashboard** : KPI "Temps passé" (5e carte, `#kpi-temps`) — somme `duree_minutes` des actions "Fait" de la semaine
- **HTML** : `index.html` — carte KPI avec `id="kpi-temps"`

### Autocomplete dans la modale action

Les champs Candidat, Décideur et Entreprise de la modale action utilisent un composant de recherche avec dropdown filtré au lieu de `<select>` statiques.

- **Composant** : `UI.searchableSelect(containerId, { items, selectedId, placeholder, emptyLabel, onSelect })` dans `js/components.js`
- **Items** : `[{ id, label, sub }]` — label pour le nom, sub pour l'info secondaire (poste, fonction, secteur)
- **Lecture valeur** : `container._getSelectedId()` retourne l'ID sélectionné
- **CSS** : Classes `.ss-wrapper`, `.ss-input`, `.ss-clear`, `.ss-dropdown`, `.ss-item`, `.ss-item-selected` dans `css/style.css`
- **Fichier** : `js/actions.js` — containers `#ac-candidat`, `#ac-decideur`, `#ac-entreprise` initialisés après ouverture modale

## Features planifiées (non encore implémentées)

- **Mode offline** — Voir `PLAN-OFFLINE-MODE.md` (sync queue, service worker, indicateur UI)
- **Teasers par email** — Voir `PLAN-TEASER-PROFILES.md` (Gmail API, templates, relances auto, KPIs)

---

## Commandes utiles

```bash
# Build Tailwind CSS
npx tailwindcss -i css/input.css -o css/output.css --watch

# Déployer (push sur main → Netlify auto-deploy)
git push origin main
```
