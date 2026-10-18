// Tests automatiques du coeur de calcul de Strate.
// Lancer : node --test   (depuis le dossier du projet)
// Chaque test verifie un resultat qu'on connait a l'avance : si une modification
// casse un calcul, le test passe au rouge avant que l'appli soit mise en ligne.
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../js/core.js");

const ISO = c.DEFAULT_PRODUCTS[0];
const ISO_T = ISO.thicknesses.map(x => x.t);

test("combinaisons : pas de doublon, 1 a N couches", () => {
  const combos = c.allCombos([100, 120], 2, ISO);
  // 100, 120, 100+100, 120+100, 120+120
  assert.equal(combos.length, 5);
  const keys = combos.map(x => [...x.layers].sort().join("+"));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(combos.every(x => x.layers.length >= 1 && x.layers.length <= 2));
});

test("combinaisons : total et prix au m2", () => {
  const combo = c.allCombos(ISO_T, 2, ISO).find(x => x.layers.join() === "120,100");
  assert.equal(combo.total, 220);
  assert.equal(combo.price, 33.7 + 28.2);
});

test("prix : null si une couche n'a pas de prix", () => {
  const p = { thicknesses: [{ t: 100, price: 10 }, { t: 80, price: null }] };
  assert.equal(c.comboPrice([100, 100], p), 20);
  assert.equal(c.comboPrice([100, 80], p), null);
});

test("classement recommande : 220 mm -> 120 + 100 en premier", () => {
  const ok = c.allCombos(ISO_T, 2, ISO).filter(x => x.total >= 220 && x.total <= 230);
  const sorted = c.sortCombos(ok, 220);
  assert.deepEqual(sorted[0].layers, [120, 100]);
  // une seule couche passe toujours devant deux couches
  const single = c.sortCombos(c.allCombos(ISO_T, 2, ISO).filter(x => x.total === 180), 180);
  assert.deepEqual(single[0].layers, [180]);
});

test("classement par prix : le moins cher en premier", () => {
  const ok = c.allCombos(ISO_T, 2, ISO).filter(x => x.total === 220);
  const sorted = c.sortCombos(ok, 220, true);
  assert.equal(sorted[0].price, Math.min(...ok.map(x => x.price)));
});

test("libelle : couches identiques regroupees", () => {
  assert.equal(c.comboLabel([100, 100]), "2 × 100");
  assert.equal(c.comboLabel([100, 120]), "120 + 100");
  assert.equal(c.spread([180, 40]), 140);
});

test("surface : nombre simple ou calcul", () => {
  assert.equal(c.evalSurface("42,5"), 42.5);
  assert.equal(c.evalSurface("12,5*3,2 + 4x2 - 1,2*1,4"), 46.32);
  assert.equal(c.evalSurface(""), null);
  assert.ok(Number.isNaN(c.evalSurface("abc")));
  // securite : rien d'autre que des chiffres et des operateurs n'est execute
  assert.ok(Number.isNaN(c.evalSurface("alert(1)")));
});

test("commande : m2 avec chute, paquets arrondis au superieur, prix", () => {
  const order = { waste: 5, lines: [
    { productId: ISO.id, productName: ISO.name, layers: [120, 100], surface: 42.5 }
  ] };
  const rows = c.computeTotals(order, [ISO]);
  const r120 = rows.find(r => r.t === 120), r100 = rows.find(r => r.t === 100);
  assert.equal(r120.m2, 42.5);
  assert.equal(r120.packs, 20);          // 44,625 m2 / 2,25 = 19,8 -> 20
  assert.equal(r100.packs, 15);          // 44,625 / 3,00 = 14,9 -> 15
  assert.equal(r120.m2Ordered, 45);
  assert.equal(Math.round(r120.price * 100) / 100, 1516.5);
});

test("commande : un compte rond ne rajoute pas de paquet", () => {
  // 20 m2 + 5 % = 21 m2 = exactement 14 paquets de 1,5 m2
  const order = { waste: 5, lines: [{ productId: ISO.id, productName: ISO.name, layers: [180], surface: 20 }] };
  assert.equal(c.computeTotals(order, [ISO])[0].packs, 14);
});

