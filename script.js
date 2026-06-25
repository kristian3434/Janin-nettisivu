const clock = document.querySelector("#clock");
const visitorCount = document.querySelector("#visitor-count");
const videoCv = document.querySelector("#video-cv");
const videoFrame = document.querySelector("#video-cv-youtube");
const videoPlayer = document.querySelector("#video-cv-player");
const videoStatus = document.querySelector("#video-status");
const videoTriggers = document.querySelectorAll("[data-video-trigger]");
const videoClose = document.querySelector(".video-close");
const videoPlayButton = document.querySelector("[data-video-play]");
const languageButtons = document.querySelectorAll("[data-language]");
const textNodes = document.querySelectorAll("[data-i18n]");
const htmlNodes = document.querySelectorAll("[data-i18n-html]");
const documentLinks = document.querySelectorAll("[data-document-link]");
const posterElements = document.querySelectorAll("[data-content-poster]");

const defaultContent = {
  documents: {
    cv: "/files/cv.pdf",
    coverLetters: "/files/saatekirje.pdf",
    manuscripts: "/files/kasikirjoitus.pdf",
    businessCard: "/files/kayntikortti.pdf",
  },
  video: {
    poster: "assets/images/video-poster.jpg",
    youtubeId: "WtUr1wuRRBU",
    source: "https://www.youtube.com/embed/WtUr1wuRRBU?rel=0&modestbranding=1&playsinline=1",
    sources: [],
  },
  visitorData: {
    enabled: true,
    endpoint: "https://script.google.com/macros/s/AKfycbyjES-pzC5uuWF84jx4_AHafMKoGMP55JVPF5DKuvbL6owZWj6Vowe_yib4viQWGqHbpw/exec",
    siteId: "future-maker-cloudflare",
    consentScope: "visitor-data-minimal-private-sheet-consent-v7",
    ignoreLocalPreview: true,
    requireConsent: true,
    privacyMode: "minimal",
  },
};

const contentConfig = {
  documents: {
    ...defaultContent.documents,
    ...(window.futureMakerContent && window.futureMakerContent.documents),
  },
  video: {
    ...defaultContent.video,
    ...(window.futureMakerContent && window.futureMakerContent.video),
  },
  visitorData: {
    ...defaultContent.visitorData,
    ...(window.futureMakerContent && window.futureMakerContent.visitorData),
  },
};

let hlsPlayer;
let videoReady = false;
let autoplayRequested = false;
let currentVideoSourceIndex = 0;
let videoSourceErrorHandled = false;
let pendingVideoSource = "";
let videoLoadTimer;
let currentLanguage = "fi";
let clickAudioContext;
let visitStartedAt = Date.now();
let pageStartedAt = Date.now();
let analyticsSessionId = "";
let maxScrollDepthPercent = 0;
let visitEndSent = false;
let videoPlayTracked = false;
let clickCount = 0;
const videoProgressMarks = new Set();

