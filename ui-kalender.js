/* OSA – Oberfläche Teil 2: Kalender (Woche, Monat, Jahr), Filter, Ferien, Stundenplan */
"use strict";
/* ============================================================
   Oberfläche, Teil 2: Kalender (Woche, Monat, Jahr), Filter, Ferien, Stundenplan
   ============================================================ */

/* ---------- Einträge eines Tages ---------- */
function filterAus(schl) { return einst.filter_aus.includes(schl); }
function eintraegeAm(tag, nurFach = false) {
  const res = [];
  for (const a of daten.aufgaben) {
    const typ = a.typ || "aufgabe";
    if (nurFach && !(typ === "termin" && a.fach)) continue;
    if (filterAus("typ:" + typ) || filterAus("kat:" + a.kategorie)) continue;
    for (const v of vorkommenAm(a, tag)) res.push({ art: typ, v, tag });
  }
  if (!nurFach && einst.essen_an !== false && !filterAus("typ:essen")) for (const e of daten.essen) for (const v of vorkommenAm(e, tag)) res.push({ art: "essen", v, tag });
  return res;
}
const mehrtaegig = it => dauerInTagen(it.v) > 0;
const titelVon = it => it.art === "essen" ? `${t(it.v.mahlzeit)}: ${it.v.gericht}` : it.v.name;
function zeitVon(it) {
  if (mehrtaegig(it)) return null;
  if (it.v.uhrzeit) return it.v.uhrzeit;
  if (it.art === "essen") return einst.mahlzeit_zeiten[it.v.mahlzeit] || null;
  return null;
}
function dauerVon(it) {
  if (it.art === "essen") return einst.mahlzeit_dauer;
  return Math.max(it.v.dauer || 30, 20);
}
function ferienAm(tag) { return filterAus("ferien") ? "" : (ui.ferien[iso(tag)] || ""); }

/* ---------- Gesetzliche Feiertage in Deutschland (ohne Internet berechnet) ---------- */
function osterSonntag(j) {   // Gaußsche Osterformel (gregorianisch)
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const monat = Math.floor((hh + l - 7 * m + 114) / 31), tag = ((hh + l - 7 * m + 114) % 31) + 1;
  return new Date(j, monat - 1, tag, 12);
}
const _feiertage = {};
function feiertageJahr(j, region) {
  const schl = j + "|" + region; if (_feiertage[schl]) return _feiertage[schl];
  const ostern = osterSonntag(j), bl = String(region || "").replace("DE-", ""), in_ = (...l) => l.includes(bl), f = {};
  const fest = (m, d) => iso(new Date(j, m - 1, d, 12)), rel = n => iso(addDays(ostern, n));
  const neu = (datum, name, gilt = true) => { if (gilt) f[datum] = name; };
  neu(fest(1, 1), "Neujahr"); neu(fest(1, 6), "Heilige Drei Könige", in_("BW", "BY", "ST"));
  neu(fest(3, 8), "Internationaler Frauentag", in_("BE") || (in_("MV") && j >= 2023));
  neu(rel(-2), "Karfreitag"); neu(rel(0), "Ostersonntag", in_("BB")); neu(rel(1), "Ostermontag");
  neu(fest(5, 1), "Tag der Arbeit"); neu(rel(39), "Christi Himmelfahrt"); neu(rel(49), "Pfingstsonntag", in_("BB")); neu(rel(50), "Pfingstmontag");
  neu(rel(60), "Fronleichnam", in_("BW", "BY", "HE", "NW", "RP", "SL"));
  neu(fest(8, 15), "Mariä Himmelfahrt", in_("SL", "BY"));   // in Bayern nur in überwiegend katholischen Gemeinden
  neu(fest(9, 20), "Weltkindertag", in_("TH") && j >= 2019);
  neu(fest(10, 3), "Tag der Deutschen Einheit");
  neu(fest(10, 31), "Reformationstag", in_("BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH") || j === 2017);
  neu(fest(11, 1), "Allerheiligen", in_("BW", "BY", "NW", "RP", "SL"));
  if (in_("SN")) { const d = new Date(j, 10, 22, 12); while (d.getDay() !== 3) d.setDate(d.getDate() - 1); f[iso(d)] = "Buß- und Bettag"; }   // Mittwoch vor dem 23. November
  neu(fest(12, 25), "1. Weihnachtsfeiertag"); neu(fest(12, 26), "2. Weihnachtsfeiertag");
  return (_feiertage[schl] = f);
}
/* Weitere Länder (ebenfalls ohne Internet berechnet). Regeln:
   ["f", Monat, Tag, Name, beobachtet]   fester Tag (beobachtet = Ersatztag, wenn Wochenende: "us" oder "gb")
   ["o", Abstand zu Ostersonntag, Name]  beweglich
   ["n", Monat, Wochentag (0 = So), n, Name]  n-ter Wochentag im Monat, n = -1: letzter */
const FT = (de, en, es, fr) => ({ de, en, es, fr });
const FT_NEUJAHR = FT("Neujahr", "New Year's Day", "Año Nuevo", "Jour de l'An"), FT_KARFR = FT("Karfreitag", "Good Friday", "Viernes Santo", "Vendredi saint"),
  FT_OSTERMO = FT("Ostermontag", "Easter Monday", "Lunes de Pascua", "Lundi de Pâques"), FT_ARBEIT = FT("Tag der Arbeit", "Labour Day", "Día del Trabajo", "Fête du Travail"),
  FT_HIMMELF = FT("Christi Himmelfahrt", "Ascension Day", "Ascensión", "Ascension"), FT_PFINGSTMO = FT("Pfingstmontag", "Whit Monday", "Lunes de Pentecostés", "Lundi de Pentecôte"),
  FT_MARIA = FT("Mariä Himmelfahrt", "Assumption Day", "Asunción", "Assomption"), FT_ALLERH = FT("Allerheiligen", "All Saints' Day", "Todos los Santos", "Toussaint"),
  FT_WEIH1 = FT("1. Weihnachtsfeiertag", "Christmas Day", "Navidad", "Noël"), FT_WEIH2 = FT("2. Weihnachtsfeiertag", "Boxing Day", "San Esteban", "Saint-Étienne"),
  FT_DREIK = FT("Heilige Drei Könige", "Epiphany", "Reyes", "Épiphanie"), FT_IMMAC = FT("Mariä Empfängnis", "Immaculate Conception", "Inmaculada Concepción", "Immaculée Conception"),
  FT_FRONL = FT("Fronleichnam", "Corpus Christi", "Corpus Christi", "Fête-Dieu");
