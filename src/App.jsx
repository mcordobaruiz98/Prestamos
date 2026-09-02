import React, { useState, useMemo, useEffect, useRef } from "react";

/*
  Libro de Préstamos — prototipo funcional
  Inicio (Cobros / Clientes / Expedientes) → Calculadora → Resultado → Registrar → Expediente / Cliente
  Modos: préstamo (sistema francés) y arriendo (canon fijo).
  Extras: abono a capital, pago parcial, mora opcional, WhatsApp, recibo, búsqueda,
          historial del cliente y persistencia (window.storage).
*/

const TIPOS = ["Hipoteca", "Letra de cambio", "Empeño", "Pignoración", "Arriendo"];
const TIPOS_GARANTIA = ["Inmueble", "Vehículo", "Prenda / objeto", "Otro"];
const STORAGE_KEY = "libro_prestamos_expedientes";

// ===PERSIST_START (localStorage) ===
async function loadPersisted() {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : null; }
  catch (e) { return null; }
}
async function savePersisted(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { }
}
// ===PERSIST_END===

const PAPER = "#f6f1e4", PAPER_DK = "#ece4d0", INK = "#232019", INK_SOFT = "#6b6455";
const RULE = "#d8cdb0", RED = "#b23a2e", GREEN = "#3f6b3a", AMBER = "#a8791f", BLUE = "#2f5d7a", WA = "#1f8a4c";
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const sans = "'IBM Plex Sans', system-ui, sans-serif";

