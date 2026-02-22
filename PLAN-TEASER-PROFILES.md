# Plan : Envoi de profils en mode Teaser

## Vue d'ensemble

Workflow complet pour envoyer des profils candidats (anonymises) a des entreprises/decideurs **sans mission active**, avec tracking, envoi email via Gmail API, relances automatiques, et generation automatique d'actions CRM.

---

## Architecture choisie

| Decision | Choix |
|----------|-------|
| Integration email | **Gmail API complete** (scopes: `gmail.send`, `gmail.readonly`, `gmail.modify`) |
| Structure donnees | **Enrichir le systeme Presentations existant** (champ `type: 'teaser'`) |
| Relances | **Netlify Scheduled Functions** (cron quotidien) |
| Stockage | JSONBin existant (entite `actions` + champ `presentations` sur candidats) |

---

## Phase 1 : Integration Gmail API

### 1.1 — Module `js/gmail.js`

Nouveau module qui etend l'authentification Google OAuth2 existante (`google-drive.js`) pour ajouter les scopes Gmail.

**Scopes OAuth2 a ajouter :**
```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

**Fonctions du module :**
- `Gmail.authenticate()` — Demande token avec scopes Drive + Gmail combines
- `Gmail.sendEmail({ to, cc, bcc, subject, body, attachments })` — Envoi via `POST /gmail/v1/users/me/messages/send` (MIME base64url)
- `Gmail.createDraft({ to, subject, body, attachments })` — Cree un brouillon (fallback)
- `Gmail.getThread(threadId)` — Recupere un fil de discussion pour verifier les reponses
- `Gmail.searchMessages(query)` — Recherche (ex: `to:contact@entreprise.com subject:"Talent a Impact"`)
- `Gmail.checkForReplies(messageId)` — Verifie si un message a recu des reponses
- `Gmail.getMessageHeaders(messageId)` — Recupere les headers (pour detecter bounces/auto-replies)

**Configuration :**
- Nouveau champ `ATS_CONFIG.gmailSenderEmail` = `'benjamin.fetu@amarillosearch.com'`
- Le Google Client ID existant doit avoir les scopes Gmail autorises dans la console GCP
- On refactore `GoogleDrive.authenticate()` pour partager le token avec Gmail (meme popup OAuth)

### 1.2 — Refactoring OAuth2 unifie

Creer un module `js/google-auth.js` qui centralise l'authentification Google :
- Un seul token client avec TOUS les scopes (Drive + Gmail)
- `GoogleDrive` et `Gmail` utilisent tous les deux ce token
- Une seule popup de consentement pour l'utilisateur
- Le token est cache et partage entre les modules

### 1.3 — Signature email configurable

- Stockee dans `localStorage` (cle `ats_email_signature`)
- Configurable dans le modal de configuration general
- Format HTML (pour la signature Amarillo Search avec logo)
- Valeur par defaut :
  ```
  Benjamin Fetu
  Amarillo Search — Executive Search & Recrutement
  benjamin.fetu@amarillosearch.com
  ```

---

## Phase 2 : Modele de donnees Teaser

### 2.1 — Extension du modele Presentation

Le champ `candidat.presentations[]` est enrichi :

```js
{
  // Champs existants
  entreprise_id: 'ent_xxx',     // ID entreprise (cree auto si nouvelle)
  entreprise_nom: 'Acme Corp',  // Nom (fallback si pas d'ID)
  date_envoi: '2026-02-22',
  anonymise: true,
  statut_retour: 'En attente',  // En attente | Interesse | Entretien planifie | Refuse | Offre | Sans reponse | Spam/Auto-reply
  notes: '',

  // NOUVEAUX champs pour teaser
  type: 'teaser',               // 'teaser' | 'mission' (defaut: 'mission' pour backward compat)
  decideur_id: 'dec_xxx',       // Decideur cible (optionnel)
  decideur_nom: 'Jean Dupont',  // Nom decideur (fallback)
  decideur_email: 'j.dupont@acme.com', // Email utilise pour l'envoi

  // Envoi email
  teaser_group_id: 'tg_xxx',    // ID de groupe (meme envoi = meme group)
  gmail_message_id: 'msg_xxx',  // ID du message Gmail (pour tracking)
  gmail_thread_id: 'thr_xxx',   // ID du thread Gmail (pour tracking reponses)
  email_subject: '',            // Sujet de l'email envoye
  email_status: 'sent',         // draft | sent | replied | bounced | auto-reply | no-reply

  // Relances
  relance_prevue: '2026-03-01', // Date de relance prevue
  nb_relances: 0,               // Nombre de relances envoyees
  derniere_relance: null,       // Date derniere relance
  relance_auto: true,           // Relance automatique activee ?
}
```

### 2.2 — Nouveaux referentiels

Ajouter dans `referentiels.js` :
```js
// Statuts teaser (plus granulaire que presentation_statuts)
teaser_email_statuts: [
  'Brouillon', 'Envoye', 'Repondu', 'Interesse',
  'Entretien planifie', 'Refuse', 'Sans reponse',
  'Bounce', 'Spam/Auto-reply'
],