const FEIERTAGE_LAENDER = {
  AT: [["f", 1, 1, FT_NEUJAHR], ["f", 1, 6, FT_DREIK], ["o", 1, FT_OSTERMO], ["f", 5, 1, FT("Staatsfeiertag", "Labour Day", "Fiesta del Trabajo", "Fête du Travail")], ["o", 39, FT_HIMMELF], ["o", 50, FT_PFINGSTMO], ["o", 60, FT_FRONL],
    ["f", 8, 15, FT_MARIA], ["f", 10, 26, FT("Nationalfeiertag", "National Day", "Fiesta Nacional", "Fête nationale")], ["f", 11, 1, FT_ALLERH], ["f", 12, 8, FT_IMMAC], ["f", 12, 25, FT("Christtag", "Christmas Day", "Navidad", "Noël")], ["f", 12, 26, FT("Stefanitag", "St. Stephen's Day", "San Esteban", "Saint-Étienne")]],
  CH: [["f", 1, 1, FT_NEUJAHR], ["o", -2, FT_KARFR], ["o", 1, FT_OSTERMO], ["o", 39, FT("Auffahrt", "Ascension Day", "Ascensión", "Ascension")], ["o", 50, FT_PFINGSTMO],
    ["f", 8, 1, FT("Bundesfeier", "Swiss National Day", "Fiesta Nacional de Suiza", "Fête nationale suisse")], ["f", 12, 25, FT("Weihnachten", "Christmas Day", "Navidad", "Noël")], ["f", 12, 26, FT("Stephanstag", "St. Stephen's Day", "San Esteban", "Saint-Étienne")]],
  FR: [["f", 1, 1, FT_NEUJAHR], ["o", 1, FT_OSTERMO], ["f", 5, 1, FT_ARBEIT], ["f", 5, 8, FT("Tag des Sieges 1945", "Victory in Europe Day", "Día de la Victoria 1945", "Victoire 1945")], ["o", 39, FT_HIMMELF], ["o", 50, FT_PFINGSTMO],
    ["f", 7, 14, FT("Nationalfeiertag", "Bastille Day", "Fiesta Nacional", "Fête nationale")], ["f", 8, 15, FT_MARIA], ["f", 11, 1, FT_ALLERH], ["f", 11, 11, FT("Waffenstillstand 1918", "Armistice Day", "Armisticio 1918", "Armistice 1918")], ["f", 12, 25, FT_WEIH1]],
  ES: [["f", 1, 1, FT_NEUJAHR], ["f", 1, 6, FT_DREIK], ["o", -2, FT_KARFR], ["f", 5, 1, FT_ARBEIT], ["f", 8, 15, FT_MARIA], ["f", 10, 12, FT("Nationalfeiertag", "National Day", "Fiesta Nacional de España", "Fête nationale")],
    ["f", 11, 1, FT_ALLERH], ["f", 12, 6, FT("Tag der Verfassung", "Constitution Day", "Día de la Constitución", "Jour de la Constitution")], ["f", 12, 8, FT_IMMAC], ["f", 12, 25, FT_WEIH1]],
  IT: [["f", 1, 1, FT_NEUJAHR], ["f", 1, 6, FT_DREIK], ["o", 1, FT_OSTERMO], ["f", 4, 25, FT("Tag der Befreiung", "Liberation Day", "Día de la Liberación", "Fête de la Libération")], ["f", 5, 1, FT_ARBEIT],
    ["f", 6, 2, FT("Tag der Republik", "Republic Day", "Día de la República", "Fête de la République")], ["f", 8, 15, FT("Ferragosto", "Ferragosto", "Ferragosto", "Ferragosto")], ["f", 11, 1, FT_ALLERH], ["f", 12, 8, FT_IMMAC], ["f", 12, 25, FT_WEIH1], ["f", 12, 26, FT("Stefanstag", "St. Stephen's Day", "San Esteban", "Saint-Étienne")]],
  NL: [["f", 1, 1, FT_NEUJAHR], ["o", 0, FT("Ostersonntag", "Easter Sunday", "Domingo de Pascua", "Dimanche de Pâques")], ["o", 1, FT_OSTERMO], ["koning", FT("Königstag", "King's Day", "Día del Rey", "Fête du Roi")],
    ["f", 5, 5, FT("Befreiungstag", "Liberation Day", "Día de la Liberación", "Fête de la Libération")], ["o", 39, FT_HIMMELF], ["o", 49, FT("Pfingstsonntag", "Whit Sunday", "Domingo de Pentecostés", "Dimanche de Pentecôte")], ["o", 50, FT_PFINGSTMO], ["f", 12, 25, FT_WEIH1], ["f", 12, 26, FT_WEIH2]],
  BE: [["f", 1, 1, FT_NEUJAHR], ["o", 1, FT_OSTERMO], ["f", 5, 1, FT_ARBEIT], ["o", 39, FT_HIMMELF], ["o", 50, FT_PFINGSTMO], ["f", 7, 21, FT("Nationalfeiertag", "Belgian National Day", "Fiesta Nacional de Bélgica", "Fête nationale")],
    ["f", 8, 15, FT_MARIA], ["f", 11, 1, FT_ALLERH], ["f", 11, 11, FT("Waffenstillstand 1918", "Armistice Day", "Armisticio 1918", "Armistice 1918")], ["f", 12, 25, FT_WEIH1]],
  GB: [["f", 1, 1, FT_NEUJAHR, "gb"], ["o", -2, FT_KARFR], ["o", 1, FT_OSTERMO], ["n", 5, 1, 1, FT("Bankfeiertag im Mai", "Early May bank holiday", "Festivo bancario de mayo", "Jour férié de mai")],
    ["n", 5, 1, -1, FT("Frühlings-Bankfeiertag", "Spring bank holiday", "Festivo bancario de primavera", "Jour férié de printemps")], ["n", 8, 1, -1, FT("Sommer-Bankfeiertag", "Summer bank holiday", "Festivo bancario de verano", "Jour férié d'été")],
    ["f", 12, 25, FT_WEIH1, "gb"], ["f", 12, 26, FT_WEIH2, "gb"]],
  US: [["f", 1, 1, FT_NEUJAHR, "us"], ["n", 1, 1, 3, FT("Martin Luther King Jr. Day", "Martin Luther King Jr. Day", "Día de Martin Luther King", "Journée Martin Luther King")], ["n", 2, 1, 3, FT("Presidents' Day", "Presidents' Day", "Día de los Presidentes", "Jour des présidents")],
    ["n", 5, 1, -1, FT("Memorial Day", "Memorial Day", "Día de los Caídos", "Memorial Day")], ["f", 6, 19, FT("Juneteenth", "Juneteenth", "Juneteenth", "Juneteenth"), "us"], ["f", 7, 4, FT("Unabhängigkeitstag", "Independence Day", "Día de la Independencia", "Fête de l'Indépendance"), "us"],
    ["n", 9, 1, 1, FT("Labor Day", "Labor Day", "Día del Trabajo", "Fête du Travail")], ["n", 10, 1, 2, FT("Columbus Day", "Columbus Day", "Día de Colón", "Columbus Day")], ["f", 11, 11, FT("Veterans Day", "Veterans Day", "Día de los Veteranos", "Jour des anciens combattants"), "us"],
    ["n", 11, 4, 4, FT("Thanksgiving", "Thanksgiving", "Acción de Gracias", "Thanksgiving")], ["f", 12, 25, FT_WEIH1, "us"]]
};
const FEIERTAGE_LAENDER_NAMEN = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", FR: "Frankreich", ES: "Spanien", IT: "Italien", NL: "Niederlande", BE: "Belgien", GB: "Großbritannien", US: "USA" };
function nterWochentag(j, m, wt, n) {
  if (n > 0) { const d = new Date(j, m - 1, 1, 12); while (d.getDay() !== wt) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + 7 * (n - 1)); return d; }
  const d = new Date(j, m, 0, 12); while (d.getDay() !== wt) d.setDate(d.getDate() - 1); return d;
}
function feiertageLandJahr(land, j) {
  const schl = land + "|" + j; if (_feiertage[schl]) return _feiertage[schl];
  const ostern = osterSonntag(j), f = {}, ersatz = [];
  for (const r of FEIERTAGE_LAENDER[land] || []) {
    let d, name, beob = null;
    if (r[0] === "f") { d = new Date(j, r[1] - 1, r[2], 12); name = r[3]; beob = r[4] || null; }
    else if (r[0] === "o") { d = addDays(ostern, r[1]); name = r[2]; }
    else if (r[0] === "n") { d = nterWochentag(j, r[1], r[2], r[3], 12); name = r[4]; }
    else if (r[0] === "koning") { d = new Date(j, 3, 27, 12); if (d.getDay() === 0) d = new Date(j, 3, 26, 12); name = r[1]; }   // 27.4., fällt er auf Sonntag: 26.4.
    f[iso(d)] = name;
    if (beob && (d.getDay() === 0 || d.getDay() === 6)) ersatz.push([d, name, beob]);
  }
  /* Ersatztage: USA Sa → Fr davor, So → Mo danach; Großbritannien → nächster freier Werktag */
  for (const [d, name, beob] of ersatz) {
    let e = beob === "us" ? addDays(d, d.getDay() === 6 ? -1 : 1) : addDays(d, d.getDay() === 6 ? 2 : 1);
    while (beob === "gb" && f[iso(e)]) e = addDays(e, 1);
    const zusatz = { de: " (Ersatztag)", en: " (observed)", es: " (trasladado)", fr: " (reporté)" };
    if (!f[iso(e)]) f[iso(e)] = Object.fromEntries(Object.entries(name).map(([k, v]) => [k, v + zusatz[k]]));
  }
  return (_feiertage[schl] = f);
}
function feiertageLand() {   // ältere Einstellung „Keine Feiertage“ (feiertage_region = "aus") bleibt erhalten
  if (einst.feiertage_region === "aus") return "aus";
  return einst.feiertage_land || "DE";
}
function feiertagAm(tag) {
  const land = feiertageLand();
  if (filterAus("feiertage") || land === "aus") return "";
  if (land === "DE") {
    const name = feiertageJahr(tag.getFullYear(), einst.feiertage_region === "aus" ? "" : (einst.feiertage_region || ""))[iso(tag)];
    return name ? t(name) : "";
  }
  const name = feiertageLandJahr(land, tag.getFullYear())[iso(tag)];
  return name ? (name[sprache] || name.en) : "";
}
/* Startland für neue Nutzer: aus der Geräte-Region (z. B. en-US → USA), sonst aus der Sprache */

