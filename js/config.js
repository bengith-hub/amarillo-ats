// Amarillo ATS — Configuration JSONBin
// Ce fichier contient la configuration des bins JSONBin.
// Il est chargé automatiquement, plus besoin de configurer via localStorage.

const ATS_CONFIG = {
  apiKey: '$2a$10$FvDIogJwH4l87MiEdExg6udcabOSwaFpjoL1xTc5KQgUojd6JA4Be',
  bins: {
    candidats: '698a4deeae596e708f1e4f33',
    entreprises: '698a4deed0ea881f40ade47b',
    decideurs: '698a4deeae596e708f1e4f36',
    missions: '698a4defd0ea881f40ade47f',
    actions: '698a4defd0ea881f40ade482',
    facturation: '698a4e0043b1c97be9727eb2',
    references: '698a4e0143b1c97be9727eb5',
    notes: '698a4df143b1c97be9727ea2',
    dsi_sessions: '698880c7ae596e708f1a6944'
  },
  orsApiKey: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjBkMTlhODQyNDhmOTRjZGM4ZDZiMGRmMDBkZGZjN2Q5IiwiaCI6Im11cm11cjY0In0=',
  // Clé API OpenAI pour l'extraction de CV
  // Renseignez votre clé ici ou via localStorage.setItem('ats_openai_key', 'sk-...')
  openaiApiKey: '',
  // Google Drive — Client ID OAuth2 (GCP)
  // Créez-le dans https://console.cloud.google.com/apis/credentials (type: Application Web)
  googleClientId: '',
  // ID du dossier Drive parent pour les candidats (optionnel, vide = racine)
  googleDriveParentFolder: ''
};
