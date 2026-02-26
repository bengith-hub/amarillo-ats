// Amarillo ATS — Référentiels (configurable reference data)
// All picklist values, statuses, types, etc. are managed here.
// Users can customize them via the Configuration panel.

const Referentiels = (() => {
  const STORAGE_KEY = 'ats_referentiels';

  // ============================================================
  // DEFAULT VALUES — used on first load or after reset
  // ============================================================
  const DEFAULTS = {
    // --- CANDIDATS ---
    candidat_statuts: [
      'To call', 'Approché', 'En qualification', 'Shortlisté',
      'Présenté', 'Placé', 'Off market', 'Pas prioritaire'
    ],
    candidat_niveaux: ['Junior', 'Middle', 'Top'],
    candidat_diplomes: ['Bac+2 / Bac+3', 'Bac+4', 'Bac+5'],
    candidat_sources: [
      'LinkedIn', 'Cooptation', 'Candidature spontanée',
      'CVthèque', 'Réseau', 'Événement', 'Autre'
    ],

    // --- ENTREPRISES ---
    entreprise_statuts: [
      'À cibler', 'Ciblé', 'Prospection en cours',
      'Client', 'Ancien client', 'Écarté'
    ],
    entreprise_priorites: [
      '1 - Veille', '2 - Basse', '3 - Moyenne',
      '4 - Haute', '5 - Coeur de cible'
    ],
    entreprise_tailles: [
      '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
    ],
    entreprise_secteurs: [
      'Tech / SaaS', 'Conseil / ESN', 'Industrie', 'Finance / Banque',
      'Assurance', 'Retail / E-commerce', 'Santé / Pharma',
      'Énergie / Environnement', 'Telecom / Média', 'Immobilier / BTP',
      'Transport / Logistique', 'Agroalimentaire', 'Luxe / Mode',
      'Services publics', 'Autre'
    ],
    entreprise_sources: [
      'LinkedIn', 'Site web', 'Réseau', 'Presse',
      'Événement', 'Recommandation', 'Prospection directe', 'Autre'
    ],

    // --- DÉCIDEURS ---
    decideur_niveaux_hierarchiques: [
      'COMEX', 'Direction', 'N-1', 'N-2', 'Opérationnel'
    ],
    decideur_roles_decision: [
      'Décideur', 'Influenceur', 'Prescripteur', 'Utilisateur'
    ],
    decideur_niveaux_relation: [
      'À contacter', 'Contacté', 'En relation', 'Champion'
    ],
    decideur_priorites_prospection: ['Haute', 'Moyenne', 'Basse'],
    decideur_fonctions_macro: [
      'DSI / CIO', 'CTO / Directeur Technique', 'CDO / Chief Digital Officer',
      'CISO / RSSI', 'DRH / VP RH', 'DAF / CFO',
      'CEO / DG', 'COO / Directeur des Opérations',
      'VP Engineering', 'Head of Data', 'Head of Product',
      'Directeur de Programme', 'Autre'
    ],
    decideur_sources: [
      'LinkedIn', 'Réseau', 'Événement', 'Site entreprise',
      'Presse', 'Recommandation', 'Autre'
    ],

    // --- ACTIONS / CRM ---
    action_types: [
      'Prise de contact', 'Qualification candidat', 'Présentation candidat',
      'Suivi candidat', 'Prise de référence', 'Suivi intégration',
      'Prospection', 'Relance décideur', 'Cadrage mission',
      'Négociation', "Organisation d'échange", 'Facturation',
      'Envoi teaser', 'Retour teaser', 'Relance teaser', 'Autre'
    ],
    action_canaux: [
      'LinkedIn', 'Appel', 'Email', 'Visio', 'Physique', 'SMS', 'Autre'
    ],
    action_statuts: ['À faire', 'En cours', 'Fait', 'Annulé'],
    action_priorites: ['Haute', 'Moyenne', 'Basse'],

    // --- MISSIONS ---
    mission_statuts: [
      'Ciblage décideurs', 'Cadrage', 'Proposition', 'Mission lancée',
      'Shortlist', 'Entretiens client', 'Offre', 'Placé',
      'Suivi intégration', 'Clôturée'
    ],
    mission_niveaux: ['Junior', 'Middle', 'Top'],

    // --- PRÉSENTATIONS ---
    presentation_statuts: [
      'En attente', 'Intéressé', 'Entretien planifié', 'Refusé', 'Offre'
    ],

    // --- TEASERS ---
    teaser_email_statuts: [
      'Brouillon', 'Envoyé', 'Répondu', 'Intéressé',
      'Entretien planifié', 'Refusé', 'Sans réponse',
      'Bounce', 'Spam/Auto-reply'
    ],
    teaser_relance_delais: ['3 jours', '5 jours', '7 jours', '10 jours', '14 jours'],

    // Mapping de secteurs similaires (pour filtrer les destinataires teaser)
    secteurs_similaires: {
      'Tech / SaaS': ['Conseil / ESN', 'Telecom / Média'],
      'Conseil / ESN': ['Tech / SaaS', 'Telecom / Média'],
      'Telecom / Média': ['Tech / SaaS', 'Conseil / ESN'],
      'Finance / Banque': ['Assurance'],
      'Assurance': ['Finance / Banque'],
      'Santé / Pharma': ['Énergie / Environnement'],
      'Énergie / Environnement': ['Santé / Pharma', 'Industrie'],
      'Industrie': ['Énergie / Environnement', 'Transport / Logistique'],
      'Transport / Logistique': ['Industrie', 'Retail / E-commerce'],
      'Retail / E-commerce': ['Transport / Logistique', 'Luxe / Mode'],
      'Luxe / Mode': ['Retail / E-commerce'],
      'Immobilier / BTP': ['Industrie'],
      'Agroalimentaire': ['Industrie', 'Retail / E-commerce']
    },

    // --- DOCUMENTS ---
    document_types_candidat: [
      'CV', 'Lettre de motivation', 'Fiche d\'entretien', 'Références',
      'Diplôme', 'Contrat', 'Pièce d\'identité', 'Autre'
    ],
    document_types_entreprise: [
      'Contrat cadre', 'Conditions générales', 'Proposition commerciale',
      'Organigramme', 'Fiche entreprise', 'Autre'
    ],
    document_types_decideur: [
      'Carte de visite', 'Notes de réunion', 'Compte-rendu',
      'Proposition', 'Autre'
    ],
    document_types_mission: [
      'Contrat — brouillon', 'Contrat — envoyé', 'Contrat — annoté client',
      'Contrat — signé', 'Proposition commerciale', 'Avenant', 'Autre'
    ],

    // --- LOCALISATIONS ---
    localisations: [
      'Paris', 'Île-de-France', 'Lyon', 'Marseille', 'Toulouse',
      'Bordeaux', 'Nantes', 'Lille', 'Strasbourg', 'Rennes',
      'Montpellier', 'Nice', 'Grenoble', 'France entière',
      'Remote France', 'International', 'Autre'
    ],

    // --- JOURNAL DE SUIVI ---
    journal_categories: [
      'Contexte', 'Relation', 'Signal', 'Besoin', 'Feedback', 'Autre'
    ],
  };

  // ============================================================
  // STORAGE — load / save / reset
  // ============================================================
  function loadAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    try {
      const saved = JSON.parse(raw);
      // Merge: saved overrides defaults, but add any new keys from DEFAULTS
      const merged = { ...DEFAULTS };
      for (const key of Object.keys(saved)) {
        if (Array.isArray(saved[key]) && saved[key].length > 0) {
          merged[key] = saved[key];
        }
      }
      return merged;
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  // Get a single referentiel list
  function get(key) {
    const all = loadAll();
    return all[key] || DEFAULTS[key] || [];
  }

  // Update a single referentiel list
  function set(key, values) {
    const all = loadAll();
    all[key] = values;
    saveAll(all);
  }

  // Add a value to a referentiel list (if not already present)
  function addValue(key, value) {
    const all = loadAll();
    if (!all[key]) all[key] = [...(DEFAULTS[key] || [])];
    if (!all[key].includes(value)) {
      all[key].push(value);
      saveAll(all);
    }
  }

  // Remove a value from a referentiel list
  function removeValue(key, value) {
    const all = loadAll();
    if (!all[key]) return;
    all[key] = all[key].filter(v => v !== value);
    saveAll(all);
  }

  // Reorder a value in the list
  function reorder(key, fromIndex, toIndex) {
    const all = loadAll();
    if (!all[key]) return;
    const item = all[key].splice(fromIndex, 1)[0];
    all[key].splice(toIndex, 0, item);
    saveAll(all);
  }

  // Get all referentiels grouped by category (for display)
  function getCategories() {
    return [
      {
        id: 'candidats',
        label: 'Candidats',
        icon: '👤',
        color: '#3b82f6',
        items: [
          { key: 'candidat_statuts', label: 'Statuts candidat' },
          { key: 'candidat_niveaux', label: 'Niveaux (séniorité)' },
          { key: 'candidat_diplomes', label: 'Diplômes' },
          { key: 'candidat_sources', label: 'Sources candidat' },
        ]
      },
      {
        id: 'entreprises',
        label: 'Entreprises',
        icon: '🏢',
        color: '#10b981',
        items: [
          { key: 'entreprise_statuts', label: 'Statuts entreprise' },
          { key: 'entreprise_priorites', label: 'Priorités entreprise' },
          { key: 'entreprise_tailles', label: 'Tailles' },
          { key: 'entreprise_secteurs', label: 'Secteurs' },
          { key: 'entreprise_sources', label: 'Sources entreprise' },
        ]
      },
      {
        id: 'decideurs',
        label: 'Décideurs',
        icon: '🎯',
        color: '#8b5cf6',
        items: [
          { key: 'decideur_niveaux_hierarchiques', label: 'Niveaux hiérarchiques' },
          { key: 'decideur_roles_decision', label: 'Rôles décision' },
          { key: 'decideur_niveaux_relation', label: 'Niveaux de relation' },
          { key: 'decideur_priorites_prospection', label: 'Priorités prospection' },
          { key: 'decideur_fonctions_macro', label: 'Fonctions macro' },
          { key: 'decideur_sources', label: 'Sources décideur' },
        ]
      },
      {
        id: 'actions',
        label: 'Actions / CRM',
        icon: '⚡',
        color: '#ef4444',
        items: [
          { key: 'action_types', label: "Types d'action" },
          { key: 'action_canaux', label: 'Canaux' },
          { key: 'action_statuts', label: 'Statuts action' },
          { key: 'action_priorites', label: 'Priorités action' },
        ]
      },
      {
        id: 'missions',
        label: 'Missions',
        icon: '📋',
        color: '#FECC02',
        items: [
          { key: 'mission_statuts', label: 'Statuts mission' },
          { key: 'mission_niveaux', label: 'Niveaux mission' },
        ]
      },
      {
        id: 'presentations',
        label: 'Présentations',
        icon: '📄',
        color: '#06b6d4',
        items: [
          { key: 'presentation_statuts', label: 'Statuts présentation' },
        ]
      },
      {
        id: 'teasers',
        label: 'Teasers',
        icon: '✈️',
        color: '#1e293b',
        items: [
          { key: 'teaser_email_statuts', label: 'Statuts email teaser' },
          { key: 'teaser_relance_delais', label: 'Délais de relance' },
        ]
      },
      {
        id: 'documents',
        label: 'Documents',
        icon: '📁',
        color: '#f59e0b',
        items: [
          { key: 'document_types_candidat', label: 'Types de documents (candidats)' },
          { key: 'document_types_entreprise', label: 'Types de documents (entreprises)' },
          { key: 'document_types_decideur', label: 'Types de documents (décideurs)' },
          { key: 'document_types_mission', label: 'Types de documents (missions)' },
        ]
      },
      {
        id: 'commun',
        label: 'Commun',
        icon: '🌍',
        color: '#64748b',
        items: [
          { key: 'localisations', label: 'Localisations' },
        ]
      },
      {
        id: 'journal',
        label: 'Journal de suivi',
        icon: '📓',
        color: '#6366f1',
        items: [
          { key: 'journal_categories', label: 'Catégories du journal' },
        ]
      },
    ];
  }

  // Get defaults for reset
  function getDefaults() {
    return { ...DEFAULTS };
  }

  return {
    get, set, addValue, removeValue, reorder,
    loadAll, saveAll, resetAll,
    getCategories, getDefaults
  };
})();