/* ---------- Chips ---------- */
function chip(it) {
  const v = it.v, erl = it.art === "aufgabe" && istErledigt(v, it.tag);
  const [e, n] = checklisteFortschritt(v.checkliste);
  const kopf = [];
  if (it.art === "aufgabe") kopf.push(h("input", { type: "checkbox", checked: erl, title: "Erledigt", onclick: ev => ev.stopPropagation(), onchange: () => aendern(() => erledigtUmschalten(v._quelle, parseISO(v._start || iso(it.tag)))) }));
  const label = (v.uhrzeit ? v.uhrzeit + " " : "") + titelVon(it) + (n ? ` (${e}/${n})` : "");
  return h("div", { class: "chip" + (erl ? " erl" : ""), style: `background:${farbeVon(v, it.art)}`, rtitle: label, onclick: ev => { ev.stopPropagation(); if (unterdrueckeKlick) return; eintragOeffnen(it); } }, kopf, h("span", null, R(label)));
}
function ferienChip(name) { return h("div", { class: "chip fer", rtitle: name }, h("span", null, R(name))); }

/* ---------- Kopfzeile des Kalenders ---------- */
function titelText() {
  const d = ui.tag;
  if (ui.ansicht === "tag") return `${wochentagName(wochentagNr(d))}, ${deKurz(d)}${d.getFullYear()} · ${t("KW")} ${kwVon(d)}`;
  if (ui.ansicht === "drei") { const e = addDays(d, 2); return `${deKurz(d)} – ${pad(e.getDate())}.${pad(e.getMonth() + 1)}.${e.getFullYear()} · ${t("KW")} ${kwVon(d)}`; }
  if (ui.ansicht === "woche") {
    const mo = montagVon(d), so = addDays(mo, 6);
    return `${deKurz(mo)} – ${pad(so.getDate())}.${pad(so.getMonth() + 1)}.${so.getFullYear()} · ${t("KW")} ${kwVon(mo)}`;
  }
  if (ui.ansicht === "monat") return `${monatName(d.getMonth())} ${d.getFullYear()}`;
  return String(d.getFullYear());
}
function schieben(richtung) {
  const d = ui.tag;
  ui.tag = ui.ansicht in ANSICHT_TAGE ? addDays(d, ANSICHT_TAGE[ui.ansicht] * richtung) : ui.ansicht === "monat" ? addMonate(new Date(d.getFullYear(), d.getMonth(), 1, 12), richtung) : new Date(d.getFullYear() + richtung, d.getMonth(), 1, 12);
  ui._gleiten = richtung; ferienAktualisieren(); render();
}
function kalenderKopf() {
  const seg = h("div", { class: "seg" });
  for (const [k, l] of KALENDER_ANSICHTEN) seg.append(h("button", { class: ui.ansicht === k ? "on" : "", onclick: () => { ui.ansicht = k; uiSpeichern(); render(); } }, l));
  return h("div", { class: "row sb", style: "margin-bottom:14px" },
    h("div", { class: "row" }, h("button", { class: "btn", "aria-label": "Zurück", onclick: () => schieben(-1) }, "‹"), h("button", { class: "btn", onclick: () => { ui.tag = heute(); ui._wkJetzt = true; render(); } }, "Heute"),
      h("button", { class: "btn", "aria-label": "Weiter", onclick: () => schieben(1) }, "›"), h("h2", { style: "margin-left:6px" }, R(titelText()))),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: e => filterPopup(e.currentTarget) }, "Filter" + (einst.filter_aus.length ? " •" : "")),
      h("button", { class: "btn", onclick: freieZeitDialog }, "Freie Zeit"), wetterKnopf()));
}
function neuMenue(tag, uhr, ev) {
  document.querySelectorAll(".ctx").forEach(m => m.remove());
  const st = parseInt(uhr, 10), wunsch = st < 10 ? "Frühstück" : st < 15 ? "Mittagessen" : st < 21 ? "Abendessen" : "Snack", mahlzeit = MAHLZEITEN.includes(wunsch) ? wunsch : MAHLZEITEN[0];
  const zu = () => { m.remove(); document.removeEventListener("pointerdown", aussen, true); document.removeEventListener("keydown", esc, true); };
  const aussen = e => { if (!m.contains(e.target)) zu(); }, esc = e => { if (e.key === "Escape") zu(); };
  const punkt = (text, fn) => h("button", { onclick: () => { zu(); fn(); } }, R(text));
  const vorg = extra => Object.assign({ uhrzeit: uhr, datum: iso(tag) }, extra || {});
  const m = h("div", { class: "ctx", role: "menu" },
    punkt(t("Termin um ") + uhr, () => eintragDialog({ tag, art: "termin", vorgabe: vorg() })),
    punkt(t("Aufgabe um ") + uhr, () => eintragDialog({ tag, art: "aufgabe", vorgabe: vorg() })),
    einst.essen_an !== false ? punkt(t("Essen um ") + uhr, () => eintragDialog({ tag, art: "essen", vorgabe: vorg({ mahlzeit }) })) : null, h("hr"),
    punkt(t("Tag ansehen"), () => tagDialog(tag)));
  document.body.append(m);
  const b = m.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(ev.clientX, innerWidth - b.width - 8)) + "px"; m.style.top = Math.max(8, Math.min(ev.clientY, innerHeight - b.height - 8)) + "px";
  setTimeout(() => { document.addEventListener("pointerdown", aussen, true); document.addEventListener("keydown", esc, true); }, 0);
}
function tagDialog(tag) {
  const liste = eintraegeAm(tag).slice().sort((a, b) => (zeitVon(a) === null ? "" : zeitVon(a)).localeCompare(zeitVon(b) === null ? "" : zeitVon(b)));
  let zu = () => { };
  const rows = liste.map(it => h("div", { class: "li", style: "cursor:pointer", onclick: () => { zu(); eintragOeffnen(it); } },
    h("span", { class: "dot", style: `background:${farbeVon(it.v, it.art)}` }), h("div", { class: "tx" }, h("b", null, R(titelVon(it))), h("div", { class: "mut small" }, zeitVon(it) === null ? "ganztägig" : R(zeitVon(it)))), h("span", { class: "mut small" }, "Öffnen")));
  zu = dialog(`${wochentagName(wochentagNr(tag))}, ${deDatum(iso(tag))}`, liste.length ? h("div", { class: "list" }, rows) : h("div", { class: "empty" }, "Nichts geplant."),
    [{ text: "Schließen" }, { text: "+ Neu", art: "pri", fn: () => { setTimeout(() => eintragDialog({ tag }), 0); } }], { rohTitel: true });
}
function wetterKnopf() {
  const an = einst.wetter_an && (einst.wetter_ort || "").trim().length >= 2;
  return h("button", { class: "btn", title: "Wettervorhersage in Woche und Heute", onclick: wetterDialog }, R("☀ " + (an ? (ui.wetter.name || einst.wetter_ort).split(",")[0] : t("Wetter"))));
}
function wetterDialog() {
  const ort = h("input", { type: "text", value: einst.wetter_ort || "", placeholder: "z. B. Berlin" }), status = h("p", { class: "mut small", style: "margin:0" }, einst.wetter_an ? "" : "Das Wetter ist aus. Mit „Anzeigen“ schaltest du es ein.");
  const ok = () => {
    const o = ort.value.trim(); if (o.length < 2) { toast("Bitte einen Ort eingeben."); return false; }
    aendern(() => { einst.wetter_an = true; einst.wetter_ort = o; }, true); wetterAktualisieren(true);
  };
  ort.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); if (ok() !== false) document.querySelector(".ov")?.remove(); } };
  dialog("Wetter", [feld("Ort", ort), status, h("p", { class: "mut small", style: "margin:0" }, "Die Vorhersage kommt kostenlos von Open-Meteo. Dafür wird der Ortsname aus diesem Feld ins Internet geschickt, sonst nichts.")],
    [...(einst.wetter_an ? [{ text: "Ausschalten", art: "bad", fn: () => { aendern(() => { einst.wetter_an = false; }, true); wetterAktualisieren(); } }] : []), { text: "Abbrechen" }, { text: "Anzeigen", art: "pri", fn: ok }]);
}

