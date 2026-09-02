import React, { useState, useMemo } from "react";

/*
  LIBRO DE PRÉSTAMOS — Rebuild limpio, pantalla por pantalla.
  PANTALLA 2: Resultado (cuadro de letras + ganancia).
  El interruptor "Vista previa" es solo para revisar; en la app real el
  Resultado llega con los datos que vienen de la Calculadora.
*/

const PAPER = "#f6f1e4", PAPER_DK = "#ece4d0", INK = "#232019", INK_SOFT = "#6b6455";
const RULE = "#d8cdb0", RED = "#b23a2e", GREEN = "#3f6b3a", AMBER = "#a8791f";
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const sans = "'IBM Plex Sans', system-ui, sans-serif";

const fmtCOP = (n) => "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtNum = (n) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const cuotaFija = (P, i, n) => (i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));

function calcAmort(P, tasaPct, n) {
  const i = tasaPct / 100;
  const cuota = cuotaFija(P, i, n);
  const filas = [{ n: 0, cuota: null, interes: null, amort: null, saldo: P }];
  let saldo = P, sumI = 0;
  for (let k = 1; k <= n; k++) {
    const interes = saldo * i; let amort = cuota - interes, cuotaK = cuota;
    if (k === n) { amort = saldo; cuotaK = interes + amort; saldo = 0; } else saldo -= amort;
    sumI += interes; filas.push({ n: k, cuota: cuotaK, interes, amort, saldo: saldo < 0.5 ? 0 : saldo });
  }
  return { cuota, filas, totalPagar: P + sumI, ganancia: sumI, pct: (sumI / P) * 100, n };
}

// Datos de ejemplo (solo para revisar la pantalla)
const EJ_PRESTAMO = { tipo: "Hipoteca", valor: 10000000, tasa: 2, plazo: 36 };
const EJ_ARRIENDO = { tipo: "Arriendo", valor: 1500000, plazo: 12 };

