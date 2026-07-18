# Portfolio-sivuston kuukausittainen toimivuustarkistus

Tässä projektissa on automaatio, joka tarkistaa kerran kuukaudessa, että portfolio toimii rekrytoijille. Staattinen tarkistus käy läpi linkit, PDF:t, kuvat, videot, YouTube-upotuksen, arkisto-osion ja analytiikka-asetukset. Lisäksi oikea Chromium-selain avaa sivuston ja käyttää kaikki napit sekä linkkinapit yksi kerrallaan.

Automaatio on toteutettu tiedostoilla `tools/monthly-site-check.mjs` ja `tools/monthly-button-check.mjs` sekä GitHub Actions -ajastuksella `.github/workflows/monthly-site-check.yml`.

## Roolikohtaiset portfolionäkymät

Etusivun alussa oleva kevyt roolivalitsin tarjoaa rekrytoijalle kolme suositeltua työnäytelinkkiä ja kuusi keskeistä taitoa. Linkit vievät olemassa oleviin portfolio-osioihin tai niitä täydentäville nykyisille sivuille; projektien sisältöä ei kopioida rooliosioon. Valittavissa ovat:

- `creative-design`
- `digital-marketing`
- `ai-solutions`
- `all`

Ilman `role`-parametria valitsin käynnistyy neutraalissa `unselected`-tilassa. Silloin yksikään painike ei ole aktiivinen, roolikohtaista profiilia ei näytetä ja alkuperäinen portfolio jatkuu normaalisti valitsimen alla. `unselected` ei ole käyttäjälle lähetettävä URL-parametri. Myös virheellinen arvo palautetaan tähän neutraaliin tilaan ja poistetaan URL:sta säilyttäen muut parametrit sekä hash-osa.

Suoran näkymän voi avata esimerkiksi osoitteella `/?role=creative-design`. Myös `digital-marketing`, `ai-solutions` ja `all` toimivat suorina osoitteina. Valinta päivittää URL:n ilman sivulatausta, ja selaimen takaisin- ja eteenpäin-painikkeet palauttavat oikean näkymän.

Roolin sisältö on omassa `data-role-panel`-elementissään:

```html
<article class="role-profile" data-role-panel="creative-design">
  <!-- Lyhyt esittely, kolme linkkiä ja enintään kuusi taitoa -->
</article>
```

Kun päivität roolikohtaisia suosituksia:

1. muokkaa oikeaa `data-role-panel`-elementtiä `index.html`-tiedostossa
2. pidä suositusten määrä enintään kolmessa ja taitojen määrä enintään kuudessa
3. linkitä suositus olemassa olevaan osioon tai nykyiseen projektisivuun
4. lisää FI- ja EN-tekstit `script.js`-tiedoston käännössanastoihin
5. päivitä koneellisesti luettavat roolitiedot `portfolio.json`- ja `ai.html`-tiedostoihin vain, jos itse alkuperäinen projektisisältö muuttuu

JavaScript vaihtaa vain aktiivisen esittelyn, kolme suositusta, kuusi taitoa ja painikkeen tilan. Se ei siirrä alkuperäisen portfolion DOM-elementtejä. Ilman JavaScriptiä rooliosio näyttää neutraalin ohjetekstin ja kaikki alkuperäiset portfolio-osiot näkyvät normaalisti.

Roolivalinnat käyttävät tavallista `button_click`-analytiikkatapahtumaa, jotta valittu painike näkyy Google Sheetsin `Painike`-sarakkeessa samoin kuin esimerkiksi `cv_button`. `button_label`-kentässä käytetään arvoja `portfolio_role_creative_design`, `portfolio_role_digital_marketing`, `portfolio_role_ai_solutions` ja `portfolio_role_all`. Koko portfolioon jatkava linkki käyttää tunnistetta `portfolio_role_continue_full`. Neutraali aloitustila ei lähetä tapahtumaa. Uusia tunnisteita, evästeitä tai henkilötietokenttiä ei lisätä, ja tapahtumat lähetetään vain, jos analytiikkasuostumus on hyväksytty.

Erikoisnumeron yhdeksän suositeltua työnäytelinkkiä käyttävät tavallista `button_click`-tapahtumaa ja yksilöllisiä `recruiter_*`-tunnisteita. Näin yksityisestä Google Sheets -taulukosta näkee, minkä näkökulman kävijä valitsi ja mitä sen jälkeen esiteltyä työnäytettä hän avasi. Myös nämä tapahtumat lähetetään vain hyväksytyllä analytiikkasuostumuksella.

## 1. Miten automaatio toimii

Tarkistin lukee sivuston staattiset tiedostot ja asetukset:

- `index.html`
- `script.js`
- `styles.css`
- `assets/content-config.js`
- `files/`
- `assets/`

Staattinen tarkistus tarkistaa:

- kaikki `<a>`-linkit
- kaikki `<button>`-napit ja niiden tunnetut sivustotoiminnot
- sivun sisäiset ankkurit, kuten `#archive`
- sisäiset tiedostopolut
- ulkoiset HTTPS-linkit
- PDF-tiedostojen perusmuodon
- kuvien ja videoiden olemassaolon ja perusmuodon
- YouTube-upotuksen saatavuuden
- vanhat Wix-polut
- analytiikka-endpointin asetuksen turvallisesti ilman kirjoittavaa testiä oletuksena

