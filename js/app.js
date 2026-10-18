/* Strate - interface (affichage, boutons, sauvegarde navigateur).
   Les calculs sont dans core.js. */
const STORAGE_KEY = "strate.v1";
const $ = id => document.getElementById(id);


// ===== Etat + sauvegarde navigateur =====
// localStorage peut etre bloque (navigation privee) : on protege toujours par try/catch
let state = loadState();
let mode = "combo";


function freshState() {
  const o = newOrder("Commande 1");
  return { products: structuredClone(DEFAULT_PRODUCTS), currentId: DEFAULT_PRODUCTS[0].id, inputs: {}, orders: [o], currentOrderId: o.id };
}

function orderTotals() {
  return computeTotals(curOrder(), state.products);
}

function curOrder() {
  return state.orders.find(o => o.id === state.currentOrderId) || state.orders[0];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.products) && s.products.length) return migrate(s);
    }
  } catch (e) {}
  return freshState();
}


function saveState() {
  state.inputs = {
    target: $("target").value, maxLayers: $("maxLayers").value,
    tolMinus: $("tolMinus").value, tolPlus: $("tolPlus").value,
    surface: $("surface").value, sortMode: $("sortMode").value,
    facade: $("facade").value, etage: $("etage").value, mode
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function currentProduct() {
  return state.products.find(p => p.id === state.currentId) || state.products[0];
}





// ===== Affichage du calcul =====
function renderProductPicker() {
  const sel = $("productSelect");
  sel.innerHTML = state.products.map(p =>
    `<option value="${p.id}" ${p.id === state.currentId ? "selected" : ""}>${escapeHtml(p.name)}</option>`
  ).join("");
  const p = currentProduct();
  const on = p.thicknesses.filter(x => x.on).map(x => x.t).sort((a, b) => a - b);
  const typeLabel = { "souple": "souple", "semi-rigide": "semi-rigide", "rigide": "rigide" }[p.type] || "";
  // Nom complet sous le menu (il est souvent tronque sur telephone)
  $("productInfo").textContent = `${p.name} · ${typeLabel}${p.density ? ` (${p.density} kg/m³)` : ""}${p.lambda ? ` · λ ${fmt(p.lambda, 3)}` : ""} · ${on.length ? on.join(", ") + " mm" : "aucune épaisseur active"}`;
  const hints = {
    "souple": "Produit souple : il se comprime un peu, une tolérance de quelques mm en moins est souvent acceptable.",
    "semi-rigide": "Produit semi-rigide : il se comprime peu, reste prudent avec la tolérance en moins.",
    "rigide": "Produit rigide : aucune compression possible, vise juste ou légèrement au-dessus."
  };
  $("typeHint").textContent = hints[p.type] || "";
}

function layerColors(layers) {
  // Une couleur par epaisseur differente pour bien distinguer les couches
  const palette = ["var(--layer-a)", "var(--layer-b)", "var(--layer-c)"];
  const distinct = [...new Set(layers)];
  return layers.map(t => palette[distinct.indexOf(t) % palette.length]);
}

function stackHtml(layers) {
  const total = layers.reduce((a, b) => a + b, 0);
  const colors = layerColors(layers);
  return `<div class="stack">${layers.map((t, i) =>
    `<div style="width:${(t / total) * 100}%;background:${colors[i]}">${t}</div>`
  ).join("")}</div>`;
}


function rText(total, product = currentProduct()) {
  const lambda = Number(product.lambda);
  if (!lambda) return "";
  return `R = ${fmt(total / 1000 / lambda)} m²K/W`;
}

function diffLabel(total, target) {
  const d = total - target;
  if (d === 0) return "pile la cible";
  return d > 0 ? `+${d} mm` : `${d} mm`;
}

function addButton(c) {
  return `<button class="btn small" data-add="${c.layers.join(",")}">+ Commande</button>`;
}

function priceTag(c) {
  return c.price != null ? `<span class="price-tag">${fmt(c.price)} CHF/m²</span>` : "";
}

function comboCard(c, target, best, showR, badge = "Recommandée") {
  const r = showR ? rText(c.total) : "";
  return `<div class="combo ${best ? "best" : ""}">
    <div class="combo-head">
      <span class="combo-title">${comboLabel(c.layers)} mm${best ? `<span class="badge">${badge}</span>` : ""}</span>
      <span class="row" style="margin:0">${priceTag(c)}${addButton(c)}</span>
    </div>
    <span class="meta">${c.total} mm · ${diffLabel(c.total, target)} · ${c.layers.length} couche${c.layers.length > 1 ? "s" : ""}${r ? " · " + r : ""}</span>
    ${stackHtml(c.layers)}
  </div>`;
}

let lastCombos = [];

function renderResults() {
  const p = currentProduct();
  const thick = p.thicknesses.filter(x => x.on).map(x => x.t);
  const target = Number($("target").value);
  const maxLayers = Number($("maxLayers").value);
  const res = $("results");
  $("resultsMeta").textContent = "";

  if (!thick.length) { res.innerHTML = `<p class="empty">Active au moins une épaisseur dans le catalogue.</p>`; return; }
  if (!target || target <= 0) { res.innerHTML = `<p class="empty">Saisis une épaisseur cible.</p>`; return; }

  const combos = allCombos(thick, maxLayers, p);

  if (mode === "combo") {
    $("resultsTitle").textContent = "Combinaisons possibles";
    const lo = target - Number($("tolMinus").value || 0);
    const hi = target + Number($("tolPlus").value || 0);
    const byPrice = $("sortMode").value === "price";
    const ok = sortCombos(combos.filter(c => c.total >= lo && c.total <= hi), target, byPrice).slice(0, 8);
    if (!ok.length) {
      res.innerHTML = `<p class="empty">Aucune combinaison dans la tolérance (${lo} à ${hi} mm).</p>` + nearestHtml(combos, target);
      return;
    }
    // Si toutes les combinaisons ont la meme epaisseur, R est identique : on l'affiche une seule fois
    const sameTotal = new Set(ok.map(c => c.total)).size === 1;
    if (sameTotal) $("resultsMeta").textContent = `Toutes à ${ok[0].total} mm${rText(ok[0].total) ? " · " + rText(ok[0].total) : ""}`;
    res.innerHTML = ok.map((c, i) => comboCard(c, target, i === 0, !sameTotal, byPrice ? "Moins chère" : "Recommandée")).join("");
  } else {
    $("resultsTitle").textContent = "Épaisseur réalisable la plus proche";
    res.innerHTML = nearestHtml(combos, target);
  }
}

// Mode inverse : plus proche en dessous et au-dessus de l'epaisseur dessinee
// (a total egal, on garde la combinaison avec le moins de couches)
function nearestHtml(combos, target) {
  const below = sortCombos(combos.filter(c => c.total <= target), target)
    .sort((a, b) => b.total - a.total || a.layers.length - b.layers.length)[0];
  const above = sortCombos(combos.filter(c => c.total >= target), target)
    .sort((a, b) => a.total - b.total || a.layers.length - b.layers.length)[0];
  const block = (c, label) => c
    ? `<div class="combo ${c.total === target ? "best" : ""}">
         <div class="combo-head"><span class="meta">${label}</span><span class="row" style="margin:0">${priceTag(c)}${addButton(c)}</span></div>
         <span class="big">${c.total} mm</span>
         <span class="meta">${comboLabel(c.layers)} mm · ${diffLabel(c.total, target)}${rText(c.total) ? " · " + rText(c.total) : ""}</span>
         ${stackHtml(c.layers)}
       </div>`
    : `<div class="combo"><span class="meta">${label}</span><span class="empty">Rien de réalisable</span></div>`;
  return `<div class="nearest">${block(below, "En dessous")}${block(above, "Au-dessus")}</div>`;
}


function renderSurfaceCalc() {
  const raw = $("surface").value;
  const v = evalSurface(raw);
  const isPlain = /^\s*\d+([.,]\d+)?\s*$/.test(raw);
  $("surfaceCalc").textContent = v == null || isPlain ? "" : isNaN(v) ? "Calcul illisible" : `= ${fmt0(v)} m²`;
}

function addToOrder(layers) {
  const surface = evalSurface($("surface").value);
  if (!surface || isNaN(surface) || surface <= 0) {
    $("surface").focus();
    toast("Saisis d'abord la surface à isoler");
    return;
  }
  const p = currentProduct();
  curOrder().lines.push({
    id: "l" + Date.now(),
    productId: p.id,
    productName: p.name,
    facade: $("facade").value.trim(),
    etage: $("etage").value.trim(),
    layers,
    surface,
    copied: false
  });
  // On garde facade et etage remplis : les zones suivantes partagent souvent l'un des deux
  renderOrder();
  saveState();
  toast("Ajouté à la commande");
}



function renderOrderPicker() {
  $("orderSelect").innerHTML = state.orders.map(o =>
    `<option value="${o.id}" ${o.id === curOrder().id ? "selected" : ""}>${escapeHtml(o.name)} (${o.lines.length} zone${o.lines.length > 1 ? "s" : ""})</option>`
  ).join("");
  $("waste").value = curOrder().waste ?? 5;
}


// Date des prix des produits utilises dans la commande (les prix vieillissent)
function priceDateNote(rows) {
  const ids = [...new Set(rows.map(r => r.productId))];
  const parts = ids.map(id => {
    const p = state.products.find(x => x.id === id);
    if (!p) return "";
    const label = ids.length > 1 ? `${p.name} : ` : "";
    return p.priceDate ? `${label}prix relevés le ${frDate(p.priceDate)}` : `${label}date des prix inconnue`;
  }).filter(Boolean);
  return parts.join(" · ");
}

function renderOrder() {
  renderOrderPicker();
  const lines = curOrder().lines;
  $("orderActions").classList.toggle("hidden", !lines.length);
  if (!lines.length) {
    $("orderLines").innerHTML = `<p class="empty">Saisis une surface, puis touche « + Commande » sur une combinaison.</p>`;
    $("orderSummary").innerHTML = "";
    return;
  }
  $("orderLines").innerHTML = lines.map(l => `
    <div class="order-line editable" data-edit="${l.id}" title="Toucher pour modifier">
      <div>
        <b>${escapeHtml(zoneLabel(l))}</b> · ${fmt0(l.surface)} m² <span class="meta">✎</span><br>
        <span class="meta">${comboLabel(l.layers)} mm${state.products.length > 1 ? " · " + escapeHtml(l.productName) : ""}${l.copied ? " · copié dans Excel" : ""}</span>
      </div>
      <button class="btn small ghost" data-remove="${l.id}" aria-label="Retirer">✕</button>
    </div>`).join("");

  const rows = orderTotals();
  const total = rows.reduce((s, r) => s + (r.price || 0), 0);
  const multiProduct = new Set(rows.map(r => r.productId)).size > 1;
  $("orderSummary").innerHTML = `
    <h3>À commander</h3>
    <div class="table-wrap" style="margin-top:4px">
      <table>
        <thead><tr><th>Épaisseur</th><th class="num">m² + chute</th><th class="num">Paquets</th><th class="num">m² cdés</th><th class="num">CHF HT</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td>${r.t} mm${multiProduct ? `<br><span class="meta">${escapeHtml(r.productName)}</span>` : ""}</td>
            <td class="num">${fmt(r.m2Waste, 1)}</td>
            <td class="num">${r.packs != null ? `${r.packs}${mpText(r.packs, r.perMP) ? `<br><span class="meta">${mpText(r.packs, r.perMP)}</span>` : ""}` : "—"}</td>
            <td class="num">${r.m2Ordered != null ? fmt(r.m2Ordered, 2) : "—"}</td>
            <td class="num">${r.price != null ? fmt(r.price) : "—"}</td>
          </tr>`).join("")}
        </tbody>
        ${total ? `<tfoot><tr><td colspan="4">Total estimé (prix catalogue)</td><td class="num">${fmt(total)}</td></tr></tfoot>` : ""}
      </table>
    </div>
    ${total ? `<p class="hint">${escapeHtml(priceDateNote(rows))}</p>` : ""}
    ${rows.some(r => r.packs == null) ? `<p class="hint">« — » : renseigne les m² par paquet de cette épaisseur dans le catalogue.</p>` : ""}`;
  renderExcelHint();
}

function orderText() {
  const rows = orderTotals();
  const waste = Number(curOrder().waste) || 0;
  const products = [...new Set(rows.map(r => r.productName))];
  let txt = `${curOrder().name}\n\n`;
  products.forEach(name => {
    txt += `${name}\n`;
    rows.filter(r => r.productName === name).forEach(r => {
      txt += r.packs != null
        ? `- ${r.t} mm : ${r.packs} paquet${r.packs > 1 ? "s" : ""} (${fmt(r.m2Ordered)} m²)${mpText(r.packs, r.perMP) ? ` soit ${mpText(r.packs, r.perMP)}` : ""}\n`
        : `- ${r.t} mm : ${fmt(r.m2Waste, 1)} m²\n`;
    });
    txt += "\n";
  });
  txt += "Détail par zone :\n";
  curOrder().lines.forEach(l => { txt += `- ${zoneLabel(l)} : ${fmt0(l.surface)} m², ${comboLabel(l.layers)} mm\n`; });
  txt += `\n(Quantités avec ${waste} % de chute)`;
  return txt;
}


// ===== Copie vers Excel =====
// On met dans le presse-papier deux versions du meme tableau :
// - du HTML (Excel le colle avec la mise en forme : gras, couleurs, bordures)
// - du texte separe par des tabulations (repli pour Excel mobile, Bloc-notes...)
// x:num donne a Excel la vraie valeur numerique, quel que soit le separateur decimal
// du PC (virgule en France, point sur certains PC suisses).
const XL = {
  th: "background:#C2410C;color:#FFFFFF;font-weight:bold;border:.5pt solid #7F7F7F;padding:3px 6px;",
  td: "border:.5pt solid #BFBFBF;padding:3px 6px;",
  tot: "font-weight:bold;background:#FBE7DC;border:.5pt solid #7F7F7F;padding:3px 6px;"
};

function xlCell(v, opts = {}) {
  const style = (opts.style || XL.td) + (opts.fmt ? `mso-number-format:'${opts.fmt}';` : "");
  if (typeof v === "number" && isFinite(v)) {
    const d = opts.dec ?? 0;
    return `<td style="${style}text-align:right;" x:num="${v}">${xlNum(v, d)}</td>`;
  }
  return `<td style="${style}">${escapeHtml(v ?? "")}</td>`;
}

function xlTable(header, rows, footer) {
  const head = header ? `<tr>${header.map(h => `<td style="${XL.th}">${escapeHtml(h)}</td>`).join("")}</tr>` : "";
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`
    + `<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;">${head}${rows.join("")}${footer || ""}</table></body></html>`;
}


