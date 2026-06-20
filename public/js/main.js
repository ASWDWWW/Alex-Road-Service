/* =====================================================
   ALEX ROAD SERVICE — Main JavaScript
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ─── BANNER DISMISS ─── */
  const banner    = document.getElementById('eBanner');
  const bannerBtn = document.getElementById('eBannerClose');

  if (sessionStorage.getItem('bannerDismissed') === '1' && banner) {
    banner.style.display = 'none';
    document.documentElement.style.setProperty('--banner-h', '0px');
  }

  bannerBtn?.addEventListener('click', () => {
    if (banner) {
      banner.style.height = '0';
      banner.style.overflow = 'hidden';
      banner.style.opacity = '0';
      banner.style.transition = 'all 0.3s ease';
      setTimeout(() => { banner.style.display = 'none'; }, 310);
    }
    document.documentElement.style.setProperty('--banner-h', '0px');
    sessionStorage.setItem('bannerDismissed', '1');
  });

  /* ─── NAV SCROLL EFFECT ─── */
  const nav       = document.getElementById('mainNav');
  const scrollBar = document.getElementById('scrollBar');

  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 24);

    if (scrollBar) {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      scrollBar.style.width = scrollable > 0
        ? `${Math.min((window.scrollY / scrollable) * 100, 100)}%`
        : '0%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ─── MOBILE HAMBURGER ─── */
  const burger   = document.getElementById('navBurger');
  const navLinks = document.getElementById('navLinks');

  burger?.addEventListener('click', () => {
    const isOpen = burger.classList.toggle('open');
    navLinks?.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', isOpen);
    if (!isOpen) {
      document.querySelectorAll('.nav__drop.open').forEach(el => el.classList.remove('open'));
    }
  });

  document.querySelectorAll('.nav__drop-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      if (window.innerWidth > 1024) return;
      e.preventDefault();
      const drop = toggle.closest('.nav__drop');
      if (!drop) return;
      document.querySelectorAll('.nav__drop.open').forEach(el => {
        if (el !== drop) el.classList.remove('open');
      });
      drop.classList.toggle('open');
    });
  });

  // Close on link click
  document.querySelectorAll('.nav__link:not(.nav__drop-toggle), .nav__drop-item, .nav__call-mobile').forEach(el => {
    el.addEventListener('click', () => {
      burger?.classList.remove('open');
      navLinks?.classList.remove('open');
      burger?.setAttribute('aria-expanded', 'false');
      document.querySelectorAll('.nav__drop.open').forEach(d => d.classList.remove('open'));
    });
  });

  /* ─── SCROLL ANIMATIONS (fade-up) ─── */
  const fadeEls = document.querySelectorAll('.fade-up');
  if (fadeEls.length) {
    const fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 90);
          fadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    fadeEls.forEach(el => fadeObserver.observe(el));
  }

  /* ─── COUNTER ANIMATION ─── */
  function animateCounter(el) {
    const target   = parseFloat(el.dataset.target);
    const suffix   = el.dataset.suffix  || '';
    const prefix   = el.dataset.prefix  || '';
    const decimals = (target % 1 !== 0) ? 1 : 0;
    const duration = 1600;
    const fps      = 60;
    const steps    = Math.floor(duration / (1000 / fps));
    const inc      = target / steps;
    let   current  = 0;
    let   frame    = 0;

    const timer = setInterval(() => {
      frame++;
      current = Math.min(current + inc, target);
      el.textContent = prefix + current.toFixed(decimals) + suffix;
      if (frame >= steps) {
        el.textContent = prefix + target.toFixed(decimals) + suffix;
        clearInterval(timer);
      }
    }, 1000 / fps);
  }

  const counters = document.querySelectorAll('[data-target]');
  if (counters.length) {
    const ctrObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          ctrObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(el => ctrObserver.observe(el));
  }

  /* ─── CONTACT FORM ─── */
  const contactForm   = document.getElementById('contactForm');
  const successAlert  = document.getElementById('formSuccess');
  const errorAlert    = document.getElementById('formError');

  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...';

    const data = {
      name:      contactForm.elements['name']?.value     || '',
      company:   contactForm.elements['company']?.value || '',
      email:     contactForm.elements['email']?.value    || '',
      phone:     contactForm.elements['phone']?.value    || '',
      service:   contactForm.elements['service']?.value  || '',
      truck:     contactForm.elements['truck']?.value    || '',
      location:  contactForm.elements['location']?.value || '',
      message:   contactForm.elements['message']?.value  || '',
      timestamp: new Date().toISOString(),
      source:    'website-contact-form',
    };

    try {
      if (typeof window.submitContactForm === 'function') {
        await window.submitContactForm(data);
      } else {
        // Fallback: simulate success for demo
        await new Promise(r => setTimeout(r, 900));
      }
      successAlert?.classList.add('show');
      errorAlert?.classList.remove('show');
      contactForm.reset();
      successAlert?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error('Form error:', err);
      errorAlert?.classList.add('show');
      successAlert?.classList.remove('show');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  /* ─── PHONE CLICK ANALYTICS ─── */
  document.querySelectorAll('a[href^="tel:"]').forEach(el => {
    el.addEventListener('click', () => {
      if (typeof gtag === 'function') {
        gtag('event', 'phone_call_click', {
          event_category: 'Contact',
          event_label: el.textContent.trim(),
        });
      }
    });
  });

  /* ─── SMOOTH SCROLL for anchor links ─── */
  document.querySelectorAll('a[href^="#"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = document.querySelector(el.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) +
                       parseInt(getComputedStyle(document.documentElement).getPropertyValue('--banner-h')) + 8;
        window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
      }
    });
  });

});