const translations = {
  fi: {
    pageTitle: "Future Maker 2000 | Jani Myllymäki",
    metaDescription:
      "Jani Myllymäki - tulevaisuuden tekijä. Retrohenkinen kampanjasivusto dokumenteille, videoille ja yhteydenotolle.",
    skipLink: "Siirry sisältöön",
    edition: "Numero 001 / Luova työnhaku",
    tagline: "Riippumaton uutishuone yhdelle rohkealle uratarinalle",
    navNews: "Pääotsikko",
    navCampaign: "Kampanja",
    navArchive: "Asiakirjat",
    navMedia: "Linkit",
    navContact: "Yhteys",
    heroKicker: "Etusivun pääuutinen // Special News Today",
    heroTitle: "Erikoisuutisia: Jani Myllymäki teki työnhausta uutisen",
    heroSubtitle: "Luovasuunnittelija, kampanjantekijä ja oman uransa päätoimittaja",
    ticker: "Vuosi sitten perinteinen työnhaku loppui. Tilalle tuli henkilökohtainen brändikampanja.",
    heroByline: "Future Maker Times | Helsinki | Tänään",
    heroLead:
      "En vain erottuakseni joukosta, vaan näyttääkseni tarkalleen, miten ajattelen, suunnittelen ja kommunikoin. Samalla tavalla kuin tekisin asiakkaalle: strategisesti, visuaalisesti ja tarkoituksella.",
    heroMail: "Luodaan yhdessä",
    heroArchive: "Avaa arkisto",
    photoLabel: "Etusivun henkilö:",
    photoCaption: "Minä olen tarina.",
    stripEditorial: "<strong>Pääkirjoitus:</strong> Luovuus kasvaa. Vallankumous on totta.",
    stripObservation:
      "<strong>Toimituksen havainto:</strong> valmiina kampanjoihin, videoihin, musiikkiin ja painomateriaaleihin.",
    stripReader: "Lukija no.",
    campaignLabel: "Uutisanalyysi",
    campaignTitle: "Työnhaku kuin mainoskampanja",
    campaignByline: "Teksti: Future Maker -toimitus | Osasto: Brand & Culture",
    campaignQuote: "Kun luovuus muuttuu kampanjaksi, tehdään historiaa.",
    campaignBodyOne:
      "Myllymäki on taitava toteuttamaan kokonaisia mainoskampanjoita videoiden käsikirjoituksesta ja kuvauksesta editointiin. Lisäksi hänellä on kyky säveltää musiikkia ja luoda asiakkaille painettuja materiaaleja, kuten esitteitä ja muuta mainosmateriaalia.",
    campaignBodyTwo:
      "Olipa kyseessä digitaalinen tai perinteinen media, Myllymäki tarjoaa kattavan ja korkealaatuisen ratkaisun, joka on räätälöity tarpeisiisi.",
    factsTitle: "Nopeat faktat",
    factVideo: "Käsikirjoitus, kuvaus, editointi",
    factSoundLabel: "Ääni",
    factSound: "Oma musiikki ja tuotannon rytmi",
    factPrintLabel: "Printti",
    factPrint: "Esitteet, CV, kampanjamateriaalit",
    factBrandLabel: "Brändäys",
    factBrand: "Strategia, visuaalisuus, tarkoitus",
    factToolsLabel: "Työkalut",
    factTools:
      "Photoshop, Final Cut Pro, Lightroom, Logic Pro, Canva, Widnoz AI, Cloudflare, CapCut sekä tekoäly- ja agenttityökalut",
    archiveLabel: "Lehtiarkisto",
    archiveTitle: "Asiakirjat toimituksen arkistosta",
    archiveIntro:
      "Jokainen aineisto on Janin itse suunnittelema ja viimeistelemä työnäyte: käsintehtyä visuaalista ajattelua, tarinankerrontaa ja mainososaamista, joka tekee viestistä heti muistettavan.",
    docCvType: "Etusivu / PDF",
    docCvTitle: "Ansioluettelo",
    docCvText: "Ansioluettelo on suunniteltu kuin vanhan sanomalehden etusivu, koska ura on uutinen.",
    docCvOpen: "Avaa CV",
    docCoverType: "Pääkirjoitus / PDF",
    docCoverTitle: "Saatekirjeet",
    docCoverText: "Jokainen saatekirje toimii kuin terävä pääkirjoitus rohkeasta brändivisiosta.",
    docCoverOpen: "Avaa saatekirjeet",
    docManuscriptType: "Kulttuuri / PDF",
    docManuscriptTitle: "Käsikirjoitus",
    docManuscriptText: "Astu luovaan uutishuoneeseen: raakaideoista rakennettu mukaansatempaava tarina.",
    docManuscriptOpen: "Avaa käsikirjoitus",
    docCardType: "Ilmoitus / PDF",
    docCardTitle: "Käyntikortti",
    docCardText: "Vuoden 1925 tunnelma, Affinity Publisher ja digitaalinen aikakapseli samassa paketissa.",
    docCardOpen: "Avaa käyntikortti",
    mediaLabel: "Lähetysosasto",
    mediaTitle: "Videouutiset ja ulkoiset lähteet",
    mediaIntro:
      "Päävideona on Video CV: Luovuus sydämessä. Klikkaus avaa videon suoraan tähän sivuun omaan lähetysikkunaan.",
    videoWindowTitle: "LIVE PLAYER / VIDEO CV: LUOVUUS SYDÄMESSÄ",
    videoReady: "Valmis toistamaan Video CV:n tässä sivun omassa ikkunassa.",
    videoPlayButton: "Toista Video CV",
    posterTitle: "Luovuus sydämessä",
    videoCvTitle: "Video CV: Luovuus sydämessä",
    videoCvText: "Toista henkilökohtainen kampanjavideo tässä sivun ikkunassa.",
    creativeCareerTitle: "Luova ura -sarja",
    creativeCareerText: "Alkuperäinen minisarja mainosalan kulissien takaa.",
    shipTitle: "Ideoiden laiva",
    shipText: "Ohjattu, editoitu ja sävelletty itse alusta loppuun.",
    instagramTitle: "Kulissien takana",
    instagramText: "Instagram-linkki vanhalta sivulta.",
    linkedinText: "Ammatillinen profiili ja yhteysverkosto.",
    contactLabel: "Toimitukseen yhteys",
    contactTitle: "Oikeat uutiset eivät odota.",
    contactText: "Tehdään historiaa yhdessä.",
    videoLoaded: "Video CV on ladattu sivun omaan soittimeen.",
    videoTryingNext: "Videolähde vaihtui automaattisesti varalähteeseen...",
    videoLoadError: "Videolähteen lataus epäonnistui. Päivitä esikatselu ja yritä uudelleen.",
    videoUnsupported: "Tämä selain ei tue tämän videolähteen toistoa suoraan sivulla.",
    videoPlaying: "Toistetaan Video CV:tä tässä sivun omassa ikkunassa.",
    videoNeedsPlay: "Video on valmiina. Paina soittimen play-painiketta käynnistääksesi toiston.",
    videoLoading: "Ladataan Video CV:tä tähän sivun omaan ikkunaan...",
    videoStopped: "Video pysäytetty.",
    privacyNote:
      "Tietosuojahuomautus: Sivusto kerää vain hyväksynnällä kevyttä analytiikkadataa portfolion toimivuuden arviointiin. Kerättäviä tietoja voivat olla sivun osio, tapahtumatyyppi, laitekategoria, selain, käyttöjärjestelmä, kieli, liikenteen lähde, viipymä, klikkaukset ja yhteystyyppi. Operaattori tallennetaan vain, jos selain antaa sen turvallisesti ilman IP-osoitetta; muuten arvoksi tulee not_available. Sivusto ei kerää nimeä, sähköpostia, IP-osoitetta tai tarkkaa sijaintia analytiikkalokiin. Data tallennetaan yksityiseen Google Sheetiin, joka ei ole julkinen. Dataa käytetään vain portfolion ja työnhakumateriaalien toimivuuden arviointiin.",
    visitorConsentText:
      "GDPR-ilmoitus: Sivusto voi lähettää Janin yksityiseen Google-taulukkoon kevyen analytiikkamerkinnän, kuten sivun osion, tapahtumatyypin, laitetyypin, selaimen, käyttöjärjestelmän, kielen, liikenteen lähteen, viipymän, yhteystyypin ja klikkaukset. Nimeä, sähköpostia, IP-osoitetta, kaupunkia tai tarkkaa sijaintia ei tallenneta. Operaattori tallennetaan vain, jos selain antaa sen turvallisesti ilman IP-osoitetta; muuten arvoksi tulee not_available. Hyväksytkö kevyen analytiikan?",
    visitorConsentAccept: "Hyväksy",
    visitorConsentDecline: "Kiellä",
  },
  en: {
    pageTitle: "Future Maker 2000 | Jani Myllymäki",
    metaDescription:
      "Jani Myllymäki - future maker. A retro campaign site for documents, videos and contact.",
    skipLink: "Skip to content",
    edition: "Issue 001 / Creative job search",
    tagline: "An independent newsroom for one bold career story",
    navNews: "Headline",
    navCampaign: "Campaign",
    navArchive: "Documents",
    navMedia: "Links",
    navContact: "Contact",
    heroKicker: "Front-page headline // Special News Today",
    heroTitle: "Breaking news: Jani Myllymäki turned a job search into a story",
    heroSubtitle: "Creative planner, campaign maker and editor-in-chief of his own career",
    ticker: "A year ago, the traditional job search ended. In its place came a personal brand campaign.",
    heroByline: "Future Maker Times | Helsinki | Today",
    heroLead:
      "Not only to stand out, but to show exactly how I think, plan and communicate. The same way I would work for a client: strategically, visually and with purpose.",
    heroMail: "Let's create together",
    heroArchive: "Open archive",
    photoLabel: "Front-page person:",
    photoCaption: "I am the story.",
    stripEditorial: "<strong>Editorial:</strong> Creativity is growing. The revolution is real.",
    stripObservation:
      "<strong>Newsroom note:</strong> ready for campaigns, video, music and printed materials.",
    stripReader: "Reader no.",
    campaignLabel: "News analysis",
    campaignTitle: "Job searching as an advertising campaign",
    campaignByline: "Text: Future Maker newsroom | Section: Brand & Culture",
    campaignQuote: "When creativity becomes a campaign, history is made.",
    campaignBodyOne:
      "Myllymäki can produce complete advertising campaigns, from video scripting and filming to editing. He can also compose music and create printed materials for clients, such as brochures and other advertising assets.",
    campaignBodyTwo:
      "Whether the medium is digital or traditional, Myllymäki offers a comprehensive, high-quality solution tailored to your needs.",
    factsTitle: "Fast facts",
    factVideo: "Scriptwriting, filming, editing",
    factSoundLabel: "Sound",
    factSound: "Original music and production rhythm",
    factPrintLabel: "Print",
    factPrint: "Brochures, CV, campaign materials",
    factBrandLabel: "Branding",
    factBrand: "Strategy, visual identity, purpose",
    factToolsLabel: "Tools",
    factTools:
      "Photoshop, Final Cut Pro, Lightroom, Logic Pro, Canva, Widnoz AI, Cloudflare, CapCut plus AI and agent tools",
    archiveLabel: "News archive",
    archiveTitle: "Documents from the newsroom archive",
    archiveIntro:
      "Each document is designed and finished by Jani himself: handcrafted visual thinking, storytelling and advertising craft that makes the message instantly memorable.",
    docCvType: "Front page / PDF",
    docCvTitle: "Curriculum Vitae",
    docCvText: "The CV is designed like the front page of an old newspaper, because a career is news.",
    docCvOpen: "Open CV",
    docCoverType: "Editorial / PDF",
    docCoverTitle: "Cover letters",
    docCoverText: "Each cover letter works like a sharp editorial about a bold brand vision.",
    docCoverOpen: "Open cover letters",
    docManuscriptType: "Culture / PDF",
    docManuscriptTitle: "Manuscript",
    docManuscriptText: "Step into a creative newsroom: a gripping story built from raw ideas.",
    docManuscriptOpen: "Open manuscript",
    docCardType: "Advertisement / PDF",
    docCardTitle: "Business card",
    docCardText: "A 1925 atmosphere, Affinity Publisher and a digital time capsule in one package.",
    docCardOpen: "Open business card",
    mediaLabel: "Broadcast desk",
    mediaTitle: "Video news and external sources",
    mediaIntro:
      "The lead video is Video CV: Creativity at Heart. Click to open it directly in this page's own broadcast window.",
    videoWindowTitle: "LIVE PLAYER / VIDEO CV: CREATIVITY AT HEART",
    videoReady: "Ready to play the Video CV in this page's own window.",
    videoPlayButton: "Play Video CV",
    posterTitle: "Creativity at Heart",
    videoCvTitle: "Video CV: Creativity at Heart",
    videoCvText: "Play the personal campaign video in this page window.",
    creativeCareerTitle: "Creative Career series",
    creativeCareerText: "The original mini-series from behind the scenes of advertising.",
    shipTitle: "Ship of Ideas",
    shipText: "Directed, edited and composed from start to finish.",
    instagramTitle: "Behind the scenes",
    instagramText: "Instagram link from the old site.",
    linkedinText: "Professional profile and network.",
    contactLabel: "Contact the newsroom",
    contactTitle: "Real news does not wait.",
    contactText: "Let's make history together.",
    videoLoaded: "The Video CV has loaded in the page's own player.",
    videoTryingNext: "The video source switched automatically to a backup source...",
    videoLoadError: "The video source failed to load. Refresh the preview and try again.",
    videoUnsupported: "This browser does not support direct playback of this video source.",
    videoPlaying: "Playing the Video CV in this page's own window.",
    videoNeedsPlay: "The video is ready. Press the player's play button to start playback.",
    videoLoading: "Loading the Video CV into this page's own window...",
    videoStopped: "Video stopped.",
    privacyNote:
      "Privacy note: With consent, this site collects lightweight analytics data to evaluate how the portfolio works. The data may include page section, event type, device category, browser, operating system, language, traffic source, time spent, connection type and clicks. Network operator is stored only if the browser provides it safely without an IP address; otherwise the value is not_available. The site does not collect names, email addresses, IP addresses or precise location in the analytics log. Data is stored in a private Google Sheet that is not public. The data is used only to evaluate the portfolio and job-search materials.",
    visitorConsentText:
      "GDPR notice: This site can send a lightweight analytics entry to Jani's private Google Sheet, such as page section, event type, device category, browser, operating system, language, traffic source, duration, connection type and clicks. Name, email, IP address, city and precise location are not stored. Network operator is stored only if the browser provides it safely without an IP address; otherwise the value is not_available. Do you accept lightweight analytics?",
    visitorConsentAccept: "Accept",
    visitorConsentDecline: "Deny",
  },
};

