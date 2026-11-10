// Check-up automatique de Strate dans un vrai navigateur (donnees du navigateur vierges).
// Resultat : checkup.txt (OK / ECHEC) + captures d'ecran et bon de commande PDF.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8090/";
const OUT = process.argv[2] ?? "captures";
mkdirSync(OUT, { recursive: true });
const lignes = [];
const verif = (nom, ok, detail = "") => lignes.push(`${ok ? "OK    " : "ECHEC "} ${nom}${detail ? ` (${detail})` : ""}`);
const step = async (nom, fn) => { try { await fn(); } catch (e) { verif(nom, false, e.message.split("\n")[0].slice(0, 180)); } };
const browser = await chromium.launch();

// Catalogue commun SIMULE (aucun acces a la vraie base) : un produit deja partage par l'equipe ; compte de test, mot de passe « bon »
const FLUMROC = { id: "flumroc-test", name: "Flumroc Test 3", type: "rigide", lambda: 0.034, density: 100, plateArea: 0.6, priceDate: "2026-10-01",
  thicknesses: [{ t: 100, m2Pack: 3, price: 40, packsPerMP: 10, on: true }, { t: 120, m2Pack: 2.4, price: 48, packsPerMP: 10, on: true }] };

async function ctx({ dark = false, horsLigne = false } = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const rpc = [];
  await c.route(/supabase\.co/, async (route) => {
    if (horsLigne) return route.abort();
    const url = new URL(route.request().url());
    if (url.hostname.startsWith("dtxgvwaqjmmffiiohika") && url.pathname.endsWith("/products"))
      return route.fulfill({ json: [{ id: "fiche-iso", name: "ISORESIST 1000 031 F", supplier: "Isover", category: "Isolants", deleted_at: null }] });
    const body = JSON.parse(route.request().postData() || "{}");
    if (url.pathname.endsWith("/auth/v1/token")) {
      if (body.password !== "bon") return route.fulfill({ status: 400, json: { error: "invalid_grant", error_description: "Invalid login credentials" } });
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      return route.fulfill({ json: { access_token: `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp: 4102444800 })}.x`, token_type: "bearer", expires_in: 3600, refresh_token: "r", user: { id: "u1", email: "hugo@test.fr" } } });
    }
    const m = url.pathname.match(/rpc\/(\w+)/);
    if (m) rpc.push(m[1]);
    if (m && m[1] === "strate_lire") {
      // Sans compte : prix masques par la base ; avec compte : catalogue complet
      const connecte = /^Bearer .+\..+\./.test(route.request().headers()["authorization"] ?? "");
      const data = connecte ? FLUMROC : { ...FLUMROC, thicknesses: FLUMROC.thicknesses.map(({ price: _p, ...t }) => t) };
      return route.fulfill({ json: [{ id: FLUMROC.id, kind: "produit", data, updated_at: "2026-10-29", deleted_at: null }] });
    }
    return route.fulfill({ json: { ok: true } });
  });
  await c.addInitScript((d) => { localStorage.setItem("strate.guideSeen", "1"); if (d) localStorage.setItem("strate.theme", "dark"); }, dark);
  const page = await c.newPage();
  const etat = { natifs: 0 };
  page.on("pageerror", (e) => verif("Aucune erreur JavaScript", false, e.message.slice(0, 150)));
  page.on("dialog", (d) => { etat.natifs++; d.dismiss(); });
  await page.goto(BASE, { waitUntil: "load" }); await page.waitForTimeout(500);
  // Guide de demarrage eventuel
  const passer = page.getByRole("button", { name: "Passer" });
  if (await passer.isVisible().catch(() => false)) await passer.click();
  return { c, page, etat, rpc };
}
const res = async (page) => (await page.locator("#results").innerText()).replace(/\s+/g, " ");
const taper = async (page, id, v) => { await page.fill(`#${id}`, ""); await page.focus(`#${id}`); await page.keyboard.type(v); await page.waitForTimeout(200); };

