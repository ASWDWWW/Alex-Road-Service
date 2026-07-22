/* =====================================================
   ALEX ROAD SERVICE — Full-site language translation
   Branded switcher + Google Translate (100+ languages)
   Works on public website and ops platform end-to-end
   ===================================================== */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'ars_lang';
  const SOURCE_LANG = 'en';

  /** Languages available in the switcher (Google Translate codes). */
  const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'jv', name: 'Javanese', native: 'Basa Jawa' },
    { code: 'ko', name: 'Korean', native: '한국어' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
    { code: 'ur', name: 'Urdu', native: 'اردو' },
    { code: 'it', name: 'Italian', native: 'Italiano' },
    { code: 'th', name: 'Thai', native: 'ไทย' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'pl', name: 'Polish', native: 'Polski' },
    { code: 'uk', name: 'Ukrainian', native: 'Українська' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
    { code: 'my', name: 'Burmese', native: 'မြန်မာ' },
    { code: 'nl', name: 'Dutch', native: 'Nederlands' },
    { code: 'el', name: 'Greek', native: 'Ελληνικά' },
    { code: 'cs', name: 'Czech', native: 'Čeština' },
    { code: 'ro', name: 'Romanian', native: 'Română' },
    { code: 'hu', name: 'Hungarian', native: 'Magyar' },
    { code: 'sv', name: 'Swedish', native: 'Svenska' },
    { code: 'he', name: 'Hebrew', native: 'עברית' },
    { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
    { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
    { code: 'tl', name: 'Filipino', native: 'Filipino' },
    { code: 'fa', name: 'Persian', native: 'فارسی' },
    { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl ayisyen' },
    { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
    { code: 'am', name: 'Amharic', native: 'አማርኛ' },
    { code: 'ha', name: 'Hausa', native: 'Hausa' },
    { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
    { code: 'ig', name: 'Igbo', native: 'Igbo' },
    { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
    { code: 'sq', name: 'Albanian', native: 'Shqip' },
    { code: 'hy', name: 'Armenian', native: 'Հայերեն' },
    { code: 'az', name: 'Azerbaijani', native: 'Azərbaycan' },
    { code: 'eu', name: 'Basque', native: 'Euskara' },
    { code: 'be', name: 'Belarusian', native: 'Беларуская' },
    { code: 'bs', name: 'Bosnian', native: 'Bosanski' },
    { code: 'bg', name: 'Bulgarian', native: 'Български' },
    { code: 'ca', name: 'Catalan', native: 'Català' },
    { code: 'ceb', name: 'Cebuano', native: 'Cebuano' },
    { code: 'ny', name: 'Chichewa', native: 'Chichewa' },
    { code: 'co', name: 'Corsican', native: 'Corsu' },
    { code: 'hr', name: 'Croatian', native: 'Hrvatski' },
    { code: 'da', name: 'Danish', native: 'Dansk' },
    { code: 'eo', name: 'Esperanto', native: 'Esperanto' },
    { code: 'et', name: 'Estonian', native: 'Eesti' },
    { code: 'fi', name: 'Finnish', native: 'Suomi' },
    { code: 'fy', name: 'Frisian', native: 'Frysk' },
    { code: 'gl', name: 'Galician', native: 'Galego' },
    { code: 'ka', name: 'Georgian', native: 'ქართული' },
    { code: 'haw', name: 'Hawaiian', native: 'ʻŌlelo Hawaiʻi' },
    { code: 'hmn', name: 'Hmong', native: 'Hmong' },
    { code: 'is', name: 'Icelandic', native: 'Íslenska' },
    { code: 'ga', name: 'Irish', native: 'Gaeilge' },
    { code: 'kk', name: 'Kazakh', native: 'Қазақ' },
    { code: 'km', name: 'Khmer', native: 'ខ្មែរ' },
    { code: 'rw', name: 'Kinyarwanda', native: 'Kinyarwanda' },
    { code: 'ku', name: 'Kurdish', native: 'Kurdî' },
    { code: 'ky', name: 'Kyrgyz', native: 'Кыргызча' },
    { code: 'lo', name: 'Lao', native: 'ລາວ' },
    { code: 'la', name: 'Latin', native: 'Latina' },
    { code: 'lv', name: 'Latvian', native: 'Latviešu' },
    { code: 'lt', name: 'Lithuanian', native: 'Lietuvių' },
    { code: 'lb', name: 'Luxembourgish', native: 'Lëtzebuergesch' },
    { code: 'mk', name: 'Macedonian', native: 'Македонски' },
    { code: 'mg', name: 'Malagasy', native: 'Malagasy' },
    { code: 'mt', name: 'Maltese', native: 'Malti' },
    { code: 'mi', name: 'Maori', native: 'Māori' },
    { code: 'mn', name: 'Mongolian', native: 'Монгол' },
    { code: 'ne', name: 'Nepali', native: 'नेपाली' },
    { code: 'no', name: 'Norwegian', native: 'Norsk' },
    { code: 'ps', name: 'Pashto', native: 'پښتو' },
    { code: 'sm', name: 'Samoan', native: 'Gagana Samoa' },
    { code: 'gd', name: 'Scottish Gaelic', native: 'Gàidhlig' },
    { code: 'sr', name: 'Serbian', native: 'Српски' },
    { code: 'st', name: 'Sesotho', native: 'Sesotho' },
    { code: 'sn', name: 'Shona', native: 'ChiShona' },
    { code: 'sd', name: 'Sindhi', native: 'سنڌي' },
    { code: 'si', name: 'Sinhala', native: 'සිංහල' },
    { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
    { code: 'sl', name: 'Slovenian', native: 'Slovenščina' },
    { code: 'so', name: 'Somali', native: 'Soomaali' },
    { code: 'su', name: 'Sundanese', native: 'Basa Sunda' },
    { code: 'tg', name: 'Tajik', native: 'Тоҷикӣ' },
    { code: 'tt', name: 'Tatar', native: 'Татар' },
    { code: 'tk', name: 'Turkmen', native: 'Türkmen' },
    { code: 'ug', name: 'Uyghur', native: 'ئۇيغۇرچە' },
    { code: 'uz', name: 'Uzbek', native: 'Oʻzbek' },
    { code: 'cy', name: 'Welsh', native: 'Cymraeg' },
    { code: 'xh', name: 'Xhosa', native: 'isiXhosa' },
    { code: 'yi', name: 'Yiddish', native: 'ייִדיש' },
    { code: 'zu', name: 'Zulu', native: 'isiZulu' },
  ];

  const LANG_MAP = new Map(LANGUAGES.map((lang) => [lang.code, lang]));
  const RTL_CODES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi']);

  let googleReady = false;
  let mounted = false;

  function getSavedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === SOURCE_LANG || LANG_MAP.has(saved))) return saved;
    } catch (_) { /* ignore */ }
    return SOURCE_LANG;
  }

  function saveLang(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (_) { /* ignore */ }
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function setGoogTransCookie(value) {
    const domains = [''];
    const host = location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      domains.push(host);
      const parts = host.split('.');
      if (parts.length > 1) domains.push('.' + parts.slice(-2).join('.'));
    }
    domains.forEach((domain) => {
      const domainPart = domain ? `;domain=${domain}` : '';
      if (!value) {
        document.cookie = `googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domainPart}`;
      } else {
        document.cookie = `googtrans=${value};path=/${domainPart}`;
      }
    });
  }

  function applyDocumentLang(code) {
    const html = document.documentElement;
    html.setAttribute('lang', code === 'zh-CN' ? 'zh-Hans' : code === 'zh-TW' ? 'zh-Hant' : code);
    html.setAttribute('dir', RTL_CODES.has(code) ? 'rtl' : 'ltr');
  }

  function currentTranslateTarget() {
    const cookie = getCookie('googtrans');
    if (!cookie) return SOURCE_LANG;
    const parts = cookie.split('/');
    return parts[2] || SOURCE_LANG;
  }

  function setLanguage(code, { reload = true } = {}) {
    if (!LANG_MAP.has(code) && code !== SOURCE_LANG) return;

    const prev = getSavedLang();
    const alreadyActive = prev === code && (
      code === SOURCE_LANG ? !getCookie('googtrans') : currentTranslateTarget() === code
    );
    if (alreadyActive) {
      updateSwitcherUI();
      closeAllPanels();
      return;
    }

    saveLang(code);
    applyDocumentLang(code);

    if (code === SOURCE_LANG) {
      setGoogTransCookie('');
    } else {
      setGoogTransCookie(`/${SOURCE_LANG}/${code}`);
    }

    updateSwitcherUI();

    if (reload) location.reload();
  }

  function buildSwitcherHTML(variant) {
    const current = getSavedLang();
    const meta = LANG_MAP.get(current) || LANG_MAP.get(SOURCE_LANG);
    const label = meta ? meta.native : 'English';
    const isApp = variant === 'app';
    const btnClass = isApp ? 'lang-switcher__btn lang-switcher__btn--app' : 'lang-switcher__btn';

    const options = LANGUAGES.map((lang) => {
      const selected = lang.code === current ? ' aria-selected="true"' : ' aria-selected="false"';
      const active = lang.code === current ? ' is-active' : '';
      return `<button type="button" class="lang-switcher__option${active}" role="option" data-lang="${lang.code}"${selected}>
        <span class="lang-switcher__option-native">${escapeHtml(lang.native)}</span>
        <span class="lang-switcher__option-name">${escapeHtml(lang.name)}</span>
      </button>`;
    }).join('');

    return `
<div class="lang-switcher${isApp ? ' lang-switcher--app' : ''}" data-lang-root>
  <button type="button" class="${btnClass}" data-lang-toggle aria-haspopup="listbox" aria-expanded="false" aria-label="Translate website — current language ${escapeHtml(label)}" title="Translate">
    <i class="fas fa-globe" aria-hidden="true"></i>
    <span class="lang-switcher__label notranslate" translate="no">${escapeHtml(label)}</span>
    <i class="fas fa-chevron-down lang-switcher__chevron" aria-hidden="true"></i>
  </button>
  <div class="lang-switcher__panel" data-lang-panel hidden role="listbox" aria-label="Choose language">
    <div class="lang-switcher__search-wrap">
      <i class="fas fa-search" aria-hidden="true"></i>
      <input type="search" class="lang-switcher__search notranslate" translate="no" placeholder="Search languages…" aria-label="Search languages" autocomplete="off">
    </div>
    <div class="lang-switcher__list" data-lang-list>
      ${options}
    </div>
  </div>
</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function closeAllPanels() {
    document.querySelectorAll('[data-lang-root]').forEach((root) => {
      const panel = root.querySelector('[data-lang-panel]');
      const toggle = root.querySelector('[data-lang-toggle]');
      if (panel) panel.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
    });
  }

  function updateSwitcherUI() {
    const current = getSavedLang();
    const meta = LANG_MAP.get(current) || LANG_MAP.get(SOURCE_LANG);
    document.querySelectorAll('[data-lang-root]').forEach((root) => {
      const label = root.querySelector('.lang-switcher__label');
      if (label && meta) label.textContent = meta.native;
      root.querySelectorAll('.lang-switcher__option').forEach((opt) => {
        const active = opt.getAttribute('data-lang') === current;
        opt.classList.toggle('is-active', active);
        opt.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    });
  }

  function bindSwitcher(root) {
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    const toggle = root.querySelector('[data-lang-toggle]');
    const panel = root.querySelector('[data-lang-panel]');
    const search = root.querySelector('.lang-switcher__search');
    const list = root.querySelector('[data-lang-list]');

    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      closeAllPanels();
      if (open) {
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        root.classList.add('is-open');
        search?.focus();
      }
    });

    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll('.lang-switcher__option').forEach((opt) => {
        const text = opt.textContent.toLowerCase();
        opt.hidden = q ? !text.includes(q) : false;
      });
    });

    list?.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-lang]');
      if (!opt) return;
      const code = opt.getAttribute('data-lang');
      closeAllPanels();
      setLanguage(code);
    });
  }

  function mountInto(el, variant) {
    if (!el) return;
    el.innerHTML = buildSwitcherHTML(variant);
    bindSwitcher(el.querySelector('[data-lang-root]'));
  }

  function mountAll() {
    document.querySelectorAll('[data-lang-switcher]').forEach((el) => {
      const variant = el.getAttribute('data-lang-switcher') || 'site';
      mountInto(el, variant);
    });
    mounted = true;
    updateSwitcherUI();
  }

  function ensureGoogleTranslateHost() {
    if (document.getElementById('google_translate_element')) return;
    const host = document.createElement('div');
    host.id = 'google_translate_element';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0)';
    document.body.appendChild(host);
  }

  function loadGoogleTranslate() {
    if (document.querySelector('script[data-ars-google-translate]')) return;

    global.googleTranslateElementInit = function googleTranslateElementInit() {
      ensureGoogleTranslateHost();
      try {
        // eslint-disable-next-line no-new
        new global.google.translate.TranslateElement({
          pageLanguage: SOURCE_LANG,
          includedLanguages: LANGUAGES.map((l) => l.code).filter((c) => c !== SOURCE_LANG).join(','),
          autoDisplay: false,
          multilanguagePage: true,
        }, 'google_translate_element');
        googleReady = true;

        const saved = getSavedLang();
        if (saved !== SOURCE_LANG) {
          const tryApply = () => {
            const combo = document.querySelector('.goog-te-combo');
            if (combo) {
              if (combo.value !== saved) {
                combo.value = saved;
                combo.dispatchEvent(new Event('change'));
              }
              return true;
            }
            return false;
          };
          if (!tryApply()) {
            let tries = 0;
            const timer = setInterval(() => {
              tries += 1;
              if (tryApply() || tries > 40) clearInterval(timer);
            }, 100);
          }
        }
      } catch (err) {
        console.warn('[i18n] Google Translate init failed', err);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.dataset.arsGoogleTranslate = '1';
    document.head.appendChild(script);
  }

  function injectAssets() {
    if (!document.querySelector('link[data-ars-i18n-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/i18n.css';
      link.dataset.arsI18nCss = '1';
      document.head.appendChild(link);
    }
  }

  function protectNoTranslate() {
    document.querySelectorAll(
      'a[href^="tel:"], a[href^="mailto:"], .nav__logo-text, .footer__logo, .sidebar__brand-name'
    ).forEach((el) => {
      el.classList.add('notranslate');
      el.setAttribute('translate', 'no');
    });
  }

  function init() {
    injectAssets();
    applyDocumentLang(getSavedLang());

    const saved = getSavedLang();
    if (saved === SOURCE_LANG) {
      if (getCookie('googtrans')) setGoogTransCookie('');
    } else if (currentTranslateTarget() !== saved) {
      setGoogTransCookie(`/${SOURCE_LANG}/${saved}`);
    }

    ensureGoogleTranslateHost();
    loadGoogleTranslate();
    mountAll();
    protectNoTranslate();

    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-lang-root]')) closeAllPanels();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllPanels();
    });
  }

  /** HTML snippet for nav / topbar placeholders. */
  function placeholder(variant) {
    return `<div class="lang-switcher-mount" data-lang-switcher="${variant || 'site'}"></div>`;
  }

  const api = {
    LANGUAGES,
    getLang: getSavedLang,
    setLanguage,
    mountAll,
    mountInto,
    placeholder,
    init,
    isReady: () => googleReady && mounted,
  };

  global.ARS_I18N = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
