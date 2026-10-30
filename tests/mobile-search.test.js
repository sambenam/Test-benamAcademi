/**
 * Mobile menu search — the live, partial-match search.
 *
 * Run with:  node tests/mobile-search.test.js
 *
 * Loads the home page for real (over HTTP, scripts executing), opens the
 * mobile search box, types a query and asserts that matching site items
 * appear as the visitor types — including a partial fragment — and that
 * clearing the query hides the results.
 */
const { JSDOM, VirtualConsole } = require("jsdom");
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

let p = 0,
  f = 0;
const t = (n, c, d) => {
  c
    ? (p++, console.log("  ✓ " + n))
    : (f++, console.log("  ✗ " + n + (d ? " -> " + d : "")));
};

(async () => {
  const TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "text/plain",
      });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e.message.split("\n")[0]));

  let dom;
  try {
    dom = await JSDOM.fromURL("http://localhost:" + port + "/html/index.html", {
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      virtualConsole: vc,
    });
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    t("page loads", false, e.message);
    server.close();
    console.log("\n" + p + " تست موفق، " + f + " ناموفق");
    process.exit(1);
  }

  const w = dom.window;
  const d = w.document;
  const searchBtn = d.querySelector(".mobile-search-btn");
  const input = d.querySelector(".mobile-search-box input");

  t("صفحه بدون خطای جاوااسکریپت لود می‌شود", errors.length === 0, errors[0]);
  t("دکمه‌ی جستجو وجود دارد", !!searchBtn);
  t("فیلد جستجو وجود دارد", !!input);

  if (searchBtn)
    searchBtn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));

  function type(q) {
    input.value = q;
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
  }
  function itemCount() {
    const box = d.querySelector(".mobile-search-results");
    return box ? box.querySelectorAll(".site-search-item").length : 0;
  }

  type("حسابداری");
  await new Promise((r) => setTimeout(r, 300));
  t("جستجو نتایج می‌آورد", itemCount() > 0, itemCount() + " مورد");

  type("اکسل");
  await new Promise((r) => setTimeout(r, 300));
  t("تطبیقِ جزئی هم نتیجه می‌دهد", itemCount() > 0, itemCount() + " مورد");

  type("zzzzqqqx");
  await new Promise((r) => setTimeout(r, 300));
  const box = d.querySelector(".mobile-search-results");
  t(
    "بی‌نتیجه بودن پیام می‌دهد",
    !!box && box.querySelector(".site-search-empty"),
  );

  type("");
  await new Promise((r) => setTimeout(r, 300));
  const box2 = d.querySelector(".mobile-search-results");
  t(
    "خالی‌کردن جستجو نتایج را می‌بندد",
    box2 && !box2.classList.contains("active"),
  );

  // --- Desktop header search (same shared logic) ---
  const deskInput = d.querySelector(".search-box input");
  t("سرچِ دسکتاپ وجود دارد", !!deskInput);
  if (deskInput) {
    deskInput.value = "حسابداری";
    deskInput.dispatchEvent(new w.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const dbox = d.querySelector(".header-search-results");
    const dcount = dbox ? dbox.querySelectorAll(".site-search-item").length : 0;
    t("سرچِ دسکتاپ هم زنده نتیجه می‌آورد", dcount > 0, dcount + " مورد");
  }

  dom.window.close();
  server.close();
  console.log("\n" + p + " تست موفق، " + f + " ناموفق");
  process.exit(f ? 1 : 0);
})();
