/* OSA – Oberfläche Teil 3: Lernziele, Aufgaben, Einkauf, Budget, Statistik, Suche */
"use strict";
/* ============================================================
   Oberfläche, Teil 3: Fächer, Fristen, Einkauf, Budget, Statistik, Suche
   ============================================================ */
function kopfZeile(titel, ...rechts) { return h("div", { class: "row sb", style: "margin-bottom:14px" }, h("h2", { class: "kz" }, titel), h("div", { class: "row" }, rechts)); }
function fortschritt(anteil, ok) { return h("div", { class: "prog" }, h("i", { class: ok ? "ok" : "", style: `width:${Math.max(0, Math.min(100, anteil * 100))}%` })); }
function leer(text) { return h("div", { class: "empty" }, text); }

/* ---------- Fächer ---------- */
function faecherTab() {
  const montag = ui.faMontag || (ui.faMontag = montagVon(heute())), fp = fachFortschritt(daten, montag), so = addDays(montag, 6);
  const liste = h("div", { class: "list" });
  for (const f of fp) {
    const ziel = f.ziel, anteil = ziel ? f.erledigt / ziel : 0;
    liste.append(h("div", { class: "li", style: "flex-wrap:wrap" },
      h("div", { class: "tx", style: "min-width:200px" }, h("b", null, R(f.name)), h("div", { class: "mut small" }, R(`${stundenText(f.erledigt)} `), "von", R(` ${ziel ? stundenText(ziel) : "–"} `), "Wochenziel", R(` · ${stundenText(f.geplant)} `), "geplant")),
      h("div", { style: "flex:1;min-width:140px" }, ziel ? fortschritt(anteil, anteil >= 1) : h("span", { class: "mut small" }, "kein Ziel gesetzt")),
      h("button", { class: "btn sm", onclick: () => fachDialog(f.name) }, "Bearbeiten")));
  }
  const woche = n => () => { ui.faMontag = n === 0 ? montagVon(heute()) : addDays(montag, 7 * n); ui._gleiten = n; render(); };
  return h("div", null, kopfZeile("Lernziele"),
    h("div", { class: "row", style: "margin-bottom:10px" }, h("button", { class: "btn", "aria-label": "Zurück", onclick: woche(-1) }, "‹"), h("b", { style: "min-width:230px;text-align:center" }, R(`KW ${kwNr(montag)}: ${deKurz(montag)} – ${pad(so.getDate())}.${pad(so.getMonth() + 1)}.${so.getFullYear()}`)),
      h("button", { class: "btn", "aria-label": "Weiter", onclick: woche(1) }, "›"), h("button", { class: "btn", onclick: woche(0) }, "Diese Woche")),
    h("p", { class: "mut", style: "margin:0 0 12px" }, "Lege für jedes Fach ein Wochenziel in Stunden fest. Der Balken füllt sich mit erledigten Lernaufgaben und mit dem Fokus-Timer."),
    timerKarte(),
    h("div", { class: "card" }, fp.length ? liste : leer("Noch keine Fächer. Lege mit „+ Neu“ ein Fach an, zum Beispiel „Mathe“ mit 4 Stunden pro Woche (am Handy: „+“ in der unteren Leiste).")));
}
function fachDialog(name) {
  const alt = name !== undefined, n = h("input", { type: "text", value: name || "" }), z = h("input", { type: "number", min: 0, step: 0.5, value: alt ? daten.faecher[name].ziel || 0 : 4 });
  let farbe = alt ? fachFarbe(name) : "";
  dialog(alt ? "Fach bearbeiten" : "Neues Fach", [feld("Name", n), feld("Wochenziel (Stunden)", z), feld("Farbe für alle Einträge dieses Fachs", farbwahl(farbe, c => { farbe = c; }))], [
    ...(alt ? [{ text: "Löschen", art: "bad", fn: () => aendern(() => { delete daten.faecher[name]; }) }] : []), { text: "Abbrechen" },
    { text: "Speichern", art: "pri", fn: () => {
      const neu = n.value.trim(); if (!neu) { toast("Bitte einen Namen eintragen."); return false; }
      aendern(() => {
        const vorher = alt ? daten.faecher[name] || {} : {};   // weitere Angaben (z. B. Farbe) behalten
        if (alt && neu !== name) { delete daten.faecher[name]; for (const a of daten.aufgaben) if (a.fach === name) a.fach = neu; }
        daten.faecher[neu] = Object.assign({}, vorher, { ziel: Math.max(parseFloat(z.value) || 0, 0) });
        if (farbe) daten.faecher[neu].farbe = farbe; else delete daten.faecher[neu].farbe;
      });
    } }]);
}

