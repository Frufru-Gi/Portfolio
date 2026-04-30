const body = document.body;
const toggle = document.querySelector(".menu-toggle");
const menuLabel = document.querySelector(".menu-label");
const menu = document.querySelector(".site-menu");

if (toggle && menu) {
  // Match CSS: open = saracinesca 700ms + items 700ms with 180ms delay = 880ms;
  // close = saracinesca 700ms + items 700ms (no delay) = 700ms.
  const OPEN_MS = 900;
  const CLOSE_MS = 700;
  let animTimer = 0;

  const openMenu = () => {
    window.clearTimeout(animTimer);
    body.dataset.menu = "open";
    toggle.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-label", "Close menu");

    body.classList.add("is-menu-animating");
    animTimer = window.setTimeout(() => {
      body.classList.remove("is-menu-animating");
    }, OPEN_MS);
  };

  const closeMenu = () => {
    window.clearTimeout(animTimer);
    body.dataset.menu = "closing";
    toggle.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-label", "Open menu");

    body.classList.add("is-menu-animating");
    animTimer = window.setTimeout(() => {
      // Settle: items snap back below (transition:none in CSS)
      body.dataset.menu = "closed";
      body.classList.remove("is-menu-animating");
    }, CLOSE_MS);
  };

  toggle.addEventListener("click", () => {
    if (body.dataset.menu === "open") closeMenu();
    else openMenu();
  });

  if (menuLabel) {
    menuLabel.addEventListener("click", () => {
      if (body.dataset.menu === "open") closeMenu();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.dataset.menu === "open") {
      closeMenu();
      toggle.focus();
    }
  });

  menu.addEventListener("click", (e) => {
    const link = e.target.closest("[data-menu-link]");
    if (!link) return;

    // Non-navigation protocols (mailto:, tel:, sms:) hand off to the OS
    // instead of moving the user to a new page. Closing the menu under
    // them creates a confusing flicker — and on iOS the system sheet
    // returning focus can leave the menu in a half-closed state. Keep
    // the menu open so the user lands back exactly where they left.
    const href = link.getAttribute("href") || "";
    if (/^(mailto:|tel:|sms:)/i.test(href)) return;

    closeMenu();
  });
}

// -------- Work-page slideshow --------
// Auto-advancing carousel. CSS drives the visual transform via
// `--slide-index` on the track; JS only manages state + timers.
const slideshow = document.querySelector("[data-slideshow]");
if (slideshow) {
  const track = slideshow.querySelector("[data-slideshow-track]");
  const slides = track ? track.querySelectorAll(".slide") : [];
  const prevBtn = slideshow.querySelector("[data-slideshow-prev]");
  const nextBtn = slideshow.querySelector("[data-slideshow-next]");
  const currentEl = slideshow.querySelector("[data-slideshow-current]");
  const totalEl = slideshow.querySelector("[data-slideshow-total]");

  if (track && slides.length > 0) {
    const total = slides.length;
    const AUTO_MS = 5000;
    let current = 0;
    let autoTimer = 0;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (totalEl) totalEl.textContent = String(total);

    const applyCurrent = () => {
      track.style.setProperty("--slide-index", String(current));
      if (currentEl) currentEl.textContent = String(current + 1);
      slides.forEach((slide, i) => {
        // Mark inactive slides as inert-ish for screen readers & keyboard.
        slide.toggleAttribute("aria-hidden", i !== current);
      });
    };

    const goTo = (index) => {
      // Wrap around at both ends.
      current = ((index % total) + total) % total;
      applyCurrent();
    };

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    const startAuto = () => {
      if (reducedMotion) return;
      stopAuto();
      autoTimer = window.setInterval(next, AUTO_MS);
    };

    function stopAuto() {
      if (autoTimer) {
        window.clearInterval(autoTimer);
        autoTimer = 0;
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        prev();
        // Any manual interaction resets the auto-advance clock so the
        // next transition doesn't feel abrupt right after a click.
        startAuto();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        next();
        startAuto();
      });
    }

    // Pause on hover so viewers can read a slide they stopped on.
    slideshow.addEventListener("pointerenter", stopAuto);
    slideshow.addEventListener("pointerleave", startAuto);

    // Pause when the tab is hidden to avoid burning cycles (and so the
    // carousel isn't 12 slides ahead when they return).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    // Keyboard nav when focus is on a control inside the slideshow.
    slideshow.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        prev();
        startAuto();
      } else if (e.key === "ArrowRight") {
        next();
        startAuto();
      }
    });

    applyCurrent();
    startAuto();
  }
}
