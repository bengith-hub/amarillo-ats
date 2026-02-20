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
    // Résolution robuste : essayer toutes les variantes d'exposition de jsPDF
    const JsPDF = (typeof jspdf !== 'undefined' && jspdf.jsPDF)
      ? jspdf.jsPDF
      : (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF)
        ? window.jspdf.jsPDF
        : (typeof jsPDF !== 'undefined')
          ? jsPDF
          : (typeof window !== 'undefined' && window.jsPDF)
            ? window.jsPDF
            : null;

    if (!JsPDF) {
      throw new Error('jsPDF non chargé. Ajoutez le script CDN jsPDF à la page.');
    }

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

    if (!data || data.length < 3) return y; // Need at least 3 data points

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
      const GState = (typeof jspdf !== 'undefined' && jspdf.GState) ? jspdf.GState : (typeof window !== 'undefined' && window.jspdf && window.jspdf.GState) ? window.jspdf.GState : null;
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
        const GState = (typeof jspdf !== 'undefined' && jspdf.GState) ? jspdf.GState : (typeof window !== 'undefined' && window.jspdf && window.jspdf.GState) ? window.jspdf.GState : null;
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
  // HELPERS D'ANONYMISATION (privés)
  // ============================================================

  function anonymizeText(text, companyNames = []) {
    if (!text) return '';
    let result = text;
    const sorted = [...companyNames].filter(n => n && n.length >= 2).sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), '[entreprise confidentielle]');
    }
    return result;
  }

  function salaryBand(minK, maxK) {
    const min = parseFloat(minK);
    const max = parseFloat(maxK);
    const roundTo5 = (v) => Math.round(v / 5) * 5;
    if (!isNaN(min) && !isNaN(max)) return `${roundTo5(min)} \u2013 ${roundTo5(max)} K\u20AC`;
    if (!isNaN(max)) return `~${roundTo5(max)} K\u20AC`;
    if (!isNaN(min)) return `\u00E0 partir de ${roundTo5(min)} K\u20AC`;
    return null;
  }

  function experienceYears(dateStr) {
    if (!dateStr) return null;
    const years = Math.floor((Date.now() - new Date(dateStr).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (years < 1) return "Moins d'1 an";
    if (years === 1) return "1 an d'exp\u00E9rience";
    return `${years} ans d'exp\u00E9rience`;
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
  // TEASER D'APPROCHE — profil candidat anonymisé
  // ============================================================

  function generateTeaserApproche(candidat, options = {}) {
    const dsiResult = options.dsiResult || null;
    const companyNames = [...(options.companyNames || [])];
    const missionRef = options.missionRef || null;

    // Ajouter le nom de l'entreprise du candidat à la liste d'anonymisation
    if (candidat.entreprise_nom) companyNames.push(candidat.entreprise_nom);
    if (candidat.entreprise_actuel) companyNames.push(candidat.entreprise_actuel);

    const doc = createDocument({
      title: "Teaser d'approche \u2014 Amarillo Search",
      subject: `Profil anonymis\u00E9 \u2014 ${candidat.poste_actuel || 'Candidat'}`,
    });

    // --- Header ---
    const dateStr = formatDate(new Date().toISOString());
    let y = addHeader(doc, "Teaser d'approche", dateStr);

    // --- Bloc titre ---
    y = addText(doc, y, 'PROFIL CANDIDAT \u2014 APPROCHE CONFIDENTIELLE', {
      bold: true, fontSize: 12, color: BRAND.dark,
    });
    y += 1;
    if (missionRef) {
      y = addText(doc, y, `Mission : ${missionRef}`, { fontSize: 9, color: BRAND.textLight });
    }
    y = addSeparator(doc, y);

    // --- Profil en bref ---
    y = addSection(doc, y, 'Profil en bref');
    y = addFieldRow(doc, y, [
      { label: 'Poste actuel', value: candidat.poste_actuel },
      { label: 'Niveau', value: candidat.niveau },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Poste cible', value: candidat.poste_cible },
      { label: 'R\u00E9gion', value: candidat.localisation },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Exp\u00E9rience', value: experienceYears(candidat.debut_carriere) },
      { label: 'Formation', value: candidat.diplome },
    ]);

    // --- Synthèse du profil ---
    const synthese = anonymizeText(candidat.synthese_30s, companyNames);
    if (synthese) {
      y = addSection(doc, y, 'Synth\u00E8se du profil');
      y = addText(doc, y, synthese);
      y += 2;
    }

    // --- Projet professionnel ---
    const parcours = anonymizeText(candidat.parcours_cible, companyNames);
    const motivation = anonymizeText(candidat.motivation_drivers, companyNames);
    if (parcours || motivation) {
      y = addSection(doc, y, 'Projet professionnel');
      if (parcours) {
        y = addText(doc, y, parcours);
        y += 2;
      }
      if (motivation) {
        y = addCallout(doc, y, motivation, { color: BRAND.primary });
      }
    }

    // --- Conditions & disponibilité ---
    let disponibiliteLabel = null;
    if (candidat.open_to_work) {
      if (candidat.date_disponibilite) {
        disponibiliteLabel = 'Disponible \u2014 ' + new Date(candidat.date_disponibilite).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else {
        disponibiliteLabel = 'Disponible';
      }
    } else if (candidat.date_disponibilite) {
      disponibiliteLabel = new Date(candidat.date_disponibilite).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }

    const packageBand = salaryBand(candidat.package_souhaite_min, candidat.package_souhaite);

    if (disponibiliteLabel || candidat.preavis || packageBand || candidat.teletravail) {
      y = addSection(doc, y, 'Conditions & disponibilit\u00E9');
      y = addFieldRow(doc, y, [
        { label: 'Disponibilit\u00E9', value: disponibiliteLabel },
        { label: 'Pr\u00E9avis', value: candidat.preavis },
      ]);
      y = addFieldRow(doc, y, [
        { label: 'Package souhait\u00E9', value: packageBand },
        { label: 'T\u00E9l\u00E9travail', value: candidat.teletravail },
      ]);
    }

    // --- Profil DSI Amarillo™ (conditionnel) ---
    if (dsiResult && dsiResult.status === 'completed') {
      y = addSection(doc, y, 'Profil DSI Amarillo\u2122');
      y = addDSIProfileCard(doc, y, {
        profileName: dsiResult.profile,
        avgScore: dsiResult.avgNorm,
        pillarScores: dsiResult.pillarScoresNorm,
      });
      y = addRadarChart(doc, y, {
        data: dsiResult.pillarScoresNorm,
        labels: ['Leadership & Influence', 'Excellence Op\u00E9rationnelle', 'Innovation & Posture'],
        colors: [BRAND.pillarLeadership, BRAND.pillarOps, BRAND.pillarInnovation],
        title: '\u00C9quilibre des 3 piliers',
      });
    }

    // --- Mention de confidentialité ---
    y = addCallout(doc, y,
      'Ce document est strictement confidentiel et destin\u00E9 uniquement au client destinataire. '
      + 'Il ne peut \u00EAtre diffus\u00E9, copi\u00E9 ou transmis \u00E0 un tiers sans l\'accord pr\u00E9alable \u00E9crit d\'Amarillo Search. '
      + 'L\'identit\u00E9 du candidat sera communiqu\u00E9e apr\u00E8s accord mutuel pour poursuivre le processus.',
      { color: BRAND.dark, fontSize: 7 }
    );

    // --- Watermark ---
    addWatermark(doc, 'CONFIDENTIEL');

    return doc;
  }

  // ============================================================
  // JD BUILDER — Fiche de poste avec export PDF
  // ============================================================

  function generateJDDocument(mission, options = {}) {
    const entreprise = options.entreprise || null;
    const decideurs = options.decideurs || [];

    const doc = createDocument({
      title: `Fiche de poste \u2014 ${mission.nom || mission.ref || ''}`,
      subject: mission.jd_entreprise || '',
    });

    // --- Page de couverture ---
    addCoverPage(doc, {
      title: mission.nom || mission.ref || 'Fiche de poste',
      subtitle: mission.jd_entreprise || '',
      reference: mission.ref ? `R\u00E9f. ${mission.ref}` : '',
      confidential: true,
    });

    // --- Page 2 : contenu principal ---
    let y = addHeader(doc, 'Fiche de poste', formatDate(new Date().toISOString()));

    // Identification
    y = addSection(doc, y, 'Identification du poste');
    y = addFieldRow(doc, y, [
      { label: 'Intitul\u00E9 du poste', value: mission.nom },
      { label: 'R\u00E9f\u00E9rence', value: mission.ref },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Entreprise', value: mission.jd_entreprise || (entreprise ? entreprise.displayName || entreprise.nom : null) },
      { label: 'Secteur', value: entreprise ? entreprise.secteur : null },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Localisation', value: mission.jd_localisation },
      { label: 'Niveau', value: mission.niveau },
    ]);
    if (mission.jd_type_contrat || mission.jd_teletravail) {
      y = addFieldRow(doc, y, [
        { label: 'Type de contrat', value: mission.jd_type_contrat },
        { label: 'T\u00E9l\u00E9travail', value: mission.jd_teletravail },
      ]);
    }

    // Décideurs / interlocuteurs
    if (decideurs.length > 0) {
      y += 2;
      y = addField(doc, y, 'Interlocuteurs cl\u00E9s',
        decideurs.map(d => `${d.prenom || ''} ${d.nom || ''} \u2014 ${d.fonction || ''}`).join('\n'));
    }

    y = addSeparator(doc, y);

    // Contexte
    if (mission.jd_contexte) {
      y = addSection(doc, y, 'Contexte de la mission');
      y = addText(doc, y, mission.jd_contexte);
      y += 3;
    }

    // Responsabilités
    if (mission.jd_responsabilites) {
      y = addSection(doc, y, 'Responsabilit\u00E9s cl\u00E9s');
      y = addText(doc, y, mission.jd_responsabilites);
      y += 3;
    }

    // Profil recherché
    if (mission.jd_profil_recherche) {
      y = addSection(doc, y, 'Profil recherch\u00E9');
      y = addText(doc, y, mission.jd_profil_recherche);
      y += 3;
    }

    // Rémunération
    if (mission.jd_remuneration) {
      y = addSection(doc, y, 'R\u00E9mun\u00E9ration & avantages');
      y = addText(doc, y, mission.jd_remuneration);
      y += 3;
    }

    // Environnement
    if (mission.jd_environnement) {
      y = addSection(doc, y, 'Environnement de travail');
      y = addText(doc, y, mission.jd_environnement);
      y += 3;
    }

    // Processus de sélection
    if (mission.jd_processus) {
      y = addSection(doc, y, 'Processus de s\u00E9lection');
      y = addText(doc, y, mission.jd_processus);
      y += 3;
    }

    // Mention de confidentialité
    y = addCallout(doc, y,
      'Ce document est \u00E9tabli par Amarillo Search dans le cadre d\'un mandat de recherche exclusif. '
      + 'Les informations contenues sont strictement confidentielles et destin\u00E9es uniquement aux candidats approch\u00E9s.',
      { color: BRAND.dark, fontSize: 7 }
    );

    // Watermark
    addWatermark(doc, 'CONFIDENTIEL');

    return doc;
  }

  // ============================================================
  // PRÉSENTATION LONGUE CANDIDAT — dossier complet multi-pages
  // ============================================================

  function generateCandidatPresentation(candidat, options = {}) {
    const dsiResult = options.dsiResult || null;
    const entreprise = options.entreprise || null;
    const missions = options.missions || [];
    const actions = options.actions || [];

    const fullName = `${candidat.prenom || ''} ${candidat.nom || ''}`.trim();

    const doc = createDocument({
      title: `Pr\u00E9sentation \u2014 ${fullName}`,
      subject: candidat.poste_actuel || '',
    });

    // --- Page de couverture ---
    addCoverPage(doc, {
      title: fullName || 'Candidat',
      subtitle: candidat.poste_actuel || '',
      reference: candidat.profile_code ? `Profiling ${candidat.profile_code}` : '',
      confidential: true,
    });

    // --- PAGE 2 : Identité & contexte ---
    let y = addHeader(doc, 'Pr\u00E9sentation candidat', formatDate(new Date().toISOString()));

    y = addSection(doc, y, 'Identit\u00E9');
    y = addFieldRow(doc, y, [
      { label: 'Nom', value: fullName },
      { label: 'Poste actuel', value: candidat.poste_actuel },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Entreprise', value: entreprise ? (entreprise.displayName || entreprise.nom) : candidat.entreprise_nom },
      { label: 'Localisation', value: candidat.localisation || candidat.ville },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Poste cible', value: candidat.poste_cible },
      { label: 'Open to work', value: candidat.open_to_work ? 'Oui' : 'Non' },
    ]);
    y = addFieldRow(doc, y, [
      { label: 'Dipl\u00F4me', value: candidat.diplome },
      { label: 'Exp\u00E9rience', value: experienceYears(candidat.debut_carriere) },
    ]);
    if (candidat.debut_poste_actuel) {
      const posteMs = Date.now() - new Date(candidat.debut_poste_actuel).getTime();
      const posteMois = Math.floor(posteMs / (30.44 * 24 * 60 * 60 * 1000));
      const posteAns = Math.floor(posteMois / 12);
      const resteMois = posteMois % 12;
      let dureePoste = '';
      if (posteAns > 0 && resteMois > 0) dureePoste = `${posteAns} an${posteAns > 1 ? 's' : ''} ${resteMois} mois`;
      else if (posteAns > 0) dureePoste = `${posteAns} an${posteAns > 1 ? 's' : ''}`;
      else dureePoste = `${resteMois} mois`;
      y = addFieldRow(doc, y, [
        { label: 'Anciennet\u00E9 poste', value: dureePoste },
        { label: 'Disponibilit\u00E9', value: candidat.date_disponibilite ? formatDate(candidat.date_disponibilite) : (candidat.preavis || null) },
      ]);
    }
    y = addFieldRow(doc, y, [
      { label: 'Origine', value: candidat.origine },
      { label: 'Recommand\u00E9 par', value: candidat.recommande_par_nom },
    ]);

    y = addSeparator(doc, y);

    // --- Coordonnées ---
    y = addSection(doc, y, 'Coordonn\u00E9es');
    y = addFieldRow(doc, y, [
      { label: 'Email', value: candidat.email },
      { label: 'T\u00E9l\u00E9phone', value: candidat.telephone },
    ]);
    if (candidat.adresse_ligne1 || candidat.code_postal || candidat.ville) {
      const adresse = [candidat.adresse_ligne1, `${candidat.code_postal || ''} ${candidat.ville || ''}`.trim()].filter(Boolean).join(', ');
      y = addField(doc, y, 'Adresse', adresse);
    }

    y = addSeparator(doc, y);

    // --- Profil DSI ---
    if (dsiResult && dsiResult.status === 'completed') {
      y = addSection(doc, y, 'Profil DSI Amarillo\u2122');
      y = addDSIProfileCard(doc, y, {
        profileName: dsiResult.profile,
        avgScore: dsiResult.avgNorm,
        pillarScores: dsiResult.pillarScoresNorm,
      });
      y += 4;

      // Radar chart si on a la place
      if (y + 65 > PAGE.maxY) {
        y = newPage(doc);
        y = addHeader(doc, 'Profil DSI \u2014 Radar', '');
      }
      y = addRadarChart(doc, y, {
        data: dsiResult.pillarScoresNorm,
        labels: ['Leadership & Influence', 'Excellence Op\u00E9rationnelle', 'Innovation & Posture'],
        colors: [BRAND.pillarLeadership, BRAND.pillarOps, BRAND.pillarInnovation],
      });
      y += 4;
    }

    // --- PAGE : Entretien (sections longues) ---
    const entretienSections = [
      { key: 'synthese_30s', title: 'Synth\u00E8se 30 secondes', accent: [245, 158, 11] },
      { key: 'parcours_cible', title: 'Parcours & cible', accent: [59, 130, 246] },
      { key: 'motivation_drivers', title: 'Motivation & Drivers', accent: [16, 185, 129] },
      { key: 'lecture_recruteur', title: 'Lecture recruteur', accent: [139, 92, 246] },
    ];

    const hasEntretien = entretienSections.some(s => candidat[s.key]?.trim());

    if (hasEntretien) {
      // Nouvelle page pour l'entretien
      doc.addPage();
      y = addHeader(doc, 'Entretien \u2014 Analyse', fullName);

      for (const section of entretienSections) {
        const content = candidat[section.key]?.trim();
        if (!content) continue;

        if (y + 20 > PAGE.maxY) {
          doc.addPage();
          y = addHeader(doc, 'Entretien \u2014 Analyse', fullName);
        }

        y = addSection(doc, y, section.title, { color: section.accent });
        y = addText(doc, y, content, {
          headerTitle: 'Entretien \u2014 Analyse',
          headerSubtitle: fullName,
        });
        y += 5;
      }
    }

    // --- Rémunération ---
    const hasRemu = candidat.salaire_fixe_actuel || candidat.variable_actuel || candidat.package_souhaite || candidat.package_souhaite_min;

    if (hasRemu) {
      if (y + 35 > PAGE.maxY) {
        doc.addPage();
        y = addHeader(doc, 'R\u00E9mun\u00E9ration & Conditions', fullName);
      }

      y = addSeparator(doc, y);
      y = addSection(doc, y, 'R\u00E9mun\u00E9ration & conditions');
      y = addFieldRow(doc, y, [
        { label: 'Fixe actuel', value: candidat.salaire_fixe_actuel ? `${candidat.salaire_fixe_actuel} K\u20AC` : null },
        { label: 'Variable actuel', value: candidat.variable_actuel ? `${candidat.variable_actuel} K\u20AC` : null },
      ]);
      const pkg = (candidat.salaire_fixe_actuel || 0) + (candidat.variable_actuel || 0);
      y = addFieldRow(doc, y, [
        { label: 'Package total actuel', value: pkg > 0 ? `${pkg} K\u20AC` : null },
        { label: 'Package souhait\u00E9', value: candidat.package_souhaite ? `${candidat.package_souhaite} K\u20AC` : null },
      ]);
      if (candidat.package_souhaite_min) {
        y = addField(doc, y, 'Package minimum', `${candidat.package_souhaite_min} K\u20AC`);
      }
      y = addFieldRow(doc, y, [
        { label: 'T\u00E9l\u00E9travail', value: candidat.teletravail },
        { label: 'RTT', value: candidat.rtt ? `Oui${candidat.nb_rtt ? ` (${candidat.nb_rtt} j)` : ''}` : null },
      ]);
      y += 3;
    }

    // --- Missions associées ---
    if (missions.length > 0) {
      if (y + 25 > PAGE.maxY) {
        doc.addPage();
        y = addHeader(doc, 'Missions associ\u00E9es', fullName);
      }
      y = addSeparator(doc, y);
      y = addSection(doc, y, `Missions associ\u00E9es (${missions.length})`);
      const mHeaders = ['Mission', 'R\u00E9f\u00E9rence', 'Statut', 'Niveau'];
      const mRows = missions.map(m => [
        m.nom || '\u2014',
        m.ref || '\u2014',
        m.statut || '\u2014',
        m.niveau || '\u2014',
      ]);
      y = addTable(doc, y, mHeaders, mRows);
      y += 3;
    }

    // --- Historique actions (dernières 10) ---
    if (actions.length > 0) {
      if (y + 25 > PAGE.maxY) {
        doc.addPage();
        y = addHeader(doc, 'Historique des actions', fullName);
      }
      y = addSeparator(doc, y);
      const recentActions = actions.slice(0, 10);
      y = addSection(doc, y, `Historique des actions (${recentActions.length}${actions.length > 10 ? ` / ${actions.length}` : ''})`);
      const aHeaders = ['Date', 'Action', 'Canal', 'Statut'];
      const aRows = recentActions.map(a => [
        formatDate(a.date_action),
        a.action || '\u2014',
        a.canal || '\u2014',
        a.statut || '\u2014',
      ]);
      y = addTable(doc, y, aHeaders, aRows);
      y += 3;
    }

    // --- Notes ---
    if (candidat.notes?.trim()) {
      if (y + 20 > PAGE.maxY) {
        doc.addPage();
        y = addHeader(doc, 'Notes', fullName);
      }
      y = addSeparator(doc, y);
      y = addSection(doc, y, 'Notes');
      y = addText(doc, y, candidat.notes, {
        headerTitle: 'Notes',
        headerSubtitle: fullName,
      });
    }

    // --- Confidentialité ---
    if (y + 15 > PAGE.maxY) {
      doc.addPage();
      y = PAGE.marginTop;
    }
    y += 5;
    addCallout(doc, y,
      'Ce document est strictement confidentiel. Il est \u00E9tabli par Amarillo Search '
      + 'dans le cadre d\'un mandat de recherche. Toute reproduction ou diffusion sans autorisation est interdite.',
      { color: BRAND.dark, fontSize: 7 }
    );

    addWatermark(doc, 'CONFIDENTIEL');

    return doc;
  }

  // ============================================================
  // SHORTLIST COMPARATIVE PDF
  // ============================================================

  function generateShortlistPDF(mission, candidats, options = {}) {
    const dsiResults = options.dsiResults || {}; // { candidatId: { profile, avgNorm, pillarScoresNorm } }

    const doc = createDocument({
      title: `Shortlist \u2014 ${mission.nom || mission.ref || ''}`,
      subject: mission.jd_entreprise || '',
    });

    // --- Page de couverture ---
    addCoverPage(doc, {
      title: mission.nom || mission.ref || 'Shortlist',
      subtitle: `${candidats.length} candidat${candidats.length > 1 ? 's' : ''} pr\u00E9sent\u00E9${candidats.length > 1 ? 's' : ''}`,
      reference: mission.ref ? `R\u00E9f. ${mission.ref}` : '',
      confidential: true,
    });

    // --- Page 2 : Tableau comparatif synthétique ---
    let y = addHeader(doc, 'Shortlist comparative', formatDate(new Date().toISOString()));

    y = addSection(doc, y, `Mission : ${mission.nom || mission.ref || ''}`);
    if (mission.jd_entreprise) {
      y = addFieldRow(doc, y, [
        { label: 'Entreprise', value: mission.jd_entreprise },
        { label: 'Niveau', value: mission.niveau },
      ]);
    }
    y += 3;

    // Tableau comparatif
    const tableHeaders = ['Candidat', 'Poste actuel', 'Localisation', 'Package (K\u20AC)', 'DSI Profile', 'Score'];

    const tableRows = candidats.map(c => {
      const dsi = dsiResults[c.id];
      const pkg = (c.salaire_fixe_actuel || 0) + (c.variable_actuel || 0);
      return [
        `${c.prenom || ''} ${c.nom || ''}`.trim(),
        c.poste_actuel || '\u2014',
        c.localisation || '\u2014',
        pkg > 0 ? `${pkg} K\u20AC` : '\u2014',
        dsi && dsi.profile ? dsi.profile.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '') : '\u2014',
        dsi && dsi.avgNorm != null ? `${dsi.avgNorm}/100` : '\u2014',
      ];
    });

    y = addTable(doc, y, tableHeaders, tableRows);
    y += 6;

    // Légende
    doc.setFont(BRAND.font, 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.textLight);
    doc.text('Package = Fixe + Variable actuels. Score DSI = score global normalis\u00E9 (0-100).', PAGE.marginLeft, y);
    y += 6;

    // --- Fiches individuelles (2 par page) ---
    let slotIndex = 0; // 0 = haut de page, 1 = bas de page

    for (let i = 0; i < candidats.length; i++) {
      const c = candidats[i];
      const dsi = dsiResults[c.id];

      // Nouvelle page si nécessaire
      if (slotIndex === 0) {
        doc.addPage();
        y = addHeader(doc, 'Fiches candidats', `${i + 1}/${candidats.length}`);
      }

      const slotStartY = y;
      const slotMaxY = slotIndex === 0 ? (PAGE.height / 2) - 5 : PAGE.maxY;

      // --- Nom + badge ---
      doc.setFont(BRAND.font, 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...BRAND.dark);
      const fullName = `${c.prenom || ''} ${c.nom || ''}`.trim();
      doc.text(fullName, PAGE.marginLeft, y);

      if (c.statut) {
        const badgeX = PAGE.marginLeft + doc.getTextWidth(fullName) + 4;
        y = addBadge(doc, y - 3, c.statut, badgeX);
      }
      y += 2;

      // Poste actuel
      if (c.poste_actuel) {
        doc.setFont(BRAND.font, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.textLight);
        doc.text(c.poste_actuel, PAGE.marginLeft, y);
        y += 5;
      }

      y += 1;

      // Champs clés en 2 colonnes
      y = addFieldRow(doc, y, [
        { label: 'Localisation', value: c.localisation },
        { label: 'Disponibilit\u00E9', value: c.date_disponibilite ? formatDate(c.date_disponibilite) : (c.preavis || null) },
      ]);

      const pkg = (c.salaire_fixe_actuel || 0) + (c.variable_actuel || 0);
      const pkgSouhaite = c.package_souhaite;
      y = addFieldRow(doc, y, [
        { label: 'Package actuel', value: pkg > 0 ? `${pkg} K\u20AC` : null },
        { label: 'Package souhait\u00E9', value: pkgSouhaite ? `${pkgSouhaite} K\u20AC` : null },
      ]);

      y = addFieldRow(doc, y, [
        { label: 'Dipl\u00F4me', value: c.diplome },
        { label: 'Exp\u00E9rience', value: experienceYears(c.debut_carriere) },
      ]);

      // DSI Profile si disponible
      if (dsi && dsi.status === 'completed' && dsi.pillarScoresNorm) {
        y += 2;
        // Profile card inline
        doc.setFont(BRAND.font, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.dark);
        doc.text('DSI Profile :', PAGE.marginLeft, y);

        doc.setFont(BRAND.font, 'normal');
        doc.setFontSize(8);
        const profileLabel = dsi.profile || '\u2014';
        doc.text(`${profileLabel}  |  Score global : ${dsi.avgNorm}/100`, PAGE.marginLeft + 25, y);
        y += 5;

        // Mini barres de progression pour les 3 piliers
        const pillarNames = ['Leadership', 'Ops', 'Innovation'];
        const pillarColors = [BRAND.pillarLeadership, BRAND.pillarOps, BRAND.pillarInnovation];
        for (let p = 0; p < 3; p++) {
          const score = dsi.pillarScoresNorm[p] || 0;
          doc.setFont(BRAND.font, 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...BRAND.textLight);
          doc.text(pillarNames[p], PAGE.marginLeft, y);

          const barX = PAGE.marginLeft + 22;
          const barW = 50;
          const barH = 3;
          // Fond
          doc.setFillColor(...BRAND.lightGray);
          doc.roundedRect(barX, y - 2.5, barW, barH, 1, 1, 'F');
          // Barre
          const fillW = Math.max(0, Math.min(barW, barW * score / 100));
          if (fillW > 0) {
            doc.setFillColor(...pillarColors[p]);
            doc.roundedRect(barX, y - 2.5, fillW, barH, 1, 1, 'F');
          }
          // Valeur
          doc.setFont(BRAND.font, 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...scoreColor(score));
          doc.text(`${score}`, barX + barW + 3, y);
          y += 4.5;
        }
      }

      // Synthèse 30s si disponible
      if (c.synthese_30s) {
        y += 1;
        doc.setFont(BRAND.font, 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND.dark);
        doc.text('Synth\u00E8se :', PAGE.marginLeft, y);
        y += 3.5;

        doc.setFont(BRAND.font, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.text);
        const maxWidth = PAGE.contentWidth;
        const lines = doc.splitTextToSize(c.synthese_30s.substring(0, 300), maxWidth);
        const maxLines = 4;
        const displayLines = lines.slice(0, maxLines);
        if (lines.length > maxLines) displayLines[maxLines - 1] += '...';
        doc.text(displayLines, PAGE.marginLeft, y);
        y += displayLines.length * 3.2;
      }

      y += 3;
      y = addSeparator(doc, y);
      y += 5;

      slotIndex++;
      if (slotIndex >= 2) {
        slotIndex = 0;
      }
    }

    // --- Mention de confidentialité ---
    if (slotIndex !== 0) {
      // On est en milieu de page, pas besoin de nouvelle page
    }
    y += 3;
    addCallout(doc, y,
      'Ce document est strictement confidentiel. Il est destin\u00E9 au client dans le cadre d\'un mandat Amarillo Search. '
      + 'La reproduction ou diffusion de ce document sans autorisation est interdite.',
      { color: BRAND.dark, fontSize: 7 }
    );

    addWatermark(doc, 'CONFIDENTIEL');

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
    generateTeaserApproche,
    generateJDDocument,
    generateCandidatPresentation,
    generateShortlistPDF,

    // Helpers
    scoreColor,
    formatDate,
    formatCurrency,

    // Output
    download,
    uploadToDrive,
  };
})();