/* ---------- Fristen ---------- */
function ueberfaelligLoeschen(u) {
  const q = u.quelle;
  if (u.anfang === null) return bestaetigen("Diesen Eintrag löschen?", () => aendern(() => loescheQuelle(q, "aufgabe")));
  dialog("Wiederkehrenden Eintrag löschen", h("p", { style: "margin:0" }, "Nur diesen Termin oder alle Wiederholungen löschen?"), [
    { text: "Abbrechen" },
    { text: "Nur dieser", fn: () => aendern(() => { q.ausnahmen = q.ausnahmen || {}; (q.ausnahmen[u.anfang] = q.ausnahmen[u.anfang] || {}).geloescht = true; }) },
    { text: "Alle", art: "bad", fn: () => aendern(() => loescheQuelle(q, "aufgabe")) }]);
}
function ueberfaelligDatum(u) {
  const d = h("input", { type: "date", value: iso(heute()) });
  dialog("Verschieben auf …", [feld("Neues Datum", d)], [{ text: "Abbrechen" }, { text: "Verschieben", art: "pri", fn: () => {
    if (!d.value) { toast("Bitte ein Datum wählen."); return false; }
    aendern(() => ueberfaelligVerschieben(u, parseISO(d.value)));
  } }]);
}
/* Aufgabenseite: Sortieren, Filtern, Mehrfachauswahl */
const aufFilter = { text: "", prio: "", fach: "" };
let aufAuswahl = new Set(), aufAuswahlModus = false;
function aufPasst(q) {
  if (aufFilter.prio && String(q.prio || 2) !== aufFilter.prio) return false;
  if (aufFilter.fach && (q.fach || "") !== aufFilter.fach) return false;
  const s = aufFilter.text.trim().toLowerCase();
  return !s || [q.name, q.fach, q.notiz, q.kategorie].some(x => String(x || "").toLowerCase().includes(s));
}
function aufSortieren(liste, qv, standard) {
  const modus = einst.aufgaben_sort || "standard";
  const cmp = { prio: (a, b) => ((qv(a).prio || 2) - (qv(b).prio || 2)) || standard(a, b), name: (a, b) => String(qv(a).name).localeCompare(String(qv(b).name)),
    fach: (a, b) => String(qv(a).fach || "￿").localeCompare(String(qv(b).fach || "￿")) || standard(a, b) }[modus] || standard;
  return liste.slice().sort(cmp);
}
function aufDatumDialog(wahl) {
  const d = h("input", { type: "date", value: iso(heute()) });
  dialog("Verschieben auf …", [feld("Neues Datum", d)], [{ text: "Abbrechen" }, { text: "Verschieben", art: "pri", fn: () => {
    if (!d.value) { toast("Bitte ein Datum wählen."); return false; }
    aufAuswahl.clear();
    aendern(() => { for (const q of wahl) { const dauer = q.datum && q.enddatum ? Math.max(0, diffDays(parseISO(q.enddatum), parseISO(q.datum))) : 0; q.datum = d.value; q.enddatum = dauer ? iso(addDays(parseISO(d.value), dauer)) : ""; } });
  } }]);
}
function aufKategorieDialog(wahl) {
  const s = auswahl(einst.kategorien.map(k => [k, k]), einst.kategorien[0], true);
  dialog("Kategorie ändern", [feld("Kategorie", s)], [{ text: "Abbrechen" }, { text: "Speichern", art: "pri", fn: () => { aufAuswahl.clear(); aendern(() => { for (const q of wahl) q.kategorie = s.value; }); } }]);
}
function aufKappen(liste, schluessel, start = 100) {   // lange Listen zeigen zuerst nur die ersten Einträge (schnelleres Zeichnen), „Mehr anzeigen“ holt weitere
  ui.aufMehr = ui.aufMehr || {};
  const grenze = ui.aufMehr[schluessel] || start;
  if (liste.length <= grenze) return [liste, null];
  return [liste.slice(0, grenze), h("button", { class: "btn sm", "data-mehr": schluessel, onclick: () => { ui.aufMehr[schluessel] = grenze + 200; render(); } }, R(`${t("Mehr anzeigen")} (${liste.length - grenze} ${t("weitere")})`))];
}
function aufNaechster(a, ab = heute()) {   // nächster noch nicht erledigter Termin einer wiederkehrenden Aufgabe (Datum) oder null
  for (let i = 0; i <= 400; i++) {
    const tag = addDays(ab, i);
    if (vorkommenAm(a, tag).some(v => v._start === iso(tag) && !istErledigt(v, tag))) return tag;
  }
  return null;
}
function aufVorlagenDialog() {
  const liste = (Array.isArray(einst.aufgaben_vorlagen) ? einst.aufgaben_vorlagen : []).filter(v => v && typeof v.name === "string");
  let zu = () => { };
  const zeile = v => h("div", { class: "li", "data-vorlage-aufgabe": v.name },
    h("div", { class: "tx" }, h("b", null, R(v.name)), h("div", { class: "mut small" }, R([t(v.typ === "termin" ? "Termin" : "Aufgabe"), v.kategorie, v.fach, v.dauer ? `${v.dauer} ${t("Min")}` : "", (v.checkliste || []).length ? `${v.checkliste.length} ${t("Teilschritte")}` : "", v.wiederholung && v.wiederholung !== "keine" ? "↻ " + t(v.wiederholung) : ""].filter(Boolean).join(" · ")))),
    h("button", { class: "btn sm pri", "data-aktion": "verwenden", onclick: () => { zu(); eintragDialog({ art: v.typ === "termin" ? "termin" : "aufgabe", tag: heute(), vorgabe: { name: v.name, dauer: v.dauer, prio: v.prio, kategorie: v.kategorie, fach: v.fach, raum: v.raum, dozent: v.dozent, uhrzeit: v.uhrzeit, notiz: v.notiz, checkliste: (v.checkliste || []).map(p => ({ text: p.text, erledigt: false })), wiederholung: v.wiederholung || "keine" } }); } }, "Verwenden"),
    h("button", { class: "btn sm bad", "data-aktion": "vorlage-loeschen", title: "Vorlage löschen", "aria-label": "Vorlage löschen", onclick: () => { zu(); bestaetigen("Diese Vorlage löschen?", () => aendern(() => { einst.aufgaben_vorlagen = einst.aufgaben_vorlagen.filter(x => x !== v); })); } }, "✕"));
  zu = dialog("Aufgaben-Vorlagen", [h("p", { class: "mut small", style: "margin:0" }, "Vorlagen sparen Tipparbeit bei Aufgaben, die immer ähnlich sind. Speichern kannst du sie im Eintrags-Dialog mit „Als Vorlage speichern“."),
    liste.length ? h("div", { class: "list" }, liste.map(zeile)) : h("div", { class: "empty" }, "Noch keine Vorlagen.")], [{ text: "Schließen", art: "pri" }]);
}
function fristenTab() {
  const ueber = ueberfaelligeAufgaben(daten);
  const frAlle = fristenListe(daten), fr = aufSortieren(frAlle.filter(f => aufPasst(f.quelle)), f => f.quelle, (a, b) => (a.frist - b.frist) || a.name.localeCompare(b.name));
  const gefiltert = !!(aufFilter.text.trim() || aufFilter.prio || aufFilter.fach);
  const ansicht = einst.aufgaben_ansicht === "kategorie" ? "kategorie" : "datum";
  const kart = [], katKarten = [], [ueberSicht, ueberMehr] = aufKappen(ueber, "ueber", 50);
  if (ueber.length) {
    kart.push(h("div", { class: "card aufg-breit" }, h("div", { class: "row sb" }, h("h3", null, "Überfällig"),
      h("button", { class: "btn sm", onclick: () => aendern(() => { for (const u of ueber) ueberfaelligVerschieben(u, heute()); }) }, "Alle auf heute verschieben")),
      h("div", { class: "list" }, ueberSicht.map(u => h("div", { class: "li", style: "flex-wrap:wrap" }, h("div", { class: "tx", style: "min-width:150px" }, h("b", null, R(u.name)), h("div", { class: "mut small" }, R(deDatum(iso(u.tag))))),
        h("span", { class: "pill bad" }, R(tageT(diffDays(u.tag, heute())))),
        h("button", { class: "btn sm", onclick: () => aendern(() => ueberfaelligVerschieben(u, heute())) }, "Auf heute"),
        h("button", { class: "btn sm", onclick: () => aendern(() => ueberfaelligVerschieben(u, addDays(heute(), 1))) }, "Auf morgen"),
        h("button", { class: "btn sm", onclick: () => ueberfaelligDatum(u) }, "Anderes Datum …"),
        h("button", { class: "btn sm bad", onclick: () => ueberfaelligLoeschen(u) }, "Löschen"),
        h("button", { class: "btn sm", onclick: () => aendern(() => { if (u.anfang === null) u.quelle.erledigt = true; else (u.quelle.erledigt_tage = u.quelle.erledigt_tage || []).push(iso(u.tag)); }) }, "Erledigt")))), ueberMehr ? h("div", { class: "row", style: "margin-top:8px" }, ueberMehr) : null));
  }
  const neueAufgabeDaten = (tx, datum, kat) => ({ name: tx, typ: "aufgabe", dauer: 30, prio: 2, kategorie: kat || einst.kategorien[0], fach: "", raum: "", dozent: "", vorlauf: 0, notiz: "", checkliste: [], datum, uhrzeit: "", enddatum: "", wiederholung: "keine", wiederholen_bis: "", erledigt: false, erledigt_tage: [], farbe: "", ausnahmen: {} });
  const auswahlBox = q => h("input", { type: "checkbox", class: "aufg-wahl", title: "Auswählen", checked: aufAuswahl.has(q), onchange: ev => { if (ev.target.checked) aufAuswahl.add(q); else aufAuswahl.delete(q); render(); } });
  const wichtig = q => (q.prio || 2) === 1 ? h("span", { class: "pill warn", title: "wichtig" }, "!") : null;
  const sichtbar = [];
  const zeileMit = f => (sichtbar.push(f.quelle), h("div", { class: "li" },
    aufAuswahlModus ? auswahlBox(f.quelle) : h("input", { type: "checkbox", title: "Erledigt", onchange: () => aendern(() => { f.quelle.erledigt = true; }) }),
    h("div", { class: "tx" }, h("b", null, R(f.name)), h("div", { class: "mut small" }, R(`${deDatum(iso(f.frist))}${f.quelle.fach ? " · " + f.quelle.fach : ""}${ansicht === "datum" && f.quelle.kategorie ? " · " + f.quelle.kategorie : ""}`))),
    wichtig(f.quelle), h("span", { class: "pill " + (f.tage <= 1 ? "bad" : f.im_vorlauf ? "warn" : "") }, R(tageT(f.tage))),
    h("button", { class: "btn sm", onclick: () => eintragDialog({ v: Object.assign({}, f.quelle, { _start: f.quelle.datum, _anfang: f.quelle.datum }), quelle: f.quelle, art: "aufgabe", tag: parseISO(f.quelle.datum) }) }, "Bearbeiten"),
    h("button", { class: "btn sm bad aufg-loeschen", title: "Löschen", "aria-label": "Löschen", onclick: () => bestaetigen("Diesen Eintrag löschen?", () => aendern(() => loescheQuelle(f.quelle, "aufgabe"))) }, "✕")));
  const einfach = a => (a.typ || "aufgabe") === "aufgabe" && (a.wiederholung || "keine") === "keine";
  const ohne = daten.aufgaben.filter(a => einfach(a) && !a.datum);
  const nameCmp = (a, b) => a.name.localeCompare(b.name);
  const offenOhne = aufSortieren(ohne.filter(a => !a.erledigt && aufPasst(a)), a => a, nameCmp), fertigOhne = aufSortieren(ohne.filter(a => a.erledigt && aufPasst(a)), a => a, nameCmp);
  const fertigMit = aufSortieren(daten.aufgaben.filter(a => einfach(a) && a.datum && a.erledigt && aufPasst(a)), a => a, (a, b) => String(b.datum).localeCompare(String(a.datum)) || nameCmp(a, b));
  const fertigAlle = daten.aufgaben.filter(a => einfach(a) && a.erledigt);
  const fertigEntfernen = bereich => aendern(() => { daten.aufgaben = daten.aufgaben.filter(a => !(einfach(a) && a.erledigt && (bereich === "alle" || (bereich === "mit" ? !!a.datum : !a.datum)))); });
  const zeigeKat = ansicht === "datum";
  const serienAlle = daten.aufgaben.filter(a => (a.typ || "aufgabe") === "aufgabe" && (a.wiederholung || "keine") !== "keine" && a.datum);
  const serien = aufSortieren(serienAlle.filter(aufPasst).map(a => ({ quelle: a, naechster: aufNaechster(a) })), s => s.quelle, (a, b) => (a.naechster ? a.naechster.getTime() : 9e15) - (b.naechster ? b.naechster.getTime() : 9e15) || nameCmp(a.quelle, b.quelle));
  const serienKarte = !serien.length ? null : h("div", { class: "card", "data-karte": "serien" }, h("h3", null, "Wiederkehrend"),
    h("div", { class: "list" }, serien.map(s => { const q = s.quelle; return h("div", { class: "li", "data-serie": q.name },
      h("input", { type: "checkbox", title: "Nächsten Termin erledigt", disabled: !s.naechster, onchange: () => aendern(() => erledigtUmschalten(q, s.naechster)) }),
      h("div", { class: "tx" }, h("b", null, R(q.name)), h("div", { class: "mut small" }, R(["↻ " + t(q.wiederholung), s.naechster ? `${t("nächster Termin")}: ${kurzTag(wochentagNr(s.naechster))} ${deKurz(s.naechster)}` : t("kein weiterer Termin"), q.fach, zeigeKat ? q.kategorie : ""].filter(Boolean).join(" · ")))),
      wichtig(q),
      h("button", { class: "btn sm", onclick: () => eintragDialog({ v: Object.assign({}, q, { _start: q.datum, _anfang: q.datum }), quelle: q, art: "aufgabe", tag: parseISO(q.datum) }) }, "Bearbeiten"),
      h("button", { class: "btn sm bad aufg-loeschen", title: "Löschen", "aria-label": "Löschen", onclick: () => bestaetigen("Alle Wiederholungen dieser Aufgabe löschen?", () => aendern(() => loescheQuelle(q, "aufgabe"))) }, "✕")); })));
  const zeileOhne = a => (sichtbar.push(a), h("div", { class: "li" },   // einfache Aufgabe mit oder ohne Datum (auch erledigte)
    aufAuswahlModus ? auswahlBox(a) : h("input", { type: "checkbox", checked: !!a.erledigt, title: "Erledigt", onchange: () => aendern(() => { a.erledigt = !a.erledigt; }) }),
    h("div", { class: "tx", style: a.erledigt ? "text-decoration:line-through;opacity:.55" : "" }, h("b", null, R(a.name)),
      a.datum || a.fach || (a.checkliste || []).length || (zeigeKat && a.kategorie) ? h("div", { class: "mut small" }, R([a.datum ? deDatum(a.datum) : "", a.fach, (a.checkliste || []).length ? `${a.checkliste.filter(p => p.erledigt).length}/${a.checkliste.length}` : "", zeigeKat ? a.kategorie : ""].filter(Boolean).join(" · "))) : null),
    h("button", { class: "btn sm", onclick: () => eintragDialog({ v: Object.assign({}, a, { _start: a.datum || "", _anfang: a.datum || "" }), quelle: a, art: "aufgabe", tag: a.datum ? parseISO(a.datum) : heute() }) }, "Bearbeiten"),
    wichtig(a), h("button", { class: "btn sm bad aufg-loeschen", title: "Löschen", "aria-label": "Löschen", onclick: () => bestaetigen("Diesen Eintrag löschen?", () => aendern(() => loescheQuelle(a, "aufgabe"))) }, "✕")));
  const zeileAus = x => x.m ? zeileMit(x.m) : zeileOhne(x.o);
  const katAuswahl = () => { const s = auswahl(einst.kategorien.map(k => [k, k]), einst.kategorien.includes(ui.aufNeuKat) ? ui.aufNeuKat : einst.kategorien[0], true); s.onchange = () => { ui.aufNeuKat = s.value; }; return s; };   // zuletzt gewählte Kategorie bleibt
  const entfernenKnopf = (bereich, n) => n ? h("button", { class: "btn sm", "data-entfernen": bereich, onclick: () => fertigEntfernen(bereich) }, "Erledigte entfernen") : null;

  if (ansicht === "datum") {
    const eingM = h("input", { type: "text", id: "mit-datum-eingabe", placeholder: "Neue Aufgabe mit Datum …", style: "flex:1;min-width:160px" });
    const datM = h("input", { type: "date", value: iso(heute()), title: "Datum" }), selM = katAuswahl();
    const neuMit = () => {
      const tx = eingM.value.trim().replace(/\s+/g, " "); if (!tx) return;
      if (!datM.value) { toast("Bitte ein Datum wählen."); return; }
      const d = datM.value, k = selM.value; eingM.value = ""; ui.aufNeuKat = k;
      aendern(() => { daten.aufgaben.push(neueAufgabeDaten(tx, d, k)); });
      setTimeout(() => { const e = document.getElementById("mit-datum-eingabe"); if (e) e.focus(); }, 0);   // gleich die nächste Aufgabe tippen können
    };
    eingM.onkeydown = ev => { if (ev.key === "Enter") neuMit(); };
    datM.onkeydown = ev => { if (ev.key === "Enter") neuMit(); };
    const mitFertigAlle = fertigAlle.filter(a => a.datum).length;
    kart.push(h("div", { class: "card" }, h("div", { class: "row sb", style: "margin-bottom:8px" }, h("h3", { style: "margin:0" }, "Mit Datum"), entfernenKnopf("mit", mitFertigAlle)),
      h("div", { class: "row", style: "margin:8px 0" }, eingM, datM, selM, h("button", { class: "btn pri", onclick: neuMit }, "Hinzufügen")),
      fr.length + fertigMit.length ? (([sicht, mehr]) => h("div", { class: "list" }, sicht.map(zeileAus), mehr ? h("div", { class: "row", style: "margin-top:8px" }, mehr) : null))(aufKappen(fr.map(f => ({ m: f })).concat(fertigMit.map(a => ({ o: a }))), "mit")) : leer(gefiltert ? "Keine passenden Aufgaben." : "Keine Aufgaben mit Datum. Aufgaben mit Datum erscheinen hier.")));
    /* Aufgaben ohne Datum: eine einfache Checkliste */
    const eing = h("input", { type: "text", id: "ohne-datum-eingabe", placeholder: "Neue Aufgabe ohne Datum …", style: "flex:1;min-width:160px" }), selO = katAuswahl();
    const neuOhne = () => {
      const tx = eing.value.trim().replace(/\s+/g, " "); if (!tx) return; const k = selO.value; eing.value = ""; ui.aufNeuKat = k;
      aendern(() => { daten.aufgaben.push(neueAufgabeDaten(tx, "", k)); });
      setTimeout(() => { const e = document.getElementById("ohne-datum-eingabe"); if (e) e.focus(); }, 0);
    };
    eing.onkeydown = ev => { if (ev.key === "Enter") neuOhne(); };
    const ohneFertigAlle = fertigAlle.filter(a => !a.datum).length;
    kart.push(h("div", { class: "card" }, h("div", { class: "row sb", style: "margin-bottom:8px" }, h("h3", { style: "margin:0" }, "Ohne Datum"), entfernenKnopf("ohne", ohneFertigAlle)),
      h("div", { class: "row", style: "margin-bottom:8px" }, eing, selO, h("button", { class: "btn pri", onclick: neuOhne }, "Hinzufügen")),
      offenOhne.length + fertigOhne.length ? (([sicht, mehr]) => h("div", { class: "list" }, sicht.map(zeileOhne), mehr ? h("div", { class: "row", style: "margin-top:8px" }, mehr) : null))(aufKappen(offenOhne.concat(fertigOhne), "ohne")) : leer(gefiltert ? "Keine passenden Aufgaben." : "Noch keine Aufgaben ohne Datum. Schreib oben auf, was du erledigen willst.")));
    if (serienKarte) kart.push(serienKarte);
  } else {
    /* Nach Kategorie: eine aufklappbare Karte je Kategorie (offene Aufgaben mit und ohne Datum) */
    const eingK = h("input", { type: "text", id: "kat-eingabe", placeholder: "Neue Aufgabe …", style: "flex:1;min-width:160px" });
    const datK = h("input", { type: "date", title: "Datum (leer lassen = ohne Datum)" });
    const selK = katAuswahl();
    const neuK = () => {
      const tx = eingK.value.trim().replace(/\s+/g, " "); if (!tx) return; const d = datK.value, k = selK.value; eingK.value = ""; ui.aufNeuKat = k;
      aendern(() => { daten.aufgaben.push(neueAufgabeDaten(tx, d, k)); });
      setTimeout(() => { const e = document.getElementById("kat-eingabe"); if (e) e.focus(); }, 0);
    };
    eingK.onkeydown = ev => { if (ev.key === "Enter") neuK(); };
    datK.onkeydown = ev => { if (ev.key === "Enter") neuK(); };
    const namen = einst.kategorien.slice();
    for (const x of [...frAlle.map(f => f.quelle.kategorie), ...ohne.map(a => a.kategorie), ...fertigMit.map(a => a.kategorie)]) if (x && !namen.includes(x)) namen.push(x);
    const gruppen = namen.map(k => ({ k, mit: fr.filter(f => f.quelle.kategorie === k), offen: offenOhne.filter(a => a.kategorie === k), fertig: fertigMit.filter(a => a.kategorie === k).concat(fertigOhne.filter(a => a.kategorie === k)) })).filter(g => g.mit.length || g.offen.length || g.fertig.length);
    const zu = Array.isArray(einst.aufgaben_zu) ? einst.aufgaben_zu : [], alleZu = gruppen.length > 0 && gruppen.every(g => zu.includes(g.k));
    kart.push(h("div", { class: "card aufg-breit" }, h("div", { class: "row", style: "gap:8px" }, eingK, datK, selK, h("button", { class: "btn pri", onclick: neuK }, "Hinzufügen")),
      gruppen.length || fertigAlle.length ? h("div", { class: "row", style: "margin-top:8px;gap:8px" }, gruppen.length ? h("button", { class: "btn sm", "data-alle": "1", onclick: () => aendern(() => { einst.aufgaben_zu = alleZu ? [] : gruppen.map(g => g.k); }) }, alleZu ? "Alle aufklappen" : "Alle zuklappen") : null, entfernenKnopf("alle", fertigAlle.length)) : null));
    if (!gruppen.length) kart.push(h("div", { class: "card aufg-breit" }, leer(gefiltert ? "Keine passenden Aufgaben." : "Noch keine Aufgaben. Schreib oben auf, was du erledigen willst.")));
    for (const g of gruppen) {
      const n = g.mit.length + g.offen.length, farbe = (einst.farben || {})[g.k] || "var(--acc)";
      const det = h("details", { class: "card kat-karte", "data-kategorie": g.k },
        h("summary", null, h("span", { class: "dot", style: `background:${farbe}` }), h("b", null, R(g.k)), h("span", { class: "pill" }, R(String(n)))),
        (([sicht, mehr]) => h("div", { class: "list" }, sicht.map(zeileAus), mehr ? h("div", { class: "row", style: "margin-top:8px" }, mehr) : null))(aufKappen(g.mit.map(f => ({ m: f })).concat(g.offen.map(a => ({ o: a })), g.fertig.map(a => ({ o: a }))), "kat:" + g.k)));
      det.open = !zu.includes(g.k);
      det.addEventListener("toggle", () => {
        const a = einst.aufgaben_zu = Array.isArray(einst.aufgaben_zu) ? einst.aufgaben_zu : [], i = a.indexOf(g.k);
        if (det.open && i >= 0) a.splice(i, 1); else if (!det.open && i < 0) a.push(g.k);
        speichern();
      });
      det.style.order = String(katKarten.length); katKarten.push(det);
    }
  }
  const umschalter = h("div", { class: "tog aufg-ansicht" }, [["datum", "Nach Datum"], ["kategorie", "Nach Kategorie"]].map(([k, l]) => h("button", { class: ansicht === k ? "on" : "", "data-ansicht": k, onclick: () => { if (ansicht !== k) aendern(() => { einst.aufgaben_ansicht = k; }); } }, l)));
  const suche = h("input", { type: "text", id: "auf-suche", placeholder: "Aufgaben filtern …", value: aufFilter.text, style: "flex:1;min-width:150px" });
  suche.oninput = () => { const v = suche.value; aufFilter.text = v; render(); const n = document.getElementById("auf-suche"); if (n) { n.focus(); try { n.setSelectionRange(v.length, v.length); } catch (e) { } } };
  const sSort = auswahl([["standard", t("Sortierung: Standard")], ["prio", t("Sortierung: Priorität")], ["name", t("Sortierung: Name")], ["fach", t("Sortierung: Fach")]], einst.aufgaben_sort || "standard", true);
  sSort.onchange = () => aendern(() => { einst.aufgaben_sort = sSort.value; });
  const sPrio = auswahl([["", t("Alle Prioritäten")], ["1", t("hoch")], ["2", t("mittel")], ["3", t("niedrig")]], aufFilter.prio, true);
  sPrio.onchange = () => { aufFilter.prio = sPrio.value; render(); };
  const sFach = auswahl([["", t("Alle Fächer")]].concat(Object.keys(daten.faecher).sort((a, b) => a.localeCompare(b)).map(f => [f, f])), aufFilter.fach, true);
  sFach.onchange = () => { aufFilter.fach = sFach.value; render(); };
  const wahl = [...aufAuswahl].filter(q => daten.aufgaben.includes(q)), n = wahl.length;
  const werkzeug = h("div", { class: "row aufg-werkzeug", style: "gap:8px;margin-bottom:12px;flex-wrap:wrap" }, suche, sSort, sPrio, sFach,
    h("button", { class: "btn", "data-vorlagen": "1", onclick: aufVorlagenDialog }, "Vorlagen …"),
    h("button", { class: "btn" + (aufAuswahlModus ? " pri" : ""), "data-auswahl": "1", onclick: () => { aufAuswahlModus = !aufAuswahlModus; if (!aufAuswahlModus) aufAuswahl.clear(); render(); } }, aufAuswahlModus ? "Auswahl beenden" : "Auswählen"));
  const aktionen = !aufAuswahlModus ? null : h("div", { class: "card aufg-aktionen", style: "margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap" },
    h("b", null, R(`${n} `), "ausgewählt"),
    h("button", { class: "btn sm", "data-aktion": "alle", onclick: () => { for (const q of sichtbar) aufAuswahl.add(q); render(); } }, "Alle sichtbaren auswählen"),
    h("button", { class: "btn sm", "data-aktion": "erledigt", disabled: !n, onclick: () => { aufAuswahl.clear(); aendern(() => { for (const q of wahl) q.erledigt = true; }); } }, "Erledigt"),
    h("button", { class: "btn sm", "data-aktion": "verschieben", disabled: !n, onclick: () => aufDatumDialog(wahl) }, "Verschieben …"),
    h("button", { class: "btn sm", "data-aktion": "kategorie", disabled: !n, onclick: () => aufKategorieDialog(wahl) }, "Kategorie ändern …"),
    h("button", { class: "btn sm bad", "data-aktion": "loeschen", disabled: !n, onclick: () => bestaetigen(`${n} ${t("Aufgaben löschen?")}`, () => { aufAuswahl.clear(); aendern(() => { for (const q of wahl) loescheQuelle(q, "aufgabe"); }); }) }, "Löschen"),
    h("button", { class: "btn sm", "data-aktion": "aufheben", disabled: !n, onclick: () => { aufAuswahl.clear(); render(); } }, "Auswahl aufheben"));
  /* Kategorie-Karten in zwei Spalten, jede Spalte läuft für sich: aufgeklappte Karten schieben nur ihre eigene Spalte nach unten (keine Lücken) */
  const spalten = katKarten.length ? h("div", { class: "aufg-spalten" }, h("div", { class: "aufg-spalte" }, katKarten.filter((_, i) => i % 2 === 0)), h("div", { class: "aufg-spalte" }, katKarten.filter((_, i) => i % 2 === 1))) : null;
  return h("div", null, kopfZeile("Aufgaben", umschalter), werkzeug, aktionen, h("div", { class: "aufg-raster" }, kart), spalten, ansicht === "kategorie" && serienKarte ? h("div", { class: "aufg-raster", style: "margin-top:14px" }, serienKarte) : null);
}

