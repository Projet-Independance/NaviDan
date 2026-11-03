// Language detection & localization
const translations = {
  fr: {
    title: 'Vous êtes en navigation privée',
    subtitle: 'NaviDan ne conserve aucune trace de votre session sur cet appareil.',
    placeholder: 'Rechercher sur le Web ou saisir une adresse...',
    c1Title: 'Zéro Historique',
    c1Desc: 'Les pages consultées et requêtes de recherche ne sont jamais enregistrées dans l\'historique.',
    c2Title: 'Cookies & Cache Éphémères',
    c2Desc: 'Les cookies et identifiants de session sont effacés de la mémoire dès fermeture de la fenêtre.',
    c3Title: 'Anti-Traceurs Actif',
    c3Desc: 'Le bouclier bloque automatiquement les publicités intrusives et les scripts de suivi tiers.',
    c4Title: 'Mémoire Pure Isolée',
    c4Desc: 'Chaque session privée s\'exécute dans un bac à sable RAM sans écriture sur le disque dur.',
    notice: '<strong>Important :</strong> La navigation privée n\'altère pas le comportement de votre employeur, école ou fournisseur d\'accès Internet. Les fichiers téléchargés restent enregistrés dans vos dossiers.'
  },
  en: {
    title: 'You are browsing in private',
    subtitle: 'NaviDan does not keep any traces of your session on this device.',
    placeholder: 'Search the Web or type an address...',
    c1Title: 'Zero History',
    c1Desc: 'Visited pages and search queries are never recorded in history.',
    c2Title: 'Ephemeral Cookies & Cache',
    c2Desc: 'Cookies and session credentials are erased from memory as soon as the window closes.',
    c3Title: 'Anti-Tracker Shield Active',
    c3Desc: 'The shield automatically blocks intrusive ads and third-party tracking scripts.',
    c4Title: 'Isolated Pure RAM',
    c4Desc: 'Each private session runs in a sandboxed RAM environment without writing to disk.',
    notice: '<strong>Important:</strong> Private browsing does not alter monitoring by your employer, school or ISP. Downloaded files remain saved in your folders.'
  }
};

function applyLanguage() {
  let lang = 'fr';
  try {
    const stored = localStorage.getItem('naviddan_language');
    if (stored) lang = stored;
    else if (navigator.language && navigator.language.startsWith('en')) lang = 'en';
  } catch {}

  const t = translations[lang] || translations.fr;
  document.getElementById('title-text').textContent = t.title;
  document.getElementById('desc-text').textContent = t.subtitle;
  document.getElementById('search-input').placeholder = t.placeholder;
  document.getElementById('card1-title').textContent = t.c1Title;
  document.getElementById('card1-desc').textContent = t.c1Desc;
  document.getElementById('card2-title').textContent = t.c2Title;
  document.getElementById('card2-desc').textContent = t.c2Desc;
  document.getElementById('card3-title').textContent = t.c3Title;
  document.getElementById('card3-desc').textContent = t.c3Desc;
  document.getElementById('card4-title').textContent = t.c4Title;
  document.getElementById('card4-desc').textContent = t.c4Desc;
  document.getElementById('notice-text').innerHTML = t.notice;
}

applyLanguage();

// Form search navigation
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

if (searchForm && searchInput) {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    let targetUrl;
    if (/^(https?:\/\/)/i.test(query)) {
      targetUrl = query;
    } else if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(query)) {
      targetUrl = 'https://' + query;
    } else {
      // Default to privacy-preserving DuckDuckGo search in incognito
      targetUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
    }

    window.location.href = targetUrl;
  });
}
