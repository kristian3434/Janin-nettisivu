import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const startedAt = new Date();
const staticButtonSelector = 'button, a[data-track="button_click"], a.button';

const settings = {
  targetUrl: normalizeBaseUrl(
    process.env.BUTTON_CHECK_BASE_URL || process.env.SITE_BASE_URL || ""
  ),
  reportDir: path.resolve(
    projectRoot,
    process.env.REPORT_DIR || "reports/monthly-site-checks"
  ),
  timeoutMs: Number.parseInt(process.env.BUTTON_CHECK_TIMEOUT_MS || "10000", 10),
  browserChannel: String(process.env.BUTTON_CHECK_BROWSER_CHANNEL || "").trim(),
};

const results = [];
let localServer;
let testBaseUrl = settings.targetUrl;
let testedPageCount = 0;

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function reportResult(entry) {
  results.push({
    status: entry.status,
    page: entry.page || "",
    type: entry.type || "button",
    label: entry.label || "",
    target: entry.target || "",
    detail: entry.detail || "",
    recommendation: entry.recommendation || "",
  });
}

function pass(entry) {
  reportResult({ ...entry, status: "pass" });
}

function fail(entry) {
  reportResult({ ...entry, status: "fail" });
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testUrlForPage(pageName) {
  const relativePath = pageName === "index.html" ? "/" : `/${pageName}`;
  const url = new URL(relativePath, `${testBaseUrl}/`);
  url.searchParams.set("healthcheck", "1");
  return url.toString();
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".xml": "application/xml; charset=utf-8",
  };
  return types[extension] || "application/octet-stream";
}

function safeLocalPath(requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  } else if (pathname === "/ai") {
    pathname = "/ai.html";
  }

  const filePath = path.resolve(projectRoot, `.${pathname}`);
  const relativePath = path.relative(projectRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

async function serveFile(request, response) {
  const filePath = safeLocalPath(request.url || "/");

  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const range = request.headers.range;
    const commonHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": contentTypeFor(filePath),
    };

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);

      if (match) {
        const start = match[1] ? Number.parseInt(match[1], 10) : 0;
        const end = match[2]
          ? Math.min(Number.parseInt(match[2], 10), file.length - 1)
          : file.length - 1;

        if (start <= end && start < file.length) {
          response.writeHead(206, {
            ...commonHeaders,
            "Content-Length": end - start + 1,
            "Content-Range": `bytes ${start}-${end}/${file.length}`,
          });
          if (request.method !== "HEAD") {
            response.end(file.subarray(start, end + 1));
          } else {
            response.end();
          }
          return;
        }
      }
    }

    response.writeHead(200, {
      ...commonHeaders,
      "Content-Length": file.length,
    });
    if (request.method !== "HEAD") {
      response.end(file);
    } else {
      response.end();
    }
  } catch (error) {
    const status = error && error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status).end(status === 404 ? "Not found" : "Server error");
  }
}

async function startLocalServer() {
  const server = http.createServer((request, response) => {
    serveFile(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end("Server error");
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  ensure(address && typeof address === "object", "Paikallisen testipalvelimen osoite puuttuu.");
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function readConsentScope() {
  const configPath = path.join(projectRoot, "assets/content-config.js");
  const source = await fs.readFile(configPath, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: configPath });
  return (
    sandbox.window.futureMakerContent?.visitorData?.consentScope ||
    "visitor-data-minimal-private-sheet-consent-v8"
  );
}

async function listHtmlPages() {
  const entries = await fs.readdir(projectRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort((left, right) => {
      if (left === "index.html") return -1;
      if (right === "index.html") return 1;
      return left.localeCompare(right, "fi");
    });
}

async function createContext(browser, options = {}) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const allowedOrigin = new URL(testBaseUrl).origin;

  if (options.savedConsent) {
    await context.addInitScript(
      ({ consentScope }) => {
        try {
          localStorage.setItem("futureMakerVisitorConsent", "necessary");
          localStorage.setItem("futureMakerVisitorConsentScope", consentScope);
          localStorage.setItem("futureMakerLanguage", "fi");
        } catch {
          // Opaque about:blank-kehykset eivät aina tarjoa localStoragea.
        }
      },
      { consentScope: options.consentScope }
    );
  }

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());

    if (["http:", "https:"].includes(url.protocol) && url.origin !== allowedOrigin) {
      await route.abort("blockedbyclient");
      return;
    }

    await route.continue();
  });

  return context;
}