/* ---------- Einkauf ---------- */
const abgehakt = new Set();
try { for (const k of JSON.parse(localStorage.getItem("alltagsplaner.abgehakt") || "[]")) abgehakt.add(k); } catch (e) { }
function abgehaktSpeichern() { try { localStorage.setItem("alltagsplaner.abgehakt", JSON.stringify([...abgehakt])); } catch (e) { } }
const einkaufRange = { von: iso(heute()), bis: iso(addDays(heute(), 6)) };
function einkaufListe() {
  const von = h("input", { type: "date", value: einkaufRange.von }), bis = h("input", { type: "date", value: einkaufRange.bis });
  von.onchange = () => { einkaufRange.von = von.value; render(); }; bis.onchange = () => { einkaufRange.bis = bis.value; render(); };
  const info = {}, [liste, ohneRezept, n] = einkaufslisteBauen(daten, parseISO(einkaufRange.von), parseISO(einkaufRange.bis), info);
  let summe = 0, offen = 0; for (const x of liste) if (x.kosten !== null) summe += x.kosten; else offen++;
  const text = liste.map(x => "- " + x.text).join("\n");
  return h("div", null, h("div", { class: "card" }, h("div", { class: "row" }, feld("Von", von), feld("Bis", bis), h("div", { class: "sp" }),
    h("button", { class: "btn", disabled: !liste.length, onclick: async () => { if (!(await kopieren(text))) dateiAngebot("einkaufsliste.txt", text, "text/plain", "Einkaufsliste"); } }, "Liste kopieren")),
    h("p", { class: "mut small", style: "margin:8px 0 0" }, R(`${n} `), "geplante Mahlzeiten im Zeitraum.", ohneRezept.length ? [" ", "Ohne Rezept:", " ", R(ohneRezept.join(", "))] : null)),
    h("div", { class: "card" }, liste.length ? [h("div", { class: "list" }, liste.map(x => {
      const k = x.schluessel, an = abgehakt.has(k);
      return h("div", { class: "li" }, h("input", { type: "checkbox", checked: an, onchange: e => { e.target.checked ? abgehakt.add(k) : abgehakt.delete(k); abgehaktSpeichern(); render(); } }),
        h("div", { class: "tx", style: an ? "text-decoration:line-through;opacity:.55" : "" }, h("b", null, R(x.text)), h("div", { class: "mut small" }, R(x.gerichte), x.vorrat ? R(" · ") : null, x.vorrat ? T(x.vorrat) : null)),
        x.kosten !== null ? h("span", { class: "pill" }, R(euroText(x.kosten))) : null);
    })), h("div", { class: "row sb", style: "margin-top:12px" }, h("span", { class: "mut" }, R(`${offen ? "≥ " : ""}`), "Geschätzte Kosten"), h("b", null, R(euroText(summe))))] : leer("Keine Zutaten – lege Mahlzeiten mit Rezepten im Kalender an."),
      info.vorraetig && info.vorraetig.length ? h("p", { class: "mut small" }, "Schon vorrätig:", " ", R(info.vorraetig.join(", "))) : null));
}
function einkaufTab() {
  const von = ui.rezeptSuche || "";
  return h("div", null, h("p", { class: "mut", style: "margin:0 0 14px" }, "Sammle deine Lieblingsgerichte mit Zutaten. Preise sind freiwillig: Wenn du sie einträgst, siehst du, was ein Essen kostet. Im Kalender kannst du dann Mahlzeiten planen und die Einkaufsliste daraus füllen lassen."),
    rezepteAnsicht(), vorratKarte(), preisListeKarte());
}
function preisFmt(x) { return String(+x.toFixed(4)).replace(".", ","); }
function preisZeile(menge, einheit, name, p) {
  if (menge === null || !(menge > 0)) return `${name}: ${preisFmt(p)} €`;
  if (einheit === "g") return `${name}: ${preisFmt(p / (menge / 1000))} €/kg`;
  if (einheit === "ml") return `${name}: ${preisFmt(p / (menge / 1000))} €/l`;
  return `${name}: ${preisFmt(p / menge)} € pro ${einheit || "Stk"}`;
}
function preisSetzen(text, name, zeile) {
  const k = name.trim().toLowerCase(), zeilen = String(text || "").split(/\r?\n/).filter(z => { const m = z.trim().match(PREIS_MUSTER); return z.trim() && !(m && m[1].trim().toLowerCase() === k); });
  zeilen.push(zeile); return zeilen.join("\n");
}
function rezepteAnsicht() {
  const namen = Object.keys(daten.rezepte).sort((a, b) => a.localeCompare(b));
  return h("div", { class: "card", style: "margin-bottom:14px" }, h("div", { class: "row sb", style: "margin-bottom:8px" }, h("h3", { style: "margin:0" }, "Meine Rezepte")),
    namen.length ? h("div", { class: "list" }, namen.map(n => {
      const [k, fehlt] = rezeptKosten(daten, n), z = zutatenParsen(daten.rezepte[n]).length;
      return h("div", { class: "li" }, h("div", { class: "tx" }, h("b", null, R(n)), h("div", { class: "mut small" }, R(`${z} `), z === 1 ? "Zutat" : "Zutaten")),
        k > 0 ? h("span", { class: "pill" + (fehlt ? " warn" : ""), title: fehlt ? "Für manche Zutaten fehlt noch ein Preis" : "Geschätzte Kosten" }, R((fehlt ? "≥ " : "ca. ") + euroText(k))) : null,
        einst.kalorien_an !== false ? (() => { const r = rezeptKalorien(daten, n); return r.summe > 0 ? h("span", { class: "pill" + (r.fehlt ? " warn" : ""), title: r.fehlt ? "Für manche Zutaten fehlen Kalorien" : "Geschätzte Kalorien pro Portion" }, R(`${r.fehlt ? "≥ " : "≈ "}${Math.round(r.proPortion)} kcal`)) : null; })() : null,
        h("button", { class: "btn sm", onclick: () => rezeptDialog(n) }, "Bearbeiten"));
    })) : leer("Noch keine Rezepte. Lege mit „+ Neu“ ein Rezept an, zum Beispiel „Spaghetti“ mit 200 g Nudeln und 1 Zwiebel (am Handy: „+“ in der unteren Leiste)."));
}
/* ---------- Preisvorschlag aus dem Internet: Open Prices (Open Food Facts, Daten unter ODbL) ----------
   Für eine Zutat wird die passende Lebensmittel-Kategorie abgefragt (nicht dein Rezept) und aus den
   neuesten echten Preisen der Median berechnet. Ergebnis wird 30 Tage im Browser gemerkt. */