test("commande : surfaces additionnees sur plusieurs zones", () => {
  const order = { waste: 0, lines: [
    { productId: ISO.id, productName: ISO.name, layers: [100], surface: 10 },
    { productId: ISO.id, productName: ISO.name, layers: [100, 100], surface: 5 }
  ] };
  const rows = c.computeTotals(order, [ISO]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].m2, 20); // 10 + 2 couches x 5
});

test("multipacs", () => {
  assert.equal(c.mpText(15, 12), "1 MP + 3 paq.");
  assert.equal(c.mpText(24, 12), "2 MP");
  assert.equal(c.mpText(5, 12), "");
  assert.equal(c.mpText(5, 0), "");
});

test("textes : dates, zones, nombres pour Excel", () => {
  assert.equal(c.frDate("2026-10-18"), "18.10.2026");
  assert.equal(c.frDate(null), "");
  assert.equal(c.zoneLabel({ facade: "Nord", etage: "2e" }), "Façade Nord · Étage 2e");
  assert.equal(c.zoneLabel({}), "Zone");
  assert.equal(c.xlNum(2218.5), "2218,50"); // pas d'espace des milliers
});

test("rigidite deduite de la masse volumique", () => {
  assert.equal(c.typeFromDensity(20), "souple");
  assert.equal(c.typeFromDensity(40), "semi-rigide");
  assert.equal(c.typeFromDensity(120), "rigide");
  assert.equal(c.typeFromDensity(null), null);
});

test("etages dans l'ordre du batiment", () => {
  const sorted = ["2e", "RDC", "Attique", "1er", "Sous-sol", "SS2"].sort((a, b) => c.etageRank(a) - c.etageRank(b));
  assert.deepEqual(sorted, ["SS2", "Sous-sol", "RDC", "1er", "2e", "Attique"]);
});

test("import : lecture des nombres", () => {
  assert.equal(c.parseNum("7,50"), 7.5);
  assert.equal(c.parseNum("1'035.30"), 1035.3);
  assert.equal(c.parseNum("1 035,30"), 1035.3);
  assert.equal(c.parseNum("40 mm"), 40);
  assert.equal(c.parseNum("CHF 11.90"), 11.9);
  assert.ok(Number.isNaN(c.parseNum("Dicke")));
});

test("import : collage Excel avec en-tetes en allemand", () => {
  const grid = c.parsePasted("Dicke mm\tPlatten/EP\tm²/EP\tEP/MP\tm²/MP\tCHF/m²\n40\t10\t7,50\t12\t90,00\t11,90\n60\t6\t4,50\t12\t54,00\t17,30");
  assert.equal(grid.length, 3);
  assert.deepEqual(c.guessRoles(grid), ["t", "", "m2Pack", "packsPerMP", "", "price"]);
});

test("import : texte copie depuis un PDF, sans en-tete", () => {
  const grid = c.parsePasted("40 mm 10 7,50 12\n60 mm 6 4,50 12\n80 mm 5 3,75 12");
  assert.deepEqual(grid[0], ["40", "10", "7,50", "12"]); // "mm" retire
  assert.equal(c.guessRoles(grid)[0], "t");
});

test("migration : ancienne sauvegarde (V2-V4) reprise sans perte", () => {
  const old = {
    products: [{ id: ISO.id, name: ISO.name, type: "semi-rigide", thicknesses: [{ t: 100, on: true }] }],
    currentId: ISO.id,
    inputs: { waste: "8" },
    order: [{ id: "l1", productId: ISO.id, productName: ISO.name, repere: "Sud", layers: [100], surface: 10 }]
  };
  const s = c.migrate(structuredClone(old));
  assert.equal(s.orders.length, 1);
  assert.equal(s.orders[0].waste, 8);
  assert.equal(s.orders[0].lines[0].facade, "Sud");   // ancien "repere"
  assert.equal(s.order, undefined);
  assert.equal(s.products[0].thicknesses[0].m2Pack, 3); // complete depuis le catalogue par defaut
  assert.equal(s.products[0].density, 40);
});