/* ---------- Wochenraster (für Kalender und Stundenplan) ---------- */
function rasterBauen(montag, quelleFn, von, bis, klickNeu, opt = {}) {
  const cols = [];
  const tageN = opt.tage || 7;   // 1 = Tag, 3 = drei Tage, 7 = Woche; „montag“ ist dann einfach der erste angezeigte Tag
  const vorItems = Array.from({ length: tageN }, (_, i) => quelleFn(addDays(montag, i)));
  /* Termine, die über Mitternacht gehen, laufen am Folgetag weiter */
  const ueberMitternacht = l => l.filter(it => { const z = zeitVon(it); return z !== null && minutenVon(z) + dauerVon(it) > 1440; });
  const uebertrag = opt.mitternacht ? Array.from({ length: tageN }, (_, i) => ueberMitternacht(i ? vorItems[i - 1] : quelleFn(addDays(montag, -1)))) : Array.from({ length: tageN }, () => []);
  /* Sichtbaren Bereich so erweitern, dass kein Termin der Woche außerhalb liegt (erreichbar durch Scrollen im Kalenderfenster) */
  const sichtVon = von, sichtBis = bis;
  if (opt.ausdehnen) {
    let frueh = von * 60, spaet = bis * 60;
    vorItems.forEach((l, i) => {
      for (const it of l) { const z = zeitVon(it); if (z === null) continue; const b = minutenVon(z); frueh = Math.min(frueh, b); spaet = Math.max(spaet, Math.min(b + dauerVon(it), 1440)); }
      for (const it of uebertrag[i]) { frueh = 0; spaet = Math.max(spaet, Math.min(minutenVon(zeitVon(it)) + dauerVon(it) - 1440, 1440)); }
    });
    von = Math.floor(frueh / 60); bis = Math.min(24, Math.max(von + 1, Math.ceil(spaet / 60)));
  }
  let kuerz = 1e9; for (const l of vorItems) for (const it of l) if (zeitVon(it) !== null) kuerz = Math.min(kuerz, Math.max(dauerVon(it), 30));
  if (kuerz === 1e9) kuerz = 60;
  /* Stundenhöhe wie im Programm: automatisch (kurze Termine lesbar, Fläche füllen) oder per Ziehen an den Uhrzeiten */
  /* Mit Scrollfenster füllt dein eingestellter Bereich (z. B. 7–21 Uhr) das Fenster, frühere und spätere Stunden liegen außerhalb */
  const fensterH = opt.ausdehnen ? (ui._wkFensterH || window.innerHeight - 300) : window.innerHeight - 300;
  let hh = Math.min(Math.max(36, 26 * 60 / kuerz, fensterH / Math.max(opt.ausdehnen ? sichtBis - sichtVon : bis - von, 1)), 90);
  const manuell = opt.drag ? (ui._zieh_h || einst.woche_stunde_h || 0) : 0;
  if (manuell) hh = Math.max(14, Math.min(+manuell, 160));
  const gesamt = (bis - von) * hh, heut = iso(heute());
  const kopf = h("div", { class: "wk-head" }, h("div", { class: "wk-kw", style: "cursor:default;border-left:0", rtitle: `${t("Kalenderwoche")} ${kwVon(montag)}` }, h("div", { class: "dn" }, "KW"), h("div", { class: "dd" }, R(kwVon(montag)))));
  const allday = h("div", { class: "wk-allday" }, h("div", null, "ganztägig"));
  const stunden = h("div", { class: "wk-hours" + (opt.drag ? " zieh" : ""), style: `height:${gesamt}px`, rtitle: opt.drag ? t("Ziehen: Stundenhöhe ändern · Doppelklick: automatisch") : undefined });
  if (opt.drag) {
    stunden.addEventListener("dblclick", () => { einst.woche_stunde_h = 0; ui._zieh_h = 0; speichern(); render(); });
    stunden.addEventListener("pointerdown", ev => {
      if (ev.button !== 0 || ev.pointerType === "touch") return;
      const top = stunden.getBoundingClientRect().top + window.scrollY, y0 = ev.clientY + window.scrollY, hh0 = hh; if (y0 - top < 10) return;
      ev.preventDefault(); let bewegt = false;
      const bew = e2 => {
        const y = e2.clientY + window.scrollY; if (!bewegt && Math.abs(y - y0) < 4) return; bewegt = true; unterdrueckeKlick = true;
        const neu = Math.max(14, Math.min(160, hh0 * (y - top) / (y0 - top))); if (Math.abs(neu - (ui._zieh_h || hh0)) >= 0.5) { ui._zieh_h = neu; if (!ui._zieh_raf) ui._zieh_raf = requestAnimationFrame(() => { ui._zieh_raf = 0; render(); }); }
      };
      const hoch = () => {
        document.removeEventListener("pointermove", bew); document.removeEventListener("pointerup", hoch);
        if (bewegt && ui._zieh_h) { einst.woche_stunde_h = Math.round(ui._zieh_h * 10) / 10; ui._zieh_h = 0; speichern(); render(); }
        setTimeout(() => { unterdrueckeKlick = false; }, 60);
      };
      document.addEventListener("pointermove", bew); document.addEventListener("pointerup", hoch);
    });
  }
  for (let s = von; s <= bis; s++) stunden.append(h("span", { style: `top:${(s - von) * hh}px` }, `${pad(s)}`));
  const koerper = h("div", { class: "wk-body" }, stunden);
  for (let i = 0; i < tageN; i++) {
    const tag = addDays(montag, i), fer = ferienAm(tag), fei = feiertagAm(tag);
    /* Klick auf den Tageskopf: im Kalender zur Tagesansicht dieses Tages, in der Tagesansicht zurück zur Woche */
    kopf.append(h("div", { class: (iso(tag) === heut ? "heute" : "") + (fei ? " feiertag" : ""), rtitle: ui.tab === "kalender" ? t(tageN === 1 ? "Zur Woche" : "Diesen Tag ansehen") : undefined, onclick: () => { if (ui.tab !== "kalender") return; ui.tag = tag; ui.ansicht = tageN === 1 ? "woche" : "tag"; uiSpeichern(); render(); } },
      h("div", { class: "dn" }, R(tageN === 7 ? kurzTag(i) : kurzTag(wochentagNr(tag)))), h("div", { class: "dd" }, R(tag.getDate())), opt.wetter && ui.wetter.tage[iso(tag)] ? h("div", { class: "wt" }, R(`${wetterSymbol(ui.wetter.tage[iso(tag)].code)} ${ui.wetter.tage[iso(tag)].max}°/${ui.wetter.tage[iso(tag)].min}°`)) : null,
      fei ? h("div", { class: "fei", rtitle: fei }, R(fei)) : null, fer ? h("div", { class: "fer", rtitle: fer }, R(fer)) : null));
    const items = vorItems[i], tagsueber = h("div"), col = h("div", { class: "wk-col" + (fer ? " fer" : "") + (fei ? " feiertag" : "") + (iso(tag) === heut ? " heute" : ""), style: `height:${gesamt}px` });
    for (let s = von; s < bis; s++) col.append(h("div", { class: "hl", style: `top:${(s - von) * hh}px` }));
    cols.push({ el: col, tag });
    if (opt.drag) dragAnbinden(col, tag, von, hh);
    else if (opt.verschieben) dragAnbinden(col, tag, von, hh, false, einst.stundenplan_dauer, opt.neuGezogen);   // Stundenplan: Aufziehen = neue Lehrveranstaltung
    else if (opt.hover) dragAnbinden(col, tag, von, hh, true, einst.stundenplan_dauer);
    col.addEventListener("click", ev => {
      if (unterdrueckeKlick || (ev.target !== col && !ev.target.classList.contains("hl"))) return;
      const r = col.getBoundingClientRect(), min = Math.round(((ev.clientY - r.top) / hh * 60 + von * 60) / 15) * 15;
      klickNeu(tag, minutenText(Math.min(min, 1425)), ev);
    });
    const zeitig = []; col._evs = [];
    for (const it of items) {
      const z = zeitVon(it);
      if (z === null) { const c = chip(it); c.addEventListener("pointerdown", e => { if ((opt.drag || opt.verschieben) && e.target.tagName !== "INPUT") verschiebenStarten(e, it, cols, von, hh, true); }); tagsueber.append(c); } else zeitig.push({ it, b: minutenVon(z), e: Math.min(minutenVon(z) + dauerVon(it), 1440) });
    }
    for (const it of uebertrag[i]) zeitig.push({ it, b: 0, e: Math.min(minutenVon(zeitVon(it)) + dauerVon(it) - 1440, 1440), fort: true });
    zeitig.sort((a, b) => a.b - b.b || b.e - a.e);
    // Spalten bei Überlappung
    let gruppe = [], gEnde = -1;
    const abschliessen = () => {
      const spalten = [];
      for (const x of gruppe) { let c = spalten.findIndex(ende => ende <= x.b); if (c < 0) { c = spalten.length; spalten.push(0); } spalten[c] = x.e; x.c = c; }
      for (const x of gruppe) x.n = spalten.length;
    };
    for (const x of zeitig) { if (x.b >= gEnde && gruppe.length) { abschliessen(); gruppe = []; } gruppe.push(x); gEnde = Math.max(gEnde, x.e); }
    if (gruppe.length) abschliessen();
    for (const x of zeitig) {
      const top = (x.b / 60 - von) * hh;
      if (top >= gesamt || (Math.min(x.e, bis * 60) / 60 - von) * hh <= 0) continue;
      const hoehe = Math.max(14, Math.min(Math.max((Math.min(x.e, bis * 60) - x.b) / 60 * hh, 20), gesamt - top));   // nie über das Rasterende hinaus
      const erl = x.it.art === "aufgabe" && istErledigt(x.it.v, x.it.tag);
      const w = 100 / x.n;
      const zeitText = x.fort ? t("bis ") + minutenText(x.e) : minutenText(x.b) + (x.it.v.raum ? " · " + x.it.v.raum : "");
      col._evs.push({ top, unten: top + hoehe, b: x.b, titel: (x.fort ? "↳ " : "") + titelVon(x.it) });
      const evEl = h("div", { class: "ev" + (erl ? " erl" : "") + (x.fort ? " fort" : ""), style: `top:${top}px;height:${hoehe}px;left:calc(${x.c * w}% + 1px);width:calc(${w}% - 3px);background:${farbeVon(x.it.v, x.it.art)}`,
        rtitle: x.fort ? `${titelVon(x.it)} (${t("vom Vortag")}, ${t("bis ")}${minutenText(x.e)})` : `${minutenText(x.b)} ${titelVon(x.it)}`, onclick: ev => { ev.stopPropagation(); if (unterdrueckeKlick) return; eintragOeffnen(x.it); }, onpointerdown: ev => { if ((opt.drag || opt.verschieben) && !x.fort) verschiebenStarten(ev, x.it, cols, von, hh); } },
        h("b", null, R((x.fort ? "↳ " : "") + titelVon(x.it))), hoehe > 34 ? R(zeitText) : null);
      /* Griff an der Unterkante: ziehen = Dauer ändern (nicht bei Essen und nicht bei Fortsetzungen über Mitternacht) */
      if ((opt.drag || opt.verschieben) && !x.fort && x.it.art !== "essen" && x.it.v._quelle)
        evEl.append(h("div", { class: "ev-griff", rtitle: t("Ziehen: Dauer ändern"), onpointerdown: ev => dauerZiehen(ev, evEl, x.it, x.b, hh) }));
      col.append(evEl);
    }
    if (iso(tag) === heut) col.append(h("div", { class: "now", "data-now": "1" }));
    if (opt.ausdehnen) for (const richtung of ["oben", "unten"]) col.append(h("div", { class: "wk-mehr " + richtung, hidden: true, onclick: ev => { ev.stopPropagation(); mehrHinweisKlick(ev.currentTarget); } }));
    allday.append(tagsueber); koerper.append(col);
  }
  const wk = h("div", { class: "wk" + (opt.ausdehnen ? " wk-fenster" : "") + (tageN < 7 ? " wk-wenige" : ""), style: `--wk-tage:${tageN}` }, h("div", { class: "wk-scroll" }, h("div", { class: "wk-in" }, h("div", { class: "wk-top" }, kopf, allday), koerper)));
  wk._von = von; wk._hh = hh; wk._gesamt = gesamt;
  rasterJetzt(wk);
  if (opt.ausdehnen) {
    /* Frisch geöffnet (oder „Heute“ gedrückt): zur aktuellen Uhrzeit springen; beim Neuzeichnen die Position behalten */
    const neu = !document.querySelector(".wk-fenster") || ui._wkJetzt, mitHeute = cols.some(c => iso(c.tag) === heut);
    ui._wkJetzt = false;
    setTimeout(() => fensterEinrichten(wk, sichtVon, neu, mitHeute), 0);   // erst wenn das Raster auf der Seite steht
  }
  return wk;
}
/* ---------- Kalenderfenster: eigenes Scrollen, feste Tageszeile, Hinweise auf Termine außerhalb der Sicht ---------- */
function fensterHoehe(wk) {
  const sc = wk.querySelector(".wk-scroll"), docTop = sc.getBoundingClientRect().top + window.scrollY;
  const leiste = (document.querySelector(".handyleiste") || {}).offsetHeight || 0;   // untere Menüleiste am Handy
  const hoch = Math.max(360, window.innerHeight - docTop - 16 - leiste);
  sc.style.maxHeight = hoch + "px";
  ui._wkFensterH = hoch - wk.querySelector(".wk-top").offsetHeight - 8;
}
function fensterEinrichten(wk, sichtVon, neu, mitHeute) {
  if (!wk.isConnected) return;
  const sc = wk.querySelector(".wk-scroll"), vorher = ui._wkFensterH;
  fensterHoehe(wk);
  const n = new Date();
  const stunde = neu ? (mitHeute ? n.getHours() + n.getMinutes() / 60 - 1 : sichtVon)   // eine Stunde Vorlauf über der aktuellen Zeit
    : ui._wkStunde === undefined ? sichtVon : ui._wkStunde;
  sc.scrollTop = Math.max(0, (stunde - wk._von) * wk._hh);
  ui._wkStunde = wk._von + sc.scrollTop / wk._hh;
  sc.addEventListener("scroll", () => { if (!wk.isConnected) return; ui._wkStunde = wk._von + sc.scrollTop / wk._hh; rasterHinweise(wk); }, { passive: true });   // ein altes, schon ersetztes Raster darf die Position nicht überschreiben
  rasterHinweise(wk);
  /* Beim ersten Mal ist die Fensterhöhe nur geschätzt: einmal mit der echten Höhe neu zeichnen */
  if (!vorher && Math.abs(ui._wkFensterH - (window.innerHeight - 300)) > 20 && !einst.woche_stunde_h) render();
}
function rasterHinweise(wk) {
  const sc = wk.querySelector(".wk-scroll"), oben = wk.querySelector(".wk-top");
  if (!sc || !oben || !wk.isConnected) return;
  const scR = sc.getBoundingClientRect();
  const sichtOben = Math.max(oben.getBoundingClientRect().bottom, 0), sichtUnten = Math.min(scR.top + sc.clientHeight, window.innerHeight - ((document.querySelector(".handyleiste") || {}).offsetHeight || 0));
  for (const col of wk.querySelectorAll(".wk-col")) {
    const r = col.getBoundingClientRect(), vo = sichtOben - r.top, vu = sichtUnten - r.top, evs = col._evs || [];
    const drueber = evs.filter(e => e.unten <= vo + 2), drunter = evs.filter(e => e.top >= vu - 2);
    for (const [el, liste, pfeil, pos] of [[col.querySelector(".wk-mehr.oben"), drueber, "↑", vo + 3], [col.querySelector(".wk-mehr.unten"), drunter, "↓", vu - 25]]) {
      if (!el) continue;
      el.hidden = !liste.length || vu - vo < 60;
      if (el.hidden) continue;
      el.textContent = liste.length === 1 ? `${pfeil} ${minutenText(liste[0].b)} ${liste[0].titel}` : `${pfeil} ${liste.length} ${t("Termine")}`;
      el.title = liste.map(e => `${minutenText(e.b)} ${e.titel}`).join("\n");
      el.style.top = pos + "px";
      el._ziel = pfeil === "↑" ? liste[liste.length - 1].top - 12 : liste[0].top - 12;   // Abstand des Termins zur Oberkante der Sicht
      el._sichtOben = vo;
    }
  }
}
function mehrHinweisKlick(el) {
  const sc = el.closest(".wk-scroll");
  if (sc && el._ziel !== undefined) sc.scrollBy({ top: el._ziel - el._sichtOben, behavior: "smooth" });
}
window.addEventListener("scroll", () => document.querySelectorAll(".wk-fenster").forEach(rasterHinweise), { passive: true });
window.addEventListener("resize", () => document.querySelectorAll(".wk-fenster").forEach(w => { fensterHoehe(w); rasterHinweise(w); }));
setInterval(() => document.querySelectorAll(".wk").forEach(w => { if (w._von !== undefined) rasterJetzt(w); }), 30000);
function rasterJetzt(wk) {
  const n = new Date(), min = n.getHours() * 60 + n.getMinutes();
  wk.querySelectorAll("[data-now]").forEach(el => {
    const top = (min / 60 - wk._von) * wk._hh; el.style.top = top + "px"; el.hidden = top < 0 || top > wk._gesamt;
  });
}