const PREIS_API = "https://prices.openfoodfacts.org/api/v1/prices", PREIS_CACHE = "osa.preisvorschlag.v1";
/* [Suchwörter], Art (k = lose Ware mit Preis je kg/Stück, p = verpacktes Produkt), Kategorie, Gramm pro Stück
   Reihenfolge zählt: Speziellere Einträge (Tomatenmark) stehen vor allgemeinen (Tomaten). */
const PREIS_ZUTATEN = [
  [["tomatenmark"], "p", "en:tomato-pastes", 0], [["passierte tomaten", "dosentomaten", "gehackte tomaten", "pizzatomaten", "tomaten aus der dose"], "p", "en:canned-tomatoes", 0],
  [["tomatensoße", "tomatensauce", "nudelsoße", "nudelsauce"], "p", "en:tomato-sauces", 0], [["ketchup", "tomatenketchup"], "p", "en:tomato-ketchup", 0],
  [["kokosmilch"], "p", "en:coconut-milks", 0], [["sojasoße", "sojasauce"], "p", "en:soy-sauces", 0], [["erdnussbutter"], "p", "en:peanut-butters", 0],
  [["frischkäse"], "p", "en:cream-cheeses", 0], [["reibekäse", "geriebener käse", "streukäse"], "p", "en:grated-cheese", 0], [["parmesan"], "p", "en:parmigiano-reggiano", 0],
  [["mozzarella"], "p", "en:mozzarella", 125], [["feta", "schafskäse", "hirtenkäse"], "p", "en:feta", 200], [["gouda"], "p", "en:gouda", 0], [["käse"], "p", "en:cheeses", 0],
  [["schmand", "saure sahne", "creme fraiche", "crème fraîche"], "p", "en:sour-creams", 0], [["sahne", "schlagsahne", "kochsahne"], "p", "en:creams", 0],
  [["quark", "magerquark"], "p", "en:quarks", 0], [["joghurt", "jogurt", "naturjoghurt"], "p", "en:yogurts", 0], [["margarine"], "p", "en:margarines", 0], [["butter"], "p", "en:butters", 0],
  [["orangensaft", "o-saft"], "p", "en:orange-juices", 0], [["milch", "vollmilch", "h-milch"], "p", "en:milks", 0], [["eier", "ei"], "p", "en:eggs", 60],
  [["spaghetti"], "p", "en:spaghetti", 0], [["mie-nudeln", "mienudeln", "ramen", "glasnudeln", "reisnudeln", "asianudeln"], "p", "en:noodles", 0],
  [["nudeln", "pasta", "penne", "fusilli", "makkaroni", "farfalle", "tagliatelle", "lasagneplatten", "bandnudeln"], "p", "en:pastas", 0],
  [["reis", "basmatireis", "jasminreis", "risottoreis", "milchreis"], "p", "en:rices", 0], [["bulgur"], "p", "en:bulgur", 0], [["linsen", "rote linsen"], "p", "en:lentils", 0],
  [["kichererbsen"], "p", "en:chickpeas", 0], [["erbsen"], "p", "en:peas", 0], [["haferflocken"], "p", "en:rolled-oats", 0], [["müsli"], "p", "en:mueslis", 0],
  [["cornflakes", "frühstücksflocken"], "p", "en:breakfast-cereals", 0], [["dinkelmehl", "vollkornmehl", "roggenmehl"], "p", "en:flours", 0], [["mehl", "weizenmehl"], "p", "en:wheat-flours", 0],
  [["zucker", "puderzucker", "brauner zucker", "rohrzucker"], "p", "en:sugars", 0], [["salz", "meersalz"], "p", "en:salts", 0], [["olivenöl"], "p", "en:olive-oils", 0],
  [["sonnenblumenöl", "rapsöl", "speiseöl", "öl"], "p", "en:sunflower-oils", 0], [["essig", "balsamico", "weißweinessig"], "p", "en:vinegars", 0], [["senf"], "p", "en:mustards", 0],
  [["mayonnaise", "mayo"], "p", "en:mayonnaises", 0], [["honig"], "p", "en:honeys", 0], [["marmelade", "konfitüre"], "p", "en:jams", 0], [["schokolade", "kuvertüre"], "p", "en:chocolates", 100],
  [["kaffee"], "p", "en:coffees", 0], [["tee"], "p", "en:teas", 0], [["thunfisch"], "p", "en:canned-tunas", 0], [["lachs", "lachsfilet"], "p", "en:salmons", 0],
  [["hähnchenbrust", "hühnerbrust", "hähnchenbrustfilet", "hähnchen"], "p", "en:chicken-breasts", 0], [["speck", "bacon", "schinkenwürfel"], "p", "en:bacon", 0],
  [["schinken", "kochschinken"], "p", "en:hams", 0], [["würstchen", "wurst", "bratwurst", "wiener"], "p", "en:sausages", 0], [["brot", "toast", "toastbrot", "vollkornbrot"], "p", "en:breads", 0],
  [["tiefkühlgemüse", "gemüsemischung"], "p", "en:frozen-vegetables", 0], [["wasser", "mineralwasser"], "p", "en:waters", 0],
  [["schalotte", "schalotten"], "k", "en:shallots", 30], [["zwiebel", "zwiebeln", "rote zwiebel", "rote zwiebeln"], "k", "en:onions", 100],
  [["knoblauchzehe", "knoblauchzehen"], "k", "en:garlic", 5], [["knoblauch", "knoblauchknolle"], "k", "en:garlic", 50], [["süßkartoffel", "süßkartoffeln"], "k", "en:sweet-potatoes", 300],
  [["kartoffel", "kartoffeln"], "k", "en:potatoes", 150], [["karotte", "karotten", "möhre", "möhren"], "k", "en:carrots", 80],
  [["tomate", "tomaten", "kirschtomaten", "cherrytomaten", "rispentomaten"], "k", "en:tomatoes", 100], [["gurke", "gurken", "salatgurke"], "k", "en:cucumbers", 400],
  [["paprika", "paprikaschote", "paprikaschoten"], "k", "en:sweet-peppers", 160], [["zucchini"], "k", "en:zucchini", 250], [["lauch", "porree"], "k", "en:leeks", 250],
  [["champignons", "champignon", "pilze"], "k", "en:mushrooms", 0], [["avocado", "avocados"], "k", "en:avocados", 200], [["brokkoli", "broccoli"], "k", "en:broccoli", 400],
  [["blumenkohl"], "k", "en:cauliflowers", 700], [["aubergine", "auberginen"], "k", "en:aubergines", 300], [["spinat", "blattspinat"], "k", "en:spinachs", 0],
  [["salat", "kopfsalat", "eisbergsalat", "blattsalat"], "k", "en:lettuces", 300], [["weißkohl", "rotkohl", "spitzkohl", "kohl"], "k", "en:cabbages", 1000],
  [["kürbis", "hokkaido"], "k", "en:pumpkins", 1200], [["sellerie", "staudensellerie"], "k", "en:celery", 400], [["radieschen"], "k", "en:radishes", 0], [["spargel"], "k", "en:asparagus", 0],
  [["ingwer"], "k", "en:ginger", 30], [["chili", "chilischote", "chilischoten"], "k", "en:chili-peppers", 10], [["zitrone", "zitronen"], "k", "en:lemons", 100],
  [["limette", "limetten"], "k", "en:limes", 70], [["banane", "bananen"], "k", "en:bananas", 120], [["apfel", "äpfel"], "k", "en:apples", 150], [["birne", "birnen"], "k", "en:pears", 170],
  [["orange", "orangen", "apfelsine"], "k", "en:oranges", 200], [["mandarine", "mandarinen"], "k", "en:mandarins", 80], [["clementine", "clementinen"], "k", "en:clementines", 80],
  [["weintrauben", "trauben"], "k", "en:grapes", 0], [["erdbeeren", "erdbeere"], "k", "en:strawberries", 15], [["heidelbeeren", "blaubeeren"], "k", "en:blueberries", 0],
  [["kiwi", "kiwis"], "k", "en:kiwis", 80], [["mango", "mangos"], "k", "en:mangoes", 350], [["pfirsich", "pfirsiche", "nektarine", "nektarinen"], "k", "en:peaches", 150],
  [["pflaume", "pflaumen", "zwetschge", "zwetschgen"], "k", "en:plums", 40], [["kirschen"], "k", "en:cherries", 8]
];
function zutatKategorie(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-zäöüß\s-]/g, " ").replace(/\s+/g, " ").trim(); if (!n) return null;
  const woerter = n.split(" ");
  return PREIS_ZUTATEN.find(z => z[0].includes(n)) || PREIS_ZUTATEN.find(z => z[0].some(s => woerter.includes(s)))
    || PREIS_ZUTATEN.find(z => z[0].some(s => s.length >= 4 && n.includes(s))) || null;   // z. B. „Vollkornnudeln“
}
const _preisAnfragen = {};
let _preisSchlange = Promise.resolve();
/* Anfragen nacheinander stellen (der Dienst sperrt bei vielen gleichzeitigen Anfragen kurz); bei Fehler einmal wiederholen */
function preisAbruf(url) {
  const lauf = _preisSchlange.then(async () => {
    for (let versuch = 0; versuch < 2; versuch++) {
      try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status !== 429 && r.status < 500) throw new Error("HTTP " + r.status); } catch (e) { if (versuch) throw e; }
      await new Promise(w => setTimeout(w, 1500));
    }
    throw new Error("Open Prices nicht erreichbar");
  });
  _preisSchlange = lauf.catch(() => { }).then(() => new Promise(w => setTimeout(w, 250)));
  return lauf;
}
async function preisStatistik(z) {
  const [, art, tag] = z;
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(PREIS_CACHE) || "{}"); } catch (e) { }
  if (cache[tag] && Date.now() - cache[tag].zeit < 30 * 864e5) return cache[tag].s;
  if (_preisAnfragen[tag]) return _preisAnfragen[tag];   // gleiche Kategorie wird gerade schon abgefragt
  return (_preisAnfragen[tag] = (async () => {
    try {
      const url = `${PREIS_API}?${art === "k" ? "category_tag" : "product__categories_tags__contains"}=${encodeURIComponent(tag)}&currency=EUR&size=100&order_by=-date`;
      const alle = (await preisAbruf(url)).items || [], de = alle.filter(i => i.location && i.location.osm_address_country_code === "DE");
      const basis = de.length >= 5 ? de : alle;   // deutsche Läden bevorzugen, wenn genug Preise da sind
      const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
      const kg = [], stk = [], g = [], pack = [];
      for (const i of basis) {
        const p = i.price_is_discounted && i.price_without_discount > 0 ? i.price_without_discount : i.price; if (!(p > 0)) continue;
        if (art === "k") { (i.price_per === "UNIT" ? stk : kg).push(p); continue; }
        pack.push(p);
        const q = parseFloat(i.product && i.product.product_quantity), u = String((i.product && i.product.product_quantity_unit) || "g").toLowerCase();
        if (q > 0 && (u === "g" || u === "ml")) g.push(p / q);
      }
      const s = { kg: median(kg), stk: median(stk), g: median(g), pack: median(pack), n: basis.length, de: basis === de && de.length > 0 };
      try {   // frisch lesen, damit gleichzeitige Abfragen sich nicht gegenseitig überschreiben
        const jetzt = JSON.parse(localStorage.getItem(PREIS_CACHE) || "{}"); jetzt[tag] = { zeit: Date.now(), s }; localStorage.setItem(PREIS_CACHE, JSON.stringify(jetzt));
      } catch (e) { }
      return s;
    } finally { delete _preisAnfragen[tag]; }
  })());
}
function vorschlagBerechnen(menge, einheit, z, s) {
  const proG = s.kg ? s.kg / 1000 : s.g, m = menge === null ? 1 : menge, stueckG = z[3] || 0;
  if (einheit === "g" || einheit === "ml") return proG ? m * proG : null;
  const gramm = { EL: 15, TL: 5, Prise: 0.5, Zehe: 5 }[einheit];
  if (gramm) return proG ? m * gramm * proG : null;
  if (einheit === "Pck" || einheit === "Dose") return s.pack || s.stk || null;
  /* Stück, Bund oder ohne Einheit: Kilopreis × übliches Stückgewicht ist verlässlicher als Stückpreise
     (die sind in Open Prices oft Netze oder Packungen) */
  if (stueckG && proG) return m * stueckG * proG;    // z. B. 2 Zwiebeln à ca. 100 g
  if (s.stk) return m * s.stk;
  return s.pack ? m * s.pack : null;                 // z. B. „1 Butter“ = 1 Packung
}
async function preisVorschlagFuer(ti, pi) {
  if (einst.preis_vorschlag === false) return;
  const eigen = () => pi.value.trim() && pi.dataset.vorschlag !== "1";   // selbst eingetragener Preis hat immer Vorrang
  if (eigen()) return;
  const text = ti.value, pz = zutatenParsen(text)[0], z = pz && zutatKategorie(pz[2]);
  if (!z) { if (pi.dataset.vorschlag === "1") { pi.value = ""; pi.dataset.vorschlag = ""; pi.classList.remove("preis-vorschlag"); } return; }
  const platz = pi.placeholder; pi.placeholder = "…";
  let s; try { s = await preisStatistik(z); } catch (e) { pi.placeholder = platz; return; }
  pi.placeholder = platz;
  if (ti.value !== text || eigen()) return;   // inzwischen weitergetippt oder selbst einen Preis eingetragen
  const k = vorschlagBerechnen(pz[0], pz[1], z, s); if (!(k > 0)) return;
  pi.value = Math.max(k, 0.01).toFixed(2).replace(".", ",");
  pi.dataset.vorschlag = "1"; pi.classList.add("preis-vorschlag");
  pi.title = `${t("Vorschlag aus Open Prices")}: ${t("Mittelwert aus")} ${s.n} ${t("Preisen")}${s.de ? " " + t("aus Deutschland") : ""}`;
}
function einheitFeld(eingabe, einheit, breite) {   // Eingabefeld mit fester Einheit am rechten Rand („€“, „kcal“)
  eingabe.style.width = "100%"; eingabe.style.boxSizing = "border-box"; eingabe.style.paddingRight = (einheit.length * 7 + 14) + "px";
  return h("span", { style: `position:relative;display:inline-block;flex:none;width:${breite}px` }, eingabe,
    h("span", { style: "position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--mut);font-size:12px" }, R(einheit)));
}
function rezeptDialog(name) {
  const alt = name !== undefined, n = h("input", { type: "text", value: name || "", placeholder: "z. B. Spaghetti Bolognese" }), preise = preiseParsen(daten.preise), zeilenBox = h("div", { style: "display:flex;flex-direction:column;gap:6px" }), zeilen = [];
  const kOn = einst.kalorien_an !== false, eigeneK = kalorienParsen(daten.kalorien);
  const por = h("input", { type: "number", min: 1, max: 50, step: 1, value: alt ? rezeptPortionen(daten, name) : 1 }), sumEl = h("p", { class: "mut small", style: "margin:0;font-weight:600" });
  const summeZeigen = () => {
    if (!kOn) return;
    let s = 0, fehlt = 0;
    for (const z of zeilen) { if (!z.ti.value.trim()) continue; const k = parseFloat(String(z.ki.value).replace(",", ".")); if (k >= 0) s += k; else fehlt++; }
    const p = Math.max(1, Math.min(50, Math.round(parseFloat(por.value)) || 1));
    sumEl.textContent = `${t("Rezept insgesamt")} ≈ ${Math.round(s)} kcal · ${t("pro Portion")} ≈ ${Math.round(s / p)} kcal${fehlt ? ` · ${fehlt} ${t("Zutaten ohne Kalorienangabe")}` : ""}`;
  };
  por.addEventListener("input", summeZeigen);
  const neueZeile = (text = "", fokus = false) => {
    const pz = zutatenParsen(text)[0], k = pz && text ? zutatKosten(preise, pz[2], pz[1], pz[0]) : null, start = k !== null && k > 0 ? k.toFixed(2).replace(".", ",") : "";
    const kc = pz && text ? zutatKcal(eigeneK, pz[2], pz[1], pz[0]) : null, kstart = kc !== null ? String(Math.round(kc)) : "";
    const ti = h("input", { type: "text", value: text, placeholder: "200 g Nudeln", style: "flex:1;min-width:0" }), pi = h("input", { type: "text", inputmode: "decimal", value: start, placeholder: "Preis €", title: "Was kostet diese Menge ungefähr? (freiwillig)", style: "width:92px" });
    const ki = h("input", { type: "text", inputmode: "numeric", value: kstart, placeholder: "kcal", title: "Geschätzte Kalorien dieser Menge – einfach überschreiben", style: "width:72px" });
    if (kstart) ki.classList.add("preis-vorschlag");
    const row = h("div", { class: "row", style: "gap:6px;flex-wrap:nowrap" }, ti, einheitFeld(pi, "€", 88), kOn ? einheitFeld(ki, "kcal", 92) : null, h("button", { class: "btn sm ghost", title: "Zutat entfernen", onclick: () => { zeilen.splice(zeilen.findIndex(z => z.row === row), 1); row.remove(); summeZeigen(); } }, "✕"));
    ti.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); preisVorschlagFuer(ti, pi); neueZeile("", true); } };
    /* Preisvorschlag: kurz nach dem Tippen bzw. beim Verlassen des Feldes; eigene Eingabe im Preisfeld beendet den Vorschlag */
    let warte = 0;
    ti.addEventListener("input", () => { clearTimeout(warte); warte = setTimeout(() => preisVorschlagFuer(ti, pi), 700); });
    ti.addEventListener("blur", () => { clearTimeout(warte); preisVorschlagFuer(ti, pi); });
    pi.addEventListener("input", () => { pi.dataset.vorschlag = ""; pi.classList.remove("preis-vorschlag"); });
    /* Kalorien: solange du sie nicht selbst änderst, folgt der Schätzwert dem Text der Zutat */
    ti.addEventListener("input", () => {
      if (ki.dataset.eigen === "1") return;
      const p = zutatenParsen(ti.value)[0], c = p && ti.value.trim() ? zutatKcal(eigeneK, p[2], p[1], p[0]) : null;
      ki.value = c !== null ? String(Math.round(c)) : ""; ki.classList.toggle("preis-vorschlag", c !== null); summeZeigen();
    });
    ki.addEventListener("input", () => { ki.dataset.eigen = "1"; ki.classList.remove("preis-vorschlag"); summeZeigen(); });
    ki.addEventListener("vorschlag", summeZeigen);
    let kwarte = 0;
    ti.addEventListener("input", () => { clearTimeout(kwarte); kwarte = setTimeout(() => kcalVorschlagFuer(ti, ki), 900); });
    ti.addEventListener("blur", () => { clearTimeout(kwarte); kcalVorschlagFuer(ti, ki); });
    if (text && !kstart) kcalVorschlagFuer(ti, ki);   // vorhandene Zutaten ohne Kalorien
    if (text && !start) preisVorschlagFuer(ti, pi);   // vorhandene Zutaten ohne Preis
    zeilen.push({ row, ti, pi, ki, start, kstart }); zeilenBox.append(row); if (fokus) ti.focus(); summeZeigen();
  };
  const alle = alt ? String(daten.rezepte[name] || "").split(/\r?\n/).map(z => z.trim()).filter(Boolean) : [];
  for (const z of alle) neueZeile(z); if (!alle.length) neueZeile("");
  dialog(alt ? "Rezept bearbeiten" : "Neues Rezept", [kOn ? h("div", { class: "grid2" }, feld("Gericht", n), feld("Portionen", por)) : feld("Gericht", n), h("div", { class: "f" }, h("span", null, "Zutaten"), zeilenBox),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => neueZeile("", true) }, "+ Zutat"), h("span", { class: "mut small" }, "Schreib einfach „200 g Nudeln“, „1 Zwiebel“ oder „2 EL Öl“. Der Preis ist freiwillig. Mit Enter kommt die nächste Zutat.")),
    kOn ? sumEl : null,
    einst.preis_vorschlag === false ? null : h("p", { class: "mut small", style: "margin:0" }, "Hervorgehobene Preise sind Vorschläge von Open Prices (Open Food Facts, Daten unter ODbL): Mittelwerte aus echten Kassenbons, dein Laden kann abweichen. Einfach überschreiben."),
    kOn ? h("p", { class: "mut small", style: "margin:0" }, "Kalorien sind Schätzwerte aus einer eingebauten Tabelle (Nährwerte pro 100 g). Hervorgehobene Werte kannst du überschreiben – dein Wert wird dann gemerkt.") : null,
    ], [
    ...(alt ? [{ text: "Löschen", art: "bad", fn: () => aendern(() => { delete daten.rezepte[name]; if (daten.rezept_portionen) delete daten.rezept_portionen[name]; }) }] : []), { text: "Abbrechen" },
    { text: "Speichern", art: "pri", fn: () => {
      const neu = n.value.trim(); if (!neu) { toast("Bitte einen Namen eintragen."); return false; }
      const zl = zeilen.map(z => ({ text: z.ti.value.trim().replace(/\s+/g, " "), p: z.pi.value.trim(), start: z.start, k: z.ki.value.trim(), kstart: z.kstart })).filter(z => z.text);
      aendern(() => {
        if (alt && neu !== name) { delete daten.rezepte[name]; if (daten.rezept_portionen) delete daten.rezept_portionen[name]; }
        daten.rezepte[neu] = zl.map(z => z.text).join("\n");
        for (const z of zl) {
          if (z.p === z.start || !z.p) continue;
          const p = parseFloat(z.p.replace(",", ".")), pz = zutatenParsen(z.text)[0];
          if (p > 0 && pz) daten.preise = preisSetzen(daten.preise, pz[2], preisZeile(pz[0], pz[1], pz[2], p));
        }
        if (kOn) {
          for (const z of zl) {
            if (!z.k || z.k === z.kstart) continue;
            const kv = parseFloat(z.k.replace(",", ".")), pz = zutatenParsen(z.text)[0];
            if (kv >= 0 && pz) daten.kalorien = kalorienSetzen(daten.kalorien, pz[2], kcalZeile(pz[0], pz[1], pz[2], kv));
          }
          daten.rezept_portionen = daten.rezept_portionen || {};
          const pn = Math.max(1, Math.min(50, Math.round(parseFloat(por.value)) || 1));
          if (pn > 1) daten.rezept_portionen[neu] = pn; else delete daten.rezept_portionen[neu];
        }
      });
    } }]);
}
function vorratKarte() {
  const zeilen = String(daten.vorraete || "").split(/\r?\n/).map(z => z.trim()).filter(Boolean);
  const eing = h("input", { type: "text", placeholder: "z. B. 500 g Reis oder Salz", style: "flex:1;min-width:160px" });
  const neu = () => { const tx = eing.value.trim().replace(/\s+/g, " "); if (!tx) return; eing.value = ""; aendern(() => { daten.vorraete = zeilen.concat(tx).join("\n"); }); };
  eing.onkeydown = e => { if (e.key === "Enter") neu(); };
  return h("div", { class: "card", style: "margin-bottom:14px" }, h("h3", null, "Zu Hause vorrätig"), h("p", { class: "mut small", style: "margin:0 0 10px" }, "Was du schon hast, wird von der Einkaufsliste abgezogen."),
    h("div", { class: "row" }, eing, h("button", { class: "btn", onclick: neu }, "Hinzufügen")),
    zeilen.length ? h("div", { class: "row", style: "margin-top:10px;gap:6px" }, zeilen.map((z, i) => h("span", { class: "chip", style: "display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 12px;border-radius:999px;background:var(--acc-soft)" }, R(z),
      h("button", { class: "btn sm ghost", style: "padding:0 8px", title: "Entfernen", onclick: () => aendern(() => { daten.vorraete = zeilen.filter((x, j) => j !== i).join("\n"); }) }, "✕")))) : null);
}
function preisListeKarte() {
  const ta = h("textarea", { style: "min-height:160px" }); ta.value = daten.preise || "";
  const vor = h("p", { class: "mut small", style: "margin:6px 0" }), pruefen = () => { vor.textContent = `${preiseParsen(ta.value).size} ${t("Preise erkannt")}`; };
  ta.oninput = pruefen; pruefen();
  return h("details", { class: "card" }, h("summary", { style: "cursor:pointer;font-weight:600" }, "Preisliste ansehen und bearbeiten"),
    h("p", { class: "mut small", style: "margin:10px 0 6px" }, "Die Preise aus deinen Rezepten landen hier automatisch. Eine Zeile pro Zutat, z. B. „Nudeln: 2,40 €/kg“, „Eier: 0,35 € pro Stk“ oder „Zwiebel: 0,30“."),
    ta, vor, h("div", { class: "row" }, h("button", { class: "btn pri", onclick: () => { aendern(() => { daten.preise = ta.value; }, true); toast("Gespeichert."); } }, "Speichern")));
}

