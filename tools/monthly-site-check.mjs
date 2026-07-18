import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const startedAt = new Date();

const settings = {
  siteBaseUrl: normalizeBaseUrl(process.env.SITE_BASE_URL || ""),
  reportDir: path.resolve(
    projectRoot,
    process.env.REPORT_DIR || "reports/monthly-site-checks"
  ),
  timeoutMs: Number.parseInt(process.env.CHECK_TIMEOUT_MS || "15000", 10),
  checkExternalLinks: process.env.CHECK_EXTERNAL_LINKS !== "0",
  checkAnalyticsPost: process.env.CHECK_ANALYTICS_POST === "1",
  userAgent:
    process.env.SITE_CHECK_USER_AGENT ||
    "FutureMakerMonthlySiteCheck/1.0 (+monthly_link_check)",
};

const htmlPath = path.join(projectRoot, "index.html");
const configPath = path.join(projectRoot, "assets/content-config.js");
const results = [];
const httpCache = new Map();
let httpRequestCount = 0;

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

function result(entry) {
  results.push({
    status: entry.status,
    area: entry.area,
    type: entry.type,
    label: entry.label || "",
    target: entry.target || "",
    detail: entry.detail || "",
    recommendation: entry.recommendation || "",
  });
}

function pass(entry) {
  result({ ...entry, status: "pass" });
}

function fail(entry) {
  result({ ...entry, status: "fail" });
}

function warn(entry) {
  result({ ...entry, status: "warning" });
}