const fmtCOP = (n) => "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtNum = (n) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const parseISO = (s) => new Date(s + "T00:00:00");
const fmtFecha = (d) => (typeof d === "string" ? parseISO(d) : d).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
const hoyISO = () => new Date().toISOString().slice(0, 10);
const addMonths = (iso, k) => { const d = parseISO(typeof iso === "string" ? iso : iso.toISOString().slice(0, 10)); d.setMonth(d.getMonth() + k); return d; };
const cuotaFija = (P, i, n) => (i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
const esArr = (t) => t === "Arriendo";
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const waLink = (tel, texto) => {
  let num = (tel || "").replace(/[^\d]/g, "");
  if (num.length === 10) num = "57" + num;
  return (num ? `https://wa.me/${num}` : "https://wa.me/") + `?text=${encodeURIComponent(texto)}`;
};

function calcAmort(P, tasaPct, n) {
  P = Number(P) || 0; const i = (parseFloat(tasaPct) || 0) / 100; n = parseInt(n) || 0;
  if (P <= 0 || n <= 0) return null;
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

function derivarCuadro(exp) {
  const n = exp.plazo; const fechas = {};
  for (let k = 1; k <= n; k++) fechas[k] = addMonths(exp.fechaPrimeraCuota, k - 1);
  if (esArr(exp.tipoCredito)) {
    const filas = [{ n: 0, saldo: 0 }];
    for (let k = 1; k <= n; k++) filas.push({ n: k, fecha: fechas[k], valor: exp.valor });
    return { filas, markers: {} };
  }
  const P = exp.valor, i = exp.tasa / 100; const markers = {};
  for (const ab of exp.abonosCapital || []) {
    const abF = parseISO(ab.fecha); let p = n;
    for (let k = 1; k <= n; k++) { if (fechas[k] >= abF) { p = k; break; } }
    markers[p] = markers[p] || { monto: 0, items: [] };
    markers[p].monto += Number(ab.monto); markers[p].items.push(ab);
  }
  let saldo = P, cuota = cuotaFija(P, i, n);
  const filas = [{ n: 0, saldo: P }];
  for (let k = 1; k <= n; k++) {
    if (markers[k]) {
      saldo = Math.max(0, saldo - markers[k].monto);
      const rem = n - k + 1; cuota = saldo <= 0 ? 0 : cuotaFija(saldo, i, rem);
      markers[k].nuevaCuota = cuota; markers[k].saldoDespues = saldo;
    }
    if (saldo <= 0) { filas.push({ n: k, fecha: fechas[k], valor: 0, saldo: 0, cancelada: true }); continue; }
    const interes = saldo * i; let amort = cuota - interes, cuotaK = cuota;
    if (k === n) { amort = saldo; cuotaK = interes + amort; saldo = 0; } else { saldo -= amort; if (saldo < 0) saldo = 0; }
    filas.push({ n: k, fecha: fechas[k], valor: cuotaK, interes, abono: amort, saldo: saldo < 0.5 ? 0 : saldo });
  }
  return { filas, markers };
}

const pagosDe = (exp, k) => (exp.pagos && exp.pagos[k]) || [];
const pagadoDe = (exp, k) => pagosDe(exp, k).reduce((s, p) => s + Number(p.monto), 0);
function recargoDe(exp, fila) {
  if (!exp.mora || !exp.mora.activa || fila.cancelada) return 0;
  const pg = pagadoDe(exp, fila.n);
  if (pg >= fila.valor - 0.5) return 0;
  return midnight(fila.fecha) < midnight(new Date()) ? Number(exp.mora.valor) || 0 : 0;
}
const totalDe = (exp, fila) => fila.valor + recargoDe(exp, fila);
function estadoDe(exp, fila) {
  if (fila.cancelada) return "CANCELADA";
  const total = totalDe(exp, fila), pg = pagadoDe(exp, fila.n);
  if (fila.valor > 0 && pg >= total - 0.5) return "PAGADA";
  if (pg > 0) return "PARCIAL";
  return midnight(fila.fecha) < midnight(new Date()) ? "VENCIDA" : "PENDIENTE";
}
function resumen(exp) {
  const { filas } = derivarCuadro(exp);
  let porCobrar = 0, recCuotas = 0, enMora = 0;
  for (const f of filas) {
    if (f.n === 0 || f.cancelada) continue;
    const pg = pagadoDe(exp, f.n), total = totalDe(exp, f);
    recCuotas += Math.min(pg, total);
    porCobrar += Math.max(0, total - pg);
    if (estadoDe(exp, f) === "VENCIDA") enMora++;
  }
  const recCap = (exp.abonosCapital || []).reduce((s, a) => s + Number(a.monto), 0);
  return { porCobrar, abonado: recCuotas + recCap, enMora };
}
// ¿La cuota se completó a tiempo? 'atiempo' | 'tarde' | null (no pagada)
function pagoATiempo(exp, fila) {
  if (fila.cancelada) return null;
  const pagos = [...pagosDe(exp, fila.n)].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  let acc = 0, fc = null;
  for (const p of pagos) { acc += Number(p.monto); if (acc >= fila.valor - 0.5) { fc = p.fecha; break; } }
  if (fc == null) return null;
  return midnight(parseISO(fc)) <= midnight(fila.fecha) ? "atiempo" : "tarde";
}

function cobros(expedientes) {
  const hoy = midnight(new Date()); const items = [];
  for (const e of expedientes) {
    const { filas } = derivarCuadro(e);
    for (const f of filas) {
      if (f.n < 1 || f.cancelada) continue;
      if (estadoDe(e, f) === "PAGADA") continue;
      const falta = Math.max(0, totalDe(e, f) - pagadoDe(e, f.n));
      if (falta <= 0) continue;
      const dias = Math.round((midnight(f.fecha) - hoy) / 86400000);
      items.push({ e, f, falta, dias, fecha: f.fecha, est: estadoDe(e, f) });
    }
  }
  return items;
}
// Agrupa expedientes por cliente (cédula si existe, si no por nombre)
function agrupaClientes(expedientes) {
  const map = new Map();
  for (const e of expedientes) {
    const key = e.docDeudor && e.docDeudor.trim() ? "d:" + e.docDeudor.trim() : "n:" + norm(e.nombreDeudor);
    if (!map.has(key)) map.set(key, { key, nombre: e.nombreDeudor, doc: e.docDeudor, telefono: e.telefono, loans: [] });
    map.get(key).loans.push(e);
  }
  return [...map.values()];
}
function statsCliente(cli) {
  let porCobrar = 0, enMora = 0, aTiempo = 0, tarde = 0, prestado = 0, cobrado = 0;
  for (const e of cli.loans) {
    const res = resumen(e); porCobrar += res.porCobrar; enMora += res.enMora; cobrado += res.abonado;
    prestado += esArr(e.tipoCredito) ? 0 : e.valor;
    const { filas } = derivarCuadro(e);
    for (const f of filas) { if (f.n < 1) continue; const t = pagoATiempo(e, f); if (t === "atiempo") aTiempo++; else if (t === "tarde") tarde++; }
  }
  return { porCobrar, enMora, aTiempo, tarde, prestado, cobrado, nLoans: cli.loans.length };
}
function badgeRecord(st) {
  if (st.enMora > 0) return { txt: "En mora", s: { color: RED, borderColor: RED } };
  if (st.aTiempo + st.tarde === 0) return { txt: "Sin historial", s: { color: INK_SOFT, borderColor: INK_SOFT } };
  if (st.tarde === 0) return { txt: "Buen pagador", s: { color: GREEN, borderColor: GREEN } };
  return { txt: "Paga con atrasos", s: { color: AMBER, borderColor: AMBER } };
}

export default function LibroDePrestamos() {
  const [screen, setScreen] = useState("home");
  const [homeTab, setHomeTab] = useState("cobros");
  const [expedientes, setExpedientes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [respaldoOpen, setRespaldoOpen] = useState(false);
  const [respaldoMsg, setRespaldoMsg] = useState("");
  const fileRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [activeCli, setActiveCli] = useState(null);
  const [expOrigin, setExpOrigin] = useState("home");
  const [query, setQuery] = useState("");

  const [tipoCredito, setTipoCredito] = useState("Hipoteca");
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [valor, setValor] = useState(10000000);
  const [tasa, setTasa] = useState("2");
  const [plazo, setPlazo] = useState("36");
  const [moraActiva, setMoraActiva] = useState(false);
  const [moraValor, setMoraValor] = useState(0);

  const [nombreDeudor, setNombreDeudor] = useState("");
  const [docDeudor, setDocDeudor] = useState("");
  const [telefono, setTelefono] = useState("");
  const [garantias, setGarantias] = useState([{ tipo: "Inmueble", folio: "", desc: "" }]);
  const [fiadorOn, setFiadorOn] = useState(false);
  const [fiadorNombre, setFiadorNombre] = useState("");
  const [fiadorDoc, setFiadorDoc] = useState("");
  const [fechaPrimeraCuota, setFechaPrimeraCuota] = useState("");
  const [errorReg, setErrorReg] = useState("");

  const [pagoOpen, setPagoOpen] = useState(null);
  const [pagoMonto, setPagoMonto] = useState(0);
  const [pagoFecha, setPagoFecha] = useState(hoyISO());
  const [abonoMonto, setAbonoMonto] = useState(0);
  const [abonoFecha, setAbonoFecha] = useState(hoyISO());
  const [abonoOpen, setAbonoOpen] = useState(false);

  const [cobro, setCobro] = useState(null);
  const [cobroMonto, setCobroMonto] = useState(0);
  const [cobroFecha, setCobroFecha] = useState(hoyISO());
  const [recibo, setRecibo] = useState(null);

  // ---- Persistencia ----
  useEffect(() => {
    (async () => {
      const d = await loadPersisted();
      if (d) { setExpedientes(d.expedientes || []); setLastBackup(d.lastBackup || null); }
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    savePersisted({ expedientes, lastBackup });
  }, [expedientes, lastBackup, loaded]);

  const arr = esArr(tipoCredito);
  const r = useMemo(() => {
    if (arr) { const canon = Number(valor) || 0, n = parseInt(plazo) || 0; if (canon <= 0 || n <= 0) return null; return { esArriendo: true, cuota: canon, total: canon * n, n }; }
    return calcAmort(valor, tasa, plazo);
  }, [arr, valor, tasa, plazo]);

  const activeExp = expedientes.find((e) => e.id === activeId) || null;
  const cuadro = useMemo(() => (activeExp ? derivarCuadro(activeExp) : null), [activeExp]);
  const activeArr = activeExp ? esArr(activeExp.tipoCredito) : false;
  const clienteActivo = useMemo(() => (activeCli ? agrupaClientes(expedientes).find((c) => c.key === activeCli) : null), [activeCli, expedientes]);

  const nuevoPrestamo = () => {
    setTipoCredito("Hipoteca"); setValor(10000000); setTasa("2"); setPlazo("36"); setFechaInicio(hoyISO());
    setMoraActiva(false); setMoraValor(0); setScreen("calc");
  };
  const irRegistrar = () => {
    setNombreDeudor(""); setDocDeudor(""); setTelefono(""); setGarantias([{ tipo: "Inmueble", folio: "", desc: "" }]);
    setFiadorOn(false); setFiadorNombre(""); setFiadorDoc("");
    setFechaPrimeraCuota(addMonths(fechaInicio, 1).toISOString().slice(0, 10));
    setErrorReg(""); setScreen("register");
  };
  const confirmarRegistro = () => {
    if (!nombreDeudor.trim()) { setErrorReg("Falta el nombre del deudor."); return; }
    const a = arr ? null : calcAmort(valor, tasa, plazo);
    const exp = {
      id: Date.now(), tipoCredito, valor: Number(valor), tasa, plazo: Number(plazo),
      fechaInicio, fechaPrimeraCuota, nombreDeudor: nombreDeudor.trim(), docDeudor: docDeudor.trim(), telefono: telefono.trim(),
      garantias: garantias.filter((g) => g.folio || g.desc),
      fiador: fiadorOn && fiadorNombre.trim() ? { nombre: fiadorNombre.trim(), doc: fiadorDoc.trim() } : null,
      cuota: arr ? Number(valor) : a.cuota, totalPagar: arr ? Number(valor) * Number(plazo) : a.totalPagar,
      ganancia: arr ? 0 : a.ganancia, pct: arr ? 0 : a.pct,
      mora: { activa: moraActiva, valor: Number(moraValor) || 0 }, pagos: {}, abonosCapital: [],
    };
    setExpedientes((p) => [exp, ...p]); setActiveId(exp.id); setExpOrigin("home"); setScreen("expediente");
  };

  const registrarCobro = (expId, n, monto, fecha) => {
    monto = Number(monto) || 0; if (monto <= 0) return;
    const e = expedientes.find((x) => x.id === expId); if (!e) return;
    const pagos = { ...(e.pagos || {}) }; pagos[n] = [...(pagos[n] || []), { monto, fecha }];
    const next = { ...e, pagos };
    setExpedientes((prev) => prev.map((x) => (x.id === expId ? next : x)));
    const fila = derivarCuadro(next).filas.find((f) => f.n === n);
    const faltaDespues = Math.max(0, totalDe(next, fila) - pagadoDe(next, n));
    setRecibo({ nombre: e.nombreDeudor, tipo: e.tipoCredito, telefono: e.telefono, n, monto, fecha, faltaDespues, porCobrar: resumen(next).porCobrar });
  };
  const limpiarCuota = (n) => setExpedientes((prev) => prev.map((e) => { if (e.id !== activeExp.id) return e; const pagos = { ...(e.pagos || {}) }; delete pagos[n]; return { ...e, pagos }; }));
  const agregarAbono = () => {
    const monto = Number(abonoMonto) || 0; if (monto <= 0) return;
    setExpedientes((prev) => prev.map((e) => e.id !== activeExp.id ? e : { ...e, abonosCapital: [...(e.abonosCapital || []), { id: Date.now(), monto, fecha: abonoFecha }] }));
    setAbonoMonto(0); setAbonoFecha(hoyISO()); setAbonoOpen(false);
  };
  const quitarAbono = (id) => setExpedientes((prev) => prev.map((e) => e.id !== activeExp.id ? e : { ...e, abonosCapital: (e.abonosCapital || []).filter((a) => a.id !== id) }));

  const exportar = () => {
    const data = { app: "Libro de Préstamos prueba", version: 1, fecha: new Date().toISOString(), expedientes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `libro-respaldo-${hoyISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLastBackup(hoyISO());
    setRespaldoMsg("Respaldo descargado. Guárdalo en tu Drive o envíatelo por WhatsApp.");
  };
  const importar = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const arr = Array.isArray(data) ? data : data.expedientes;
        if (!Array.isArray(arr)) throw new Error("bad");
        setExpedientes(arr);
        setRespaldoMsg(`Restaurado: ${arr.length} expediente(s).`);
      } catch (e) { setRespaldoMsg("No se pudo leer el archivo. ¿Es un respaldo válido?"); }
    };
    reader.readAsText(file);
  };
  const diasSinRespaldo = lastBackup ? Math.round((midnight(new Date()) - midnight(parseISO(lastBackup))) / 86400000) : null;
  const respaldoPendiente = expedientes.length > 0 && (lastBackup == null || diasSinRespaldo > 7);

  const onValor = (e) => { const d = e.target.value.replace(/[^\d]/g, ""); setValor(d ? parseInt(d) : 0); };
  const setGar = (i, k, v) => setGarantias((g) => g.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const abrirCobro = (e, f) => { const falta = Math.max(0, totalDe(e, f) - pagadoDe(e, f.n)); setCobro({ expId: e.id, n: f.n }); setCobroMonto(Math.round(falta)); setCobroFecha(hoyISO()); };
  const abrirExpediente = (id, origin = "home") => { setActiveId(id); setExpOrigin(origin); setPagoOpen(null); setAbonoOpen(false); setScreen("expediente"); };
  const abrirCliente = (key) => { setActiveCli(key); setScreen("cliente"); };

  const backTarget = () => screen === "expediente" ? (expOrigin === "cliente" ? "cliente" : "home") : screen === "cliente" ? "home" : screen === "register" ? "result" : screen === "result" ? "calc" : "home";

  const msgRecordatorio = (it) => {
    const cuota = esArr(it.e.tipoCredito) ? "canon" : "cuota";
    return it.dias < 0
      ? `Hola ${it.e.nombreDeudor}, le recordamos que su ${cuota} N° ${it.f.n} por ${fmtCOP(it.falta)} está pendiente desde el ${fmtFecha(it.fecha)}. Quedamos atentos. ¡Gracias!`
      : `Hola ${it.e.nombreDeudor}, le recordamos su ${cuota} N° ${it.f.n} por ${fmtCOP(it.falta)} con vencimiento el ${fmtFecha(it.fecha)}. ¡Gracias!`;
  };
  const textoRecibo = (r) => `*Recibo de pago*\n${r.nombre}\n${r.tipo} — Cuota N° ${r.n}\nValor recibido: ${fmtCOP(r.monto)}\nFecha: ${fmtFecha(r.fecha)}\n${r.faltaDespues > 0 ? `Falta de esta cuota: ${fmtCOP(r.faltaDespues)}` : "Cuota PAGADA ✓"}\nSaldo del préstamo por cobrar: ${fmtCOP(r.porCobrar)}`;

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}>
          {screen !== "home" && <button style={S.back} onClick={() => { setPagoOpen(null); setAbonoOpen(false); setScreen(backTarget()); }} aria-label="Volver">←</button>}
          <span style={S.headerTitle}>{screen === "home" ? "Libro de Préstamos" : (screen === "calc" || screen === "result") ? "Calculadora" : screen === "register" ? "Registrar" : screen === "cliente" ? "Cliente" : "Expediente"}</span>
          {screen === "home" && <button style={S.respaldoBtn} onClick={() => { setRespaldoMsg(""); setRespaldoOpen(true); }}>Respaldo{respaldoPendiente && <span style={S.dot} />}</button>}
        </div>

        {/* ===== INICIO ===== */}
        {screen === "home" && (
          <div style={S.body}>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginBottom: 16 }} onClick={nuevoPrestamo}>+ Nuevo</button>
            <div style={S.tabs}>
              {["cobros", "clientes", "expedientes"].map((t) => (
                <button key={t} style={{ ...S.tab, ...(homeTab === t ? S.tabOn : {}) }} onClick={() => { setHomeTab(t); setQuery(""); }}>{t === "cobros" ? "Cobros" : t === "clientes" ? "Clientes" : "Expedientes"}</button>
              ))}
            </div>

            {homeTab === "cobros" && (() => {
              const items = cobros(expedientes);
              const atrasadas = items.filter((i) => i.dias < 0).sort((a, b) => a.fecha - b.fecha);
              const deHoy = items.filter((i) => i.dias === 0);
              const proximas = items.filter((i) => i.dias > 0 && i.dias <= 7).sort((a, b) => a.fecha - b.fecha);
              const totalAtraso = atrasadas.reduce((s, i) => s + i.falta, 0);
              const totalHoy = deHoy.reduce((s, i) => s + i.falta, 0);
              const Item = ({ it, urg }) => (
                <div style={{ ...S.cobroCard, borderLeftColor: urg === "atraso" ? RED : urg === "hoy" ? AMBER : RULE }}>
                  <div style={S.cobroTop}><span style={S.cobroName} onClick={() => abrirExpediente(it.e.id, "home")}>{it.e.nombreDeudor}</span><span style={S.cobroMonto}>{fmtCOP(it.falta)}</span></div>
                  <div style={S.cobroMeta}>{it.e.tipoCredito} · {esArr(it.e.tipoCredito) ? "Canon" : "Cuota"} N° {it.f.n} · vence {fmtFecha(it.fecha)}{it.dias < 0 && <span style={{ color: RED, fontWeight: 700 }}> · hace {Math.abs(it.dias)}d</span>}{it.dias === 0 && <span style={{ color: AMBER, fontWeight: 700 }}> · HOY</span>}{it.est === "PARCIAL" && <span style={{ color: BLUE, fontWeight: 700 }}> · abono pendiente</span>}</div>
                  <div style={S.cobroActions}><button style={S.cobrarBtn} onClick={() => abrirCobro(it.e, it.f)}>Cobrar</button><a style={S.waBtn} href={waLink(it.e.telefono, msgRecordatorio(it))} target="_blank" rel="noopener noreferrer">WhatsApp</a></div>
                </div>
              );
              if (items.length === 0) return (<div style={S.empty}><p style={S.emptyT}>{expedientes.length === 0 ? "Aún no hay préstamos." : "Nada por cobrar. ¡Todo al día!"}</p><p style={S.emptyS}>{expedientes.length === 0 ? "Toca “Nuevo” para registrar el primero." : ""}</p></div>);
              return (<>
                <div style={S.cobroStrip}>
                  <div style={{ ...S.stripBox, borderColor: RED }}><span style={S.stripCap}>Atrasado</span><span style={{ ...S.stripVal, color: RED }}>{fmtCOP(totalAtraso)}</span><span style={S.stripSub}>{atrasadas.length} cuota(s)</span></div>
                  <div style={{ ...S.stripBox, borderColor: AMBER }}><span style={S.stripCap}>Para hoy</span><span style={{ ...S.stripVal, color: AMBER }}>{fmtCOP(totalHoy)}</span><span style={S.stripSub}>{deHoy.length} cuota(s)</span></div>
                </div>
                {atrasadas.length > 0 && <><div style={{ ...S.sectionLabel, color: RED, marginTop: 16 }}>Atrasadas ({atrasadas.length})</div>{atrasadas.map((it, k) => <Item key={k} it={it} urg="atraso" />)}</>}
                {deHoy.length > 0 && <><div style={{ ...S.sectionLabel, color: AMBER, marginTop: 16 }}>Para hoy ({deHoy.length})</div>{deHoy.map((it, k) => <Item key={k} it={it} urg="hoy" />)}</>}
                {proximas.length > 0 && <><div style={{ ...S.sectionLabel, marginTop: 16 }}>Próximos 7 días ({proximas.length})</div>{proximas.map((it, k) => <Item key={k} it={it} urg="prox" />)}</>}
              </>);
            })()}

            {homeTab === "clientes" && (() => {
              const q = norm(query);
              const lista = agrupaClientes(expedientes).filter((c) => !q || norm(c.nombre).includes(q) || (c.doc || "").includes(query.trim())).sort((a, b) => a.nombre.localeCompare(b.nombre));
              return (<>
                <input style={S.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente por nombre o cédula…" />
                {lista.length === 0 ? <div style={S.empty}><p style={S.emptyT}>{expedientes.length === 0 ? "Aún no hay clientes." : "Sin resultados."}</p></div>
                  : lista.map((c) => { const st = statsCliente(c); const b = badgeRecord(st); return (
                    <div key={c.key} style={S.expCard} onClick={() => abrirCliente(c.key)}>
                      <div style={S.expTop}><span style={S.expName}>{c.nombre}</span><span style={{ ...S.badge, ...b.s }}>{b.txt}</span></div>
                      <div style={S.expMeta}>{c.doc ? `CC ${c.doc} · ` : ""}{st.nLoans} préstamo(s)</div>
                      <div style={S.expMeta}>Por cobrar: <b>{fmtCOP(st.porCobrar)}</b></div>
                    </div>); })}
              </>);
            })()}

            {homeTab === "expedientes" && (() => {
              const q = norm(query);
              const lista = expedientes.filter((e) => !q || norm(e.nombreDeudor).includes(q) || (e.docDeudor || "").includes(query.trim()));
              return (<>
                <input style={S.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o cédula…" />
                {lista.length === 0 ? <div style={S.empty}><p style={S.emptyT}>{expedientes.length === 0 ? "Aún no hay expedientes." : "Sin resultados."}</p></div>
                  : lista.map((e) => { const res = resumen(e); return (
                    <div key={e.id} style={S.expCard} onClick={() => abrirExpediente(e.id, "home")}>
                      <div style={S.expTop}><span style={S.expName}>{e.nombreDeudor}</span>{res.enMora > 0 ? <span style={{ ...S.badge, ...S.bVenc }}>{res.enMora} en mora</span> : <span style={{ ...S.badge, ...S.bPend }}>al día</span>}</div>
                      <div style={S.expMeta}>{e.tipoCredito} · {fmtCOP(e.valor)}{esArr(e.tipoCredito) ? "/mes" : ""} · {e.plazo} {esArr(e.tipoCredito) ? "meses" : "cuotas"}</div>
                      <div style={S.expMeta}>Por cobrar: <b>{fmtCOP(res.porCobrar)}</b></div>
                    </div>); })}
              </>);
            })()}
          </div>
        )}

        {/* ===== CLIENTE (historial) ===== */}
        {screen === "cliente" && clienteActivo && (() => {
          const st = statsCliente(clienteActivo); const b = badgeRecord(st);
          return (<div style={S.body}>
            <div style={S.expHead}>
              <span style={S.expHeadName}>{clienteActivo.nombre}</span>
              <span style={S.expHeadMeta}>{clienteActivo.doc ? `CC ${clienteActivo.doc}` : "Sin cédula"}{clienteActivo.telefono ? ` · ${clienteActivo.telefono}` : ""}</span>
            </div>
            <div style={{ marginBottom: 12 }}><span style={{ ...S.badge, ...b.s, fontSize: 12, padding: "5px 12px" }}>{b.txt}</span></div>
            <div style={S.miniGrid}>
              <div style={S.mini}><span style={S.miniCap}>Por cobrar</span><span style={S.miniVal}>{fmtCOP(st.porCobrar)}</span></div>
              <div style={S.mini}><span style={S.miniCap}>En mora</span><span style={{ ...S.miniVal, color: st.enMora ? RED : INK }}>{st.enMora}</span></div>
              <div style={S.mini}><span style={S.miniCap}>Cuotas a tiempo</span><span style={{ ...S.miniVal, color: GREEN }}>{st.aTiempo}</span></div>
              <div style={S.mini}><span style={S.miniCap}>Cuotas con atraso</span><span style={{ ...S.miniVal, color: st.tarde ? AMBER : INK }}>{st.tarde}</span></div>
            </div>
            <div style={{ ...S.sectionLabel, marginTop: 16 }}>Préstamos ({clienteActivo.loans.length})</div>
            {clienteActivo.loans.map((e) => { const res = resumen(e); return (
              <div key={e.id} style={S.expCard} onClick={() => abrirExpediente(e.id, "cliente")}>
                <div style={S.expTop}><span style={S.expName}>{e.tipoCredito}</span>{res.enMora > 0 ? <span style={{ ...S.badge, ...S.bVenc }}>{res.enMora} en mora</span> : <span style={{ ...S.badge, ...S.bPend }}>al día</span>}</div>
                <div style={S.expMeta}>{fmtCOP(e.valor)}{esArr(e.tipoCredito) ? "/mes" : ""} · {e.plazo} {esArr(e.tipoCredito) ? "meses" : "cuotas"} · desde {fmtFecha(e.fechaPrimeraCuota)}</div>
                <div style={S.expMeta}>Por cobrar: <b>{fmtCOP(res.porCobrar)}</b></div>
              </div>); })}
            {clienteActivo.telefono && <div style={S.actions}><a style={{ ...S.btn, ...S.btnWa, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }} href={waLink(clienteActivo.telefono, `Hola ${clienteActivo.nombre}, `)} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a></div>}
          </div>);
        })()}

        {/* ===== CALCULADORA ===== */}
        {screen === "calc" && (
          <div style={S.body}>
            <label style={S.lbl}>Tipo de crédito</label>
            <div style={S.selectWrap}><select style={S.select} value={tipoCredito} onChange={(e) => setTipoCredito(e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select><span style={S.caret}>▾</span></div>
            <label style={S.lbl}>{arr ? "Fecha de inicio del contrato" : "Fecha de inicio"}</label>
            <input type="date" style={S.input} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            <div style={S.card}>
              <label style={S.lbl}>{arr ? "Canon mensual" : "Valor prestado"}</label>
              <div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={S.moneyInput} value={fmtNum(valor)} onChange={onValor} /></div>
              <div style={S.twoCol}>
                {!arr && <div style={{ flex: 1 }}><label style={S.lbl}>Interés mensual</label><div style={S.pctRow}><input type="text" inputMode="decimal" style={S.smallInput} value={tasa} onChange={(e) => setTasa(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} /><span style={S.unit}>%</span></div></div>}
                <div style={{ flex: 1 }}><label style={S.lbl}>{arr ? "Duración" : "Plazo"}</label><div style={S.pctRow}><input type="text" inputMode="numeric" style={S.smallInput} value={plazo} onChange={(e) => setPlazo(e.target.value.replace(/[^\d]/g, ""))} /><span style={S.unit}>meses</span></div></div>
              </div>
            </div>
            <div style={S.moraOpt}>
              <label style={S.checkRow}><input type="checkbox" checked={moraActiva} onChange={(e) => setMoraActiva(e.target.checked)} /><span style={S.sectionLabel}>Cobrar recargo por mora</span></label>
              {moraActiva && (<div style={{ marginTop: 8 }}><label style={S.lbl}>Recargo por cuota vencida</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(moraValor)} onChange={(e) => setMoraValor(parseInt(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div>)}
            </div>
            {r && <div style={S.previewRow}><span style={S.previewLabel}>{arr ? "Total del contrato" : "Cada cuota"}</span><span style={S.previewValue}>{arr ? fmtCOP(r.total) : fmtCOP(r.cuota)}</span></div>}
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} disabled={!r} onClick={() => setScreen("result")}>Calcular</button></div>
          </div>
        )}

        {/* ===== RESULTADO ===== */}
        {screen === "result" && r && (
          <div style={S.body}>
            <div style={S.resSub}>{tipoCredito} · {fmtCOP(valor)}{arr ? "/mes" : ""} · {arr ? `${r.n} meses` : `${tasa}% · ${r.n} cuotas`}</div>
            <div style={S.hero}><span style={S.heroLabel}>{arr ? "Canon mensual" : "Valor de cada cuota"}</span><span style={S.heroValue}>{fmtCOP(r.cuota)}</span></div>
            {arr ? (<>
              <div style={S.gainRow}><div style={S.gainBox}><span style={S.gainCap}>Duración</span><span style={S.gainVal}>{r.n} meses</span></div><div style={S.gainBox}><span style={S.gainCap}>Total del contrato</span><span style={S.gainVal}>{fmtCOP(r.total)}</span></div></div>
              {moraActiva && <div style={S.moraLine}>Recargo por mora: {fmtCOP(moraValor)} por cuota vencida</div>}
            </>) : (<>
              <div style={S.tableWrap} className="lp-scroll">
                <table style={S.table}><thead><tr><th style={{ ...S.th, textAlign: "center" }}>N°</th><th style={S.thR}>Cuota</th><th style={S.thR}>Interés</th><th style={S.thR}>Abono</th><th style={S.thR}>Saldo</th></tr></thead>
                  <tbody>{r.filas.map((f) => (<tr key={f.n} style={f.n === 0 ? S.rowZero : undefined}><td style={{ ...S.td, textAlign: "center", fontWeight: 600 }}>{f.n}</td><td style={S.tdR}>{f.cuota == null ? "—" : fmtNum(f.cuota)}</td><td style={S.tdR}>{f.interes == null ? "—" : fmtNum(f.interes)}</td><td style={S.tdR}>{f.amort == null ? "—" : fmtNum(f.amort)}</td><td style={{ ...S.tdR, fontWeight: 600 }}>{fmtNum(f.saldo)}</td></tr>))}</tbody></table>
              </div>
              <div style={S.gainRow}><div style={S.gainBox}><span style={S.gainCap}>Ganancia total</span><span style={S.gainVal}>{fmtCOP(r.ganancia)}</span></div><div style={S.gainBox}><span style={S.gainCap}>% ganancia</span><span style={{ ...S.gainVal, color: GREEN }}>{r.pct.toFixed(2)}%</span></div></div>
              <div style={S.totalLine}><span>Total a recibir</span><span style={S.totalVal}>{fmtCOP(r.totalPagar)}</span></div>
            </>)}
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setScreen("calc")}>Ajustar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={irRegistrar}>Guardar</button></div>
          </div>
        )}

        {/* ===== REGISTRAR ===== */}
        {screen === "register" && (
          <div style={S.body}>
            <label style={S.lbl}>{arr ? "Nombre del arrendatario" : "Nombre del deudor"}</label>
            <input style={S.input} value={nombreDeudor} onChange={(e) => setNombreDeudor(e.target.value)} placeholder="Nombre completo" />
            <label style={S.lbl}>Documento de identidad</label>
            <div style={S.inlineRow}><input style={{ ...S.input, flex: 1 }} value={docDeudor} onChange={(e) => setDocDeudor(e.target.value)} placeholder="N° de cédula" /><button style={S.attachBtn} title="Adjuntar foto (pendiente en este entorno)">📷 Insertar</button></div>
            <label style={S.lbl}>Teléfono / WhatsApp</label>
            <input type="tel" style={S.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" />
            <div style={S.divider} />
            <div style={S.sectionLabel}>{arr ? "Garantía / depósito" : "Garantías"}</div>
            {garantias.map((g, idx) => (<div key={idx} style={S.garBox}>
              <div style={S.selectWrap}><select style={S.select} value={g.tipo} onChange={(e) => setGar(idx, "tipo", e.target.value)}>{TIPOS_GARANTIA.map((t) => <option key={t}>{t}</option>)}</select><span style={S.caret}>▾</span></div>
              <input style={S.input} value={g.folio} onChange={(e) => setGar(idx, "folio", e.target.value)} placeholder="N° de folio / documento" />
              <input style={S.input} value={g.desc} onChange={(e) => setGar(idx, "desc", e.target.value)} placeholder="Descripción" />
              <div style={S.garActions}><button style={S.attachBtn} title="Adjuntar foto (pendiente en este entorno)">📷 Foto</button>{garantias.length > 1 && <button style={S.delBtn} onClick={() => setGarantias((gg) => gg.filter((_, i) => i !== idx))}>✕ Quitar</button>}</div>
            </div>))}
            <button style={S.addBtn} onClick={() => setGarantias((g) => [...g, { tipo: "Inmueble", folio: "", desc: "" }])}>+ Agregar garantía</button>
            <div style={S.divider} />
            <label style={S.checkRow}><input type="checkbox" checked={fiadorOn} onChange={(e) => setFiadorOn(e.target.checked)} /><span style={S.sectionLabel}>Tiene fiador / codeudor</span></label>
            {fiadorOn && (<div style={S.garBox}><input style={S.input} value={fiadorNombre} onChange={(e) => setFiadorNombre(e.target.value)} placeholder="Nombre del fiador" /><input style={S.input} value={fiadorDoc} onChange={(e) => setFiadorDoc(e.target.value)} placeholder="Documento del fiador" /></div>)}
            <div style={S.divider} />
            <label style={S.lbl}>{arr ? "Fecha del primer canon" : "Fecha de la primera cuota"}</label>
            <input type="date" style={S.input} value={fechaPrimeraCuota} onChange={(e) => setFechaPrimeraCuota(e.target.value)} />
            {errorReg && <div style={S.error}>{errorReg}</div>}
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setScreen("result")}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={confirmarRegistro}>Confirmar</button></div>
          </div>
        )}

        {/* ===== EXPEDIENTE ===== */}
        {screen === "expediente" && activeExp && cuadro && (() => {
          const res = resumen(activeExp);
          const filaSel = pagoOpen != null ? cuadro.filas.find((f) => f.n === pagoOpen) : null;
          const faltaSel = filaSel ? Math.max(0, totalDe(activeExp, filaSel) - pagadoDe(activeExp, filaSel.n)) : 0;
          return (
            <div style={S.body}>
              <div style={S.expHead}><span style={S.expHeadName}>{activeExp.nombreDeudor}</span><span style={S.expHeadMeta}>{activeExp.tipoCredito}{activeExp.docDeudor ? ` · CC ${activeExp.docDeudor}` : ""}{activeExp.telefono ? ` · ${activeExp.telefono}` : ""}</span></div>
              <div style={S.miniGrid}>
                <div style={S.mini}><span style={S.miniCap}>{activeArr ? "Canon" : "Prestado"}</span><span style={S.miniVal}>{fmtCOP(activeExp.valor)}</span></div>
                <div style={S.mini}><span style={S.miniCap}>Por cobrar</span><span style={S.miniVal}>{fmtCOP(res.porCobrar)}</span></div>
                <div style={S.mini}><span style={S.miniCap}>{activeArr ? "Cobrado" : "Abonado"}</span><span style={{ ...S.miniVal, color: GREEN }}>{fmtCOP(res.abonado)}</span></div>
                <div style={S.mini}><span style={S.miniCap}>En mora</span><span style={{ ...S.miniVal, color: res.enMora ? RED : INK }}>{res.enMora}</span></div>
              </div>
              {activeExp.mora && activeExp.mora.activa && <div style={S.moraLine}>Recargo por mora: {fmtCOP(activeExp.mora.valor)} por cuota vencida</div>}
              {activeExp.garantias.length > 0 && (<div style={S.garSummary}><span style={S.sectionLabel}>{activeArr ? "Garantía / depósito" : "Garantía"}</span>{activeExp.garantias.map((g, i) => <div key={i} style={S.garLine}>{g.tipo}{g.folio ? ` · Folio ${g.folio}` : ""}{g.desc ? ` · ${g.desc}` : ""}</div>)}</div>)}
              {activeExp.fiador && <div style={S.garLine}><b>Fiador:</b> {activeExp.fiador.nombre}{activeExp.fiador.doc ? ` (${activeExp.fiador.doc})` : ""}</div>}

              <div style={{ ...S.sectionLabel, marginTop: 16 }}>{activeArr ? "Cánones" : "Cuadro de letras"}</div>
              <div style={S.tableWrap} className="lp-scroll">
                <table style={S.table}><thead><tr><th style={{ ...S.th, textAlign: "center" }}>N°</th><th style={S.th}>Vence</th><th style={S.thR}>Valor</th><th style={{ ...S.th, textAlign: "center" }}>Estado</th><th style={S.th}></th></tr></thead>
                  <tbody>{cuadro.filas.filter((f) => f.n >= 1).map((f) => {
                    const m = cuadro.markers[f.n]; const est = estadoDe(activeExp, f);
                    const bs = est === "PAGADA" ? S.bPag : est === "VENCIDA" ? S.bVenc : est === "PARCIAL" ? S.bParc : est === "CANCELADA" ? S.bCanc : S.bPend;
                    const pg = pagadoDe(activeExp, f.n), rec = recargoDe(activeExp, f), falta = Math.max(0, totalDe(activeExp, f) - pg);
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
                  <div style={S.panelMeta}>Vence {fmtFecha(filaSel.fecha)} · Valor {fmtCOP(totalDe(activeExp, filaSel))} · Falta {fmtCOP(faltaSel)}</div>
                  <div style={S.twoCol}>
                    <div style={{ flex: 1 }}><label style={S.lbl}>Monto que paga</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(pagoMonto)} onChange={(e) => setPagoMonto(parseInt(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div>
                    <div style={{ flex: 1 }}><label style={S.lbl}>Fecha</label><input type="date" style={S.input} value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} /></div>
                  </div>
                  <div style={S.hint}>{Number(pagoMonto) >= faltaSel ? "Queda PAGADA." : `Abono parcial · quedará debiendo ${fmtCOP(faltaSel - Number(pagoMonto))} de esta cuota.`}</div>
                  <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setPagoOpen(null)}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { registrarCobro(activeExp.id, pagoOpen, pagoMonto, pagoFecha); setPagoOpen(null); }}>Registrar</button></div>
                </div>
              )}

              {!activeArr && (
                <div style={S.abonoSection}>
                  <div style={S.abonoHead}><span style={S.sectionLabel}>Abonos a capital</span><button style={S.addSmall} onClick={() => { setAbonoOpen((v) => !v); setPagoOpen(null); }}>{abonoOpen ? "Cerrar" : "+ Abonar"}</button></div>
                  <div style={S.abonoExpl}>Plata extra al capital: baja el saldo y recalcula las cuotas siguientes.</div>
                  {(activeExp.abonosCapital || []).map((a) => (<div key={a.id} style={S.abonoItem}><span>{fmtCOP(a.monto)} · {fmtFecha(a.fecha)}</span><button style={S.delMini} onClick={() => quitarAbono(a.id)}>✕</button></div>))}
                  {abonoOpen && (<div style={S.panel}>
                    <div style={S.twoCol}><div style={{ flex: 1 }}><label style={S.lbl}>Valor abonado</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(abonoMonto)} onChange={(e) => setAbonoMonto(parseInt(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div><div style={{ flex: 1 }}><label style={S.lbl}>Fecha</label><input type="date" style={S.input} value={abonoFecha} onChange={(e) => setAbonoFecha(e.target.value)} /></div></div>
                    <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setAbonoOpen(false)}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={agregarAbono}>Aplicar abono</button></div>
                  </div>)}
                </div>
              )}
              <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={() => setScreen(backTarget())}>Volver</button></div>
            </div>
          );
        })()}

        {/* ===== MODAL: COBRO ===== */}
        {cobro && (() => {
          const e = expedientes.find((x) => x.id === cobro.expId); if (!e) return null;
          const f = derivarCuadro(e).filas.find((x) => x.n === cobro.n);
          const falta = Math.max(0, totalDe(e, f) - pagadoDe(e, f.n));
          return (<div style={S.overlay} onClick={() => setCobro(null)}>
            <div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
              <div style={S.panelTitle}>Cobrar — {e.nombreDeudor}</div>
              <div style={S.panelMeta}>{esArr(e.tipoCredito) ? "Canon" : "Cuota"} N° {f.n} · vence {fmtFecha(f.fecha)} · falta {fmtCOP(falta)}</div>
              <div style={S.twoCol}>
                <div style={{ flex: 1 }}><label style={S.lbl}>Monto que paga</label><div style={S.moneyRow}><span style={S.peso}>$</span><input type="text" inputMode="numeric" style={{ ...S.moneyInput, fontSize: 18 }} value={fmtNum(cobroMonto)} onChange={(ev) => setCobroMonto(parseInt(ev.target.value.replace(/[^\d]/g, "")) || 0)} /></div></div>
                <div style={{ flex: 1 }}><label style={S.lbl}>Fecha</label><input type="date" style={S.input} value={cobroFecha} onChange={(ev) => setCobroFecha(ev.target.value)} /></div>
              </div>
              <div style={S.hint}>{Number(cobroMonto) >= falta ? "Queda PAGADA." : `Abono parcial · quedará debiendo ${fmtCOP(falta - Number(cobroMonto))}.`}</div>
              <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setCobro(null)}>Cancelar</button><button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { registrarCobro(cobro.expId, cobro.n, cobroMonto, cobroFecha); setCobro(null); }}>Registrar</button></div>
            </div>
          </div>);
        })()}

        {/* ===== MODAL: RECIBO ===== */}
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

        {/* ===== MODAL: RESPALDO ===== */}
        {respaldoOpen && (<div style={S.overlay} onClick={() => setRespaldoOpen(false)}>
          <div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
            <div style={S.panelTitle}>Respaldo de datos</div>
            <div style={S.panelMeta}>Último respaldo: {lastBackup ? `${fmtFecha(lastBackup)}${diasSinRespaldo > 0 ? ` (hace ${diasSinRespaldo} días)` : " (hoy)"}` : "nunca"}</div>
            {respaldoPendiente && <div style={{ ...S.moraLine, marginTop: 8 }}>Te conviene descargar un respaldo.</div>}
            <p style={S.respaldoExpl}>Descarga un archivo con toda tu información y guárdalo en tu Google Drive (o envíatelo por WhatsApp). Si pierdes el celular, lo restauras en otro equipo y recuperas todo.</p>
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={exportar}>Descargar respaldo</button></div>
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={() => fileRef.current && fileRef.current.click()}>Restaurar desde archivo</button></div>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { importar(e.target.files[0]); e.target.value = ""; }} />
            <div style={S.respaldoWarn}>Restaurar reemplaza los datos actuales por los del archivo.</div>
            {respaldoMsg && <div style={S.respaldoMsg}>{respaldoMsg}</div>}
            <div style={S.actions}><button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={() => setRespaldoOpen(false)}>Cerrar</button></div>
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
  tabs: { display: "flex", gap: 6, marginBottom: 14, background: PAPER_DK, borderRadius: 8, padding: 4 },
  tab: { flex: 1, fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", padding: "9px 4px", borderRadius: 6, border: "none", background: "transparent", color: INK_SOFT, cursor: "pointer" },
  tabOn: { background: INK, color: PAPER },
  search: { width: "100%", fontFamily: sans, fontSize: 14, color: INK, background: "#fff", border: `1.5px solid ${INK}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 },
  lbl: { display: "block", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT, margin: "12px 0 5px" },
  selectWrap: { position: "relative" },
  select: { width: "100%", appearance: "none", WebkitAppearance: "none", fontFamily: sans, fontSize: 16, fontWeight: 600, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 26px 8px 2px", cursor: "pointer" },
  caret: { position: "absolute", right: 4, top: 10, pointerEvents: "none", color: INK_SOFT },
  input: { width: "100%", fontFamily: mono, fontSize: 15, color: INK, background: "transparent", border: "none", borderBottom: `1.5px solid ${INK}`, padding: "8px 2px", marginBottom: 4 },
  inlineRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  card: { marginTop: 16, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "4px 14px 14px" },
  moneyRow: { display: "flex", alignItems: "baseline", gap: 6, borderBottom: `1.5px solid ${INK}`, paddingBottom: 6 },
  peso: { fontFamily: mono, fontSize: 20, fontWeight: 600, color: INK_SOFT },
  moneyInput: { flex: 1, fontFamily: mono, fontSize: 24, fontWeight: 600, color: INK, background: "transparent", border: "none", padding: "2px 0" },
  twoCol: { display: "flex", gap: 16, marginTop: 4 },
  pctRow: { display: "flex", alignItems: "baseline", gap: 6, borderBottom: `1.5px solid ${INK}`, paddingBottom: 6 },
  smallInput: { width: "100%", fontFamily: mono, fontSize: 20, fontWeight: 600, color: INK, background: "transparent", border: "none", padding: "2px 0" },
  unit: { fontFamily: mono, fontSize: 12, color: INK_SOFT, whiteSpace: "nowrap" },
  moraOpt: { marginTop: 16, border: `1.5px dashed ${INK_SOFT}`, borderRadius: 8, padding: "10px 12px" },
  moraLine: { fontFamily: mono, fontSize: 12, color: AMBER, marginTop: 10, fontWeight: 600 },
  previewRow: { marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 14px", background: PAPER_DK, borderRadius: 8 },
  previewLabel: { fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT },
  previewValue: { fontFamily: mono, fontSize: 19, fontWeight: 700, color: INK },
  actions: { display: "flex", gap: 12, marginTop: 18 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  btnGhost: { background: "transparent", color: INK, border: `1.5px solid ${INK}` },
  btnWa: { background: WA, color: "#fff", border: `1.5px solid ${WA}` },
  resSub: { fontFamily: mono, fontSize: 12, color: INK_SOFT, marginBottom: 6 },
  hero: { marginTop: 6, padding: "14px 16px", border: `2px solid ${INK}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 2 },
  heroLabel: { fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT },
  heroValue: { fontFamily: mono, fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: INK },
  tableWrap: { marginTop: 12, maxHeight: 300, overflow: "auto", border: `1.5px solid ${INK}`, borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12 },
  th: { position: "sticky", top: 0, background: INK, color: PAPER, padding: "8px", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" },
  thR: { position: "sticky", top: 0, background: INK, color: PAPER, padding: "8px", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" },
  td: { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, whiteSpace: "nowrap", verticalAlign: "middle" },
  tdR: { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  rowZero: { background: PAPER_DK, fontStyle: "italic" },
  markerCell: { background: "rgba(47,93,122,.1)", color: BLUE, fontFamily: mono, fontSize: 10.5, fontWeight: 600, padding: "6px 8px", borderBottom: `1px solid ${RULE}`, borderLeft: `3px solid ${BLUE}` },
  faltaNote: { fontFamily: mono, fontSize: 10, color: RED, fontWeight: 600, marginTop: 2 },
  moraNote: { fontFamily: mono, fontSize: 10, color: AMBER, fontWeight: 600, marginTop: 2 },
  gainRow: { display: "flex", gap: 12, marginTop: 14 },
  gainBox: { flex: 1, border: `1.5px solid ${INK}`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 },
  gainCap: { fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT },
  gainVal: { fontFamily: mono, fontSize: 18, fontWeight: 700, color: INK },
  totalLine: { marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: mono, fontSize: 12, color: INK_SOFT, letterSpacing: "0.06em", textTransform: "uppercase", paddingTop: 12, borderTop: `1.5px solid ${INK}` },
  totalVal: { fontSize: 17, fontWeight: 700, color: INK, textTransform: "none", letterSpacing: 0 },
  divider: { height: 1, background: INK, margin: "18px 0 4px" },
  sectionLabel: { fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: INK, display: "block" },
  attachBtn: { fontFamily: mono, fontSize: 12, background: PAPER_DK, border: `1.5px solid ${INK}`, borderRadius: 6, padding: "8px 10px", cursor: "pointer", whiteSpace: "nowrap" },
  garBox: { border: `1.5px solid ${RULE}`, borderRadius: 8, padding: "10px 12px", marginTop: 10 },
  garActions: { display: "flex", gap: 8, marginTop: 8 },
  delBtn: { fontFamily: mono, fontSize: 12, background: "transparent", border: `1.5px solid ${RED}`, color: RED, borderRadius: 6, padding: "6px 10px", cursor: "pointer" },
  addBtn: { fontFamily: mono, fontSize: 13, background: "transparent", border: `1.5px dashed ${INK}`, borderRadius: 8, padding: "10px", cursor: "pointer", width: "100%", marginTop: 10 },
  checkRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, cursor: "pointer" },
  error: { marginTop: 14, color: RED, fontFamily: mono, fontSize: 13, fontWeight: 600 },
  empty: { textAlign: "center", padding: "40px 10px", color: INK_SOFT },
  emptyT: { fontFamily: mono, fontSize: 15, fontWeight: 600, color: INK, margin: 0 },
  emptyS: { fontFamily: sans, fontSize: 13.5, marginTop: 8 },
  cobroStrip: { display: "flex", gap: 10 },
  stripBox: { flex: 1, border: "2px solid", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 1 },
  stripCap: { fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_SOFT },
  stripVal: { fontFamily: mono, fontSize: 18, fontWeight: 700 },
  stripSub: { fontFamily: mono, fontSize: 10.5, color: INK_SOFT },
  cobroCard: { border: `1.5px solid ${RULE}`, borderLeft: "4px solid", borderRadius: 10, padding: "10px 12px", marginTop: 10, background: "#fff" },
  cobroTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cobroName: { fontFamily: sans, fontSize: 16, fontWeight: 700, color: INK, cursor: "pointer", textDecoration: "underline", textDecorationColor: RULE },
  cobroMonto: { fontFamily: mono, fontSize: 16, fontWeight: 700, color: INK },
  cobroMeta: { fontFamily: mono, fontSize: 11.5, color: INK_SOFT, marginTop: 4 },
  cobroActions: { display: "flex", gap: 8, marginTop: 10 },
  cobrarBtn: { flex: 1, fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: INK, color: PAPER, border: "none", borderRadius: 6, padding: "9px", cursor: "pointer" },
  waBtn: { flex: 1, fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: WA, color: "#fff", border: "none", borderRadius: 6, padding: "9px", cursor: "pointer", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" },
  expCard: { display: "block", width: "100%", textAlign: "left", background: PAPER_DK, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, cursor: "pointer" },
  expTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  expName: { fontFamily: sans, fontSize: 16, fontWeight: 700, color: INK },
  expMeta: { fontFamily: mono, fontSize: 12, color: INK_SOFT, marginTop: 2 },
  badge: { fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, border: "1.5px solid" },
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
  abonoSection: { marginTop: 18, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "12px 14px" },
  abonoHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  abonoExpl: { fontFamily: sans, fontSize: 12, color: INK_SOFT, marginTop: 4 },
  abonoItem: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono, fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${RULE}` },
  addSmall: { fontFamily: mono, fontSize: 12, fontWeight: 600, background: INK, color: PAPER, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" },
  delMini: { fontFamily: mono, fontSize: 12, background: "transparent", border: "none", color: RED, cursor: "pointer" },
  expHead: { borderBottom: `1.5px solid ${INK}`, paddingBottom: 10, marginBottom: 12 },
  expHeadName: { display: "block", fontFamily: sans, fontSize: 20, fontWeight: 700 },
  expHeadMeta: { fontFamily: mono, fontSize: 12, color: INK_SOFT },
  miniGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  mini: { border: `1.5px solid ${RULE}`, borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column" },
  miniCap: { fontFamily: mono, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_SOFT },
  miniVal: { fontFamily: mono, fontSize: 16, fontWeight: 700, color: INK },
  garSummary: { marginTop: 14 },
  garLine: { fontFamily: mono, fontSize: 12.5, color: INK, marginTop: 4 },
  overlay: { position: "fixed", inset: 0, background: "rgba(30,26,20,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 360, background: PAPER, border: `2px solid ${INK}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 16px 40px rgba(0,0,0,.35)" },
  reciboStamp: { display: "inline-block", fontFamily: mono, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: GREEN, border: `2px solid ${GREEN}`, borderRadius: 6, padding: "4px 12px", fontSize: 13, transform: "rotate(-1.5deg)" },
  reciboBody: { marginTop: 14, borderTop: `1px dashed ${INK_SOFT}`, borderBottom: `1px dashed ${INK_SOFT}`, padding: "12px 0" },
  reciboName: { fontFamily: sans, fontSize: 18, fontWeight: 700 },
  reciboLine: { fontFamily: mono, fontSize: 12.5, color: INK, marginTop: 4 },
  reciboBig: { fontFamily: mono, fontSize: 28, fontWeight: 700, margin: "8px 0 4px" },
  respaldoBtn: { marginLeft: "auto", position: "relative", fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", background: "transparent", border: `1.5px solid ${INK}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: INK },
  dot: { position: "absolute", top: -5, right: -5, width: 10, height: 10, borderRadius: "50%", background: RED, border: `1.5px solid ${PAPER_DK}` },
  respaldoExpl: { fontFamily: sans, fontSize: 13, color: INK, marginTop: 12, lineHeight: 1.5 },
  respaldoWarn: { fontFamily: mono, fontSize: 10.5, color: INK_SOFT, marginTop: 10, textAlign: "center" },
  respaldoMsg: { fontFamily: sans, fontSize: 12.5, color: GREEN, marginTop: 10, fontWeight: 600, textAlign: "center" },
};
