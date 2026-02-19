// Amarillo ATS — Google Drive Integration
// Authentification OAuth2 via Google Identity Services (GIS)
// Création de dossiers et upload de fichiers vers Google Drive.

const GoogleDrive = (function() {

  const SCOPES = 'https://www.googleapis.com/auth/drive';
  let _tokenClient = null;
  let _accessToken = null;
  let _tokenExpiry = 0;

  // --- Configuration ---

  function getClientId() {
    return localStorage.getItem('ats_google_client_id') || ATS_CONFIG.googleClientId || '';
  }

  function setClientId(id) {
    localStorage.setItem('ats_google_client_id', id);
  }

  function getParentFolderId() {
    return localStorage.getItem('ats_google_drive_parent') || ATS_CONFIG.googleDriveParentFolder || '';
  }

  function setParentFolderId(id) {
    localStorage.setItem('ats_google_drive_parent', id);
  }

  function isConfigured() {
    return !!getClientId();
  }

  // --- OAuth2 Authentication via GIS ---

  function _ensureGisLoaded() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      throw new Error('Google Identity Services non chargé. Vérifiez votre connexion internet.');
    }
  }

  function _initTokenClient() {
    if (_tokenClient) return _tokenClient;
    _ensureGisLoaded();

    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPES,
      callback: () => {} // sera remplacé à chaque appel
    });
    return _tokenClient;
  }

  // Demander un access token via popup de consentement Google
  function authenticate() {
    return new Promise((resolve, reject) => {
      if (_accessToken && Date.now() < _tokenExpiry) {
        resolve(_accessToken);
        return;
      }

      try {
        const client = _initTokenClient();
        client.callback = (response) => {
          if (response.error) {
            reject(new Error(`Erreur d'authentification Google: ${response.error}`));
            return;
          }
          _accessToken = response.access_token;
          _tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000; // marge de 1 min
          resolve(_accessToken);
        };
        client.error_callback = (err) => {
          reject(new Error('Authentification Google annulée ou échouée.'));
        };
        client.requestAccessToken();
      } catch (e) {
        reject(e);
      }
    });
  }

  // --- Google Drive API calls ---

  async function _driveRequest(path, options = {}) {
    const token = _accessToken;
    if (!token) throw new Error('Non authentifié. Appelez authenticate() d\'abord.');

    const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Erreur Drive (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    return response.json();
  }

  // Créer un dossier dans Google Drive
  async function createFolder(folderName, parentId) {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    const result = await _driveRequest('/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });

    return {
      id: result.id,
      url: `https://drive.google.com/drive/folders/${result.id}`
    };
  }

  // Uploader un fichier dans un dossier Drive
  async function uploadFile(file, folderId) {
    const token = _accessToken;
    if (!token) throw new Error('Non authentifié.');

    // Utiliser l'API multipart upload pour envoyer metadata + contenu en une requête
    const metadata = {
      name: file.name,
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Erreur upload Drive (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    const result = await response.json();
    return {
      id: result.id,
      name: result.name,
      url: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`
    };
  }

  // --- Flow complet : créer dossier + uploader CV ---

  async function createCandidatFolderAndUploadCV(candidatName, file) {
    // 1. Authentification
    await authenticate();

    const parentId = getParentFolderId();

    // 2. Créer le dossier du candidat
    let folder;
    try {
      folder = await createFolder(candidatName, parentId || undefined);
    } catch (e) {
      if (parentId && e.message.includes('404')) {
        throw new Error(`Dossier parent Drive introuvable (ID: ${parentId}). Vérifiez l'ID dans la configuration Google Drive.`);
      }
      throw e;
    }

    // 3. Uploader le CV
    const uploaded = await uploadFile(file, folder.id);

    return {
      folderUrl: folder.url,
      folderId: folder.id,
      document: {
        id: 'doc_' + Date.now(),
        nom: `CV ${candidatName}`,
        url: uploaded.url,
        type: 'CV',
        date_ajout: new Date().toISOString().split('T')[0]
      }
    };
  }

  // --- UI : modale de configuration Google Drive ---

  function showConfigModal(onConfigured) {
    const currentClientId = getClientId();
    const currentParent = getParentFolderId();

    const bodyHtml = `
      <div class="form-group">
        <label>Client ID OAuth2 (GCP)</label>
        <input type="text" id="f-google-client-id" value="${currentClientId}" placeholder="xxxxx.apps.googleusercontent.com" style="font-family:monospace;font-size:0.8rem;" />
        <small style="color:#64748b;">Créez un Client ID OAuth2 dans la <a href="https://console.cloud.google.com/apis/credentials" target="_blank">console GCP</a> (type : Application Web, origines autorisées : votre domaine)</small>
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label>Dossier parent Drive (optionnel)</label>
        <input type="text" id="f-google-parent-folder" value="${currentParent}" placeholder="ID du dossier parent (ex: 1ABC123...)" style="font-family:monospace;font-size:0.8rem;" />
        <small style="color:#64748b;">ID du dossier Drive dans lequel créer les sous-dossiers candidats. Laissez vide pour créer à la racine.</small>
      </div>
    `;

    UI.modal('Configuration Google Drive', bodyHtml, {
      width: 500,
      saveLabel: 'Enregistrer',
      onSave: async (overlay) => {
        const clientId = overlay.querySelector('#f-google-client-id').value.trim();
        const parentFolder = overlay.querySelector('#f-google-parent-folder').value.trim();

        if (!clientId) {
          UI.toast('Le Client ID est requis', 'error');
          throw new Error('validation');
        }
        if (!clientId.includes('.apps.googleusercontent.com')) {
          UI.toast('Le Client ID doit se terminer par .apps.googleusercontent.com', 'error');
          throw new Error('validation');
        }

        setClientId(clientId);
        setParentFolderId(parentFolder);
        _tokenClient = null; // reset pour prendre le nouveau client ID
        UI.toast('Configuration Google Drive enregistrée');
        if (onConfigured) onConfigured();
      }
    });
  }

  return {
    isConfigured,
    getClientId,
    setClientId,
    getParentFolderId,
    setParentFolderId,
    authenticate,
    createFolder,
    uploadFile,
    createCandidatFolderAndUploadCV,
    showConfigModal
  };

})();