const ANSICHT_TAGE = { tag: 1, drei: 3, woche: 7 };
const KALENDER_ANSICHTEN = [["tag", "Tag"], ["drei", "3 Tage"], ["woche", "Woche"], ["monat", "Monat"], ["jahr", "Jahr"]];
function wochenAnsicht() {
  const tageN = ANSICHT_TAGE[ui.ansicht] || 7, start = tageN === 7 ? montagVon(ui.tag) : ui.tag;   // Tag und 3 Tage beginnen beim gewählten Tag
  const von = Math.min(einst.woche_von, 23), bis = Math.max(einst.woche_bis, von + 1);
  const wk = rasterBauen(start, tag => eintraegeAm(tag), von, Math.min(bis, 24), (tag, uhr, ev) => neuMenue(tag, uhr, ev), { wetter: true, drag: true, ausdehnen: true, mitternacht: true, tage: tageN });
  return wk;
}

/* ---------- Monat ---------- */
function monatsAnsicht() {
  const d = ui.tag, erster = new Date(d.getFullYear(), d.getMonth(), 1, 12), start = montagVon(erster), heut = iso(heute());
  const wochen = Math.ceil((wochentagNr(erster) + tageImMonat(d.getFullYear(), d.getMonth() + 1)) / 7);
  const g = h("div", { class: "mo" });
  g.append(h("div", { class: "dh kw" }, "KW"));
  for (let i = 0; i < 7; i++) g.append(h("div", { class: "dh" }, R(kurzTag(i))));
  for (let i = 0; i < wochen * 7; i++) {
    const tag = addDays(start, i), fer = ferienAm(tag), fei = feiertagAm(tag), items = eintraegeAm(tag);
    if (i % 7 === 0) g.append(h("div", { class: "kw", rtitle: `${t("Kalenderwoche")} ${kwVon(tag)}`, onclick: () => { ui.tag = tag; ui.ansicht = "woche"; uiSpeichern(); render(); } }, R(kwVon(tag))));
    items.sort((a, b) => ((zeitVon(a) || "") < (zeitVon(b) || "") ? -1 : 1));
    const zelle = h("div", { class: "tag" + (i % 7 === 6 ? " so" : "") + (tag.getMonth() !== d.getMonth() ? " aus" : "") + (iso(tag) === heut ? " heute" : "") + (fer ? " fer" : "") + (fei ? " feiertag" : ""), onclick: () => { ui.tag = tag; ui.ansicht = "woche"; uiSpeichern(); render(); } },
      h("div", { class: "n" }, R(tag.getDate())));
    if (fei) zelle.append(h("div", { class: "chip fei", rtitle: fei }, h("span", null, R(fei))));
    if (fer) zelle.append(ferienChip(fer));
    for (const it of items.slice(0, 3)) zelle.append(chip(it));
    if (items.length > 3) zelle.append(h("div", { class: "mehr" }, R(`+${items.length - 3}`), " ", "weitere"));
    g.append(zelle);
  }
  return g;
}