// Delais relance par defaut
teaser_relance_delais: ['3 jours', '5 jours', '7 jours', '10 jours', '14 jours'],
```

### 2.3 — Auto-creation d'entreprise

Quand un decideur/entreprise est saisi manuellement (pas dans la DB) :
1. Creer automatiquement l'entreprise dans `Store.add('entreprises', { nom, statut: 'A cibler' })`
2. Creer le decideur si email saisi : `Store.add('decideurs', { nom, email, entreprise_id })`
3. Mettre a jour la presentation avec les nouveaux IDs

---

## Phase 3 : Interface d'envoi Teaser

### 3.1 — Bouton "Envoyer en Teaser" sur la fiche candidat

Ajouter un bouton dans le header candidat (a cote de "Teaser PDF") :
```
[Envoyer Teaser] — style: background:#1e293b; color:#FECC02; icone: avion papier
```

### 3.2 — Modal d'envoi multi-destinataires

Workflow en 3 etapes dans un modal :

**Etape 1 : Selectionner les destinataires**
- Liste de decideurs/entreprises avec recherche + filtres
- **Filtre par secteur/industrie** (secteurs similaires au candidat ou a sa cible)
- Checkbox multiple pour selectionner plusieurs destinataires
- Autocomplete avec creation rapide (entreprise + decideur + email)
- Affichage du nombre de destinataires selectionnes
- Option "Selectionner par secteur" qui pre-coche tous les decideurs d'un secteur

**Etape 2 : Composer le message**
- Selecteur de template (trames existantes + nouvelles trames teaser)
- Champs : Objet, Corps du message (textarea riche)
- Variables de template : `{{prenom_decideur}}`, `{{nom_entreprise}}`, `{{poste_candidat}}`, `{{secteur}}`, etc.
- Apercu du message avec variables remplacees
- Piece jointe : Teaser PDF auto-genere (avec option de re-generer)
- Signature email pre-remplie

**Etape 3 : Confirmer et envoyer**
- Recapitulatif : X destinataires, sujet, apercu
- Option : date de relance automatique (defaut : J+7)
- Option : activer/desactiver relance auto
- Bouton "Envoyer" → envoi via Gmail API
- Progress bar (si plusieurs destinataires)

### 3.3 — Nouvelles trames teaser

Ajouter dans `templates.js`, categorie "Teaser" :

```js
teaserInitial: {
  title: "Email Teaser — Envoi initial",
  icon: "✈️",
  sections: [{
    title: "Objet",
    content: "Profil — {{poste_candidat}} | Amarillo Search"
  }, {
    title: "Corps",
    content: `Bonjour {{prenom_decideur}},

Je me permets de vous adresser un profil que j'accompagne actuellement dans sa reflexion de carriere.

Il s'agit d'un(e) {{poste_candidat}} avec une experience significative dans {{secteur_candidat}}, qui pourrait correspondre a vos enjeux de recrutement actuels ou a venir.

Vous trouverez ci-joint une synthese anonymisee de son parcours.

Si ce type de profil peut avoir du sens pour votre organisation, je serais ravi d'en echanger avec vous.

Bien cordialement,`
  }]
},

