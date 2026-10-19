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

// ===== V10 : fixations et melange de produits =====
const FIX = c.DEFAULT_FIX_SYSTEMS;
const ETOILE = FIX.find(s => s.id === "hft-etoile");
const DRALL = FIX.find(s => s.id === "hft-drallfix");
const DRILL = FIX.find(s => s.id === "hft-drillfast");

test("cheville : la plus courte qui couvre la couche (tableau HFT)", () => {
  assert.equal(c.pickAnchor(ETOILE, 120).id, "8x140"); // fixation max 120
  assert.equal(c.pickAnchor(ETOILE, 100).id, "8x120");
  assert.equal(c.pickAnchor(ETOILE, 160).id, "8x200"); // 8x180 = 150 max, trop court
  assert.equal(c.pickAnchor(ETOILE, 40).id, "8x60");
  assert.equal(c.pickAnchor(ETOILE, 300), null);       // au-dela du catalogue -> alerte
});

test("spirales : abaques Drall-Fix et Drillfast, sinon rien", () => {
  assert.equal(c.pickSpiral(DRALL, 120, 100).id, "U200");
  assert.equal(c.pickSpiral(DRALL, 140, 100).id, "U200"); // ligne 120/140/160
  assert.equal(c.pickSpiral(DRALL, 100, 100).id, "U180");
  assert.equal(c.pickSpiral(DRILL, 120, 100).id, "N200");
  assert.equal(c.pickSpiral(DRILL, 100, 30).id, "N75");
  assert.equal(c.pickSpiral(DRILL, 140, 80), null);       // absent du tableau -> alerte
  assert.equal(c.pickSpiral(DRALL, 180, 40), null);
});

test("systeme de spirale auto selon la rigidite de la 1re couche", () => {
  const fix = c.defaultFix();
  assert.equal(c.spiralSystemFor(fix, FIX, { type: "semi-rigide" }).id, "hft-drallfix");
  assert.equal(c.spiralSystemFor(fix, FIX, { type: "souple" }).id, "hft-drillfast");
  assert.equal(c.spiralSystemFor({ ...fix, spiralSystem: "hft-drillfast" }, FIX, { type: "rigide" }).id, "hft-drillfast");
});

test("fixations d'une zone : cheville sur la 1re couche, spirale ensuite", () => {
  const line = { id: "l1", productId: ISO.id, layers: [120, 100], surface: 7.5 };
  const r = c.lineFixations(line, [ISO], FIX, c.defaultFix()); // 5 par plaque de 0,75 m2
  assert.deepEqual(r.alerts, []);
  assert.equal(r.items[0].articleId, "8x140");
  assert.equal(r.items[1].articleId, "U200");
  assert.equal(Math.round(r.items[0].pieces), 50); // 7,5 m2 = 10 plaques x 5
});

test("fixations : par m2, et alerte si format de plaque inconnu", () => {
  const line = { id: "l1", productId: "x", layers: [100], surface: 10 };
  const prod = { id: "x", name: "Sans format", type: "souple", thicknesses: [] };
  const perM2 = c.lineFixations(line, [prod], FIX, { ...c.defaultFix(), anchorUnit: "m2", anchorQty: 4 });
  assert.equal(perM2.items[0].pieces, 40);
  const perPlate = c.lineFixations(line, [prod], FIX, c.defaultFix());
  assert.equal(perPlate.items.length, 0);
  assert.match(perPlate.alerts[0], /surface de plaque/);
});

test("recap fixations : chute, boites entieres, prix", () => {
  const order = { waste: 5, fix: c.defaultFix(), lines: [
    { id: "l1", productId: ISO.id, layers: [120, 100], surface: 42.5 }
  ] };
  const { rows, alerts } = c.computeFixTotals(order, [ISO], FIX);
  assert.equal(alerts.length, 0);
  const anchor = rows.find(r => r.articleId === "8x140");
  // 42,5 m2 / 0,75 x 5 = 283,3 -> +5 % = 297,5 -> 298 pieces -> 2 boites de 200
  assert.equal(anchor.piecesWaste, 298);
  assert.equal(anchor.boxes, 2);
  assert.equal(anchor.piecesOrdered, 400);
  assert.equal(anchor.price, 54); // 400 x 13,50 / 100
  assert.equal(rows[0].kind, "cheville"); // chevilles listees avant les spirales
});

test("recap fixations : desactive = rien", () => {
  const order = { waste: 5, fix: { ...c.defaultFix(), on: false }, lines: [
    { id: "l1", productId: ISO.id, layers: [120, 100], surface: 42.5 }
  ] };
  assert.equal(c.computeFixTotals(order, [ISO], FIX).rows.length, 0);
});

