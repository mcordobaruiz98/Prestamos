import React, { useState, useMemo, useRef } from "react";

/*
  LIBRO DE PRÉSTAMOS — Rebuild limpio, pantalla por pantalla.
  PANTALLA 5: Inicio (Cobros de hoy / Clientes / Expedientes) + Respaldo.
  Trae clientes de ejemplo con fechas relativas a HOY para revisar los tres cubos.
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
const diaISO = (off) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const cuotaFija = (P, i, n) => (i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
const esArr = (t) => t === "Arriendo";
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const waLink = (tel, texto) => { let num = (tel || "").replace(/[^\d]/g, ""); if (num.length === 10) num = "57" + num; return (num ? `https://wa.me/${num}` : "https://wa.me/") + `?text=${encodeURIComponent(texto)}`; };

function derivarCuadro(exp) {
  const n = exp.plazo; const fechas = {};
  for (let k = 1; k <= n; k++) fechas[k] = addMonths(exp.fechaPrimeraCuota, k - 1);
  if (esArr(exp.tipoCredito)) { const filas = [{ n: 0 }]; for (let k = 1; k <= n; k++) filas.push({ n: k, fecha: fechas[k], valor: exp.valor }); return { filas }; }
  const P = exp.valor, i = exp.tasa / 100;
  let saldo = P, cuota = cuotaFija(P, i, n); const filas = [{ n: 0 }];
  for (let k = 1; k <= n; k++) { const interes = saldo * i; let amort = cuota - interes, cuotaK = cuota; if (k === n) { amort = saldo; cuotaK = interes + amort; saldo = 0; } else saldo -= amort; filas.push({ n: k, fecha: fechas[k], valor: cuotaK }); }
  return { filas };
}
const pagosDe = (exp, k) => (exp.pagos && exp.pagos[k]) || [];
const pagadoDe = (exp, k) => pagosDe(exp, k).reduce((s, p) => s + Number(p.monto), 0);
function recargoDe(exp, fila) { if (!exp.mora || !exp.mora.activa) return 0; const pg = pagadoDe(exp, fila.n); if (pg >= fila.valor - 0.5) return 0; return midnight(fila.fecha) < midnight(new Date()) ? Number(exp.mora.valor) || 0 : 0; }
const totalDe = (exp, fila) => fila.valor + recargoDe(exp, fila);
function estadoDe(exp, fila) { const total = totalDe(exp, fila), pg = pagadoDe(exp, fila.n); if (fila.valor > 0 && pg >= total - 0.5) return "PAGADA"; if (pg > 0) return "PARCIAL"; return midnight(fila.fecha) < midnight(new Date()) ? "VENCIDA" : "PENDIENTE"; }
function resumen(exp) { const { filas } = derivarCuadro(exp); let porCobrar = 0, ab = 0, enMora = 0; for (const f of filas) { if (f.n === 0) continue; const pg = pagadoDe(exp, f.n), t = totalDe(exp, f); ab += Math.min(pg, t); porCobrar += Math.max(0, t - pg); if (estadoDe(exp, f) === "VENCIDA") enMora++; } return { porCobrar, abonado: ab + (exp.abonosCapital || []).reduce((s, a) => s + Number(a.monto), 0), enMora }; }
function pagoATiempo(exp, fila) { const ps = [...pagosDe(exp, fila.n)].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)); let acc = 0, fc = null; for (const p of ps) { acc += Number(p.monto); if (acc >= fila.valor - 0.5) { fc = p.fecha; break; } } if (fc == null) return null; return midnight(parseISO(fc)) <= midnight(fila.fecha) ? "atiempo" : "tarde"; }
function cobros(exps) { const hoy = midnight(new Date()); const items = []; for (const e of exps) { const { filas } = derivarCuadro(e); for (const f of filas) { if (f.n < 1) continue; if (estadoDe(e, f) === "PAGADA") continue; const falta = Math.max(0, totalDe(e, f) - pagadoDe(e, f.n)); if (falta <= 0) continue; const dias = Math.round((midnight(f.fecha) - hoy) / 86400000); items.push({ e, f, falta, dias, fecha: f.fecha, est: estadoDe(e, f) }); } } return items; }
function agrupa(exps) { const m = new Map(); for (const e of exps) { const key = e.docDeudor && e.docDeudor.trim() ? "d:" + e.docDeudor.trim() : "n:" + norm(e.nombreDeudor); if (!m.has(key)) m.set(key, { key, nombre: e.nombreDeudor, doc: e.docDeudor, telefono: e.telefono, loans: [] }); m.get(key).loans.push(e); } return [...m.values()]; }
function statsCli(c) { let porCobrar = 0, enMora = 0, aTiempo = 0, tarde = 0; for (const e of c.loans) { const r = resumen(e); porCobrar += r.porCobrar; enMora += r.enMora; const { filas } = derivarCuadro(e); for (const f of filas) { if (f.n < 1) continue; const t = pagoATiempo(e, f); if (t === "atiempo") aTiempo++; else if (t === "tarde") tarde++; } } return { porCobrar, enMora, aTiempo, tarde, nLoans: c.loans.length }; }
function badgeRecord(st) { if (st.enMora > 0) return { txt: "En mora", s: { color: RED, borderColor: RED } }; if (st.aTiempo + st.tarde === 0) return { txt: "Sin historial", s: { color: INK_SOFT, borderColor: INK_SOFT } }; if (st.tarde === 0) return { txt: "Buen pagador", s: { color: GREEN, borderColor: GREEN } }; return { txt: "Paga con atrasos", s: { color: AMBER, borderColor: AMBER } }; }

function seed() {
  return [
    { id: 1, tipoCredito: "Hipoteca", valor: 10000000, tasa: 2, plazo: 36, fechaPrimeraCuota: diaISO(-40), nombreDeudor: "José Martínez", docDeudor: "72.145.980", telefono: "3001234567", garantias: [{ tipo: "Inmueble", folio: "050-123456", desc: "Casa lote 5" }], fiador: { nombre: "Ana Ríos", doc: "45.998.112" }, mora: { activa: true, valor: 20000 }, pagos: { 1: [{ monto: 392328, fecha: diaISO(-40) }] }, abonosCapital: [] },
    { id: 2, tipoCredito: "Letra de cambio", valor: 500000, tasa: 10, plazo: 3, fechaPrimeraCuota: diaISO(-8), nombreDeudor: "José Martínez", docDeudor: "72.145.980", telefono: "3001234567", garantias: [], fiador: null, mora: { activa: false, valor: 0 }, pagos: {}, abonosCapital: [] },
    { id: 3, tipoCredito: "Letra de cambio", valor: 2000000, tasa: 5, plazo: 6, fechaPrimeraCuota: diaISO(0), nombreDeudor: "María López", docDeudor: "41.222.333", telefono: "3109876543", garantias: [], fiador: null, mora: { activa: false, valor: 0 }, pagos: {}, abonosCapital: [] },
    { id: 4, tipoCredito: "Empeño", valor: 1000000, tasa: 8, plazo: 4, fechaPrimeraCuota: diaISO(5), nombreDeudor: "Pedro Gómez", docDeudor: "15.888.777", telefono: "3155551122", garantias: [{ tipo: "Prenda / objeto", folio: "", desc: "Anillo de oro 18k" }], fiador: null, mora: { activa: false, valor: 0 }, pagos: {}, abonosCapital: [] },
  ];
}

export default function Pantalla5Inicio() {
  const [expedientes, setExpedientes] = useState(seed);
  const [tab, setTab] = useState("cobros");
  const [query, setQuery] = useState("");
  const [cobro, setCobro] = useState(null);
  const [cobroMonto, setCobroMonto] = useState(0);
  const [cobroFecha, setCobroFecha] = useState(hoyISO());
  const [recibo, setRecibo] = useState(null);
  const [respaldoOpen, setRespaldoOpen] = useState(false);
  const [respaldoMsg, setRespaldoMsg] = useState("");
  const [aviso, setAviso] = useState("");
  const fileRef = useRef(null);

  const registrarCobro = (expId, n, monto, fecha) => {
    monto = Number(monto) || 0; if (monto <= 0) return;
    const e = expedientes.find((x) => x.id === expId); if (!e) return;
    const pagos = { ...(e.pagos || {}) }; pagos[n] = [...(pagos[n] || []), { monto, fecha }];
    const next = { ...e, pagos }; setExpedientes((prev) => prev.map((x) => (x.id === expId ? next : x)));
    const fila = derivarCuadro(next).filas.find((f) => f.n === n);
    setRecibo({ nombre: e.nombreDeudor, tipo: e.tipoCredito, telefono: e.telefono, n, monto, fecha, faltaDespues: Math.max(0, totalDe(next, fila) - pagadoDe(next, n)), porCobrar: resumen(next).porCobrar });
  };
  const abrirCobro = (e, f) => { const falta = Math.max(0, totalDe(e, f) - pagadoDe(e, f.n)); setCobro({ expId: e.id, n: f.n }); setCobroMonto(Math.round(falta)); setCobroFecha(hoyISO()); };
  const msgRec = (it) => { const c = esArr(it.e.tipoCredito) ? "canon" : "cuota"; return it.dias < 0 ? `Hola ${it.e.nombreDeudor}, le recordamos que su ${c} N° ${it.f.n} por ${fmtCOP(it.falta)} está pendiente desde el ${fmtFecha(it.fecha)}. ¡Gracias!` : `Hola ${it.e.nombreDeudor}, le recordamos su ${c} N° ${it.f.n} por ${fmtCOP(it.falta)} con vencimiento el ${fmtFecha(it.fecha)}. ¡Gracias!`; };
  const textoRecibo = (r) => `*Recibo de pago*\n${r.nombre}\n${r.tipo} — Cuota N° ${r.n}\nValor recibido: ${fmtCOP(r.monto)}\nFecha: ${fmtFecha(r.fecha)}\n${r.faltaDespues > 0 ? `Falta de esta cuota: ${fmtCOP(r.faltaDespues)}` : "Cuota PAGADA ✓"}`;
  const exportar = () => { const data = { app: "Libro de Préstamos", fecha: new Date().toISOString(), expedientes }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `libro-respaldo-${hoyISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setRespaldoMsg("Respaldo descargado. Guárdalo en tu Drive o envíatelo por WhatsApp."); };
  const importar = (file) => { if (!file) return; const rd = new FileReader(); rd.onload = () => { try { const d = JSON.parse(rd.result); const arr = Array.isArray(d) ? d : d.expedientes; if (!Array.isArray(arr)) throw 0; setExpedientes(arr); setRespaldoMsg(`Restaurado: ${arr.length} expediente(s).`); } catch (e) { setRespaldoMsg("No se pudo leer el archivo."); } }; rd.readAsText(file); };

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}>
          <span style={S.headerTitle}>Libro de Préstamos</span>
          <button style={S.respaldoBtn} onClick={() => { setRespaldoMsg(""); setRespaldoOpen(true); }}>Respaldo</button>
        </div>

        <div style={S.body}>
          <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginBottom: 16 }} onClick={() => setAviso("nuevo")}>+ Nuevo</button>
          {aviso === "nuevo" && <div style={S.aviso}>✓ En la app, esto abre la <b>Calculadora</b> (pantalla 1).</div>}

          <div style={S.tabs}>{["cobros", "clientes", "expedientes"].map((t) => <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }} onClick={() => { setTab(t); setQuery(""); }}>{t === "cobros" ? "Cobros" : t === "clientes" ? "Clientes" : "Expedientes"}</button>)}</div>

          {tab === "cobros" && (() => {
            const items = cobros(expedientes);
            const atr = items.filter((i) => i.dias < 0).sort((a, b) => a.fecha - b.fecha);
            const hoy = items.filter((i) => i.dias === 0);
            const prox = items.filter((i) => i.dias > 0 && i.dias <= 7).sort((a, b) => a.fecha - b.fecha);
            const tA = atr.reduce((s, i) => s + i.falta, 0), tH = hoy.reduce((s, i) => s + i.falta, 0);
            const Item = ({ it, u }) => (
              <div style={{ ...S.cobroCard, borderLeftColor: u === "a" ? RED : u === "h" ? AMBER : RULE }}>
                <div style={S.cobroTop}><span style={S.cobroName}>{it.e.nombreDeudor}</span><span style={S.cobroMonto}>{fmtCOP(it.falta)}</span></div>
                <div style={S.cobroMeta}>{it.e.tipoCredito} · {esArr(it.e.tipoCredito) ? "Canon" : "Cuota"} N° {it.f.n} · vence {fmtFecha(it.fecha)}{it.dias < 0 && <span style={{ color: RED, fontWeight: 700 }}> · hace {Math.abs(it.dias)}d</span>}{it.dias === 0 && <span style={{ color: AMBER, fontWeight: 700 }}> · HOY</span>}{it.est === "PARCIAL" && <span style={{ color: BLUE, fontWeight: 700 }}> · abono pendiente</span>}</div>
                <div style={S.cobroActions}><button style={S.cobrarBtn} onClick={() => abrirCobro(it.e, it.f)}>Cobrar</button><a style={S.waBtn} href={waLink(it.e.telefono, msgRec(it))} target="_blank" rel="noopener noreferrer">WhatsApp</a></div>
              </div>
            );
            if (items.length === 0) return <div style={S.empty}><p style={S.emptyT}>Nada por cobrar. ¡Todo al día!</p></div>;
            return (<>
              <div style={S.strip}><div style={{ ...S.stripBox, borderColor: RED }}><span style={S.stripCap}>Atrasado</span><span style={{ ...S.stripVal, color: RED }}>{fmtCOP(tA)}</span><span style={S.stripSub}>{atr.length} cuota(s)</span></div><div style={{ ...S.stripBox, borderColor: AMBER }}><span style={S.stripCap}>Para hoy</span><span style={{ ...S.stripVal, color: AMBER }}>{fmtCOP(tH)}</span><span style={S.stripSub}>{hoy.length} cuota(s)</span></div></div>
              {atr.length > 0 && <><div style={{ ...S.sectionLabel, color: RED, marginTop: 16 }}>Atrasadas ({atr.length})</div>{atr.map((it, k) => <Item key={k} it={it} u="a" />)}</>}
              {hoy.length > 0 && <><div style={{ ...S.sectionLabel, color: AMBER, marginTop: 16 }}>Para hoy ({hoy.length})</div>{hoy.map((it, k) => <Item key={k} it={it} u="h" />)}</>}
              {prox.length > 0 && <><div style={{ ...S.sectionLabel, marginTop: 16 }}>Próximos 7 días ({prox.length})</div>{prox.map((it, k) => <Item key={k} it={it} u="p" />)}</>}
            </>);
          })()}

          {tab === "clientes" && (() => {
            const q = norm(query);
            const lista = agrupa(expedientes).filter((c) => !q || norm(c.nombre).includes(q) || (c.doc || "").includes(query.trim())).sort((a, b) => a.nombre.localeCompare(b.nombre));
            return (<><input style={S.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o cédula…" />
              {lista.length === 0 ? <div style={S.empty}><p style={S.emptyT}>Sin resultados.</p></div> : lista.map((c) => { const st = statsCli(c); const b = badgeRecord(st); return (
                <div key={c.key} style={S.expCard}><div style={S.expTop}><span style={S.expName}>{c.nombre}</span><span style={{ ...S.badge, ...b.s }}>{b.txt}</span></div><div style={S.expMeta}>{c.doc ? `CC ${c.doc} · ` : ""}{st.nLoans} préstamo(s)</div><div style={S.expMeta}>Por cobrar: <b>{fmtCOP(st.porCobrar)}</b></div></div>); })}
            </>);
          })()}

          {tab === "expedientes" && (() => {
            const q = norm(query);
            const lista = expedientes.filter((e) => !q || norm(e.nombreDeudor).includes(q) || (e.docDeudor || "").includes(query.trim()));
            return (<><input style={S.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o cédula…" />
              {lista.map((e) => { const r = resumen(e); return (<div key={e.id} style={S.expCard}><div style={S.expTop}><span style={S.expName}>{e.nombreDeudor}</span>{r.enMora > 0 ? <span style={{ ...S.badge, ...S.bVenc }}>{r.enMora} en mora</span> : <span style={{ ...S.badge, ...S.bPend }}>al día</span>}</div><div style={S.expMeta}>{e.tipoCredito} · {fmtCOP(e.valor)}{esArr(e.tipoCredito) ? "/mes" : ""} · {e.plazo} {esArr(e.tipoCredito) ? "meses" : "cuotas"}</div><div style={S.expMeta}>Por cobrar: <b>{fmtCOP(r.porCobrar)}</b></div></div>); })}
            </>);
          })()}
        </div>

        {/* Cobro */}
        {cobro && (() => { const e = expedientes.find((x) => x.id === cobro.expId); const f = derivarCuadro(e).filas.find((x) => x.n === cobro.n); const falta = Math.max(0, totalDe(e, f) - pagadoDe(e, f.n));
          return (<div style={S.overlay} onClick={() => setCobro(null)}><div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
            <div style={S.panelTitle}>Cobrar — {e.nombreDeudor}</div>
            <div style={S.panelMeta}>{esArr(e.tipoCredito) ? "Canon" : "Cuota"} N° {f.n} · vence {fmtFecha(f.fecha)} · falta {fmtCOP(falta)}</div>
            <div style={S.twoCol}><div style={{ flex: 1 }}><label style={S.lbl}>Monto que paga</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(cobroMonto)} onChange={(ev) => setCobroMonto(parseInt(ev.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div><div style={{ flex: 1 }}><label style={S.lbl}>Fecha</label><input type="date" style={S.input} value={cobroFecha} onChange={(ev) => setCobroFecha(ev.target.value)} /></div></div>
            <div style={S.hint}>{Number(cobroMonto) >= falta ? "Queda PAGADA." : `Abono parcial · quedará debiendo ${fmtCOP(falta - Number(cobroMonto))}.`}</div>
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setCobro(null)}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { registrarCobro(cobro.expId, cobro.n, cobroMonto, cobroFecha); setCobro(null); }}>Registrar</button></div>
          </div></div>); })()}

        {/* Recibo */}
        {recibo && (<div style={S.overlay} onClick={() => setRecibo(null)}><div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
          <div style={S.reciboStamp}>Recibo de pago</div>
          <div style={S.reciboBody}><div style={S.reciboName}>{recibo.nombre}</div><div style={S.reciboLine}>{recibo.tipo} — Cuota N° {recibo.n}</div><div style={S.reciboBig}>{fmtCOP(recibo.monto)}</div><div style={S.reciboLine}>Fecha: {fmtFecha(recibo.fecha)}</div><div style={{ ...S.reciboLine, color: recibo.faltaDespues > 0 ? RED : GREEN, fontWeight: 700 }}>{recibo.faltaDespues > 0 ? `Falta de esta cuota: ${fmtCOP(recibo.faltaDespues)}` : "Cuota PAGADA ✓"}</div><div style={S.reciboLine}>Saldo por cobrar: {fmtCOP(recibo.porCobrar)}</div></div>
          <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setRecibo(null)}>Cerrar</button><a style={{ ...S.btn, ...S.btnWa, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }} href={waLink(recibo.telefono, textoRecibo(recibo))} target="_blank" rel="noopener noreferrer">Compartir recibo</a></div>
        </div></div>)}

        {/* Respaldo */}
        {respaldoOpen && (<div style={S.overlay} onClick={() => setRespaldoOpen(false)}><div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
          <div style={S.panelTitle}>Respaldo de datos</div>
          <p style={S.respaldoExpl}>Descarga un archivo con toda tu información y guárdalo en tu Google Drive (o envíatelo por WhatsApp). Si pierdes el celular, lo restauras en otro equipo y recuperas todo.</p>
          <div style={S.actions}><button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={exportar}>Descargar respaldo</button></div>
          <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={() => fileRef.current && fileRef.current.click()}>Restaurar desde archivo</button></div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { importar(e.target.files[0]); e.target.value = ""; }} />
          <div style={S.respaldoWarn}>Restaurar reemplaza los datos actuales por los del archivo.</div>
          {respaldoMsg && <div style={S.respaldoMsg}>{respaldoMsg}</div>}
          <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={() => setRespaldoOpen(false)}>Cerrar</button></div>
        </div></div>)}
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
  phone: { width: "100%", maxWidth: 420, background: PAPER, border: `1px solid ${INK}`, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.15)", overflow: "hidden", position: "relative" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: `2px solid ${INK}`, background: PAPER_DK },
  headerTitle: { fontFamily: mono, fontWeight: 600, fontSize: 16, letterSpacing: "0.14em", textTransform: "uppercase" },
  respaldoBtn: { marginLeft: "auto", fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", background: "transparent", border: `1.5px solid ${INK}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: INK },
  body: { padding: "18px" },
  aviso: { marginTop: -6, marginBottom: 12, fontFamily: sans, fontSize: 13, color: GREEN, background: "rgba(63,107,58,.08)", border: `1px solid ${GREEN}`, borderRadius: 8, padding: "10px 12px" },
  tabs: { display: "flex", gap: 6, marginBottom: 14, background: PAPER_DK, borderRadius: 8, padding: 4 },
  tab: { flex: 1, fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", padding: "9px 4px", borderRadius: 6, border: "none", background: "transparent", color: INK_SOFT, cursor: "pointer" },
  tabOn: { background: INK, color: PAPER },
  search: { width: "100%", fontFamily: sans, fontSize: 14, color: INK, background: "#fff", border: `1.5px solid ${INK}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 },
  lbl: { display: "block", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT, margin: "6px 0 5px" },
  input: { width: "100%", fontFamily: mono, fontSize: 15, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 2px" },
  moneyRow: { display: "flex", alignItems: "baseline", gap: 6, borderBottom: `1.5px solid ${INK}`, paddingBottom: 6 },
  peso: { fontFamily: mono, fontSize: 18, fontWeight: 600, color: INK_SOFT },
  moneyInput: { flex: 1, fontFamily: mono, fontSize: 18, fontWeight: 600, color: INK, background: "transparent", border: "none", padding: "2px 0" },
  twoCol: { display: "flex", gap: 16, marginTop: 4 },
  sectionLabel: { fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: INK, display: "block" },
  empty: { textAlign: "center", padding: "40px 10px", color: INK_SOFT },
  emptyT: { fontFamily: mono, fontSize: 15, fontWeight: 600, color: INK, margin: 0 },
  strip: { display: "flex", gap: 10 },
  stripBox: { flex: 1, border: "2px solid", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 1 },
  stripCap: { fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_SOFT },
  stripVal: { fontFamily: mono, fontSize: 18, fontWeight: 700 },
  stripSub: { fontFamily: mono, fontSize: 10.5, color: INK_SOFT },
  cobroCard: { border: `1.5px solid ${RULE}`, borderLeft: "4px solid", borderRadius: 10, padding: "10px 12px", marginTop: 10, background: "#fff" },
  cobroTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cobroName: { fontFamily: sans, fontSize: 16, fontWeight: 700, color: INK },
  cobroMonto: { fontFamily: mono, fontSize: 16, fontWeight: 700, color: INK },
  cobroMeta: { fontFamily: mono, fontSize: 11.5, color: INK_SOFT, marginTop: 4 },
  cobroActions: { display: "flex", gap: 8, marginTop: 10 },
  cobrarBtn: { flex: 1, fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: INK, color: PAPER, border: "none", borderRadius: 6, padding: "9px", cursor: "pointer" },
  waBtn: { flex: 1, fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: WA, color: "#fff", border: "none", borderRadius: 6, padding: "9px", cursor: "pointer", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" },
  expCard: { display: "block", width: "100%", textAlign: "left", background: PAPER_DK, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 },
  expTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  expName: { fontFamily: sans, fontSize: 16, fontWeight: 700, color: INK },
  expMeta: { fontFamily: mono, fontSize: 12, color: INK_SOFT, marginTop: 2 },
  badge: { fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, border: "1.5px solid" },
  bVenc: { color: RED, borderColor: RED, background: "rgba(178,58,46,.08)" },
  bPend: { color: AMBER, borderColor: AMBER, background: "rgba(168,121,31,.08)" },
  actions: { display: "flex", gap: 12, marginTop: 14 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  btnGhost: { background: "transparent", color: INK, border: `1.5px solid ${INK}` },
  btnWa: { background: WA, color: "#fff", border: `1.5px solid ${WA}` },
  overlay: { position: "fixed", inset: 0, background: "rgba(30,26,20,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 360, background: PAPER, border: `2px solid ${INK}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 16px 40px rgba(0,0,0,.35)" },
  panelTitle: { fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" },
  panelMeta: { fontFamily: mono, fontSize: 11.5, color: INK_SOFT, marginTop: 3 },
  hint: { fontFamily: sans, fontSize: 12.5, color: INK, marginTop: 8, fontStyle: "italic" },
  reciboStamp: { display: "inline-block", fontFamily: mono, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: GREEN, border: `2px solid ${GREEN}`, borderRadius: 6, padding: "4px 12px", fontSize: 13, transform: "rotate(-1.5deg)" },
  reciboBody: { marginTop: 14, borderTop: `1px dashed ${INK_SOFT}`, borderBottom: `1px dashed ${INK_SOFT}`, padding: "12px 0" },
  reciboName: { fontFamily: sans, fontSize: 18, fontWeight: 700 },
  reciboLine: { fontFamily: mono, fontSize: 12.5, color: INK, marginTop: 4 },
  reciboBig: { fontFamily: mono, fontSize: 28, fontWeight: 700, margin: "8px 0 4px" },
  respaldoExpl: { fontFamily: sans, fontSize: 13, color: INK, marginTop: 12, lineHeight: 1.5 },
  respaldoWarn: { fontFamily: mono, fontSize: 10.5, color: INK_SOFT, marginTop: 10, textAlign: "center" },
  respaldoMsg: { fontFamily: sans, fontSize: 12.5, color: GREEN, marginTop: 10, fontWeight: 600, textAlign: "center" },
};
