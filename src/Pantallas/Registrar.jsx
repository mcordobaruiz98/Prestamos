import React, { useState } from "react";

/*
  LIBRO DE PRÉSTAMOS — Rebuild limpio, pantalla por pantalla.
  PANTALLA 3: Registrar (datos del deudor, garantías, fiador, fecha).
  Al confirmar, en la app real se crea el expediente (pantalla 4).
*/

const TIPOS_GARANTIA = ["Inmueble", "Vehículo", "Prenda / objeto", "Otro"];

const PAPER = "#f6f1e4", PAPER_DK = "#ece4d0", INK = "#232019", INK_SOFT = "#6b6455";
const RULE = "#d8cdb0", RED = "#b23a2e", GREEN = "#3f6b3a";
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const sans = "'IBM Plex Sans', system-ui, sans-serif";

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function Pantalla3Registrar() {
  const [nombre, setNombre] = useState("");
  const [doc, setDoc] = useState("");
  const [telefono, setTelefono] = useState("");
  const [garantias, setGarantias] = useState([{ tipo: "Inmueble", folio: "", desc: "" }]);
  const [fiadorOn, setFiadorOn] = useState(false);
  const [fiadorNombre, setFiadorNombre] = useState("");
  const [fiadorDoc, setFiadorDoc] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState(false);

  const setGar = (i, k, v) => setGarantias((g) => g.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const addGar = () => setGarantias((g) => [...g, { tipo: "Inmueble", folio: "", desc: "" }]);
  const delGar = (i) => setGarantias((g) => g.filter((_, idx) => idx !== i));

  const confirmar = () => {
    if (!nombre.trim()) { setError("Falta el nombre del deudor."); setAviso(false); return; }
    setError(""); setAviso(true);
  };

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}>
          <button style={S.back} aria-label="Volver">←</button>
          <span style={S.headerTitle}>Registrar</span>
        </div>

        <div style={S.body}>
          <label style={S.lbl}>Nombre del deudor</label>
          <input style={S.input} value={nombre} onChange={(e) => { setNombre(e.target.value); setError(""); }} placeholder="Nombre completo" />

          <label style={S.lbl}>Documento de identidad</label>
          <div style={S.inlineRow}>
            <input style={{ ...S.input, flex: 1 }} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="N° de cédula" />
            <button style={S.attachBtn} title="Adjuntar foto (pendiente)">📷 Insertar</button>
          </div>

          <label style={S.lbl}>Teléfono / WhatsApp</label>
          <input type="tel" style={S.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" />

          <div style={S.divider} />
          <div style={S.sectionLabel}>Garantías</div>
          {garantias.map((g, idx) => (
            <div key={idx} style={S.garBox}>
              <div style={S.selectWrap}>
                <select style={S.select} value={g.tipo} onChange={(e) => setGar(idx, "tipo", e.target.value)}>{TIPOS_GARANTIA.map((t) => <option key={t}>{t}</option>)}</select>
                <span style={S.caret}>▾</span>
              </div>
              <input style={S.input} value={g.folio} onChange={(e) => setGar(idx, "folio", e.target.value)} placeholder="N° de folio / documento" />
              <input style={S.input} value={g.desc} onChange={(e) => setGar(idx, "desc", e.target.value)} placeholder="Descripción (ej: casa lote 5, moto AKT)" />
              <div style={S.garActions}>
                <button style={S.attachBtn} title="Adjuntar foto (pendiente)">📷 Foto</button>
                {garantias.length > 1 && <button style={S.delBtn} onClick={() => delGar(idx)}>✕ Quitar</button>}
              </div>
            </div>
          ))}
          <button style={S.addBtn} onClick={addGar}>+ Agregar garantía</button>

          <div style={S.divider} />
          <label style={S.checkRow}>
            <input type="checkbox" checked={fiadorOn} onChange={(e) => setFiadorOn(e.target.checked)} />
            <span style={S.sectionLabel}>Tiene fiador / codeudor</span>
          </label>
          {fiadorOn && (
            <div style={S.garBox}>
              <input style={S.input} value={fiadorNombre} onChange={(e) => setFiadorNombre(e.target.value)} placeholder="Nombre del fiador" />
              <input style={S.input} value={fiadorDoc} onChange={(e) => setFiadorDoc(e.target.value)} placeholder="Documento del fiador" />
            </div>
          )}

          <div style={S.divider} />
          <label style={S.lbl}>Fecha de la primera cuota</label>
          <input type="date" style={S.input} value={fecha} onChange={(e) => setFecha(e.target.value)} />

          {error && <div style={S.error}>{error}</div>}

          <div style={S.actions}>
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setAviso(false)}>Cancelar</button>
            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={confirmar}>Confirmar</button>
          </div>

          {aviso && <div style={S.aviso}>✓ Con esto se crea el <b>expediente</b> del deudor y su cuadro de letras — esa es la pantalla 4.</div>}
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
  input: { width: "100%", fontFamily: mono, fontSize: 15, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 2px", marginBottom: 4 },
  inlineRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  selectWrap: { position: "relative" },
  select: { width: "100%", appearance: "none", WebkitAppearance: "none", fontFamily: sans, fontSize: 15, fontWeight: 600, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 26px 8px 2px", cursor: "pointer" },
  caret: { position: "absolute", right: 4, top: 10, pointerEvents: "none", color: INK_SOFT },
  divider: { height: 1, background: INK, margin: "18px 0 4px" },
  sectionLabel: { fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: INK, display: "inline-block" },
  attachBtn: { fontFamily: mono, fontSize: 12, background: PAPER_DK, border: `1.5px solid ${INK}`, borderRadius: 6, padding: "8px 10px", cursor: "pointer", whiteSpace: "nowrap" },
  garBox: { border: `1.5px solid ${RULE}`, borderRadius: 8, padding: "10px 12px", marginTop: 10 },
  garActions: { display: "flex", gap: 8, marginTop: 8 },
  delBtn: { fontFamily: mono, fontSize: 12, background: "transparent", border: `1.5px solid ${RED}`, color: RED, borderRadius: 6, padding: "6px 10px", cursor: "pointer" },
  addBtn: { fontFamily: mono, fontSize: 13, background: "transparent", border: `1.5px dashed ${INK}`, borderRadius: 8, padding: "10px", cursor: "pointer", width: "100%", marginTop: 10 },
  checkRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, cursor: "pointer" },
  error: { marginTop: 14, color: RED, fontFamily: mono, fontSize: 13, fontWeight: 600 },
  actions: { display: "flex", gap: 12, marginTop: 18 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  btnGhost: { background: "transparent", color: INK, border: `1.5px solid ${INK}` },
  aviso: { marginTop: 14, fontFamily: sans, fontSize: 13, color: GREEN, background: "rgba(63,107,58,.08)", border: `1px solid ${GREEN}`, borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 },
};
