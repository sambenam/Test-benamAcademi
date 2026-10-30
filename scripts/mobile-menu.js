(function () {
  if (window.__benamacademyMobileMenuInitialized) {
    return;
  }
  window.__benamacademyMobileMenuInitialized = true;

  const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
  const mobileCloseBtn = document.querySelector(".mobile-close");
  const mobileMenu = document.querySelector(".mobile-menu");
  const mobileOverlay = document.querySelector(".mobile-overlay");
  const mobileSearchBtn = document.querySelector(".mobile-search-btn");
  const mobileSearchBox = document.querySelector(".mobile-search-box");
  const mobileSearchInput = document.querySelector(".mobile-search-box input");

  function closeMobileMenu() {
    mobileMenu?.classList.remove("active");
    mobileOverlay?.classList.remove("active");
    document.body.style.overflow = "";
    document.body.classList.remove("mobile-menu-open");
  }

  mobileMenuBtn?.addEventListener("click", () => {
    mobileMenu?.classList.add("active");
    mobileOverlay?.classList.add("active");
    document.body.style.overflow = "hidden";
    document.body.classList.add("mobile-menu-open");
  });

  mobileCloseBtn?.addEventListener("click", closeMobileMenu);
  mobileOverlay?.addEventListener("click", closeMobileMenu);

  mobileSearchBtn?.addEventListener("click", () => {
    mobileSearchBox?.classList.toggle("active");
    if (mobileSearchBox?.classList.contains("active")) {
      mobileSearchInput?.focus();
    }
  });

  mobileSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && mobileSearchInput.value.trim()) {
      window.location.href =
        "list-page.html?query=" +
        encodeURIComponent(mobileSearchInput.value.trim());
    }
  });

  document.querySelectorAll(".mobile-dropdown").forEach((dropdown) => {
    const button = dropdown.querySelector(".mobile-dropdown-btn");
    button?.addEventListener("click", () => {
      const isActive = dropdown.classList.contains("active");
      document.querySelectorAll(".mobile-dropdown").forEach((item) => {
        if (item !== dropdown) item.classList.remove("active");
      });
      dropdown.classList.toggle("active", !isActive);
    });
  });

  document.querySelectorAll(".mobile-sub-dropdown").forEach((dropdown) => {
    const button = dropdown.querySelector(".mobile-sub-btn");
    button?.addEventListener("click", (event) => {
      event.stopPropagation();
      const parent = dropdown.closest(".mobile-dropdown-menu");
      const isActive = dropdown.classList.contains("active");
      parent?.querySelectorAll(".mobile-sub-dropdown").forEach((item) => {
        if (item !== dropdown) item.classList.remove("active");
      });
      dropdown.classList.toggle("active", !isActive);
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMobileMenu();
  });

  /* ======================================================================
     LIVE SITE SEARCH (shared by the mobile menu and the desktop header)
     ----------------------------------------------------------------------
     Partial-matches every site item as the visitor types. Persian/Arabic
     letter variants and the ZWNJ are normalised, so a fragment typed on any
     keyboard still matches. Results are rendered into whichever results box
     the caller passes — the mobile panel or the desktop dropdown.
     ====================================================================== */
  function normalizeText(s) {
    return String(s == null ? "" : s)
      .replace(/\u200c/g, "")
      .replace(/\u064a/g, "\u06cc") // ي -> ی
      .replace(/\u0643/g, "\u06a9") // ك -> ک
      .replace(/[\u0622\u0623\u0625]/g, "\u0627") // آ أ إ -> ا
      .replace(/\u0629/g, "\u0647") // ة -> ه
      .toLowerCase();
  }

  function escapeText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let searchIndex = null;
  function buildSearchIndex() {
    const index = [];
    if (typeof siteData === "undefined" || !siteData) return index;
    Object.keys(siteData).forEach(function (catKey) {
      const cat = siteData[catKey];
      if (!cat) return;
      const catTitle = cat.title || catKey;
      (cat.items || []).forEach(function (item) {
        if (!item || !item.id) return;
        index.push({
          id: item.id,
          title: item.title || item.id,
          category: catTitle,
          hay: normalizeText(
            (item.title || "") +
              " " +
              (item.excerpt || "") +
              " " +
              catTitle +
              " " +
              (item.id || ""),
          ),
        });
      });
    });
    return index;
  }

  function renderResults(box, query) {
    if (!box) return;
    const q = normalizeText(query.trim());
    if (!q) {
      box.innerHTML = "";
      box.classList.remove("active");
      return;
    }
    if (searchIndex === null) searchIndex = buildSearchIndex();
    const matches = searchIndex
      .filter((it) => it.hay.indexOf(q) !== -1)
      .slice(0, 8);
    if (!matches.length) {
      box.innerHTML = '<div class="site-search-empty">نتیجه‌ای پیدا نشد.</div>';
      box.classList.add("active");
      return;
    }
    box.innerHTML =
      matches
        .map(function (it) {
          return (
            '<a class="site-search-item" href="single-post.html?id=' +
            encodeURIComponent(it.id) +
            '">' +
            '<span class="site-search-item__title">' +
            escapeText(it.title) +
            "</span>" +
            '<span class="site-search-item__cat">' +
            escapeText(it.category) +
            "</span>" +
            "</a>"
          );
        })
        .join("") +
      '<a class="site-search-all" href="list-page.html?query=' +
      encodeURIComponent(query.trim()) +
      '">مشاهده‌ی همه‌ی نتایج</a>';
    box.classList.add("active");
  }

  function wireSearch(input, box, clearOn) {
    if (!input || !box) return;
    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => renderResults(box, input.value), 180);
    });
    if (clearOn) clearOn();
  }

  // --- Mobile menu search ---
  if (mobileSearchInput && mobileMenu) {
    const mobileResults = document.createElement("div");
    mobileResults.className = "mobile-search-results";
    mobileMenu.appendChild(mobileResults);
    wireSearch(mobileSearchInput, mobileResults, () => {
      // Clear the results when the menu closes, so a reopen starts clean.
      mobileCloseBtn?.addEventListener("click", () => {
        mobileResults.innerHTML = "";
        mobileResults.classList.remove("active");
      });
    });
  }

  // --- Desktop header search ---
  const deskInput = document.querySelector(
    ".top-header .search-box input, header .search-box input, .search-box input",
  );
  const deskWrap = deskInput ? deskInput.closest(".search-box") : null;
  if (deskInput && deskWrap) {
    const deskResults = document.createElement("div");
    deskResults.className = "header-search-results";
    deskWrap.appendChild(deskResults);
    wireSearch(deskInput, deskResults);
    // Click outside closes the desktop dropdown.
    document.addEventListener("click", (e) => {
      if (!deskWrap.contains(e.target)) deskResults.classList.remove("active");
    });
  }
})();
