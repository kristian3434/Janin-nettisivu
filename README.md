# Portfolio-sivuston kuukausittainen toimivuustarkistus

Tässä projektissa on kevyt automaatio, joka tarkistaa kerran kuukaudessa, että portfolio toimii rekryttäjille: linkit, napit, PDF:t, kuvat, videot, YouTube-upotus, arkisto-osio ja analytiikka-asetukset käydään läpi ilman raskasta selaintestiä.

Automaatio on toteutettu tiedostolla `tools/monthly-site-check.mjs` ja GitHub Actions -ajastuksella `.github/workflows/monthly-site-check.yml`.

## 1. Miten automaatio toimii

Tarkistin lukee sivuston staattiset tiedostot ja asetukset:

- `index.html`
- `script.js`
- `styles.css`
- `assets/content-config.js`
- `files/`
- `assets/`

Se tarkistaa:

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

Automaatio ei muuta sivuston visuaalisuutta, tekstejä, rakennetta tai brändi-ilmettä.

## 2. Miten se ajetaan käsin

Aja projektikansion juuressa:

```bash
node tools/monthly-site-check.mjs
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

Työn aikaraja on 5 minuuttia. Tarkistus tekee vain kevyitä HTTP-pyyntöjä, joten kuukausikulutus pysyy normaalisti muutamassa minuutissa ja noin 100-200 pyynnön alapuolella.

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

Jokaisesta ajosta syntyy kaksi tiedostoa:

- `.md` on ihmiselle luettava raportti
- `.json` on koneellisesti luettava raportti

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