await step("Ecran principal", async () => {
  const { c, page, etat } = await ctx();
  await page.screenshot({ path: `${OUT}/01-strate.png`, fullPage: true });
  await page.locator("#appsMenu summary").click(); await page.waitForTimeout(150);
  const applis = (await page.locator(".apps-menu a .nm").allInnerTexts()).join(", ");
  verif("Selecteur : Accueil + 10 applis dans l'ordre", applis === "Accueil, Rechercher, Check, Index, Access, Trame, Linear, Format, Joint, Masse, Membrane, Strate, Raccourcis", applis);
  const lignes = await page.locator(".apps-menu a").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  verif("Selecteur : chaque ligne tient sur une seule ligne (meme hauteur)", Math.max(...lignes) - Math.min(...lignes) < 2, lignes.join(","));
  await page.screenshot({ path: `${OUT}/02-selecteur.png` });
  await page.keyboard.press("Escape");
  verif("Menu ferme avec Echap", !(await page.locator("#appsMenu").evaluate((d) => d.open)));
  const pied = (await page.locator("footer").innerText()).replace(/\s+/g, " ").trim();
  verif("Pied de page", pied === "Strate v15.22 · Conçu par Hugo N. · 2026 · Sauvegarde · Suggestion / bug", pied);
  await page.getByRole("button", { name: "Conçu par Hugo N." }).click(); await page.waitForTimeout(200);
  verif("Fenetre À propos", await page.locator("#modal").getByText("Version 15.22").isVisible());
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);

  // Saisies
  await taper(page, "target", "221"); await taper(page, "tolPlus", "2,5");
  const r1 = await res(page);
  verif("Tolérance « 2,5 » : plage 221 à 223,5 mm", /221 à 223\.5 mm|221 à 223,5 mm/.test(r1), r1.slice(0, 90));
  await taper(page, "tolPlus", "10"); await taper(page, "target", "220");
  await taper(page, "tolMinus", "-20");
  const r2 = await res(page);
  verif("Tolérance négative signalée et comptée 0", /Tolérance négative/.test(r2) && (await page.locator("#tolMinus").evaluate((e) => e.classList.contains("field-bad"))), r2.slice(0, 90));
  await taper(page, "tolMinus", "0");
  await taper(page, "target", "5000");
  const r3 = await res(page);
  verif("Cible 5000 mm : message « maximum faisable »", /maximum faisable/.test(r3) && !/-4/.test(r3), r3.slice(0, 120));
  await taper(page, "target", "1'200");
  const r4 = await res(page);
  verif("Cible « 1'200 » lue 1200", /1200 mm, c'est plus|maximum faisable/.test(r4), r4.slice(0, 80));
  await taper(page, "target", "220");
  await page.screenshot({ path: `${OUT}/03-combinaisons.png`, fullPage: true });

  // Commande
  await taper(page, "surface", "-10");
  verif("Surface négative signalée", /supérieure à 0/.test(await page.locator("#surfaceCalc").innerText()));
  await taper(page, "surface", "42,5"); await page.fill("#facade", "Nord"); await page.fill("#etage", "2e"); await page.fill("#plan", "101");
  await page.getByRole("button", { name: "+ Commande" }).first().click(); await page.waitForTimeout(300);
  await taper(page, "surface", "12,5*3,2+8"); await page.fill("#facade", "Sud"); await page.fill("#etage", "RDC");
  await page.getByRole("button", { name: "+ Commande" }).first().click(); await page.waitForTimeout(300);
  verif("Commande : 2 zones", /2 zones/.test(await page.locator("#orderCard").innerText()));
  verif("Le n° du plan de coupe est note sur la zone", /Façade Nord · Étage 2e · Coupe 101/.test(await page.locator("#orderCard").innerText()), (await page.locator("#orderCard").innerText()).slice(0, 200));
  verif("Le n° du plan reste rempli apres l'ajout (comme la facade)", (await page.inputValue("#plan")) === "101");
  const colonnes = await page.evaluate(() => ({ h: ZONE_HEADER.slice(0, 4), v: zoneValues(curOrder().lines[0]).slice(0, 4) }));
  verif("Export Excel : colonne « Plan de coupe » apres l'etage", colonnes.h.join("|") === "Façade|Étage|Plan de coupe|Produit" && colonnes.v[2] === "101", JSON.stringify(colonnes));
  verif("Sans compte : pas de rappel de sauvegarde JSON", !(await page.locator("#backupReminder").isVisible()));
  await page.evaluate(() => { localStorage.setItem("sb-dtxgvwaqjmmffiiohika-auth-token", JSON.stringify({ access_token: "a", refresh_token: "r", expires_at: 4102444800, user: { id: "u1", email: "hugo@test.fr" } })); window.dispatchEvent(new StorageEvent("storage", { key: "sb-dtxgvwaqjmmffiiohika-auth-token" })); });
  await page.waitForTimeout(300);
  verif("Rappel de sauvegarde affiche avec un compte (commande, jamais sauvegardee)", await page.locator("#backupReminder").isVisible());
  await page.getByRole("button", { name: "Plus tard" }).click();
  verif("Rappel de sauvegarde : « Plus tard » le masque", !(await page.locator("#backupReminder").isVisible()));
  await taper(page, "surface", "99999999");
  verif("Surface énorme : avertissement", /Surface inhabituelle/.test(await page.locator("#surfaceCalc").innerText()));
  await page.getByRole("button", { name: "+ Commande" }).first().click(); await page.waitForTimeout(300);
  verif("Surface énorme : confirmation demandée", await page.locator("#modal").getByText("Surface inhabituelle").isVisible());
  await page.locator("#modal").getByRole("button", { name: "Annuler" }).click().catch(() => page.keyboard.press("Escape")); await page.waitForTimeout(200);
  await taper(page, "surface", "12,5*3,2+8");
  verif("Champ de commande nommé", (await page.locator("#orderSelect").getAttribute("aria-label")) === "Commande en cours");
  await page.screenshot({ path: `${OUT}/04-commande.png`, fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click("#pdfBtn")]);
  await dl.saveAs(`${OUT}/bon.pdf`);
  verif("Bon de commande PDF telecharge", /\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  verif("Aucune fenetre native du navigateur", etat.natifs === 0, `${etat.natifs}`);
  await c.close();
});

await step("Catalogue commun", async () => {
  const { c, page, rpc } = await ctx();
  await page.waitForTimeout(800);
  const options = await page.locator("#productSelect option").allInnerTexts();
  verif("Produit de l'équipe reçu", options.some((o) => /Flumroc Test 3/.test(o)), options.join(" | "));
  await page.locator("#catalogCard summary").click();
  await page.selectOption("#catalogProductSelect", "flumroc-test"); await page.waitForTimeout(200);
  verif("État « Commun à l'équipe »", await page.locator("#sharedProduct").getByText("Commun à l'équipe").isVisible());
  const prix = page.locator('#thicknessRows tr[data-t="100"] input[data-field="price"]');
  verif("Sans compte : prix masqués", (await prix.inputValue()) === "", await prix.inputValue());
  verif("Sans compte : « Lecture seule, sans prix »", await page.locator("#sharedProduct").getByText(/Lecture seule, sans prix/).isVisible());
  await prix.fill("42,5"); await prix.dispatchEvent("change"); await page.waitForTimeout(200);
  verif("Modif locale : « Modifié sur ce poste »", await page.locator("#sharedProduct").getByText(/Modifié sur ce poste/).isVisible());
  await page.locator("#sharedProduct").getByRole("button", { name: "Envoyer à l'équipe" }).click(); await page.waitForTimeout(200);
  await page.locator('#modalFields input[type="email"]').fill("hugo@test.fr");
  await page.locator('#modalFields input[type="password"]').fill("mauvais"); await page.locator("#modalButtons .primary").click(); await page.waitForTimeout(400);
  verif("Mauvais mot de passe refusé dans la fenêtre", /incorrect/.test(await page.locator("#modalError").innerText()));
  await page.locator('#modalFields input[type="password"]').fill("bon"); await page.locator("#modalButtons .primary").click(); await page.waitForTimeout(1200);
  const envoye = rpc.indexOf("strate_save_item") > rpc.lastIndexOf("strate_lire");
  verif("Après connexion : catalogue relu avant l'envoi (prix jamais écrasés)", envoye, rpc.join(", "));
  verif("Envoi à l'équipe avec le compte", rpc.includes("strate_save_item") && (await page.locator("#sharedProduct").getByText("Commun à l'équipe").isVisible()), rpc.join(", "));
  await page.screenshot({ path: `${OUT}/06-catalogue-commun.png`, fullPage: true });
  await page.selectOption("#catalogProductSelect", { index: 0 }); await page.waitForTimeout(200);
  verif("Produit de ce poste : bouton « Partager avec l'équipe »", await page.locator("#sharedProduct").getByRole("button", { name: "Partager avec l'équipe" }).isVisible());
  await c.close();
});

await step("Comptes : bandeau et 3 exports gratuits", async () => {
  const { c, page } = await ctx();
  await page.waitForTimeout(500);
  verif("Bandeau : « Lecture seule » + Se connecter", await page.locator("#accountState").innerText() === "Lecture seule" && await page.locator("#accountBtn").innerText() === "Se connecter");
  await page.evaluate(() => localStorage.setItem("outils.strate.exports", "3"));
  await page.locator("#backupBtn").scrollIntoViewIfNeeded();
  const [dlSans] = await Promise.all([page.waitForEvent("download", { timeout: 1500 }).catch(() => null), page.locator("#backupBtn").click()]);
  await page.waitForTimeout(300);
  verif("Sans compte : pas de sauvegarde JSON, message « compte requis »", !dlSans && (await page.locator("#toast").innerText().catch(() => "")).includes("Fichier JSON : compte requis"));
  await page.locator("#accountBtn").click(); await page.waitForTimeout(400);
  verif("La connexion s'ouvre depuis le bandeau", await page.locator("#modal").getByText("Connexion").first().isVisible());
  await page.locator('#modalFields input[type="email"]').fill("hugo@test.fr");
  await page.locator('#modalFields input[type="password"]').fill("bon");
  await page.locator("#modalButtons .primary").click(); await page.waitForTimeout(900);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), page.locator("#backupBtn").click()]);
  verif("Apres connexion : la sauvegarde part", !!dl);
  verif("Bandeau : email seul", (await page.locator("#accountState").innerText()) === "hugo@test.fr" && (await page.locator("#accountBtn").innerText()) === "Se déconnecter");
  await page.locator("#accountBtn").click(); await page.waitForTimeout(300);
  verif("Deconnexion : retour en lecture seule", (await page.locator("#accountState").innerText()) === "Lecture seule");
  await c.close();
});