function getSavedLanguage() {
  try {
    return localStorage.getItem("futureMakerLanguage") || "fi";
  } catch {
    return "fi";
  }
}

function saveLanguage(language) {
  try {
    localStorage.setItem("futureMakerLanguage", language);
  } catch {
    // Local files can run in stricter browser modes; language still works for the session.
  }
}

function translate(key) {
  return translations[currentLanguage][key] || translations.fi[key] || "";
}

function applyLanguage(language) {
  currentLanguage = translations[language] ? language : "fi";
  document.documentElement.lang = currentLanguage;
  document.title = translate("pageTitle");

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", translate("metaDescription"));
  }

  textNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key && translate(key)) {
      node.textContent = translate(key);
    }
  });

  htmlNodes.forEach((node) => {
    const key = node.dataset.i18nHtml;
    if (key && translate(key)) {
      node.innerHTML = translate(key);
    }
  });

  languageButtons.forEach((button) => {
    const active = button.dataset.language === currentLanguage;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  saveLanguage(currentLanguage);
  updateClock();
  updateVisitorConsentBanner();
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString(currentLanguage === "en" ? "en-GB" : "fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
  clock.textContent = `${time} ONLINE`;
}

function setVisitorCounter() {
  const start = 1984;
  const today = new Date();
  const daySeed = Math.floor(today.getTime() / 86400000);
  visitorCount.textContent = String(start + (daySeed % 8000)).padStart(6, "0");
}

function getRetroClickTarget(target) {
  const element = target instanceof Element ? target : target && target.parentElement;

  if (!element) {
    return null;
  }

  return element.closest(
    "button, .button, .card-actions a, .link-stack a, .nav a, [role='button']"
  );
}

function startRetroClick(context) {
  const start = context.currentTime;
  const length = Math.max(1, Math.floor(context.sampleRate * 0.035));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < channel.length; index += 1) {
    const decay = 1 - index / channel.length;
    channel[index] = (Math.random() * 2 - 1) * decay * 0.45;
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  noise.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, start);
  filter.Q.setValueAtTime(4, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(0.05, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.035);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  noise.start(start);
  noise.stop(start + 0.04);

  const tone = context.createOscillator();
  const toneGain = context.createGain();

  tone.type = "square";
  tone.frequency.setValueAtTime(950, start);
  tone.frequency.exponentialRampToValueAtTime(260, start + 0.045);
  toneGain.gain.setValueAtTime(0.001, start);
  toneGain.gain.exponentialRampToValueAtTime(0.018, start + 0.003);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
  tone.connect(toneGain);
  toneGain.connect(context.destination);
  tone.start(start);
  tone.stop(start + 0.055);
}

function playRetroClick() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  if (!clickAudioContext) {
    clickAudioContext = new AudioContextConstructor();
  }

  if (clickAudioContext.state === "suspended") {
    clickAudioContext
      .resume()
      .then(() => startRetroClick(clickAudioContext))
      .catch(() => {});
    return;
  }

  startRetroClick(clickAudioContext);
}

function handleRetroClickPointer(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  const target = getRetroClickTarget(event.target);

  if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") {
    return;
  }

  playRetroClick();
}

