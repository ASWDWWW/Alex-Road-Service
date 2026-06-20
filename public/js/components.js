/* =====================================================
   ALEX ROAD SERVICE — Shared Components
   Single source for Nav + Footer HTML
   Update PHONE, EMAIL, ADDRESS here to apply site-wide
   ===================================================== */

const SITE = {
  phone:       '(732) 938-0713',
  phoneTel:    'tel:+17329380713',
  phoneEmerg:  '(732) 938-0713',
  phoneTelEmg: 'tel:+17329380713',
  email:       'info@alexroadservice.com',
  address:     '406 Smith St, Keasbey, NJ 08832',
  hours:       'Opens 8 AM Sat · Call for current hours',
  mapEmbed:    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3028.0!2d-74.3064402!3d40.5177451!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c3cb04e9bbc1ff%3A0xede71e79568aa5f9!2sAlex%20Road%20Service%20-%20Commercial%20Trucks%2C%20Onsite%20Truck%20%26%20Trailer%20Repair!5e0!3m2!1sen!2sus',
};

/* ─── NAV ─── */
function buildNav() {
  const path = window.location.pathname;
  const isActive = (href) => {
    if (href === '/' || href === '/index.html') return path === '/' || path === '/index.html' || path === '/index';
    return path.includes(href.replace('.html','').replace('/',''));
  };
  const link = (href, label) =>
    `<a href="${href}" class="nav__link${isActive(href) ? ' active' : ''}">${label}</a>`;

  return `
<div class="e-banner" id="eBanner">
  <div class="e-banner__dot"></div>
  <span>24/7 EMERGENCY ROADSIDE SERVICE — CALL NOW</span>
  <a href="${SITE.phoneTelEmg}">${SITE.phoneEmerg}</a>
  <button class="e-banner__close" id="eBannerClose" aria-label="Dismiss banner">&#x2715;</button>
</div>

<nav class="nav" id="mainNav">
  <a href="/" class="nav__logo">
    <div class="nav__logo-mark">A</div>
    <span class="nav__logo-text">ALEX ROAD SERVICE</span>
  </a>

  <div class="nav__links" id="navLinks">
    ${link('/', 'Home')}
    ${link('/about.html', 'About')}
    <div class="nav__drop">
      <a href="/services.html" class="nav__link nav__drop-toggle${(isActive('/services.html')||isActive('/emergency.html')||isActive('/commercial.html'))?' active':''}">
        Services <i class="fas fa-chevron-down"></i>
      </a>
      <div class="nav__drop-menu">
        <a href="/services.html"    class="nav__drop-item">All Services</a>
        <a href="/emergency.html"   class="nav__drop-item"><i class="fas fa-bolt" style="color:var(--red);margin-right:8px;width:14px"></i>Emergency Roadside</a>
        <a href="/commercial.html"  class="nav__drop-item"><i class="fas fa-truck" style="color:var(--red);margin-right:8px;width:14px"></i>Commercial Truck Repair</a>
      </div>
    </div>
    ${link('/reviews.html', 'Reviews')}
    ${link('/financing.html', 'Financing')}
    ${link('/contact.html', 'Contact')}
    <a href="${SITE.phoneTel}" class="nav__call-mobile btn btn--primary btn--full">
      <i class="fas fa-phone"></i> CALL NOW — ${SITE.phoneEmerg}
    </a>
  </div>

  <div class="nav__actions">
    <a href="${SITE.phoneTel}" class="btn btn--primary btn--sm">
      <i class="fas fa-phone"></i> CALL NOW
    </a>
    <a href="/login.html" class="nav__login">LOGIN</a>
  </div>

  <button class="nav__burger" id="navBurger" aria-label="Toggle navigation" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
</nav>

<div class="scroll-bar" id="scrollBar"></div>`;
}

