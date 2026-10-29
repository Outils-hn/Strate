/* Strate - coeur de calcul
   Fonctions "pures" : elles ne touchent ni a la page ni au navigateur.
   C'est ce qui permet de les tester automatiquement (voir tests/).
   Dans le navigateur, elles deviennent des fonctions globales utilisees par app.js ;
   sous Node (tests), elles sont exportees avec module.exports. */
(function (root) {
  "use strict";

  // ===== Catalogue par defaut =====
  // Isover Suisse, ISORESIST 1000 031 F : plaque facade ventilee 60 x 125 cm, ~40 kg/m3, lambda 0,031
  // D'apres la fiche Isover (assortiment) : prix CHF/m2 HT, m2 par colis isole (CI), colis par palette.
  const DEFAULT_PRODUCTS = [
    {
      id: "isoresist-1000-031-f",
      name: "Isover ISORESIST 1000 031 F",
      type: "semi-rigide",
      lambda: 0.031,
      density: 40,
      plateArea: 0.75,   // plaque 60 x 125 cm
      priceDate: "2026-10-19",
      thicknesses: [
        { t: 40,  m2Pack: 9.00, price: 17.30, packsPerMP: 12 },
        { t: 60,  m2Pack: 5.25, price: 25.00, packsPerMP: 12 },
        { t: 80,  m2Pack: 4.50, price: 32.85, packsPerMP: 12 },
        { t: 100, m2Pack: 3.75, price: 40.60, packsPerMP: 12 },
        { t: 120, m2Pack: 3.00, price: 48.65, packsPerMP: 12 },
        { t: 140, m2Pack: 2.25, price: 55.95, packsPerMP: 12 },
        { t: 160, m2Pack: 2.25, price: 63.20, packsPerMP: 12 },
        { t: 180, m2Pack: 1.50, price: 71.05, packsPerMP: 16 },
        { t: 200, m2Pack: 1.50, price: 79.20, packsPerMP: 16 }
      ].map(x => ({ ...x, on: true }))
    }
  ];
  // Anciennes valeurs par defaut (V2 a V13, fiche CRB perimee) : corrigees automatiquement
  // si l'utilisateur ne les a pas modifiees. [m2 par colis, prix]
  const OLD_ISORESIST = { 40: [7.5, 11.9], 60: [4.5, 17.3], 80: [3.75, 22.8], 100: [3, 28.2], 120: [2.25, 33.7],
                          140: [1.5, 38.9], 160: [1.5, 43.9], 180: [1.5, 49.3], 200: [1.5, 54.9] };

  // ===== Fixations par defaut : catalogue HFT 09/2026 =====
  // Chevilles (1re couche, cote mur) : on prend la plus courte dont la
  // "fixation max" (epaisseur d'isolant maxi) couvre la couche.
  // Spirales (couches suivantes) : tableau du fournisseur
  // (epaisseur deja posee = base, epaisseur de la couche a fixer = add).
  const art = (id, artNo, max, price100, pack) => ({ id, name: id, art: artNo, max, price100, pack });
  const DEFAULT_FIX_SYSTEMS = [
    {
      id: "hft-etoile", name: "HFT Étoile d'isolation (1 et 2 pièces)", kind: "cheville",
      priceNote: "prix nets HFT 09/2026",
      articles: [
        art("8x60", "A038060", 40, 7.00, 250), art("8x80", "A038080", 60, 8.50, 250),
        art("8x100", "A038100", 80, 10.50, 250), art("8x120", "A038120", 100, 12.00, 250),
        art("8x140", "A038140", 120, 13.50, 200), art("8x160", "A038160", 140, 14.50, 200),
        art("8x180", "231508180", 150, 13.50, 250), art("8x200", "231508200", 170, 14.00, 250),
        art("8x220", "231508220", 190, 15.50, 250), art("8x240", "231508240", 210, 17.50, 250),
        art("8x260", "231508260", 230, 20.50, 250), art("8x280", "231508280", 250, 25.50, 250),
        art("8x300", "231508300", 270, 27.50, 250)
      ]
    },
    {
      // Pour une isolation de base plutot dure (semi-rigide, rigide)
      id: "hft-drallfix", name: "HFT Drall-Fix type U (spirale, base dure)", kind: "spirale", hardness: "dur",
      priceNote: "prix bruts HFT 09/2026",
      articles: [
        art("U80", "", null, null, null),  // cite dans l'abaque mais absent de la liste de prix
        art("U100", "VS000010", null, 46.00, 500), art("U120", "VS000012", null, 49.00, 250),
        art("U140", "VS000014", null, 54.50, 250), art("U160", "VS000016", null, 71.50, 500),
        art("U180", "VS000018", null, 90.00, 500), art("U200", "VS000020", null, 107.00, 250),
        art("U220", "VS000022", null, 126.50, 250), art("U240", "VS000024", null, 143.50, 250),
        art("U260", "VS000026", null, 161.00, 250), art("U280", "VS000028", null, 190.00, 250),
        art("U300", "VS000030", null, 198.00, 250), art("U320", "VS000032", null, 238.00, 250),
        art("U340", "VS000034", null, 267.00, 250)
      ],
      // Abaque Drall-Fix. Quand l'abaque donne deux types pour une meme epaisseur,
      // on a retenu le plus long (meilleur ancrage, mini 60 mm dans la base).
      rules: [
        [80, 80, 20, "U80"], [80, 80, 30, "U100"], [80, 80, 40, "U100"],
        [100, 100, 20, "U80"], [100, 100, 30, "U100"], [100, 100, 40, "U120"], [100, 100, 50, "U140"],
        [100, 100, 60, "U140"], [100, 100, 80, "U160"], [100, 100, 100, "U180"],
        [120, 160, 30, "U100"], [120, 160, 40, "U120"], [120, 160, 50, "U140"], [120, 160, 60, "U140"],
        [120, 160, 80, "U160"], [120, 160, 100, "U200"], [120, 160, 120, "U220"]
      ].map(([baseMin, baseMax, add, article]) => ({ baseMin, baseMax, add, article }))
    },
    {
      // Pour une isolation de base plutot molle (souple)
      id: "hft-drillfast", name: "HFT Drillfast type N (spirale, base souple)", kind: "spirale", hardness: "souple",
      priceNote: "prix bruts HFT 09/2026",
      articles: [
        art("N75", "VS000075", null, 31.50, 250), art("N100", "VS000100", null, 46.00, 200),
        art("N125", "VS000125", null, 47.00, 200), art("N150", "VS000150", null, 60.50, 150),
        art("N175", "VS000175", null, 69.00, 100), art("N200", "VS000200", null, 75.50, 100),
        art("N225", "VS000225", null, 84.00, 100), art("N250", "VS000250", null, 90.00, 100)
      ],
      // Valeurs directives Drillfast
      rules: [
        [100, 30, "N75"], [100, 40, "N100"], [100, 50, "N125"], [100, 60, "N125"], [100, 80, "N150"],
        [120, 80, "N175"], [120, 100, "N200"], [140, 100, "N225"], [140, 120, "N250"]
      ].map(([base, add, article]) => ({ baseMin: base, baseMax: base, add, article }))
    }
  ];

  // Reglages de fixation d'une commande (modifiables dans l'appli)
  function defaultFix() {
    return { on: true, anchorSystem: "hft-etoile", anchorQty: 5, anchorUnit: "plaque",
             spiralSystem: "auto", spiralQty: 5, spiralUnit: "plaque" };
  }

  // Format francais : 7,10 au lieu de 7.10
  // Separateur de milliers a la suisse (apostrophe), virgule decimale : 2'700,50
  const swiss = s => s.replace(/[\u202f\u00a0 ]/g, "'");
  const fmt = (v, d = 2) => swiss(Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));

  const fmt0 = v => swiss(Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 }));

  function newOrder(name) {
    return { id: "o" + Date.now() + Math.floor(Math.random() * 1000), name, lines: [], waste: 5, fix: defaultFix(),
             deliveryPct: 100, deliveries: [] };
  }

  // Les catalogues sauves par la V1 n'ont pas les m2/paquet ni les prix :
  // on complete a partir du catalogue par defaut quand le produit correspond
  function migrate(s) {
    s.inputs = s.inputs || {};
    // V2-V4 : une seule commande "order" -> devient la premiere commande nommee en V5
    if (!Array.isArray(s.orders) || !s.orders.length) {
      const o = newOrder("Commande 1");
      o.lines = Array.isArray(s.order) ? s.order : [];
      if (s.inputs.waste !== undefined && s.inputs.waste !== "") o.waste = Number(s.inputs.waste) || 0;
      s.orders = [o];
      s.currentOrderId = o.id;
    }
    delete s.order;
    if (!s.orders.some(o => o.id === s.currentOrderId)) s.currentOrderId = s.orders[0].id;
    // V2 : un seul champ "repere" -> devient la facade en V3
    s.orders.forEach(o => o.lines.forEach(l => { if (l.repere && !l.facade) { l.facade = l.repere; delete l.repere; } }));
    // V10 : fixations
    s.orders.forEach(o => { o.fix = Object.assign(defaultFix(), o.fix || {}); });
    // V11 : livraisons partielles
    s.orders.forEach(o => {
      if (o.deliveryPct == null) o.deliveryPct = 100;
      if (!Array.isArray(o.deliveries)) o.deliveries = [];
    });
    if (!Array.isArray(s.fixSystems)) s.fixSystems = JSON.parse(JSON.stringify(DEFAULT_FIX_SYSTEMS));
    // V10 : melange de 2 produits
    s.mix = s.mix || { on: false, outerId: null };
    s.products.forEach(p => {
      const def = DEFAULT_PRODUCTS.find(d => d.id === p.id);
      if (def && p.priceDate == null) p.priceDate = def.priceDate;
      if (def && p.density == null) p.density = def.density;
      if (def && p.plateArea == null) p.plateArea = def.plateArea;
      p.thicknesses.forEach(item => {
        const d = def && def.thicknesses.find(x => x.t === item.t);
        // V13.2 : correction des donnees Isoresist erronees, seulement si elles n'ont pas ete retouchees
        const old = def && OLD_ISORESIST[item.t];
        if (d && old && item.m2Pack === old[0] && item.price === old[1]) {
          item.m2Pack = d.m2Pack; item.price = d.price; item.packsPerMP = d.packsPerMP;
          p.priceDate = def.priceDate;
        }
        // Colis par palette : desormais par epaisseur (avant : une valeur pour tout le produit)
        if (item.packsPerMP == null && p.packsPerMP) item.packsPerMP = p.packsPerMP;
        if (d) {
          if (item.m2Pack == null) item.m2Pack = d.m2Pack;
          if (item.price == null) item.price = d.price;
          if (item.packsPerMP == null && d.packsPerMP) item.packsPerMP = d.packsPerMP;
        }
      });
    });
    return s;
  }

  // ===== Coeur du calcul =====
  // Enumere toutes les combinaisons de 1 a maxLayers couches (repetition permise,
  // ex. 2 x 100). On genere en ordre decroissant pour eviter les doublons
  // (120+100 et 100+120 sont la meme combinaison).
  function allCombos(thicknesses, maxLayers, product) {
    const list = [...new Set(thicknesses)].sort((a, b) => b - a);
    const out = [];
    function rec(start, current) {
      if (current.length) out.push([...current]);
      if (current.length === maxLayers) return;
      for (let i = start; i < list.length; i++) {
        current.push(list[i]);
        rec(i, current);
        current.pop();
      }
    }
    rec(0, []);
    return out.map(layers => ({ layers, total: layers.reduce((a, b) => a + b, 0), price: product ? comboPrice(layers, product) : null }));
  }

  // Melange : 1re couche (cote mur) dans le produit A, couches suivantes dans le produit B.
  // Chaque combinaison garde la liste des produits couche par couche (prods).
  function allCombosMixed(tA, tB, maxLayers, prodA, prodB) {
    if (maxLayers < 2) return [];
    const out = [];
    [...new Set(tA)].sort((a, b) => b - a).forEach(a => {
      allCombos(tB, maxLayers - 1, prodB).forEach(rest => {
        const layers = [a, ...rest.layers];
        const prods = [prodA.id, ...rest.layers.map(() => prodB.id)];
        const pa = comboPrice([a], prodA);
        const price = pa != null && rest.price != null ? pa + rest.price : null;
        out.push({ layers, prods, total: a + rest.total, price });
      });
    });
    return out;
  }

  // Produits couche par couche d'une zone de commande (anciennes zones : un seul produit)
  function layerProducts(line) {
    return Array.isArray(line.prods) && line.prods.length === line.layers.length
      ? line.prods : line.layers.map(() => line.productId);
  }

  function isMixed(prods) {
    return !!prods && new Set(prods).size > 1;
  }

  // Libelle d'une composition ; si plusieurs produits, on nomme chaque couche
  function layersLabel(layers, prods, products) {
    if (!isMixed(prods)) return comboLabel(layers) + " mm";
    const name = id => (products.find(p => p.id === id) || {}).name || "?";
    return layers.map((t, i) => `${t} ${name(prods[i])}`).join(" + ");
  }

  // Resistance thermique R = somme (epaisseur / lambda) ; null si un lambda manque
  function comboR(layers, prods, products) {
    let r = 0;
    for (let i = 0; i < layers.length; i++) {
      const p = products.find(x => x.id === prods[i]);
      const lambda = p && Number(p.lambda);
      if (!lambda) return null;
      r += layers[i] / 1000 / lambda;
    }
    return r;
  }

  // Prix au m2 d'une combinaison = somme des prix au m2 de chaque couche
  // (null si une couche n'a pas de prix dans le catalogue)
  function comboPrice(layers, product) {
    let sum = 0;
    for (const t of layers) {
      const item = product.thicknesses.find(x => x.t === t);
      if (!item || item.price == null) return null;
      sum += item.price;
    }
    return sum;
  }

  // Tri : d'abord le moins de couches, puis le plus petit ecart a la cible,
  // puis on prefere etre au-dessus plutot qu'en dessous, puis le moins de references differentes
  function sortCombos(combos, target, byPrice = false) {
    if (byPrice) {
      // Le moins cher d'abord ; une combinaison sans prix connu passe en dernier
      const price = c => c.price ?? Infinity;
      return combos.sort((a, b) =>
        price(a) - price(b) ||
        a.layers.length - b.layers.length ||
        Math.abs(a.total - target) - Math.abs(b.total - target));
    }
    return combos.sort((a, b) =>
      a.layers.length - b.layers.length ||
      Math.abs(a.total - target) - Math.abs(b.total - target) ||
      (b.total >= target) - (a.total >= target) ||
      new Set(a.layers).size - new Set(b.layers).size ||
      spread(a.layers) - spread(b.layers)
    );
  }

  // Ecart entre la couche la plus epaisse et la plus fine : on prefere
  // 120 + 100 a 180 + 40 (une couche tres fine est penible a poser)
  function spread(layers) {
    return Math.max(...layers) - Math.min(...layers);
  }

  function comboLabel(layers) {
    // Regroupe les couches identiques : 100 + 100 -> 2 x 100
    const counts = {};
    layers.forEach(t => counts[t] = (counts[t] || 0) + 1);
    return Object.keys(counts).map(Number).sort((a, b) => b - a)
      .map(t => counts[t] > 1 ? `${counts[t]} × ${t}` : `${t}`).join(" + ");
  }

  // ===== Commande =====
  // Surface : accepte un nombre ou un petit calcul (12,5*3,2 + 4*2,5 - 1,2*1,4)
  // pour additionner les panneaux d'une facade et retirer les ouvertures.
  // On n'autorise que chiffres, operateurs et parentheses avant d'evaluer.
  function evalSurface(raw) {
    const s = String(raw || "").trim().replace(/,/g, ".").replace(/[x×]/gi, "*").replace(/\s+/g, "");
    if (!s) return null;
    if (!/^[\d.+\-*/()]+$/.test(s)) return NaN;
    try {
      const v = Function(`"use strict"; return (${s});`)();
      return typeof v === "number" && isFinite(v) ? Math.round(v * 100) / 100 : NaN;
    } catch (e) { return NaN; }
  }

  // Recap d'une commande : m2 par produit et par epaisseur, chute, colis, palettes, prix
  function computeTotals(order, products) {
    const waste = Math.max(0, Number(order.waste) || 0) / 100;
    const map = new Map();
    order.lines.forEach(line => {
      const prods = layerProducts(line);
      line.layers.forEach((t, i) => {
        const pid = prods[i];
        const key = pid + "|" + t;
        const pname = (products.find(p => p.id === pid) || {}).name || line.productName;
        const cur = map.get(key) || { productId: pid, productName: pname, t, m2: 0 };
        cur.m2 += line.surface;
        map.set(key, cur);
      });
    });
    return [...map.values()]
      .sort((a, b) => a.productName.localeCompare(b.productName) || b.t - a.t)
      .map(row => {
        const product = products.find(p => p.id === row.productId);
        const item = product && product.thicknesses.find(x => x.t === row.t);
        const m2Pack = item && item.m2Pack;
        const perMP = (item && item.packsPerMP) || (product && product.packsPerMP) || 0;
        const m2Waste = row.m2 * (1 + waste);
        // Arrondi au colis superieur : on ne commande pas un demi-colis
        // (petit epsilon pour eviter qu'une imprecision de calcul ajoute un colis)
        const packs = m2Pack ? Math.ceil(m2Waste / m2Pack - 1e-9) : null;
        const m2Ordered = packs != null ? packs * m2Pack : null;
        const price = item && item.price && m2Ordered != null ? m2Ordered * item.price : null;
        return { ...row, m2Waste, m2Pack, packs, perMP, m2Ordered, price };
      });
  }

  // ===== Fixations =====
  // Cheville pour la 1re couche : la plus courte dont la fixation max couvre l'epaisseur
  function pickAnchor(system, t) {
    if (!system) return null;
    return system.articles.filter(a => a.max != null && a.max >= t).sort((a, b) => a.max - b.max)[0] || null;
  }

  // Spirale : on cherche la regle exacte du fournisseur (sinon null -> alerte, on ne devine pas)
  function pickSpiral(system, base, add) {
    if (!system || !system.rules) return null;
    const rule = system.rules.find(r => base >= r.baseMin && base <= r.baseMax && add === r.add);
    return rule ? system.articles.find(a => a.id === rule.article) || null : null;
  }

  // Systeme de spirale : choisi dans la commande, ou "auto" selon la rigidite de la 1re couche
  function spiralSystemFor(fix, systems, baseProduct) {
    const spirals = systems.filter(s => s.kind === "spirale");
    if (fix.spiralSystem && fix.spiralSystem !== "auto") return spirals.find(s => s.id === fix.spiralSystem) || null;
    const want = baseProduct && baseProduct.type === "souple" ? "souple" : "dur";
    return spirals.find(s => s.hardness === want) || spirals[0] || null;
  }

  // Fixations d'une zone : une entree par couche, ou une alerte si rien ne convient
  function lineFixations(line, products, systems, fix) {
    const items = [], alerts = [];
    if (!fix || !fix.on) return { items, alerts };
    const prods = layerProducts(line);
    const anchorSys = systems.find(s => s.id === fix.anchorSystem && s.kind === "cheville")
      || systems.find(s => s.kind === "cheville");
    const spiralSys = spiralSystemFor(fix, systems, products.find(p => p.id === prods[0]));
    let base = 0;
    line.layers.forEach((t, i) => {
      const product = products.find(p => p.id === prods[i]);
      const first = i === 0;
      const sys = first ? anchorSys : spiralSys;
      const qty = Number(first ? fix.anchorQty : fix.spiralQty) || 0;
      const unit = first ? fix.anchorUnit : fix.spiralUnit;
      const what = first ? "cheville" : "spirale";
      const article = first ? pickAnchor(sys, t) : pickSpiral(sys, base, t);
      if (!sys) alerts.push(`aucun système de ${what} dans le catalogue`);
      else if (!article) alerts.push(first
        ? `aucune cheville ${sys.name} pour ${t} mm`
        : `aucune spirale ${sys.name} pour ${t} mm sur ${base} mm`);
      else {
        let perM2 = qty;
        if (unit === "plaque") {
          const area = product && Number(product.plateArea);
          if (!area) { alerts.push(`surface de plaque manquante pour ${product ? product.name : "?"}`); perM2 = null; }
          else perM2 = qty / area;
        }
        if (perM2 != null && qty > 0) items.push({ systemId: sys.id, articleId: article.id, layer: i, pieces: line.surface * perM2 });
      }
      base += t;
    });
    return { items, alerts };
  }

  // Recap fixations d'une commande : pieces + chute, boites entieres, prix
  function computeFixTotals(order, products, systems) {
    const fix = order.fix;
    const waste = Math.max(0, Number(order.waste) || 0) / 100;
    const map = new Map(), alerts = [];
    order.lines.forEach(line => {
      const r = lineFixations(line, products, systems, fix);
      r.alerts.forEach(a => alerts.push({ lineId: line.id, zone: zoneLabel(line), text: a }));
      r.items.forEach(it => {
        const key = it.systemId + "|" + it.articleId;
        const cur = map.get(key) || { systemId: it.systemId, articleId: it.articleId, pieces: 0 };
        cur.pieces += it.pieces;
        map.set(key, cur);
      });
    });
    const rows = [...map.values()].map(row => {
      const sys = systems.find(s => s.id === row.systemId);
      const a = sys.articles.find(x => x.id === row.articleId);
      // Arrondi a la piece superieure, puis a la boite superieure
      const piecesWaste = Math.ceil(row.pieces * (1 + waste) - 1e-9);
      const boxes = a.pack ? Math.ceil(piecesWaste / a.pack) : null;
      const piecesOrdered = boxes != null ? boxes * a.pack : piecesWaste;
      const price = a.price100 != null ? piecesOrdered * a.price100 / 100 : null;
      return { ...row, systemName: sys.name, kind: sys.kind, priceNote: sys.priceNote || "", name: a.name, art: a.art,
               pack: a.pack, price100: a.price100, piecesWaste, boxes, piecesOrdered, price };
    }).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "cheville" ? -1 : 1) || naturalSort(a.name, b.name));
    return { rows, alerts };
  }

  // ===== Livraisons partielles =====
  // Chaque livraison = X % du total (arrondi a l'unite de commande superieure),
  // sans jamais depasser ce qui reste. Avec 80 % puis 80 %, la 2e livraison
  // propose donc automatiquement le solde.
  // Unite de commande : colis pour l'isolant, boite pour les fixations
  // (a defaut : m2 ou pieces si le conditionnement est inconnu).
  function deliveryPlan(order, products, systems) {
    const pct = Math.min(100, Math.max(0, Number(order.deliveryPct) || 0));
    const done = {};
    (order.deliveries || []).forEach(d => Object.entries(d.items || {}).forEach(([k, v]) => { done[k] = (done[k] || 0) + v; }));
    const items = [];
    computeTotals(order, products).forEach(r => {
      const byPack = r.packs != null;
      const total = byPack ? r.packs : Math.round(r.m2Waste * 100) / 100;
      items.push({ key: `iso|${r.productId}|${r.t}`, kind: "iso", label: `${r.t} mm`, productName: r.productName,
                   unit: byPack ? "colis" : "m²", total, unitPrice: r.price != null && byPack && r.packs ? r.price / r.packs : null,
                   m2PerUnit: byPack ? r.m2Pack : 1 });
    });
    computeFixTotals(order, products, systems).rows.forEach(r => {
      const byBox = r.boxes != null;
      const total = byBox ? r.boxes : r.piecesWaste;
      items.push({ key: `fix|${r.systemId}|${r.articleId}`, kind: "fix", label: r.name, productName: r.systemName, art: r.art,
                   unit: byBox ? "boîte" : "pcs", total, unitPrice: r.price != null && total ? r.price / total : null,
                   piecesPerUnit: byBox ? r.pack : 1 });
    });
    // Articles deja commandes qui ne sont plus dans le besoin (zone supprimee...) : on les montre quand meme
    Object.keys(done).forEach(k => {
      if (!items.some(it => it.key === k)) {
        const [kind, , last] = k.split("|");
        items.push({ key: k, kind, label: kind === "iso" ? `${last} mm` : last, productName: "", unit: "", total: 0, unitPrice: null });
      }
    });
    items.forEach(it => {
      it.ordered = done[it.key] || 0;
      const remaining = Math.max(0, it.total - it.ordered);
      const share = it.unit === "m²" ? Math.round(it.total * pct) / 100 : Math.ceil(it.total * pct / 100 - 1e-9);
      it.now = Math.min(remaining, share);
      it.after = Math.max(0, it.total - it.ordered - it.now);
      it.over = it.ordered > it.total ? it.ordered - it.total : 0;   // trop commande (zones reduites depuis)
      it.price = it.unitPrice != null ? it.now * it.unitPrice : null;
    });
    const number = (order.deliveries || []).length + 1;
    const active = pct < 100 || number > 1;
    const isBalance = number > 1 && items.every(it => it.after === 0);
    return { pct, number, active, isBalance, items, nothingLeft: items.every(it => it.now === 0) };
  }

  // Enregistre la livraison proposee (a faire une fois la commande envoyee)
  function recordDelivery(order, plan, date) {
    const items = {};
    plan.items.forEach(it => { if (it.now > 0) items[it.key] = it.now; });
    order.deliveries = order.deliveries || [];
    order.deliveries.push({ id: "d" + Date.now(), n: plan.number, date, pct: plan.pct, balance: plan.isBalance, items });
    return order;
  }

  // Texte court des fixations d'une zone (Excel, PDF) : "8x140 + U200"
  function lineFixLabel(line, products, systems, fix) {
    const r = lineFixations(line, products, systems, fix);
    if (!fix || !fix.on) return "";
    const names = r.items.map(it => it.articleId);
    return names.join(" + ") + (r.alerts.length ? (names.length ? " + " : "") + "⚠" : "");
  }

  function mpText(packs, perMP) {
    // Decompose en palettes + colis : 15 colis avec 12 colis/palette -> 1 pal. + 3 colis
    if (!perMP || packs < perMP) return "";
    const mp = Math.floor(packs / perMP), rest = packs % perMP;
    return `${mp} pal.${rest ? ` + ${rest} colis` : ""}`;
  }

  function frDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function zoneLabel(l) {
    const parts = [];
    if (l.facade) parts.push(`Façade ${l.facade}`);
    if (l.etage) parts.push(`Étage ${l.etage}`);
    return parts.length ? parts.join(" · ") : "Zone";
  }

  // Nombre sans separateur de milliers (l'espace fine empecherait Excel de reconnaitre un nombre)
  function xlNum(v, d = 2) {
    return Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });
  }

  // ===== Catalogue =====
  // Repere de rigidite d'apres la masse volumique (laines minerales).
  // Les mousses (PIR, EPS, XPS) sont rigides meme tres legeres : d'ou la mention.
  function typeFromDensity(d) {
    if (!d) return null;
    if (d < 30) return "souple";
    if (d <= 90) return "semi-rigide";
    return "rigide";
  }

  // ===== Bon de commande =====
  function naturalSort(a, b) {
    return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
  }

  // Ordre des etages comme dans un batiment : sous-sols, rez, puis 1er, 2e...
  // (les noms inconnus passent apres, dans l'ordre alphabetique)
  function etageRank(e) {
    const s = String(e || "").toLowerCase().trim();
    if (!s) return 999;
    const num = parseInt((s.match(/-?\d+/) || [])[0], 10);
    if (/sous|^ss|^s-?\d|^-/.test(s)) return -(isNaN(num) ? 1 : Math.abs(num));
    if (/rdc|rez|^r$|^eg$|^0$/.test(s)) return 0;
    if (!isNaN(num)) return num;
    return 500;
  }

  // ===== Dates =====
  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // ===== Import d'un tableau colle =====
  // Transforme le texte colle en grille.
  // - depuis Excel / Power Query : colonnes separees par des tabulations
  // - depuis un PDF : souvent de simples espaces -> on coupe sur les espaces
  function parsePasted(raw) {
    const lines = raw.replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    if (lines.some(l => l.includes("\t"))) return lines.map(l => l.split("\t").map(c => c.trim()));
    return lines.map(l => l
      .replace(/(\d)\s*mm\b/gi, "$1")   // "40 mm" -> "40" pour ne pas creer une colonne "mm"
      .split(/\s+/).filter(Boolean));
  }

  // Lit un nombre ecrit a la francaise, a la suisse ou a l'anglaise : "7,50" "1'035.30" "40 mm"
  function parseNum(cell) {
    if (cell == null) return NaN;
    let s = String(cell).replace(/mm|m²|m2|chf|fr\.?/gi, "").replace(/['’\s  ]/g, "");
    if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }

  // Devine le role de chaque colonne : d'abord grace a l'en-tete (francais ou allemand),
  // sinon grace aux valeurs (la colonne epaisseur = entiers croissants entre 10 et 500)
  function guessRoles(grid) {
    const cols = Math.max(...grid.map(r => r.length));
    const roles = Array(cols).fill("");
    const header = grid[0].map(c => c.toLowerCase());
    const headerIsText = grid[0].filter(c => isNaN(parseNum(c))).length >= Math.ceil(cols / 2);
    if (headerIsText) {
      header.forEach((h, i) => {
        if (!roles.includes("t") && /(épaisseur|epaisseur|dicke|stärke|staerke|^mm$|ép\.)/.test(h)) roles[i] = "t";
        else if (!roles.includes("price") && /(prix|preis|chf|fr\.)/.test(h)) roles[i] = "price";
        else if (!roles.includes("packsPerMP") && /(palette|multipa|\bmp\b|ep\s*\/\s*mp|pakete\s*\/\s*mp|colis\s*\/\s*pal|\bci\b)/.test(h) && !/(m²|m2)/.test(h)) roles[i] = "packsPerMP";
        else if (!roles.includes("m2Pack") && /(m²|m2)/.test(h) && /(paquet|paket|\bep\b|emballage|colis|pack|\bci\b)/.test(h)) roles[i] = "m2Pack";
      });
    }
    if (!roles.includes("t")) {
      const body = headerIsText ? grid.slice(1) : grid;
      for (let i = 0; i < cols; i++) {
        const v = body.map(r => parseNum(r[i])).filter(n => !isNaN(n));
        const looksLikeThickness = v.length >= 2 && v.length >= body.length * 0.6 &&
          v.every(n => Number.isInteger(n) && n >= 10 && n <= 500) &&
          v.every((n, k) => k === 0 || n > v[k - 1]);
        if (looksLikeThickness) { roles[i] = "t"; break; }
      }
    }
    return roles;
  }

  // ===== Catalogue commun a l'equipe (Supabase, projet de Masse) =====
  // Empreinte stable d'un element du catalogue (ordre des cles fige) pour savoir s'il a change.
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
    return JSON.stringify(v ?? null);
  }

  /**
   * Fusionne une liste locale (produits ou systemes de fixation) avec le catalogue commun.
   * - base : derniere version recue de l'equipe pour chaque id (sert a reperer les modifs locales) ;
   * - element commun pas modifie ici : version de l'equipe ;
   * - element commun modifie ici et pas encore envoye : garde la version locale (« modifie ») ;
   * - element supprime par l'equipe : retire, sauf s'il est modifie ici ou utilise par une commande ;
   * - element jamais partage : garde, « sur ce poste ».
   * Renvoie la liste fusionnee, l'etat de chaque id et la nouvelle base.
   */
  function mergeShared(local, remote, base, used = new Set()) {
    const byId = new Map(remote.map(r => [r.id, r]));
    const out = [], status = {}, newBase = {};
    let updated = 0;
    for (const item of local) {
      const r = byId.get(item.id);
      if (!r) { out.push(item); status[item.id] = "local"; continue; }
      const modified = base[item.id] != null && stable(item) !== base[item.id];
      if (r.deleted_at) {
        if (modified || used.has(item.id)) { out.push(item); status[item.id] = "local"; }
        continue;
      }
      const remoteData = { ...r.data, id: r.id };
      newBase[r.id] = stable(remoteData);
      if (modified && stable(item) !== newBase[r.id]) { out.push(item); status[item.id] = "modified"; continue; }
      if (stable(item) !== newBase[r.id]) updated++;
      out.push(remoteData); status[r.id] = "shared";
    }
    const localIds = new Set(local.map(x => x.id));
    for (const r of remote) {
      if (r.deleted_at || localIds.has(r.id)) continue;
      const remoteData = { ...r.data, id: r.id };
      newBase[r.id] = stable(remoteData);
      out.push(remoteData); status[r.id] = "shared"; updated++;
    }
    return { items: out, status, base: newBase, updated };
  }

  /** Etat d'un element apres une modif locale (sans nouvelle lecture du catalogue commun). */
  function sharedStatus(item, base) {
    if (base[item.id] == null) return "local";
    return stable(item) === base[item.id] ? "shared" : "modified";
  }

  const api = { DEFAULT_PRODUCTS, deliveryPlan, recordDelivery, DEFAULT_FIX_SYSTEMS, defaultFix, allCombosMixed, layerProducts, isMixed, layersLabel, comboR, pickAnchor, pickSpiral, spiralSystemFor, lineFixations, computeFixTotals, lineFixLabel, fmt, fmt0, newOrder, migrate, allCombos, comboPrice, sortCombos, spread, comboLabel, evalSurface, computeTotals, mpText, frDate, zoneLabel, xlNum, typeFromDensity, naturalSort, etageRank, todayIso, parsePasted, parseNum, guessRoles, stable, mergeShared, sharedStatus };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