/* ---------- Budget ---------- */
function budgetTab() {
  const d = ui.budgetMonat, j = d.getFullYear(), m = d.getMonth() + 1;
  const [bu, ohnePreis] = einst.budget_essen && einst.rezepte_an ? budgetMitEssen(daten, j, m) : [budgetImMonat(daten, j, m), 0];
  const [ein, aus, kat] = budgetSummen(bu), saldo = ein - aus;
  const nav = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { ui.budgetMonat = addMonate(d, -1); render(); } }, "‹"), h("b", { style: "min-width:130px;text-align:center" }, R(`${monatName(d.getMonth())} ${j}`)),
    h("button", { class: "btn", onclick: () => { ui.budgetMonat = addMonate(d, 1); render(); } }, "›"));
  const limit = einst.budget_limit || 0;
  const kpis = h("div", { class: "kpis" }, kpi("Einnahmen", euroText(ein), "pos"), kpi("Ausgaben", euroText(aus), "neg"), kpi("Saldo", euroText(saldo), saldo >= 0 ? "pos" : "neg"),
    limit ? kpi("Monatslimit", `${Math.round(aus / limit * 100)} %`, aus > limit ? "neg" : "") : null);
  const zeilen = bu.map(([tag, b]) => h("tr", null, h("td", null, R(deKurz(tag))), h("td", null, R(b.beschreibung || b.kategorie), b.wiederholung && b.wiederholung !== "keine" ? h("span", { class: "pill", style: "margin-left:6px" }, T(b.wiederholung)) : null),
    h("td", null, T(b.kategorie)), h("td", { class: "r " + (b.art === "Einnahme" ? "pos" : "neg") }, R((b.art === "Einnahme" ? "+" : "−") + euroText(b.betrag))),
    h("td", { class: "r" }, b._auto ? h("span", { class: "pill" }, "automatisch") : h("button", { class: "btn sm", onclick: () => buchungDialog(b._quelle || b, b) }, "Bearbeiten"))));
  return h("div", null, kopfZeile("Budget", nav, limitFeld()), budgetGross(ein, aus, limit), budgetSchnell(), kpis,
    kat.length ? h("div", { class: "card", style: "margin-top:14px" }, h("h3", null, "Ausgaben nach Kategorie"), kat.map(([k, b]) => h("div", { class: "hbar" }, h("span", null, T(k)), fortschritt(aus ? b / aus : 0), h("b", null, R(euroText(b)))))) : null,
    h("div", { class: "card tbl", style: "margin-top:14px" }, bu.length ? h("table", null, h("thead", null, h("tr", null, h("th", null, "Datum"), h("th", null, "Beschreibung"), h("th", null, "Kategorie"), h("th", { class: "r" }, "Betrag"), h("th"))), h("tbody", null, zeilen)) : leer("Keine Buchungen in diesem Monat."),
      ohnePreis ? h("p", { class: "mut small" }, R(`${ohnePreis} `), "Mahlzeiten ohne Preisangabe wurden nicht eingerechnet.") : null));
}
function kpi(label, wert, klasse, zusatz) { return h("div", { class: "kpi" }, h("b", { class: klasse || "" }, R(wert)), h("span", null, label), zusatz ? h("span", { class: "kpi-delta", style: "display:block;font-size:11.5px;margin-top:2px" }, R(zusatz)) : null); }
function buchungDialog(quelle, ansicht) {
  const alt = !!quelle, b = quelle || {};
  const art = auswahl(["Ausgabe", "Einnahme"], b.art || "Ausgabe"), betrag = h("input", { type: "number", min: 0, step: 0.01, value: b.betrag ?? "" });
  const kat = auswahl(BUDGET_KATEGORIEN.map(k => [k, k]), b.kategorie || "Sonstiges"), bes = h("input", { type: "text", value: b.beschreibung || "" });
  const datum = h("input", { type: "date", value: b.datum || iso(heute()) }), wd = auswahl(WIEDERHOLUNGEN, b.wiederholung || "keine"), bis = h("input", { type: "date", value: b.wiederholen_bis || "" });
  dialog(alt ? "Buchung bearbeiten" : "Neue Buchung", [h("div", { class: "grid2" }, feld("Art", art), feld("Betrag (€)", betrag), feld("Kategorie", kat)), feld("Beschreibung", bes),
    h("div", { class: "grid2" }, feld("Datum", datum), feld("Wiederholung", wd), feld("Wiederholen bis", bis))], [
    ...(alt ? [{ text: "Löschen", art: "bad", fn: () => aendern(() => { const i = daten.budget.indexOf(quelle); if (i >= 0) daten.budget.splice(i, 1); }) }] : []), { text: "Abbrechen" },
    { text: "Speichern", art: "pri", fn: () => {
      const bt = parseFloat(String(betrag.value).replace(",", ".")); if (!(bt > 0)) { toast("Bitte einen Betrag über 0 eintragen."); return false; }
      aendern(() => {
        const z = alt ? quelle : { enddatum: "", ausnahmen: {} };
        Object.assign(z, { art: art.value, betrag: Math.round(bt * 100) / 100, kategorie: kat.value, beschreibung: bes.value.trim(), datum: datum.value, wiederholung: wd.value, wiederholen_bis: wd.value === "keine" ? "" : bis.value });
        if (!alt) daten.budget.push(z);
      });
    } }]);
}

