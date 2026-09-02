import React, { useState, useMemo } from "react";

/*
  LIBRO DE PRÉSTAMOS — Rebuild limpio, pantalla por pantalla.
  PANTALLA 4: Expediente (cuadro de letras, cobros, abono a capital, mora, recibo).
  Trae un cliente de ejemplo para revisar. Motor de cálculo reusado.
*/

const PAPER = "#f6f1e4", PAPER_DK = "#ece4d0", INK = "#232019", INK_SOFT = "#6b6455";
const RULE = "#d8cdb0", RED = "#b23a2e", GREEN = "#3f6b3a", AMBER = "#a8791f", BLUE = "#2f5d7a", WA = "#1f8a4c";
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const sans = "'IBM Plex Sans', system-ui, sans-serif";

const fmtCOP = (n) => "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtNum = (n) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const parseISO = (s) => new Date(s + "T00:00:00");
const fmtFecha = (d) => (typeof d === "string" ? parseISO(d) : d).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
const hoyISO = () => new Date().toISOString().slice(0, 10);
const addMonths = (iso, k) => { const d = parseISO(iso); d.setMonth(d.getMonth() + k); return d; };
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const cuotaFija = (P, i, n) => (i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
const esArr = (t) => t === "Arriendo";
const waLink = (tel, texto) => { let num = (tel || "").replace(/[^\d]/g, ""); if (num.length === 10) num = "57" + num; return (num ? `https://wa.me/${num}` : "https://wa.me/") + `?text=${encodeURIComponent(texto)}`; };

function derivarCuadro(exp) {
  const n = exp.plazo; const fechas = {};
  for (let k = 1; k <= n; k++) fechas[k] = addMonths(exp.fechaPrimeraCuota, k - 1);
  if (esArr(exp.tipoCredito)) { const filas = [{ n: 0, saldo: 0 }]; for (let k = 1; k <= n; k++) filas.push({ n: k, fecha: fechas[k], valor: exp.valor }); return { filas, markers: {} }; }
  const P = exp.valor, i = exp.tasa / 100; const markers = {};
  for (const ab of exp.abonosCapital || []) { const abF = parseISO(ab.fecha); let p = n; for (let k = 1; k <= n; k++) { if (fechas[k] >= abF) { p = k; break; } } markers[p] = markers[p] || { monto: 0, items: [] }; markers[p].monto += Number(ab.monto); markers[p].items.push(ab); }
  let saldo = P, cuota = cuotaFija(P, i, n); const filas = [{ n: 0, saldo: P }];
  for (let k = 1; k <= n; k++) {
    if (markers[k]) { saldo = Math.max(0, saldo - markers[k].monto); const rem = n - k + 1; cuota = saldo <= 0 ? 0 : cuotaFija(saldo, i, rem); markers[k].nuevaCuota = cuota; }
    if (saldo <= 0) { filas.push({ n: k, fecha: fechas[k], valor: 0, saldo: 0, cancelada: true }); continue; }
    const interes = saldo * i; let amort = cuota - interes, cuotaK = cuota;
    if (k === n) { amort = saldo; cuotaK = interes + amort; saldo = 0; } else { saldo -= amort; if (saldo < 0) saldo = 0; }
    filas.push({ n: k, fecha: fechas[k], valor: cuotaK, interes, abono: amort, saldo: saldo < 0.5 ? 0 : saldo });
  }
  return { filas, markers };
}
const pagosDe = (exp, k) => (exp.pagos && exp.pagos[k]) || [];
const pagadoDe = (exp, k) => pagosDe(exp, k).reduce((s, p) => s + Number(p.monto), 0);
function recargoDe(exp, fila) { if (!exp.mora || !exp.mora.activa || fila.cancelada) return 0; const pg = pagadoDe(exp, fila.n); if (pg >= fila.valor - 0.5) return 0; return midnight(fila.fecha) < midnight(new Date()) ? Number(exp.mora.valor) || 0 : 0; }
const totalDe = (exp, fila) => fila.valor + recargoDe(exp, fila);
function estadoDe(exp, fila) { if (fila.cancelada) return "CANCELADA"; const total = totalDe(exp, fila), pg = pagadoDe(exp, fila.n); if (fila.valor > 0 && pg >= total - 0.5) return "PAGADA"; if (pg > 0) return "PARCIAL"; return midnight(fila.fecha) < midnight(new Date()) ? "VENCIDA" : "PENDIENTE"; }
function resumen(exp) {
  const { filas } = derivarCuadro(exp); let porCobrar = 0, recCuotas = 0, enMora = 0;
  for (const f of filas) { if (f.n === 0 || f.cancelada) continue; const pg = pagadoDe(exp, f.n), total = totalDe(exp, f); recCuotas += Math.min(pg, total); porCobrar += Math.max(0, total - pg); if (estadoDe(exp, f) === "VENCIDA") enMora++; }
  const recCap = (exp.abonosCapital || []).reduce((s, a) => s + Number(a.monto), 0);
  return { porCobrar, abonado: recCuotas + recCap, enMora };
}

const EJEMPLO = {
  tipoCredito: "Hipoteca", valor: 10000000, tasa: 2, plazo: 36, fechaPrimeraCuota: "2026-06-01",
  nombreDeudor: "José Martínez", docDeudor: "72.145.980", telefono: "3001234567",
  garantias: [{ tipo: "Inmueble", folio: "050-123456", desc: "Casa lote 5, barrio El Prado" }],
  fiador: { nombre: "Ana Ríos", doc: "45.998.112" },
  mora: { activa: true, valor: 20000 },
  pagos: { 1: [{ monto: 392328, fecha: "2026-06-01" }], 2: [{ monto: 200000, fecha: "2026-07-05" }] },
  abonosCapital: [],
};

export default function Pantalla4Expediente() {
  const [exp, setExp] = useState(EJEMPLO);
  const [pagoOpen, setPagoOpen] = useState(null);
  const [pagoMonto, setPagoMonto] = useState(0);
  const [pagoFecha, setPagoFecha] = useState(hoyISO());
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [abonoMonto, setAbonoMonto] = useState(0);
  const [abonoFecha, setAbonoFecha] = useState(hoyISO());
  const [recibo, setRecibo] = useState(null);

  const cuadro = useMemo(() => derivarCuadro(exp), [exp]);
  const res = resumen(exp);
  const arr = esArr(exp.tipoCredito);

  const registrarCobro = (n, monto, fecha) => {
    monto = Number(monto) || 0; if (monto <= 0) return;
    const pagos = { ...(exp.pagos || {}) }; pagos[n] = [...(pagos[n] || []), { monto, fecha }];
    const next = { ...exp, pagos }; setExp(next);
    const fila = derivarCuadro(next).filas.find((f) => f.n === n);
    setRecibo({ nombre: exp.nombreDeudor, tipo: exp.tipoCredito, telefono: exp.telefono, n, monto, fecha, faltaDespues: Math.max(0, totalDe(next, fila) - pagadoDe(next, n)), porCobrar: resumen(next).porCobrar });
  };
  const limpiarCuota = (n) => { const pagos = { ...(exp.pagos || {}) }; delete pagos[n]; setExp({ ...exp, pagos }); };
  const agregarAbono = () => { const m = Number(abonoMonto) || 0; if (m <= 0) return; setExp({ ...exp, abonosCapital: [...(exp.abonosCapital || []), { id: Date.now(), monto: m, fecha: abonoFecha }] }); setAbonoMonto(0); setAbonoFecha(hoyISO()); setAbonoOpen(false); };
  const quitarAbono = (id) => setExp({ ...exp, abonosCapital: (exp.abonosCapital || []).filter((a) => a.id !== id) });

  const filaSel = pagoOpen != null ? cuadro.filas.find((f) => f.n === pagoOpen) : null;
  const faltaSel = filaSel ? Math.max(0, totalDe(exp, filaSel) - pagadoDe(exp, filaSel.n)) : 0;
  const textoRecibo = (r) => `*Recibo de pago*\n${r.nombre}\n${r.tipo} — Cuota N° ${r.n}\nValor recibido: ${fmtCOP(r.monto)}\nFecha: ${fmtFecha(r.fecha)}\n${r.faltaDespues > 0 ? `Falta de esta cuota: ${fmtCOP(r.faltaDespues)}` : "Cuota PAGADA ✓"}\nSaldo por cobrar: ${fmtCOP(r.porCobrar)}`;

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}><button style={S.back} aria-label="Volver">←</button><span style={S.headerTitle}>Expediente</span></div>
        <div style={S.body}>
          <div style={S.expHead}><span style={S.expHeadName}>{exp.nombreDeudor}</span><span style={S.expHeadMeta}>{exp.tipoCredito}{exp.docDeudor ? ` · CC ${exp.docDeudor}` : ""}{exp.telefono ? ` · ${exp.telefono}` : ""}</span></div>

          <div style={S.miniGrid}>
            <div style={S.mini}><span style={S.miniCap}>{arr ? "Canon" : "Prestado"}</span><span style={S.miniVal}>{fmtCOP(exp.valor)}</span></div>
            <div style={S.mini}><span style={S.miniCap}>Por cobrar</span><span style={S.miniVal}>{fmtCOP(res.porCobrar)}</span></div>
            <div style={S.mini}><span style={S.miniCap}>{arr ? "Cobrado" : "Abonado"}</span><span style={{ ...S.miniVal, color: GREEN }}>{fmtCOP(res.abonado)}</span></div>
            <div style={S.mini}><span style={S.miniCap}>En mora</span><span style={{ ...S.miniVal, color: res.enMora ? RED : INK }}>{res.enMora}</span></div>
          </div>
          {exp.mora && exp.mora.activa && <div style={S.moraLine}>Recargo por mora: {fmtCOP(exp.mora.valor)} por cuota vencida</div>}
          {exp.garantias.length > 0 && (<div style={S.garSummary}><span style={S.sectionLabel}>Garantía</span>{exp.garantias.map((g, i) => <div key={i} style={S.garLine}>{g.tipo}{g.folio ? ` · Folio ${g.folio}` : ""}{g.desc ? ` · ${g.desc}` : ""}</div>)}</div>)}
          {exp.fiador && <div style={S.garLine}><b>Fiador:</b> {exp.fiador.nombre}{exp.fiador.doc ? ` (${exp.fiador.doc})` : ""}</div>}

          <div style={{ ...S.sectionLabel, marginTop: 16 }}>Cuadro de letras</div>
          <div style={S.tableWrap} className="lp-scroll">
            <table style={S.table}><thead><tr><th style={{ ...S.th, textAlign: "center" }}>N°</th><th style={S.th}>Vence</th><th style={S.thR}>Valor</th><th style={{ ...S.th, textAlign: "center" }}>Estado</th><th style={S.th}></th></tr></thead>
              <tbody>{cuadro.filas.filter((f) => f.n >= 1).map((f) => {
                const m = cuadro.markers[f.n]; const est = estadoDe(exp, f);
                const bs = est === "PAGADA" ? S.bPag : est === "VENCIDA" ? S.bVenc : est === "PARCIAL" ? S.bParc : est === "CANCELADA" ? S.bCanc : S.bPend;
                const pg = pagadoDe(exp, f.n), rec = recargoDe(exp, f), falta = Math.max(0, totalDe(exp, f) - pg);
                return (<React.Fragment key={f.n}>
                  {m && (<tr><td colSpan={5} style={S.markerCell}>↓ Abono a capital {fmtCOP(m.monto)} · {fmtFecha(m.items[0].fecha)} — la cuota baja a {fmtCOP(m.nuevaCuota)}</td></tr>)}
                  <tr>
                    <td style={{ ...S.td, textAlign: "center", fontWeight: 600 }}>{f.n}</td>
                    <td style={S.td}>{fmtFecha(f.fecha)}</td>
                    <td style={S.tdR}>{f.cancelada ? "—" : fmtNum(f.valor)}{rec > 0 && <div style={S.moraNote}>+mora {fmtNum(rec)}</div>}{est === "PARCIAL" && <div style={S.faltaNote}>falta {fmtNum(falta)}</div>}</td>
                    <td style={{ ...S.td, textAlign: "center" }}><span style={{ ...S.badgeSm, ...bs }}>{est}</span></td>
                    <td style={S.td}>{!f.cancelada && (est === "PAGADA" ? <button style={S.undoBtn} onClick={() => limpiarCuota(f.n)}>Deshacer</button> : <button style={S.payBtn} onClick={() => { setPagoOpen(f.n); setPagoMonto(Math.round(falta)); setPagoFecha(hoyISO()); setAbonoOpen(false); }}>{est === "PARCIAL" ? "Completar" : "Pagar"}</button>)}</td>
                  </tr>
                </React.Fragment>);
              })}</tbody></table>
          </div>

          {filaSel && (
            <div style={S.panel}>
              <div style={S.panelTitle}>Registrar pago — Cuota {filaSel.n}</div>
              <div style={S.panelMeta}>Vence {fmtFecha(filaSel.fecha)} · Valor {fmtCOP(totalDe(exp, filaSel))} · Falta {fmtCOP(faltaSel)}</div>
              <div style={S.twoCol}>
                <div style={{ flex: 1 }}><label style={S.lbl}>Monto que paga</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(pagoMonto)} onChange={(e) => setPagoMonto(parseInt(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div>
                <div style={{ flex: 1 }}><label style={S.lbl}>Fecha</label><input type="date" style={S.input} value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} /></div>
              </div>
              <div style={S.hint}>{Number(pagoMonto) >= faltaSel ? "Queda PAGADA." : `Abono parcial · quedará debiendo ${fmtCOP(faltaSel - Number(pagoMonto))} de esta cuota.`}</div>
              <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setPagoOpen(null)}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { registrarCobro(pagoOpen, pagoMonto, pagoFecha); setPagoOpen(null); }}>Registrar</button></div>
            </div>
          )}

          {!arr && (
            <div style={S.abonoSection}>
              <div style={S.abonoHead}><span style={S.sectionLabel}>Abonos a capital</span><button style={S.addSmall} onClick={() => { setAbonoOpen((v) => !v); setPagoOpen(null); }}>{abonoOpen ? "Cerrar" : "+ Abonar"}</button></div>
              <div style={S.abonoExpl}>Plata extra al capital: baja el saldo y recalcula las cuotas siguientes.</div>
              {(exp.abonosCapital || []).map((a) => (<div key={a.id} style={S.abonoItem}><span>{fmtCOP(a.monto)} · {fmtFecha(a.fecha)}</span><button style={S.delMini} onClick={() => quitarAbono(a.id)}>✕</button></div>))}
              {abonoOpen && (<div style={S.panel}>
                <div style={S.twoCol}><div style={{ flex: 1 }}><label style={S.lbl}>Valor abonado</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(abonoMonto)} onChange={(e) => setAbonoMonto(parseInt(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div><div style={{ flex: 1 }}><label style={S.lbl}>Fecha</label><input type="date" style={S.input} value={abonoFecha} onChange={(e) => setAbonoFecha(e.target.value)} /></div></div>
                <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setAbonoOpen(false)}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={agregarAbono}>Aplicar abono</button></div>
              </div>)}
            </div>
          )}
        </div>

        {recibo && (<div style={S.overlay} onClick={() => setRecibo(null)}>
          <div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
            <div style={S.reciboStamp}>Recibo de pago</div>
            <div style={S.reciboBody}>
              <div style={S.reciboName}>{recibo.nombre}</div>
              <div style={S.reciboLine}>{recibo.tipo} — Cuota N° {recibo.n}</div>
              <div style={S.reciboBig}>{fmtCOP(recibo.monto)}</div>
              <div style={S.reciboLine}>Fecha: {fmtFecha(recibo.fecha)}</div>
              <div style={{ ...S.reciboLine, color: recibo.faltaDespues > 0 ? RED : GREEN, fontWeight: 700 }}>{recibo.faltaDespues > 0 ? `Falta de esta cuota: ${fmtCOP(recibo.faltaDespues)}` : "Cuota PAGADA ✓"}</div>
              <div style={S.reciboLine}>Saldo por cobrar: {fmtCOP(recibo.porCobrar)}</div>
            </div>
            <div style={S.actions}>
              <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setRecibo(null)}>Cerrar</button>
              <a style={{ ...S.btn, ...S.btnWa, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }} href={waLink(recibo.telefono, textoRecibo(recibo))} target="_blank" rel="noopener noreferrer">Compartir recibo</a>
            </div>
          </div>
        </div>)}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; }
