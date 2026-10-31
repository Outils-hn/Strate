// Audit UX de Strate (donnees fictives, base commune simulee ou coupee).
import { lancer, ouvrir, photo, mesures, axe, tabsJusqua, focusVisible, note, ecrire, tenter } from "./audit-lib.mjs";
const URL0 = "http://127.0.0.1:8090/";
const b = await lancer();
const FL = { id: "flumroc-test", name: "Flumroc Test 3", type: "rigide", lambda: 0.034, density: 100, plateArea: 0.6, priceDate: "2026-10-01", thicknesses: [{ t: 100, m2Pack: 3, price: 40, packsPerMP: 10, on: true }, { t: 120, m2Pack: 2.4, price: 48, packsPerMP: 10, on: true }] };
const brancher = async (c) => c.route(/supabase\.co/, async (r) => { const u = new URL(r.request().url()); if (u.pathname.endsWith("/strate_catalogue")) return r.fulfill({ json: [{ id: FL.id, kind: "produit", data: FL, updated_at: "2026-10-29", deleted_at: null }] }); if (u.pathname.endsWith("/products")) return r.fulfill({ json: [] }); return r.fulfill({ json: { ok: false } }); });
const txt = async (p, sel = "body") => (await p.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ");
const vu = (p) => p.addInitScript(() => localStorage.setItem("strate.guideSeen", "1"));

let p = await ouvrir(b, "premier-lancement", { url: URL0, brancher });
await photo(p, "01-premier-lancement", false); await mesures(p, "premier"); await axe(p, "premier"); note("premier:texte", (await txt(p)).slice(0, 500));
await p.getByRole("button", { name: "Suivant" }).click().catch(() => {}); await p.waitForTimeout(300); await photo(p, "01b-guide-etape2", false);
note("guide-etapes", await (async () => { let n = 1; for (let i = 0; i < 6; i++) { const s = p.getByRole("button", { name: "Suivant" }); if (await s.isVisible().catch(() => false)) { await s.click(); n++; } } return n; })());
await photo(p, "01c-guide-fin", false);
p = await ouvrir(b, "calcul", { url: URL0, brancher, init: vu }); await photo(p, "02-calcul"); await mesures(p, "calcul"); await axe(p, "calcul"); note("focus", await focusVisible(p));
note("tabs-jusqu-au-premier-resultat", await tabsJusqua(p, () => /Commande/.test(document.activeElement?.textContent || ""), 80));
// cas limites sur l'epaisseur cible
await tenter("epaisseurs", async () => {
  for (const [nom, v] of [["zero", "0"], ["negatif", "-50"], ["texte", "abc"], ["enorme", "5000"], ["decimal", "182,5"], ["petit", "3"]]) {
    await p.locator("#target").fill(v); await p.keyboard.press("Tab"); await p.waitForTimeout(350);
    note(`cible:${nom}`, { champ: await p.locator("#target").inputValue(), resultats: (await txt(p, "#results")).slice(0, 260) }); await photo(p, `03-cible-${nom}`, false);
  }
  await p.locator("#target").fill("220");
  for (const [nom, v] of [["somme", "12,5*3,2+8"], ["texte", "abc"], ["negatif", "-5"], ["enorme", "99999999"], ["virgule", "42,5"]]) {
    await p.locator("#surface").fill(v); await p.keyboard.press("Tab"); await p.waitForTimeout(350);
    note(`surface:${nom}`, { champ: await p.locator("#surface").inputValue(), apercu: (await txt(p, "#results")).slice(0, 300), calc: await txt(p, "#surfaceCalc") }); await photo(p, `04-surface-${nom}`, false);
  }
});
// ajout a la commande et export
await tenter("commande", async () => {
  await p.locator("#surface").fill("42,5"); await p.waitForTimeout(300);
  await p.getByRole("button", { name: /\+ Commande/ }).first().click(); await p.waitForTimeout(500); await photo(p, "05-commande");
  note("commande:texte", (await txt(p)).slice(0, 700));
  note("commande:boutons", (await p.getByRole("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean).join(" | "));
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(600); note("commande:apres-rechargement", (await txt(p, "#orderCard, body")).slice(0, 300));
});
// import catalogue defectueux
await tenter("import", async () => {
  await p.getByText("Catalogue").first().click().catch(() => {}); await p.waitForTimeout(400);
  await p.locator("#openImportBtn").click(); await p.waitForTimeout(300);
  await p.locator("#importText").fill("100\t3\tabc\n120\t-2\t48\n\n140\t2,4\t56"); await p.waitForTimeout(500); await photo(p, "06-import-defectueux", false);
  note("import:apercu", (await txt(p, "#importPanel")).slice(0, 500));
});
for (const [nom, w, h] of [["mobile", 390, 844], ["tablette", 768, 1024]]) await tenter(nom, async () => { const m = await ouvrir(b, nom, { url: URL0, brancher, init: vu, w, h }); await photo(m, `07-${nom}`); await mesures(m, nom); await axe(m, nom); });
await tenter("sombre", async () => { const d = await ouvrir(b, "sombre", { url: URL0, brancher, dark: true, init: async (pg) => { await vu(pg); await pg.addInitScript(() => localStorage.setItem("strate.theme", "dark")); } }); await photo(d, "08-sombre", false); await axe(d, "sombre"); });
await tenter("hors-ligne", async () => { const h = await ouvrir(b, "hors-ligne", { url: URL0, init: vu, brancher: (c) => c.route(/supabase\.co/, (r) => r.abort()) }); await photo(h, "09-hors-ligne", false); note("hors-ligne:texte", (await txt(h)).slice(0, 400)); });
ecrire(); await b.close();