teaserRelance: {
  title: "Email Teaser — Relance",
  icon: "🔄",
  sections: [{
    title: "Objet",
    content: "Re: Profil — {{poste_candidat}} | Amarillo Search"
  }, {
    title: "Corps",
    content: `Bonjour {{prenom_decideur}},

Je me permets une courte relance concernant le profil que je vous ai adresse le {{date_envoi}}.

Ce candidat est toujours en reflexion et son profil reste d'actualite. Si le sujet merite un echange, meme court, je suis disponible.

Bien cordialement,`
  }]
}
```

### 3.4 — Filtre destinataires par industrie

- A l'ouverture du selecteur, pre-filtrer les entreprises dont le `secteur` correspond a :
  1. Le secteur de l'entreprise actuelle du candidat
  2. Les secteurs des entreprises ciblees par le candidat
  3. Ou un mapping de secteurs "similaires" (ex: Tech/SaaS ↔ Conseil/ESN)
- Bouton "Tous les secteurs" pour enlever le filtre
- Mapping de secteurs proches configurable dans les referentiels

---

## Phase 4 : Tracking et suivi des reponses

### 4.1 — Verification des reponses (polling)

A chaque ouverture de l'ATS (dans `Store.loadAll()` ou au chargement de la page candidat) :
1. Pour chaque presentation teaser avec `email_status === 'sent'` et `gmail_thread_id` :
   - Appeler `Gmail.getThread(threadId)`
   - Si le thread contient plus de messages que l'envoi initial → **reponse detectee**
   - Analyser les headers du dernier message :
     - `X-Autoreply: yes` ou `Auto-Submitted: auto-replied` → marquer `spam/auto-reply`
     - Header `X-Failed-Recipients` → marquer `bounce`
     - Sinon → marquer `replied`
2. Mettre a jour `email_status` et `statut_retour` dans la presentation
3. Creer une action automatique si reponse detectee

### 4.2 — Indicateurs visuels sur la fiche candidat

Dans le tab "Presentations", chaque teaser affiche :
- Badge colore selon `email_status` :
  - `sent` → 🔵 Envoye
  - `replied` → 🟢 Repondu
  - `bounced` → 🔴 Bounce
  - `auto-reply` → 🟡 Auto-reply
  - `no-reply` → ⚪ Sans reponse (apres X jours)
- Indicateur de relance : "Relance dans X jours" ou "X relances envoyees"
- Lien pour ouvrir le thread Gmail directement

### 4.3 — Section Teaser dans le tab Presentations

Separer visuellement les teasers et les presentations mission :

```
┌─────────────────────────────────────────────────┐
│ Presentations aux entreprises (5)               │
├─────────────────────────────────────────────────┤
│                                                 │
│ ✈️ TEASERS (3)                          [+ Teaser] │
│ ┌─────────────────────────────────────────────┐ │
│ │ Acme Corp — J. Dupont    22/02  🔵 Envoye   │ │
│ │ BigTech — M. Martin      20/02  🟢 Repondu  │ │
│ │ StartupX — L. Leroy      18/02  ⚪ Sans rep. │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 📋 MISSIONS (2)                   [+ Presentation] │
│ ┌─────────────────────────────────────────────┐ │
│ │ ClientY — Mission DSI    15/02  Interesse   │ │
│ │ ClientZ — Mission CTO    10/02  En attente  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.4 — Actions automatiques generees

A chaque envoi de teaser, creer automatiquement :

**Sur la fiche candidat :**
```js
{
  action: `Teaser envoye a ${entreprise_nom}`,
  type_action: 'Envoi teaser',     // Nouveau type d'action
  canal: 'Email',
  statut: 'Fait',
  date_action: today,
  candidat_id: candidat.id,
  entreprise_id: entreprise.id,
  decideur_id: decideur.id,
  reponse: false,
  next_step: 'Relance J+7 si sans reponse',
  date_relance: relanceDate,
}
```

**Sur la fiche entreprise :**
- Meme action, visible dans la section "Actions" de l'entreprise
- Met a jour `dernier_contact` sur l'entreprise

A chaque reponse detectee :
```js
{
  action: `Reponse au teaser de ${candidat_nom}`,
  type_action: 'Retour teaser',
  canal: 'Email',
  statut: 'A faire',   // A traiter
  candidat_id, entreprise_id, decideur_id,
  reponse: true,
  message_notes: 'Reponse detectee automatiquement via Gmail'
}
```

### 4.5 — Tracking sur la fiche entreprise

Sur la page `entreprise.html`, ajouter une section "Teasers recus" :
- Liste des candidats dont un teaser a ete envoye a cette entreprise
- Statut de chaque teaser (envoye, repondu, etc.)
- Permet de voir rapidement quel candidat a ete propose en teaser

---

## Phase 5 : Relances automatiques (Netlify Function)

### 5.1 — Netlify Scheduled Function

Creer `netlify/functions/teaser-followup.js` :
- **Declenchement** : cron quotidien (`@daily` ou `0 8 * * *` pour 8h du matin)
- **Logique** :
  1. Lire les presentations teasers depuis JSONBin (`candidats` bin)
  2. Pour chaque teaser avec `relance_auto: true` et `relance_prevue <= today` et `email_status === 'sent'` :
     a. Verifier si une reponse a ete recue (via Gmail API)
     b. Si pas de reponse et `nb_relances < 2` :
        - Envoyer la relance via Gmail API (reply dans le meme thread)
        - Incrementer `nb_relances`
        - Mettre a jour `derniere_relance`
        - Calculer prochaine relance (`relance_prevue = today + delai`)
     c. Si `nb_relances >= 2` : marquer `email_status: 'no-reply'`
  3. Creer des actions CRM pour les relances envoyees