function handleRetroClickKey(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = getRetroClickTarget(event.target);

  if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") {
    return;
  }

  playRetroClick();
}

function getVisitorConsent() {
  try {
    if (
      localStorage.getItem("futureMakerVisitorConsentScope") !==
      contentConfig.visitorData.consentScope
    ) {
      return null;
    }

    return localStorage.getItem("futureMakerVisitorConsent");
  } catch {
    return null;
  }
}

function saveVisitorConsent(value) {
  try {
    localStorage.setItem("futureMakerVisitorConsent", value);
    localStorage.setItem(
      "futureMakerVisitorConsentScope",
      contentConfig.visitorData.consentScope
    );
  } catch {
    // Consent storage is optional; analytics still never blocks the page.
  }
}

function getPageLocation() {
  try {
    return new URL(window.location.href);
  } catch {
    return null;
  }
}

function isPortfolioHealthcheck() {
  const locationUrl = getPageLocation();

  if (!locationUrl) {
    return false;
  }

  const value = locationUrl.searchParams.get("healthcheck");
  return value === "1" || value === "true";
}

function getSafePagePath() {
  const locationUrl = getPageLocation();
  if (!locationUrl) {
    return "/";
  }

  return `${locationUrl.pathname || "/"}${locationUrl.hash || ""}`;
}

function getSafePageHost() {
  const locationUrl = getPageLocation();
  return locationUrl ? locationUrl.hostname || "local-preview" : "";
}

