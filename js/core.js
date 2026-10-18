/* Strate - coeur de calcul
   Fonctions "pures" : elles ne touchent ni a la page ni au navigateur.
   C'est ce qui permet de les tester automatiquement (voir tests/).
   Dans le navigateur, elles deviennent des fonctions globales utilisees par app.js ;
   sous Node (tests), elles sont exportees avec module.exports. */
(function (root) {
  "use strict";

  // ===== Catalogue par defaut =====
  // Isover Suisse, ISORESIST 1000 031 F : plaque facade ventilee 60 x 125 cm, ~40 kg/m3
  // m2 par paquet (EP) et prix CHF/m2 HT d'apres la fiche produit CRB
  const DEFAULT_PRODUCTS = [
    {
      id: "isoresist-1000-031-f",
      name: "Isover ISORESIST 1000 031 F",
      type: "semi-rigide",
      lambda: 0.031,
      density: 40,
      packsPerMP: 12,
      priceDate: "2026-10-18",
      thicknesses: [
        { t: 40,  m2Pack: 7.50, price: 11.90 },
        { t: 60,  m2Pack: 4.50, price: 17.30 },
        { t: 80,  m2Pack: 3.75, price: 22.80 },
        { t: 100, m2Pack: 3.00, price: 28.20 },
        { t: 120, m2Pack: 2.25, price: 33.70 },
        { t: 140, m2Pack: 1.50, price: 38.90, packsPerMP: 16 },
        { t: 160, m2Pack: 1.50, price: 43.90 },
        { t: 180, m2Pack: 1.50, price: 49.30 },
        { t: 200, m2Pack: 1.50, price: 54.90 }
      ].map(x => ({ ...x, on: true }))
    }
  ];

  // Format francais : 7,10 au lieu de 7.10
  const fmt = (v, d = 2) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

  const fmt0 = v => Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  function newOrder(name) {
    return { id: "o" + Date.now() + Math.floor(Math.random() * 1000), name, lines: [], waste: 5 };
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
    s.products.forEach(p => {
      const def = DEFAULT_PRODUCTS.find(d => d.id === p.id);
      if (def && p.packsPerMP == null) p.packsPerMP = def.packsPerMP;
      if (def && p.priceDate == null) p.priceDate = def.priceDate;
      if (def && p.density == null) p.density = def.density;
      p.thicknesses.forEach(item => {
        const d = def && def.thicknesses.find(x => x.t === item.t);
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

  // Recap d'une commande : m2 par produit et par epaisseur, chute, paquets, prix
  function computeTotals(order, products) {
    const waste = Math.max(0, Number(order.waste) || 0) / 100;
    const map = new Map();
    order.lines.forEach(line => {
      line.layers.forEach(t => {
        const key = line.productId + "|" + t;
        const cur = map.get(key) || { productId: line.productId, productName: line.productName, t, m2: 0 };
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
        // Arrondi au paquet superieur : on ne commande pas un demi-paquet
        // (petit epsilon pour eviter qu'une imprecision de calcul ajoute un paquet)
        const packs = m2Pack ? Math.ceil(m2Waste / m2Pack - 1e-9) : null;
        const m2Ordered = packs != null ? packs * m2Pack : null;
        const price = item && item.price && m2Ordered != null ? m2Ordered * item.price : null;
        return { ...row, m2Waste, m2Pack, packs, perMP, m2Ordered, price };
      });
  }

  function mpText(packs, perMP) {
    // Decompose en multipacs + paquets : 15 paquets avec 12/MP -> 1 MP + 3 paquets
    if (!perMP || packs < perMP) return "";
    const mp = Math.floor(packs / perMP), rest = packs % perMP;
    return `${mp} MP${rest ? ` + ${rest} paq.` : ""}`;
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
        else if (!roles.includes("packsPerMP") && /(multipa|\bmp\b|ep\s*\/\s*mp|pakete\s*\/\s*mp)/.test(h)) roles[i] = "packsPerMP";
        else if (!roles.includes("m2Pack") && /(m²|m2)/.test(h) && /(paquet|paket|\bep\b|emballage|colis|pack)/.test(h)) roles[i] = "m2Pack";
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

  const api = { DEFAULT_PRODUCTS, fmt, fmt0, newOrder, migrate, allCombos, comboPrice, sortCombos, spread, comboLabel, evalSurface, computeTotals, mpText, frDate, zoneLabel, xlNum, typeFromDensity, naturalSort, etageRank, todayIso, parsePasted, parseNum, guessRoles };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
