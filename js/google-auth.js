// Amarillo ATS — Google Auth (unified OAuth2 for Drive + Gmail)
// Centralizes authentication so Drive and Gmail share a single token.

const GoogleAuth = (function() {

  // Combined scopes: Drive + Gmail
  const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ].join(' ');

  let _tokenClient = null;
  let _accessToken = null;
  let _tokenExpiry = 0;

  function getClientId() {
    return localStorage.getItem('ats_google_client_id') || ATS_CONFIG.googleClientId || '';
  }

  function setClientId(id) {
    localStorage.setItem('ats_google_client_id', id);
  }

  function isConfigured() {
    return !!getClientId();
  }

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
      callback: () => {} // replaced on each authenticate() call
    });
    return _tokenClient;
  }

  // Request an access token via Google consent popup
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
          _tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000; // 1 min margin
          resolve(_accessToken);
        };
        client.error_callback = () => {
          reject(new Error('Authentification Google annulée ou échouée.'));
        };
        client.requestAccessToken();
      } catch (e) {
        reject(e);
      }
    });
  }

  // Get current access token (must call authenticate() first)
  function getAccessToken() {
    return _accessToken;
  }

  // Check if token is still valid
  function isAuthenticated() {
    return _accessToken && Date.now() < _tokenExpiry;
  }

  // Reset token client (e.g. after changing Client ID)
  function reset() {
    _tokenClient = null;
    _accessToken = null;
    _tokenExpiry = 0;
  }

  // Get sender email from config
  function getSenderEmail() {
    return localStorage.getItem('ats_gmail_sender_email') || ATS_CONFIG.gmailSenderEmail || 'benjamin.fetu@amarillosearch.com';
  }

  function setSenderEmail(email) {
    localStorage.setItem('ats_gmail_sender_email', email);
  }

  // Get email signature from config
  function getEmailSignature() {
    const saved = localStorage.getItem('ats_email_signature');
    if (saved) return saved;
    return 'Benjamin Fetu\nAmarillo Search — Executive Search & Recrutement\nbenjamin.fetu@amarillosearch.com';
  }

  function setEmailSignature(sig) {
    localStorage.setItem('ats_email_signature', sig);
  }

  return {
    getClientId,
    setClientId,
    isConfigured,
    authenticate,
    getAccessToken,
    isAuthenticated,
    reset,
    getSenderEmail,
    setSenderEmail,
    getEmailSignature,
    setEmailSignature,
    SCOPES
  };

})();