function skipped(entry) {
  result({ ...entry, status: "skipped" });
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function parseAttributes(rawAttributes = "") {
  const attrs = {};
  const attrPattern =
    /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = attrPattern.exec(rawAttributes))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function parseOpenTags(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  const tags = [];
  let match;

  while ((match = pattern.exec(html))) {
    tags.push({
      tagName: tagName.toLowerCase(),
      attrs: parseAttributes(match[1]),
      index: match.index,
      line: lineForIndex(html, match.index),
      raw: match[0],
    });
  }

  return tags;
}

function parsePairedTags(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const tags = [];
  let match;

  while ((match = pattern.exec(html))) {
    tags.push({
      tagName: tagName.toLowerCase(),
      attrs: parseAttributes(match[1]),
      innerHtml: match[2],
      text: stripTags(match[2]),
      index: match.index,
      line: lineForIndex(html, match.index),
      raw: match[0],
    });
  }

  return tags;
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadContentConfig() {
  if (!(await pathExists(configPath))) {
    warn({
      area: "configuration",
      type: "content-config",
      label: "assets/content-config.js",
      target: configPath,
      detail: "Sisaltoasetustiedostoa ei loytynyt.",
      recommendation:
        "Pidä dokumentti-, video- ja analytiikkaosoitteet assets/content-config.js-tiedostossa, jotta tarkistin näkee ne.",
    });
    return {};
  }

  const configSource = await readText(configPath);
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(configSource, sandbox, { filename: configPath });
  return sandbox.window.futureMakerContent || {};
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isMailOrPhone(value) {
  return /^(mailto|tel):/i.test(value);
}

function isIgnoredUrl(value) {
  return (
    !value ||
    /^about:blank$/i.test(value) ||
    /^javascript:/i.test(value) ||
    /^data:/i.test(value)
  );
}

function normalizeReference(value) {
  return String(value || "").trim();
}

function localPathForReference(reference, baseDir = projectRoot) {
  const ref = normalizeReference(reference);

  if (isIgnoredUrl(ref) || isExternalUrl(ref) || isMailOrPhone(ref) || ref.startsWith("#")) {
    return null;
  }

  const withoutHash = ref.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  const decoded = decodeURIComponent(withoutQuery);

  if (decoded === "" || decoded === "/") {
    return path.join(projectRoot, "index.html");
  }

  if (decoded.startsWith("/")) {
    return path.resolve(projectRoot, `.${decoded}`);
  }

  return path.resolve(baseDir, decoded);
}

function publicUrlForInternalReference(reference) {
  if (!settings.siteBaseUrl) {
    return "";
  }

  try {
    const url = new URL(reference, `${settings.siteBaseUrl}/`);
    url.searchParams.set("healthcheck", "1");
    return url.toString();
  } catch {
    return "";
  }
}

function withHealthcheckQuery(urlValue) {
  try {
    const url = new URL(urlValue);
    url.searchParams.set("healthcheck", "1");
    return url.toString();
  } catch {
    return urlValue;
  }
}

function labelFromElement(element, fallback) {
  return (
    element.attrs["data-button-name"] ||
    element.attrs["aria-label"] ||
    element.attrs.title ||
    element.text ||
    fallback
  );
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = keyFn(item);

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);

  try {
    httpRequestCount += 1;
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": settings.userAgent,
        "X-Portfolio-Healthcheck": "true",
        Accept: "*/*",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkHttpUrl(url, context = {}) {
  const cacheKey = `${context.method || "AUTO"} ${url}`;

  if (httpCache.has(cacheKey)) {
    return httpCache.get(cacheKey);
  }

  if (!settings.checkExternalLinks && isExternalUrl(url)) {
    const skippedResult = {
      ok: true,
      skipped: true,
      detail: "Ulkoisten linkkien verkkotarkistus on pois paalta.",
    };
    httpCache.set(cacheKey, skippedResult);
    return skippedResult;
  }

  const attempts = context.method === "POST" ? ["POST"] : ["HEAD", "GET"];
  let lastError = "";

  for (const method of attempts) {
    try {
      const response = await fetchWithTimeout(url, {
        method,
        body: method === "POST" ? context.body : undefined,
        headers:
          method === "POST"
            ? {
                "Content-Type": "text/plain;charset=utf-8",
              }
            : {
                Range: "bytes=0-0",
              },
      });

      if (
        method === "HEAD" &&
        [403, 405, 406, 501].includes(response.status) &&
        attempts.includes("GET")
      ) {
        lastError = `HEAD palautti ${response.status}`;
        continue;
      }

      const httpResult = {
        ok: response.status >= 200 && response.status < 400,
        status: response.status,
        statusText: response.statusText,
        finalUrl: response.url,
        contentType: response.headers.get("content-type") || "",
        method,
      };
      httpCache.set(cacheKey, httpResult);
      return httpResult;
    } catch (error) {
      lastError = error.name === "AbortError" ? "Aikakatkaisu" : error.message;
    }
  }

  const httpResult = {
    ok: false,
    error: lastError || "Tuntematon verkkovirhe",
  };
  httpCache.set(cacheKey, httpResult);
  return httpResult;
}

function statusDetail(httpResult) {
  if (httpResult.skipped) {
    return httpResult.detail;
  }

  if (httpResult.error) {
    return httpResult.error;
  }

  return `${httpResult.method} ${httpResult.status} ${httpResult.statusText || ""}`.trim();
}

function recommendationForHttp(httpResult, target) {
  if (httpResult.error) {
    return "Tarkista verkkoyhteys, DNS ja se, että osoite on edelleen käytössä.";
  }

  if (httpResult.status === 404) {
    return "Korjaa linkin polku tai vaihda osoite nykyiseen sisältöön.";
  }

  if (httpResult.status === 403) {
    return "Tarkista, onko kohde estänyt automaatiot. Jos sivu toimii selaimessa, lisää manuaalinen varmistus tai vaihda vakaampaan julkiseen URLiin.";
  }

  if (httpResult.status >= 500) {
    return "Kohdepalvelin palauttaa virheen. Tarkista palvelun tila tai käytä varalähdettä.";
  }

  return `Tarkista osoite ${target} ja päivitä se tarvittaessa.`;
}

function isKnownAutomationLimitedUrl(urlValue) {
  try {
    const host = new URL(urlValue).hostname.replace(/^www\./, "");
    return (
      host === "linkedin.com" ||
      host.endsWith(".linkedin.com") ||
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

function isKnownAutomationLimitedFailure(url, httpResult) {
  return (
    isKnownAutomationLimitedUrl(url) &&
    (Boolean(httpResult.error) || [403, 429, 999].includes(httpResult.status))
  );
}

async function checkExternalLink(url, label, area = "external-link") {
  const httpResult = await checkHttpUrl(url);

  if (httpResult.skipped) {
    skipped({
      area,
      type: "external-link",
      label,
      target: url,
      detail: httpResult.detail,
      recommendation: "Aja tarkistin ilman CHECK_EXTERNAL_LINKS=0-asetusta.",
    });
    return;
  }

  if (httpResult.ok) {
    pass({
      area,
      type: "external-link",
      label,
      target: url,
      detail: `${statusDetail(httpResult)} -> ${httpResult.finalUrl || url}`,
    });
    return;
  }

  if (isKnownAutomationLimitedFailure(url, httpResult)) {
    warn({
      area,
      type: "external-link",
      label,
      target: url,
      detail: `${statusDetail(httpResult)}. Palvelu tai paikallinen verkkoympäristö todennäköisesti estää automaatiopyynnön, vaikka linkki voi toimia selaimessa.`,
      recommendation:
        "Tarkista linkki selaimessa. Jos se toimii, tämä varoitus on hyväksyttävä some-/YouTube-bot-suojauksen vuoksi.",
    });
    return;
  }

  fail({
    area,
    type: "external-link",
    label,
    target: url,
    detail: statusDetail(httpResult),
    recommendation: recommendationForHttp(httpResult, url),
  });
}

async function checkDeployedInternalReference(reference, label, area) {
  const deployedUrl = publicUrlForInternalReference(reference);

  if (!deployedUrl) {
    return;
  }

  const httpResult = await checkHttpUrl(deployedUrl);

  if (httpResult.ok) {
    pass({
      area,
      type: "cloudflare-pages",
      label,
      target: deployedUrl,
      detail: statusDetail(httpResult),
    });
    return;
  }

  fail({
    area,
    type: "cloudflare-pages",
    label,
    target: deployedUrl,
    detail: statusDetail(httpResult),
    recommendation: recommendationForHttp(httpResult, deployedUrl),
  });
}

async function listFilesRecursive(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase();
}

function isPdf(filePath) {
  return extensionOf(filePath) === ".pdf";
}

function isImage(filePath) {
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico"].includes(
    extensionOf(filePath)
  );
}

function isVideo(filePath) {
  return [".mp4", ".webm", ".mov", ".m4v", ".m3u8"].includes(extensionOf(filePath));
}

function isStaticAsset(filePath) {
  return [".css", ".js", ".txt", ".html", ".json"].includes(extensionOf(filePath));
}

function checkFileSignature(filePath, bytes, size) {
  const ext = extensionOf(filePath);

  if (size === 0) {
    return {
      ok: false,
      detail: "Tiedosto on tyhja.",
      recommendation: "Lisää oikea tiedosto tai poista viittaus tähän tiedostoon.",
    };
  }

  if (ext === ".pdf") {
    const start = bytes.subarray(0, 5).toString("latin1");
    const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1");

    if (!start.startsWith("%PDF-")) {
      return {
        ok: false,
        detail: "PDF-otsake puuttuu.",
        recommendation: "Korvaa tiedosto ehjällä PDF:llä.",
      };
    }

    if (!tail.includes("%%EOF")) {
      return {
        ok: false,
        detail: "PDF:n EOF-merkintää ei löydy tiedoston lopusta.",
        recommendation: "Vie PDF uudelleen ja korvaa tiedosto ehjällä versiolla.",
      };
    }
  }

  if ((ext === ".jpg" || ext === ".jpeg") && !(bytes[0] === 0xff && bytes[1] === 0xd8)) {
    return {
      ok: false,
      detail: "JPEG-otsake puuttuu.",
      recommendation: "Korvaa kuva ehjällä JPEG-tiedostolla.",
    };
  }

  if (
    ext === ".png" &&
    !(
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
  ) {
    return {
      ok: false,
      detail: "PNG-otsake puuttuu.",
      recommendation: "Korvaa kuva ehjällä PNG-tiedostolla.",
    };
  }

  if (ext === ".mp4") {
    const header = bytes.subarray(0, 32).toString("latin1");

    if (!header.includes("ftyp")) {
      return {
        ok: false,
        detail: "MP4-tiedoston ftyp-otsaketta ei löydy.",
        recommendation:
          "Korvaa video ehjällä MP4-tiedostolla tai poista paikallinen fallback-lähde asetuksista, jos YouTube on ainoa käytettävä video.",
      };
    }
  }

  return { ok: true, detail: `Tiedosto löytyi ja perusmuoto täsmää (${size} tavua).` };
}

async function checkLocalFile(filePath, label, area = "file") {
  const relativeTarget = path.relative(projectRoot, filePath);

  if (!filePath.startsWith(projectRoot)) {
    fail({
      area,
      type: "file",
      label,
      target: filePath,
      detail: "Polku osoittaa sivustokansion ulkopuolelle.",
      recommendation: "Käytä sivustokansion sisäistä tiedostoa tai julkista HTTPS-osoitetta.",
    });
    return;
  }

  try {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      fail({
        area,
        type: "file",
        label,
        target: relativeTarget,
        detail: "Polku ei ole tiedosto.",
        recommendation: "Korjaa viittaus osoittamaan tiedostoon.",
      });
      return;
    }

    const bytes = await fs.readFile(filePath);
    const signature = checkFileSignature(filePath, bytes, stats.size);
    const type = isPdf(filePath)
      ? "pdf"
      : isImage(filePath)
        ? "image"
        : isVideo(filePath)
          ? "video"
          : "file";

    if (signature.ok) {
      pass({
        area,
        type,
        label,
        target: relativeTarget,
        detail: signature.detail,
      });
      return;
    }

    fail({
      area,
      type,
      label,
      target: relativeTarget,
      detail: signature.detail,
      recommendation: signature.recommendation,
    });
  } catch (error) {
    fail({
      area,
      type: "file",
      label,
      target: relativeTarget,
      detail: error.code === "ENOENT" ? "Tiedosto puuttuu." : error.message,
      recommendation: "Lisää puuttuva tiedosto tai korjaa sivuston viittaus oikeaan polkuun.",
    });
  }
}

function collectCssReferences(cssText, cssFilePath) {
  const refs = [];
  const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match;

  while ((match = pattern.exec(cssText))) {
    const reference = normalizeReference(match[2]);

    if (!isIgnoredUrl(reference) && !reference.startsWith("#")) {
      refs.push({
        reference,
        label: `CSS url() rivillä ${lineForIndex(cssText, match.index)}`,
        baseDir: path.dirname(cssFilePath),
        area: "media",
      });
    }
  }

  return refs;
}

function addReference(references, reference, label, area, baseDir = projectRoot) {
  const normalized = normalizeReference(reference);

  if (!isIgnoredUrl(normalized)) {
    references.push({ reference: normalized, label, area, baseDir });
  }
}

function collectReferences(html, contentConfig) {
  const anchors = parsePairedTags(html, "a");
  const buttons = parsePairedTags(html, "button");
  const images = parseOpenTags(html, "img");
  const scripts = parseOpenTags(html, "script");
  const links = parseOpenTags(html, "link");
  const videos = parseOpenTags(html, "video");
  const sources = parseOpenTags(html, "source");
  const iframes = parseOpenTags(html, "iframe");
  const forms = parseOpenTags(html, "form");
  const references = [];

  for (const image of images) {
    addReference(
      references,
      image.attrs.src,
      `${image.attrs.alt || "image"} (index.html:${image.line})`,
      "media"
    );
  }

  for (const script of scripts) {
    addReference(
      references,
      script.attrs.src,
      `script (index.html:${script.line})`,
      "asset"
    );
  }

  for (const link of links) {
    addReference(
      references,
      link.attrs.href,
      `${link.attrs.rel || "link"} (index.html:${link.line})`,
      "asset"
    );
  }

  for (const video of videos) {
    addReference(
      references,
      video.attrs.src,
      `video src (index.html:${video.line})`,
      "media"
    );
    addReference(
      references,
      video.attrs.poster,
      `video poster (index.html:${video.line})`,
      "media"
    );
  }

  for (const source of sources) {
    addReference(
      references,
      source.attrs.src,
      `source (index.html:${source.line})`,
      "media"
    );
  }

  for (const iframe of iframes) {
    addReference(
      references,
      iframe.attrs.src,
      `${iframe.attrs.title || "iframe"} (index.html:${iframe.line})`,
      "embed"
    );
  }

  for (const [key, reference] of Object.entries(contentConfig.documents || {})) {
    addReference(references, reference, `content-config document: ${key}`, "document");
  }

  if (contentConfig.video) {
    addReference(references, contentConfig.video.poster, "content-config video poster", "media");
    addReference(references, contentConfig.video.source, "content-config video source", "embed");

    for (const source of contentConfig.video.sources || []) {
      addReference(references, source, "content-config video fallback", "media");
    }
  }

  return { anchors, buttons, forms, references };
}

function collectIds(html) {
  const ids = new Set();
  const pattern = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = pattern.exec(html))) {
    ids.add(match[1]);
  }

  return ids;
}

async function checkAnchorReference(anchor, ids) {
  const href = normalizeReference(anchor.attrs.href);
  const label = `${labelFromElement(anchor, "link")} (index.html:${anchor.line})`;

  if (!href) {
    fail({
      area: "link",
      type: "internal-link",
      label,
      target: "",
      detail: "Linkiltä puuttuu href.",
      recommendation: "Lisää linkille href tai muuta elementti napiksi, jos se tekee vain sivun sisäisen toiminnon.",
    });
    return;
  }

  if (href.startsWith("#")) {
    const id = href.slice(1);

    if (ids.has(id)) {
      pass({
        area: "link",
        type: "anchor-link",
        label,
        target: href,
        detail: `Ankkurikohde #${id} löytyy sivulta.`,
      });
      return;
    }

    fail({
      area: "link",
      type: "anchor-link",
      label,
      target: href,
      detail: `Ankkurikohdetta #${id} ei löydy sivulta.`,
      recommendation: "Lisää vastaava id-elementti tai korjaa href oikeaan ankkuriin.",
    });
    return;
  }

  if (isMailOrPhone(href)) {
    const valid = /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href) || /^tel:\+?[\d\s-]+$/i.test(href);

    if (valid) {
      pass({
        area: "link",
        type: "contact-link",
        label,
        target: href.replace(/mailto:.+/, "mailto:redacted"),
        detail: "Yhteystietolinkki on muodollisesti oikein.",
      });
      return;
    }

    fail({
      area: "link",
      type: "contact-link",
      label,
      target: href,
      detail: "Yhteystietolinkin muoto ei täsmää mailto/tel-sääntöihin.",
      recommendation: "Korjaa osoite muotoon mailto:nimi@example.com tai tel:+358...",
    });
    return;
  }

  if (isExternalUrl(href)) {
    await checkExternalLink(href, label);
    return;
  }

  const localPath = localPathForReference(href);
  await checkLocalFile(localPath, label, "link");
  await checkDeployedInternalReference(href, label, "link");
}

function checkButtons(buttons, anchors, contentConfig, ids) {
  const trackedAnchors = anchors.filter(
    (anchor) =>
      anchor.attrs["data-track"] === "button_click" ||
      /\bbutton\b/.test(anchor.attrs.class || "")
  );

  for (const button of buttons) {
    const label = `${labelFromElement(button, "button")} (index.html:${button.line})`;
    const hasType = (button.attrs.type || "").toLowerCase() === "button";
    const buttonClass = button.attrs.class || "";
    const isLanguage = "data-language" in button.attrs;
    const isVideoTrigger = "data-video-trigger" in button.attrs;
    const isVideoLoad = "data-video-load" in button.attrs;
    const isVideoPlay = "data-video-play" in button.attrs;
    const isPortfolioRole = "data-role-button" in button.attrs;
    const isPrivacySettings = "data-open-privacy-settings" in button.attrs;
    const isVideoClose = buttonClass.split(/\s+/).includes("video-close");

    if (!hasType) {
      fail({
        area: "button",
        type: "button",
        label,
        target: "",
        detail: "Napilta puuttuu type=\"button\".",
        recommendation:
          "Lisää type=\"button\", jotta nappi ei vahingossa lähetä lomaketta tulevissa muutoksissa.",
      });
      continue;
    }

    if (isLanguage) {
      const language = button.attrs["data-language"];

      if (["fi", "en"].includes(language)) {
        pass({
          area: "button",
          type: "button",
          label,
          target: `language:${language}`,
          detail: "Kielinapilla on tunnettu data-language-toiminto.",
        });
      } else {
        fail({
          area: "button",
          type: "button",
          label,
          target: `language:${language}`,
          detail: "Kielinapin data-language-arvo ei ole tuettu.",
          recommendation: "Käytä arvoa fi tai en, tai lisää vastaava käännös script.js-tiedostoon.",
        });
      }
      continue;
    }

    if (isPortfolioRole) {
      const role = button.attrs["data-role-button"];

      if (["creative-design", "digital-marketing", "ai-solutions", "all"].includes(role)) {
        pass({
          area: "button",
          type: "button",
          label,
          target: `portfolio-role:${role}`,
          detail: "Roolivalitsimella on tuettu data-role-button-arvo.",
        });
      } else {
        fail({
          area: "button",
          type: "button",
          label,
          target: `portfolio-role:${role}`,
          detail: "Roolivalitsimen data-role-button-arvoa ei tunnisteta.",
          recommendation:
            "Käytä arvoa creative-design, digital-marketing, ai-solutions tai all.",
        });
      }
      continue;
    }

    if (isPrivacySettings) {
      pass({
        area: "button",
        type: "button",
        label,
        target: "privacy-settings",
        detail: "Tietosuoja-asetusten avausnapilla on tunnettu toiminto.",
      });
      continue;
    }

    if (isVideoTrigger) {
      if (ids.has("video-cv-player") && contentConfig.video?.youtubeId) {
        pass({
          area: "button",
          type: "button",
          label,
          target: "video-cv-player",
          detail: "Videon avausnapilla on tunnettu data-video-trigger-toiminto ja YouTube ID.",
        });
      } else {
        fail({
          area: "button",
          type: "button",
          label,
          target: "video-cv-player",
          detail: "Videon avausnapin kohde tai YouTube ID puuttuu.",
          recommendation: "Tarkista #video-cv-player ja assets/content-config.js:n video.youtubeId.",
        });
      }
      continue;
    }

    if (isVideoLoad) {
      if (
        button.attrs["data-button-name"] === "video_cv_load_button" &&
        ids.has("video-cv-youtube") &&
        contentConfig.video?.youtubeId
      ) {
        pass({
          area: "button",
          type: "button",
          label,
          target: "video-cv-youtube",
          detail: "Videon latausnapilla on tunnettu data-video-load-toiminto ja YouTube ID.",
        });
      } else {
        fail({
          area: "button",
          type: "button",
          label,
          target: "video-cv-youtube",
          detail: "Videon latausnapin tunniste, kohde tai YouTube ID puuttuu.",
          recommendation:
            "Tarkista data-button-name=\"video_cv_load_button\", #video-cv-youtube ja assets/content-config.js:n video.youtubeId.",
        });
      }
      continue;
    }

    if (isVideoPlay) {
      if (ids.has("video-cv")) {
        pass({
          area: "button",
          type: "button",
          label,
          target: "video-cv",
          detail: "Videon play-napilla on tunnettu data-video-play-toiminto.",
        });
      } else {
        fail({
          area: "button",
          type: "button",
          label,
          target: "video-cv",
          detail: "Videon play-napin videoelementti puuttuu.",
          recommendation: "Lisää #video-cv-elementti tai poista käyttämätön play-nappi.",
        });
      }
      continue;
    }

    if (isVideoClose) {
      if (ids.has("video-cv-player")) {
        pass({
          area: "button",
          type: "button",
          label,
          target: "video-cv-player",
          detail: "Sulkunapilla on tunnettu video-close-toiminto.",
        });
      } else {
        fail({
          area: "button",
          type: "button",
          label,
          target: "video-cv-player",
          detail: "Sulkunapin videosoitinkohde puuttuu.",
          recommendation: "Tarkista videosoittimen id tai sulkunapin luokka.",
        });
      }
      continue;
    }

    fail({
      area: "button",
      type: "button",
      label,
      target: "",
      detail: "Nappia ei tunnistettu millekään tunnetulle sivustotoiminnolle.",
      recommendation:
        "Lisää napille tunnettu data-attribuutti tai varmista, että tarkistin osaa tunnistaa uuden toiminnon.",
    });
  }

  for (const anchor of trackedAnchors) {
    const href = normalizeReference(anchor.attrs.href);
    const label = `${labelFromElement(anchor, "button-link")} (index.html:${anchor.line})`;

    if (!anchor.attrs["data-button-name"]) {
      warn({
        area: "button",
        type: "button-link",
        label,
        target: href,
        detail: "Klikattavalta linkkinapilta puuttuu data-button-name.",
        recommendation: "Lisää data-button-name, jotta analytiikka ja raportit pysyvät luettavina.",
      });
      continue;
    }

    if (!href) {
      fail({
        area: "button",
        type: "button-link",
        label,
        target: "",
        detail: "Linkkinapilta puuttuu href.",
        recommendation: "Lisää href tai muuta elementti aidoksi button-elementiksi.",
      });
      continue;
    }

    pass({
      area: "button",
      type: "button-link",
      label,
      target: href.startsWith("mailto:") ? "mailto:redacted" : href,
      detail: "Linkkinapilla on href ja analytiikan tunniste.",
    });
  }
}

function checkForms(forms) {
  if (!forms.length) {
    pass({
      area: "form",
      type: "form",
      label: "Lomakkeet",
      target: "index.html",
      detail: "Sivulla ei ole lomakkeita, joten rikkinäisiä form action -osoitteita ei löytynyt.",
    });
    return;
  }

  for (const form of forms) {
    const action = normalizeReference(form.attrs.action);
    const label = `form (index.html:${form.line})`;

    if (!action) {
      fail({
        area: "form",
        type: "form",
        label,
        target: "",
        detail: "Lomakkeelta puuttuu action.",
        recommendation: "Lisää lomakkeelle action tai poista lomake, jos se ei ole käytössä.",
      });
      continue;
    }

    if (isExternalUrl(action)) {
      result({
        status: "warning",
        area: "form",
        type: "form",
        label,
        target: action,
        detail: "Lomakkeen endpoint tarkistetaan ulkoisena linkkinä.",
        recommendation: "Varmista myös, että endpoint hyväksyy oikean lomakedatan.",
      });
    } else {
      const localPath = localPathForReference(action);
      if (localPath) {
        pass({
          area: "form",
          type: "form",
          label,
          target: action,
          detail: "Lomakkeella on sisäinen action-polku.",
        });
      }
    }
  }
}

async function checkAnalyticsEndpoint(contentConfig) {
  const visitorData = contentConfig.visitorData || {};
  const endpoint = normalizeReference(visitorData.endpoint);

  if (!visitorData.enabled) {
    warn({
      area: "analytics",
      type: "analytics-endpoint",
      label: "Analytiikka",
      target: endpoint || "not configured",
      detail: "Analytiikka on asetuksissa pois päältä.",
      recommendation: "Jos analytiikka on tarkoituksella pois päältä, tämä on ok. Muuten tarkista visitorData.enabled.",
    });
    return;
  }

  if (!endpoint) {
    fail({
      area: "analytics",
      type: "analytics-endpoint",
      label: "Google Sheets endpoint",
      target: "",
      detail: "Analytiikan endpoint puuttuu.",
      recommendation: "Lisää visitorData.endpoint assets/content-config.js-tiedostoon.",
    });
    return;
  }

  if (!settings.checkAnalyticsPost) {
    skipped({
      area: "analytics",
      type: "analytics-endpoint",
      label: "Google Sheets endpoint",
      target: endpoint,
      detail:
        "Endpointin kirjoittava testi ohitettiin, jotta analytiikkadataan ei synny testiriviä.",
      recommendation:
        "Aja CHECK_ANALYTICS_POST=1, jolloin POST merkitään arvoilla eventType=system_check, visitorType=automation ja source=monthly_link_check.",
    });
    return;
  }

  const payload = {
    timestamp: startedAt.toISOString(),
    event_type: "system_check",
    eventType: "system_check",
    visitor_type: "automation",
    visitorType: "automation",
    session_id: `system_check_${startedAt.toISOString()}`,
    page_host: settings.siteBaseUrl ? new URL(settings.siteBaseUrl).hostname : "monthly-site-check",
    page_path: "/system-check",
    site_id: visitorData.siteId || "future-maker-cloudflare",
    source: "monthly_link_check",
    device_type: "automation",
    browser: "node",
    os: process.platform,
    language: "fi",
    referrer_type: "automation",
    button_label: "monthly_site_check",
    button_href: "analytics_endpoint",
    visit_duration_seconds: 0,
    engagement_seconds: 0,
    scroll_depth_percent: 0,
    connection_type: "not_applicable",
    connection_operator: "not_available",
  };
  const httpResult = await checkHttpUrl(withHealthcheckQuery(endpoint), {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (httpResult.ok) {
    pass({
      area: "analytics",
      type: "analytics-endpoint",
      label: "Google Sheets endpoint",
      target: endpoint,
      detail: `${statusDetail(httpResult)}. Testirivi merkitty source=monthly_link_check.`,
    });
    return;
  }

  fail({
    area: "analytics",
    type: "analytics-endpoint",
    label: "Google Sheets endpoint",
    target: endpoint,
    detail: statusDetail(httpResult),
    recommendation:
      "Tarkista Apps Script -julkaisu, oikeudet ja että se hyväksyy text/plain POST -pyynnön.",
  });
}

async function checkYoutubeEmbed(contentConfig) {
  const youtubeId = contentConfig.video?.youtubeId;

  if (!youtubeId) {
    fail({
      area: "embed",
      type: "youtube-embed",
      label: "Video CV YouTube",
      target: "video.youtubeId",
      detail: "YouTube ID puuttuu.",
      recommendation: "Lisää video.youtubeId assets/content-config.js-tiedostoon.",
    });
    return;
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`
  )}&format=json`;
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}`;

  await checkExternalLink(embedUrl, "Video CV embed", "embed");

  const httpResult = await checkHttpUrl(oembedUrl, { method: "GET" });

  if (httpResult.ok) {
    pass({
      area: "embed",
      type: "youtube-embed",
      label: "Video CV oEmbed",
      target: youtubeId,
      detail: statusDetail(httpResult),
    });
    return;
  }

  if (isKnownAutomationLimitedFailure(oembedUrl, httpResult)) {
    warn({
      area: "embed",
      type: "youtube-embed",
      label: "Video CV oEmbed",
      target: youtubeId,
      detail: `${statusDetail(httpResult)}. YouTube todennäköisesti estää automaatiopyynnön, vaikka video voi toimia selaimessa.`,
      recommendation:
        "Tarkista video selaimessa. Jos upotus toimii, tämä varoitus on hyväksyttävä YouTube-bot-suojauksen vuoksi.",
    });
    return;
  }

  fail({
    area: "embed",
    type: "youtube-embed",
    label: "Video CV oEmbed",
    target: youtubeId,
    detail: statusDetail(httpResult),
    recommendation:
      "Tarkista, että YouTube-video on julkinen tai listauksesta poistettu mutta upotettavissa.",
  });
}

function checkOldWixReferences(files) {
  const matches = [];
  const wixPattern = /wix(?:site)?\.com|wixstatic\.com/i;

  for (const file of files) {
    const { filePath, text } = file;
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (wixPattern.test(line)) {
        matches.push(`${path.relative(projectRoot, filePath)}:${index + 1}`);
      }
    });
  }

  if (!matches.length) {
    pass({
      area: "legacy-url",
      type: "old-wix-reference",
      label: "Vanhat Wix-polut",
      target: "source files",
      detail: "Vanhoja wix.com, wixsite.com tai wixstatic.com -polkuja ei löytynyt.",
    });
    return;
  }

  fail({
    area: "legacy-url",
    type: "old-wix-reference",
    label: "Vanhat Wix-polut",
    target: matches.join(", "),
    detail: "Sivuston lähteissä on vanhoja Wix-viittauksia.",
    recommendation: "Korvaa vanhat Wix-osoitteet nykyisillä Cloudflare/sivustopolkujen osoitteilla.",
  });
}

function expectedSpecialLinks(contentConfig) {
  const links = [
    ["CV", contentConfig.documents?.cv || "/files/cv.pdf"],
    ["Saatekirje", contentConfig.documents?.coverLetters || "/files/saatekirje.pdf"],
    ["Käsikirjoitus", contentConfig.documents?.manuscripts || "/files/kasikirjoitus.pdf"],
    ["Käyntikortti", contentConfig.documents?.businessCard || "/files/kayntikortti.pdf"],
    ["Video CV YouTube", contentConfig.video?.youtubeId ? `https://www.youtube.com/embed/${contentConfig.video.youtubeId}` : ""],
  ];

  for (const source of contentConfig.video?.sources || []) {
    links.push(["Video CV fallback", source]);
  }

  return links;
}

async function checkSpecialPortfolioLinks(contentConfig) {
  for (const [label, reference] of expectedSpecialLinks(contentConfig)) {
    if (!reference) {
      fail({
        area: "portfolio-assets",
        type: "special-link",
        label,
        target: "",
        detail: "Pakollinen portfolio-linkki puuttuu asetuksista.",
        recommendation: "Lisää linkki assets/content-config.js-tiedostoon.",
      });
      continue;
    }

    if (isExternalUrl(reference)) {
      await checkExternalLink(reference, label, "portfolio-assets");
      continue;
    }

    await checkLocalFile(localPathForReference(reference), label, "portfolio-assets");
    await checkDeployedInternalReference(reference, label, "portfolio-assets");
  }
}

async function main() {
  const html = await readText(htmlPath);
  const contentConfig = await loadContentConfig();
  const ids = collectIds(html);
  const { anchors, buttons, forms, references } = collectReferences(html, contentConfig);
  const sourceFiles = [
    { filePath: htmlPath, text: html },
    { filePath: configPath, text: (await pathExists(configPath)) ? await readText(configPath) : "" },
    { filePath: path.join(projectRoot, "script.js"), text: await readText(path.join(projectRoot, "script.js")) },
    { filePath: path.join(projectRoot, "styles.css"), text: await readText(path.join(projectRoot, "styles.css")) },
  ];

  const cssPath = path.join(projectRoot, "styles.css");
  const cssText = await readText(cssPath);
  references.push(...collectCssReferences(cssText, cssPath));

  checkOldWixReferences(sourceFiles);
  checkButtons(buttons, anchors, contentConfig, ids);
  checkForms(forms);

  if (settings.siteBaseUrl) {
    await checkDeployedInternalReference("/", "Sivuston etusivu", "cloudflare-pages");
  } else {
    warn({
      area: "cloudflare-pages",
      type: "cloudflare-pages",
      label: "Sivuston julkinen osoite",
      target: "SITE_BASE_URL",
      detail: "SITE_BASE_URL ei ole asetettu, joten Cloudflare Pages -julkaisua ei tarkistettu HTTP:n yli.",
      recommendation:
        "Lisää GitHub-repoon muuttuja SITE_BASE_URL, esimerkiksi https://oma-sivusto.pages.dev.",
    });
  }

  for (const anchor of anchors) {
    await checkAnchorReference(anchor, ids);
  }

  const localReferences = references
    .filter((item) => !isExternalUrl(item.reference) && !isMailOrPhone(item.reference))
    .map((item) => ({
      ...item,
      filePath: localPathForReference(item.reference, item.baseDir),
    }))
    .filter((item) => item.filePath);
  const uniqueLocalReferences = uniqueBy(localReferences, (item) => item.filePath);

  for (const item of uniqueLocalReferences) {
    await checkLocalFile(item.filePath, item.label, item.area);
    await checkDeployedInternalReference(item.reference, item.label, item.area);
  }

  const allProjectFiles = await listFilesRecursive(projectRoot);
  const mediaAndPdfFiles = allProjectFiles
    .filter((filePath) => !filePath.includes(`${path.sep}.git${path.sep}`))
    .filter((filePath) => !path.basename(filePath).startsWith("._"))
    .filter((filePath) => isPdf(filePath) || isImage(filePath) || isVideo(filePath));
  const extraMediaFiles = mediaAndPdfFiles.filter(
    (filePath) => !uniqueLocalReferences.some((item) => item.filePath === filePath)
  );

  for (const filePath of extraMediaFiles) {
    await checkLocalFile(filePath, `project media: ${path.relative(projectRoot, filePath)}`, "media");
  }

  const externalReferences = uniqueBy(
    references.filter((item) => isExternalUrl(item.reference)),
    (item) => item.reference
  );

  for (const item of externalReferences) {
    await checkExternalLink(item.reference, item.label, item.area);
  }

  await checkSpecialPortfolioLinks(contentConfig);
  await checkYoutubeEmbed(contentConfig);
  await checkAnalyticsEndpoint(contentConfig);

  await writeReports();

  const failed = results.filter((item) => item.status === "fail").length;
  const warningCount = results.filter((item) => item.status === "warning").length;
  const reportPath = latestReportPath();

  console.log(`Monthly site check valmis: ${failed} virhetta, ${warningCount} varoitusta.`);
  console.log(`Raportti: ${reportPath.markdown}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

function latestReportPath() {
  const stamp = reportStamp(startedAt);
  return {
    markdown: path.join(settings.reportDir, `${stamp}.md`),
    json: path.join(settings.reportDir, `${stamp}.json`),
  };
}

function reportStamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function countBy(predicate) {
  return results.filter(predicate).length;
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

  const header = "| Tila | Osa-alue | Kohde | Tieto | Korjausehdotus |";
  const separator = "| --- | --- | --- | --- | --- |";
  const body = rows
    .map(
      (row) =>
        `| ${escapeTable(row.status)} | ${escapeTable(row.area)} / ${escapeTable(
          row.type
        )} | ${escapeTable(row.label || row.target)} | ${escapeTable(
          row.detail
        )} | ${escapeTable(row.recommendation)} |`
    )
    .join("\n");

  return `${header}\n${separator}\n${body}`;
}

function renderMarkdownReport() {
  const endedAt = new Date();
  const failed = results.filter((item) => item.status === "fail");
  const passed = results.filter((item) => item.status === "pass");
  const warnings = results.filter((item) => item.status === "warning");
  const skippedRows = results.filter((item) => item.status === "skipped");
  const helsinkiTime = startedAt.toLocaleString("fi-FI", {
    timeZone: "Europe/Helsinki",
    dateStyle: "full",
    timeStyle: "medium",
  });

  const linkCount = countBy((item) =>
    ["internal-link", "external-link", "anchor-link", "contact-link"].includes(item.type)
  );
  const buttonCount = countBy((item) => item.area === "button");
  const fileCount = countBy((item) =>
    ["file", "pdf", "image", "video"].includes(item.type)
  );

  return `# Monthly site check

Päivämäärä ja kellonaika: ${helsinkiTime}

Kesto: ${Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)} s

## Yhteenveto

| Mittari | Määrä |
| --- | ---: |
| Tarkistetut linkit | ${linkCount} |
| Tarkistetut napit | ${buttonCount} |
| Tarkistetut tiedostot | ${fileCount} |
| HTTP-pyynnöt | ${httpRequestCount} |
| Läpi menneet tarkistukset | ${passed.length} |
| Epäonnistuneet tarkistukset | ${failed.length} |
| Varoitukset | ${warnings.length} |
| Ohitetut tarkistukset | ${skippedRows.length} |

## Asetukset

| Asetus | Arvo |
| --- | --- |
| SITE_BASE_URL | ${settings.siteBaseUrl || "ei asetettu"} |
| CHECK_EXTERNAL_LINKS | ${settings.checkExternalLinks ? "1" : "0"} |
| CHECK_ANALYTICS_POST | ${settings.checkAnalyticsPost ? "1" : "0"} |
| User-Agent | ${settings.userAgent} |

## Epäonnistuneet

${table(failed)}

## Korjausehdotukset

${table(failed.filter((item) => item.recommendation))}

## Varoitukset ja ohitetut

${table([...warnings, ...skippedRows])}

## Läpi menneet

${table(passed)}

## Analytiikan suojaus

Jos analytiikkaan tehtiin kirjoittava testi, payload merkittiin arvoilla:

- eventType: system_check
- visitorType: automation
- source: monthly_link_check

Näin testikäynti erottuu oikeista rekrykävijöistä Google Sheetsissä.
`;
}

async function writeReports() {
  await fs.mkdir(settings.reportDir, { recursive: true });

  const reportPaths = latestReportPath();
  const summary = {
    startedAt: startedAt.toISOString(),
    siteBaseUrl: settings.siteBaseUrl,
    totals: {
      links: countBy((item) =>
        ["internal-link", "external-link", "anchor-link", "contact-link"].includes(item.type)
      ),
      buttons: countBy((item) => item.area === "button"),
      files: countBy((item) => ["file", "pdf", "image", "video"].includes(item.type)),
      httpRequests: httpRequestCount,
      passed: countBy((item) => item.status === "pass"),
      failed: countBy((item) => item.status === "fail"),
      warnings: countBy((item) => item.status === "warning"),
      skipped: countBy((item) => item.status === "skipped"),
    },
    results,
  };

  await fs.writeFile(reportPaths.markdown, renderMarkdownReport(), "utf8");
  await fs.writeFile(reportPaths.json, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

main().catch(async (error) => {
  fail({
    area: "system",
    type: "runtime",
    label: "monthly-site-check",
    target: "tools/monthly-site-check.mjs",
    detail: error.stack || error.message,
    recommendation: "Tarkista skriptin ajonaikainen virhe ja aja tarkistin uudelleen.",
  });

  await writeReports().catch(() => {});
  console.error(error);
  process.exitCode = 1;
});
