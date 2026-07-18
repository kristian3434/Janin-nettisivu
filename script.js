const clock = document.querySelector("#clock");
const visitorCount = document.querySelector("#visitor-count");
const videoCv = document.querySelector("#video-cv");
const videoFrame = document.querySelector("#video-cv-youtube");
const videoPlayer = document.querySelector("#video-cv-player");
const videoStatus = document.querySelector("#video-status");
const videoTriggers = document.querySelectorAll("[data-video-trigger]");
const videoClose = document.querySelector(".video-close");
const videoPlayButton = document.querySelector("[data-video-play]");
const videoLoadButton = document.querySelector("[data-video-load]");
const videoConsentPlaceholder = document.querySelector("[data-video-consent-placeholder]");
const languageButtons = document.querySelectorAll("[data-language]");
const textNodes = document.querySelectorAll("[data-i18n]");
const htmlNodes = document.querySelectorAll("[data-i18n-html]");
const altNodes = document.querySelectorAll("[data-i18n-alt]");
const ariaNodes = document.querySelectorAll("[data-i18n-aria]");
const titleNodes = document.querySelectorAll("[data-i18n-title]");
const documentLinks = document.querySelectorAll("[data-document-link]");
const posterElements = document.querySelectorAll("[data-content-poster]");
const portfolioRoleButtons = document.querySelectorAll("[data-role-button]");
const portfolioRolePanels = document.querySelectorAll("[data-role-panel]");
const portfolioRoleAnnouncer = document.querySelector("[data-role-announcer]");

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
    source: "https://www.youtube-nocookie.com/embed/WtUr1wuRRBU?rel=0&modestbranding=1&playsinline=1",
    sources: [],
  },
  visitorData: {
    enabled: true,
    endpoint: "https://script.google.com/macros/s/AKfycbyjES-pzC5uuWF84jx4_AHafMKoGMP55JVPF5DKuvbL6owZWj6Vowe_yib4viQWGqHbpw/exec",
    siteId: "future-maker-cloudflare",
    consentScope: "visitor-data-minimal-private-sheet-consent-v8",
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
let visitorConsentReturnFocus = null;
let currentPortfolioRole = "unselected";
const videoProgressMarks = new Set();
const portfolioRoles = new Set([
  "creative-design",
  "digital-marketing",
  "ai-solutions",
  "all",
]);
const portfolioRoleAnalyticsNames = {
  "creative-design": "portfolio_role_creative_design",
  "digital-marketing": "portfolio_role_digital_marketing",
  "ai-solutions": "portfolio_role_ai_solutions",
  all: "portfolio_role_all",
};

const translations = {
  fi: {
    pageTitle: "Future Maker 2000 | Jani Myllymäki",
    metaDescription:
      "Jani Myllymäki - tulevaisuuden tekijä. Retrohenkinen kampanjasivusto dokumenteille, videoille ja yhteydenotolle.",
    skipLink: "Siirry sisältöön",
    siteHeaderAria: "Sivuston ylätunniste",
    mastheadAria: "Lehden nimi",
    mainNavAria: "Päävalikko",
    tickerAria: "Pääuutinen",
    newsStripAria: "Nopea kooste",
    videoCloseAria: "Sulje videosoitin",
    videoOpenAria: "Avaa Video-CV: Luovuus sydämessä",
    videoIframeTitle: "Video-CV: Luovuus sydämessä",
    linkedinAria: "Avaa Jani Myllymäen LinkedIn-profiili",
    privacyActionsAria: "Tietosuoja-asetukset",
    extraHeaderAria: "Extra-sivun ylätunniste",
    extraNavAria: "Extra-sivun valikko",
    extraReturnAria: "Paluulinkki",
    edition: "Numero 001 / Luova työnhaku",
    tagline: "Riippumaton uutishuone yhdelle rohkealle uratarinalle",
    navNews: "Pääotsikko",
    navCampaign: "Kampanja",
    navArchive: "Asiakirjat",
    navMedia: "Linkit",
    navContact: "Yhteys",
    navExtra: "Extra! – Näin portfolio rakennettiin",
    roleEditionLabel: "Rekrytoijan erikoisnumero",
    roleIdentityTitle: "Monialainen digitaalinen suunnittelija",
    roleIdentityDescription:
      "Yhdistän visuaalisen suunnittelun, sisällöntuotannon ja AI-avusteisen toteutuksen toimiviksi digitaalisiksi kokonaisuuksiksi.",
    roleEditionInstructions:
      "Mitä osaamistani haluat tarkastella? Valitse tehtävää lähinnä oleva näkökulma tai avaa koko portfolio.",
    roleUnselectedIntro:
      "Valitse näkökulma, niin nostan esiin kolme tehtävään sopivaa työnäytettä ja keskeiset taitoni.",
    roleSelectedPerspective: "Valittu näkökulma",
    roleCreativeName: "Luova digitaalinen suunnittelija",
    roleMarketingName: "Digimarkkinointi ja sisällöntuotanto",
    roleAiName: "AI-avusteiset digitaaliset ratkaisut",
    roleAllName: "Näytä koko portfolio",
    roleCreativeIntro:
      "Yhdistän visuaalisen suunnittelun, tarinankerronnan ja digitaalisen toteutuksen yhtenäisiksi konsepteiksi.",
    roleMarketingIntro:
      "Rakennan sisältöjä ja digitaalisia kokonaisuuksia, joissa tarina, kohderyhmä ja mitattavuus tukevat samaa tavoitetta.",
    roleAiIntro:
      "Suunnittelen käytännönläheisiä digitaalisia ratkaisuja, joissa tekoäly, automaatio, analytiikka ja käyttöliittymä muodostavat toimivan kokonaisuuden.",
    roleAllProfileTitle: "Koko portfolio",
    roleAllIntro:
      "Näet kaikki työnäytteet, videot, dokumentit ja tekniset ratkaisut yhtenä kokonaisuutena. Portfolio jatkuu heti tämän valitsimen jälkeen.",
    roleAllContinue: "Siirry koko portfolioon",
    roleRecommendationsTitle: "Kolme suositeltua työnäytettä",
    roleSkillsTitle: "Keskeiset taidot",
    roleCreativeCampaignTitle: "Visuaalinen työnhakukampanja",
    roleCreativeCampaignText:
      "Yhtenäinen kampanjailme kokoaa CV:n, saatekirjeen ja printin samaksi tarinaksi.",
    roleCreativeVideoTitle: "Video-CV",
    roleCreativeVideoText:
      "Uutislähetyksen muoto yhdistää käsikirjoituksen, visuaalisen kerronnan ja editoinnin.",
    roleCreativePortfolioTitle: "Future Maker -portfolio",
    roleCreativePortfolioText:
      "Sanomalehtimäinen verkkokonsepti näyttää typografian, sisältöhierarkian ja digitaalisen toteutuksen.",
    roleMarketingCampaignTitle: "Työnhakukampanja kokonaisuutena",
    roleMarketingCampaignText:
      "Henkilöbrändi, verkkosivu, videot ja painotuotteet muodostavat yhden asiakaspolun.",
    roleMarketingLinkedinTitle: "LinkedIn- ja sisältökonseptit",
    roleMarketingLinkedinText:
      "Ammatilliset sisällöt jatkavat kampanjan tarinaa kanavasta toiseen.",
    roleMarketingAnalyticsTitle: "Portfolion analytiikka ja käyttäjäpolut",
    roleMarketingAnalyticsText:
      "Suostumukseen perustuva mittaus tukee sisältöjen ja kävijäpolkujen kehittämistä.",
    roleAiPortfolioTitle: "AI-avusteinen Future Maker -portfolio",
    roleAiPortfolioText:
      "Kevyt verkkototeutus yhdistää oman konseptin, käyttöliittymän ja AI-avusteisen kehitystyön.",
    roleAiAgentTitle: "Portfolion AI-agenttikerros",
    roleAiAgentText:
      "HTML-, JSON-LD- ja JSON-rakenne tekee sisällöstä koneellisesti ymmärrettävää.",
    roleAiPrivacyTitle: "Analytiikka-, automaatio- ja GDPR-ratkaisut",
    roleAiPrivacyText:
      "Suostumusohjattu analytiikka yhdistää kevyen automaation ja yksityisyyden suojan.",
    roleViewUpdated:
      "Näkymä päivitetty: {role}. Kolme suositeltua työnäytettä ja kuusi keskeistä taitoa näytetään.",
    roleViewUpdatedAll:
      "Koko portfolio valittu. Alkuperäinen portfolio alkaa roolivalitsimen jälkeen.",
    roleViewUpdatedUnselected:
      "Roolinäkymää ei ole vielä valittu. Koko portfolio on käytettävissä valitsimen alapuolella.",
    skillVisualDesign: "Visuaalinen suunnittelu",
    skillConceptDesign: "Konseptisuunnittelu",
    skillStorytelling: "Tarinankerronta",
    skillImageEditing: "Kuvankäsittely",
    skillVideoEditing: "Videoeditointi",
    skillTypography: "Typografia",
    skillContentStrategy: "Sisältöstrategia",
    skillDigitalMarketing: "Digimarkkinointi",
    skillPersonalBranding: "Henkilöbrändäys",
    skillCampaignPlanning: "Kampanjasuunnittelu",
    skillAnalytics: "Analytiikka",
    skillAiDevelopment: "AI-avusteinen kehitys",
    skillAutomation: "Automaatio",
    skillWebDevelopment: "Verkkokehitys",
    skillStructuredData: "Tiedon rakenteistaminen",
    skillUiDesign: "Käyttöliittymäsuunnittelu",
    extraPageTitle: "Extra! – Näin portfolio rakennettiin | Future Maker 2000",
    extraMetaDescription:
      "Extra-sivu kertoo lyhyesti, millä työkaluilla Jani Myllymäen portfolio on rakennettu.",
    extraEdition: "Numero 001B / Tuotannon lisänumero",
    extraTagline: "Työkalut, jäljet ja idean rakentuminen",
    extraCurrent: "Extra!",
    extraKicker: "Extra! // Toimituksen työpöydältä",
    extraTitle: "Extra! – Näin portfolio rakennettiin",
    extraIngress:
      "Tämä portfolio on rakennettu useilla visuaalisen suunnittelun, videotuotannon, tekoälyn, editoinnin ja julkaisun työkaluilla. Tämä sivu avaa lyhyesti, millä eri osat on toteutettu.",
    extraBackTop: "Takaisin pääsivulle",
    extraLedgerLabel: "Tuotantoloki",
    extraLedgerTitle: "Kahdeksan nostoa työkalujäljestä",
    extraCvType: "01 / CV",
    extraCvTitle: "CV",
    extraCvTools: "<strong>Työkalut:</strong> <span>Canva</span>",
    extraCvShows:
      "<strong>Mitä tämä näyttää:</strong> Visuaalinen taitto, konseptointi ja sanomalehtimäinen työnhaku.",
    extraCoverType: "02 / Saate",
    extraCoverTitle: "Saatekirje",
    extraCoverTools: "<strong>Työkalut:</strong> <span>Canva</span>",
    extraCoverShows:
      "<strong>Mitä tämä näyttää:</strong> Kirjoittaminen, argumentointi ja visuaalinen viimeistely.",
    extraShipType: "03 / Video",
    extraShipTitle: "Ideoiden laiva",
    extraShipTools: "<strong>Työkalut:</strong> <span>Final Cut Pro + Logic Pro</span>",
    extraShipShows:
      "<strong>Mitä tämä näyttää:</strong> Videoleikkaus, Logic Pro -musiikin sävellys ja tarinallinen editointi.",
    extraVideoCvType: "04 / Video-CV",
    extraVideoCvTitle: "Video-CV",
    extraVideoCvTools: "<strong>Työkalut:</strong> <span>Widnoz + CapCut</span>",
    extraVideoCvShows:
      "<strong>Mitä tämä näyttää:</strong> AI-videotuotanto, editointi ja uutiskonseptin rakentaminen.",
    extraSeriesType: "05 / Sarja",
    extraSeriesTitle: "Luova ura -sarja",
    extraSeriesTools: "<strong>Työkalut:</strong> <span>HeyGen + CapCut</span>",
    extraSeriesShows:
      "<strong>Mitä tämä näyttää:</strong> AI-avatarin hyödyntäminen, videosarjan rakentaminen ja viimeistely.",
    extraInstagramType: "06 / Some",
    extraInstagramTitle: "Instagram",
    extraInstagramTools: "<strong>Työkalut:</strong> <span>Photoshop + CapCut</span>",
    extraInstagramShows:
      "<strong>Mitä tämä näyttää:</strong> Valokuvat, lyhytvideot, visuaalinen tyyli ja sisällöntuotanto.",
    extraBusinessCardType: "07 / Printti",
    extraBusinessCardTitle: "Käyntikortti",
    extraBusinessCardTools:
      "<strong>Työkalut:</strong> <span>Nano Banana + Affinity Publisher</span>",
    extraBusinessCardShows:
      "<strong>Mitä tämä näyttää:</strong> Generatiivinen kuva, printtisuunnittelu, QR-ajattelu sekä paperisen maailman ja digitaalisen jatkumon yhdistäminen.",
    extraLinkedinType: "08 / Verkosto",
    extraLinkedinTitle: "LinkedIn",
    extraLinkedinTools: "<strong>Työkalut:</strong> <span>AI + vibe coding</span>",
    extraLinkedinShows:
      "<strong>Mitä tämä näyttää:</strong> Ajattelun dokumentointi, työnhaun rakentaminen ja AI-avusteinen tekeminen.",
    extraFooterNote: "Lisänumero päättyy tähän. Varsinainen etusivu jatkaa kampanjaa.",
    extraBackBottom: "Palaa pääsivulle",
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
    profileImageAlt: "Piirretty muotokuva Jani Myllymäestä punaisessa takissa",
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
      "Photoshop, Final Cut Pro, Lightroom, Logic Pro, Canva, Widnoz, Cloudflare, CapCut sekä tekoäly- ja agenttityökalut",
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
    videoPosterAlt: "Video-CV:n esikatselukuva: uutisankkuri studiolähetyksessä",
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
    privacyBriefLabel: "Toimituksen tietosuoja",
    privacyBriefTitle: "Sinä päätät datastasi.",
    privacyNoticeButton: "Tietosuojaseloste",
    privacySettingsButton: "Asetukset",
    videoLoaded: "Video CV on ladattu sivun omaan soittimeen.",
    videoTryingNext: "Videolähde vaihtui automaattisesti varalähteeseen...",
    videoLoadError: "Videolähteen lataus epäonnistui. Päivitä esikatselu ja yritä uudelleen.",
    videoUnsupported: "Tämä selain ei tue tämän videolähteen toistoa suoraan sivulla.",
    videoNeedsConsent:
      "YouTube-video ei ole vielä latautunut. Voit hyväksyä kolmannen osapuolen sisällön tai ladata videon erikseen painikkeesta.",
    videoPlaying: "Toistetaan Video CV:tä tässä sivun omassa ikkunassa.",
    videoNeedsPlay: "Video on valmiina. Paina soittimen play-painiketta käynnistääksesi toiston.",
    videoLoading: "Ladataan Video CV:tä tähän sivun omaan ikkunaan...",
    videoStopped: "Video pysäytetty.",
    videoConsentText:
      "Tämä video on upotettu YouTubesta. Video latautuu vasta, jos hyväksyt kolmannen osapuolen sisällön tai avaat videon erikseen.",
    videoLoadButton: "Lataa video",
    privacyNote:
      "Sivusto kerää vain suostumuksellasi rajattua käyttödataa portfolion kehittämiseen. Nimeä, sähköpostia, IP-osoitetta tai tarkkaa sijaintia ei tallenneta. Sivusto toimii myös ilman analytiikkaa.",
    visitorConsentTitle: "Evästeet ja kolmannen osapuolen sisältö",
    visitorConsentText:
      "Sivusto voi hyväksynnällä kerätä rajattua kävijädataa sivuston kehittämistä varten, kuten sivun osion, tapahtumatyypin, laitetyypin, selaimen, käyttöjärjestelmän, kielen, liikenteen lähteen, viipymän ja klikkaukset. Nimeä, sähköpostia, IP-osoitetta, kaupunkia tai tarkkaa sijaintia ei tallenneta. Voit hyväksyä analytiikan, sallia vain välttämättömät toiminnot tai hylätä valinnaiset evästeet. YouTube-video latautuu vasta hyväksynnän jälkeen tai jos lataat videon erikseen painikkeesta.",
    visitorConsentAccept: "Hyväksy",
    visitorConsentNecessary: "Salli välttämättömät evästeet",
    visitorConsentDecline: "Hylkää",
    visitorConsentPrivacy: "Lue tietosuojaseloste",
    visitorConsentKicker: "Toimituksen tiedote // Tietosuoja",
    visitorConsentStatus: "Valinta tarvitaan",
    visitorConsentFootnote: "Sivusto toimii myös ilman analytiikkaa.",
  },
  en: {
    pageTitle: "Future Maker 2000 | Jani Myllymäki",
    metaDescription:
      "Jani Myllymäki - future maker. A retro campaign site for documents, videos and contact.",
    skipLink: "Skip to content",
    siteHeaderAria: "Site header",
    mastheadAria: "Newspaper name",
    mainNavAria: "Main navigation",
    tickerAria: "Main story",
    newsStripAria: "Quick summary",
    videoCloseAria: "Close video player",
    videoOpenAria: "Open Video CV: Creativity at Heart",
    videoIframeTitle: "Video CV: Creativity at Heart",
    linkedinAria: "Open Jani Myllymäki's LinkedIn profile",
    privacyActionsAria: "Privacy settings",
    extraHeaderAria: "Extra page header",
    extraNavAria: "Extra page navigation",
    extraReturnAria: "Return link",
    edition: "Issue 001 / Creative job search",
    tagline: "An independent newsroom for one bold career story",
    navNews: "Headline",
    navCampaign: "Campaign",
    navArchive: "Documents",
    navMedia: "Links",
    navContact: "Contact",
    navExtra: "Extra! – How this portfolio was built",
    roleEditionLabel: "Recruiter special edition",
    roleIdentityTitle: "Multidisciplinary Digital Designer",
    roleIdentityDescription:
      "I combine visual design, content production and AI-assisted implementation into coherent digital solutions.",
    roleEditionInstructions:
      "Which part of my expertise would you like to explore? Choose the perspective closest to the role or open the full portfolio.",
    roleUnselectedIntro:
      "Choose a perspective to see three relevant work samples and the key skills connected to the role.",
    roleSelectedPerspective: "Selected perspective",
    roleCreativeName: "Creative Digital Designer",
    roleMarketingName: "Digital Marketing and Content",
    roleAiName: "AI-Assisted Digital Solutions",
    roleAllName: "View Full Portfolio",
    roleCreativeIntro:
      "I combine visual design, storytelling and digital execution into coherent concepts.",
    roleMarketingIntro:
      "I build content and digital experiences in which story, audience and measurability support the same goal.",
    roleAiIntro:
      "I design practical digital solutions in which AI, automation, analytics and the interface form a working whole.",
    roleAllProfileTitle: "Full portfolio",
    roleAllIntro:
      "Explore all work samples, videos, documents and technical solutions as one complete portfolio. The full portfolio continues directly below this selector.",
    roleAllContinue: "Continue to the full portfolio",
    roleRecommendationsTitle: "Three recommended work samples",
    roleSkillsTitle: "Key skills",
    roleCreativeCampaignTitle: "Visual job-search campaign",
    roleCreativeCampaignText:
      "A consistent campaign identity brings the CV, cover letter and print materials into one story.",
    roleCreativeVideoTitle: "Video CV",
    roleCreativeVideoText:
      "A news-broadcast format combines scripting, visual storytelling and editing.",
    roleCreativePortfolioTitle: "Future Maker portfolio",
    roleCreativePortfolioText:
      "A newspaper-style web concept demonstrates typography, content hierarchy and digital execution.",
    roleMarketingCampaignTitle: "Job-search campaign as a whole",
    roleMarketingCampaignText:
      "The personal brand, website, videos and print materials form a single audience journey.",
    roleMarketingLinkedinTitle: "LinkedIn and content concepts",
    roleMarketingLinkedinText:
      "Professional content carries the campaign story from one channel to the next.",
    roleMarketingAnalyticsTitle: "Portfolio analytics and user journeys",
    roleMarketingAnalyticsText:
      "Consent-based measurement supports the development of content and visitor journeys.",
    roleAiPortfolioTitle: "AI-assisted Future Maker portfolio",
    roleAiPortfolioText:
      "A lightweight website combines my own concept, interface design and AI-assisted development.",
    roleAiAgentTitle: "Portfolio AI-agent layer",
    roleAiAgentText:
      "HTML, JSON-LD and JSON structures make the content machine-readable.",
    roleAiPrivacyTitle: "Analytics, automation and GDPR solutions",
    roleAiPrivacyText:
      "Consent-controlled analytics combine lightweight automation with privacy safeguards.",
    roleViewUpdated:
      "View updated: {role}. Three recommended work samples and six key skills are shown.",
    roleViewUpdatedAll:
      "Full portfolio selected. The original portfolio begins after the role selector.",
    roleViewUpdatedUnselected:
      "No role perspective has been selected. The full portfolio remains available below the selector.",
    skillVisualDesign: "Visual design",
    skillConceptDesign: "Concept design",
    skillStorytelling: "Storytelling",
    skillImageEditing: "Image editing",
    skillVideoEditing: "Video editing",
    skillTypography: "Typography",
    skillContentStrategy: "Content strategy",
    skillDigitalMarketing: "Digital marketing",
    skillPersonalBranding: "Personal branding",
    skillCampaignPlanning: "Campaign planning",
    skillAnalytics: "Analytics",
    skillAiDevelopment: "AI-assisted development",
    skillAutomation: "Automation",
    skillWebDevelopment: "Web development",
    skillStructuredData: "Structuring information",
    skillUiDesign: "Interface design",
    extraPageTitle: "Extra! – How this portfolio was built | Future Maker 2000",
    extraMetaDescription:
      "An Extra page explaining which tools were used to build Jani Myllymäki's portfolio.",
    extraEdition: "Issue 001B / Production extra",
    extraTagline: "Tools, traces and how the idea came together",
    extraCurrent: "Extra!",
    extraKicker: "Extra! // From the production desk",
    extraTitle: "Extra! – How this portfolio was built",
    extraIngress:
      "This portfolio was built with tools for visual design, video production, AI, editing and publishing. This page briefly opens up how the different parts were made.",
    extraBackTop: "Back to main page",
    extraLedgerLabel: "Production log",
    extraLedgerTitle: "Eight notes on the tool trail",
    extraCvType: "01 / CV",
    extraCvTitle: "CV",
    extraCvTools: "<strong>Tools:</strong> <span>Canva</span>",
    extraCvShows:
      "<strong>What this shows:</strong> Visual layout, concepting and a newspaper-style job search.",
    extraCoverType: "02 / Letter",
    extraCoverTitle: "Cover letter",
    extraCoverTools: "<strong>Tools:</strong> <span>Canva</span>",
    extraCoverShows:
      "<strong>What this shows:</strong> Writing, argumentation and visual finishing.",
    extraShipType: "03 / Video",
    extraShipTitle: "Ship of Ideas",
    extraShipTools: "<strong>Tools:</strong> <span>Final Cut Pro + Logic Pro</span>",
    extraShipShows:
      "<strong>What this shows:</strong> Video editing, Logic Pro music composition and story-led editing.",
    extraVideoCvType: "04 / Video CV",
    extraVideoCvTitle: "Video CV",
    extraVideoCvTools: "<strong>Tools:</strong> <span>Widnoz + CapCut</span>",
    extraVideoCvShows:
      "<strong>What this shows:</strong> AI video production, editing and building a news concept.",
    extraSeriesType: "05 / Series",
    extraSeriesTitle: "Creative Career series",
    extraSeriesTools: "<strong>Tools:</strong> <span>HeyGen + CapCut</span>",
    extraSeriesShows:
      "<strong>What this shows:</strong> Using an AI avatar, building a video series and finishing it.",
    extraInstagramType: "06 / Social",
    extraInstagramTitle: "Instagram",
    extraInstagramTools: "<strong>Tools:</strong> <span>Photoshop + CapCut</span>",
    extraInstagramShows:
      "<strong>What this shows:</strong> Photography, short videos, visual style and content creation.",
    extraBusinessCardType: "07 / Print",
    extraBusinessCardTitle: "Business card",
    extraBusinessCardTools:
      "<strong>Tools:</strong> <span>Nano Banana + Affinity Publisher</span>",
    extraBusinessCardShows:
      "<strong>What this shows:</strong> Generative image work, print design, QR thinking, and connecting the paper world with a digital continuation.",
    extraLinkedinType: "08 / Network",
    extraLinkedinTitle: "LinkedIn",
    extraLinkedinTools: "<strong>Tools:</strong> <span>AI + vibe coding</span>",
    extraLinkedinShows:
      "<strong>What this shows:</strong> Documenting thinking, building a job search and AI-assisted making.",
    extraFooterNote: "The extra issue ends here. The main front page continues the campaign.",
    extraBackBottom: "Return to main page",
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
    profileImageAlt: "Illustrated portrait of Jani Myllymäki wearing a red jacket",
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
      "Photoshop, Final Cut Pro, Lightroom, Logic Pro, Canva, Widnoz, Cloudflare, CapCut plus AI and agent tools",
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
    videoPosterAlt: "Video CV preview: a news anchor in a studio broadcast",
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
    privacyBriefLabel: "Newsroom privacy",
    privacyBriefTitle: "You decide about your data.",
    privacyNoticeButton: "Privacy notice",
    privacySettingsButton: "Settings",
    videoLoaded: "The Video CV has loaded in the page's own player.",
    videoTryingNext: "The video source switched automatically to a backup source...",
    videoLoadError: "The video source failed to load. Refresh the preview and try again.",
    videoUnsupported: "This browser does not support direct playback of this video source.",
    videoNeedsConsent:
      "The YouTube video has not loaded yet. You can accept third-party content or load the video separately with the button.",
    videoPlaying: "Playing the Video CV in this page's own window.",
    videoNeedsPlay: "The video is ready. Press the player's play button to start playback.",
    videoLoading: "Loading the Video CV into this page's own window...",
    videoStopped: "Video stopped.",
    videoConsentText:
      "This video is embedded from YouTube. It loads only after you accept third-party content or open the video separately.",
    videoLoadButton: "Load video",
    privacyNote:
      "With your consent, this site collects limited usage data to improve the portfolio. Names, email addresses, IP addresses and precise location are not stored. The site also works without analytics.",
    visitorConsentTitle: "Cookies and third-party content",
    visitorConsentText:
      "With your consent, this site can collect limited visitor data to improve the site, such as page section, event type, device type, browser, operating system, language, traffic source, duration and clicks. Name, email, IP address, city or precise location are not stored. You can accept analytics, allow only necessary functions or reject optional cookies. The YouTube video loads only after consent or if you load the video separately with the button.",
    visitorConsentAccept: "Accept",
    visitorConsentNecessary: "Allow necessary cookies",
    visitorConsentDecline: "Decline",
    visitorConsentPrivacy: "Read privacy notice",
    visitorConsentKicker: "Newsroom notice // Privacy",
    visitorConsentStatus: "Choice needed",
    visitorConsentFootnote: "The site also works without analytics.",
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
  const staticContent = document.body && document.body.dataset.staticContent === "true";
  const requestedLanguage = translations[language] ? language : "fi";
  currentLanguage =
    staticContent && translations[document.documentElement.lang]
      ? document.documentElement.lang
      : requestedLanguage;

  if (!staticContent) {
    document.documentElement.lang = currentLanguage;
    const titleKey = document.body.dataset.pageTitleKey || "pageTitle";
    document.title = translate(titleKey);

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      const descriptionKey = document.body.dataset.pageDescriptionKey || "metaDescription";
      metaDescription.setAttribute("content", translate(descriptionKey));
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

    altNodes.forEach((node) => {
      const key = node.dataset.i18nAlt;
      if (key && translate(key)) {
        node.setAttribute("alt", translate(key));
      }
    });

    ariaNodes.forEach((node) => {
      const key = node.dataset.i18nAria;
      if (key && translate(key)) {
        node.setAttribute("aria-label", translate(key));
      }
    });

    titleNodes.forEach((node) => {
      const key = node.dataset.i18nTitle;
      if (key && translate(key)) {
        node.setAttribute("title", translate(key));
      }
    });
  }

  languageButtons.forEach((button) => {
    const active = button.dataset.language === currentLanguage;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (!staticContent) {
    saveLanguage(currentLanguage);
  }
  updateClock();
  updateVisitorConsentBanner();
}

function getPortfolioRoleFromLocation() {
  const requestedRole = new URLSearchParams(window.location.search).get("role");
  return portfolioRoles.has(requestedRole) ? requestedRole : "unselected";
}

function getPortfolioRoleName(role) {
  const roleNameKeys = {
    "creative-design": "roleCreativeName",
    "digital-marketing": "roleMarketingName",
    "ai-solutions": "roleAiName",
    all: "roleAllProfileTitle",
  };

  return translate(roleNameKeys[role] || roleNameKeys.all);
}

function announcePortfolioRole(role) {
  if (!portfolioRoleAnnouncer) {
    return;
  }

  let message = translate("roleViewUpdatedUnselected");

  if (role === "all") {
    message = translate("roleViewUpdatedAll");
  } else if (portfolioRoles.has(role)) {
    message = translate("roleViewUpdated").replace("{role}", getPortfolioRoleName(role));
  }

  portfolioRoleAnnouncer.textContent = "";
  window.requestAnimationFrame(() => {
    portfolioRoleAnnouncer.textContent = message;
  });
}

function trackPortfolioRoleSelection(role) {
  if (!portfolioRoles.has(role)) {
    return;
  }

  sendVisitorData(
    {
      eventName: "portfolio_role_selected",
      eventCategory: "portfolio_role",
      buttonName: portfolioRoleAnalyticsNames[role],
      buttonTarget: `?role=${role}`,
    },
    { beacon: true }
  );
}

function updatePortfolioRoleUrl(role) {
  const nextUrl = new URL(window.location.href);

  if (role === "unselected") {
    nextUrl.searchParams.delete("role");
  } else {
    nextUrl.searchParams.set("role", role);
  }

  if (nextUrl.href === window.location.href) {
    return;
  }

  window.history.pushState({ portfolioRole: role }, "", nextUrl);
}

function applyPortfolioRole(role, options = {}) {
  const nextRole = portfolioRoles.has(role) ? role : "unselected";
  currentPortfolioRole = nextRole;
  document.documentElement.dataset.portfolioRole = nextRole;

  portfolioRoleButtons.forEach((button) => {
    const active = button.dataset.roleButton === nextRole;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  portfolioRolePanels.forEach((panel) => {
    const active = panel.dataset.rolePanel === nextRole;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  if (options.updateHistory) {
    updatePortfolioRoleUrl(nextRole);
  }

  if (options.track) {
    trackPortfolioRoleSelection(nextRole);
  }

  if (options.announce) {
    announcePortfolioRole(nextRole);
  }

  document.documentElement.classList.remove("role-pending");
}

function initPortfolioRoleView() {
  if (!portfolioRoleButtons.length || !portfolioRolePanels.length) {
    document.documentElement.classList.remove("role-pending");
    return;
  }

  const locationParams = new URLSearchParams(window.location.search);
  const requestedRole = locationParams.get("role");
  const initialRole = getPortfolioRoleFromLocation();

  if (locationParams.has("role") && !portfolioRoles.has(requestedRole)) {
    const normalizedUrl = new URL(window.location.href);
    normalizedUrl.searchParams.delete("role");
    window.history.replaceState({ portfolioRole: "unselected" }, "", normalizedUrl);
  }

  applyPortfolioRole(initialRole);
}

function updateClock() {
  if (!clock) {
    return;
  }

  const now = new Date();
  const time = now.toLocaleTimeString(currentLanguage === "en" ? "en-GB" : "fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
  clock.textContent = `${time} ONLINE`;
}

function setVisitorCounter() {
  if (!visitorCount) {
    return;
  }

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
  if (
    eventName === "button_click" ||
    eventName === "visit_end" ||
    eventName === "portfolio_role_selected"
  ) {
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

  const title = banner.querySelector("[data-visitor-consent-title]");
  const text = banner.querySelector("[data-visitor-consent-text]");
  const accept = banner.querySelector("[data-visitor-consent-accept]");
  const necessary = banner.querySelector("[data-visitor-consent-necessary]");
  const decline = banner.querySelector("[data-visitor-consent-decline]");
  const privacy = banner.querySelector("[data-visitor-consent-privacy]");
  const kicker = banner.querySelector("[data-visitor-consent-kicker]");
  const status = banner.querySelector("[data-visitor-consent-status]");
  const footnote = banner.querySelector("[data-visitor-consent-footnote]");

  if (kicker) {
    kicker.textContent = translate("visitorConsentKicker");
  }

  if (status) {
    status.textContent = translate("visitorConsentStatus");
  }

  if (title) {
    title.textContent = translate("visitorConsentTitle");
  }

  if (text) {
    text.textContent = translate("visitorConsentText");
  }

  if (accept) {
    accept.textContent = translate("visitorConsentAccept");
  }

  if (necessary) {
    necessary.textContent = translate("visitorConsentNecessary");
  }

  if (decline) {
    decline.textContent = translate("visitorConsentDecline");
  }

  if (privacy) {
    privacy.textContent = translate("visitorConsentPrivacy");
  }

  if (footnote) {
    footnote.textContent = translate("visitorConsentFootnote");
  }
}

function removeVisitorConsentBanner() {
  const banner = document.querySelector("[data-visitor-consent]");
  const returnFocus = visitorConsentReturnFocus;

  if (banner) {
    banner.remove();
  }

  document.removeEventListener("keydown", trapVisitorConsentFocus);
  document.body.classList.remove("visitor-consent-open");
  visitorConsentReturnFocus = null;

  if (returnFocus && typeof returnFocus.focus === "function") {
    returnFocus.focus({ preventScroll: true });
  }
}

function isFocusableElement(element) {
  return Boolean(
    element &&
      !element.disabled &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex >= 0 &&
      (element.offsetParent || element.getClientRects().length)
  );
}

function getVisitorConsentFocusableElements(banner) {
  return Array.from(
    banner.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(isFocusableElement);
}

function trapVisitorConsentFocus(event) {
  if (event.key !== "Tab") {
    return;
  }

  const banner = document.querySelector("[data-visitor-consent]");

  if (!banner) {
    return;
  }

  const focusableElements = getVisitorConsentFocusableElements(banner);

  if (!focusableElements.length) {
    event.preventDefault();
    banner.focus({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (!banner.contains(activeElement) || !focusableElements.includes(activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement).focus({ preventScroll: true });
    return;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus({ preventScroll: true });
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}

function showVisitorConsentBanner() {
  if (document.querySelector("[data-visitor-consent]")) {
    updateVisitorConsentBanner();
    return;
  }

  const banner = document.createElement("section");
  visitorConsentReturnFocus = document.activeElement;
  banner.className = "visitor-consent";
  banner.dataset.visitorConsent = "true";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-modal", "true");
  banner.setAttribute("aria-labelledby", "visitor-consent-title");
  banner.setAttribute("tabindex", "-1");

  const panel = document.createElement("div");
  panel.className = "visitor-consent-panel";

  const mast = document.createElement("div");
  mast.className = "visitor-consent-mast";

  const kicker = document.createElement("p");
  kicker.className = "visitor-consent-kicker";
  kicker.dataset.visitorConsentKicker = "true";

  const status = document.createElement("p");
  status.className = "visitor-consent-status";
  status.dataset.visitorConsentStatus = "true";
  mast.append(kicker, status);

  const content = document.createElement("div");
  content.className = "visitor-consent-content";

  const title = document.createElement("h2");
  title.id = "visitor-consent-title";
  title.dataset.visitorConsentTitle = "true";

  const text = document.createElement("p");
  text.dataset.visitorConsentText = "true";

  const actions = document.createElement("div");
  actions.className = "visitor-consent-actions";

  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "visitor-consent-button is-accept";
  accept.dataset.visitorConsentAccept = "true";
  accept.addEventListener("click", () => {
    saveVisitorConsent("accepted");
    removeVisitorConsentBanner();
    sendVisitorData();
  });

  const decline = document.createElement("button");
  decline.type = "button";
  decline.className = "visitor-consent-button is-decline";
  decline.dataset.visitorConsentDecline = "true";
  decline.addEventListener("click", () => {
    saveVisitorConsent("declined");
    removeVisitorConsentBanner();
  });

  const necessary = document.createElement("button");
  necessary.type = "button";
  necessary.className = "visitor-consent-button is-necessary";
  necessary.dataset.visitorConsentNecessary = "true";
  necessary.addEventListener("click", () => {
    saveVisitorConsent("necessary");
    removeVisitorConsentBanner();
  });

  const privacy = document.createElement("a");
  privacy.href = "privacy.html";
  privacy.className = "visitor-consent-privacy";
  privacy.dataset.visitorConsentPrivacy = "true";

  const footnote = document.createElement("p");
  footnote.className = "visitor-consent-footnote";
  footnote.dataset.visitorConsentFootnote = "true";

  actions.append(accept, necessary, decline);
  content.append(title, text, privacy, actions, footnote);
  panel.append(mast, content);
  banner.append(panel);
  document.body.append(banner);
  document.body.classList.add("visitor-consent-open");
  document.addEventListener("keydown", trapVisitorConsentFocus);
  updateVisitorConsentBanner();
  banner.focus({ preventScroll: true });
}

function initVisitorData() {
  const config = contentConfig.visitorData;

  if (!config || config.enabled === false) {
    return;
  }

  if (config.requireConsent === false) {
    sendVisitorData();
    return;
  }

  const consent = getVisitorConsent();

  if (consent === "accepted") {
    sendVisitorData();
    return;
  }

  if (consent === "declined" || consent === "necessary") {
    return;
  }

  if (document.body.classList.contains("privacy-view")) {
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

function hasThirdPartyContentConsent() {
  return (
    contentConfig.visitorData.requireConsent === false || getVisitorConsent() === "accepted"
  );
}

function showVideoConsentPlaceholder(shouldShow) {
  if (videoConsentPlaceholder) {
    videoConsentPlaceholder.hidden = !shouldShow;
  }
}

function resetYoutubeFrame() {
  if (!videoFrame) {
    return;
  }

  videoFrame.src = "about:blank";
  videoFrame.hidden = true;
  videoReady = false;
  showVideoConsentPlaceholder(true);
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

  return `https://www.youtube-nocookie.com/embed/${contentConfig.video.youtubeId}?${params.toString()}`;
}

function hasYoutubeVideo() {
  return Boolean(videoFrame && contentConfig.video.youtubeId);
}

function showYoutubeVideo(autoplay = false, options = {}) {
  if (!hasYoutubeVideo()) {
    return false;
  }

  if (!options.userInitiated && !hasThirdPartyContentConsent()) {
    resetYoutubeFrame();
    setVideoStatus("videoNeedsConsent");
    return false;
  }

  destroyHlsPlayer();

  if (videoCv) {
    videoCv.pause();
    videoCv.hidden = true;
  }

  showVideoConsentPlaceholder(false);
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

  resetYoutubeFrame();
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
    resetYoutubeFrame();
    setVideoStatus("videoNeedsConsent");
    return false;
  }

  if (!videoCv || videoReady) {
    return false;
  }
  loadVideoSource(currentVideoSourceIndex);
  return true;
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

  if (showYoutubeVideo(true, { userInitiated: true })) {
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
  autoplayRequested = false;
  setVideoStatus(hasYoutubeVideo() ? "videoNeedsConsent" : "videoLoading");
  showVideoPlayButton(false);

  if (hasYoutubeVideo()) {
    resetYoutubeFrame();
    videoPlayer.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  prepareVideo();
  videoPlayer.scrollIntoView({ behavior: "smooth", block: "center" });
  attemptVideoPlayback();
}

function loadVideoFromButton() {
  if (!videoPlayer) {
    return;
  }

  videoPlayer.hidden = false;
  autoplayRequested = false;
  setVideoStatus("videoLoading");

  if (showYoutubeVideo(false, { userInitiated: true })) {
    videoPlayer.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  prepareVideo();
  videoPlayer.scrollIntoView({ behavior: "smooth", block: "center" });
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
initPortfolioRoleView();
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

if (hasYoutubeVideo()) {
  resetYoutubeFrame();
}

function openPrivacySettings() {
  try {
    localStorage.removeItem("futureMakerVisitorConsent");
    localStorage.removeItem("futureMakerVisitorConsentScope");
  } catch (error) {
    // The dialog can still be opened when storage is unavailable.
  }

  showVisitorConsentBanner();
}

document.querySelectorAll("[data-open-privacy-settings]").forEach((button) => {
  button.addEventListener("click", openPrivacySettings);
});

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

if (videoLoadButton) {
  videoLoadButton.addEventListener("click", loadVideoFromButton);
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyLanguage(button.dataset.language);
  });
});

portfolioRoleButtons.forEach((button) => {
  const selectPortfolioRole = () => {
    const selectedRole = button.dataset.roleButton;

    if (!portfolioRoles.has(selectedRole) || selectedRole === currentPortfolioRole) {
      return;
    }

    applyPortfolioRole(selectedRole, {
      updateHistory: true,
      track: true,
      announce: true,
    });
  };

  button.addEventListener("click", selectPortfolioRole);
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectPortfolioRole();
  });
});

window.addEventListener("popstate", () => {
  applyPortfolioRole(getPortfolioRoleFromLocation(), { announce: true });
});