/* ─── FOOTER ─── */
function buildFooter() {
  const year = new Date().getFullYear();
  return `
<footer class="footer">
  <div class="container">
    <div class="footer__grid">

      <!-- Brand -->
      <div>
        <div class="footer__logo">
          <div class="footer__logo-mark">A</div>
          ALEX ROAD SERVICE
        </div>
        <p class="footer__desc">
          Professional commercial truck repair and 24/7 emergency roadside service.
          Keeping your fleet moving, day and night.
        </p>
        <div class="footer__socials">
          <a href="#" class="footer__social" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
          <a href="#" class="footer__social" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
          <a href="#" class="footer__social" aria-label="Google"><i class="fab fa-google"></i></a>
          <a href="#" class="footer__social" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
        </div>
      </div>

      <!-- Services -->
      <div>
        <div class="footer__heading">Services</div>
        <div class="footer__links">
          <a href="/services.html"    class="footer__link">All Services</a>
          <a href="/emergency.html"   class="footer__link">Emergency Roadside</a>
          <a href="/commercial.html"  class="footer__link">Commercial Truck Repair</a>
          <a href="/services.html"    class="footer__link">Diesel Engine Repair</a>
          <a href="/services.html"    class="footer__link">Trailer Repair</a>
          <a href="/services.html"    class="footer__link">DOT Inspections</a>
          <a href="/services.html"    class="footer__link">Preventive Maintenance</a>
        </div>
      </div>

      <!-- Company -->
      <div>
        <div class="footer__heading">Company</div>
        <div class="footer__links">
          <a href="/about.html"      class="footer__link">About Us</a>
          <a href="/reviews.html"    class="footer__link">Reviews</a>
          <a href="/financing.html"  class="footer__link">Financing</a>
          <a href="/contact.html"    class="footer__link">Contact Us</a>
          <a href="/contact.html"    class="footer__link">Request a Quote</a>
          <a href="/login.html"      class="footer__link">Staff Login</a>
        </div>
      </div>

      <!-- Contact -->
      <div>
        <div class="footer__heading">Get In Touch</div>
        <div class="footer__contact-item">
          <i class="fas fa-phone"></i>
          <div>
            <a href="${SITE.phoneTelEmg}">${SITE.phoneEmerg}</a><br>
            <span style="font-size:.78rem;color:var(--warm-gray)">24/7 Emergency Line</span>
          </div>
        </div>
        <div class="footer__contact-item">
          <i class="fas fa-phone"></i>
          <a href="${SITE.phoneTel}">${SITE.phone}</a>
        </div>
        <div class="footer__contact-item">
          <i class="fas fa-envelope"></i>
          <a href="mailto:${SITE.email}">${SITE.email}</a>
        </div>
        <div class="footer__contact-item">
          <i class="fas fa-map-marker-alt"></i>
          <span>${SITE.address}</span>
        </div>
        <div class="footer__contact-item">
          <i class="fas fa-clock"></i>
          <span>${SITE.hours}</span>
        </div>
      </div>

    </div><!-- /.footer__grid -->

    <div class="footer__bottom">
      <span class="footer__copy">© ${year} Alex Road Service. All rights reserved.</span>
      <div class="footer__bottom-links">
        <a href="/privacy.html" class="footer__bottom-link">Privacy Policy</a>
        <a href="/terms.html" class="footer__bottom-link">Terms of Service</a>
        <a href="/sitemap.xml" class="footer__bottom-link">Sitemap</a>
      </div>
    </div>
  </div>
</footer>`;
}

/* ─── INJECT ─── */
(function loadFirebaseAnalytics() {
  if (document.querySelector('script[src="/js/firebase-config.js"]')) return;
  const s = document.createElement('script');
  s.src = '/js/firebase-config.js';
  s.defer = true;
  document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', () => {
  // Inject nav
  document.body.insertAdjacentHTML('afterbegin', buildNav());

  // Inject footer (before closing body if placeholder exists, else append)
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    footerPlaceholder.outerHTML = buildFooter();
  } else {
    document.body.insertAdjacentHTML('beforeend', buildFooter());
  }
});
