/* OSA – Strichcode-Scanner: Die Kamera liest EAN/UPC-Codes (BarcodeDetector des Browsers, sonst ZXing aus zxing.js);
   die Produktdaten (Name, Kalorien je 100 g, Portion) kommen von Open Food Facts (freie Datenbank, ODbL). */
"use strict";

const BARCODE_API = "https://world.openfoodfacts.org/api/v2/product/", BARCODE_CACHE = "osa.barcode.v1";

/* Nummer prüfen (8, 12 oder 13 Ziffern mit richtiger Prüfziffer); 12-stellige UPC-A werden zu 13 Ziffern ergänzt. null = ungültig */
function barcodeNormal(text) {
  const c = String(text || "").replace(/\s+/g, "");
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(c)) return null;
  let summe = 0;
  for (let i = 0; i < c.length - 1; i++) summe += +c[c.length - 2 - i] * (i % 2 === 0 ? 3 : 1);
  if ((10 - summe % 10) % 10 !== +c[c.length - 1]) return null;
  return c.length === 12 ? "0" + c : c;
}

const BARCODE_FORMATE = ["ean_13", "ean_8", "upc_a", "upc_e"];
function barcodeDetektor() {   // der eingebaute Leser des Browsers (Chrome/Edge auf Android u. a.), sonst null
  try { return "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: BARCODE_FORMATE }) : null; } catch (e) { return null; }
}
let _zxingLeser = null;
function zxingLeser() {
  if (typeof ZXing === "undefined") return null;
  if (!_zxingLeser) {
    const hinweise = new Map();
    hinweise.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
    hinweise.set(ZXing.DecodeHintType.TRY_HARDER, true);
    _zxingLeser = new ZXing.MultiFormatReader(); _zxingLeser.setHints(hinweise);
  }
  return _zxingLeser;
}
async function barcodeAusCanvas(leinwand) {   // → gültige Nummer oder null (ein Durchgang, unverändertes Bild)
  const det = barcodeDetektor();
  if (det) { try { for (const x of await det.detect(leinwand)) { const c = barcodeNormal(x.rawValue); if (c) return c; } } catch (e) { } }
  const leser = zxingLeser(); if (!leser) return null;
  try {
    const quelle = new ZXing.HTMLCanvasElementLuminanceSource(leinwand);
    return barcodeNormal(leser.decodeWithState(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(quelle))).getText());
  } catch (e) { return null; }   // nichts erkannt
}

/* Weitere Versuche für schwierige Bilder (Webcam ohne Autofokus, kleiner oder verwackelter Code, schlechtes Licht):
   Graustufen mit gestrecktem Kontrast, Schärfen, Ausschnitt aus der Mitte vergrößert. Gemessen an nachgestellten Kamerabildern:
   ein Durchgang erkennt Codes um 220 px Breite (in 1280 px) nicht, die Kombination schon. */