/* ---------- Statistik ---------- */
function statistikTab() {
  const h0 = heute(), aktMo = montagVon(h0), modus = ui.statModus === "monat" ? "monat" : "woche";
  const ersterMonat = new Date(h0.getFullYear(), h0.getMonth(), 1, 12), monat = ui.statMonat ? new Date(ui.statMonat.getFullYear(), ui.statMonat.getMonth(), 1, 12) : ersterMonat;
  const mo = ui.statMo ? montagVon(ui.statMo) : aktMo, so = addDays(mo, 6);
  const monatsEnde = m => new Date(m.getFullYear(), m.getMonth(), tageImMonat(m.getFullYear(), m.getMonth() + 1), 12);
  const von0 = modus === "monat" ? monat : mo, bis0 = modus === "monat" ? monatsEnde(monat) : so;
  const vorMonat = new Date(monat.getFullYear(), monat.getMonth() - 1, 1, 12), vonV = modus === "monat" ? vorMonat : addDays(mo, -7), bisV = modus === "monat" ? monatsEnde(vorMonat) : addDays(mo, -1);
  const istAkt = modus === "monat" ? iso(monat) === iso(ersterMonat) : iso(mo) === iso(aktMo), von = addDays(aktMo, -27);
  const wochen = statProWoche(daten, 8, h0), maxW = Math.max(1, ...wochen.map(w => w[1] + w[2]));
  const lernAkt = statLernzeit(daten, aktMo, addDays(aktMo, 6)), lern = statLernzeit(daten, von0, bis0), kat = statKategorien(daten, von, h0), mon = statMonate(daten, 6, h0, einst.budget_essen);
  const maxM = Math.max(1, ...mon.map(x => Math.max(x[2], x[3])));
  const erlGesamt = wochen.reduce((s, w) => s + w[1], 0), serie = statSerie(daten, h0);
  const minKat = kat.reduce((s, k) => s + k[2], 0);
  /* gewählter Zeitraum (Woche oder Monat) und der davor: erledigte Aufgaben, Lernzeit, Kalorien, Einnahmen und Ausgaben */
  const periode = (a, b) => {
    let erl = 0; for (let tag = a; tag <= b; tag = addDays(tag, 1)) for (const v of aufgabenAm(daten, tag)) if (istErledigt(v, tag)) erl++;
    const [ein, aus] = budgetSummen(budgetImZeitraum(daten, a, b, !!einst.budget_essen));
    return { erl, lern: statLernzeit(daten, a, b).reduce((s, x) => s + x[1], 0), k: kalorienZeitraum(daten, a, b), ein, aus };
  };
  const jetzt = periode(von0, bis0), davor = periode(vonV, bisV);
  const vgl = t(modus === "monat" ? "ggü. Vormonat" : "ggü. Vorwoche");
  const delta = (a, b, fmt) => { const d = a - b; return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))} ${vgl}`; };
  const kOn = einst.kalorien_an !== false && einst.essen_an !== false, kw = jetzt.k, kZiel = einst.kalorien_ziel || 0, kMax = Math.max(1, kZiel, ...kw.tage.map(d => d.summe));
  const buch = budgetImZeitraum(daten, von0, bis0, !!einst.budget_essen), einW = jetzt.ein, ausW = jetzt.aus;
  const einListe = buch.filter(([, b]) => b.art === "Einnahme"), ausListe = buch.filter(([, b]) => b.art !== "Einnahme");
  const statAus = Array.isArray(einst.stat_aus) ? einst.stat_aus : [], an = k => !statAus.includes(k);
  const abschnitte = [["kennzahlen", "Kennzahlen"], ["kalorien", "Kalorien"], ["einnahmen", "Einnahmen"], ["ausgaben", "Ausgaben"], ["lernzeit", "Lernzeit"], ["verlauf", "Verlauf"]].filter(([k]) => k !== "kalorien" || kOn);
  const zurueck = () => { ui.statMo = null; ui.statMonat = null; render(); };
  const nav = h("div", { class: "row", style: "margin-bottom:12px;gap:12px;flex-wrap:wrap;align-items:center" },
    h("div", { class: "tog stat-modus", title: "Zeitraum" }, [["woche", "Woche"], ["monat", "Monat"]].map(([k, l]) => h("button", { class: modus === k ? "on" : "", "data-modus": k, onclick: () => { if (modus !== k) { ui.statModus = k; uiSpeichern(); render(); } } }, l))),
    h("div", { class: "row" }, h("button", { class: "btn", title: modus === "monat" ? "Vorheriger Monat" : "Vorherige Woche", onclick: () => { if (modus === "monat") ui.statMonat = vorMonat; else ui.statMo = addDays(mo, -7); render(); } }, "‹"),
      h("b", { style: "min-width:210px;text-align:center" }, R(modus === "monat" ? `${monatName(monat.getMonth())} ${monat.getFullYear()}` : `${t("KW")} ${kwVon(mo)} · ${deKurz(mo)} – ${deKurz(so)}${so.getFullYear()}`)),
      h("button", { class: "btn", title: modus === "monat" ? "Nächster Monat" : "Nächste Woche", onclick: () => { if (modus === "monat") ui.statMonat = new Date(monat.getFullYear(), monat.getMonth() + 1, 1, 12); else ui.statMo = addDays(mo, 7); render(); } }, "›")),
    istAkt ? null : h("button", { class: "btn sm", onclick: zurueck }, modus === "monat" ? "Dieser Monat" : "Diese Woche"),
    h("div", { class: "tog stat-abschnitte", title: "Abschnitte ein- oder ausblenden", style: "margin-left:auto" }, abschnitte.map(([k, l]) => h("button", { class: an(k) ? "on" : "", "data-abschnitt": k, onclick: () => aendern(() => { const a = Array.isArray(einst.stat_aus) ? einst.stat_aus : (einst.stat_aus = []), i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); }) }, l))));
  const saldo = einW - ausW, saldoV = davor.ein - davor.aus;
  const tabelle = (liste, leerText) => liste.length ? h("div", { class: "tbl" }, h("table", null, h("thead", null, h("tr", null, h("th", null, "Datum"), h("th", null, "Beschreibung"), h("th", null, "Kategorie"), h("th", { class: "r" }, "Betrag"))),
    h("tbody", null, liste.map(([d, b]) => h("tr", null, h("td", null, R(deKurz(d))), h("td", null, R(b.beschreibung || "–")), h("td", null, T(b.kategorie || "Sonstiges")), h("td", { class: "r" }, R(euroText(b.betrag)))))))) : leer(leerText);
  const monatsBalken = modus === "monat", ohneGesamt = kw.tage.reduce((s, d) => s + d.ohne, 0);
  const kcalKarte = !kOn ? null : h("div", { class: "card", "data-karte": "kalorien-woche" }, h("h3", null, "Kalorien pro Tag"),
    kw.summe > 0 ? h("div", null, h("div", { class: "bars", style: monatsBalken ? "gap:3px" : "" }, kw.tage.map((d, i) => h("div", { class: "c" }, h("div", { class: "s", title: `${deKurz(d.tag)} – ${d.summe} kcal` }, h("i", { style: `height:${d.summe / kMax * 100}%;background:${kZiel && d.summe > kZiel ? "var(--bad)" : "var(--acc)"}` })),
      monatsBalken ? h("em", { style: "text-align:center;font-size:9.5px" }, R(String(d.tag.getDate()))) : h("em", { style: "text-align:center;line-height:1.25" }, R(kurzTag(i)), h("br"), h("b", null, R(d.summe ? String(d.summe) : "–")))))),
      h("p", { class: "mut small", style: "margin:8px 0 0" }, R(`Ø ${Math.round(kw.schnitt)} kcal ${t("pro Tag")} · ${t("Summe")} ${kw.summe} kcal${kZiel ? ` · ${t("Ziel")} ${kZiel} kcal` : ""}`)),
      kZiel && kw.mitDaten ? h("p", { class: "small", "data-kcal-hinweis": kw.schnitt > kZiel ? "ueber" : "unter", style: `margin:4px 0 0;font-weight:600;color:var(${kw.schnitt > kZiel ? "--bad" : "--ok"})` },
        R(`${Math.round(Math.abs(kw.schnitt - kZiel))} kcal ${t(kw.schnitt > kZiel ? "über dem Tagesziel" : "unter dem Tagesziel")} (Ø) · ${t(monatsBalken ? "Monatsziel" : "Wochenziel")} ${kZiel * kw.tage.length} kcal, ${t("Summe")} ${kw.summe} kcal`)) : null)
      : leer(monatsBalken ? "In diesem Monat sind noch keine Mahlzeiten mit Kalorien eingetragen." : "In dieser Woche sind noch keine Mahlzeiten mit Kalorien eingetragen."),
    ohneGesamt ? h("p", { class: "mut small", style: "margin:6px 0 0" }, R(`${ohneGesamt} `), "Mahlzeit(en) ohne Kalorienangabe") : null);
  return h("div", null, kopfZeile("Statistik"), nav,
    an("kennzahlen") ? h("div", { class: "kpis" }, kpi("Aufgaben erledigt", String(jetzt.erl), "", delta(jetzt.erl, davor.erl, String)), kpi("Lernzeit", stundenText(jetzt.lern), "", delta(jetzt.lern, davor.lern, stundenText)),
      kOn ? kpi("Kalorien Ø pro Tag", kw.mitDaten ? String(Math.round(kw.schnitt)) : "–", "", kw.mitDaten && davor.k.mitDaten ? delta(Math.round(kw.schnitt), Math.round(davor.k.schnitt), String) : "") : null,
      kpi("Einnahmen", euroText(einW), "pos", delta(einW, davor.ein, euroText)), kpi("Ausgaben", euroText(ausW), "neg", delta(ausW, davor.aus, euroText)), kpi("Saldo", euroText(saldo), saldo >= 0 ? "pos" : "neg", delta(saldo, saldoV, euroText))) : null,
    h("div", { style: "margin-top:14px" }), an("kalorien") ? kcalKarte : null,
    an("einnahmen") ? h("div", { class: "card", "data-karte": "einnahmen" }, h("div", { class: "row sb" }, h("h3", { style: "margin:0" }, "Einnahmen"), h("b", { class: "pos" }, R(euroText(einW)))), tabelle(einListe, monatsBalken ? "Keine Einnahmen in diesem Monat." : "Keine Einnahmen in dieser Woche.")) : null,
    an("ausgaben") ? h("div", { class: "card", "data-karte": "ausgaben" }, h("div", { class: "row sb" }, h("h3", { style: "margin:0" }, "Ausgaben"), h("b", { class: "neg" }, R(euroText(ausW)))), tabelle(ausListe, monatsBalken ? "Keine Ausgaben in diesem Monat." : "Keine Ausgaben in dieser Woche.")) : null,
    an("lernzeit") ? h("div", { class: "card" }, h("h3", null, monatsBalken ? (istAkt ? "Lernzeit pro Fach (dieser Monat)" : "Lernzeit pro Fach (gewählter Monat)") : (istAkt ? "Lernzeit pro Fach (diese Woche)" : "Lernzeit pro Fach (gewählte Woche)")), lern.length ? lern.map(([f, e, g]) => h("div", { class: "hbar" }, h("span", null, R(f)), fortschritt(g ? e / g : 0, e >= g && g > 0), h("span", { class: "mut small" }, R(`${stundenText(e)} / ${stundenText(g)}`)))) : leer(monatsBalken ? "Keine Aufgaben mit Fach in diesem Monat." : "Keine Aufgaben mit Fach in dieser Woche.")) : null,
    an("verlauf") ? [h("h3", { style: "margin:22px 0 10px" }, "Verlauf"),
    h("div", { class: "kpis" }, kpi("Aufgaben erledigt (8 Wochen)", String(erlGesamt)), kpi("Aktuelle Serie (Tage)", String(serie)), kpi("Lernzeit diese Woche", stundenText(lernAkt.reduce((s, x) => s + x[1], 0))), kpi("Fokuszeit (4 Wochen)", stundenText(minKat))),
    h("div", { class: "card", style: "margin-top:14px" }, h("h3", null, "Erledigte Aufgaben pro Woche"),
      h("div", { class: "bars" }, wochen.map(([start, erl, off]) => h("div", { class: "c" }, h("div", { class: "s" }, h("i", { style: `height:${off / maxW * 100}%;background:var(--bad);opacity:.55;border-radius:0` }), h("i", { style: `height:${erl / maxW * 100}%;background:var(--acc)` })), h("em", { style: "text-align:center;line-height:1.25" }, R(deKurz(start).replace(/\.$/, "")), h("br"), h("b", null, R(`${erl}`))))),
        ), h("div", { class: "row small mut", style: "margin:8px 0 0;gap:16px" },
          h("span", { style: "display:inline-flex;align-items:center;gap:6px" }, h("i", { style: "display:inline-block;width:11px;height:11px;border-radius:3px;background:var(--acc)" }), "erledigt"),
          h("span", { style: "display:inline-flex;align-items:center;gap:6px" }, h("i", { style: "display:inline-block;width:11px;height:11px;border-radius:3px;background:var(--bad);opacity:.55" }), "offen und fällig"))),
    h("div", { class: "card" }, h("h3", null, "Erledigt nach Kategorie (letzte 4 Wochen)"), kat.length ? kat.map(([k, n, m]) => h("div", { class: "hbar" }, h("span", null, R(k)), fortschritt(kat[0][1] ? n / kat[0][1] : 0), h("span", { class: "mut small" }, R(`${n} · ${stundenText(m)}`)))) : leer("Noch nichts erledigt.")),
    h("div", { class: "card" }, h("h3", null, "Ausgaben und Einnahmen (6 Monate)"), h("div", { class: "bars" }, mon.map(([j, m, aus, ein]) => h("div", { class: "c" }, h("div", { class: "s", style: "flex-direction:row;align-items:flex-end;gap:3px" },
      h("i", { title: euroText(aus), style: `height:${aus / maxM * 100}%;background:var(--bad);opacity:.8` }), h("i", { title: euroText(ein), style: `height:${ein / maxM * 100}%;background:var(--ok)` })), h("em", null, R(`${pad(m)}/${String(j).slice(2)}`))))),
      h("p", { class: "mut small", style: "margin:8px 0 0" }, "Rot: Ausgaben · Grün: Einnahmen"))] : null);
}

/* ---------- Suche ---------- */
function sucheTab() {
  const feldEl = h("input", { type: "text", value: ui.suche, placeholder: "Suchen …", style: "flex:1;min-width:200px", oninput: e => { ui.suche = e.target.value; ergebnis(); } });
  const art = auswahl([["Alle", "Alle"], ["aufgabe", "Aufgaben"], ["termin", "Termine"], ["essen", "Essen"]], ui.sucheArt); art.onchange = () => { ui.sucheArt = art.value; ergebnis(); };
  const box = h("div", { class: "card" });
  const ergebnis = () => {
    box.replaceChildren();
    if (!ui.suche.trim()) { box.append(leer("Tippe einen Suchbegriff – Titel, Notizen, Fächer, Räume und Teilschritte werden durchsucht.")); return; }
    const tr = suchen(daten, ui.suche, ui.sucheArt);
    if (!tr.length) { box.append(leer("Keine Treffer.")); return; }
    box.append(h("div", { class: "list" }, tr.slice(0, 200).map(([typ, e]) => h("div", { class: "li", style: "cursor:pointer", onclick: () => eintragDialog({ v: Object.assign({}, e, { _start: e.datum, _anfang: e.datum }), quelle: e, art: typ, tag: e.datum ? parseISO(e.datum) : heute() }) },
      h("span", { class: "dot", style: `background:${farbeVon(e, typ)}` }), h("div", { class: "tx" }, h("b", null, R(typ === "essen" ? `${t(e.mahlzeit)}: ${e.gericht}` : e.name)), h("div", { class: "mut small" }, R(`${zeitraumText(e)}${e.uhrzeit ? " · " + e.uhrzeit : ""}`), e.wiederholung && e.wiederholung !== "keine" ? R(" · " + t(e.wiederholung)) : null)),
      h("span", { class: "pill" }, typ === "essen" ? "Essen" : typ === "termin" ? "Termin" : "Aufgabe")))));
  };
  setTimeout(ergebnis, 0);
  return h("div", null, kopfZeile("Suche"), h("div", { class: "row", style: "margin-bottom:12px" }, feldEl, art), box);
}