await step("Lien vers une fiche Index", async () => {
  const { c, page } = await ctx();
  await page.waitForTimeout(600);
  await page.locator("#catalogCard summary").click();
  await page.getByRole("button", { name: "Lier une fiche Index" }).click(); await page.waitForTimeout(300);
  await page.getByLabel("Rechercher une fiche dans Index").fill("isoresist"); await page.waitForTimeout(400);
  await page.locator("#ficheResults").getByRole("button", { name: /ISORESIST 1000 031 F/ }).click(); await page.waitForTimeout(300);
  const href = await page.locator("#productFiche a").getAttribute("href");
  verif("Fiche Index liée au produit", href === "https://outils-hn.github.io/Index/?fiche=fiche-iso", href ?? "");
  verif("Lien aussi visible dans le calcul", await page.locator("#productInfo a").isVisible());
  await page.screenshot({ path: `${OUT}/07-lien-index.png`, fullPage: false });
  await c.close();
});

await step("Catalogue commun hors ligne", async () => {
  const { c, page } = await ctx({ horsLigne: true });
  await page.waitForTimeout(1500);
  await page.locator("#catalogCard summary").click();
  verif("Hors ligne : Strate continue, « Hors ligne · Réessayer »", await page.locator("#sharedProduct").getByText(/Hors ligne/).isVisible());
  await c.close();
});

