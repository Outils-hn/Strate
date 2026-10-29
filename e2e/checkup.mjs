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

// Catalogue commun SIMULE (aucun acces a la vraie base) : un produit deja partage par l'equipe, PIN 1234
const FLUMROC = { id: "flumroc-test", name: "Flumroc Test 3", type: "rigide", lambda: 0.034, density: 100, plateArea: 0.6, priceDate: "2026-10-01",
  thicknesses: [{ t: 100, m2Pack: 3, price: 40, packsPerMP: 10, on: true }, { t: 120, m2Pack: 2.4, price: 48, packsPerMP: 10, on: true }] };

async function ctx({ dark = false, horsLigne = false } = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const rpc = [];
  await c.route(/supabase\.co/, async (route) => {
    if (horsLigne) return route.abort();
    const url = new URL(route.request().url());
    if (url.hostname.startsWith("ngfzwfbraqkdcocdcmib") && url.pathname.endsWith("/products"))
      return route.fulfill({ json: [{ id: "fiche-iso", name: "ISORESIST 1000 031 F", supplier: "Isover", category: "Isolants", deleted_at: null }] });
    if (url.pathname.endsWith("/strate_catalogue")) return route.fulfill({ json: [{ id: FLUMROC.id, kind: "produit", data: FLUMROC, updated_at: "2026-10-29", deleted_at: null }] });
    const m = url.pathname.match(/rpc\/(\w+)/);
    const body = JSON.parse(route.request().postData() || "{}");
    if (m) rpc.push(m[1]);
    return route.fulfill({ json: body.p_pin === "1234" ? { ok: true } : { ok: false, error: "PIN incorrect (4 essai(s) restant(s))." } });
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
  verif("Selecteur : 6 applis dans l'ordre", applis === "Format, Index, Linear, Masse, Strate, Trame", applis);
  await page.screenshot({ path: `${OUT}/02-selecteur.png` });
  await page.keyboard.press("Escape");
  verif("Menu ferme avec Echap", !(await page.locator("#appsMenu").evaluate((d) => d.open)));
  const pied = (await page.locator("footer").innerText()).replace(/\s+/g, " ").trim();
  verif("Pied de page", pied === "Strate v15.0 · Conçu par Hugo N. · 2026 · Sauvegarde", pied);
  await page.getByRole("button", { name: "Conçu par Hugo N." }).click(); await page.waitForTimeout(200);
  verif("Fenetre À propos", await page.locator("#modal").getByText("Version 15.0").isVisible());
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
  await taper(page, "surface", "42,5"); await page.fill("#facade", "Nord"); await page.fill("#etage", "2e");
  await page.getByRole("button", { name: "+ Commande" }).first().click(); await page.waitForTimeout(300);
  await taper(page, "surface", "12,5*3,2+8"); await page.fill("#facade", "Sud"); await page.fill("#etage", "RDC");
  await page.getByRole("button", { name: "+ Commande" }).first().click(); await page.waitForTimeout(300);
  verif("Commande : 2 zones", /2 zones/.test(await page.locator("#orderCard").innerText()));
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
  await prix.fill("42,5"); await prix.dispatchEvent("change"); await page.waitForTimeout(200);
  verif("Modif locale : « Modifié sur ce poste »", await page.locator("#sharedProduct").getByText(/Modifié sur ce poste/).isVisible());
  await page.locator("#sharedProduct").getByRole("button", { name: "Envoyer à l'équipe" }).click(); await page.waitForTimeout(200);
  await page.locator('#modalFields input').fill("0000"); await page.locator("#modalButtons .primary").click(); await page.waitForTimeout(300);
  verif("PIN faux refusé dans la fenêtre", /PIN incorrect/.test(await page.locator("#modalError").innerText()));
  await page.locator('#modalFields input').fill("1234"); await page.locator("#modalButtons .primary").click(); await page.waitForTimeout(500);
  verif("Envoi à l'équipe avec le PIN", rpc.includes("strate_save_item") && (await page.locator("#sharedProduct").getByText("Commun à l'équipe").isVisible()), rpc.join(", "));
  await page.screenshot({ path: `${OUT}/06-catalogue-commun.png`, fullPage: true });
  await page.selectOption("#catalogProductSelect", { index: 0 }); await page.waitForTimeout(200);
  verif("Produit de ce poste : bouton « Partager avec l'équipe »", await page.locator("#sharedProduct").getByRole("button", { name: "Partager avec l'équipe" }).isVisible());
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
  verif("Fiche Index liée au produit", href === "https://index-hn.lovable.app/?fiche=fiche-iso", href ?? "");
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

await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n") + "\n");
console.log(lignes.join("\n"));