/* ---------- Jahr ---------- */
function jahresAnsicht() {
  const j = ui.tag.getFullYear(), heut = iso(heute()), box = h("div", { class: "jahr" });
  for (let m = 0; m < 12; m++) {
    const erster = new Date(j, m, 1, 12), g = h("div", { class: "g" });
    g.append(h("b", { class: "kw" }, "KW"));
    for (let i = 0; i < 7; i++) g.append(h("b", null, R(kurzTag(i).slice(0, 2))));
    const kwZelle = tag => h("span", { class: "kw", rtitle: `${t("Kalenderwoche")} ${kwVon(tag)}`, onclick: () => { ui.tag = tag; ui.ansicht = "woche"; uiSpeichern(); render(); } }, R(kwVon(tag)));
    g.append(kwZelle(erster));
    for (let i = 0; i < wochentagNr(erster); i++) g.append(h("span"));
    for (let t = 1; t <= tageImMonat(j, m + 1); t++) {
      const tag = new Date(j, m, t, 12), n = eintraegeAm(tag).length, fer = ferienAm(tag), fei = feiertagAm(tag);
      if (t > 1 && wochentagNr(tag) === 0) g.append(kwZelle(tag));   // jede neue Woche beginnt mit ihrer KW
      g.append(h("i", { class: (n ? "l" + Math.min(n, 3) : "") + (fer ? " f" : "") + (fei ? " ft" : "") + (iso(tag) === heut ? " h" : ""), rtitle: [fei, fer].filter(Boolean).join(" · ") || undefined, onclick: () => { ui.tag = tag; ui.ansicht = "woche"; uiSpeichern(); render(); } }, R(t)));
    }
    box.append(h("div", { class: "mini" }, h("h3", { onclick: () => { ui.tag = erster; ui.ansicht = "monat"; uiSpeichern(); render(); } }, R(monatName(m))), g));
  }
  return box;
}

