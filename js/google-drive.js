// Amarillo ATS — Google Drive Integration
// Uses GoogleAuth for unified OAuth2 authentication (Drive + Gmail).
// Création de dossiers et upload de fichiers vers Google Drive.

const GoogleDrive = (function() {

  // --- Configuration ---

  function getParentFolderId() {
    return localStorage.getItem('ats_google_drive_parent') || ATS_CONFIG.googleDriveParentFolder || '';
  }

  function setParentFolderId(id) {
    localStorage.setItem('ats_google_drive_parent', id);
  }

  function isConfigured() {
    return GoogleAuth.isConfigured();
  }

  // Authenticate via unified GoogleAuth
  async function authenticate() {
    return GoogleAuth.authenticate();
  }

  // --- Google Drive API calls ---

  async function _driveRequest(path, options = {}) {
    const token = GoogleAuth.getAccessToken();
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
    const token = GoogleAuth.getAccessToken();
    if (!token) throw new Error('Non authentifié.');

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

  // Télécharger un fichier depuis Google Drive (retourne un Blob)
  async function downloadFile(fileId) {
    const token = GoogleAuth.getAccessToken();
    if (!token) throw new Error('Non authentifié. Appelez authenticate() d\'abord.');

    const meta = await _driveRequest(`/files/${fileId}?fields=name,mimeType`);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Erreur téléchargement Drive (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    return {
      name: meta.name,
      mimeType: meta.mimeType,
      blob: await response.blob()
    };
  }

  // Lister les fichiers dans un dossier Drive
  async function listFilesInFolder(folderId) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const result = await _driveRequest(`/files?q=${q}&fields=files(id,name,mimeType,webViewLink)&orderBy=modifiedTime desc`);
    return result.files || [];
  }

  // --- Flow complet : créer dossier + uploader CV ---

  async function createCandidatFolderAndUploadCV(candidatName, file) {
    await authenticate();

    const parentId = getParentFolderId();

    let folder;
    try {
      folder = await createFolder(candidatName, parentId || undefined);
    } catch (e) {
      if (parentId && e.message.includes('404')) {
        throw new Error(`Dossier parent Drive introuvable (ID: ${parentId}). Vérifiez l'ID dans la configuration Google Drive.`);
      }
      throw e;
    }

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
    const currentClientId = GoogleAuth.getClientId();
    const currentParent = getParentFolderId();
    const currentSender = GoogleAuth.getSenderEmail();
    const currentSignature = GoogleAuth.getEmailSignature();

    const bodyHtml = `
      <div class="form-group">
        <label>Client ID OAuth2 (GCP)</label>
        <input type="text" id="f-google-client-id" value="${currentClientId}" placeholder="xxxxx.apps.googleusercontent.com" style="font-family:monospace;font-size:0.8rem;" />
        <small style="color:#64748b;">Créez un Client ID OAuth2 dans la <a href="https://console.cloud.google.com/apis/credentials" target="_blank">console GCP</a> (type : Application Web, origines autorisées : votre domaine). Scopes requis : Drive + Gmail.</small>
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label>Dossier parent Drive (optionnel)</label>
        <input type="text" id="f-google-parent-folder" value="${currentParent}" placeholder="ID du dossier parent (ex: 1ABC123...)" style="font-family:monospace;font-size:0.8rem;" />
        <small style="color:#64748b;">ID du dossier Drive dans lequel créer les sous-dossiers candidats. Laissez vide pour créer à la racine.</small>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <div style="font-size:0.8125rem;font-weight:700;color:#1e293b;margin-bottom:12px;">Configuration Gmail</div>
        <div class="form-group">
          <label>Email expéditeur</label>
          <input type="email" id="f-gmail-sender" value="${UI.escHtml(currentSender)}" placeholder="benjamin.fetu@amarillosearch.com" />
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Signature email</label>
          <textarea id="f-gmail-signature" style="min-height:80px;font-size:0.8125rem;">${UI.escHtml(currentSignature)}</textarea>
          <small style="color:#64748b;">Signature ajoutée automatiquement à chaque email teaser.</small>
        </div>
      </div>
    `;

    UI.modal('Configuration Google (Drive + Gmail)', bodyHtml, {
      width: 540,
      saveLabel: 'Enregistrer',
      onSave: async (overlay) => {
        const clientId = overlay.querySelector('#f-google-client-id').value.trim();
        const parentFolder = overlay.querySelector('#f-google-parent-folder').value.trim();
        const senderEmail = overlay.querySelector('#f-gmail-sender').value.trim();
        const signature = overlay.querySelector('#f-gmail-signature').value.trim();

        if (!clientId) {
          UI.toast('Le Client ID est requis', 'error');
          throw new Error('validation');
        }
        if (!clientId.includes('.apps.googleusercontent.com')) {
          UI.toast('Le Client ID doit se terminer par .apps.googleusercontent.com', 'error');
          throw new Error('validation');
        }

        GoogleAuth.setClientId(clientId);
        setParentFolderId(parentFolder);
        if (senderEmail) GoogleAuth.setSenderEmail(senderEmail);
        if (signature) GoogleAuth.setEmailSignature(signature);
        GoogleAuth.reset(); // reset token client for new config
        UI.toast('Configuration Google enregistrée');
        if (onConfigured) onConfigured();
      }
    });
  }

  return {
    isConfigured,
    getParentFolderId,
    setParentFolderId,
    authenticate,
    createFolder,
    uploadFile,
    downloadFile,
    listFilesInFolder,
    createCandidatFolderAndUploadCV,
    showConfigModal
  };

})();