test("melange : 1re couche produit A, couches suivantes produit B", () => {
  const B = { id: "b", name: "Produit B", lambda: 0.035, thicknesses: [{ t: 100, price: 20 }, { t: 60, price: 12 }] };
  const combos = c.allCombosMixed([120, 100], [100, 60], 2, ISO, B);
  const k = combos.find(x => x.layers.join() === "120,100");
  assert.deepEqual(k.prods, [ISO.id, "b"]);
  assert.equal(k.total, 220);
  assert.equal(k.price, 33.7 + 20);
  assert.ok(combos.every(x => x.prods[0] === ISO.id && x.prods.slice(1).every(id => id === "b")));
  assert.equal(c.allCombosMixed([120], [100], 1, ISO, B).length, 0); // il faut au moins 2 couches
  assert.equal(c.layersLabel([120, 100], [ISO.id, "b"], [ISO, B]), "120 Isover ISORESIST 1000 031 F + 100 Produit B");
  assert.equal(c.layersLabel([120, 100], [ISO.id, ISO.id], [ISO]), "120 + 100 mm");
  // R = 0,12 / 0,031 + 0,10 / 0,035
  assert.ok(Math.abs(c.comboR([120, 100], [ISO.id, "b"], [ISO, B]) - (0.12 / 0.031 + 0.1 / 0.035)) < 1e-9);
});

test("melange : le recap separe les produits", () => {
  const B = { id: "b", name: "Produit B", thicknesses: [{ t: 100, m2Pack: 3, price: 20 }] };
  const order = { waste: 0, lines: [{ id: "l1", productId: ISO.id, productName: ISO.name, prods: [ISO.id, "b"], layers: [120, 100], surface: 9 }] };
  const rows = c.computeTotals(order, [ISO, B]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.productId === "b").packs, 3);
  assert.equal(rows.find(r => r.productId === ISO.id).t, 120);
});

test("migration : fixations et format de plaque ajoutes aux anciennes donnees", () => {
  const s = c.migrate({ products: [{ id: ISO.id, name: ISO.name, thicknesses: [] }], orders: [{ id: "o1", name: "A", lines: [], waste: 5 }], currentOrderId: "o1" });
  assert.equal(s.orders[0].fix.on, true);
  assert.equal(s.fixSystems.length, 3);
  assert.equal(s.products[0].plateArea, 0.75);
});

// ===== V11 : livraisons partielles =====
function bigOrder(pct) {
  return { waste: 5, fix: c.defaultFix(), deliveryPct: pct, deliveries: [],
           lines: [{ id: "l1", productId: ISO.id, productName: ISO.name, layers: [120, 100], surface: 50 }] };
}

test("livraison : 100 % = tout, comme avant", () => {
  const plan = c.deliveryPlan(bigOrder(100), [ISO], FIX);
  assert.equal(plan.active, false);
  const p120 = plan.items.find(i => i.key === `iso|${ISO.id}|120`);
  assert.equal(p120.total, 24);
  assert.equal(p120.now, 24);
});

test("livraison : 80 % puis solde automatique", () => {
  const o = bigOrder(80);
  const plan1 = c.deliveryPlan(o, [ISO], FIX);
  assert.equal(plan1.active, true);
  const k120 = `iso|${ISO.id}|120`;
  assert.equal(plan1.items.find(i => i.key === k120).now, 20);   // 24 x 80 % = 19,2 -> 20 paquets
  assert.equal(plan1.items.find(i => i.key === k120).after, 4);
  const anchor = plan1.items.find(i => i.key === "fix|hft-etoile|8x140");
  assert.equal(anchor.unit, "boîte");
  assert.equal(anchor.total, 2);
  assert.equal(anchor.now, 2);                                   // 2 x 80 % = 1,6 -> 2 boites
  c.recordDelivery(o, plan1, "2026-10-19");
  const plan2 = c.deliveryPlan(o, [ISO], FIX);
  assert.equal(plan2.number, 2);
  assert.equal(plan2.items.find(i => i.key === k120).ordered, 20);
  assert.equal(plan2.items.find(i => i.key === k120).now, 4);    // le solde, pas 20
  assert.equal(anchor.after, 0);
  assert.equal(plan2.items.find(i => i.key === "fix|hft-etoile|8x140").now, 0);
  assert.equal(plan2.isBalance, true);
  c.recordDelivery(o, plan2, "2026-10-26");
  assert.equal(c.deliveryPlan(o, [ISO], FIX).nothingLeft, true);
});

test("livraison : prix de la livraison au prorata des paquets", () => {
  const plan = c.deliveryPlan(bigOrder(50), [ISO], FIX);
  const p120 = plan.items.find(i => i.key === `iso|${ISO.id}|120`);
  assert.equal(p120.now, 12);
  assert.equal(Math.round(p120.price * 100) / 100, Math.round(12 * 2.25 * 33.7 * 100) / 100);
});

test("livraison : zone reduite apres coup -> trop commande signale, rien a proposer", () => {
  const o = bigOrder(100);
  c.recordDelivery(o, c.deliveryPlan(o, [ISO], FIX), "2026-10-19");
  o.lines[0].surface = 20;
  const p120 = c.deliveryPlan(o, [ISO], FIX).items.find(i => i.key === `iso|${ISO.id}|120`);
  assert.equal(p120.now, 0);
  assert.ok(p120.over > 0);
});

test("migration : livraisons ajoutees aux anciennes commandes", () => {
  const s = c.migrate({ products: [{ id: ISO.id, name: ISO.name, thicknesses: [] }], orders: [{ id: "o1", name: "A", lines: [] }], currentOrderId: "o1" });
  assert.equal(s.orders[0].deliveryPct, 100);
  assert.deepEqual(s.orders[0].deliveries, []);
});