function kalenderTab() {
  if (!KALENDER_ANSICHTEN.some(([k]) => k === ui.ansicht)) ui.ansicht = "woche";
  const inhalt = ui.ansicht in ANSICHT_TAGE ? wochenAnsicht() : ui.ansicht === "monat" ? monatsAnsicht() : jahresAnsicht();
  const ueber = ueberfaelligeAufgaben(daten).length;
  return h("div", null, subNav(KALENDER_ANSICHTEN, ui.ansicht, k => { ui.ansicht = k; uiSpeichern(); render(); }), kalenderKopf(),
    ueber ? h("div", { class: "warnbox", style: "margin-bottom:12px;cursor:pointer", onclick: () => { ui.tab = "fristen"; render(); } }, R(`${ueber} `), ueber === 1 ? "überfällige Aufgabe – hier ansehen" : "überfällige Aufgaben – hier ansehen") : null,
    inhalt, ferienHinweis());
}
function ferienHinweis() {
  if (einst.ferien_art === "aus") return null;
  if (ui.ferienStatus) return h("p", { class: "mut small" }, ui.ferienStatus);
  return null;
}

/* ---------- Filter ---------- */
function filterPopup(anker) {
  const alt = $(".pop"); if (alt) { alt.remove(); return; }
  const pop = h("div", { class: "pop" });
  const punkte = [["typ:aufgabe", "Aufgaben"], ["typ:termin", "Termine"]].concat(einst.essen_an !== false ? [["typ:essen", "Essen"]] : []);
  if (feiertageLand() !== "aus") punkte.push(["feiertage", "Feiertage"]);
  if (einst.ferien_art !== "aus") punkte.push(["ferien", "Ferien"]);
  const kats = einst.kategorien.map(k => ["kat:" + k, k, true]);
  const zeichnen = () => {
    pop.replaceChildren(h("div", { class: "row sb" }, h("h3", null, "Anzeigen"),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { aendern(() => { einst.filter_aus = []; }, true); zeichnen(); render(); } }, "Alle an"),
        h("button", { class: "btn sm", onclick: () => { aendern(() => { einst.filter_aus = [...punkte, ...kats].map(p => p[0]); }, true); zeichnen(); render(); } }, "Alle aus"))),
      h("div", { class: "tog" }, punkte.map(([k, l]) => togKnopf(k, l, false, zeichnen))),
      h("h3", { style: "margin-top:12px" }, "Kategorien"), h("div", { class: "tog" }, kats.map(([k, l]) => togKnopf(k, l, true, zeichnen))));
  };
  zeichnen();
  const r = anker.getBoundingClientRect();
  pop.style.top = (window.scrollY + r.bottom + 6) + "px"; pop.style.left = Math.max(8, Math.min(window.scrollX + r.right - 360, window.innerWidth - 376)) + "px";
  document.body.append(pop);
  const zu = ev => { if (!pop.contains(ev.target) && ev.target !== anker) { pop.remove(); document.removeEventListener("mousedown", zu); } };
  setTimeout(() => document.addEventListener("mousedown", zu), 0);
}
function togKnopf(schl, label, roh, neuZeichnen) {
  const an = !filterAus(schl);
  return h("button", { class: an ? "on" : "", onclick: () => { aendern(() => { const i = einst.filter_aus.indexOf(schl); if (i >= 0) einst.filter_aus.splice(i, 1); else einst.filter_aus.push(schl); }, true); neuZeichnen(); render(); } }, roh ? R(label) : label);
}

