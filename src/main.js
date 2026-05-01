const body = document.body;
const toggle = document.querySelector(".menu-toggle");
const menuLabel = document.querySelector(".menu-label");
const menu = document.querySelector(".site-menu");

// Flag touch-capable devices on <html>. Belt-and-braces with the
// `@media (hover: none), (pointer: coarse)` CSS: some browsers report
// conflicting hover/pointer values (e.g. tablets with stylus input),
// so we OR three signals. CSS uses `.is-touch` to keep the "Back"
// label permanently visible while the menu is open on touch.
if (
  "ontouchstart" in window ||
  (window.matchMedia && window.matchMedia("(hover: none)").matches) ||
  (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
) {
  document.documentElement.classList.add("is-touch");
}

if (toggle && menu) {
  // Match CSS: open = saracinesca 700ms + items 700ms with 180ms delay = 880ms;
  // close = saracinesca 700ms + items 700ms (no delay) = 700ms.
  const OPEN_MS = 900;
  const CLOSE_MS = 700;
  let animTimer = 0;

  // On touch devices the `:hover` pseudo-class flashes for a frame on
  // tap and then clears. Even with `@media (hover: none)` + `.is-touch`
  // class fallbacks, some browsers still let the :hover rule win
  // briefly (and a stale prod CSS cache can defeat media queries
  // entirely). Writing to inline `style` beats any external rule on
  // specificity, so the "Back" label stays painted for the whole
  // time the menu is open on touch, regardless of :hover behavior.
  const toggleText = toggle.querySelector(".menu-toggle-text");
  const isTouch = document.documentElement.classList.contains("is-touch");

  const showBackOnTouch = () => {
    if (!isTouch || !toggleText) return;
    toggleText.style.opacity = "1";
    toggleText.style.transform = "translate(0, -50%)";
  };

  const hideBackOnTouch = () => {
    if (!isTouch || !toggleText) return;
    toggleText.style.opacity = "";
    toggleText.style.transform = "";
  };

  const openMenu = () => {
    window.clearTimeout(animTimer);
    body.dataset.menu = "open";
    toggle.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-label", "Close menu");
    showBackOnTouch();

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
    hideBackOnTouch();

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

    // Let the browser handle modifier-clicks (open in new tab/window/download)
    // and explicit `target="_blank"` links (e.g. LinkedIn) without
    // swallowing the navigation — just start the close animation so
    // when the user returns to this tab the menu is already gone.
    const opensInNewContext =
      link.target === "_blank" ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey;
    if (opensInNewContext) {
      closeMenu();
      return;
    }

    // Internal navigation: mark this as a menu-driven transition so the
    // TARGET page can boot up with the menu already "open" and immediately
    // play the close animation over its freshly-loaded content. That way
    // the user sees the new page appear *under* the retracting menu —
    // not the source page holding for 700ms and then teleporting.
    // The click proceeds normally; no preventDefault, no delay.
    try {
      sessionStorage.setItem("menu-transition-nav", String(Date.now()));
    } catch (_) {
      // If storage is blocked (private mode, quotas), just let the
      // browser navigate without the on-arrival animation.
    }
  });
}