function getSessionId() {
  if (analyticsSessionId) {
    return analyticsSessionId;
  }

  try {
    const stored = sessionStorage.getItem("futureMakerAnalyticsSessionId");

    if (stored) {
      analyticsSessionId = stored;
      return analyticsSessionId;
    }

    const randomPart =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

    analyticsSessionId = `session_${randomPart}`.slice(0, 80);
    sessionStorage.setItem("futureMakerAnalyticsSessionId", analyticsSessionId);
    return analyticsSessionId;
  } catch {
    analyticsSessionId = `session_${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    return analyticsSessionId;
  }
}

function sanitizeShortText(value, maxLength = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);

  if (!text) {
    return "";
  }

  if (/@/.test(text) || /\+?\d[\d\s-]{6,}/.test(text)) {
    return "redacted";
  }

  return text.replace(/[^\w\s\-./#åäöÅÄÖ]/g, "_");
}

function sanitizeUtm(value) {
  const text = String(value || "").trim().slice(0, 80);

  if (!text) {
    return "";
  }

  if (/@/.test(text) || /\+?\d[\d\s-]{6,}/.test(text)) {
    return "redacted";
  }

  return text.replace(/[^\w\-åäöÅÄÖ]/g, "_");
}

function getUtmParams() {
  const locationUrl = getPageLocation();
  const params = locationUrl ? locationUrl.searchParams : new URLSearchParams();

  return {
    utm_source: sanitizeUtm(params.get("utm_source")),
    utm_medium: sanitizeUtm(params.get("utm_medium")),
    utm_campaign: sanitizeUtm(params.get("utm_campaign")),
  };
}

function getReferrerType() {
  if (!document.referrer) {
    return "direct";
  }

  try {
    const referrerUrl = new URL(document.referrer);
    const referrerHost = referrerUrl.hostname.replace(/^www\./, "");
    const currentHost = getSafePageHost().replace(/^www\./, "");

    if (!referrerHost || referrerHost === currentHost) {
      return "internal";
    }

    if (referrerHost.includes("linkedin.")) {
      return "social";
    }

    if (referrerHost.includes("google.")) {
      return "search";
    }

    if (referrerHost.includes("youtube.") || referrerHost.includes("youtu.be")) {
      return "social";
    }

    if (referrerHost.includes("instagram.")) {
      return "social";
    }

    return "external";
  } catch {
    return "external";
  }
}

function getDeviceType() {
  const userAgent = navigator.userAgent || "";
  const isTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
  const width = window.innerWidth || 0;

  if (/Mobi|Android|iPhone|iPod/i.test(userAgent) && width < 760) {
    return "mobiili";
  }

  if (/iPad|Tablet/i.test(userAgent) || (isTouch && width >= 760 && width <= 1200)) {
    return "tabletti";
  }

  if (width || userAgent) {
    return "tietokone";
  }

  return "tuntematon";
}

function getBrowserFamily() {
  const userAgent = navigator.userAgent || "";

  if (/Edg\//i.test(userAgent)) {
    return "Edge";
  }

  if (/Firefox\//i.test(userAgent)) {
    return "Firefox";
  }

  if (/CriOS|Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) {
    return "Chrome";
  }

  if (/Safari\//i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg\//i.test(userAgent)) {
    return "Safari";
  }

  return "unknown";
}

function getOsFamily() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const source = `${userAgent} ${platform}`;

  if (/iPhone|iPad|iPod/i.test(source)) {
    return "iOS";
  }

  if (/Android/i.test(source)) {
    return "Android";
  }

  if (/Mac/i.test(source)) {
    return "macOS";
  }

  if (/Win/i.test(source)) {
    return "Windows";
  }

  if (/Linux/i.test(source)) {
    return "Linux";
  }

  return "unknown";
}

function getConnectionType() {
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection) {
    return "not_available";
  }

  return sanitizeShortText(connection.effectiveType || connection.type || "not_available", 40);
}

function getConnectionOperator() {
  return "not_available";
}

function roundToNearestFive(seconds) {
  const value = Number.isFinite(seconds) ? seconds : 0;
  return Math.max(0, Math.round(value / 5) * 5);
}

function getElapsedSeconds(startedAt) {
  return roundToNearestFive((Date.now() - startedAt) / 1000);
}

function updateScrollDepth() {
  const documentElement = document.documentElement;
  const body = document.body;
  const scrollTop = window.scrollY || documentElement.scrollTop || body.scrollTop || 0;
  const scrollHeight = Math.max(
    body.scrollHeight,
    documentElement.scrollHeight,
    body.offsetHeight,
    documentElement.offsetHeight
  );
  const viewportHeight = window.innerHeight || documentElement.clientHeight || 0;
  const availableScroll = Math.max(scrollHeight - viewportHeight, 1);
  const depth = Math.min(100, Math.max(0, Math.round((scrollTop / availableScroll) * 100)));

  maxScrollDepthPercent = Math.max(maxScrollDepthPercent, depth);
}

function getSafeButtonTarget(element) {
  if (element.dataset.buttonTarget) {
    return sanitizeShortText(element.dataset.buttonTarget, 80);
  }

  const href = element.getAttribute("href") || "";

  if (!href && element.matches("[data-video-trigger], [data-video-play]")) {
    return "video-cv";
  }

  if (href.startsWith("mailto:")) {
    return "email";
  }

  if (href.includes("/files/cv.pdf")) {
    return "/files/cv.pdf";
  }

  if (href.includes("/files/saatekirje.pdf")) {
    return "/files/saatekirje.pdf";
  }

  if (href.includes("/files/kasikirjoitus.pdf")) {
    return "/files/kasikirjoitus.pdf";
  }

  if (href.includes("/files/kayntikortti.pdf")) {
    return "/files/kayntikortti.pdf";
  }

  if (href.startsWith("#")) {
    return sanitizeShortText(`section-${href.slice(1)}`, 80);
  }

  try {
    const targetUrl = new URL(href, window.location.href);
    return sanitizeShortText(targetUrl.hostname.replace(/^www\./, ""), 80);
  } catch {
    return sanitizeShortText(href, 80);
  }
}

function getSafeButtonHref(element) {
  const href = element.getAttribute("href") || "";

  if (!href && element.matches("[data-video-trigger], [data-video-play]")) {
    return contentConfig.video.youtubeId
      ? `youtube.com/${contentConfig.video.youtubeId}`
      : "/files/video-cv.mp4";
  }

  if (href.startsWith("mailto:")) {
    return "email";
  }

  if (href.startsWith("#")) {
    return sanitizeShortText(href, 80);
  }

  try {
    const targetUrl = new URL(href, window.location.href);

    if (targetUrl.origin === window.location.origin) {
      return sanitizeShortText(targetUrl.pathname || "/", 120);
    }

    return sanitizeShortText(targetUrl.hostname.replace(/^www\./, ""), 120);
  } catch {
    return sanitizeShortText(href, 120);
  }
}

function getSafeButtonText(element) {
  if ((element.getAttribute("href") || "").startsWith("mailto:")) {
    return "email";
  }

  const text = element.textContent || "";

  if (/@/.test(text)) {
    return "email";
  }

  return sanitizeShortText(text, 80);
}

function getAnalyticsEventType(eventName) {
  if (eventName === "button_click" || eventName === "visit_end") {
    return eventName;
  }

  if (eventName === "video_cv_play") {
    return "button_click";
  }

  return "visit_start";
}

function isCvAnalyticsClick(details, eventName) {
  const value = `${details.buttonName || ""} ${details.buttonTarget || ""} ${eventName}`;
  return /cv_button|cv-current|\/files\/cv\.pdf|cv_clicked/i.test(value);
}

function isCoverLetterAnalyticsClick(details) {
  const value = `${details.buttonName || ""} ${details.buttonTarget || ""}`;
  return /cover_letter|saate/i.test(value);
}

function isVideoCvAnalyticsClick(details, eventName) {
  const value = `${details.buttonName || ""} ${details.buttonTarget || ""} ${eventName}`;
  return /video_cv|video-cv/i.test(value);
}

function createVisitorPayload(details = {}) {
  const eventName = getAnalyticsEventType(details.eventName || "visit_start");
  const includeDuration = details.includeDuration || eventName === "visit_end";
  const referrerType = getReferrerType();
  const buttonName = sanitizeShortText(details.buttonName || "", 60);
  const buttonHref = sanitizeShortText(details.buttonHref || details.buttonTarget || "", 120);
  const durationSeconds = includeDuration ? getElapsedSeconds(visitStartedAt) : "";

  return {
    timestamp: new Date().toISOString(),
    event_type: eventName,
    session_id: getSessionId(),
    page_host: getSafePageHost(),
    page_path: getSafePagePath(),
    site_id: contentConfig.visitorData.siteId,
    source: "future-maker-cloudflare",
    device_type: getDeviceType(),
    browser: getBrowserFamily(),
    os: getOsFamily(),
    language: currentLanguage,
    referrer_type: referrerType,
    button_label: buttonName,
    button_href: buttonHref,
    visit_duration_seconds: durationSeconds,
    engagement_seconds: durationSeconds,
    scroll_depth_percent: eventName === "visit_end" ? maxScrollDepthPercent : "",
    connection_type: getConnectionType(),
    connection_operator: getConnectionOperator(),
  };
}

function canUseVisitorData() {
  const config = contentConfig.visitorData;

  if (!config || config.enabled === false || !config.endpoint) {
    return false;
  }

  if (isPortfolioHealthcheck()) {
    return false;
  }

  if (config.ignoreLocalPreview !== false && window.location.protocol === "file:") {
    return false;
  }

  return true;
}

async function sendVisitorData(details = {}, options = {}) {
  if (!canUseVisitorData()) {
    return;
  }

  if (
    contentConfig.visitorData.requireConsent !== false &&
    getVisitorConsent() !== "accepted"
  ) {
    return;
  }

  updateScrollDepth();

  const config = contentConfig.visitorData;

  const body = JSON.stringify(createVisitorPayload(details));
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });

  if (options.beacon && navigator.sendBeacon && navigator.sendBeacon(config.endpoint, blob)) {
    return;
  }

  fetch(config.endpoint, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body,
  }).catch(() => {
    // Analytics must never break the page.
  });
}

function trackButtonClick(event) {
  const element = event.currentTarget;
  clickCount += 1;

  sendVisitorData(
    {
      eventName: "button_click",
      eventCategory: element.dataset.category || "navigation",
      buttonName: element.dataset.buttonName || getSafeButtonText(element) || "button",
      buttonTarget: getSafeButtonTarget(element),
      buttonHref: getSafeButtonHref(element),
      buttonText: getSafeButtonText(element),
    },
    { beacon: true }
  );
}

function trackVideoEvent(videoEvent, progressPercent = "") {
  if (videoEvent !== "play") {
    return;
  }

  sendVisitorData({
    eventName: "button_click",
    eventCategory: "video",
    buttonName: "video_cv_play",
    buttonTarget: "video-cv",
    buttonHref: contentConfig.video.youtubeId
      ? `youtube.com/${contentConfig.video.youtubeId}`
      : "/files/video-cv.mp4",
    buttonText: "Video CV",
    videoEvent,
    videoProgressPercent: progressPercent,
  });
}

function trackVideoProgress() {
  if (!videoCv || !videoCv.duration || !Number.isFinite(videoCv.duration)) {
    return;
  }

  const progress = Math.round((videoCv.currentTime / videoCv.duration) * 100);
  [25, 50, 75, 100].forEach((mark) => {
    if (progress >= mark && !videoProgressMarks.has(mark)) {
      videoProgressMarks.add(mark);
      trackVideoEvent("progress", mark);
    }
  });
}

function trackVisitEnd() {
  if (visitEndSent) {
    return;
  }

  visitEndSent = true;
  sendVisitorData(
    {
      eventName: "visit_end",
      eventCategory: "engagement",
      includeDuration: true,
    },
    { beacon: true }
  );
}

function updateVisitorConsentBanner() {
  const banner = document.querySelector("[data-visitor-consent]");

  if (!banner) {
    return;
  }

  const text = banner.querySelector("[data-visitor-consent-text]");
  const accept = banner.querySelector("[data-visitor-consent-accept]");
  const decline = banner.querySelector("[data-visitor-consent-decline]");

  if (text) {
    text.textContent = translate("visitorConsentText");
  }

  if (accept) {
    accept.textContent = translate("visitorConsentAccept");
  }

  if (decline) {
    decline.textContent = translate("visitorConsentDecline");
  }
}

function removeVisitorConsentBanner() {
  const banner = document.querySelector("[data-visitor-consent]");

  if (banner) {
    banner.remove();
  }
}

function showVisitorConsentBanner() {
  if (document.querySelector("[data-visitor-consent]")) {
    updateVisitorConsentBanner();
    return;
  }

  const banner = document.createElement("section");
  banner.className = "visitor-consent";
  banner.dataset.visitorConsent = "true";
  banner.setAttribute("aria-live", "polite");

  const text = document.createElement("p");
  text.dataset.visitorConsentText = "true";

  const actions = document.createElement("div");
  actions.className = "visitor-consent-actions";

  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "visitor-consent-button primary";
  accept.dataset.visitorConsentAccept = "true";
  accept.addEventListener("click", () => {
    saveVisitorConsent("accepted");
    removeVisitorConsentBanner();
    sendVisitorData();
  });

  const decline = document.createElement("button");
  decline.type = "button";
  decline.className = "visitor-consent-button";
  decline.dataset.visitorConsentDecline = "true";
  decline.addEventListener("click", () => {
    saveVisitorConsent("declined");
    removeVisitorConsentBanner();
  });

  actions.append(accept, decline);
  banner.append(text, actions);
  document.body.append(banner);
  updateVisitorConsentBanner();
}

function initVisitorData() {
  if (!canUseVisitorData()) {
    return;
  }

  if (contentConfig.visitorData.requireConsent === false) {
    sendVisitorData();
    return;
  }

  const consent = getVisitorConsent();

  if (consent === "accepted") {
    sendVisitorData();
    return;
  }

  if (consent === "declined") {
    return;
  }

  showVisitorConsentBanner();
}

function setVideoStatus(messageKey) {
  if (videoStatus) {
    videoStatus.textContent = translate(messageKey) || messageKey;
  }
}

function applyContentConfig() {
  documentLinks.forEach((link) => {
    const key = link.dataset.documentLink;
    if (key && contentConfig.documents[key]) {
      link.href = contentConfig.documents[key];
    }
  });

  posterElements.forEach((element) => {
    if (!contentConfig.video.poster) {
      return;
    }

    if (element.tagName.toLowerCase() === "video") {
      element.poster = contentConfig.video.poster;
    } else {
      element.src = contentConfig.video.poster;
    }
  });
}

function isHlsSource(source) {
  return source.includes(".m3u8");
}

function getVideoSources() {
  const sources = Array.isArray(contentConfig.video.sources)
    ? contentConfig.video.sources
    : [];

  return [...new Set([...sources, contentConfig.video.source].filter(Boolean))];
}

function destroyHlsPlayer() {
  window.clearTimeout(videoLoadTimer);

  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }
}

function showVideoPlayButton(shouldShow) {
  if (videoPlayButton) {
    videoPlayButton.hidden = true;
  }
}

function getYoutubeEmbedUrl(autoplay = false) {
  if (!contentConfig.video.youtubeId) {
    return "";
  }

  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  if (window.location.origin && window.location.origin !== "null") {
    params.set("origin", window.location.origin);
  }

  if (autoplay) {
    params.set("autoplay", "1");
  }

  return `https://www.youtube.com/embed/${contentConfig.video.youtubeId}?${params.toString()}`;
}

function hasYoutubeVideo() {
  return Boolean(videoFrame && contentConfig.video.youtubeId);
}

function showYoutubeVideo(autoplay = false) {
  if (!hasYoutubeVideo()) {
    return false;
  }

  destroyHlsPlayer();

  if (videoCv) {
    videoCv.pause();
    videoCv.hidden = true;
  }

  videoFrame.hidden = false;
  videoFrame.src = getYoutubeEmbedUrl(autoplay);
  videoReady = true;
  setVideoStatus(autoplay ? "videoPlaying" : "videoReady");
  showVideoPlayButton(false);
  return true;
}

function stopYoutubeVideo() {
  if (!videoFrame) {
    return;
  }

  videoFrame.src = getYoutubeEmbedUrl(false);
}

function markVideoReady() {
  window.clearTimeout(videoLoadTimer);
  videoReady = true;
  videoSourceErrorHandled = false;
  setVideoStatus("videoLoaded");
  showVideoPlayButton(false);
  attemptVideoPlayback();
}

function loadVideoSource(index) {
  if (!videoCv) {
    return;
  }

  const sources = getVideoSources();

  if (!sources.length || index >= sources.length) {
    setVideoStatus("videoLoadError");
    showVideoPlayButton(false);
    return;
  }

  const videoSource = sources[index];
  currentVideoSourceIndex = index;
  pendingVideoSource = videoSource;
  videoReady = false;
  videoSourceErrorHandled = false;
  destroyHlsPlayer();
  videoCv.pause();
  videoCv.removeAttribute("src");
  videoCv.load();
  videoLoadTimer = window.setTimeout(() => {
    if (pendingVideoSource === videoSource && !videoReady) {
      tryNextVideoSource();
    }
  }, 4500);

  if (!isHlsSource(videoSource)) {
    videoCv.src = videoSource;
    videoCv.load();
    videoCv.addEventListener(
      "loadedmetadata",
      () => {
        if (pendingVideoSource === videoSource) {
          markVideoReady();
        }
      },
      { once: true }
    );
    return;
  }

  if (videoCv.canPlayType("application/vnd.apple.mpegurl")) {
    videoCv.src = videoSource;
    videoCv.load();
    markVideoReady();
    return;
  }

  if (window.Hls && window.Hls.isSupported()) {
    hlsPlayer = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false,
    });
    hlsPlayer.loadSource(videoSource);
    hlsPlayer.attachMedia(videoCv);
    hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, markVideoReady);
    hlsPlayer.on(window.Hls.Events.ERROR, (event, data) => {
      if (data && data.fatal) {
        tryNextVideoSource();
      }
    });
    return;
  }

  tryNextVideoSource();
}