function tsv(header, rows) {
  const lines = header ? [header.join("\t")] : [];
  rows.forEach(r => lines.push(r.map(v => typeof v === "number" ? xlNum(v, Number.isInteger(v) ? 0 : 2) : (v ?? "")).join("\t")));
  return lines.join("\n");
}

const ZONE_HEADER = ["Façade", "Étage", "Produit", "Composition", "Ép. totale (mm)", "Couche 1 (mm)", "Couche 2 (mm)", "Couche 3 (mm)", "Surface (m²)"];

function zoneValues(l) {
  // Couches de la plus epaisse a la plus fine, colonnes fixes pour pouvoir filtrer / sommer
  const layers = [...l.layers].sort((a, b) => b - a);
  return [l.facade || "", l.etage || "", l.productName, comboLabel(l.layers),
    l.layers.reduce((a, b) => a + b, 0), layers[0] ?? "", layers[1] ?? "", layers[2] ?? "", l.surface];
}

function zonesClipboard(lines, withHeader) {
  const values = lines.map(zoneValues);
  const rows = values.map(v => `<tr>${v.map((x, i) => xlCell(x, i === 8 ? { dec: 2, fmt: "0\\.00" } : {})).join("")}</tr>`);
  return { html: xlTable(withHeader ? ZONE_HEADER : null, rows), text: tsv(withHeader ? ZONE_HEADER : null, values) };
}