await step("Mode sombre", async () => {
  const { c, page } = await ctx({ dark: true });
  verif("Mode sombre retenu", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await page.screenshot({ path: `${OUT}/05-sombre.png`, fullPage: true });
  await c.close();
});

// Telephone (390 px) : barre d'onglets en bas, pas de debordement, cibles assez grandes
await step("Telephone", async () => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await c.route(/supabase\.co/, (r) => r.abort());
  const page = await c.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const nav = document.querySelector(".topnav").getBoundingClientRect();
    const petits = [...document.querySelectorAll(".topnav a, #guideBtn, main button.btn:not([hidden])")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 36; }).map((e) => e.textContent.trim().slice(0, 20));
    return { debord: document.documentElement.scrollWidth - window.innerWidth, navBas: Math.abs(nav.bottom - window.innerHeight) < 2, navLarge: nav.width >= window.innerWidth - 2, petits };
  });
  verif("Telephone : pas de debordement horizontal", m.debord <= 0, `${m.debord} px`);
  verif("Telephone : les 5 rubriques en barre fixe en bas", m.navBas && m.navLarge);
  verif("Telephone : boutons assez grands", m.petits.length === 0, m.petits.join(", "));
  await page.screenshot({ path: `${OUT}/50-telephone.png` });
  await c.close();
});

await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n") + "\n");
console.log(lignes.join("\n"));
