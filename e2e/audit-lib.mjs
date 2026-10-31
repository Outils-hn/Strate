// Outils communs de l'audit UX (donnees fictives uniquement). Copie identique dans chaque depot : e2e/audit-lib.mjs
import { chromium } from "playwright";
import fs from "node:fs";

export const OUT = process.argv[2] || "audit";
export const BASE = process.env.APP_URL || "http://127.0.0.1:8080/";
fs.mkdirSync(OUT, { recursive: true });

export const rapport = { constats: [], erreurs: [], metriques: {} };
export const note = (cle, valeur) => { rapport.metriques[cle] = valeur; try { ecrire(); } catch {} };
export const tenter = async (nom, fn) => { try { await fn(); } catch (e) { rapport.erreurs.push(`[${nom}] script : ${String(e.message).split("\n")[0]}`); try { ecrire(); } catch {} } };
export const constat = (txt) => { rapport.constats.push(txt); console.log("•", txt); };
export function ecrire() { fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(rapport, null, 2)); fs.writeFileSync(`${OUT}/audit.txt`, ["# Constats", ...rapport.constats, "", "# Erreurs navigateur", ...(rapport.erreurs.length ? rapport.erreurs : ["aucune"]), "", "# Metriques", JSON.stringify(rapport.metriques, null, 2)].join("\n")); };

export async function lancer() {
  const b = await chromium.launch();
  return b;
}

/** Ouvre une page avec capture des erreurs ; options : largeur, hauteur, init(page) avant navigation, url */
export async function ouvrir(b, nom, { w = 1440, h = 900, dark = false, init, url = BASE, brancher, reduit = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, colorScheme: dark ? "dark" : "light", reducedMotion: reduit ? "reduce" : "no-preference" });
  if (brancher) await brancher(ctx);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => rapport.erreurs.push(`[${nom}] JS : ${e.message.split("\n")[0]}`));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/i.test(m.text())) rapport.erreurs.push(`[${nom}] console : ${m.text().slice(0, 200)}`); });
  if (init) await init(p);
  const t0 = Date.now();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  p._chargement = Date.now() - t0;
  return p;
}

export const photo = async (p, nom, pleine = true) => { await p.screenshot({ path: `${OUT}/${nom}.png`, fullPage: pleine }); };

/** Mesures techniques d'une page deja chargee */
export async function mesures(p, nom) {
  const m = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const nomAcc = (e) => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title") || e.textContent || "").trim();
    const champs = [...document.querySelectorAll("input,select,textarea")].filter(vis);
    const sansEtiquette = champs.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby") && !e.getAttribute("title"));
    const boutons = [...document.querySelectorAll("button,a[href],[role=button],[role=tab]")].filter(vis);
    const boutonsSansNom = boutons.filter((e) => !nomAcc(e) && !e.querySelector("img[alt]"));
    const petits = boutons.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
    const tailles = {}; document.querySelectorAll("body *").forEach((e) => { if (!e.childNodes.length) return; const a = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!a || !vis(e)) return; const f = Math.round(parseFloat(getComputedStyle(e).fontSize)); tailles[f] = (tailles[f] || 0) + 1; });
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const octets = res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
    const js = res.filter((r) => /\.js(\?|$)/.test(r.name)).reduce((s, r) => s + (r.transferSize || 0), 0);
    return {
      titre: document.title, lang: document.documentElement.lang, viewportMeta: !!document.querySelector("meta[name=viewport]"),
      h1: document.querySelectorAll("h1").length, h2: document.querySelectorAll("h2").length,
      debordementHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1, largeurDoc: document.documentElement.scrollWidth, largeurFenetre: window.innerWidth,
      champs: champs.length, champsSansEtiquette: sansEtiquette.map((e) => `${e.tagName.toLowerCase()}#${e.id || ""}[${e.type || ""}] ${e.placeholder || ""}`).slice(0, 10),
      interactifs: boutons.length, sansNom: boutonsSansNom.map((e) => e.outerHTML.slice(0, 100)).slice(0, 8), cibles_sous_24px: petits.length,
      taillesTexte: tailles, tailleMin: Math.min(...Object.keys(tailles).map(Number)),
      octetsTransferes: octets, octetsJS: js, nbRequetes: res.length, domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null, load: nav ? Math.round(nav.loadEventEnd) : null,
    };
  });
  m.chargement_ms = p._chargement;
  note(`mesures:${nom}`, m);
  return m;
}

/** Accessibilite : axe-core si disponible */
export async function axe(p, nom) {
  let AxeBuilder;
  try { AxeBuilder = (await import("@axe-core/playwright")).default; } catch { note(`axe:${nom}`, "axe-core indisponible"); return; }
  const r = await new AxeBuilder({ page: p }).analyze();
  note(`axe:${nom}`, r.violations.map((v) => ({ regle: v.id, impact: v.impact, aide: v.help, occurrences: v.nodes.length, exemple: v.nodes[0]?.html?.slice(0, 140), cible: v.nodes[0]?.target?.join(" ") })));
}

/** Nombre de Tab pour atteindre le premier element qui satisfait test() ; -1 si > max */
export async function tabsJusqua(p, test, max = 60) {
  await p.evaluate(() => document.activeElement?.blur?.());
  for (let i = 1; i <= max; i++) { await p.keyboard.press("Tab"); if (await p.evaluate(test)) return i; }
  return -1;
}

/** Indicateur de focus visible ? (contour ou ombre sur l'element actif apres Tab) */
export async function focusVisible(p) {
  await p.evaluate(() => document.activeElement?.blur?.());
  let sans = 0, total = 0; const exemples = [];
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press("Tab");
    const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); const ok = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none"); return { ok, t: (e.getAttribute("aria-label") || e.textContent || e.id || e.tagName).trim().slice(0, 30) }; });
    if (!r) continue; total++; if (!r.ok) { sans++; if (exemples.length < 5) exemples.push(r.t); }
  }
  return { total, sansIndicateur: sans, exemples };
}