function recapClipboard() {
  const header = ["Produit", "Épaisseur (mm)", "m² nets", "m² + chute", "Paquets", "Multipacs", "m² commandés", "CHF/m² HT", "CHF HT"];
  const data = orderTotals();
  const values = data.map(r => {
    const product = state.products.find(p => p.id === r.productId);
    const item = product && product.thicknesses.find(x => x.t === r.t);
    return [r.productName, r.t, r.m2, r.m2Waste, r.packs ?? "", mpText(r.packs || 0, r.perMP),
      r.m2Ordered ?? "", item && item.price ? item.price : "", r.price ?? ""];
  });
  const decs = [0, 0, 2, 2, 0, 0, 2, 2, 2];
  const rows = values.map(v => `<tr>${v.map((x, i) => xlCell(x, { dec: decs[i], fmt: decs[i] ? "0\\.00" : undefined })).join("")}</tr>`);
  const total = data.reduce((s, r) => s + (r.price || 0), 0);
  const waste = Number(curOrder().waste) || 0;
  const footer = total
    ? `<tr><td colspan="8" style="${XL.tot}">Total estimé (prix catalogue, ${waste} % de chute)</td>${xlCell(total, { style: XL.tot, dec: 2, fmt: "#,##0\\.00" })}</tr>`
    : "";
  const text = tsv(header, values) + (total ? `\nTotal estimé\t\t\t\t\t\t\t\t${xlNum(total)}` : "");
  return { html: xlTable(header, rows, footer), text };
}

async function copyRich({ html, text }) {
  // 1) Evenement "copy" : le HTML arrive tel quel dans Excel (Chrome, Edge, Firefox).
  //    C'est la methode a privilegier : la methode moderne "nettoie" le HTML et
  //    supprime les infos reservees a Excel (x:num, formats de nombre).
  try {
    let done = false;
    const onCopy = e => {
      e.clipboardData.setData("text/html", html);
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
      done = true;
    };
    document.addEventListener("copy", onCopy);
    const ok = document.execCommand("copy");
    document.removeEventListener("copy", onCopy);
    if (ok && done) return true;
  } catch (e) {}
  // 2) Repli : methode moderne (Safari...), mise en forme un peu simplifiee
  try {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" })
      })]);
      return true;
    }
  } catch (e) {}
  // 3) Dernier recours : texte brut
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  return false;
}

function renderExcelHint() {
  const fresh = curOrder().lines.filter(l => !l.copied).length;
  const started = curOrder().lines.some(l => l.copied);
  $("copyExcelBtn").textContent = fresh && started ? `Copier pour Excel (${fresh} nouvelle${fresh > 1 ? "s" : ""})` : "Copier pour Excel";
  $("copyExcelBtn").disabled = !fresh;
  $("excelHint").textContent = !started
    ? "1er collage : en-tête + zones. Ensuite, seules les nouvelles zones sont copiées : colle-les sous ta dernière ligne."
    : fresh
      ? "Colle sous la dernière ligne de ton tableau Excel."
      : "Tout est déjà dans ton Excel. Ajoute une zone pour continuer.";
}