export default function Pantalla2Resultado() {
  const [modo, setModo] = useState("prestamo");
  const [aviso, setAviso] = useState(false);
  const arr = modo === "arriendo";

  const r = useMemo(() => {
    if (arr) return { esArriendo: true, cuota: EJ_ARRIENDO.valor, total: EJ_ARRIENDO.valor * EJ_ARRIENDO.plazo, n: EJ_ARRIENDO.plazo };
    return calcAmort(EJ_PRESTAMO.valor, EJ_PRESTAMO.tasa, EJ_PRESTAMO.plazo);
  }, [arr]);

  const ej = arr ? EJ_ARRIENDO : EJ_PRESTAMO;

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}>
          <button style={S.back} aria-label="Volver">←</button>
          <span style={S.headerTitle}>Resultado</span>
        </div>

        {/* Interruptor de vista previa (no va en la app real) */}
        <div style={S.demoBar}>
          <span style={S.demoLbl}>Vista previa:</span>
          <div style={S.demoTabs}>
            <button style={{ ...S.demoTab, ...(modo === "prestamo" ? S.demoOn : {}) }} onClick={() => { setModo("prestamo"); setAviso(false); }}>Préstamo</button>
            <button style={{ ...S.demoTab, ...(modo === "arriendo" ? S.demoOn : {}) }} onClick={() => { setModo("arriendo"); setAviso(false); }}>Arriendo</button>
          </div>
        </div>

        <div style={S.body}>
          <div style={S.resSub}>{ej.tipo} · {fmtCOP(ej.valor)}{arr ? "/mes" : ""} · {arr ? `${ej.plazo} meses` : `${ej.tasa}% · ${ej.plazo} cuotas`}</div>

          <div style={S.hero}>
            <span style={S.heroLabel}>{arr ? "Canon mensual" : "Valor de cada cuota"}</span>
            <span style={S.heroValue}>{fmtCOP(r.cuota)}</span>
          </div>

          {arr ? (
            <div style={S.gainRow}>
              <div style={S.gainBox}><span style={S.gainCap}>Duración</span><span style={S.gainVal}>{r.n} meses</span></div>
              <div style={S.gainBox}><span style={S.gainCap}>Total del contrato</span><span style={S.gainVal}>{fmtCOP(r.total)}</span></div>
            </div>
          ) : (
            <>
              <div style={S.tableWrap} className="lp-scroll">
                <table style={S.table}>
                  <thead><tr>
                    <th style={{ ...S.th, textAlign: "center" }}>N°</th>
                    <th style={S.thR}>Cuota</th><th style={S.thR}>Interés</th><th style={S.thR}>Abono</th><th style={S.thR}>Saldo</th>
                  </tr></thead>
                  <tbody>{r.filas.map((f) => (
                    <tr key={f.n} style={f.n === 0 ? S.rowZero : undefined}>
                      <td style={{ ...S.td, textAlign: "center", fontWeight: 600 }}>{f.n}</td>
                      <td style={S.tdR}>{f.cuota == null ? "—" : fmtNum(f.cuota)}</td>
                      <td style={S.tdR}>{f.interes == null ? "—" : fmtNum(f.interes)}</td>
                      <td style={S.tdR}>{f.amort == null ? "—" : fmtNum(f.amort)}</td>
                      <td style={{ ...S.tdR, fontWeight: 600 }}>{fmtNum(f.saldo)}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              <div style={S.gainRow}>
                <div style={S.gainBox}><span style={S.gainCap}>Ganancia total</span><span style={S.gainVal}>{fmtCOP(r.ganancia)}</span></div>
                <div style={S.gainBox}><span style={S.gainCap}>% ganancia</span><span style={{ ...S.gainVal, color: GREEN }}>{r.pct.toFixed(2)}%</span></div>
              </div>
              <div style={S.totalLine}><span>Total a recibir</span><span style={S.totalVal}>{fmtCOP(r.totalPagar)}</span></div>
            </>
          )}

          <div style={S.actions}>
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setAviso(false)}>Ajustar</button>
            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setAviso(true)}>Guardar</button>
          </div>

          {aviso && <div style={S.aviso}>✓ De aquí pasamos a <b>Registrar</b> (nombre, documento, garantía, fiador) — esa es la pantalla 3.</div>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; }
button:focus-visible { outline: 2px solid ${RED}; outline-offset: 1px; }
.lp-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.lp-scroll::-webkit-scrollbar-thumb { background: ${RULE}; border-radius: 8px; }
`;

const S = {
  stage: { minHeight: "100vh", width: "100%", background: "#e7e0cd", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "20px 12px 40px", fontFamily: sans, color: INK },
  phone: { width: "100%", maxWidth: 420, background: PAPER, border: `1px solid ${INK}`, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.15)", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: `2px solid ${INK}`, background: PAPER_DK },
  back: { border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: INK, fontFamily: mono, padding: 0 },
  headerTitle: { fontFamily: mono, fontWeight: 600, fontSize: 16, letterSpacing: "0.14em", textTransform: "uppercase" },
  demoBar: { display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#efe7d3", borderBottom: `1px dashed ${INK_SOFT}` },
  demoLbl: { fontFamily: mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT },
  demoTabs: { display: "flex", gap: 4, marginLeft: "auto" },
  demoTab: { fontFamily: mono, fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: `1px solid ${INK_SOFT}`, background: "transparent", color: INK_SOFT, cursor: "pointer" },
  demoOn: { background: INK, color: PAPER, borderColor: INK },
  body: { padding: "18px" },
  resSub: { fontFamily: mono, fontSize: 12, color: INK_SOFT, marginBottom: 6 },
  hero: { marginTop: 6, padding: "14px 16px", border: `2px solid ${INK}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 2 },
  heroLabel: { fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT },
  heroValue: { fontFamily: mono, fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: INK },
  tableWrap: { marginTop: 14, maxHeight: 320, overflow: "auto", border: `1.5px solid ${INK}`, borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12 },
  th: { position: "sticky", top: 0, background: INK, color: PAPER, padding: "8px", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" },
  thR: { position: "sticky", top: 0, background: INK, color: PAPER, padding: "8px", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" },
  td: { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, whiteSpace: "nowrap" },
  tdR: { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  rowZero: { background: PAPER_DK, fontStyle: "italic" },
  gainRow: { display: "flex", gap: 12, marginTop: 14 },
  gainBox: { flex: 1, border: `1.5px solid ${INK}`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 },
  gainCap: { fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT },
  gainVal: { fontFamily: mono, fontSize: 18, fontWeight: 700, color: INK },
  totalLine: { marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: mono, fontSize: 12, color: INK_SOFT, letterSpacing: "0.06em", textTransform: "uppercase", paddingTop: 12, borderTop: `1.5px solid ${INK}` },
  totalVal: { fontSize: 17, fontWeight: 700, color: INK, textTransform: "none", letterSpacing: 0 },
  actions: { display: "flex", gap: 12, marginTop: 18 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  btnGhost: { background: "transparent", color: INK, border: `1.5px solid ${INK}` },
  aviso: { marginTop: 14, fontFamily: sans, fontSize: 13, color: GREEN, background: "rgba(63,107,58,.08)", border: `1px solid ${GREEN}`, borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 },
};
