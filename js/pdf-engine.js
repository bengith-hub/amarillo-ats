// Amarillo ATS — PDF Engine
// Moteur de génération PDF brandé Amarillo Search
// Utilise jsPDF (chargé via CDN) pour générer des documents professionnels.

const PDFEngine = (() => {

  // ============================================================
  // BRAND CONSTANTS
  // ============================================================

  const BRAND = {
    // Couleurs principales (valeurs RGB pour jsPDF)
    primary:      [254, 204, 2],     // #FECC02 — jaune Amarillo
    primaryDark:  [224, 180, 0],     // #e0b400
    dark:         [30, 41, 59],      // #1e293b — sidebar / titres
    text:         [51, 65, 85],      // #334155 — corps de texte
    textLight:    [100, 116, 139],   // #64748b — texte secondaire
    lightGray:    [241, 245, 249],   // #f1f5f9 — fond clair
    border:       [226, 232, 240],   // #e2e8f0
    white:        [255, 255, 255],
    black:        [0, 0, 0],

    // Couleurs des 3 piliers DSI
    pillarLeadership:  [254, 204, 2],   // #FECC02
    pillarOps:         [45, 106, 79],   // #2D6A4F
    pillarInnovation:  [58, 91, 160],   // #3A5BA0

    // Couleurs de scoring
    scoreHigh:    [22, 163, 106],    // #16a36a
    scoreMedium:  [254, 204, 2],     // #FECC02
    scoreLow:     [232, 168, 56],    // #E8A838
    scoreCritical:[220, 38, 38],     // #dc2626

    // Identité
    companyName:  'Amarillo Search',
    tagline:      'Executive Search & IT Leadership',
    font:         'helvetica',
  };

  // ============================================================
  // PAGE SETUP (A4 mm)
  // ============================================================

  const PAGE = {
    width:         210,
    height:        297,
    marginLeft:    20,
    marginRight:   20,
    marginTop:     30,
    marginBottom:  25,
    get contentWidth() { return this.width - this.marginLeft - this.marginRight; },
    get maxY() { return this.height - this.marginBottom; },
  };

  // ============================================================
  // DOCUMENT CREATION
  // ============================================================

  function createDocument(options = {}) {
    if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      throw new Error('jsPDF non chargé. Ajoutez le script CDN jsPDF à la page.');
    }
    const JsPDF = (typeof jspdf !== 'undefined') ? jspdf.jsPDF : jsPDF;

    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    doc.setFont(BRAND.font);

    // Metadata
    doc.setProperties({
      title: options.title || 'Amarillo Search',
      subject: options.subject || '',
      author: BRAND.companyName,
      creator: 'Amarillo ATS',
    });

    return doc;
  }

  // ============================================================
  // HEADER (haut de chaque page)
  // ============================================================

  function addHeader(doc, title, subtitle) {
    const y = 10;

    // Bande jaune en haut
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, PAGE.width, 4, 'F');

    // Logo "A" dans un cercle jaune
    doc.setFillColor(...BRAND.primary);
    doc.circle(PAGE.marginLeft + 5, y + 7, 5, 'F');
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.white);
    doc.text('A', PAGE.marginLeft + 5, y + 9, { align: 'center' });

    // Nom de la société
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.dark);
    doc.text(BRAND.companyName, PAGE.marginLeft + 14, y + 6);

    // Tagline
    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.textLight);
    doc.text(BRAND.tagline, PAGE.marginLeft + 14, y + 10);

    // Titre du document (aligné à droite)
    if (title) {
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.dark);
      doc.text(title, PAGE.width - PAGE.marginRight, y + 6, { align: 'right' });
    }

    // Sous-titre
    if (subtitle) {
      doc.setFont(BRAND.font, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.textLight);
      doc.text(subtitle, PAGE.width - PAGE.marginRight, y + 10, { align: 'right' });
    }

    // Ligne séparatrice sous le header
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginLeft, y + 14, PAGE.width - PAGE.marginRight, y + 14);

    return y + 18; // Y position après le header
  }

  // ============================================================
  // FOOTER (bas de chaque page)
  // ============================================================

  function addFooter(doc, pageNum, totalPages) {
    const y = PAGE.height - 12;

    // Ligne séparatrice
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.2);
    doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);

    // Marque
    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND.textLight);
    doc.text(BRAND.companyName + ' — Document confidentiel', PAGE.marginLeft, y + 4);

    // Date
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(date, PAGE.width / 2, y + 4, { align: 'center' });

    // Pagination
    if (totalPages > 1) {
      doc.text(`${pageNum} / ${totalPages}`, PAGE.width - PAGE.marginRight, y + 4, { align: 'right' });
    }
  }

  // ============================================================
  // FINALIZE — ajoute les footers à toutes les pages
  // ============================================================

  function finalize(doc) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(doc, i, totalPages);
    }
    return doc;
  }

  // ============================================================
  // PAGE BREAK avec continuation du header
  // ============================================================

  function newPage(doc, title, subtitle) {
    doc.addPage();
    return addHeader(doc, title, subtitle);
  }

  // ============================================================
  // SECTION HEADING — titre de section avec barre accent
  // ============================================================

  function addSection(doc, y, title, options = {}) {
    const color = options.color || BRAND.primary;
    const x = PAGE.marginLeft;

    // Vérifier si on a assez de place (min 30mm pour section + contenu)
    if (y + 30 > PAGE.maxY) {
      y = newPage(doc, options.headerTitle, options.headerSubtitle);
    }

    // Barre d'accent verticale
    doc.setFillColor(...color);
    doc.rect(x, y, 2, 6, 'F');

    // Titre
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.dark);
    doc.text(title, x + 6, y + 4.5);

    // Ligne fine sous le titre
    doc.setDrawColor(...BRAND.lightGray);
    doc.setLineWidth(0.2);
    doc.line(x + 6, y + 7, PAGE.width - PAGE.marginRight, y + 7);

    return y + 11;
  }

  // ============================================================
  // TEXTE avec auto-wrapping
  // ============================================================

  function addText(doc, y, text, options = {}) {
    if (!text) return y;

    const fontSize = options.fontSize || 8.5;
    const fontStyle = options.bold ? 'bold' : 'normal';
    const color = options.color || BRAND.text;
    const maxWidth = options.maxWidth || PAGE.contentWidth;
    const lineHeight = options.lineHeight || 4;
    const x = options.x || PAGE.marginLeft;

    doc.setFont(BRAND.font, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    const lines = doc.splitTextToSize(text, maxWidth);

    for (const line of lines) {
      if (y + lineHeight > PAGE.maxY) {
        y = newPage(doc, options.headerTitle, options.headerSubtitle);
        doc.setFont(BRAND.font, fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
      }
      doc.text(line, x, y);
      y += lineHeight;
    }

    return y;
  }

  // ============================================================
  // CHAMP clé-valeur (label + valeur sur une ligne)
  // ============================================================

  function addField(doc, y, label, value, options = {}) {
    if (y + 5 > PAGE.maxY) {
      y = newPage(doc, options.headerTitle, options.headerSubtitle);
    }

    const x = options.x || PAGE.marginLeft;
    const labelWidth = options.labelWidth || 50;

    // Label
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.textLight);
    doc.text(label, x, y);

    // Valeur
    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.dark);
    const valueStr = (value != null && value !== '') ? String(value) : '\u2014';
    const valueLines = doc.splitTextToSize(valueStr, PAGE.contentWidth - labelWidth);
    doc.text(valueLines, x + labelWidth, y);

    const lineCount = Math.max(1, valueLines.length);
    return y + (lineCount * 4) + 1;
  }

  // ============================================================
  // CHAMP en 2 colonnes
  // ============================================================

  function addFieldRow(doc, y, fields, options = {}) {
    if (y + 5 > PAGE.maxY) {
      y = newPage(doc, options.headerTitle, options.headerSubtitle);
    }

    const x = options.x || PAGE.marginLeft;
    const colWidth = PAGE.contentWidth / fields.length;
    const labelWidth = options.labelWidth || 35;

    let maxHeight = 0;

    fields.forEach((field, i) => {
      const colX = x + (i * colWidth);

      // Label
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.textLight);
      doc.text(field.label, colX, y);

      // Valeur
      doc.setFont(BRAND.font, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...BRAND.dark);
      const valueStr = (field.value != null && field.value !== '') ? String(field.value) : '\u2014';
      const valueLines = doc.splitTextToSize(valueStr, colWidth - 5);
      doc.text(valueLines, colX, y + 4);

      const h = valueLines.length * 4 + 5;
      if (h > maxHeight) maxHeight = h;
    });

    return y + maxHeight;
  }

  // ============================================================
  // BARRE DE PROGRESSION (pour scores)
  // ============================================================

  function addProgressBar(doc, y, options) {
    const {
      label,
      score,
      maxScore = 100,
      color = BRAND.primary,
      x = PAGE.marginLeft,
      width = PAGE.contentWidth,
      showValue = true,
    } = options;

    if (y + 8 > PAGE.maxY) {
      y = newPage(doc);
    }

    const barHeight = 3;
    const labelWidth = 50;
    const barX = x + labelWidth;
    const barWidth = width - labelWidth - (showValue ? 20 : 0);
    const fillWidth = Math.max(0, Math.min(barWidth, (score / maxScore) * barWidth));

    // Label
    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.text);
    doc.text(label, x, y + 2.5);

    // Fond de la barre
    doc.setFillColor(...BRAND.lightGray);
    doc.roundedRect(barX, y, barWidth, barHeight, 1.5, 1.5, 'F');

    // Remplissage
    if (fillWidth > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(barX, y, fillWidth, barHeight, 1.5, 1.5, 'F');
    }

    // Valeur numérique
    if (showValue) {
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...color);
      doc.text(`${Math.round(score)}`, barX + barWidth + 3, y + 2.5);
    }

    return y + 7;
  }

  // ============================================================
  // RADAR CHART à 3 axes (pour les 3 piliers DSI)
  // ============================================================

  function addRadarChart(doc, y, options) {
    const {
      data = [],         // [score1, score2, score3] (0-100)
      labels = [],       // ['Leadership', 'Ops', 'Innovation']
      colors = [],       // [[r,g,b], ...]
      maxValue = 100,
      centerX = PAGE.width / 2,
      radius = 25,
      title,
    } = options;

    const chartY = y + radius + 8;

    if (chartY + radius + 10 > PAGE.maxY) {
      y = newPage(doc);
      return addRadarChart(doc, y, options);
    }

    const cx = centerX;
    const cy = chartY;
    const numAxes = data.length;
    const angleStep = (2 * Math.PI) / numAxes;
    const startAngle = -Math.PI / 2; // commencer en haut

    // Titre optionnel
    if (title) {
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.dark);
      doc.text(title, cx, y, { align: 'center' });
    }

    // Grille concentrique (25%, 50%, 75%, 100%)
    [0.25, 0.5, 0.75, 1.0].forEach(level => {
      const r = radius * level;
      doc.setDrawColor(...BRAND.border);
      doc.setLineWidth(0.15);

      for (let i = 0; i < numAxes; i++) {
        const a1 = startAngle + i * angleStep;
        const a2 = startAngle + ((i + 1) % numAxes) * angleStep;
        doc.line(
          cx + r * Math.cos(a1), cy + r * Math.sin(a1),
          cx + r * Math.cos(a2), cy + r * Math.sin(a2)
        );
      }
    });

    // Axes
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.2);
    for (let i = 0; i < numAxes; i++) {
      const angle = startAngle + i * angleStep;
      doc.line(cx, cy, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }

    // Polygone de données
    const points = data.map((val, i) => {
      const angle = startAngle + i * angleStep;
      const r = (val / maxValue) * radius;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });

    // Remplissage semi-transparent
    try {
      const GState = (typeof jspdf !== 'undefined') ? jspdf.GState : (typeof GState !== 'undefined' ? GState : null);
      if (GState) {
        doc.saveGraphicsState();
        doc.setGState(new GState({ opacity: 0.15 }));
        doc.setFillColor(...BRAND.primary);
        _drawPolygon(doc, points, 'F');
        doc.restoreGraphicsState();
      } else {
        // Fallback: fond clair simulé sans transparence
        doc.setFillColor(255, 250, 220); // jaune très pâle
        _drawPolygon(doc, points, 'F');
      }
    } catch (_e) {
      // GState non supporté, on skip le remplissage
    }

    // Contour du polygone
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.5);
    _drawPolygon(doc, points, 'S');

    // Points sur les sommets + valeurs
    data.forEach((val, i) => {
      const angle = startAngle + i * angleStep;
      const r = (val / maxValue) * radius;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      const color = (colors[i] || BRAND.primary);

      // Point
      doc.setFillColor(...color);
      doc.circle(px, py, 1.2, 'F');

      // Label extérieur
      const lx = cx + (radius + 8) * Math.cos(angle);
      const ly = cy + (radius + 8) * Math.sin(angle);

      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...color);

      const labelAlign = Math.cos(angle) < -0.1 ? 'right' : Math.cos(angle) > 0.1 ? 'left' : 'center';
      doc.text(`${Math.round(val)}`, lx, ly - 1, { align: labelAlign });

      if (labels[i]) {
        doc.setFont(BRAND.font, 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...BRAND.textLight);
        doc.text(labels[i], lx, ly + 2.5, { align: labelAlign });
      }
    });

    return chartY + radius + 12;
  }

  // Helper : dessiner un polygone via jsPDF lines() API
  function _drawPolygon(doc, points, style) {
    if (points.length < 3) return;

    // Pour un triangle (3 piliers DSI), utiliser doc.triangle()
    if (points.length === 3) {
      doc.triangle(
        points[0].x, points[0].y,
        points[1].x, points[1].y,
        points[2].x, points[2].y,
        style
      );
      return;
    }

    // Pour un polygone arbitraire, utiliser doc.lines() avec deltas
    const deltas = [];
    for (let i = 1; i < points.length; i++) {
      deltas.push([points[i].x - points[i-1].x, points[i].y - points[i-1].y]);
    }
    doc.lines(deltas, points[0].x, points[0].y, [1, 1], style, true);
  }

  // ============================================================
  // TABLEAU simple
  // ============================================================

  function addTable(doc, y, headers, rows, options = {}) {
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y,
        head: [headers],
        body: rows,
        margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
        styles: {
          font: BRAND.font,
          fontSize: 7.5,
          textColor: BRAND.text,
          lineColor: BRAND.border,
          lineWidth: 0.2,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: BRAND.dark,
          textColor: BRAND.white,
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        alternateRowStyles: {
          fillColor: BRAND.lightGray,
        },
        ...options,
      });
      return doc.lastAutoTable.finalY + 5;
    }

    // Fallback sans autoTable : tableau simple
    return _drawSimpleTable(doc, y, headers, rows);
  }

  function _drawSimpleTable(doc, y, headers, rows) {
    const x = PAGE.marginLeft;
    const colWidth = PAGE.contentWidth / headers.length;
    const rowHeight = 7;

    // Header
    doc.setFillColor(...BRAND.dark);
    doc.rect(x, y, PAGE.contentWidth, rowHeight, 'F');
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.white);
    headers.forEach((h, i) => {
      doc.text(String(h), x + (i * colWidth) + 2, y + 5);
    });
    y += rowHeight;

    // Rows
    rows.forEach((row, ri) => {
      if (y + rowHeight > PAGE.maxY) {
        y = newPage(doc);
        // Repeat header
        doc.setFillColor(...BRAND.dark);
        doc.rect(x, y, PAGE.contentWidth, rowHeight, 'F');
        doc.setFont(BRAND.font, 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND.white);
        headers.forEach((h, i) => {
          doc.text(String(h), x + (i * colWidth) + 2, y + 5);
        });
        y += rowHeight;
      }

      if (ri % 2 === 1) {
        doc.setFillColor(...BRAND.lightGray);
        doc.rect(x, y, PAGE.contentWidth, rowHeight, 'F');
      }

      doc.setFont(BRAND.font, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.text);
      row.forEach((cell, i) => {
        doc.text(String(cell ?? ''), x + (i * colWidth) + 2, y + 5);
      });
      y += rowHeight;
    });

    return y + 3;
  }

  // ============================================================
  // BADGE / PILL
  // ============================================================

  function addBadge(doc, x, y, text, color) {
    const textWidth = doc.getTextWidth(text);
    const paddingX = 3;
    const height = 5;
    const width = textWidth + paddingX * 2;

    doc.setFillColor(...color);
    doc.roundedRect(x, y - 3.5, width, height, 2, 2, 'F');

    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND.white);
    doc.text(text, x + paddingX, y);

    return x + width + 3;
  }

  // ============================================================
  // SEPARATEUR
  // ============================================================

  function addSeparator(doc, y, options = {}) {
    const margin = options.margin || 4;
    y += margin;
    doc.setDrawColor(...(options.color || BRAND.lightGray));
    doc.setLineWidth(0.2);
    doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
    return y + margin;
  }

  // ============================================================
  // ENCADRÉ / CALLOUT
  // ============================================================

  function addCallout(doc, y, text, options = {}) {
    const color = options.color || BRAND.primary;
    const bgOpacity = 0.08;
    const padding = 5;
    const x = PAGE.marginLeft;
    const width = PAGE.contentWidth;

    doc.setFont(BRAND.font, options.bold ? 'bold' : 'normal');
    doc.setFontSize(options.fontSize || 8);
    const lines = doc.splitTextToSize(text, width - padding * 2);
    const boxHeight = lines.length * 4 + padding * 2;

    if (y + boxHeight > PAGE.maxY) {
      y = newPage(doc, options.headerTitle, options.headerSubtitle);
    }

    // Fond clair
    doc.setFillColor(...BRAND.lightGray);
    doc.roundedRect(x, y, width, boxHeight, 2, 2, 'F');

    // Barre latérale accent
    doc.setFillColor(...color);
    doc.rect(x, y, 2, boxHeight, 'F');

    // Texte
    doc.setTextColor(...BRAND.dark);
    doc.text(lines, x + padding + 2, y + padding + 2);

    return y + boxHeight + 3;
  }

  // ============================================================
  // CARTE DE PROFIL DSI (bloc visuel premium)
  // ============================================================

  function addDSIProfileCard(doc, y, options) {
    const {
      profileName,
      avgScore,
      pillarScores = [],
      pillarNames = ['Leadership', 'Excellence Op.', 'Innovation'],
      pillarColors = [BRAND.pillarLeadership, BRAND.pillarOps, BRAND.pillarInnovation],
    } = options;

    const x = PAGE.marginLeft;
    const width = PAGE.contentWidth;
    const cardHeight = 38;

    if (y + cardHeight > PAGE.maxY) {
      y = newPage(doc);
    }

    // Fond sombre (style carte DSI du web)
    doc.setFillColor(...BRAND.dark);
    doc.roundedRect(x, y, width, cardHeight, 3, 3, 'F');

    // Label "Profil DSI Amarillo"
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.text('PROFIL DSI AMARILLO\u2122', x + 8, y + 8);

    // Nom du profil
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...BRAND.primary);
    doc.text(profileName || '\u2014', x + 8, y + 15);

    // Indice global (à droite)
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('INDICE GLOBAL', x + width - 35, y + 8);

    const scoreColor = avgScore >= 70 ? BRAND.scoreHigh : avgScore >= 50 ? BRAND.scoreMedium : avgScore >= 30 ? BRAND.scoreLow : BRAND.scoreCritical;
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...scoreColor);
    doc.text(String(Math.round(avgScore)), x + width - 25, y + 17);

    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('/100', x + width - 13, y + 17);

    // 3 barres de piliers
    const barY = y + 22;
    const barSpacing = width / 3;

    pillarScores.forEach((score, i) => {
      const bx = x + 8 + (i * (barSpacing - 2));
      const bw = barSpacing - 12;

      // Nom du pilier
      doc.setFont(BRAND.font, 'normal');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(pillarNames[i], bx, barY);

      // Score
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...pillarColors[i]);
      doc.text(String(Math.round(score)), bx, barY + 5);

      // Barre de fond
      doc.setFillColor(255, 255, 255, 25); // transparent-ish
      doc.setFillColor(50, 60, 80);
      doc.roundedRect(bx, barY + 7, bw, 2, 1, 1, 'F');

      // Barre remplie
      const fillW = Math.max(0, Math.min(bw, (score / 100) * bw));
      if (fillW > 0) {
        doc.setFillColor(...pillarColors[i]);
        doc.roundedRect(bx, barY + 7, fillW, 2, 1, 1, 'F');
      }
    });

    return y + cardHeight + 5;
  }

  // ============================================================
  // WATERMARK — filigrane diagonal
  // ============================================================

  function addWatermark(doc, text) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      try {
        const GState = (typeof jspdf !== 'undefined') ? jspdf.GState : null;
        if (GState) {
          doc.saveGraphicsState();
          doc.setGState(new GState({ opacity: 0.06 }));
          doc.setFont(BRAND.font, 'bold');
          doc.setFontSize(50);
          doc.setTextColor(...BRAND.textLight);
          doc.text(text, PAGE.width / 2, PAGE.height / 2, { align: 'center', angle: 45 });
          doc.restoreGraphicsState();
        }
      } catch (_e) {
        // GState non supporté — skip watermark
      }
    }
  }

  // ============================================================
  // COVER PAGE — page de couverture
  // ============================================================

  function addCoverPage(doc, options = {}) {
    const {
      title = '',
      subtitle = '',
      reference = '',
      date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      confidential = true,
    } = options;

    // Grande bande jaune en haut
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, PAGE.width, 8, 'F');

    // Logo centré
    const logoY = 80;
    doc.setFillColor(...BRAND.primary);
    doc.circle(PAGE.width / 2, logoY, 15, 'F');
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(24);
    doc.setTextColor(...BRAND.white);
    doc.text('A', PAGE.width / 2, logoY + 4, { align: 'center' });

    // Nom société
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...BRAND.dark);
    doc.text(BRAND.companyName, PAGE.width / 2, logoY + 30, { align: 'center' });

    // Tagline
    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.textLight);
    doc.text(BRAND.tagline, PAGE.width / 2, logoY + 38, { align: 'center' });

    // Séparateur
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.8);
    doc.line(PAGE.width / 2 - 30, logoY + 48, PAGE.width / 2 + 30, logoY + 48);

    // Titre du document
    doc.setFont(BRAND.font, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BRAND.dark);
    const titleLines = doc.splitTextToSize(title, PAGE.contentWidth - 20);
    let ty = logoY + 62;
    titleLines.forEach(line => {
      doc.text(line, PAGE.width / 2, ty, { align: 'center' });
      ty += 8;
    });

    // Sous-titre
    if (subtitle) {
      doc.setFont(BRAND.font, 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...BRAND.text);
      doc.text(subtitle, PAGE.width / 2, ty + 4, { align: 'center' });
      ty += 12;
    }

    // Référence
    if (reference) {
      doc.setFont(BRAND.font, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.textLight);
      doc.text(reference, PAGE.width / 2, ty + 4, { align: 'center' });
    }

    // Bas de page
    const footerY = PAGE.height - 40;
    doc.setFont(BRAND.font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.textLight);
    doc.text(date, PAGE.width / 2, footerY, { align: 'center' });

    if (confidential) {
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.textLight);
      doc.text('DOCUMENT CONFIDENTIEL', PAGE.width / 2, footerY + 8, { align: 'center' });
    }

    // Bande jaune en bas
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, PAGE.height - 4, PAGE.width, 4, 'F');
  }

  // ============================================================
  // SCORE COULEUR — retourne la couleur RGB selon le score
  // ============================================================

  function scoreColor(score) {
    if (score >= 70) return BRAND.scoreHigh;
    if (score >= 50) return BRAND.scoreMedium;
    if (score >= 30) return BRAND.scoreLow;
    return BRAND.scoreCritical;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function formatDate(dateStr) {
    if (!dateStr) return '\u2014';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch { return dateStr; }
  }

  function formatCurrency(amount) {
    if (amount == null || amount === '') return '\u2014';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  // ============================================================
  // DOWNLOAD & UPLOAD
  // ============================================================

  function download(doc, filename) {
    finalize(doc);
    doc.save(filename);
  }

  async function uploadToDrive(doc, filename, folderId) {
    finalize(doc);
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (typeof GoogleDrive !== 'undefined' && GoogleDrive.isConfigured()) {
      await GoogleDrive.authenticate();
      return await GoogleDrive.uploadFile(file, folderId);
    }
    throw new Error('Google Drive non configuré.');
  }

  // ============================================================
  // FICHE CANDIDAT PDF — export complet de la fiche candidat
  // ============================================================

  function generateCandidatSummary(candidat, options = {}) {
    const doc = createDocument({ title: `Fiche candidat — ${candidat.prenom || ''} ${candidat.nom || ''}` });
    const dsiResult = options.dsiResult;
    const entreprise = options.entreprise;

    // Header
    let y = addHeader(doc, 'Fiche candidat', formatDate(new Date().toISOString()));

    // Identité
    y = addSection(doc, y, `${candidat.prenom || ''} ${candidat.nom || ''}`);

    y = addFieldRow(doc, y, [
      { label: 'Poste actuel', value: candidat.poste_actuel },
      { label: 'Entreprise', value: entreprise ? entreprise.displayName || entreprise.nom : candidat.entreprise_nom },
    ]);

    y = addFieldRow(doc, y, [
      { label: 'Localisation', value: candidat.localisation || candidat.ville },
      { label: 'Niveau', value: candidat.niveau },
    ]);

    y = addFieldRow(doc, y, [
      { label: 'Email', value: candidat.email },
      { label: 'Telephone', value: candidat.telephone },
    ]);

    y = addSeparator(doc, y);

    // Synthèse
    if (candidat.synthese_30s) {
      y = addSection(doc, y, 'Synthese');
      y = addText(doc, y, candidat.synthese_30s);
      y += 3;
    }

    // Profil DSI
    if (dsiResult && dsiResult.status === 'completed') {
      y = addDSIProfileCard(doc, y, {
        profileName: dsiResult.profile,
        avgScore: dsiResult.avgNorm,
        pillarScores: dsiResult.pillarScoresNorm,
      });
    }

    // Package
    y = addSection(doc, y, 'Remuneration & disponibilite');
    y = addFieldRow(doc, y, [
      { label: 'Fixe actuel', value: candidat.salaire_fixe_actuel ? formatCurrency(candidat.salaire_fixe_actuel * 1000) : null },
      { label: 'Variable', value: candidat.variable_actuel ? formatCurrency(candidat.variable_actuel * 1000) : null },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Package souhaite', value: candidat.package_souhaite ? formatCurrency(candidat.package_souhaite * 1000) : null },
      { label: 'Package min', value: candidat.package_souhaite_min ? formatCurrency(candidat.package_souhaite_min * 1000) : null },
    ]);

    // Formation
    y = addSeparator(doc, y);
    y = addSection(doc, y, 'Formation & parcours');
    y = addFieldRow(doc, y, [
      { label: 'Diplome', value: candidat.diplome },
      { label: 'Source', value: candidat.source },
    ]);

    if (candidat.debut_carriere) {
      const years = Math.floor((Date.now() - new Date(candidat.debut_carriere).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      y = addField(doc, y, 'Experience', `${years} ans (depuis ${formatDate(candidat.debut_carriere)})`);
    }

    // Notes
    if (candidat.notes) {
      y = addSeparator(doc, y);
      y = addSection(doc, y, 'Notes');
      y = addText(doc, y, candidat.notes);
    }

    return doc;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    // Constants
    BRAND,
    PAGE,

    // Document lifecycle
    createDocument,
    newPage,
    finalize,

    // Layout blocks
    addHeader,
    addFooter,
    addSection,
    addText,
    addField,
    addFieldRow,
    addProgressBar,
    addRadarChart,
    addTable,
    addBadge,
    addSeparator,
    addCallout,
    addDSIProfileCard,
    addCoverPage,
    addWatermark,

    // Pre-built documents
    generateCandidatSummary,

    // Helpers
    scoreColor,
    formatDate,
    formatCurrency,

    // Output
    download,
    uploadToDrive,
  };
})();