async function copyZones(all) {
  const lines = all ? curOrder().lines : curOrder().lines.filter(l => !l.copied);
  if (!lines.length) return;
  // En-tete seulement au premier collage (ou quand on recopie tout)
  const withHeader = all || !curOrder().lines.some(l => l.copied);
  const ok = await copyRich(zonesClipboard(lines, withHeader));
  if (!ok) { toast("Copie impossible sur ce navigateur"); return; }
  lines.forEach(l => l.copied = true);
  renderOrder(); saveState();
  toast(`${lines.length} zone${lines.length > 1 ? "s" : ""} copiée${lines.length > 1 ? "s" : ""}${withHeader ? " avec l'en-tête" : ""}`);
}


function renderDensityHint() {
  const p = currentProduct();
  const guess = typeFromDensity(p.density);
  const base = "Repère laines minérales : souple < 30 · semi-rigide 30 à 90 · rigide > 90 kg/m³. Les mousses (PIR, EPS, XPS) sont rigides même à 15–35 kg/m³.";
  $("densityHint").textContent = guess && guess !== p.type
    ? `${base} D'après sa masse volumique, ce produit serait plutôt ${guess} (garde ton choix si c'est une mousse ou si la fiche dit autre chose).`
    : base;
}

function renderCatalog() {
  const p = currentProduct();
  $("catalogProductSelect").innerHTML = state.products.map(x =>
    `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${escapeHtml(x.name)}</option>`).join("");
  $("productDensity").value = p.density ?? "";
  renderDensityHint();
  $("productType").value = p.type;
  $("productLambda").value = p.lambda ?? "";
  $("productPacksMP").value = p.packsPerMP ?? "";
  $("productPriceDate").value = frDate(p.priceDate);
  $("catalogSub").textContent = `${state.products.length} produit${state.products.length > 1 ? "s" : ""}`;
  const rows = [...p.thicknesses].sort((a, b) => a.t - b.t);
  $("thicknessRows").innerHTML = rows.length ? rows.map(x => `
    <tr class="${x.on ? "" : "off"}" data-t="${x.t}">
      <td><input type="checkbox" data-field="on" ${x.on ? "checked" : ""} aria-label="Disponible"></td>
      <td class="num">${x.t}</td>
      <td class="num"><input type="number" step="0.01" min="0" data-field="m2Pack" value="${x.m2Pack ?? ""}" inputmode="decimal"></td>
      <td class="num"><input type="number" step="0.05" min="0" data-field="price" value="${x.price ?? ""}" inputmode="decimal"></td>
      <td><button class="btn small ghost" data-del="${x.t}" aria-label="Supprimer">✕</button></td>
    </tr>`).join("")
    : `<tr><td colspan="5" class="empty">Aucune épaisseur — ajoutes-en une.</td></tr>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let toastTimer;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function refreshAll() { renderProductPicker(); renderCatalog(); renderResults(); renderOrder(); saveState(); renderBackupHint(); }

// ===== Evenements : calcul =====
$("productSelect").addEventListener("change", e => { state.currentId = e.target.value; refreshAll(); });

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
function setMode(m) {
  mode = m;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.mode === m));
  // La tolerance ne sert qu'au mode combinaisons
  document.querySelectorAll(".combo-only").forEach(el => el.classList.toggle("hidden", m !== "combo"));
  renderResults();
  saveState();
}

["target", "maxLayers", "tolMinus", "tolPlus"].forEach(id =>
  $(id).addEventListener("input", () => { renderResults(); saveState(); })
);
$("surface").addEventListener("input", () => { renderSurfaceCalc(); saveState(); });
$("sortMode").addEventListener("change", () => { renderResults(); saveState(); });

$("results").addEventListener("click", e => {
  const btn = e.target.closest("[data-add]");
  if (btn) addToOrder(btn.dataset.add.split(",").map(Number));
});

// ===== Fenetre de dialogue maison =====
// openModal({ title, text, fields: [{ id, label, value, type, placeholder }], buttons: [{ label, value, primary, danger }] })
// Renvoie une promesse : { button, values } ou null si on ferme.
// validate(values) peut renvoyer un message d'erreur pour bloquer la validation.
function openModal({ title, text = "", fields = [], buttons = [{ label: "OK", value: "ok", primary: true }], validate }) {
  return new Promise(resolve => {
    $("modalTitle").textContent = title;
    $("modalText").textContent = text;
    $("modalText").classList.toggle("hidden", !text);
    $("modalError").textContent = "";
    $("modalFields").innerHTML = fields.map(f => `
      <label>${escapeHtml(f.label)}
        <input data-mid="${f.id}" type="${f.type || "text"}" value="${escapeHtml(f.value ?? "")}"
               placeholder="${escapeHtml(f.placeholder || "")}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ""} autocomplete="off">
      </label>`).join("");
    $("modalButtons").innerHTML = buttons.map((b, i) =>
      `<button class="btn ${b.primary ? "primary" : ""} ${b.ghost ? "ghost" : ""}" data-mb="${i}"
        ${b.danger ? 'style="background:#dc2626;border-color:#dc2626;color:#fff"' : ""}>${escapeHtml(b.label)}</button>`).join("");
    $("modal").classList.remove("hidden");
    const first = $("modalFields").querySelector("input");
    (first || $("modalButtons").querySelector(".primary") || $("modalButtons").querySelector("button")).focus();
    if (first) first.select();

    const values = () => Object.fromEntries([...$("modalFields").querySelectorAll("input")].map(i => [i.dataset.mid, i.value]));
    const close = result => {
      $("modal").classList.add("hidden");
      $("modal").removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const choose = i => {
      const b = buttons[i];
      const v = values();
      // On ne valide les champs que pour le bouton principal
      if (b.primary && validate) {
        const err = validate(v);
        if (err) { $("modalError").textContent = err; return; }
      }
      close({ button: b.value, values: v });
    };
    const onClick = e => {
      if (e.target === $("modal")) return close(null);
      const btn = e.target.closest("[data-mb]");
      if (btn) choose(Number(btn.dataset.mb));
    };
    const onKey = e => {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        const p = buttons.findIndex(b => b.primary);
        if (p >= 0) { e.preventDefault(); choose(p); }
      }
    };
    $("modal").addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  });
}

async function confirmModal(title, text, okLabel = "Confirmer", danger = false) {
  const r = await openModal({ title, text, buttons: [
    { label: "Annuler", value: "cancel", ghost: true },
    { label: okLabel, value: "ok", primary: !danger, danger }
  ] });
  return !!r && r.button === "ok";
}

async function askText(title, label, value = "", placeholder = "") {
  const r = await openModal({
    title, fields: [{ id: "v", label, value, placeholder }],
    buttons: [{ label: "Annuler", value: "cancel", ghost: true }, { label: "OK", value: "ok", primary: true }],
    validate: v => v.v.trim() ? "" : "Ce champ ne peut pas être vide."
  });
  return r && r.button === "ok" ? r.values.v.trim() : null;
}

// ===== Evenements : commande =====
$("orderLines").addEventListener("click", e => {
  const del = e.target.closest("[data-remove]");
  if (del) {
    curOrder().lines = curOrder().lines.filter(l => l.id !== del.dataset.remove);
    renderOrder(); saveState();
    return;
  }
  const row = e.target.closest("[data-edit]");
  if (row) editLine(row.dataset.edit);
});

// Modifier une zone (surface, facade, etage) sans devoir la supprimer et la refaire
async function editLine(id) {
  const l = curOrder().lines.find(x => x.id === id);
  if (!l) return;
  const r = await openModal({
    title: "Modifier la zone",
    text: `${comboLabel(l.layers)} mm${l.copied ? " · déjà copiée dans Excel : pense à corriger aussi ta ligne là-bas." : ""}`,
    fields: [
      { id: "surface", label: "Surface (m²) — un calcul est accepté", value: String(l.surface).replace(".", ","), inputmode: "decimal" },
      { id: "facade", label: "Façade", value: l.facade || "" },
      { id: "etage", label: "Étage", value: l.etage || "" }
    ],
    buttons: [
      { label: "Supprimer", value: "delete", ghost: true },
      { label: "Annuler", value: "cancel", ghost: true },
      { label: "Enregistrer", value: "ok", primary: true }
    ],
    validate: v => {
      const s = evalSurface(v.surface);
      return !s || isNaN(s) || s <= 0 ? "Surface invalide." : "";
    }
  });
  if (!r || r.button === "cancel") return;
  if (r.button === "delete") {
    curOrder().lines = curOrder().lines.filter(x => x.id !== id);
  } else {
    l.surface = evalSurface(r.values.surface);
    l.facade = r.values.facade.trim();
    l.etage = r.values.etage.trim();
  }
  renderOrder(); saveState();
}

$("waste").addEventListener("input", () => {
  curOrder().waste = Math.max(0, Number($("waste").value) || 0);
  renderOrder(); saveState();
});
$("clearOrderBtn").addEventListener("click", async () => {
  if (!await confirmModal("Vider la commande ?", `Toutes les zones de « ${curOrder().name} » seront retirées.`, "Vider", true)) return;
  curOrder().lines = [];
  renderOrder(); saveState();
});
$("copyExcelBtn").addEventListener("click", () => copyZones(false));
$("copyAllBtn").addEventListener("click", () => copyZones(true));
$("copyRecapBtn").addEventListener("click", async () => {
  const ok = await copyRich(recapClipboard());
  toast(ok ? "Récap copié, colle-le dans Excel" : "Copie impossible sur ce navigateur");
});
["facade", "etage"].forEach(id => $(id).addEventListener("input", saveState));
$("copyOrderBtn").addEventListener("click", async () => {
  const txt = orderText();
  try {
    await navigator.clipboard.writeText(txt);
    toast("Commande copiée");
  } catch (e) {
    // Repli si le presse-papier est refuse : on montre le texte a copier a la main
    openModal({ title: "Copie ce texte", text: txt, buttons: [{ label: "Fermer", value: "ok", primary: true }] });
  }
});

// Commandes nommees : une par tache / chantier
$("orderSelect").addEventListener("change", e => { state.currentOrderId = e.target.value; renderOrder(); saveState(); });
$("newOrderBtn").addEventListener("click", async () => {
  const name = await askText("Nouvelle commande", "Nom", "", "ex. Chantier X – Façades");
  if (!name) return;
  const o = newOrder(name);
  state.orders.push(o);
  state.currentOrderId = o.id;
  renderOrder(); saveState();
  toast(`Commande « ${name} » créée`);
});
$("renameOrderBtn").addEventListener("click", async () => {
  const name = await askText("Renommer la commande", "Nom", curOrder().name);
  if (!name) return;
  curOrder().name = name;
  renderOrder(); saveState();
});
$("deleteOrderBtn").addEventListener("click", async () => {
  const o = curOrder();
  if (!await confirmModal("Supprimer la commande ?", `« ${o.name} » et ses ${o.lines.length} zone(s) seront supprimées.`, "Supprimer", true)) return;
  state.orders = state.orders.filter(x => x.id !== o.id);
  if (!state.orders.length) state.orders.push(newOrder("Commande 1"));
  state.currentOrderId = state.orders[0].id;
  renderOrder(); saveState();
});

// ===== Evenements : catalogue =====
// Le meme produit est selectionne en haut (calcul) et dans le catalogue
$("catalogProductSelect").addEventListener("change", e => { state.currentId = e.target.value; refreshAll(); });
$("productType").addEventListener("change", e => { currentProduct().type = e.target.value; refreshAll(); });
$("productDensity").addEventListener("input", e => {
  const p = currentProduct();
  p.density = Number(e.target.value) || null;
  // Type deduit automatiquement (modifiable ensuite si c'est une mousse, etc.)
  const guess = typeFromDensity(p.density);
  if (guess) { p.type = guess; $("productType").value = guess; }
  renderProductPicker(); renderDensityHint(); saveState();
});
$("productLambda").addEventListener("input", e => {
  currentProduct().lambda = Number(e.target.value) || null;
  renderProductPicker(); renderResults(); saveState();
});
$("productPacksMP").addEventListener("input", e => {
  currentProduct().packsPerMP = Number(e.target.value) || null;
  renderOrder(); saveState();
});
// Date saisie en jj.mm.aaaa (ou jj/mm/aaaa), stockee en aaaa-mm-jj
$("productPriceDate").addEventListener("change", e => {
  const v = e.target.value.trim();
  const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!v) currentProduct().priceDate = null;
  else if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    currentProduct().priceDate = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  } else { toast("Date au format jj.mm.aaaa"); }
  e.target.value = frDate(currentProduct().priceDate);
  renderOrder(); saveState();
});

$("thicknessRows").addEventListener("input", e => {
  const field = e.target.dataset.field;
  const tr = e.target.closest("tr");
  if (!field || !tr) return;
  const item = currentProduct().thicknesses.find(x => x.t === Number(tr.dataset.t));
  if (!item) return;
  if (field === "on") {
    item.on = e.target.checked;
    tr.classList.toggle("off", !item.on);
    renderProductPicker(); renderResults();
  } else {
    item[field] = e.target.value === "" ? null : Number(e.target.value);
    // Un prix modifie a la main = prix releve aujourd'hui
    if (field === "price") { currentProduct().priceDate = todayIso(); $("productPriceDate").value = todayIso(); }
    renderResults(); renderOrder();
  }
  saveState();
});

$("thicknessRows").addEventListener("click", e => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;
  const p = currentProduct();
  p.thicknesses = p.thicknesses.filter(x => x.t !== Number(btn.dataset.del));
  refreshAll();
});

$("addThicknessBtn").addEventListener("click", () => {
  const t = Math.round(Number($("newThickness").value));
  if (!t || t <= 0) return;
  const p = currentProduct();
  if (!p.thicknesses.some(x => x.t === t)) p.thicknesses.push({ t, on: true, m2Pack: null, price: null });
  $("newThickness").value = "";
  refreshAll();
});
$("newThickness").addEventListener("keydown", e => { if (e.key === "Enter") $("addThicknessBtn").click(); });

$("newProductBtn").addEventListener("click", async () => {
  const r = await openModal({
    title: "Nouveau produit",
    text: "Astuce : pour reprendre une fiche technique, utilise plutôt « Importer un tableau ».",
    fields: [
      { id: "name", label: "Nom du produit", placeholder: "ex. Flumroc Dämmplatte 3" },
      { id: "density", label: "Masse volumique (kg/m³), facultatif", placeholder: "ex. 40", inputmode: "numeric" },
      { id: "list", label: "Épaisseurs disponibles (mm, séparées par des virgules)", value: "40, 60, 80, 100, 120" }
    ],
    buttons: [{ label: "Annuler", value: "cancel", ghost: true }, { label: "Créer", value: "ok", primary: true }],
    validate: v => !v.name.trim() ? "Donne un nom au produit." : ""
  });
  if (!r || r.button !== "ok") return;
  const list = r.values.list.split(/[,;\s]+/).map(Number).filter(n => n > 0).map(Math.round);
  const id = "p" + Date.now();
  state.products.push({
    id, name: r.values.name.trim(), density: Number(r.values.density.replace(",", ".")) || null,
    type: typeFromDensity(Number(r.values.density.replace(",", "."))) || "semi-rigide", lambda: null, packsPerMP: null, priceDate: null,
    thicknesses: [...new Set(list)].map(t => ({ t, on: true, m2Pack: null, price: null }))
  });
  state.currentId = id;
  refreshAll();
  toast("Pense à renseigner les m² par paquet");
});

$("renameProductBtn").addEventListener("click", async () => {
  const p = currentProduct();
  const name = await askText("Renommer le produit", "Nom", p.name);
  if (name) { p.name = name; refreshAll(); }
});

$("deleteProductBtn").addEventListener("click", async () => {
  if (state.products.length <= 1) {
    await openModal({ title: "Impossible", text: "Il faut garder au moins un produit.", buttons: [{ label: "OK", value: "ok", primary: true }] });
    return;
  }
  const p = currentProduct();
  if (!await confirmModal("Supprimer le produit ?", `« ${p.name} » sera retiré du catalogue.`, "Supprimer", true)) return;
  state.products = state.products.filter(x => x.id !== p.id);
  state.currentId = state.products[0].id;
  refreshAll();
});

$("resetBtn").addEventListener("click", async () => {
  if (!await confirmModal("Tout réinitialiser ?",
    "Retour au catalogue d'origine. Tes produits ajoutés et toutes tes commandes seront perdus. Pense à sauvegarder avant !",
    "Réinitialiser", true)) return;
  state = freshState();
  refreshAll();
});



function buildPrintView() {
  const o = curOrder();
  const rows = orderTotals();
  const waste = Number(o.waste) || 0;
  const products = [...new Set(o.lines.map(l => l.productName))];
  const total = rows.reduce((s, r) => s + (r.price || 0), 0);
  const today = frDate(todayIso());

  // Regroupe les zones par facade (sans facade a la fin), puis tri par etage
  const groups = new Map();
  o.lines.forEach(l => {
    const key = l.facade || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  });
  const facades = [...groups.keys()].sort((a, b) => (a === "") - (b === "") || naturalSort(a, b));
  const multiProduct = products.length > 1;

  const facadeHtml = facades.map(f => {
    const lines = groups.get(f).slice().sort((a, b) => etageRank(a.etage) - etageRank(b.etage) || naturalSort(a.etage || "", b.etage || ""));
    // Sous-total de la facade : m2 nets par epaisseur
    const perT = {};
    lines.forEach(l => l.layers.forEach(t => { perT[t] = (perT[t] || 0) + l.surface; }));
    const sub = Object.keys(perT).map(Number).sort((a, b) => b - a).map(t => `${t} mm : ${fmt(perT[t])} m²`).join(" · ");
    const surf = lines.reduce((s, l) => s + l.surface, 0);
    return `<div class="pv-facade">
      <h3>${f ? "Façade " + escapeHtml(f) : "Sans façade précisée"}</h3>
      <table>
        <thead><tr><th>Étage</th><th>Composition</th>${multiProduct ? "<th>Produit</th>" : ""}<th class="num">Ép. totale</th><th class="num">Surface</th></tr></thead>
        <tbody>${lines.map(l => `<tr>
          <td>${escapeHtml(l.etage || "—")}</td>
          <td>${comboLabel(l.layers)} mm</td>
          ${multiProduct ? `<td>${escapeHtml(l.productName)}</td>` : ""}
          <td class="num">${l.layers.reduce((a, b) => a + b, 0)} mm</td>
          <td class="num">${fmt(l.surface)} m²</td></tr>`).join("")}
          <tr class="pv-total"><td colspan="${multiProduct ? 4 : 3}">Total façade</td><td class="num">${fmt(surf)} m²</td></tr>
        </tbody>
      </table>
      <p class="pv-subtot">Matière nette : ${sub}</p>
    </div>`;
  }).join("");

  const recapHtml = `<table>
    <thead><tr>${multiProduct ? "<th>Produit</th>" : ""}<th>Épaisseur</th><th class="num">m² nets</th><th class="num">m² + chute</th><th class="num">Paquets</th><th>Multipacs</th><th class="num">m² commandés</th>${total ? '<th class="num">CHF HT</th>' : ""}</tr></thead>
    <tbody>${rows.map(r => `<tr>
      ${multiProduct ? `<td>${escapeHtml(r.productName)}</td>` : ""}
      <td>${r.t} mm</td>
      <td class="num">${fmt(r.m2)}</td>
      <td class="num">${fmt(r.m2Waste)}</td>
      <td class="num">${r.packs ?? "—"}</td>
      <td>${r.packs ? mpText(r.packs, r.perMP) : ""}</td>
      <td class="num">${r.m2Ordered != null ? fmt(r.m2Ordered) : "—"}</td>
      ${total ? `<td class="num">${r.price != null ? fmt(r.price) : "—"}</td>` : ""}</tr>`).join("")}
      ${total ? `<tr class="pv-total"><td colspan="${multiProduct ? 7 : 6}">Total estimé (prix catalogue HT)</td><td class="num">${fmt(total)}</td></tr>` : ""}
    </tbody>
  </table>`;

  $("printView").innerHTML = `
    <h1>Bon de commande – Isolation</h1>
    <p class="pv-sub">${escapeHtml(o.name)}</p>
    <div class="pv-meta">
      <span><b>Date :</b> ${today}</span>
      <span><b>Produit :</b> ${escapeHtml(products.join(", "))}</span>
      <span><b>Zones :</b> ${o.lines.length}</span>
      <span><b>Chute :</b> ${waste} %</span>
    </div>
    <h2>À commander</h2>
    ${recapHtml}
    <h2>Détail par façade et par étage</h2>
    ${facadeHtml}
    <p class="pv-foot">Quantités arrondies au paquet supérieur, chute de ${waste} % incluse.${total ? " " + escapeHtml(priceDateNote(rows).replace(/^./, c => c.toUpperCase())) + ", prix indicatifs." : ""} Établi avec Strate le ${today}.</p>`;
}

$("pdfBtn").addEventListener("click", () => {
  if (!curOrder().lines.length) return;
  buildPrintView();
  // Le titre de la page devient le nom propose pour le fichier PDF
  const oldTitle = document.title;
  document.title = `Commande isolation - ${curOrder().name} - ${todayIso()}`;
  const restore = () => { document.title = oldTitle; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 1000);
});

// ===== Theme clair / sombre =====
// "Auto" suit le reglage du systeme ; Clair et Sombre le forcent.
const THEMES = [
  { key: "auto", label: "◐ Auto" },
  { key: "light", label: "☀ Clair" },
  { key: "dark", label: "☾ Sombre" }
];
function currentTheme() {
  try { return localStorage.getItem("strate.theme") || "auto"; } catch (e) { return document.documentElement.dataset.theme || "auto"; }
}
function applyTheme(key) {
  if (key === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = key;
  try { localStorage.setItem("strate.theme", key); } catch (e) {}
  $("themeBtn").textContent = THEMES.find(t => t.key === key).label;
}
$("themeBtn").addEventListener("click", () => {
  const i = THEMES.findIndex(t => t.key === currentTheme());
  applyTheme(THEMES[(i + 1) % THEMES.length].key);
});
applyTheme(currentTheme());


function renderBackupHint() {
  const n = state.orders.reduce((s, o) => s + o.lines.length, 0);
  const last = state.lastBackup ? `Dernière sauvegarde : ${frDate(state.lastBackup)}.` : "Aucune sauvegarde pour l'instant.";
  $("backupHint").textContent = `${last} Tes données (${state.products.length} produit${state.products.length > 1 ? "s" : ""}, ${state.orders.length} commande${state.orders.length > 1 ? "s" : ""}, ${n} zone${n > 1 ? "s" : ""}) ne vivent que dans ce navigateur : sauvegarde-les dans un fichier de temps en temps.`;
}

$("backupBtn").addEventListener("click", () => {
  state.lastBackup = todayIso();
  saveState();
  const data = { app: "strate", version: 5, savedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `strate-sauvegarde-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  renderBackupHint();
  toast("Sauvegarde téléchargée");
});

