// Amarillo ATS — Signal Engine: Référentiel Régions françaises
// Mapping régions → départements pour filtrage géographique

const SignalRegions = (() => {

  const REGIONS = {
    'Pays de la Loire':      { deps: ['44','49','53','72','85'], center: [47.47, -1.55], zoom: 8 },
    'Ile-de-France':         { deps: ['75','77','78','91','92','93','94','95'], center: [48.86, 2.35], zoom: 9 },
    'Auvergne-Rhone-Alpes':  { deps: ['01','03','07','15','26','38','42','43','63','69','73','74'], center: [45.76, 4.84], zoom: 7 },
    'Nouvelle-Aquitaine':    { deps: ['16','17','19','23','24','33','40','47','64','79','86','87'], center: [44.84, -0.58], zoom: 7 },
    'Occitanie':             { deps: ['09','11','12','30','31','32','34','46','48','65','66','81','82'], center: [43.60, 1.44], zoom: 7 },
    'Hauts-de-France':       { deps: ['02','59','60','62','80'], center: [49.90, 2.30], zoom: 8 },
    'Grand Est':             { deps: ['08','10','51','52','54','55','57','67','68','88'], center: [48.58, 7.75], zoom: 7 },
    'Provence-Alpes-Cote d\'Azur': { deps: ['04','05','06','13','83','84'], center: [43.30, 5.37], zoom: 8 },
    'Bretagne':              { deps: ['22','29','35','56'], center: [48.11, -2.75], zoom: 8 },
    'Normandie':             { deps: ['14','27','50','61','76'], center: [49.18, -0.37], zoom: 8 },
    'Bourgogne-Franche-Comte': { deps: ['21','25','39','58','70','71','89','90'], center: [47.02, 4.83], zoom: 7 },
    'Centre-Val de Loire':   { deps: ['18','28','36','37','41','45'], center: [47.39, 1.69], zoom: 8 },
    'Corse':                 { deps: ['2A','2B'], center: [42.04, 9.01], zoom: 9 },
  };

  // Build reverse lookup: département → région
  const _depToRegion = {};
  for (const [region, data] of Object.entries(REGIONS)) {
    for (const dep of data.deps) {
      _depToRegion[dep] = region;
    }
  }

  function getRegionNames() {
    return Object.keys(REGIONS);
  }

  function getRegion(name) {
    return REGIONS[name] || null;
  }

  function getDepartements(regionName) {
    const r = REGIONS[regionName];
    return r ? r.deps : [];
  }

  function codePostalToDep(cp) {
    if (!cp) return null;
    const str = String(cp).padStart(5, '0');
    // Corse: 20000-20999 → 2A/2B
    if (str.startsWith('20')) {
      const num = parseInt(str.substring(0, 3));
      return num <= 201 ? '2A' : '2B';
    }
    return str.substring(0, 2);
  }

  function codePostalToRegion(cp) {
    const dep = codePostalToDep(cp);
    return dep ? (_depToRegion[dep] || null) : null;
  }

  function depToRegion(dep) {
    return _depToRegion[dep] || null;
  }

  return { REGIONS, getRegionNames, getRegion, getDepartements, codePostalToDep, codePostalToRegion, depToRegion };
})();