async function gotoChecked(page, pageName) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(testUrlForPage(pageName), {
    waitUntil: "domcontentloaded",
    timeout: settings.timeoutMs,
  });

  ensure(response, `${pageName}: sivulataus ei palauttanut vastausta.`);
  ensure(response.status() < 400, `${pageName}: sivulataus palautti HTTP ${response.status()}.`);
  await page.waitForTimeout(100);
  ensure(pageErrors.length === 0, `${pageName}: JavaScript-virhe: ${pageErrors.join("; ")}`);
  return pageErrors;
}

async function discoverStaticButtons(page) {
  return page.locator(staticButtonSelector).evaluateAll((elements) =>
    elements.map((element, index) => ({
      index,
      tagName: element.tagName.toLowerCase(),
      type: element.getAttribute("type") || "",
      href: element.getAttribute("href") || "",
      className: element.getAttribute("class") || "",
      label:
        element.dataset.buttonName ||
        element.getAttribute("aria-label") ||
        element.textContent.replace(/\s+/g, " ").trim() ||
        `${element.tagName.toLowerCase()}-${index + 1}`,
      dataButtonName: element.dataset.buttonName || "",
      dataLanguage: element.dataset.language || "",
      dataRoleButton: element.dataset.roleButton || "",
      isPrivacySettings: element.hasAttribute("data-open-privacy-settings"),
      isVideoTrigger: element.hasAttribute("data-video-trigger"),
      isVideoLoad: element.hasAttribute("data-video-load"),
      isVideoPlay: element.hasAttribute("data-video-play"),
      isVideoClose: element.classList.contains("video-close"),
      isInitiallyHidden:
        element.hidden ||
        element.closest("[hidden]") !== null ||
        !(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
    }))
  );
}

async function prepareHiddenRoleLink(page, target) {
  if (target.dataButtonName !== "portfolio_role_continue_full") {
    return;
  }

  await page.locator('[data-role-button="all"]').click({ timeout: settings.timeoutMs });
  await page.locator('[data-role-panel="all"]').waitFor({ state: "visible" });
}

async function exerciseButton(page, locator, target) {
  if (target.dataLanguage) {
    await locator.click({ timeout: settings.timeoutMs });
    const state = await locator.evaluate((element) => ({
      lang: document.documentElement.lang,
      pressed: element.getAttribute("aria-pressed"),
    }));
    ensure(state.lang === target.dataLanguage, `Kieli ei vaihtunut arvoon ${target.dataLanguage}.`);
    ensure(state.pressed === "true", "Kielinappi ei saanut aktiivista aria-pressed-tilaa.");
    return `Kieli vaihtui arvoon ${target.dataLanguage} ja nappi aktivoitui.`;
  }

  if (target.dataRoleButton) {
    await locator.click({ timeout: settings.timeoutMs });
    const state = await page.evaluate((role) => ({
      role: document.documentElement.dataset.portfolioRole,
      pressed: document
        .querySelector(`[data-role-button="${role}"]`)
        ?.getAttribute("aria-pressed"),
      panelVisible: !document.querySelector(`[data-role-panel="${role}"]`)?.hidden,
      urlRole: new URL(window.location.href).searchParams.get("role"),
    }), target.dataRoleButton);
    ensure(state.role === target.dataRoleButton, "Roolinäkymä ei vaihtunut valittuun rooliin.");
    ensure(state.pressed === "true", "Roolinappi ei saanut aktiivista aria-pressed-tilaa.");
    ensure(state.panelVisible, "Valitun roolin sisältöpaneeli ei tullut näkyviin.");
    ensure(state.urlRole === target.dataRoleButton, "Valittu rooli ei päivittynyt URL-osoitteeseen.");
    return `Roolinäkymä ${target.dataRoleButton} aktivoitui ja URL päivittyi.`;
  }

  if (target.isPrivacySettings) {
    await locator.click({ timeout: settings.timeoutMs });
    const consentButtons = page.locator("[data-visitor-consent] button");
    await consentButtons.first().waitFor({ state: "visible", timeout: settings.timeoutMs });
    ensure((await consentButtons.count()) === 3, "Evästeikkunassa ei näy kaikkia kolmea valintanappia.");
    ensure(
      (await page.locator("[data-visitor-consent-privacy]").count()) === 1,
      "Evästeikkunan tietosuojalinkki puuttuu."
    );
    return "Tietosuoja-asetukset avasivat ikkunan, jossa on kolme valintaa ja tietosuojalinkki.";
  }

  if (target.isVideoTrigger) {
    await locator.click({ timeout: settings.timeoutMs });
    ensure(!(await page.locator("#video-cv-player").getAttribute("hidden")), "Videosoitin ei avautunut.");
    return "Videonappi avasi sivun oman videosoittimen.";
  }

  if (target.isVideoClose) {
    await page.locator("[data-video-trigger]").first().click({ timeout: settings.timeoutMs });
    await locator.click({ timeout: settings.timeoutMs });
    ensure((await page.locator("#video-cv-player").getAttribute("hidden")) !== null, "Videosoitin ei sulkeutunut.");
    return "Sulkunappi sulki videosoittimen.";
  }

  if (target.isVideoLoad) {
    await page.locator("[data-video-trigger]").first().click({ timeout: settings.timeoutMs });
    await locator.click({ timeout: settings.timeoutMs });
    const frameState = await page.locator("#video-cv-youtube").evaluate((frame) => ({
      hidden: frame.hidden,
      src: frame.src,
    }));
    ensure(!frameState.hidden, "YouTube-upotus ei tullut näkyviin.");
    ensure(/youtube-nocookie\.com\/embed\//.test(frameState.src), "YouTube-upotuksen osoite ei päivittynyt.");
    return "Videon latausnappi toi yksityisyysparannetun YouTube-upotuksen näkyviin.";
  }

  if (target.isVideoPlay) {
    await page.locator("[data-video-trigger]").first().click({ timeout: settings.timeoutMs });
    await locator.evaluate((element) => element.click());
    const frameState = await page.locator("#video-cv-youtube").evaluate((frame) => ({
      hidden: frame.hidden,
      src: frame.src,
    }));
    ensure(!frameState.hidden, "Piilotetun varatoistonappi ei aktivoinut videoupotusta.");
    ensure(frameState.src.includes("autoplay=1"), "Videon toistopyyntö ei sisältänyt autoplay-asetusta.");
    return "Videon varatoistonappi käynnisti YouTube-upotuksen ohjelmallisesti.";
  }

  throw new Error("Nappia ei tunnistettu selaimessa testattavaksi toiminnoksi.");
}

function sameDestination(actualValue, expectedValue) {
  const actual = new URL(actualValue);
  const expected = new URL(expectedValue);
  return (
    actual.origin === expected.origin &&
    actual.pathname.replace(/\/index\.html$/, "/") ===
      expected.pathname.replace(/\/index\.html$/, "/") &&
    actual.hash === expected.hash
  );
}

async function exerciseLink(page, context, locator, target) {
  const href = String(target.href || "").trim();
  ensure(href, "Linkkinapilta puuttuu href.");
  await prepareHiddenRoleLink(page, target);

  if (href.startsWith("mailto:")) {
    ensure(
      /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href),
      "Sähköpostinapin mailto-osoite ei ole kelvollinen."
    );
    const clickedHref = await locator.evaluate((element) => {
      let value = "";
      element.addEventListener(
        "click",
        () => {
          value = element.getAttribute("href") || "";
        },
        { once: true }
      );
      element.click();
      return value;
    });
    ensure(clickedHref === href, "Sähköpostinapin klikkaus ei käyttänyt sen mailto-osoitetta.");
    return "Sähköpostinappi reagoi klikkaukseen ja mailto-osoite on kelvollinen.";
  }

  const destination = new URL(href, page.url());
  const currentOrigin = new URL(testBaseUrl).origin;

  if (destination.origin !== currentOrigin) {
    let navigationUrl = "";
    const onRequest = (request) => {
      if (request.isNavigationRequest()) {
        navigationUrl = request.url();
      }
    };
    context.on("request", onRequest);
    const pagesBefore = new Set(context.pages());

    try {
      await locator.click({ noWaitAfter: true, timeout: settings.timeoutMs });
      await page.waitForTimeout(400);
      ensure(navigationUrl, "Ulkoisen linkkinapin klikkaus ei käynnistänyt navigointia.");
      ensure(
        sameDestination(navigationUrl, destination.toString()),
        `Ulkoisen linkkinapin navigointi meni väärään osoitteeseen: ${navigationUrl}`
      );
    } finally {
      context.off("request", onRequest);
      for (const openPage of context.pages()) {
        if (!pagesBefore.has(openPage)) {
          await openPage.close().catch(() => {});
        }
      }
    }

    return `Klikkaus käynnisti navigoinnin osoitteeseen ${destination.hostname}.`;
  }

  try {
    await Promise.all([
      page.waitForURL(
        (url) => sameDestination(url.toString(), destination.toString()),
        { timeout: settings.timeoutMs, waitUntil: "domcontentloaded" }
      ),
      locator.click({ timeout: settings.timeoutMs }),
    ]);
  } catch (error) {
    // Chromium can report ERR_ABORTED after an otherwise successful same-origin
    // navigation. Accept the click only when the browser is already at the exact
    // expected destination; otherwise preserve the original failure.
    if (!sameDestination(page.url(), destination.toString())) {
      throw error;
    }
  }

  if (destination.hash) {
    const targetExists = await page.locator(destination.hash).count();
    ensure(targetExists === 1, `Ankkurikohdetta ${destination.hash} ei löytynyt klikkauksen jälkeen.`);
    return `Klikkaus siirtyi oikeaan ankkurikohteeseen ${destination.hash}.`;
  }

  return `Klikkaus avasi oikean sisäisen kohteen ${destination.pathname}.`;
}

async function runStaticButton(context, pageName, target) {
  const page = await context.newPage();
  let pageErrors = [];

  try {
    pageErrors = await gotoChecked(page, pageName);
    const locator = page.locator(staticButtonSelector).nth(target.index);
    await locator.waitFor({ state: "attached", timeout: settings.timeoutMs });

    const actualTag = await locator.evaluate((element) => element.tagName.toLowerCase());
    ensure(actualTag === target.tagName, "Sivun nappijärjestys muuttui kesken tarkistuksen.");

    const detail =
      target.tagName === "button"
        ? await exerciseButton(page, locator, target)
        : await exerciseLink(page, context, locator, target);

    await page.waitForTimeout(50);
    ensure(pageErrors.length === 0, `JavaScript-virhe klikkauksen aikana: ${pageErrors.join("; ")}`);
    pass({
      page: pageName,
      type: target.tagName === "button" ? "button" : "button-link",
      label: target.label,
      target: target.href || target.dataRoleButton || target.dataLanguage,
      detail,
    });
  } catch (error) {
    const screenshotName = `button-failure-${pageName.replace(/\W+/g, "-")}-${target.index + 1}.png`;
    await fs.mkdir(settings.reportDir, { recursive: true });
    await page
      .screenshot({ path: path.join(settings.reportDir, screenshotName), fullPage: true })
      .catch(() => {});
    fail({
      page: pageName,
      type: target.tagName === "button" ? "button" : "button-link",
      label: target.label,
      target: target.href || target.dataRoleButton || target.dataLanguage,
      detail: error.message,
      recommendation: `Tarkista napin tapahtumankäsittelijä ja selaintestin kuvakaappaus ${screenshotName}.`,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

async function runCookieConsentChecks(browser, consentScope) {
  const cases = [
    {
      selector: "[data-visitor-consent-accept]",
      label: "Evästeet: hyväksy analytiikka",
      expectedConsent: "accepted",
    },
    {
      selector: "[data-visitor-consent-necessary]",
      label: "Evästeet: vain välttämättömät",
      expectedConsent: "necessary",
    },
    {
      selector: "[data-visitor-consent-decline]",
      label: "Evästeet: hylkää valinnaiset",
      expectedConsent: "declined",
    },
    {
      selector: "[data-visitor-consent-privacy]",
      label: "Evästeet: tietosuojaseloste",
      expectedPath: "/privacy.html",
    },
  ];

  for (const consentCase of cases) {
    const context = await createContext(browser, { savedConsent: false, consentScope });
    const page = await context.newPage();

    try {
      await gotoChecked(page, "index.html");
      const banner = page.locator("[data-visitor-consent]");
      await banner.waitFor({ state: "visible", timeout: settings.timeoutMs });
      ensure((await banner.locator("button").count()) === 3, "Evästeikkunassa ei ole kolmea valintanappia.");
      ensure(
        (await banner.locator("[data-visitor-consent-privacy]").count()) === 1,
        "Evästeikkunan tietosuojalinkki puuttuu."
      );

      const locator = page.locator(consentCase.selector);

      if (consentCase.expectedConsent) {
        await locator.click({ timeout: settings.timeoutMs });
        await banner.waitFor({ state: "detached", timeout: settings.timeoutMs });
        const storage = await page.evaluate(() => ({
          consent: localStorage.getItem("futureMakerVisitorConsent"),
          scope: localStorage.getItem("futureMakerVisitorConsentScope"),
        }));
        ensure(
          storage.consent === consentCase.expectedConsent,
          `Valinta ei tallentunut arvolla ${consentCase.expectedConsent}.`
        );
        ensure(storage.scope === consentScope, "Evästevalinnan versiota ei tallennettu oikein.");
        pass({
          page: "index.html",
          type: "cookie-consent-button",
          label: consentCase.label,
          target: consentCase.expectedConsent,
          detail: `Nappi sulki ikkunan ja tallensi valinnan ${consentCase.expectedConsent}.`,
        });
      } else {
        const destination = new URL(consentCase.expectedPath, `${testBaseUrl}/`);
        const urlWait = page.waitForURL(
          (url) => sameDestination(url.toString(), destination.toString()),
          { timeout: settings.timeoutMs, waitUntil: "domcontentloaded" }
        );
        await locator.click({ timeout: settings.timeoutMs });
        await urlWait;
        ensure(
          (await page.locator("body.privacy-view").count()) === 1,
          "Tietosuojalinkki ei avannut tietosuojasivua."
        );
        pass({
          page: "index.html",
          type: "cookie-consent-link",
          label: consentCase.label,
          target: consentCase.expectedPath,
          detail: "Evästeikkunan tietosuojalinkki avasi tietosuojasivun.",
        });
      }
    } catch (error) {
      fail({
        page: "index.html",
        type: consentCase.expectedConsent ? "cookie-consent-button" : "cookie-consent-link",
        label: consentCase.label,
        target: consentCase.expectedConsent || consentCase.expectedPath,
        detail: error.message,
        recommendation: "Tarkista evästesuostumusikkunan tapahtumankäsittelijä ja tallennusavaimet.",
      });
    } finally {
      await context.close().catch(() => {});
    }
  }
}

function escapeTable(value) {
  return String(value || "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function table(rows) {
  if (!rows.length) {
    return "_Ei rivejä._";
  }

  const header = "| Tila | Sivu | Tyyppi | Nappi | Tieto | Korjausehdotus |";
  const separator = "| --- | --- | --- | --- | --- | --- |";
  const body = rows
    .map(
      (row) =>
        `| ${escapeTable(row.status)} | ${escapeTable(row.page)} | ${escapeTable(
          row.type
        )} | ${escapeTable(row.label)} | ${escapeTable(row.detail)} | ${escapeTable(
          row.recommendation
        )} |`
    )
    .join("\n");
  return `${header}\n${separator}\n${body}`;
}

function reportStamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function reportPaths() {
  const stamp = reportStamp(startedAt);
  return {
    markdown: path.join(settings.reportDir, `${stamp}-buttons.md`),
    json: path.join(settings.reportDir, `${stamp}-buttons.json`),
  };
}

function renderMarkdown() {
  const passed = results.filter((item) => item.status === "pass");
  const failed = results.filter((item) => item.status === "fail");
  const helsinkiTime = startedAt.toLocaleString("fi-FI", {
    timeZone: "Europe/Helsinki",
    dateStyle: "full",
    timeStyle: "medium",
  });

  return `# Kuukausittainen nappien selaintesti

Päivämäärä ja kellonaika: ${helsinkiTime}

Testikohde: ${testBaseUrl}

## Yhteenveto

| Mittari | Määrä |
| --- | ---: |
| Tarkistetut HTML-sivut | ${testedPageCount} |
| Tarkistetut napit ja linkkinapit | ${results.length} |
| Läpi menneet | ${passed.length} |
| Epäonnistuneet | ${failed.length} |

Tarkistus avasi sivut Chromium-selaimessa ja käytti jokaista löytynyttä \`button\`-elementtiä, seurattua linkkinappia ja \`.button\`-linkkiä. Evästesuostumuksen kolme valintanappia sekä tietosuojalinkki testattiin kukin erillisessä puhtaassa selaintilassa.

## Epäonnistuneet

${table(failed)}

## Läpi menneet

${table(passed)}
`;
}

async function writeReports() {
  await fs.mkdir(settings.reportDir, { recursive: true });
  const paths = reportPaths();
  const summary = {
    startedAt: startedAt.toISOString(),
    targetUrl: testBaseUrl,
    testedPages: testedPageCount,
    totals: {
      buttons: results.length,
      passed: results.filter((item) => item.status === "pass").length,
      failed: results.filter((item) => item.status === "fail").length,
    },
    results,
  };
  await fs.writeFile(paths.markdown, renderMarkdown(), "utf8");
  await fs.writeFile(paths.json, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return paths;
}

async function main() {
  if (!testBaseUrl) {
    const local = await startLocalServer();
    localServer = local.server;
    testBaseUrl = local.url;
  }

  const launchOptions = { headless: true };
  if (settings.browserChannel) {
    launchOptions.channel = settings.browserChannel;
  }

  const browser = await chromium.launch(launchOptions);
  const consentScope = await readConsentScope();
  const pages = await listHtmlPages();
  const context = await createContext(browser, { savedConsent: true, consentScope });

  try {
    for (const pageName of pages) {
      testedPageCount += 1;
      const discoveryPage = await context.newPage();
      let targets = [];

      try {
        await gotoChecked(discoveryPage, pageName);
        targets = await discoverStaticButtons(discoveryPage);
      } catch (error) {
        fail({
          page: pageName,
          type: "page",
          label: "Sivun nappien löytäminen",
          target: testUrlForPage(pageName),
          detail: error.message,
          recommendation: "Tarkista sivun latautuminen ja JavaScript-virheet ennen nappien testausta.",
        });
      } finally {
        await discoveryPage.close().catch(() => {});
      }

      for (const target of targets) {
        await runStaticButton(context, pageName, target);
      }
    }

    await runCookieConsentChecks(browser, consentScope);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    if (localServer) {
      await new Promise((resolve) => localServer.close(resolve));
    }
  }

  const paths = await writeReports();
  const failed = results.filter((item) => item.status === "fail").length;
  console.log(
    `Nappien selaintesti valmis: ${results.length} nappia, ${failed} virhettä.`
  );
  console.log(`Raportti: ${paths.markdown}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  fail({
    page: "system",
    type: "runtime",
    label: "monthly-button-check",
    target: "tools/monthly-button-check.mjs",
    detail: error.stack || error.message,
    recommendation: "Tarkista Playwright-asennus ja selaimen käynnistyminen.",
  });
  const paths = await writeReports().catch(() => null);
  console.error(error);
  if (paths) {
    console.error(`Raportti: ${paths.markdown}`);
  }
  if (localServer) {
    await new Promise((resolve) => localServer.close(resolve)).catch(() => {});
  }
  process.exitCode = 1;
});