**Configuration Netlify :**
```toml
# netlify.toml
[functions]
  directory = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-functions-install-core"
```

### 5.2 — Stockage du token Gmail pour le cron

Probleme : le token OAuth2 est genere cote client (popup Google). Le cron serveur a besoin d'un token valide.

**Solution : Refresh Token**
1. Lors de la premiere auth Gmail dans le navigateur, demander `access_type=offline` pour obtenir un **refresh token**
2. Stocker le refresh token de maniere securisee (Netlify environment variable ou JSONBin chiffre)
3. La Netlify Function utilise le refresh token pour obtenir un access token a la volee

**Alternative plus simple (V1) :**
- Le cron ne fait PAS l'envoi email lui-meme
- Il verifie juste les relances dues et cree des **actions CRM "Relance teaser a faire"**
- L'envoi effectif se fait manuellement depuis l'ATS quand tu vois l'alerte
- Cela evite la complexite du refresh token dans un premier temps

### 5.3 — Alertes dans l'ATS

Au chargement de l'ATS (dashboard ou page candidat) :
- Verifier les relances dues (`relance_prevue <= today` et `email_status === 'sent'`)
- Afficher un bandeau d'alerte en haut :
  ```
  ⚠️ 3 relances teaser en attente — [Voir les relances]
  ```
- Vue "Relances teaser" dans la page Actions (nouveau filtre/vue)

---

## Phase 6 : KPIs et Dashboard

### 6.1 — KPIs Teaser sur le dashboard

Ajouter une section sur `index.html` :
```
┌─────────────────────────────────────────────────┐
│ ✈️ Teasers                                      │
│ Envoyes: 12   Repondus: 4   Taux: 33%          │
│ En attente: 5  Relances dues: 2                 │
└─────────────────────────────────────────────────┘
```

### 6.2 — Vue "Teasers" dans la page Actions

Ajouter une vue dans `VIEWS` dans `actions.js` :
```js
teasers: {
  label: 'Teasers',
  icon: '✈️',
  filter: () => allActions.filter(a =>
    a.type_action === 'Envoi teaser' || a.type_action === 'Retour teaser'
  )
}
```

---

## Ordre d'implementation

| Etape | Contenu | Fichiers modifies |
|-------|---------|-------------------|
| 1 | `google-auth.js` — OAuth2 unifie (Drive + Gmail) | Nouveau fichier, refactoring `google-drive.js` |
| 2 | `gmail.js` — Module Gmail API | Nouveau fichier |
| 3 | Extension modele Presentation + referentiels | `referentiels.js`, `candidat-detail.js` |
| 4 | Templates teaser email | `templates.js` |
| 5 | Bouton + Modal d'envoi multi-destinataires | `candidat-detail.js` |
| 6 | Actions CRM auto-generees | `candidat-detail.js`, `entreprise.html` |
| 7 | Tracking reponses (polling Gmail) | `candidat-detail.js`, `gmail.js` |
| 8 | Section teasers sur fiche entreprise | `entreprise.html` |
| 9 | Alertes relances dans l'ATS | `dashboard.js`, `actions.js` |
| 10 | Netlify Scheduled Function (cron relances) | `netlify/functions/teaser-followup.js`, `netlify.toml` |
| 11 | KPIs dashboard | `dashboard.js`, `index.html` |
| 12 | Config Gmail (signature, email sender) | `config.js`, modal de configuration |

---

## Prerequis GCP

Avant de commencer le developpement, il faut configurer dans la console Google Cloud :
1. Ajouter les scopes Gmail a l'ecran de consentement OAuth
2. S'assurer que l'application est en mode "interne" (Google Workspace) ou publier l'app si externe
3. Activer l'API Gmail dans le projet GCP

---

## Points de vigilance

- **Rate limiting Gmail** : 500 emails/jour max (Google Workspace). Prevoir un compteur quotidien.
- **Securite** : Le refresh token pour le cron doit etre stocke en variable d'environnement Netlify, jamais dans le code.
- **RGPD** : Log des envois et opt-out par entreprise possible.
- **Backward compat** : Les presentations existantes (sans champ `type`) sont traitees comme `type: 'mission'`.
- **Taille JSONBin** : Si le volume de teasers est important, surveiller la taille des bins (limite JSONBin gratuit).