function tryNextVideoSource() {
  if (videoSourceErrorHandled) {
    return;
  }

  videoSourceErrorHandled = true;
  const nextIndex = currentVideoSourceIndex + 1;

  if (nextIndex < getVideoSources().length) {
    setVideoStatus("videoTryingNext");
    loadVideoSource(nextIndex);
    return;
  }

  setVideoStatus("videoLoadError");
  showVideoPlayButton(false);
}

function prepareVideo() {
  if (hasYoutubeVideo()) {
    showYoutubeVideo(false);
    return;
  }

  if (!videoCv || videoReady) {
    return;
  }
  loadVideoSource(currentVideoSourceIndex);
}

async function attemptVideoPlayback() {
  if (!videoCv || !autoplayRequested) {
    return;
  }

  showVideoPlayButton(false);

  try {
    videoCv.muted = false;
    await videoCv.play();
    setVideoStatus("videoPlaying");
  } catch {
    try {
      videoCv.muted = true;
      await videoCv.play();
      setVideoStatus("videoPlaying");
    } catch {
      setVideoStatus("videoNeedsPlay");
      showVideoPlayButton(false);
    }
  }
}

function playVideoFromButton() {
  autoplayRequested = true;

  if (showYoutubeVideo(true)) {
    if (!videoPlayTracked) {
      videoPlayTracked = true;
      trackVideoEvent("play");
    }
    return;
  }

  if (!videoReady) {
    setVideoStatus("videoLoading");
    showVideoPlayButton(false);
    prepareVideo();
    return;
  }

  attemptVideoPlayback();
}

