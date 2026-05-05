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

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------
// The inline <head> bootstrap has already set `data-theme` (if saved) and
// `data-effective-theme` (always) on <html>. Here we wire the menu toggle
// button to flip the theme on click, persist it, and keep the effective-
// theme attribute in sync so the dot position + label stay correct.
// Also listens to system preference changes: if the user hasn't explicitly
// picked a theme (no data-theme), follow the OS in real time.
(function () {
  const root = document.documentElement;
  const sysMq =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

  const currentEffectiveTheme = () => {
    const explicit = root.getAttribute("data-theme");
    if (explicit === "light" || explicit === "dark") return explicit;
    return sysMq && sysMq.matches ? "dark" : "light";
  };

  const updateToggleUi = (theme) => {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      const label = btn.querySelector(".menu-theme-label");
      if (label) {
        label.textContent = theme === "dark" ? "Dark mode" : "Light mode";
      }
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  };

  // Init — ensure UI matches whatever theme the bootstrap applied.
  const initTheme = currentEffectiveTheme();
  if (!root.getAttribute("data-effective-theme")) {
    root.setAttribute("data-effective-theme", initTheme);
  }
  updateToggleUi(initTheme);

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = currentEffectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      root.setAttribute("data-effective-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* storage may be disabled (private mode, etc.) — noop */
      }
      updateToggleUi(next);
    });
  });

  // If the user hasn't explicitly picked a theme, follow the system
  // preference as it changes (dark/light toggle in OS settings).
  if (sysMq) {
    const onChange = () => {
      if (root.getAttribute("data-theme")) return; // user override wins
      const effective = sysMq.matches ? "dark" : "light";
      root.setAttribute("data-effective-theme", effective);
      updateToggleUi(effective);
    };
    if (sysMq.addEventListener) sysMq.addEventListener("change", onChange);
    else if (sysMq.addListener) sysMq.addListener(onChange);
  }
})();

// Respect prefers-reduced-motion: pause any autoplaying videos so the
// poster frame stays on screen instead of looping motion.
const prefersReducedMotion =
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  document.querySelectorAll("video[autoplay]").forEach((video) => {
    video.autoplay = false;
    video.removeAttribute("autoplay");
    // Some browsers start playback before JS runs; force-pause and
    // rewind so the poster image is presented.
    try {
      video.pause();
      video.currentTime = 0;
    } catch (e) {
      /* noop */
    }
  });
}