function barcodeKopie(quelle, faktor = 1) {
  const o = document.createElement("canvas"); o.width = Math.max(1, Math.round(quelle.width * faktor)); o.height = Math.max(1, Math.round(quelle.height * faktor));
  const x = o.getContext("2d", { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(quelle, 0, 0, o.width, o.height);
  return o;
}
function barcodeAusschnitt(quelle, fx, fy, faktor = 1) {   // Mitte des Bildes (fx × fy des Bildes), mit faktor vergrößert
  const w = Math.round(quelle.width * fx), hh = Math.round(quelle.height * fy), o = document.createElement("canvas");
  o.width = Math.max(1, Math.round(w * faktor)); o.height = Math.max(1, Math.round(hh * faktor));
  const x = o.getContext("2d", { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  x.drawImage(quelle, Math.round((quelle.width - w) / 2), Math.round((quelle.height - hh) / 2), w, hh, 0, 0, o.width, o.height);
  return o;
}
function barcodeAufbereiten(quelle, schaerfen = 0) {   // Graustufen, Kontrast auf 2 %–98 % strecken, optional schärfen
  const o = barcodeKopie(quelle), x = o.getContext("2d", { willReadFrequently: true }), bild = x.getImageData(0, 0, o.width, o.height), d = bild.data, n = o.width * o.height;
  const g = new Float32Array(n), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; g[j] = v; hist[v | 0]++; }
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
  const spanne = Math.max(30, hi - lo); let aus = g;
  if (schaerfen) {
    aus = new Float32Array(n); const w = o.width, hoehe = o.height;
    for (let y = 1; y < hoehe - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx, mittel = (g[i - 1] + g[i + 1] + g[i - w] + g[i + w] + g[i]) / 5; aus[i] = g[i] + (g[i] - mittel) * schaerfen; }
  }
  for (let j = 0, i = 0; j < n; j++, i += 4) { const v = Math.max(0, Math.min(255, (aus[j] - lo) * 255 / spanne)); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  x.putImageData(bild, 0, 0); return o;
}
const BARCODE_VARIANTEN = [
  b => b,                                                   // 0: Bild unverändert
  b => barcodeAufbereiten(b, 0),                            // 1: Kontrast gestreckt
  b => barcodeAufbereiten(b, 1.5),                          // 2: Kontrast gestreckt + geschärft
  b => barcodeAusschnitt(b, 0.5, 0.5, 2),                   // 3: Mitte, doppelt vergrößert
  b => barcodeAufbereiten(barcodeAusschnitt(b, 0.5, 0.5, 2), 1.5),   // 4: Mitte vergrößert, geschärft
  b => barcodeAusschnitt(b, 0.6, 0.5, 1),                   // 5: Mitte (60 % × 50 %)
  b => barcodeAufbereiten(barcodeKopie(b, 1.5), 1)          // 6: 1,5-fach vergrößert, geschärft
];
async function barcodeVariante(leinwand, nr) { return nr === 0 ? await barcodeAusCanvas(leinwand) : await barcodeAusCanvas(BARCODE_VARIANTEN[nr](leinwand)); }
/* Live-Bild: nur das Zielrechteck (mittlere 76 % × 46 %, wie im Dialog eingezeichnet) wird ausgewertet – etwa ein Drittel der Pixel, dadurch mehrere Durchläufe pro Sekunde */
const BARCODE_LIVE = [b => b, b => barcodeAufbereiten(b, 0), b => barcodeAufbereiten(b, 1.5), b => barcodeAufbereiten(barcodeKopie(b, 1.6), 1)];
function barcodeZielbereich(leinwand) { return barcodeAusschnitt(leinwand, 0.76, 0.46, 1); }
async function barcodeLiveVariante(bereich, nr) { return nr === 0 ? await barcodeAusCanvas(bereich) : await barcodeAusCanvas(BARCODE_LIVE[nr](bereich)); }
async function barcodeStandbild(leinwand) {   // alle Versuche nacheinander (für ein einzelnes Foto) → Nummer oder null; zuerst das Zielrechteck (schnell), dann das ganze Bild
  const bereich = barcodeZielbereich(leinwand);
  for (let nr = 0; nr < BARCODE_LIVE.length; nr++) { const c = await barcodeLiveVariante(bereich, nr); if (c) return c; }
  for (let nr = 0; nr < BARCODE_VARIANTEN.length; nr++) { const c = await barcodeVariante(leinwand, nr); if (c) return c; }
  return null;
}
async function barcodeAusDatei(datei) {   // Foto oder Bilddatei auswerten → Nummer oder null
  let bmp; try { bmp = await createImageBitmap(datei); } catch (e) { return null; }
  const f = Math.min(1, 2000 / bmp.width), leinwand = document.createElement("canvas");
  leinwand.width = Math.max(1, Math.round(bmp.width * f)); leinwand.height = Math.max(1, Math.round(bmp.height * f));
  leinwand.getContext("2d", { willReadFrequently: true }).drawImage(bmp, 0, 0, leinwand.width, leinwand.height);
  try { bmp.close(); } catch (e) { }
  return await barcodeStandbild(leinwand);
}
const BARCODE_REIHENFOLGE = [0, 1, 2, 3];   // im Live-Bild pro Durchlauf zwei davon (abwechselnd)
function barcodeBildHolen(quelle, leinwand, maxBreite = 1600) {   // Videobild in voller Auflösung (höchstens maxBreite) auf die Leinwand
  const sw = quelle.videoWidth || quelle.width, sh = quelle.videoHeight || quelle.height, b = Math.min(sw, maxBreite), hoehe = Math.round(sh * b / sw);
  leinwand.width = b; leinwand.height = hoehe; leinwand.getContext("2d", { willReadFrequently: true }).drawImage(quelle, 0, 0, b, hoehe);
  return leinwand;
}

/* Produkt bei Open Food Facts abfragen → { code, name, marke, menge, kcal100, portionG } | null (nicht gefunden); wirft bei Netzfehlern. 30 Tage im Browser gemerkt. */
async function produktAbfragen(code) {
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(BARCODE_CACHE) || "{}"); } catch (e) { }
  const c = cache[code]; if (c && Date.now() - c.zeit < 30 * 864e5) return c.p;
  const r = await fetch(`${BARCODE_API}${code}.json?fields=code,product_name,product_name_de,generic_name,brands,quantity,serving_size,serving_quantity,nutriments`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json(); if (!j || j.status !== 1 || !j.product) return null;
  const pr = j.product, n = pr.nutriments || {};
  const kcal = typeof n["energy-kcal_100g"] === "number" ? n["energy-kcal_100g"] : typeof n["energy_100g"] === "number" ? n["energy_100g"] / 4.184 : null;   // Ersatz: kJ → kcal
  const portion = parseFloat(pr.serving_quantity) > 0 ? parseFloat(pr.serving_quantity) : null;
  const p = { code, name: String(pr.product_name_de || pr.product_name || pr.generic_name || "").replace(/[:=]/g, " ").replace(/\s+/g, " ").trim(),
    marke: String(pr.brands || "").split(",")[0].trim(), menge: String(pr.quantity || "").trim(), kcal100: kcal !== null && isFinite(kcal) ? Math.round(kcal) : null, portionG: portion };
  cache[code] = { zeit: Date.now(), p }; try { localStorage.setItem(BARCODE_CACHE, JSON.stringify(cache)); } catch (e) { }
  return p;
}

/* Nach dem Scannen (oder Eintippen): nachschlagen und den Produkt-Dialog zeigen */
async function barcodeVerarbeiten(code) {
  toast("Suche bei Open Food Facts …");
  let p; try { p = await produktAbfragen(code); } catch (e) { return toast("Keine Verbindung zu Open Food Facts. Bitte später noch einmal versuchen."); }
  if (!p) return toast("Dieses Produkt ist bei Open Food Facts nicht eingetragen.");
  produktDialog(p);
}

function barcodeDialog(beiCode, opt = {}) {   // opt.ohneKamera: kein Kamerabild (nur Foto auswerten oder Nummer eintippen)
  const video = h("video", { class: "qr-video" }); video.muted = true; video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
  const zielrahmen = h("div", { class: "barcode-ziel", "aria-hidden": "true", style: "position:absolute;left:12%;right:12%;top:27%;bottom:27%;border:2px dashed #fff;border-radius:8px;box-shadow:0 0 0 999px rgba(0,0,0,.28);pointer-events:none" });
  const bildFeld = h("div", { class: "barcode-bild", style: "position:relative;overflow:hidden;line-height:0;border-radius:12px" }, video, zielrahmen);
  const info = h("p", { class: "mut small", "data-barcode-info": "1", style: "margin:0;text-align:center" }, "Halte den Strichcode in das Rechteck: ruhig, gerade, gut beleuchtet und etwa 15–25 cm von der Kamera entfernt.");
  const eingabe = h("input", { type: "text", inputmode: "numeric", id: "barcode-eingabe", placeholder: "Oder die Nummer unter dem Code eintippen", maxlength: 14 });
  const datei = h("input", { type: "file", accept: "image/*", hidden: true, id: "barcode-datei" });
  let strom = null, aktiv = true, zu = () => { };
  const stopp = () => { aktiv = false; if (strom) strom.getTracks().forEach(s => s.stop()); };
  const fertig = code => { stopp(); zu(); beiCode(code); };
  const suchen = () => { const c = barcodeNormal(eingabe.value); if (!c) return toast("Das ist keine gültige Strichcode-Nummer (8, 12 oder 13 Ziffern mit richtiger Prüfziffer)."); fertig(c); };
  eingabe.onkeydown = ev => { if (ev.key === "Enter") suchen(); };
  const standbild = async () => {   // das aktuelle Bild in voller Auflösung mit allen Versuchen prüfen
    if (!video.videoWidth) return toast("Die Kamera liefert noch kein Bild.");
    toast("Standbild wird geprüft …");
    const code = await barcodeStandbild(barcodeBildHolen(video, document.createElement("canvas"), 1920));
    if (code) fertig(code); else toast("Kein Strichcode erkannt. Halte das Produkt ruhig, gerade und etwa 15–25 cm vor die Kamera – oder tippe die Nummer ein.");
  };
  datei.onchange = async () => {   // Foto oder Bilddatei (z. B. vom Handy oder ein Screenshot) auswerten
    const f = datei.files[0]; datei.value = ""; if (!f) return;
    toast("Bild wird ausgewertet …");
    const code = await barcodeAusDatei(f);
    if (code) fertig(code); else toast("Im Bild wurde kein Strichcode erkannt. Am besten ein scharfes, gerades Foto nur vom Strichcode – oder tippe die Nummer ein.");
  };
  zu = dialog("Strichcode scannen", [bildFeld, info,
    h("div", { class: "row", style: "gap:8px" }, eingabe, h("button", { class: "btn", "data-aktion": "barcode-suchen", onclick: suchen }, "Suchen")),
    h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, opt.ohneKamera ? null : h("button", { class: "btn", "data-aktion": "barcode-standbild", onclick: standbild }, "Standbild prüfen"),
      h("button", { class: "btn", "data-aktion": "barcode-bild", onclick: () => datei.click() }, "Foto/Bild wählen …"), datei)],
    [{ text: "Abbrechen", fn: () => { stopp(); } }], { keinFokus: true });
  /* Ohne Kamera (nicht erlaubt, keine vorhanden …): Fenster mit dem Weg zu den Einstellungen; von dort „Erneut versuchen“ oder Nummer eintippen */
  const kameraProblem = art => { aktiv = false; zu(); kameraHilfeDialog(art, { erneut: () => barcodeDialog(beiCode), eintippen: () => barcodeDialog(beiCode, { ohneKamera: true }) }); };
  if (opt.ohneKamera) { bildFeld.hidden = true; info.textContent = t("Wähle ein Foto vom Strichcode oder tippe die Nummer darunter ein."); }
  else (async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return kameraProblem("nichtverfuegbar");
    try { strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
    catch (e) { return kameraProblem(kameraFehlerArt(e)); }
    if (!aktiv) { stopp(); return; }
    try {   // wenn möglich ständig nachfokussieren (Handys und gute Webcams)
      const spur = strom.getVideoTracks()[0], faehig = spur.getCapabilities ? spur.getCapabilities() : {};
      if (faehig.focusMode && faehig.focusMode.includes("continuous")) await spur.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    } catch (e) { }
    video.srcObject = strom; try { await video.play(); } catch (e) { }
    const leinwand = document.createElement("canvas");
    let letzter = null, treffer = 0, durchlauf = 0, hinweisGezeigt = false; const start = Date.now();
    const lesen = async () => {
      if (!aktiv) return;
      if (!video.isConnected) { stopp(); return; }   // Dialog wurde geschlossen
      if (video.readyState >= 2 && video.videoWidth) {
        barcodeBildHolen(video, leinwand);   // volle Auflösung (bis 1600 px Breite): verkleinern kostet viel Erkennung
        let code = null; const bereich = barcodeZielbereich(leinwand);
        for (const nr of [BARCODE_REIHENFOLGE[(2 * durchlauf) % 4], BARCODE_REIHENFOLGE[(2 * durchlauf + 1) % 4]]) { code = await barcodeLiveVariante(bereich, nr); if (code) break; }
        durchlauf++;
        if (code) { treffer = code === letzter ? treffer + 1 : 1; letzter = code; if (treffer >= 2) return fertig(code); }   // zweimal hintereinander gleich = sicher gelesen
        if (!hinweisGezeigt && Date.now() - start > 10000) { hinweisGezeigt = true; info.textContent = t("Noch nichts erkannt? Strichcode näher oder weiter weg halten, bis er scharf ist, oder „Standbild prüfen“ / „Foto/Bild wählen …“ nutzen oder die Nummer eintippen."); }
      }
      setTimeout(lesen, 60);
    };
    lesen();
  })();
  return zu;
}

/* Produkt-Dialog: Daten prüfen/ändern, dann in „Meine Lebensmittel“ speichern und/oder als Mahlzeit eintragen */
function produktDialog(p) {
  const name = h("input", { type: "text", id: "pd-name", maxlength: 60, value: p.name || "" });
  const kcal = h("input", { type: "number", id: "pd-kcal", min: 0, step: 1, value: p.kcal100 ?? "", placeholder: "kcal" });
  const menge = h("input", { type: "number", id: "pd-menge", min: 1, step: 1, value: p.portionG || 100 });
  const stunde = new Date().getHours(), vorgabe = stunde < 10 ? "Frühstück" : stunde < 15 ? "Mittagessen" : stunde < 21 ? "Abendessen" : "Snack";
  const mz = auswahl(MAHLZEITEN.map(m => [m, m]), vorgabe);
  const essenAn = einst.essen_an !== false;
  const summe = h("div", { class: "mut small", "data-pd-summe": "1", style: "min-height:18px" });
  const rechnen = () => { const k = parseFloat(String(kcal.value).replace(",", ".")), g = parseFloat(String(menge.value).replace(",", ".")); summe.textContent = k >= 0 && g > 0 ? `${g} g ≈ ${Math.round(k * g / 100)} kcal` : ""; };
  kcal.addEventListener("input", rechnen); menge.addEventListener("input", rechnen); rechnen();
  const gueltig = () => {
    const n = name.value.trim().replace(/\s+/g, " "), k = parseFloat(String(kcal.value).replace(",", "."));
    if (!n) { toast("Bitte einen Namen eintragen."); return null; }
    if (/[:=]/.test(n)) { toast("Der Name darf keinen Doppelpunkt und kein Gleichheitszeichen enthalten."); return null; }
    if (!(k >= 0)) { toast("Bitte die Kalorien eintragen (0 oder mehr)."); return null; }
    return [n, k];
  };
  dialog("Produkt gefunden", [
    h("div", null, h("b", { style: "font-size:16px" }, R(p.name || t("Produkt ohne Namen"))), p.marke || p.menge ? h("div", { class: "mut small" }, R([p.marke, p.menge].filter(Boolean).join(" · "))) : null),
    p.kcal100 === null ? h("div", { class: "warnbox" }, "Für dieses Produkt gibt es bei Open Food Facts noch keine Kalorienangabe. Du kannst sie unten selbst eintragen.") : null,
    h("div", { class: "grid2" }, feld("Name", name), feld("kcal pro 100 g", kcal)),
    p.portionG ? h("div", { class: "mut small" }, R(`${t("Portion laut Packung")}: ${p.portionG} g${p.kcal100 !== null ? ` ≈ ${Math.round(p.kcal100 * p.portionG / 100)} kcal` : ""}`)) : null,
    essenAn ? h("h3", { style: "margin:6px 0 0" }, "Als Mahlzeit eintragen") : null,
    essenAn ? h("div", { class: "grid2" }, feld("Menge (g)", menge), feld("Mahlzeit", mz)) : null,
    essenAn ? summe : null,
    h("p", { class: "mut small", style: "margin:0" }, R(`${t("Quelle: Open Food Facts (Strichcode")} ${p.code})`))], [
    { text: "Abbrechen" },
    { text: "In „Meine Lebensmittel“ speichern", fn: () => {
      const g = gueltig(); if (!g) return false;
      aendern(() => { daten.kalorien = kalorienSetzen(daten.kalorien, g[0], kalorienZeileAus(g[0], g[1], "100g")); });
      toast(`${t("Gespeichert")}: ${g[0]}`, true);
    } },
    ...(essenAn ? [{ text: "Als Mahlzeit eintragen", art: "pri", fn: () => {
      const g = gueltig(); if (!g) return false;
      const m = parseFloat(String(menge.value).replace(",", ".")); if (!(m > 0)) { toast("Bitte eine Menge in Gramm eintragen."); return false; }
      const tag = ui.tab === "essen" && ui.essen === "kalorien" && ui.kalTag ? ui.kalTag : heute();
      aendern(() => { daten.essen.push({ gericht: g[0], mahlzeit: mz.value, datum: iso(tag), uhrzeit: (einst.mahlzeit_zeiten || {})[mz.value] || "", enddatum: "", wiederholung: "keine", wiederholen_bis: "", ausnahmen: {}, notiz: `${m} g`, farbe: "", kcal: Math.round(g[1] * m / 100) }); });
      toast(`${t("Eingetragen")}: ${g[0]} (${Math.round(g[1] * m / 100)} kcal)`, true);
    } }] : [])]);
}
