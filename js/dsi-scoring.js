// Amarillo ATS — DSI Profile Scoring Integration
// Ported from amarillo-dsi-profile/src/App.jsx & assessments/dsi.js

const DSIProfile = (() => {

  // ============================================================
  // SCORING CONSTANTS (from App.jsx lines 195-214)
  // ============================================================
  const RANK_WEIGHTS = [1.0, 0.25, -0.15, -0.50];
  const WEIGHT_SUM = RANK_WEIGHTS.reduce((a, b) => a + b, 0); // 0.60
  // Worst case: score 1 ranked 1st, score 2 ranked 2nd, score 3 ranked 3rd, score 4 ranked 4th
  const SCORE_THEORETICAL_MIN = (1 * RANK_WEIGHTS[0] + 2 * RANK_WEIGHTS[1] + 3 * RANK_WEIGHTS[2] + 4 * RANK_WEIGHTS[3]) / WEIGHT_SUM;
  // Best case: score 4 ranked 1st, score 3 ranked 2nd, score 2 ranked 3rd, score 1 ranked 4th
  const SCORE_THEORETICAL_MAX = (4 * RANK_WEIGHTS[0] + 3 * RANK_WEIGHTS[1] + 2 * RANK_WEIGHTS[2] + 1 * RANK_WEIGHTS[3]) / WEIGHT_SUM;

  // ============================================================
  // ASSESSMENT DATA (from assessments/dsi.js)
  // ============================================================
  const DIMENSIONS = [
    { id: 'vision',     pillar: 0 },
    { id: 'leadership', pillar: 0 },
    { id: 'change',     pillar: 0 },
    { id: 'influence',  pillar: 0 },
    { id: 'budget',     pillar: 1 },
    { id: 'risk',       pillar: 1 },
    { id: 'complexity', pillar: 1 },
    { id: 'results',    pillar: 1 },
    { id: 'innovation', pillar: 2 },
    { id: 'client',     pillar: 2 },
    { id: 'resilience', pillar: 2 },
    { id: 'agility',    pillar: 2 },
  ];

  const PILLARS = [
    { name: 'Leadership & Influence', color: '#FECC02' },
    { name: 'Excellence Opérationnelle', color: '#2D6A4F' },
    { name: 'Innovation & Posture', color: '#3A5BA0' },
  ];

  // 8 profiles ordered by priority (first eligible wins)
  const PROFILES = [
    { name: '\u{1F680} DSI Visionnaire',            weights: [0.45, 0.10, 0.45], minScore: 4.2 },
    { name: '\u26A1 DSI Strat\u00E8ge-Op\u00E9rationnel',   weights: [0.45, 0.45, 0.10], minScore: 4.2 },
    { name: '\u{1F52C} DSI Innovateur-Pragmatique',  weights: [0.10, 0.45, 0.45], minScore: 4.2 },
    { name: '\u{1F3AF} DSI Leader d\'Influence',     weights: [0.65, 0.15, 0.20], minScore: 3.8 },
    { name: '\u{1F3D7}\uFE0F DSI B\u00E2tisseur',              weights: [0.15, 0.65, 0.20], minScore: 3.8 },
    { name: '\u{1F4A1} DSI Explorateur',             weights: [0.20, 0.15, 0.65], minScore: 3.8 },
    { name: '\u{1F4C8} DSI en D\u00E9veloppement',        weights: [0.33, 0.34, 0.33], minScore: 3.0 },
    { name: '\u{1F331} DSI \u00C9mergent',               weights: [0.33, 0.34, 0.33], minScore: 0 },
  ];

  // ============================================================
  // SCORING FUNCTIONS
  // ============================================================

  // Extract numeric score from answer value.
  // Answers are stored as { s: weightedScore, r: rankString } objects,
  // with legacy fallback for plain numbers.
  function answerScore(val) {
    return typeof val === 'object' && val !== null ? val.s : val;
  }

  function normalizeScore(raw) {
    const linear01 = Math.max(0, Math.min(1,
      (raw - SCORE_THEORETICAL_MIN) / (SCORE_THEORETICAL_MAX - SCORE_THEORETICAL_MIN)
    ));
    const k = 3.0;
    const sigmoid = 1 / (1 + Math.exp(-k * (linear01 - 0.5) * 4));
    const sigMin  = 1 / (1 + Math.exp(-k * (-0.5) * 4));
    const sigMax  = 1 / (1 + Math.exp(-k * ( 0.5) * 4));
    const normalized = (sigmoid - sigMin) / (sigMax - sigMin);
    return Math.round(Math.max(0, Math.min(100, normalized * 100)));
  }

  function computeScores(answers) {
    const scores = {};
    DIMENSIONS.forEach(dim => {
      const arr = answers[dim.id] || [];
      if (arr.length === 0) { scores[dim.id] = 0; return; }
      scores[dim.id] = arr.reduce((a, v) => a + answerScore(v), 0) / arr.length;
    });
    return scores;
  }

  function getAnalysis(scores) {
    const pillarScores = PILLARS.map((_, pi) => {
      const dims = DIMENSIONS.filter(d => d.pillar === pi);
      return dims.reduce((s, d) => s + (scores[d.id] || 0), 0) / dims.length;
    });

    const avg = Object.values(scores).reduce((a, b) => a + (b || 0), 0) / DIMENSIONS.length;

    // Profile matching: first eligible in priority order wins
    let matchedProfile = PROFILES[PROFILES.length - 1];
    for (const profile of PROFILES) {
      const weightedScore = pillarScores.reduce((sum, s, i) => sum + s * profile.weights[i], 0);
      if (weightedScore >= profile.minScore) {
        matchedProfile = profile;
        break;
      }
    }

    return {
      profile: matchedProfile.name,
      avgNorm: normalizeScore(avg),
      pillarScoresNorm: pillarScores.map(s => normalizeScore(s)),
    };
  }

  // ============================================================
  // CACHING (sessionStorage, keyed by profile_code)
  // ============================================================
  const CACHE_PREFIX = 'dsi_profile_';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  function getCached(code) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + code);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_PREFIX + code);
        return null;
      }
      return data;
    } catch { return null; }
  }

  function setCache(code, data) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + code, JSON.stringify({
        data, timestamp: Date.now()
      }));
    } catch { /* sessionStorage full — non-critical */ }
  }

  function clearCache(code) {
    if (code) sessionStorage.removeItem(CACHE_PREFIX + code);
  }

  // ============================================================
  // FETCH — main entry point
  // ============================================================
  const _inflight = {};

  async function fetchProfile(code) {
    if (!code || !code.startsWith('AMA')) return null;

    const cached = getCached(code);
    if (cached) return cached;

    if (_inflight[code]) return _inflight[code];

    _inflight[code] = (async () => {
      try {
        const binData = await API.fetchBin('dsi_sessions');
        const sessions = binData.sessions || binData;

        const session = sessions[code];
        if (!session) {
          return { status: 'not_found', profile: null, avgNorm: null, pillarScoresNorm: null };
        }

        if (session.status !== 'completed') {
          const result = { status: 'in_progress', profile: null, avgNorm: null, pillarScoresNorm: null };
          setCache(code, result);
          return result;
        }

        const scores = computeScores(session.answers);
        const analysis = getAnalysis(scores);

        const result = {
          status: 'completed',
          profile: analysis.profile,
          avgNorm: analysis.avgNorm,
          pillarScoresNorm: analysis.pillarScoresNorm,
        };

        setCache(code, result);
        return result;
      } catch (e) {
        console.error('DSI Profile fetch error:', e);
        return { status: 'error', profile: null, avgNorm: null, pillarScoresNorm: null };
      } finally {
        delete _inflight[code];
      }
    })();

    return _inflight[code];
  }

  return { fetchProfile, clearCache };
})();
