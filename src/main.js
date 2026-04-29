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