// -------- Work-page slideshow --------
// Auto-advancing carousel. CSS drives the visual transform via
// `--slide-index` on the track; JS only manages state + timers.
const slideshow = document.querySelector("[data-slideshow]");
if (slideshow) {
  const track = slideshow.querySelector("[data-slideshow-track]");
  const slides = track ? track.querySelectorAll(".slide") : [];
  const currentEl = slideshow.querySelector("[data-slideshow-current]");
  const totalEl = slideshow.querySelector("[data-slideshow-total]");
  // INK pattern: a single text label next to the counter shows the
  // ACTIVE slide's title. Auto-updates every time we advance.
  const currentTitleEl = slideshow.querySelector(
    "[data-slideshow-current-title]"
  );

  if (track && slides.length > 0) {
    const total = slides.length;
    const AUTO_MS = 3500;
    let autoTimer = 0;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (totalEl) totalEl.textContent = String(total);

    // --- Infinite loop via clones ---
    // Duplicate the first slide at the end and the last slide at the
    // start. The track then has `total + 2` items. Normal navigation
    // uses track positions 1..total (real slides). When next() crosses
    // the last clone (position total+1, visually = slide 0) or prev()
    // crosses the first clone (position 0, visually = last slide), we
    // let the slide animation play, then on transitionend instantly
    // snap (transition: none) to the matching real slide. The jump is
    // invisible because the two frames land on the exact same image.
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[total - 1].cloneNode(true);
    firstClone.setAttribute("aria-hidden", "true");
    lastClone.setAttribute("aria-hidden", "true");
    firstClone.dataset.slideClone = "first";
    lastClone.dataset.slideClone = "last";
    track.insertBefore(lastClone, slides[0]);
    track.appendChild(firstClone);

    const slideCount = total + 2;
    track.style.setProperty("--slide-count", String(slideCount));

    // Track position runs 0..total+1 in the EXTENDED track.
    // Position 0 = lastClone, positions 1..total = real slides (in order),
    // position total+1 = firstClone. Start at the first real slide.
    let trackPos = 1;

    // User-facing index (0..total-1) mapped from trackPos.
    const userIndexFromTrackPos = (pos) => {
      if (pos === 0) return total - 1; // lastClone visually = last real
      if (pos === total + 1) return 0; // firstClone visually = first real
      return pos - 1;
    };

    const applyCurrent = () => {
      track.style.setProperty("--track-position", String(trackPos));
      const userIndex = userIndexFromTrackPos(trackPos);
      if (currentEl) currentEl.textContent = String(userIndex + 1);
      if (currentTitleEl) {
        const title = slides[userIndex].dataset.slideTitle || "";
        currentTitleEl.textContent = title;
      }
      slides.forEach((slide, i) => {
        slide.toggleAttribute("aria-hidden", i !== userIndex);
      });
    };

    // Jump trackPos to a new position with NO transition. Used at the
    // clone-wrap boundary so the carousel returns to the matching real
    // slide without a visible animation jolt.
    const snapTo = (pos) => {
      track.style.transition = "none";
      trackPos = pos;
      applyCurrent();
      // Force reflow so the transition disable is committed BEFORE we
      // re-enable it — otherwise the next interpolation starts from
      // the stale pre-snap position.
      void track.offsetHeight;
      track.style.transition = "";
    };

    // When next() or prev() are called while we're already parked on a
    // clone (e.g. after a previous navigation left us at trackPos =
    // total+1 or 0), snap back to the matching real slide FIRST, then
    // proceed with the increment. This keeps trackPos bounded and
    // avoids the counter drifting past `total` — rapid nav no longer
    // depends on `transitionend` firing for correctness.
    const next = () => {
      if (trackPos === total + 1) snapTo(1);
      trackPos += 1;
      applyCurrent();
    };
    const prev = () => {
      if (trackPos === 0) snapTo(total);
      trackPos -= 1;
      applyCurrent();
    };

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

    // Pause on hover so viewers can read a slide they stopped on.
    // On leave, advance one step RIGHT AWAY (in addition to restarting
    // the interval) so the carousel visibly "resumes" instead of
    // sitting on the same slide for another full cycle. Listeners go
    // on the VIEWPORT (the slide area) rather than on the outer
    // .work-slideshow section, so the surrounding padding doesn't
    // count as a hover.
    const hoverEl = slideshow.querySelector(".slideshow-viewport") || slideshow;
    hoverEl.addEventListener("pointerenter", stopAuto);
    hoverEl.addEventListener("pointerleave", () => {
      next();
      startAuto();
    });

    // --- Custom cursor (desktop only) ---
    // Three zones inside the viewport, driven by the pointer's X
    // position (left 25% → prev arrow, right 25% → next arrow, middle
    // 50% → "View project"). Cursor chip follows the pointer, content
    // swaps with the zone. Clicks in the side zones call prev/next and
    // preempt the slide-link navigation; clicks in the middle zone let
    // the link fire normally (future case-study page).
    const cursorEl = slideshow.querySelector("[data-slideshow-cursor]");
    const viewportEl = slideshow.querySelector(".slideshow-viewport");
    const hasFinePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
    if (cursorEl && viewportEl && hasFinePointer) {
      const LEFT_ZONE_END = 0.25;
      const RIGHT_ZONE_START = 0.75;

      const zoneFor = (clientX) => {
        const rect = viewportEl.getBoundingClientRect();
        const relX = (clientX - rect.left) / rect.width;
        if (relX < LEFT_ZONE_END) return "prev";
        if (relX > RIGHT_ZONE_START) return "next";
        return "view";
      };

      const labelFor = (zone) => {
        if (zone === "prev") return "←";
        if (zone === "next") return "→";
        return "View project";
      };

      const setPos = (x, y) => {
        cursorEl.style.setProperty("--cursor-x", x + "px");
        cursorEl.style.setProperty("--cursor-y", y + "px");
      };

      const setZone = (zone) => {
        cursorEl.dataset.zone = zone;
        cursorEl.textContent = labelFor(zone);
      };

      viewportEl.addEventListener("pointerenter", (e) => {
        setPos(e.clientX, e.clientY);
        setZone(zoneFor(e.clientX));
        cursorEl.classList.add("is-active");
      });
      viewportEl.addEventListener("pointerleave", () => {
        cursorEl.classList.remove("is-active");
      });
      viewportEl.addEventListener("pointermove", (e) => {
        setPos(e.clientX, e.clientY);
        setZone(zoneFor(e.clientX));
      });

      // Intercept clicks in the side zones for prev/next. Middle-zone
      // clicks fall through to the slide-link so future case-study
      // pages load naturally.
      viewportEl.addEventListener("click", (e) => {
        const zone = zoneFor(e.clientX);
        if (zone === "view") return;
        e.preventDefault();
        if (zone === "prev") prev();
        else next();
        startAuto();
      });
    }

    // --- Touch swipe (mobile) ---
    // Pointer Events unify mouse/touch/pen. We only act when the gesture
    // is clearly HORIZONTAL (deltaX exceeds threshold AND is greater
    // than deltaY) so the user can still scroll the page vertically
    // by dragging within the slideshow area.
    const SWIPE_THRESHOLD = 50;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeTracking = false;

    const viewport =
      slideshow.querySelector(".slideshow-viewport") || slideshow;

    viewport.addEventListener("pointerdown", (e) => {
      // Ignore non-primary pointers (e.g. right click, second finger).
      if (!e.isPrimary) return;
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
      swipeTracking = true;
      stopAuto();
    });

    const endSwipe = (e) => {
      if (!swipeTracking) return;
      swipeTracking = false;
      const dx = e.clientX - swipeStartX;
      const dy = e.clientY - swipeStartY;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next();
        else prev();
      }
      startAuto();
    };

    viewport.addEventListener("pointerup", endSwipe);
    viewport.addEventListener("pointercancel", () => {
      swipeTracking = false;
      startAuto();
    });

    // Pause when the tab is hidden to avoid burning cycles (and so the
    // carousel isn't 12 slides ahead when they return).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    // Keyboard nav when focus is on a control inside the slideshow.
    // The UI has no visible arrows (INK pattern), but ← / → still work
    // for accessibility when the slideshow itself has focus.
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

