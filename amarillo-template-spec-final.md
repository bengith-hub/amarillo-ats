# Spécification technique — Template "Talent à Impact" — Amarillo Search
# VERSION FINALE POUR CLAUDE CODE

> **Contexte** : Ce document combine deux sources :
> - **Image de référence graphique** (design cible) → pour le style visuel, les arrondis, ombres, espacements, couleurs
> - **Design Canva** (ID `DAHCDS2hMIw`) → pour le header/footer définitifs et la structure des données
>
> **Le contenu textuel est un mock-up** (données d'exemple). Seuls le header et le footer sont définitifs.
> Le template doit accepter des données dynamiques injectées pour chaque candidat.

---

## 1. FORMAT GÉNÉRAL

- **Orientation** : Portrait, format A4 (210 × 297 mm / 794 × 1123 px à 96dpi)
- **Fond de page** : Blanc `#FFFFFF`
- **Marges latérales du corps** : ~40px gauche/droite
- **Header et footer** : Pleine largeur (bord à bord, pas de marge)
- **Ombre portée globale** : Légère ombre autour du document (effet carte) — `box-shadow: 0 2px 20px rgba(0,0,0,0.1)`

---

## 2. PALETTE DE COULEURS

```css
:root {
  --amarillo-yellow: #F5B731;        /* Jaune principal — accents, lignes, bordures gauches, puces */
  --amarillo-yellow-light: #FFF3D0;  /* Jaune pâle — fond encadrés Impact & Lecture */
  --amarillo-dark: #2D3436;          /* Gris anthracite — header & footer */
  --amarillo-text: #1A1A1A;          /* Texte principal noir */
  --amarillo-text-secondary: #555555;/* Texte secondaire */
  --amarillo-text-muted: #888888;    /* Labels gris clair (FONCTION, ZONE...) */
  --amarillo-border: #E0E0E0;        /* Bordures fines encadrés */
  --amarillo-white: #FFFFFF;          /* Fond page + encadré conditions */
  --amarillo-confidential: #999999;  /* Texte mention confidentielle */
}
```

---

## 3. TYPOGRAPHIES

| Usage | Police | Taille | Poids | Couleur | Notes |
|-------|--------|--------|-------|---------|-------|
| "TALENT IMPACT" | Serif (Playfair Display ou DM Serif Display) | 36-40px | Bold | `#FFFFFF` | Header, côté droit |
| Titre du poste | Même serif | 22-24px | Bold | `#1A1A1A` | Centré, sous la ligne jaune |
| Labels métadonnées | Sans-serif (Inter / Open Sans) | 11-12px | Regular | `#888888` | MAJUSCULES |
| Valeurs métadonnées | Sans-serif | 14px | Bold | `#1A1A1A` | Après les labels |
| Sous-valeurs métadonnées | Sans-serif | 12px | Regular | `#555555` | Ligne 2 des métadonnées |
| Titres de sections | Sans-serif | 16-18px | Bold | `#1A1A1A` | "Impact stratégique...", "Lecture stratégique..." |
| Corps texte / puces | Sans-serif | 13-14px | Regular | `#333333` | Listes à puces |
| Mots-clés bold dans conditions | Sans-serif | 13-14px | Bold | `#333333` | "Mobilité", "Rémunération cible", "Préavis" |
| Mention confidentielle | Sans-serif | 11px | Italic | `#999999` | Centré, avant footer |
| Description footer | Sans-serif | 11-12px | Regular | `#FFFFFF` | Texte blanc sur fond sombre |
| Email footer | Sans-serif | 12px | Bold | `#F5B731` | Jaune sur fond sombre |
| "Talent à Impact · Document confidentiel" | Sans-serif | 11px | Regular | `#F5B731` | Centré en bas du footer |

---

## 4. STRUCTURE DÉTAILLÉE

### 4.1 — HEADER ✅ DÉFINITIF

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [LOGO PNG]                        TALENT              │
│   Amarillo Search                   IMPACT              │
│                                                         │
│                    fond: #2D3436                         │
└─────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━ ligne jaune 3-4px ━━━━━━━━━━━━━━━━━
```

- **Hauteur** : ~160-180px
- **Fond** : `#2D3436`
- **Pleine largeur** (pas de marge)
- **Layout** : `display: flex; justify-content: space-between; align-items: center;`
- **Padding** : ~30-40px horizontal, ~25px vertical

**Côté gauche :**
- Image `AS_white_transp.png` (logo blanc transparent, 1536×1024px original)
- Affichée à ~200px de large (garder le ratio)
- Le logo contient : cercle jaune avec motif éventail + "Amarillo" gros + "Search" dessous — tout ça fait partie de l'image PNG

**Côté droit :**
- Texte `"TALENT"` (ligne 1) + `"IMPACT"` (ligne 2)
- Police **serif bold**, ~36-40px, blanc `#FFFFFF`
- Aligné à droite, centré verticalement

**Ligne jaune sous le header :**
- Couleur : `#F5B731`
- Épaisseur : 3-4px
- Pleine largeur

---

### 4.2 — TITRE DU POSTE (mock-up — dynamique)

- **Marge supérieure** : ~25px après la ligne jaune
- **Contenu exemple** : "DSI industriel – Transformation & structuration multi-sites"
- **Style** : Serif bold, 22-24px, `#1A1A1A`, centré
- **Variable** : `{{titre_poste}}`

---

### 4.3 — BARRE DE MÉTADONNÉES (mock-up — dynamique)

Basé sur l'image de référence : **4 colonnes sur 1 ligne principale**, séparées par des traits verticaux gris fins.

Le Canva a 5 champs (FONCTION, ZONE, EQUIPE, BUDGET IT, PERIMETRE) sur 2 lignes.

**Structure recommandée** : Grille flexible qui s'adapte au nombre de champs.

```
┌──────────────┬──────────────────────┬──────────────┬──────────────┐
│ FONCTION     │ ZONE                 │ PÉRIMÈTRE    │ ÉQUIPE       │
│ DSI          │ NANTES               │              │ 25 pers.     │
│              │ Multi-sites – Groupe │              │              │
│              │ industriel           │              │              │
└──────────────┴──────────────────────┴──────────────┴──────────────┘
```

- Chaque colonne :
  - Label en **MAJUSCULES**, `#888888`, 11px, regular
  - Valeur en **bold**, `#1A1A1A`, 14px
  - Sous-valeur optionnelle en regular, `#555555`, 12px
- Séparateurs verticaux : `border-right: 1px solid #CCCCCC`, hauteur ~40px, centrés
- Hauteur zone : ~80px
- Padding horizontal : ~40px (aligné avec les marges du corps)

**Variables** : `{{fonction}}`, `{{zone}}`, `{{perimetre}}`, `{{equipe}}`, `{{budget_it}}` (optionnel)

---

### 4.4 — SECTION IMPACT + CONDITIONS (mock-up — dynamique)

**Layout** : 2 colonnes, ratio **~60% / 40%**, gap ~20px

#### Colonne gauche — Encadré "Impact stratégique & opérationnel"

```css
.impact-box {
  background: #FFF3D0;          /* jaune pâle */
  border-left: 5px solid #F5B731; /* barre jaune gauche épaisse */
  border-radius: 10px;
  padding: 20px;
}
```

- **Titre** : "Impact stratégique & opérationnel", bold, 16px, `#1A1A1A`
- **Liste à puces** (`<ul>`, disques noirs `•`) :
  - Chaque item : regular, 13-14px, `#333333`
  - Espacement entre items : ~8px
- **Variable** : `{{impact_items[]}}` — tableau de strings

#### Colonne droite — Encadré "Conditions & Disponibilité"

```css
.conditions-box {
  background: #FFFFFF;
  border: 1px solid #E0E0E0;
  border-radius: 10px;
  padding: 20px;
}
```

- **Titre** : "Conditions & Disponibilité", bold, 16px, `#1A1A1A`, **centré**
- **Séparateur sous le titre** : ligne jaune `#F5B731`, ~2px épaisseur, ~60% largeur, centrée, marge ~10px
- **Liste** avec mots-clés en bold :
  ```
  • En poste actuellement
  • Mobilité : Grand Ouest / Nationale        ← "Mobilité" en bold
  • Rémunération cible : 120-135k€ fixe + variable  ← "Rémunération cible" en bold
  • Préavis : 3 mois                           ← "Préavis" en bold
  ```
- **Variables** : `{{statut}}`, `{{mobilite}}`, `{{remuneration}}`, `{{preavis}}`

---

### 4.5 — SECTION "LECTURE STRATÉGIQUE AMARILLO" (mock-up — dynamique)

- **Titre** : "Lecture stratégique Amarillo"
  - Bold, 18px, `#1A1A1A`, aligné à gauche
  - Le mot "Amarillo" peut être en jaune `#F5B731` (d'après l'image de référence) ou noir

- **Encadré** :
```css
.lecture-box {
  background: #FFF3D0;
  border-left: 5px solid #F5B731;
  border-radius: 10px;
  padding: 20px;
  width: 100%;               /* pleine largeur du corps */
}
```

- **Liste à puces** : regular, 13-14px, `#333333`
- **Variable** : `{{lecture_items[]}}` — tableau de strings

---

### 4.6 — MENTION CONFIDENTIELLE (semi-statique)

- **Texte** : "Ce document est confidentiel. L'identité du candidat sera communiquée après accord mutuel pour poursuivre le processus."
- **Style** : Italic, 11px, `#999999`, centré
- **Marge** : ~25-30px au-dessus et en-dessous

---

### 4.7 — FOOTER ✅ DÉFINITIF

```
━━━━━━━━━━━━━━━━━━━━━ ligne jaune 3-4px ━━━━━━━━━━━━━━━━━
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [LOGO]    Cabinet de search et d'approche directe      │
│            spécialisé dans le recrutement de profils    │
│            middle et top management pour des rôles      │
│            à enjeu stratégique.                         │
│            benjamin.fetu@amarillosearch.com             │
│                                                         │
│         Talent à Impact · Document confidentiel         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Ligne jaune au-dessus** : `#F5B731`, 3-4px, pleine largeur
- **Fond** : `#2D3436`
- **Hauteur** : ~120-140px
- **Pleine largeur** (bord à bord)

**Layout principal** : `display: flex; align-items: center;`
- **Gauche (~30%)** : Logo `AS_white_transp.png`, ~120px de large
- **Droite (~70%)** :
  - Description : "Cabinet de search et d'approche directe spécialisé dans le recrutement de profils middle et top management pour des rôles à enjeu stratégique."
    - 11-12px, regular, `#FFFFFF`
  - Email : "benjamin.fetu@amarillosearch.com"
    - 12px, **bold**, `#F5B731`

**Ligne centrée en bas** :
- "Talent à Impact · Document confidentiel"
- 11px, regular, `#F5B731`
- Centré horizontalement

---

## 5. ASSET OBLIGATOIRE

### Logo : `AS_white_transp.png`
- **ID Canva** : `MAHAX8XpQk4`
- **Dimensions originales** : 1536 × 1024 px
- **Format** : PNG, fond transparent, logo en blanc
- **Contenu** : Cercle jaune avec motif éventail (rayons) + texte "Amarillo" + "Search"
- **Utilisé 2 fois** : header (grande taille ~200px) et footer (petite taille ~120px)
- **⚠️ DOIT ÊTRE EXPORTÉ depuis Canva** et fourni comme fichier dans le projet
- Ne peut PAS être reproduit en CSS

---

## 6. DONNÉES DYNAMIQUES — STRUCTURE JAVASCRIPT

```javascript
const candidateData = {
  // Titre du poste
  titre_poste: "DSI industriel – Transformation & structuration multi-sites",
  
  // Métadonnées (barre d'infos sous le titre)
  metadonnees: [
    { label: "FONCTION", valeur: "DSI" },
    { label: "ZONE", valeur: "NANTES", sous_valeur: "Multi-sites – Groupe industriel" },
    { label: "PÉRIMÈTRE", valeur: "" },       // optionnel
    { label: "ÉQUIPE", valeur: "25 pers." },
    { label: "BUDGET IT", valeur: "6 M€" },   // optionnel
  ],
  
  // Encadré Impact stratégique
  impact_titre: "Impact stratégique & opérationnel",
  impact_items: [
    "Structuration DSI post-acquisition (3 sociétés intégrées)",
    "Refonte ERP groupe (SAP / Dynamics / autre)",
    "Réduction OPEX IT de 18 %",
    "Mise en place gouvernance & comité IT",
    "Pilotage cybersécurité ISO 27001",
    "Accompagnement croissance de 60M€ → 140M€"
  ],
  
  // Encadré Conditions
  conditions: [
    { texte: "En poste actuellement" },
    { label: "Mobilité", texte: "Grand Ouest / Nationale" },
    { label: "Rémunération cible", texte: "120 - 135k€ fixe + variable" },
    { label: "Préavis", texte: "3 mois" }
  ],
  
  // Encadré Lecture stratégique
  lecture_titre: "Lecture stratégique Amarillo",
  lecture_items: [
    "Capacité à structurer avant changement d'échelle",
    "Culture terrain + vision comité de direction",
    "Expérience d'environnements actionnariaux exigeants",
    "Leadership adapté aux organisations familiales ou groupes"
  ],
  
  // Texte confidentiel
  mention_confidentialite: "Ce document est confidentiel. L'identité du candidat sera communiquée après accord mutuel pour poursuivre le processus."
};

// FOOTER — STATIQUE (ne change pas par candidat)
const footerData = {
  description: "Cabinet de search et d'approche directe spécialisé dans le recrutement de profils middle et top management pour des rôles à enjeu stratégique.",
  email: "benjamin.fetu@amarillosearch.com",
  baseline: "Talent à Impact · Document confidentiel"
};
```

---

## 7. ÉLÉMENTS DE DESIGN GRAPHIQUE IMPORTANTS (depuis l'image de référence)

Ces détails viennent de l'image de référence graphique et donnent au template son aspect professionnel :

1. **Coins arrondis** : Tous les encadrés ont `border-radius: 10px`
2. **Barre jaune gauche** des encadrés Impact et Lecture : `border-left: 5px solid #F5B731` — elle donne une identité visuelle forte
3. **Séparateur jaune sous le titre "Conditions"** : fine ligne centrée, ~60% largeur
4. **Séparateurs verticaux** dans les métadonnées : fins, gris, centrés en hauteur
5. **Espacement aéré** : ~25px entre chaque section majeure
6. **Pas d'ombres internes** sur les encadrés (design plat/flat)
7. **Les lignes jaunes** header↔corps et corps↔footer sont des éléments visuels forts qui encadrent le contenu
8. **Le fond gris anthracite** du header/footer crée un contraste élégant avec le corps blanc
9. **Les puces** sont des disques noirs standards (•)

---

## 8. CHECKLIST POUR CLAUDE CODE

- [ ] Créer le composant HTML/CSS (ou React) reproduisant ce layout
- [ ] Importer le logo `AS_white_transp.png` comme asset
- [ ] Utiliser une police **serif** pour "TALENT IMPACT" et le titre du poste
- [ ] Utiliser une police **sans-serif** pour tout le reste
- [ ] Implémenter le format **A4 imprimable** avec `@media print`
- [ ] Rendre toutes les données **dynamiques** (variables/props)
- [ ] Les métadonnées doivent supporter un **nombre variable de champs** (4 à 6)
- [ ] Les listes à puces doivent supporter un **nombre variable d'items**
- [ ] Le header et footer sont **identiques pour tous les candidats**
- [ ] Tester le rendu en PDF (via `print` ou librairie type Puppeteer/html-pdf)
