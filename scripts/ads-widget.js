/**
 * Promotional widget — the public side of the "تبلیغات" feature.
 *
 * A small, elegant glass card that slides into the left side of the viewport
 * (about 10rem from the bottom) a moment after the page loads. It FLOATS over
 * the page (position: fixed), so it never touches the page's layout and cannot
 * break it.
 *
 * Two behaviours, both kept:
 *   - A coloured handle on the card's right edge slides it almost fully away
 *     (left/right chevron) and back. The choice is remembered for the session.
 *   - While open, the card is COMPACT by default (just the title); hovering it
 *     expands the full ad — image, the "متن تبلیغ" details and the CTA — and
 *     leaving it rolls back to compact.
 *
 * Which ads appear is decided by GET /ads (active ads only) and the page the
 * visitor is on. A manager edits the set from the admin "تبلیغات" tab.
 */
(function () {
  if (typeof appApi === "undefined" || !appApi.ads) return;

  function currentPage() {
    var file = (
      location.pathname.split("/").pop() || "index.html"
    ).toLowerCase();
    if (file === "" || file === "index.html") return "home";
    if (file.indexOf("list") !== -1) return "list";
    if (file.indexOf("single") !== -1 || file.indexOf("post") !== -1)
      return "single";
    return null;
  }

  var page = currentPage();
  if (!page) return;

  var COLLAPSED_KEY = "benamacademyAdCollapsed";
  function savedCollapsed() {
    try {
      return sessionStorage.getItem(COLLAPSED_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function matchesPage(ad) {
    var pages =
      Array.isArray(ad.pages) && ad.pages.length
        ? ad.pages
        : ["home", "list", "single"];
    return pages.indexOf(page) !== -1;
  }

  var widget = document.getElementById("adsWidget");
  if (!widget) {
    widget = document.createElement("div");
    widget.id = "adsWidget";
    widget.className = "ads-widget";
    widget.setAttribute("role", "complementary");
    widget.setAttribute("aria-label", "تبلیغ");
    widget.innerHTML =
      '<a class="ads-widget__content" target="_blank" rel="noopener noreferrer">' +
      '  <img class="ads-widget__img" alt="">' +
      '  <span class="ads-widget__body">' +
      '    <strong class="ads-widget__title"></strong>' +
      '    <span class="ads-widget__text"></span>' +
      '    <span class="ads-widget__cta"></span>' +
      "  </span>" +
      "</a>" +
      '<button type="button" class="ads-widget__handle" aria-label="باز و بسته کردن تبلیغ"><i class="fas fa-chevron-left"></i></button>';
    document.body.appendChild(widget);

    widget
      .querySelector(".ads-widget__handle")
      .addEventListener("click", function () {
        var collapse = !widget.classList.contains("is-collapsed");
        widget.classList.toggle("is-collapsed", collapse);
        try {
          sessionStorage.setItem(COLLAPSED_KEY, collapse ? "1" : "0");
        } catch (e) {}
      });
  }

  var content = widget.querySelector(".ads-widget__content");
  var img = widget.querySelector(".ads-widget__img");
  var titleEl = widget.querySelector(".ads-widget__title");
  var textEl = widget.querySelector(".ads-widget__text");
  var ctaEl = widget.querySelector(".ads-widget__cta");

  function render(ad) {
    content.href = ad.link || "#";
    if (ad.image) {
      img.src = ad.image;
      img.style.display = "";
    } else {
      img.style.display = "none";
    }
    titleEl.textContent = ad.title || "";
    titleEl.style.display = ad.title ? "" : "none";
    textEl.textContent = ad.text || "";
    textEl.style.display = ad.text ? "" : "none";
    ctaEl.textContent = ad.linkText || "مشاهده";
    ctaEl.style.display = ad.link ? "" : "none";
  }

  appApi.ads
    .list()
    .then(function (ads) {
      if (!Array.isArray(ads)) return;
      var pool = ads.filter(matchesPage);
      if (!pool.length) return;

      render(pool[0]);
      widget.classList.toggle("is-collapsed", savedCollapsed());

      var d = Number(pool[0].delay);
      var delay = (d > 0 ? d : 1.5) * 1000;
      window.setTimeout(function () {
        widget.classList.add("is-visible");
      }, delay);

      if (pool.length > 1) {
        var i = 0;
        window.setInterval(function () {
          if (widget.classList.contains("is-collapsed")) return;
          i = (i + 1) % pool.length;
          render(pool[i]);
        }, 6000);
      }
    })
    .catch(function () {
      /* No ads, or offline: render nothing. */
    });
})();