function openVideoPlayer() {
  if (!videoPlayer || (!videoCv && !videoFrame)) {
    return;
  }

  videoPlayer.hidden = false;
  autoplayRequested = true;
  setVideoStatus("videoLoading");
  showVideoPlayButton(false);

  if (showYoutubeVideo(true)) {
    if (!videoPlayTracked) {
      videoPlayTracked = true;
      trackVideoEvent("play");
    }
    videoPlayer.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  prepareVideo();
  videoPlayer.scrollIntoView({ behavior: "smooth", block: "center" });
  attemptVideoPlayback();
}

function closeVideoPlayer() {
  if (!videoPlayer || (!videoCv && !videoFrame)) {
    return;
  }

  if (videoCv) {
    videoCv.pause();
  }
  stopYoutubeVideo();
  autoplayRequested = false;
  showVideoPlayButton(false);
  videoPlayer.hidden = true;
  setVideoStatus("videoStopped");
}

applyLanguage(getSavedLanguage());
applyContentConfig();
setVisitorCounter();

if (videoCv) {
  videoCv.addEventListener("error", tryNextVideoSource);
  videoCv.addEventListener("play", () => {
    showVideoPlayButton(false);

    if (!videoPlayTracked) {
      videoPlayTracked = true;
      trackVideoEvent("play");
    }
  });
  videoCv.addEventListener("timeupdate", trackVideoProgress);
  videoCv.addEventListener("pause", () => {
    if (!videoCv.ended && videoPlayer && !videoPlayer.hidden) {
      showVideoPlayButton(false);
    }
  });
  videoCv.addEventListener("ended", () => {
    autoplayRequested = false;
    showVideoPlayButton(false);
    setVideoStatus("videoReady");
  });
}

prepareVideo();
initVisitorData();
window.setInterval(updateClock, 30000);

document.addEventListener("pointerdown", handleRetroClickPointer, { passive: true });
document.addEventListener("keydown", handleRetroClickKey);
window.addEventListener("scroll", updateScrollDepth, { passive: true });
window.addEventListener("pagehide", trackVisitEnd);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    trackVisitEnd();
  }
});

videoTriggers.forEach((trigger) => {
  trigger.addEventListener("click", openVideoPlayer);
});

document.querySelectorAll('[data-track="button_click"]').forEach((element) => {
  element.addEventListener("click", trackButtonClick);
});

if (videoClose) {
  videoClose.addEventListener("click", closeVideoPlayer);
}

if (videoPlayButton) {
  videoPlayButton.addEventListener("click", playVideoFromButton);
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyLanguage(button.dataset.language);
  });
});