$("restoreBtn").addEventListener("click", () => $("restoreFile").click());

$("restoreFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) { toast("Fichier illisible"); return; }
  const s = data && data.app === "strate" && data.state;
  if (!s || !Array.isArray(s.products) || !s.products.length) { toast("Ce fichier n'est pas une sauvegarde Strate"); return; }
  const incoming = migrate(structuredClone(s));
  const nZones = incoming.orders.reduce((t, o) => t + o.lines.length, 0);
  const r = await openModal({
    title: "Restaurer la sauvegarde",
    text: `Fichier du ${data.savedAt ? frDate(data.savedAt.slice(0, 10)) : "?"} : ${incoming.products.length} produit(s), ${incoming.orders.length} commande(s), ${nZones} zone(s).`
      + " « Tout remplacer » écrase tes données actuelles. « Ajouter les produits » récupère seulement les produits qui te manquent (pratique pour le catalogue d'un collègue).",
    buttons: [
      { label: "Annuler", value: "cancel", ghost: true },
      { label: "Ajouter les produits", value: "merge" },
      { label: "Tout remplacer", value: "replace", primary: true }
    ]
  });
  if (!r || r.button === "cancel") return;
  if (r.button === "replace") {
    state = incoming;
    toast("Sauvegarde restaurée");
  } else {
    // Fusion : on ajoute les produits absents (meme nom = deja present)
    const names = new Set(state.products.map(p => p.name.toLowerCase()));
    const added = incoming.products.filter(p => !names.has(p.name.toLowerCase()));
    added.forEach(p => { if (state.products.some(x => x.id === p.id)) p.id = "p" + Date.now() + Math.floor(Math.random() * 1000); state.products.push(p); });
    toast(added.length ? `${added.length} produit(s) ajouté(s)` : "Aucun nouveau produit dans ce fichier");
  }
  restoreInputs();
  refreshAll();
});

