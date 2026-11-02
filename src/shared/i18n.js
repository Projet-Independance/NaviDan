(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NaviI18n = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const translations = {
    fr: {
      // General / Window
      app_title: 'NaviDan',
      btn_back: 'Précédent',
      btn_forward: 'Suivant',
      btn_reload: 'Recharger la page',
      btn_home: 'Page d\'accueil',
      url_placeholder: 'Rechercher sur le Web ou saisir une adresse...',
      security_secure: 'Connexion sécurisée (HTTPS)',
      security_insecure: 'Non sécurisé ou page locale',
      btn_mute_active: 'Couper/Activer le son de l\'onglet',
      btn_audio_panel: 'Gestionnaire audio',
      btn_turbo: 'Mode Turbo Jeu',
      turbo_active: 'TURBO ACTIF',
      btn_extensions: 'Extensions Chromium',
      btn_shield: 'Bouclier Anti-Pub',
      btn_downloads: 'Téléchargements',
      btn_history: 'Historique',
      btn_bookmarks: 'Favoris',
      btn_passwords: 'Mots de passe',
      btn_cleaner: 'Nettoyeur de cache',
      btn_perf: 'Limiteur RAM & CPU',
      btn_themes: 'Thèmes & Couleurs',
      btn_settings: 'Paramètres',
      btn_minimize: 'Réduire',
      btn_maximize: 'Agrandir',
      btn_close: 'Fermer',
      new_tab: 'Nouvel onglet',

      // Sidebar
      sidebar_gaming: 'Espace Gaming',
      sidebar_work: 'Espace Travail',
      sidebar_personal: 'Espace Personnel',
      sidebar_dev: 'Espace Développeur',
      sidebar_add_workspace: 'Ajouter un espace',
      sidebar_ai_title: 'NaviAI Assistant',
      sidebar_hide: 'Masquer la barre latérale',
      sidebar_show: 'Afficher la barre latérale',

      // NaviAI Panel
      naviai_title: 'NaviAI Assistant',
      naviai_tab_assist: '⚡ Assistant Web',
      naviai_tab_duck: '🌐 Duck.ai Chat',
      naviai_duck_free_label: '🌐 Duck.ai 100% Gratuit',
      naviai_duck_open_tab: '↗ Ouvrir en onglet',
      naviai_welcome_title: 'NaviAI Assistant',
      naviai_welcome_desc: 'Pose une question ou résume la page. Pour discuter immédiatement sans clé API, clique sur l\'onglet Duck.ai Chat.',
      naviai_input_placeholder: 'Pose une question, résume cette page, ou écris du code... (Entrée)',
      naviai_send_btn: 'Envoyer',
      naviai_context_active: 'Page active envoyée comme contexte',
      naviai_context_disabled: 'Contexte de page désactivé',
      naviai_clear_chat: 'Effacer la conversation',
      naviai_settings: 'Configurer l\'IA & Clés API',
      naviai_local_summary_title: '⚡ Synthèse Express Locale (100% Gratuite / Sans Clé)',
      naviai_words: 'mots',
      naviai_read_time: 'min de lecture estimée',
      naviai_no_text: 'Aucun contenu textuel détecté sur cet onglet.',

      // Settings Popup
      settings_title: 'Paramètres',
      settings_lang_label: 'Langue',
      settings_lang_sub: 'Langue de l\'interface du navigateur',
      settings_theme_label: 'Thème',
      settings_theme_sub: 'Apparence visuelle',
      settings_theme_dark: 'Cyber Sombre',
      settings_theme_light: 'Clair',
      settings_engine_label: 'Moteur de recherche',
      settings_engine_sub: 'Recherche par défaut',
      settings_adblock_label: 'Bouclier anti-pub',
      settings_adblock_sub: 'Filtrage pub & traqueurs',
      settings_bookmarks_label: 'Barre des favoris',
      settings_bookmarks_sub: 'Afficher sous l\'adresse',
      settings_sidebar_label: 'Barre latérale',
      settings_sidebar_sub: 'Afficher à gauche',
      settings_version: 'NaviDan • Moteur Chromium',

      // Extensions Popup
      ext_title: 'Gestionnaire d\'Extensions',
      ext_tab_my: 'Mes extensions',
      ext_tab_catalog: 'Catalogue 1-Clic',
      ext_cat_all: 'Toutes',
      ext_cat_privacy: 'Confidentialité',
      ext_cat_security: 'Sécurité',
      ext_cat_productivity: 'Productivité',
      ext_cat_media: 'Médias',
      ext_cat_dev: 'Dev',
      ext_cat_design: 'Design',
      ext_cat_tools: 'Outils',
      ext_cat_comfort: 'Confort',
      ext_cat_display: 'Affichage',
      ext_search_placeholder: 'Rechercher une extension...',
      ext_load_folder: '📁 Charger dossier décompressé',
      ext_install_input_placeholder: 'ID Web Store (32 lettres) ou URL...',
      ext_install_btn: 'Télécharger CRX',
      ext_install_action: 'Installer',
      ext_uninstall_btn: 'Supprimer',
      ext_uninstall_confirm: 'Supprimer ?',
      ext_active: 'Activée',
      ext_inactive: 'Désactivée',
      ext_installed: 'Installée',
      ext_no_installed: 'Aucune extension installée pour le moment.',
      ext_no_installed_hint: 'Explore le Catalogue 1-Clic ou colle un lien du Chrome Web Store ci-dessus.',
      ext_no_results: 'Aucune extension trouvée pour cette recherche.',
      ext_badge_top: 'Top',
      ext_badge_essential: 'Essentiel',
      ext_badge_popular: 'Populaire',
      ext_badge_pro: 'Pro',
      ext_badge_fast: 'Rapide',
      ext_badge_devtools: 'DevTools',
      ext_badge_useful: 'Utile',
      ext_badge_handy: 'Pratique',

      // Shield Popup
      shield_title: 'Bouclier de Protection',
      shield_status_active: 'Protection active',
      shield_status_inactive: 'Protection désactivée',
      shield_ads_blocked: 'Publicités bloquées',
      shield_trackers_blocked: 'Traqueurs bloqués',
      shield_site_label: 'Protection pour ce site',
      shield_toggle_site: 'Activer/Désactiver sur ce domaine',
      shield_total_stats: 'Total éléments bloqués depuis l\'ouverture',

      // Cleaner Popup
      cleaner_title: 'Nettoyeur de Cache & Données',
      cleaner_subtitle: 'Optimise la mémoire et préserve ta vie privée',
      cleaner_cache: 'Cache web & images',
      cleaner_cookies: 'Cookies & sessions',
      cleaner_history: 'Historique de navigation',
      cleaner_storage: 'Stockage local des sites',
      cleaner_btn_clean: 'Nettoyer maintenant',
      cleaner_done: 'Nettoyage terminé avec succès !',

      // Performance Popup
      perf_title: 'Limiteur de Ressources & Gaming',
      perf_ram_label: 'Limite de Mémoire RAM',
      perf_cpu_label: 'Limite d\'Usage CPU',
      perf_network_label: 'Limite de Bande Passante',
      perf_hard_limit: 'Limite stricte (bloquante)',
      perf_enabled: 'Activé',
      perf_disabled: 'Désactivé',

      // History Popup
      history_title: 'Historique de Navigation',
      history_search_placeholder: 'Rechercher dans l\'historique...',
      history_clear_all: 'Tout effacer',
      history_empty: 'Aucun historique récent.',
      history_delete_item: 'Supprimer de l\'historique',

      // Bookmarks Popup
      bookmarks_title: 'Gestionnaire de Favoris',
      bookmarks_add_btn: 'Ajouter cette page',
      bookmarks_search_placeholder: 'Rechercher un favori...',
      bookmarks_empty: 'Aucun favori enregistré.',
      bookmarks_delete: 'Supprimer ce favori',

      // Passwords Popup
      passwords_title: 'Gestionnaire de Mots de Passe',
      passwords_search_placeholder: 'Rechercher un compte...',
      passwords_add_btn: 'Nouveau compte',
      passwords_empty: 'Aucun mot de passe enregistré.',
      passwords_site: 'Site web',
      passwords_user: 'Identifiant / Email',
      passwords_pass: 'Mot de passe',
      passwords_copy: 'Copier',
      passwords_copied: 'Copié !',
      passwords_delete: 'Supprimer',

      // Audio Popup
      audio_title: 'Contrôle Audio des Onglets',
      audio_mute_all: 'Couper le son des onglets en arrière-plan',
      audio_no_media: 'Aucun flux audio détecté.',

      // Themes Popup
      themes_title: 'Personnalisation & Thèmes',
      themes_presets: 'Préréglages d\'ambiance',
      themes_accent: 'Couleur d\'accentuation',

      // Newtab Page
      newtab_greeting_morning: 'Bonjour',
      newtab_greeting_afternoon: 'Bon après-midi',
      newtab_greeting_evening: 'Bonsoir',
      newtab_search_placeholder: 'Rechercher ou entrer une URL...',
      newtab_speed_dial_title: 'Raccourcis rapides',
      newtab_add_shortcut: 'Ajouter un raccourci'
    },

    en: {
      // General / Window
      app_title: 'NaviDan',
      btn_back: 'Back',
      btn_forward: 'Forward',
      btn_reload: 'Reload page',
      btn_home: 'Home page',
      url_placeholder: 'Search the web or enter an address...',
      security_secure: 'Secure connection (HTTPS)',
      security_insecure: 'Not secure or local page',
      btn_mute_active: 'Mute/Unmute active tab',
      btn_audio_panel: 'Audio manager',
      btn_turbo: 'Gaming Turbo Mode',
      turbo_active: 'TURBO ACTIVE',
      btn_extensions: 'Chromium Extensions',
      btn_shield: 'Ad & Privacy Shield',
      btn_downloads: 'Downloads',
      btn_history: 'History',
      btn_bookmarks: 'Bookmarks',
      btn_passwords: 'Passwords',
      btn_cleaner: 'Cache Cleaner',
      btn_perf: 'RAM & CPU Limiter',
      btn_themes: 'Themes & Colors',
      btn_settings: 'Settings',
      btn_minimize: 'Minimize',
      btn_maximize: 'Maximize',
      btn_close: 'Close',
      new_tab: 'New tab',

      // Sidebar
      sidebar_gaming: 'Gaming Workspace',
      sidebar_work: 'Work Workspace',
      sidebar_personal: 'Personal Workspace',
      sidebar_dev: 'Developer Workspace',
      sidebar_add_workspace: 'Add workspace',
      sidebar_ai_title: 'NaviAI Assistant',
      sidebar_hide: 'Hide sidebar',
      sidebar_show: 'Show sidebar',

      // NaviAI Panel
      naviai_title: 'NaviAI Assistant',
      naviai_tab_assist: '⚡ Web Assistant',
      naviai_tab_duck: '🌐 Duck.ai Chat',
      naviai_duck_free_label: '🌐 Duck.ai 100% Free',
      naviai_duck_open_tab: '↗ Open in tab',
      naviai_welcome_title: 'NaviAI Assistant',
      naviai_welcome_desc: 'Ask questions or summarize pages. To chat instantly without any API key, switch to the Duck.ai Chat tab.',
      naviai_input_placeholder: 'Ask a question, summarize this page, or write code... (Enter)',
      naviai_send_btn: 'Send',
      naviai_context_active: 'Active page sent as context',
      naviai_context_disabled: 'Page context disabled',
      naviai_clear_chat: 'Clear conversation',
      naviai_settings: 'Configure AI & API Keys',
      naviai_local_summary_title: '⚡ Local Express Summary (100% Free / No Key)',
      naviai_words: 'words',
      naviai_read_time: 'min estimated reading time',
      naviai_no_text: 'No text content detected on this tab.',

      // Settings Popup
      settings_title: 'Settings',
      settings_lang_label: 'Language',
      settings_lang_sub: 'Browser interface language',
      settings_theme_label: 'Theme',
      settings_theme_sub: 'Visual appearance',
      settings_theme_dark: 'Cyber Dark',
      settings_theme_light: 'Light',
      settings_engine_label: 'Search engine',
      settings_engine_sub: 'Default search provider',
      settings_adblock_label: 'Ad blocker shield',
      settings_adblock_sub: 'Block ads & trackers',
      settings_bookmarks_label: 'Bookmarks bar',
      settings_bookmarks_sub: 'Show below address bar',
      settings_sidebar_label: 'Sidebar',
      settings_sidebar_sub: 'Show on left side',
      settings_version: 'NaviDan • Chromium Engine',

      // Extensions Popup
      ext_title: 'Extensions Manager',
      ext_tab_my: 'My extensions',
      ext_tab_catalog: '1-Click Catalog',
      ext_cat_all: 'All',
      ext_cat_privacy: 'Privacy',
      ext_cat_security: 'Security',
      ext_cat_productivity: 'Productivity',
      ext_cat_media: 'Media',
      ext_cat_dev: 'Dev',
      ext_cat_design: 'Design',
      ext_cat_tools: 'Tools',
      ext_cat_comfort: 'Comfort',
      ext_cat_display: 'Display',
      ext_search_placeholder: 'Search extensions...',
      ext_load_folder: '📁 Load unpacked extension folder',
      ext_install_input_placeholder: 'Web Store ID (32 chars) or URL...',
      ext_install_btn: 'Download CRX',
      ext_install_action: 'Install',
      ext_uninstall_btn: 'Remove',
      ext_uninstall_confirm: 'Remove?',
      ext_active: 'Enabled',
      ext_inactive: 'Disabled',
      ext_installed: 'Installed',
      ext_no_installed: 'No extensions installed yet.',
      ext_no_installed_hint: 'Explore the 1-Click Catalog or paste a Chrome Web Store link above.',
      ext_no_results: 'No extensions found matching your search.',
      ext_badge_top: 'Top',
      ext_badge_essential: 'Essential',
      ext_badge_popular: 'Popular',
      ext_badge_pro: 'Pro',
      ext_badge_fast: 'Fast',
      ext_badge_devtools: 'DevTools',
      ext_badge_useful: 'Useful',
      ext_badge_handy: 'Handy',

      // Shield Popup
      shield_title: 'Privacy & Security Shield',
      shield_status_active: 'Protection active',
      shield_status_inactive: 'Protection disabled',
      shield_ads_blocked: 'Ads blocked',
      shield_trackers_blocked: 'Trackers blocked',
      shield_site_label: 'Protection for this site',
      shield_toggle_site: 'Enable/Disable on this domain',
      shield_total_stats: 'Total items blocked since startup',

      // Cleaner Popup
      cleaner_title: 'Cache & Data Cleaner',
      cleaner_subtitle: 'Optimize memory and preserve your privacy',
      cleaner_cache: 'Web cache & images',
      cleaner_cookies: 'Cookies & sessions',
      cleaner_history: 'Browsing history',
      cleaner_storage: 'Local site storage',
      cleaner_btn_clean: 'Clean up now',
      cleaner_done: 'Cleanup completed successfully!',

      // Performance Popup
      perf_title: 'Resource & Gaming Limiter',
      perf_ram_label: 'RAM Memory Limit',
      perf_cpu_label: 'CPU Usage Limit',
      perf_network_label: 'Bandwidth Limit',
      perf_hard_limit: 'Hard limit (blocking)',
      perf_enabled: 'Enabled',
      perf_disabled: 'Disabled',

      // History Popup
      history_title: 'Browsing History',
      history_search_placeholder: 'Search history...',
      history_clear_all: 'Clear all',
      history_empty: 'No recent history.',
      history_delete_item: 'Remove from history',

      // Bookmarks Popup
      bookmarks_title: 'Bookmarks Manager',
      bookmarks_add_btn: 'Bookmark this page',
      bookmarks_search_placeholder: 'Search bookmarks...',
      bookmarks_empty: 'No bookmarks saved yet.',
      bookmarks_delete: 'Delete bookmark',

      // Passwords Popup
      passwords_title: 'Password Manager',
      passwords_search_placeholder: 'Search accounts...',
      passwords_add_btn: 'New account',
      passwords_empty: 'No passwords saved.',
      passwords_site: 'Website',
      passwords_user: 'Username / Email',
      passwords_pass: 'Password',
      passwords_copy: 'Copy',
      passwords_copied: 'Copied!',
      passwords_delete: 'Delete',

      // Audio Popup
      audio_title: 'Tab Audio Control',
      audio_mute_all: 'Mute background tabs',
      audio_no_media: 'No audio streams playing.',

      // Themes Popup
      themes_title: 'Customization & Themes',
      themes_presets: 'Visual Presets',
      themes_accent: 'Accent Color',

      // Newtab Page
      newtab_greeting_morning: 'Good morning',
      newtab_greeting_afternoon: 'Good afternoon',
      newtab_greeting_evening: 'Good evening',
      newtab_search_placeholder: 'Search or enter a URL...',
      newtab_speed_dial_title: 'Quick Access',
      newtab_add_shortcut: 'Add shortcut'
    }
  };

  let currentLang = 'fr';

  function normalizeLang(lang) {
    if (!lang || typeof lang !== 'string') return 'fr';
    const clean = lang.toLowerCase().slice(0, 2);
    return clean === 'en' ? 'en' : 'fr';
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    currentLang = normalizeLang(lang);
    return currentLang;
  }

  function t(key, lang = null) {
    const l = lang ? normalizeLang(lang) : currentLang;
    const dict = translations[l] || translations.fr;
    if (dict && dict[key] !== undefined) {
      return dict[key];
    }
    // Fallback to French or key
    if (translations.fr && translations.fr[key] !== undefined) {
      return translations.fr[key];
    }
    return key;
  }

  function applyToDOM(root = document, lang = null) {
    if (!root || !root.querySelectorAll) return;
    const l = lang ? setLang(lang) : currentLang;

    // Set document lang attribute
    if (root.documentElement) {
      root.documentElement.lang = l;
    }

    // Text content
    const textEls = root.querySelectorAll('[data-i18n]');
    textEls.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key, l);
      }
    });

    // Placeholders
    const placeholderEls = root.querySelectorAll('[data-i18n-placeholder]');
    placeholderEls.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = t(key, l);
      }
    });

    // Titles / Tooltips
    const titleEls = root.querySelectorAll('[data-i18n-title]');
    titleEls.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = t(key, l);
      }
    });

    // Aria Labels
    const ariaEls = root.querySelectorAll('[data-i18n-aria]');
    ariaEls.forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) {
        el.setAttribute('aria-label', t(key, l));
      }
    });
  }

  return {
    translations,
    normalizeLang,
    getLang,
    setLang,
    t,
    applyToDOM
  };
}));