/* ---------- Ferien aus dem Internet ---------- */
const FERIEN_CACHE = "alltagsplaner.ferien.v1";
function ferienSchluessel() { return [einst.ferien_art, einst.ferien_land, einst.ferien_region, einst.ferien_ics].join("|"); }
async function ferienAktualisieren(erzwingen = false) {
  ui.ferienStatus = "";
  if (einst.ferien_art === "aus") { ui.ferien = {}; return; }
  const jahre = [ui.tag.getFullYear(), ui.tag.getFullYear() + 1], key = ferienSchluessel() + "|" + jahre.join(",");
  let cache = null; try { cache = JSON.parse(localStorage.getItem(FERIEN_CACHE) || "null"); } catch (e) { }
  if (cache && cache.key === key && !erzwingen && Date.now() - cache.zeit < 7 * 864e5) { ui.ferien = ferienIndex(cache.liste); return; }
  try {
    const liste = await ferienAbrufen(einst, jahre);
    try { localStorage.setItem(FERIEN_CACHE, JSON.stringify({ key, zeit: Date.now(), liste })); } catch (e) { }
    ui.ferien = ferienIndex(liste); ui.ferienStatus = "";
    if (erzwingen) toast(`${liste.length} Ferienzeiträume geladen.`);
  } catch (e) {
    if (cache && cache.liste) { ui.ferien = ferienIndex(cache.liste); ui.ferienStatus = "Ferien: Internet nicht erreichbar – zuletzt gespeicherte Daten werden angezeigt."; }
    else { ui.ferien = {}; ui.ferienStatus = "Ferien konnten nicht geladen werden (keine Internetverbindung oder der Dienst ist in dieser Ansicht gesperrt)."; }
  }
  if (ui.tab === "kalender" || ui.tab === "einstellungen") { const rest = (ui._animBis || 0) - performance.now(); if (rest > 0) setTimeout(render, rest + 20); else render(); }   // nicht mitten in eine Animation hineinzeichnen
}

/* ---------- Freie Zeit finden ---------- */
function freieZeitDialog() {
  const dauer = h("input", { type: "number", min: 15, step: 15, value: 60 });
  const von = h("input", { type: "date", value: iso(heute()) }), bis = h("input", { type: "date", value: iso(addDays(heute(), 6)) });
  const res = h("div", { class: "list", style: "max-height:280px;overflow:auto" });
  const suchen_ = () => {
    res.replaceChildren();
    const f = freieFenster(daten, einst, Math.max(parseInt(dauer.value, 10) || 60, 5), parseISO(von.value), parseISO(bis.value));
    if (!f.length) { res.append(h("div", { class: "empty" }, "Keine freien Fenster gefunden.")); return; }
    for (const x of f.slice(0, 60)) res.append(h("div", { class: "li" }, h("div", { class: "tx" }, h("b", null, R(`${kurzTag(wochentagNr(x.tag))} ${deDatum(iso(x.tag))}`)), h("div", { class: "mut" }, R(`${minutenText(x.von)} – ${minutenText(x.bis)}`))),
      h("button", { class: "btn sm", onclick: () => { eintragDialog({ art: "termin", tag: x.tag, vorgabe: { uhrzeit: minutenText(x.von), datum: iso(x.tag) } }); } }, "Termin anlegen")));
  };
  dialog("Freie Zeit finden", [h("div", { class: "grid2" }, feld("Dauer (Minuten)", dauer), feld("Von", von), feld("Bis", bis)),
    h("button", { class: "btn pri", onclick: suchen_ }, "Suchen"), res], [{ text: "Schließen" }], { breit: true });
  suchen_();
}

/* ---------- Stundenplan ---------- */
function stundenplanTab() {
  const montag = montagVon(ui.spPlan);
  const lv = stundenplanWoche(daten, montag);
  let von = 8, bis = 18;
  for (const tag of lv) for (const v of tag) if (v.uhrzeit) { von = Math.min(von, Math.floor(minutenVon(v.uhrzeit) / 60)); bis = Math.max(bis, Math.ceil((minutenVon(v.uhrzeit) + (v.dauer || einst.stundenplan_dauer)) / 60)); }
  const quelle = tag => stundenplanWoche(daten, montag)[diffDays(tag, montag)].map(v => ({ art: "termin", v, tag }));
  /* Klick ins Raster: direkt eine Lehrveranstaltung an dieser Stelle anlegen (Dauer aus den Einstellungen) */
  const wk = rasterBauen(montag, quelle, von, Math.min(bis, 24), (tag, uhr) => lvNeu(tag, uhr),
    { verschieben: true, neuGezogen: (tag, start, dauer) => lvNeu(tag, minutenText(start), dauer) });
  const so = addDays(montag, 6);
  return h("div", null,
    h("div", { class: "row sb", style: "margin-bottom:14px" },
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { ui.spPlan = addDays(ui.spPlan, -7); render(); } }, "‹"), h("button", { class: "btn", onclick: () => { ui.spPlan = heute(); render(); } }, "Heute"),
        h("button", { class: "btn", onclick: () => { ui.spPlan = addDays(ui.spPlan, 7); render(); } }, "›"), h("h2", { style: "margin-left:6px" }, "Stundenplan"), h("span", { class: "mut" }, R(`${deKurz(montag)} – ${deKurz(so)}`)))),
    wk, lvListe());
}
/* Neue Lehrveranstaltung: der volle Eintragsdialog (Farbe, Notiz, Teilschritte, Semesterende …), vorbelegt fuer den Stundenplan */
function lvNeu(tag, uhr, dauer) {
  return eintragDialog({ art: "termin", lv: true, tag, vorgabe: { uhrzeit: uhr, datum: iso(tag), dauer: dauer || einst.stundenplan_dauer, wiederholung: "wöchentlich" } });
}
function lvListe() {
  const l = lehrveranstaltungen(daten);
  if (!l.length) return h("div", { class: "card empty", style: "margin-top:14px" }, "Noch keine Lehrveranstaltungen. Lege die erste mit „+ Neu“ an (am Handy: „+“ in der unteren Leiste).");
  return h("div", { class: "card", style: "margin-top:14px" }, h("h3", null, "Alle Lehrveranstaltungen"), h("div", { class: "list" }, l.map(a =>
    h("div", { class: "li" }, h("span", { class: "dot", style: `background:${farbeVon(a, "aufgabe")}` }),
      h("div", { class: "tx" }, h("b", null, R(a.name)), h("div", { class: "mut small" }, R(`${wochentagName(wochentagNr(parseISO(a.datum)))} ${a.uhrzeit || ""}${a.raum ? " · " + a.raum : ""}${a.dozent ? " · " + a.dozent : ""}`))),
      h("button", { class: "btn sm", onclick: () => eintragDialog({ v: Object.assign({}, a, { _start: a.datum, _anfang: a.datum }), quelle: a, art: "termin", tag: parseISO(a.datum) }) }, "Bearbeiten")))));
}

