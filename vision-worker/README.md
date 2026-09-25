# Prepoznavanje jedi po fotografiji

Frontend ostane na GitHub Pages, ta Worker pa prejme pomanjšano sliko in uporabi Gemini za predlog imena jedi. Fotografija se ne shrani v aplikacijo ali Worker; poslana je ponudniku AI za analizo. Uporabnik potrdi ali popravi rezultat pred dodajanjem obroka.

## Vključitev

1. V Google AI Studio ustvarite ključ Gemini API v projektu z omogočenim brezplačnim modelom `gemini-3.1-flash-lite`.
2. V Cloudflare Dashboard → Workers & Pages → Create → Worker ustvarite Worker `personal-life-os-vision`. V urejevalnik prilepite vsebino `worker.js` in ga objavite. Alternativno iz mape `vision-worker` izvedite `npx wrangler deploy`.
3. V nastavitvah Workerja pod Variables and Secrets dodajte **Secret** `GEMINI_API_KEY` z vrednostjo iz AI Studio. Ključa nikoli ne dodajte v GitHub ali v `vision-config.js`. Po potrebi ponovno objavite Worker.
4. Kopirajte javni URL Workerja (npr. `https://personal-life-os-vision.ime.workers.dev`) v `window.MEAL_VISION_ENDPOINT` v korenski datoteki `vision-config.js`, objavite spremembo; v `index.html` povečajte verzijo `vision-config.js?v=...` za osvežitev predpomnilnika.
5. Na telefonu v Jedilniku fotografirajte obrok, tapnite »Prepoznaj jed«, preverite predlog in ga dodajte.

Omejitev izvora in velikosti v Workerju preprečuje običajne napačne zahtevke, ni pa zaščita pred namernimi neposrednimi zahtevki. Pred širšo javno objavo dodajte preverjanje Cloudflare Turnstile ali omejevanje zahtevkov na strežniku. Brez nameščenega Workerja ostane možnost fotografiranja skrita; preostali Jedilnik deluje normalno.

Po posodobitvi `worker.js` v Cloudflare urejevalniku ponovno kliknite Deploy; nova različica oceni tudi kalorije in makrohranila iz fotografije ali navedenih sestavin recepta. Vrednosti so informativne in pred shranjevanjem jih uporabnik lahko popravi.