// Playback controls + scroll-driven auto-play for .case-video sections.
// Each .case-video-frame holds a [data-video] element plus two toggle
// buttons (play/pause, sound). The video auto-plays muted when it
// enters the viewport and pauses when it leaves — until the user takes
// explicit control, at which point the observer steps back and
// respects the user's last action.
document.querySelectorAll(".case-video-frame").forEach((frame) => {
  const video = frame.querySelector("[data-video]");
  if (!video) return;

  // Tracks whether the user deliberately paused the video with the
  // play/pause button. Once true, the IntersectionObserver stops
  // auto-resuming playback when the video re-enters the viewport (but
  // still pauses on leaving, to save battery and stop audio bleed).
  // Unmuting or clicking play clears it.
  let userPausedIntentionally = false;

  // --- Play / Pause toggle -------------------------------------------------
  const playBtn = frame.querySelector("[data-playpause-toggle]");
  if (playBtn) {
    const setPlayState = (playing) => {
      playBtn.setAttribute("data-state", playing ? "playing" : "paused");
      playBtn.setAttribute(
        "aria-label",
        playing ? "Pause video" : "Play video"
      );
      playBtn.setAttribute("title", playing ? "Pause" : "Play");
    };

    setPlayState(!video.paused);

    playBtn.addEventListener("click", () => {
      if (video.paused) {
        // Play clears the intentional-pause flag so the observer can
        // auto-resume next time the video re-enters the viewport.
        userPausedIntentionally = false;
        // If the video has reached the end (no loop), rewind first so
        // clicking play replays from the beginning rather than no-op.
        if (video.ended) {
          video.currentTime = 0;
        }
        video.play().catch(() => {
          /* autoplay may still block — nothing useful to do */
        });
      } else {
        userPausedIntentionally = true;
        video.pause();
      }
    });

    // Sync if video playback state changes from outside (reduced-motion
    // init, browser autoplay rejection, media keys, reaching end,
    // IntersectionObserver auto-play).
    video.addEventListener("play", () => setPlayState(true));
    video.addEventListener("pause", () => setPlayState(false));
    video.addEventListener("ended", () => setPlayState(false));
  }

  // --- Sound toggle --------------------------------------------------------
  const soundBtn = frame.querySelector("[data-sound-toggle]");
  if (soundBtn) {
    const setSoundState = (unmuted) => {
      video.muted = !unmuted;
      soundBtn.setAttribute("aria-pressed", unmuted ? "true" : "false");
      soundBtn.setAttribute(
        "aria-label",
        unmuted ? "Mute video" : "Unmute video"
      );
      soundBtn.setAttribute("title", unmuted ? "Mute" : "Unmute");
    };

    setSoundState(!video.muted);

    soundBtn.addEventListener("click", () => {
      const nextUnmuted = video.muted;
      setSoundState(nextUnmuted);
      // If the video is paused when the user unmutes, resume — a click
      // is a valid user gesture to play with sound, and implies the
      // user wants to watch (so clear any previous pause intent).
      if (nextUnmuted && video.paused) {
        userPausedIntentionally = false;
        video.play().catch(() => {
          /* noop */
        });
      }
    });

    // Sync if something else toggles video.muted (programmatic,
    // keyboard media keys).
    video.addEventListener("volumechange", () => {
      const unmuted = !video.muted;
      if (soundBtn.getAttribute("aria-pressed") !== String(unmuted)) {
        setSoundState(unmuted);
      }
    });
  }

  // --- Fullscreen toggle ---------------------------------------------------
  // Prefer Element.requestFullscreen on the frame so our custom
  // controls stay visible on top. Fallback to video.webkitEnterFullscreen
  // on iOS Safari (the only browser that doesn't support the standard
  // API on arbitrary elements — iOS shows its native video player
  // chrome in fullscreen, which is an acceptable trade-off).
  const fullscreenBtn = frame.querySelector("[data-fullscreen-toggle]");
  if (fullscreenBtn) {
    const canRequestOnFrame =
      typeof frame.requestFullscreen === "function" ||
      typeof frame.webkitRequestFullscreen === "function";
    const canRequestOnVideo =
      typeof video.webkitEnterFullscreen === "function";

    if (!canRequestOnFrame && !canRequestOnVideo) {
      // No fullscreen support at all — hide the button rather than
      // leaving a dead control on screen.
      fullscreenBtn.hidden = true;
    } else {
      const setFullscreenState = (isFullscreen) => {
        fullscreenBtn.setAttribute(
          "data-state",
          isFullscreen ? "fullscreen" : "normal"
        );
        fullscreenBtn.setAttribute(
          "aria-pressed",
          isFullscreen ? "true" : "false"
        );
        fullscreenBtn.setAttribute(
          "aria-label",
          isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
        );
        fullscreenBtn.setAttribute(
          "title",
          isFullscreen ? "Exit fullscreen" : "Fullscreen"
        );
      };

      const isInFullscreen = () =>
        document.fullscreenElement === frame ||
        document.webkitFullscreenElement === frame;

      // Best-effort screen-orientation lock/unlock. Works on Android
      // Chrome (locks landscape for a landscape video); iOS Safari
      // handles rotation natively via webkitEnterFullscreen, and
      // desktop browsers reject the lock silently. All branches are
      // wrapped in try/catch because the API throws synchronously
      // when called outside an activation or without fullscreen.
      const lockLandscape = () => {
        try {
          if (
            screen.orientation &&
            typeof screen.orientation.lock === "function"
          ) {
            const r = screen.orientation.lock("landscape");
            if (r && typeof r.catch === "function") {
              r.catch(() => {
                /* unsupported on this platform — ignore */
              });
            }
          }
        } catch (e) {
          /* noop */
        }
      };

      const unlockOrientation = () => {
        try {
          if (
            screen.orientation &&
            typeof screen.orientation.unlock === "function"
          ) {
            screen.orientation.unlock();
          }
        } catch (e) {
          /* noop */
        }
      };

      fullscreenBtn.addEventListener("click", () => {
        if (isInFullscreen()) {
          unlockOrientation();
          if (typeof document.exitFullscreen === "function") {
            document.exitFullscreen();
          } else if (typeof document.webkitExitFullscreen === "function") {
            document.webkitExitFullscreen();
          }
        } else if (canRequestOnFrame) {
          const req =
            frame.requestFullscreen || frame.webkitRequestFullscreen;
          try {
            const result = req.call(frame);
            if (result && typeof result.then === "function") {
              // Modern promise-returning API — lock orientation after
              // the browser has committed to the fullscreen state.
              result.then(lockLandscape).catch(() => {
                /* user dismissed or policy blocked */
              });
            } else {
              // Legacy sync API (older WebKit): try the lock right
              // after calling, accepting that it may fail if the
              // fullscreen transition hasn't completed yet.
              lockLandscape();
            }
          } catch (e) {
            /* noop */
          }
        } else if (canRequestOnVideo) {
          // iOS Safari path — fullscreen the video directly. Native
          // player chrome appears and iOS rotates automatically if
          // the video is landscape, so we don't need the orientation
          // lock branch here. Our overlay is not visible in that
          // mode, which matches iOS user expectations.
          try {
            video.webkitEnterFullscreen();
          } catch (e) {
            /* noop */
          }
        }
      });

      // Sync icon + aria when the user exits via ESC or browser UI.
      // Also release any orientation lock on exit so the device goes
      // back to the user's orientation preference.
      const onFullscreenChange = () => {
        const fs = isInFullscreen();
        setFullscreenState(fs);
        if (!fs) unlockOrientation();
      };
      document.addEventListener("fullscreenchange", onFullscreenChange);
      document.addEventListener(
        "webkitfullscreenchange",
        onFullscreenChange
      );
    }
  }

  // --- Progress bar + scrubber --------------------------------------------
  // Drive the .case-video-progress-fill's scaleX from currentTime via
  // requestAnimationFrame while the video is playing. Using RAF (not
  // the timeupdate event) gives frame-accurate smoothness; timeupdate
  // only fires ~4 times/second which would look chunky.
  const progressFill = frame.querySelector("[data-progress]");
  const progressTrack = frame.querySelector("[data-progress-track]");
  if (progressFill) {
    let rafId = 0;

    const renderProgress = (ratio) => {
      const d = video.duration;
      if (typeof ratio === "number") {
        progressFill.style.transform = `scaleX(${ratio})`;
      } else if (d && Number.isFinite(d) && d > 0) {
        const p = Math.min(1, Math.max(0, video.currentTime / d));
        progressFill.style.transform = `scaleX(${p})`;
      }
    };

    const tick = () => {
      renderProgress();
      rafId = requestAnimationFrame(tick);
    };

    video.addEventListener("play", () => {
      if (!rafId) rafId = requestAnimationFrame(tick);
    });
    const stopTicking = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      // One final sync so the bar lands on the exact paused position.
      renderProgress();
    };
    video.addEventListener("pause", stopTicking);
    video.addEventListener("ended", stopTicking);
    // Handle seeking (scrub, keyboard media keys) and initial
    // metadata load so the bar is right on first paint.
    video.addEventListener("seeked", () => renderProgress());
    video.addEventListener("loadedmetadata", () => renderProgress());

    // ----- Scrubber interaction ------------------------------------------
    if (progressTrack) {
      const clampRatio = (n) => Math.min(1, Math.max(0, n));

      const ratioFromPointer = (clientX) => {
        const rect = progressTrack.getBoundingClientRect();
        return clampRatio((clientX - rect.left) / rect.width);
      };

      const seekToRatio = (ratio) => {
        const d = video.duration;
        if (!d || !Number.isFinite(d)) return;
        video.currentTime = ratio * d;
        // Paint immediately for snap-responsive drag; RAF/seeked will
        // reconcile on the next frame.
        renderProgress(ratio);
        updateAria();
      };

      progressTrack.addEventListener("pointerdown", (event) => {
        progressTrack.setAttribute("data-dragging", "true");
        try {
          progressTrack.setPointerCapture(event.pointerId);
        } catch (e) {
          /* noop */
        }
        seekToRatio(ratioFromPointer(event.clientX));
        event.preventDefault();
      });

      progressTrack.addEventListener("pointermove", (event) => {
        if (progressTrack.getAttribute("data-dragging") !== "true") return;
        seekToRatio(ratioFromPointer(event.clientX));
      });

      const endDrag = (event) => {
        if (progressTrack.getAttribute("data-dragging") !== "true") return;
        progressTrack.removeAttribute("data-dragging");
        try {
          progressTrack.releasePointerCapture(event.pointerId);
        } catch (e) {
          /* noop */
        }
      };
      progressTrack.addEventListener("pointerup", endDrag);
      progressTrack.addEventListener("pointercancel", endDrag);

      // Keyboard: ← / → step 5s, PageUp/Down step 10s, Home/End jump
      // to start/end. Standard WAI-ARIA slider bindings.
      progressTrack.addEventListener("keydown", (event) => {
        const d = video.duration;
        if (!d || !Number.isFinite(d)) return;
        const step = 5;
        const bigStep = 10;
        let next = video.currentTime;
        let handled = true;
        switch (event.key) {
          case "ArrowRight":
            next = Math.min(d, video.currentTime + step);
            break;
          case "ArrowLeft":
            next = Math.max(0, video.currentTime - step);
            break;
          case "PageUp":
            next = Math.min(d, video.currentTime + bigStep);
            break;
          case "PageDown":
            next = Math.max(0, video.currentTime - bigStep);
            break;
          case "Home":
            next = 0;
            break;
          case "End":
            next = d;
            break;
          default:
            handled = false;
        }
        if (handled) {
          event.preventDefault();
          seekToRatio(next / d);
        }
      });

      // Keep ARIA valuenow/valuetext in sync as the bar advances so
      // screen readers announce the current position meaningfully.
      const formatTime = (secs) => {
        if (!Number.isFinite(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60)
          .toString()
          .padStart(2, "0");
        return `${m}:${s}`;
      };

      const updateAria = () => {
        const d = video.duration;
        if (!d || !Number.isFinite(d)) return;
        const pct = Math.round((video.currentTime / d) * 100);
        progressTrack.setAttribute("aria-valuenow", String(pct));
        progressTrack.setAttribute(
          "aria-valuetext",
          `${formatTime(video.currentTime)} of ${formatTime(d)}`
        );
      };
      video.addEventListener("timeupdate", updateAria);
      video.addEventListener("loadedmetadata", updateAria);
    }
  }

  // --- Scroll-driven auto-play + soft-loop on end -------------------------
  // Play muted when the video is at least 40% visible; pause when it
  // leaves the viewport entirely. Skip auto-play on reduced-motion.
  // When the video ends (in view, not user-paused), immediately fade
  // out → rewind invisibly → play + fade back in. Any user action
  // cancels the in-flight fade and restores opacity right away.
  let isInView = false;
  let fadeTimer = 0;
  const FADE_MS = 500;

  const cancelRestart = () => {
    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = 0;
    }
    // Reset opacity immediately — if the user interacts mid-fade we
    // don't want the video stuck invisible.
    video.classList.remove("is-restarting");
  };

  const scheduleRestart = () => {
    cancelRestart();
    if (prefersReducedMotion || userPausedIntentionally || !isInView) return;
    // Fade out, then rewind + play (the video element's opacity
    // transition makes the rewind invisible), then fade back in as
    // the video starts playing again.
    video.classList.add("is-restarting");
    fadeTimer = setTimeout(() => {
      fadeTimer = 0;
      // Re-check at the end of the fade — the user may have paused,
      // scrolled away, or reduced-motion may have been applied.
      if (
        userPausedIntentionally ||
        !isInView ||
        prefersReducedMotion ||
        !video.ended
      ) {
        video.classList.remove("is-restarting");
        return;
      }
      video.currentTime = 0;
      const playPromise = video.play();
      const fadeIn = () => video.classList.remove("is-restarting");
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(fadeIn).catch(fadeIn);
      } else {
        fadeIn();
      }
    }, FADE_MS);
  };

  video.addEventListener("ended", scheduleRestart);
  // Any active user action cancels a pending restart so we don't
  // resurrect the video after the user intentionally walked away.
  video.addEventListener("play", cancelRestart);
  video.addEventListener("pause", cancelRestart);

  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isInView = entry.isIntersecting;
          if (isInView) {
            // Auto-resume only if the user didn't deliberately pause.
            // Respect ended state too — once the video finishes, we
            // wait for the soft-loop timer (or an explicit click).
            if (!userPausedIntentionally && video.paused && !video.ended) {
              video.play().catch(() => {
                /* autoplay can still be blocked — stay silent */
              });
            }
          } else {
            // Always pause when out of view to save CPU/battery and
            // to stop audio bleeding into other sections if unmuted.
            // Also cancel any pending soft-loop restart so it doesn't
            // fire after the user scrolled away.
            cancelRestart();
            if (!video.paused) {
              video.pause();
            }
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(frame);
  }
});

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
    // On leave (mouse/pen only), advance one step right away so the
    // carousel visibly resumes instead of sitting on the same slide.
    // On touch the swipe handler (pointerup) owns the
    // pause-resume-maybe-advance flow — letting pointerleave also
    // advance here produced a double-step per finger gesture
    // (1 → 2 via swipe, then → 3 via the leave advance).
    const hoverEl = slideshow.querySelector(".slideshow-viewport") || slideshow;
    hoverEl.addEventListener("pointerenter", stopAuto);
    hoverEl.addEventListener("pointerleave", (e) => {
      // Touch: swipe handler (pointerup) owns pause/resume.
      if (e.pointerType === "touch") return;
      // Restart the auto-advance clock. We no longer advance one step
      // on leave — that made the slide appear to change the moment the
      // cursor moved past the viewport, which felt like the carousel
      // never really paused even if it had.
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

