// Amarillo ATS — Gmail API Integration
// Sends emails, creates drafts, tracks threads and replies.
// Uses GoogleAuth for unified OAuth2 authentication.

const Gmail = (function() {

  const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

  // --- Internal helpers ---

  async function _gmailRequest(path, options = {}) {
    const token = GoogleAuth.getAccessToken();
    if (!token) throw new Error('Non authentifié. Appelez GoogleAuth.authenticate() d\'abord.');

    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Erreur Gmail (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    return response.json();
  }

  // Base64url encode (RFC 4648)
  function _base64url(str) {
    // Handle both string and Uint8Array
    if (typeof str === 'string') {
      return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    // Uint8Array
    let binary = '';
    for (let i = 0; i < str.length; i++) binary += String.fromCharCode(str[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Build MIME message with optional attachments
  function _buildMimeMessage({ to, cc, bcc, subject, htmlBody, textBody, attachments, inReplyTo, references }) {
    const boundary = 'amarillo_boundary_' + Date.now();
    const from = GoogleAuth.getSenderEmail();

    let headers = [
      `From: ${from}`,
      `To: ${to}`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    headers.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);
    headers.push('MIME-Version: 1.0');

    // Reply headers
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
      headers.push(`References: ${references || inReplyTo}`);
    }

    if (attachments && attachments.length > 0) {
      // Multipart/mixed with attachments
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      let mime = headers.join('\r\n') + '\r\n\r\n';

      // Body part
      mime += `--${boundary}\r\n`;
      if (htmlBody) {
        mime += 'Content-Type: text/html; charset=UTF-8\r\n';
        mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
        mime += btoa(unescape(encodeURIComponent(htmlBody))) + '\r\n';
      } else {
        mime += 'Content-Type: text/plain; charset=UTF-8\r\n';
        mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
        mime += btoa(unescape(encodeURIComponent(textBody || ''))) + '\r\n';
      }

      // Attachment parts
      for (const att of attachments) {
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
        mime += 'Content-Transfer-Encoding: base64\r\n';
        mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n`;
        mime += att.base64Data + '\r\n';
      }

      mime += `--${boundary}--`;
      return mime;

    } else {
      // Simple message without attachments
      if (htmlBody) {
        headers.push('Content-Type: text/html; charset=UTF-8');
        headers.push('Content-Transfer-Encoding: base64');
        return headers.join('\r\n') + '\r\n\r\n' + btoa(unescape(encodeURIComponent(htmlBody)));
      } else {
        headers.push('Content-Type: text/plain; charset=UTF-8');
        headers.push('Content-Transfer-Encoding: base64');
        return headers.join('\r\n') + '\r\n\r\n' + btoa(unescape(encodeURIComponent(textBody || '')));
      }
    }
  }

  // --- Public API ---

  // Send an email via Gmail API
  // Returns { id, threadId, labelIds }
  async function sendEmail({ to, cc, bcc, subject, htmlBody, textBody, attachments, threadId, inReplyTo, references }) {
    await GoogleAuth.authenticate();

    const mime = _buildMimeMessage({ to, cc, bcc, subject, htmlBody, textBody, attachments, inReplyTo, references });
    const raw = _base64url(mime);

    const body = { raw };
    if (threadId) body.threadId = threadId;

    return _gmailRequest('/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  // Create a draft (not sent)
  async function createDraft({ to, cc, bcc, subject, htmlBody, textBody, attachments }) {
    await GoogleAuth.authenticate();

    const mime = _buildMimeMessage({ to, cc, bcc, subject, htmlBody, textBody, attachments });
    const raw = _base64url(mime);

    return _gmailRequest('/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw } })
    });
  }

  // Get a message by ID
  async function getMessage(messageId) {
    return _gmailRequest(`/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Auto-Submitted&metadataHeaders=X-Autoreply&metadataHeaders=X-Failed-Recipients&metadataHeaders=In-Reply-To`);
  }

  // Get a full thread
  async function getThread(threadId) {
    return _gmailRequest(`/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Auto-Submitted&metadataHeaders=X-Autoreply&metadataHeaders=X-Failed-Recipients`);
  }

  // Search messages
  async function searchMessages(query, maxResults = 10) {
    return _gmailRequest(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  }

  // Check if a thread has replies beyond the original message
  // Returns { hasReply, replyType, replyCount }
  // replyType: 'human' | 'auto-reply' | 'bounce' | null
  async function checkForReplies(threadId, originalMessageId) {
    try {
      await GoogleAuth.authenticate();
      const thread = await getThread(threadId);

      if (!thread.messages || thread.messages.length <= 1) {
        return { hasReply: false, replyType: null, replyCount: 0 };
      }

      // Find messages that are NOT our original
      const replies = thread.messages.filter(m => m.id !== originalMessageId);
      if (replies.length === 0) {
        return { hasReply: false, replyType: null, replyCount: 0 };
      }

      // Analyze the latest reply headers
      const latest = replies[replies.length - 1];
      const headers = {};
      if (latest.payload && latest.payload.headers) {
        for (const h of latest.payload.headers) {
          headers[h.name.toLowerCase()] = h.value;
        }
      }

      // Detect auto-replies and bounces
      if (headers['auto-submitted'] && headers['auto-submitted'] !== 'no') {
        return { hasReply: true, replyType: 'auto-reply', replyCount: replies.length };
      }
      if (headers['x-autoreply'] === 'yes') {
        return { hasReply: true, replyType: 'auto-reply', replyCount: replies.length };
      }
      if (headers['x-failed-recipients']) {
        return { hasReply: true, replyType: 'bounce', replyCount: replies.length };
      }

      // Check if reply is from a mailer-daemon (bounce)
      const from = headers['from'] || '';
      if (from.toLowerCase().includes('mailer-daemon') || from.toLowerCase().includes('postmaster')) {
        return { hasReply: true, replyType: 'bounce', replyCount: replies.length };
      }

      return { hasReply: true, replyType: 'human', replyCount: replies.length };

    } catch (e) {
      console.warn('checkForReplies error:', e.message);
      return { hasReply: false, replyType: null, replyCount: 0 };
    }
  }

  // Helper: convert jsPDF document to base64 attachment
  function pdfToAttachment(pdfDoc, filename) {
    const pdfOutput = pdfDoc.output('arraybuffer');
    const bytes = new Uint8Array(pdfOutput);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64Data = btoa(binary);

    return {
      filename: filename,
      mimeType: 'application/pdf',
      base64Data: base64Data
    };
  }

  // Helper: build HTML email body from text + signature
  function buildHtmlBody(textContent, signature) {
    const sig = signature || GoogleAuth.getEmailSignature();
    const htmlText = textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    const htmlSig = sig
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;line-height:1.6;">
${htmlText}
<br/><br/>
<div style="color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:12px;">
${htmlSig}
</div>
</div>`;
  }

  // Helper: replace template variables in text
  function replaceVariables(text, vars) {
    let result = text;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }
    return result;
  }

  return {
    sendEmail,
    createDraft,
    getMessage,
    getThread,
    searchMessages,
    checkForReplies,
    pdfToAttachment,
    buildHtmlBody,
    replaceVariables
  };

})();
