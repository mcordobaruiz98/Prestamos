import React, { useState, useMemo } from "react";

/*
  LIBRO DE PRÉSTAMOS — Rebuild limpio, pantalla por pantalla.
  PANTALLA 1: Calculadora (entrada).
  Motor de cálculo reusado del prototipo (amortización francesa / canon de arriendo).
*/

const TIPOS = ["Hipoteca", "Letra de cambio", "Empeño", "Pignoración", "Arriendo"];

const PAPER = "#f6f1e4", PAPER_DK = "#ece4d0", INK = "#232019", INK_SOFT = "#6b6455";
const RULE = "#d8cdb0", RED = "#b23a2e", GREEN = "#3f6b3a", AMBER = "#a8791f";
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const sans = "'IBM Plex Sans', system-ui, sans-serif";

const fmtCOP = (n) => "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtNum = (n) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const hoyISO = () => new Date().toISOString().slice(0, 10);
const cuotaFija = (P, i, n) => (i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
const esArr = (t) => t === "Arriendo";

export default function Pantalla1Calculadora() {
  const [tipoCredito, setTipoCredito] = useState("Hipoteca");
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [valor, setValor] = useState(10000000);
  const [tasa, setTasa] = useState("2");
  const [plazo, setPlazo] = useState("36");
  const [moraActiva, setMoraActiva] = useState(false);
  const [moraValor, setMoraValor] = useState(0);
  const [aviso, setAviso] = useState("");

  const arr = esArr(tipoCredito);

  const r = useMemo(() => {
    const P = Number(valor) || 0, n = parseInt(plazo) || 0;
    if (P <= 0 || n <= 0) return null;
    if (arr) return { cuota: P, total: P * n, n };
    const i = (parseFloat(tasa) || 0) / 100;
    const cuota = cuotaFija(P, i, n);
    return { cuota, total: cuota * n, n };
  }, [arr, valor, tasa, plazo]);

  const onValor = (e) => { const d = e.target.value.replace(/[^\d]/g, ""); setValor(d ? parseInt(d) : 0); setAviso(""); };

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}>
          <button style={S.back} aria-label="Volver">←</button>
          <span style={S.headerTitle}>Calculadora</span>
        </div>

        <div style={S.body}>
          <label style={S.lbl}>Tipo de crédito</label>
          <div style={S.selectWrap}>
            <select style={S.select} value={tipoCredito} onChange={(e) => { setTipoCredito(e.target.value); setAviso(""); }}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <span style={S.caret}>▾</span>
          </div>

          <label style={S.lbl}>{arr ? "Fecha de inicio del contrato" : "Fecha de inicio"}</label>
          <input type="date" style={S.input} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />

          <div style={S.card}>
            <label style={S.lbl}>{arr ? "Canon mensual" : "Valor prestado"}</label>
            <div style={S.moneyRow}>
              <span style={S.peso}>$</span>
              <input type="text" inputMode="numeric" style={S.moneyInput} value={fmtNum(valor)} onChange={onValor} />
            </div>
            <div style={S.twoCol}>
              {!arr && (
                <div style={{ flex: 1 }}>
                  <label style={S.lbl}>Interés mensual</label>
                  <div style={S.pctRow}>
                    <input type="text" inputMode="decimal" style={S.smallInput} value={tasa} onChange={(e) => { setTasa(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")); setAviso(""); }} />
                    <span style={S.unit}>%</span>
                  </div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label style={S.lbl}>{arr ? "Duración" : "Plazo"}</label>
                <div style={S.pctRow}>
                  <input type="text" inputMode="numeric" style={S.smallInput} value={plazo} onChange={(e) => { setPlazo(e.target.value.replace(/[^\d]/g, "")); setAviso(""); }} />
                  <span style={S.unit}>meses</span>
                </div>
              </div>
            </div>
          </div>

          <div style={S.moraOpt}>
            <label style={S.checkRow}>
              <input type="checkbox" checked={moraActiva} onChange={(e) => setMoraActiva(e.target.checked)} />
              <span style={S.sectionLabel}>Cobrar recargo por mora</span>
            </label>
            {moraActiva && (
              <div style={{ marginTop: 8 }}>
                <label style={S.lbl}>Recargo por cuota vencida</label>
                <div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(moraValor)} onChange={(e) => setMoraValor(parseInt(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div>
              </div>
            )}
          </div>

          {r && (
            <div style={S.previewRow}>
              <span style={S.previewLabel}>{arr ? "Total del contrato" : "Cada cuota"}</span>
              <span style={S.previewValue}>{arr ? fmtCOP(r.total) : fmtCOP(r.cuota)}</span>
            </div>
          )}

          <div style={S.actions}>
            <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} disabled={!r} onClick={() => setAviso("ok")}>Calcular</button>
          </div>

          {aviso === "ok" && <div style={S.aviso}>✓ Cálculo listo. La pantalla de <b>Resultado</b> (con el cuadro de letras y la ganancia) la armamos en el siguiente paso.</div>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; }
select:focus, input:focus, button:focus-visible { outline: 2px solid ${RED}; outline-offset: 1px; }
`;

const S = {
  stage: { minHeight: "100vh", width: "100%", background: "#e7e0cd", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "20px 12px 40px", fontFamily: sans, color: INK },
  phone: { width: "100%", maxWidth: 420, background: PAPER, border: `1px solid ${INK}`, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.15)", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: `2px solid ${INK}`, background: PAPER_DK },
  back: { border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: INK, fontFamily: mono, padding: 0 },
  headerTitle: { fontFamily: mono, fontWeight: 600, fontSize: 16, letterSpacing: "0.14em", textTransform: "uppercase" },
  body: { padding: "18px" },
  lbl: { display: "block", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT, margin: "12px 0 5px" },
  selectWrap: { position: "relative" },
  select: { width: "100%", appearance: "none", WebkitAppearance: "none", fontFamily: sans, fontSize: 16, fontWeight: 600, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 26px 8px 2px", cursor: "pointer" },
  caret: { position: "absolute", right: 4, top: 10, pointerEvents: "none", color: INK_SOFT },
  input: { width: "100%", fontFamily: mono, fontSize: 15, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 2px", marginBottom: 4 },
  card: { marginTop: 16, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "4px 14px 14px" },
  moneyRow: { display: "flex", alignItems: "baseline", gap: 6, borderBottom: `1.5px solid ${INK}`, paddingBottom: 6 },
  peso: { fontFamily: mono, fontSize: 20, fontWeight: 600, color: INK_SOFT },
  moneyInput: { flex: 1, fontFamily: mono, fontSize: 24, fontWeight: 600, color: INK, background: "transparent", border: "none", padding: "2px 0" },
  twoCol: { display: "flex", gap: 16, marginTop: 4 },
  pctRow: { display: "flex", alignItems: "baseline", gap: 6, borderBottom: `1.5px solid ${INK}`, paddingBottom: 6 },
  smallInput: { width: "100%", fontFamily: mono, fontSize: 20, fontWeight: 600, color: INK, background: "transparent", border: "none", padding: "2px 0" },
  unit: { fontFamily: mono, fontSize: 12, color: INK_SOFT, whiteSpace: "nowrap" },
  moraOpt: { marginTop: 16, border: `1.5px dashed ${INK_SOFT}`, borderRadius: 8, padding: "10px 12px" },
  sectionLabel: { fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: INK },
  checkRow: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  previewRow: { marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 14px", background: PAPER_DK, borderRadius: 8 },
  previewLabel: { fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT },
  previewValue: { fontFamily: mono, fontSize: 19, fontWeight: 700, color: INK },
  actions: { display: "flex", gap: 12, marginTop: 18 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  aviso: { marginTop: 14, fontFamily: sans, fontSize: 13, color: GREEN, background: "rgba(63,107,58,.08)", border: `1px solid ${GREEN}`, borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 },
};