select:focus, input:focus, button:focus-visible { outline: 2px solid ${RED}; outline-offset: 1px; }
.lp-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.lp-scroll::-webkit-scrollbar-thumb { background: ${RULE}; border-radius: 8px; }
`;

const S = {
  stage: { minHeight: "100vh", width: "100%", background: "#e7e0cd", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "20px 12px 40px", fontFamily: sans, color: INK },
  phone: { width: "100%", maxWidth: 420, background: PAPER, border: `1px solid ${INK}`, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.15)", overflow: "hidden", position: "relative" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: `2px solid ${INK}`, background: PAPER_DK },
  back: { border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: INK, fontFamily: mono, padding: 0 },
  headerTitle: { fontFamily: mono, fontWeight: 600, fontSize: 16, letterSpacing: "0.14em", textTransform: "uppercase" },
  body: { padding: "18px" },
  lbl: { display: "block", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT, margin: "12px 0 5px" },
  input: { width: "100%", fontFamily: mono, fontSize: 15, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 2px", marginBottom: 4 },
  moneyRow: { display: "flex", alignItems: "baseline", gap: 6, borderBottom: `1.5px solid ${INK}`, paddingBottom: 6 },
  peso: { fontFamily: mono, fontSize: 18, fontWeight: 600, color: INK_SOFT },
  moneyInput: { flex: 1, fontFamily: mono, fontSize: 18, fontWeight: 600, color: INK, background: "transparent", border: "none", padding: "2px 0" },
  twoCol: { display: "flex", gap: 16, marginTop: 4 },
  expHead: { borderBottom: `1.5px solid ${INK}`, paddingBottom: 10, marginBottom: 12 },
  expHeadName: { display: "block", fontFamily: sans, fontSize: 20, fontWeight: 700 },
  expHeadMeta: { fontFamily: mono, fontSize: 12, color: INK_SOFT },
  miniGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  mini: { border: `1.5px solid ${RULE}`, borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column" },
  miniCap: { fontFamily: mono, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_SOFT },
  miniVal: { fontFamily: mono, fontSize: 16, fontWeight: 700, color: INK },
  moraLine: { fontFamily: mono, fontSize: 12, color: AMBER, marginTop: 10, fontWeight: 600 },
  garSummary: { marginTop: 14 },
  sectionLabel: { fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: INK, display: "block" },
  garLine: { fontFamily: mono, fontSize: 12.5, color: INK, marginTop: 4 },
  tableWrap: { marginTop: 12, maxHeight: 300, overflow: "auto", border: `1.5px solid ${INK}`, borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12 },
  th: { position: "sticky", top: 0, background: INK, color: PAPER, padding: "8px", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" },
  thR: { position: "sticky", top: 0, background: INK, color: PAPER, padding: "8px", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" },
  td: { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, whiteSpace: "nowrap", verticalAlign: "middle" },
  tdR: { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  markerCell: { background: "rgba(47,93,122,.1)", color: BLUE, fontFamily: mono, fontSize: 10.5, fontWeight: 600, padding: "6px 8px", borderBottom: `1px solid ${RULE}`, borderLeft: `3px solid ${BLUE}` },
  faltaNote: { fontFamily: mono, fontSize: 10, color: RED, fontWeight: 600, marginTop: 2 },
  moraNote: { fontFamily: mono, fontSize: 10, color: AMBER, fontWeight: 600, marginTop: 2 },
  badgeSm: { fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 6px", borderRadius: 4, border: "1.5px solid" },
  bPag: { color: GREEN, borderColor: GREEN, background: "rgba(63,107,58,.08)" },
  bVenc: { color: RED, borderColor: RED, background: "rgba(178,58,46,.08)" },
  bPend: { color: AMBER, borderColor: AMBER, background: "rgba(168,121,31,.08)" },
  bParc: { color: BLUE, borderColor: BLUE, background: "rgba(47,93,122,.08)" },
  bCanc: { color: INK_SOFT, borderColor: INK_SOFT, background: "rgba(107,100,85,.08)" },
  payBtn: { fontFamily: mono, fontSize: 11, fontWeight: 600, background: INK, color: PAPER, border: "none", borderRadius: 5, padding: "5px 10px", cursor: "pointer" },
  undoBtn: { fontFamily: mono, fontSize: 11, background: "transparent", color: INK_SOFT, border: `1px solid ${INK_SOFT}`, borderRadius: 5, padding: "5px 8px", cursor: "pointer" },
  panel: { marginTop: 12, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "12px 14px", background: PAPER_DK },
  panelTitle: { fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" },
  panelMeta: { fontFamily: mono, fontSize: 11.5, color: INK_SOFT, marginTop: 3 },
  hint: { fontFamily: sans, fontSize: 12.5, color: INK, marginTop: 8, fontStyle: "italic" },
  actions: { display: "flex", gap: 12, marginTop: 14 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  btnGhost: { background: "transparent", color: INK, border: `1.5px solid ${INK}` },
  btnWa: { background: WA, color: "#fff", border: `1.5px solid ${WA}` },
  abonoSection: { marginTop: 18, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "12px 14px" },
  abonoHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  abonoExpl: { fontFamily: sans, fontSize: 12, color: INK_SOFT, marginTop: 4 },
  abonoItem: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono, fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${RULE}` },
  addSmall: { fontFamily: mono, fontSize: 12, fontWeight: 600, background: INK, color: PAPER, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" },
  delMini: { fontFamily: mono, fontSize: 12, background: "transparent", border: "none", color: RED, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(30,26,20,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 360, background: PAPER, border: `2px solid ${INK}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 16px 40px rgba(0,0,0,.35)" },
  reciboStamp: { display: "inline-block", fontFamily: mono, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: GREEN, border: `2px solid ${GREEN}`, borderRadius: 6, padding: "4px 12px", fontSize: 13, transform: "rotate(-1.5deg)" },
  reciboBody: { marginTop: 14, borderTop: `1px dashed ${INK_SOFT}`, borderBottom: `1px dashed ${INK_SOFT}`, padding: "12px 0" },
  reciboName: { fontFamily: sans, fontSize: 18, fontWeight: 700 },
  reciboLine: { fontFamily: mono, fontSize: 12.5, color: INK, marginTop: 4 },
  reciboBig: { fontFamily: mono, fontSize: 28, fontWeight: 700, margin: "8px 0 4px" },
};