// ===== Import d'un tableau colle =====
// Etapes : texte colle -> grille de cellules -> l'utilisateur dit quelle colonne
// contient quoi -> on cree ou met a jour un produit.
const ROLES = [
  { key: "", label: "Ignorer" },
  { key: "t", label: "Épaisseur (mm)" },
  { key: "m2Pack", label: "m² / paquet" },
  { key: "price", label: "Prix CHF/m²" },
  { key: "packsPerMP", label: "Paquets / multipac" }
];
let importGrid = [];   // lignes x colonnes (texte)
let importRoles = [];  // role choisi pour chaque colonne




function importRows() {
  // Lignes retenues : celles dont la colonne epaisseur contient un nombre
  const ti = importRoles.indexOf("t");
  if (ti < 0) return [];
  return importGrid.map((r, idx) => {
    const t = parseNum(r[ti]);
    if (isNaN(t) || t <= 0) return null;
    const item = { t: Math.round(t), idx };
    importRoles.forEach((role, i) => {
      if (role && role !== "t") { const n = parseNum(r[i]); if (!isNaN(n)) item[role] = n; }
    });
    return item;
  }).filter(Boolean);
}

function renderImport() {
  const prev = $("importPreview");
  if (!importGrid.length) {
    prev.innerHTML = ""; $("importTarget").classList.add("hidden");
    $("importMsg").textContent = ""; $("doImportBtn").disabled = true;
    return;
  }
  const cols = Math.max(...importGrid.map(r => r.length));
  const kept = new Set(importRows().map(r => r.idx));
  const show = importGrid.slice(0, 15);
  prev.innerHTML = `<div class="table-wrap preview"><table>
    <thead><tr>${Array.from({ length: cols }, (_, i) => `<th><select data-col="${i}">${ROLES.map(r =>
      `<option value="${r.key}" ${importRoles[i] === r.key ? "selected" : ""}>${r.label}</option>`).join("")}</select></th>`).join("")}</tr></thead>
    <tbody>${show.map((r, idx) => `<tr class="${kept.has(idx) ? "" : "skip"}">${Array.from({ length: cols }, (_, i) =>
      `<td>${escapeHtml(r[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>${importGrid.length > 15 ? `<p class="hint">… et ${importGrid.length - 15} lignes de plus</p>` : ""}`;

  const rows = importRows();
  $("importTarget").classList.toggle("hidden", !rows.length);
  $("doImportBtn").disabled = !rows.length;
  const roleNames = importRoles.filter(Boolean).map(k => ROLES.find(r => r.key === k).label);
  $("importMsg").textContent = !importRoles.includes("t")
    ? "Choisis quelle colonne contient l'épaisseur (menus au-dessus du tableau)."
    : rows.length
      ? `${rows.length} épaisseur${rows.length > 1 ? "s" : ""} détectée${rows.length > 1 ? "s" : ""} : ${rows.map(r => r.t).join(", ")} mm · colonnes lues : ${roleNames.join(", ")}. Les lignes barrées sont ignorées.`
      : "Aucune épaisseur lisible dans la colonne choisie.";

  // Destination : nouveau produit ou mise a jour d'un produit existant
  const dest = $("importDest");
  const cur = dest.value || "__new";
  dest.innerHTML = `<option value="__new">Nouveau produit</option>` +
    state.products.map(p => `<option value="${p.id}">Mettre à jour : ${escapeHtml(p.name)}</option>`).join("");
  dest.value = [...dest.options].some(o => o.value === cur) ? cur : "__new";
  document.querySelectorAll(".import-new").forEach(el => el.classList.toggle("hidden", dest.value !== "__new"));
}

function loadImportText() {
  importGrid = parsePasted($("importText").value);
  importRoles = importGrid.length ? guessRoles(importGrid) : [];
  renderImport();
}

function resetImport() {
  $("importText").value = ""; $("importName").value = ""; $("importLambda").value = ""; $("importDensity").value = "";
  importGrid = []; importRoles = [];
  renderImport();
}

$("openImportBtn").addEventListener("click", () => {
  $("importPanel").classList.remove("hidden");
  $("importText").focus();
});
$("cancelImportBtn").addEventListener("click", () => { resetImport(); $("importPanel").classList.add("hidden"); });
$("importText").addEventListener("input", loadImportText);
$("importPreview").addEventListener("change", e => {
  const col = e.target.dataset.col;
  if (col == null) return;
  // Un role ne peut etre attribue qu'a une seule colonne
  const role = e.target.value;
  if (role) importRoles = importRoles.map(r => r === role ? "" : r);
  importRoles[Number(col)] = role;
  renderImport();
});
$("importDest").addEventListener("change", renderImport);
$("importDensity").addEventListener("input", e => {
  const guess = typeFromDensity(Number(e.target.value));
  if (guess) $("importType").value = guess;
});
$("transposeBtn").addEventListener("click", () => {
  // Certaines fiches mettent les epaisseurs en colonnes : on fait pivoter le tableau
  if (!importGrid.length) return;
  const cols = Math.max(...importGrid.map(r => r.length));
  importGrid = Array.from({ length: cols }, (_, i) => importGrid.map(r => r[i] ?? ""));
  importRoles = guessRoles(importGrid);
  renderImport();
});

$("doImportBtn").addEventListener("click", () => {
  const rows = importRows();
  if (!rows.length) return;
  const destId = $("importDest").value;
  let p;
  if (destId === "__new") {
    const name = $("importName").value.trim();
    if (!name) { $("importName").focus(); toast("Donne un nom au produit"); return; }
    p = { id: "p" + Date.now(), name, type: $("importType").value,
          lambda: Number($("importLambda").value) || null, density: Number($("importDensity").value) || null,
          packsPerMP: null, thicknesses: [] };
    state.products.push(p);
  } else {
    p = state.products.find(x => x.id === destId);
  }
  // Fusion : on met a jour les epaisseurs existantes, on ajoute les nouvelles
  rows.forEach(r => {
    let item = p.thicknesses.find(x => x.t === r.t);
    if (!item) { item = { t: r.t, on: true, m2Pack: null, price: null }; p.thicknesses.push(item); }
    ["m2Pack", "price", "packsPerMP"].forEach(k => { if (r[k] != null) item[k] = r[k]; });
  });
  // Si toutes les epaisseurs ont le meme nb de paquets par multipac, on le met au niveau du produit
  // Prix importes = prix du jour de l'import
  if (rows.some(r => r.price != null)) p.priceDate = todayIso();
  const mps = [...new Set(rows.map(r => r.packsPerMP).filter(Boolean))];
  if (mps.length === 1 && p.packsPerMP == null) p.packsPerMP = mps[0];
  state.currentId = p.id;
  toast(`${rows.length} épaisseur${rows.length > 1 ? "s" : ""} importée${rows.length > 1 ? "s" : ""} dans « ${p.name} »`);
  resetImport();
  $("importPanel").classList.add("hidden");
  refreshAll();
});

// ===== Demarrage : on restaure les dernieres saisies =====
// Remet dans les champs les dernieres saisies (au demarrage et apres une restauration)
function restoreInputs() {
  const inp = state.inputs || {};
  if (inp.target) $("target").value = inp.target;
  if (inp.maxLayers) $("maxLayers").value = inp.maxLayers;
  if (inp.tolMinus !== undefined && inp.tolMinus !== "") $("tolMinus").value = inp.tolMinus;
  if (inp.tolPlus !== undefined && inp.tolPlus !== "") $("tolPlus").value = inp.tolPlus;
  if (inp.sortMode) $("sortMode").value = inp.sortMode;
  $("surface").value = inp.surface || "";
  $("facade").value = inp.facade || "";
  $("etage").value = inp.etage || "";
  renderSurfaceCalc();
  setMode(inp.mode || "combo");
}

restoreInputs();
renderProductPicker();
renderCatalog();
renderOrder();
renderBackupHint();