Selaintarkistus käy läpi projektin kaikki HTML-sivut ja testaa:

- jokaisen aidon `<button>`-elementin
- jokaisen `data-track="button_click"` -linkkinapin
- jokaisen `.button`-luokalla tyylitellyn linkkinapin
- FI- ja EN-kielenvaihdon
- kaikki neljä portfolion roolivalintaa
- videon avauksen, latauksen, toiston varanapin ja sulkemisen
- tietosuoja-asetusten avauksen
- kaikki sisäiset, ulkoiset, PDF-, ankkuri- ja sähköpostinapit
- evästesuostumuksen **Hyväksy**, **Vain välttämättömät** ja **Hylkää** -napit
- evästesuostumusikkunan tietosuojalinkin

Evästevalinnat ajetaan erillisissä puhtaissa selaintiloissa. Näin yhden valinnan tallennus ei peitä muita valintoja testiltä. Terveystarkistuksen `healthcheck=1`-parametri estää testiklikkauksia kirjoittamasta oikeaa analytiikkadataa.

Automaatio ei muuta sivuston visuaalisuutta, tekstejä, rakennetta tai brändi-ilmettä.

## 2. Miten se ajetaan käsin

Aja projektikansion juuressa:

```bash
node tools/monthly-site-check.mjs
node tools/monthly-button-check.mjs
```

Selaintarkistus tarvitsee ensin projektin riippuvuudet ja Chromiumin:

```bash
npm install
npx playwright install chromium
```

Jos haluat tarkistaa myös julkaistun Cloudflare Pages -osoitteen, anna sivuston julkinen osoite:

```bash
SITE_BASE_URL="https://oma-sivusto.pages.dev" node tools/monthly-site-check.mjs
```

Kirjoittavaa analytiikkatestiä ei ajeta oletuksena. Jos haluat testata Google Sheets -endpointin oikealla POST-pyynnöllä, aja:

```bash
CHECK_ANALYTICS_POST=1 node tools/monthly-site-check.mjs
```

Tällöin analytiikkarivi merkitään tekniseksi tarkistukseksi:

- `eventType: system_check`
- `visitorType: automation`
- `source: monthly_link_check`

## 3. Miten kuukausittainen ajo on ajastettu

GitHub Actions ajaa tarkistuksen kerran kuukaudessa:

```yaml
cron: "13 7 1 * *"
```

Tämä tarkoittaa kuukauden ensimmäistä päivää klo 07:13 UTC. Suomessa aika on talviaikaan 09:13 ja kesäaikaan 10:13.

Työn aikaraja on 12 minuuttia. Käytännössä staattinen tarkistus ja yhden Chromium-selaimen nappikierros valmistuvat tavallisesti muutamassa minuutissa.

Tarkistuksen voi käynnistää myös käsin GitHubissa kohdasta:

`Actions` -> `Monthly site check` -> `Run workflow`

Jos käytät GitHub Actionsissa julkaistun sivun tarkistusta, lisää repon muuttuja:

```text
SITE_BASE_URL=https://oma-sivusto.pages.dev
```

## 4. Miten raportteja luetaan

Raportit tallentuvat kansioon:

```text
reports/monthly-site-checks/
```

Jokaisesta ajosta syntyy staattisen tarkistuksen raportti ja erillinen nappien selaintestiraportti. Kummastakin syntyy kaksi tiedostoa:

- `.md` on ihmiselle luettava raportti
- `.json` on koneellisesti luettava raportti

Nappiraportin tiedostonimi päättyy muotoon `-buttons.md` tai `-buttons.json`. Jos nappi epäonnistuu, raporttikansioon tallennetaan myös virhetilanteen kuvakaappaus.

Raportissa näkyy:

- tarkistuksen päivämäärä ja kellonaika
- montako linkkiä tarkistettiin
- montako nappia tarkistettiin
- montako tiedostoa tarkistettiin
- montako HTTP-pyyntöä tarkistus teki
- mitkä tarkistukset menivät läpi
- mitkä epäonnistuivat
- virhekoodi tai virheen syy
- korjausehdotus jokaiselle virheelle

GitHub Actions lataa raportin myös artifactiksi nimellä `monthly-site-check-report` ja committaa raportin takaisin repositorioon.

## 5. Miten testi ei sotke oikeaa analytiikkadataa

Oletuksena tarkistin ei lähetä kirjoittavaa pyyntöä Google Sheets -analytiikkaan:

```text
CHECK_ANALYTICS_POST=0
```

Kun tarkistin tarkistaa julkaistua sivustoa, sisäisiin sivusto- ja tiedostopyyntöihin lisätään:

```text
?healthcheck=1
```

Kaikki HTTP-pyynnöt saavat lisäksi headerin:

```text
X-Portfolio-Healthcheck: true
```

Sivuston analytiikkalogiikka ohittaa käynnin kokonaan, jos URLissa on:

```text
?healthcheck=1
```

Jos endpointille tehdään erikseen kirjoittava testi asetuksella `CHECK_ANALYTICS_POST=1`, payload merkitään järjestelmätarkistukseksi eikä oikeaksi rekrykävijäksi:

```json
{
  "eventType": "system_check",
  "visitorType": "automation",
  "source": "monthly_link_check"
}
```

Näin analytiikkaan ei synny tavallisen kävijän kaltaista testidataa.
