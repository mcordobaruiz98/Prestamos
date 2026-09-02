import React, { useState, useRef, useEffect, useCallback } from "react";

/*
  LIBRO DE PRÉSTAMOS — Recibo como imagen con firma.
  Demo funcional: genera un recibo visual en Canvas, el usuario firma una vez
  y la firma queda guardada para futuros recibos. Se comparte como imagen.
*/

const PAPER = "#f6f1e4", PAPER_DK = "#ece4d0", INK = "#232019", INK_SOFT = "#6b6455";
const RULE = "#d8cdb0", RED = "#b23a2e", GREEN = "#3f6b3a", WA = "#1f8a4c";
const mono = "'IBM Plex Mono', monospace";
const sans = "'IBM Plex Sans', sans-serif";

const fmtCOP = (n) => "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtFecha = (d) => new Date(d + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });

const EJEMPLO = { nombre: "Mario Cordoba", tipo: "Empeño", n: 3, totalCuotas: 36, monto: 1113265, fecha: "2026-09-02", faltaDespues: 0 };

export default function ReciboImagenDemo() {
  const [firma, setFirma] = useState(null);
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [reciboUrl, setReciboUrl] = useState(null);
  const [compartido, setCompartido] = useState(false);
  const sigRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // ---- Firma: dibujar con dedo/mouse ----
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const startDraw = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, sigRef.current); };
  const moveDraw = (e) => {
    if (!drawing.current) return; e.preventDefault();
    const ctx = sigRef.current.getContext("2d"); const p = getPos(e, sigRef.current);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastPos.current = p;
  };
  const endDraw = () => { drawing.current = false; };
  const limpiarFirma = () => { const ctx = sigRef.current.getContext("2d"); ctx.clearRect(0, 0, sigRef.current.width, sigRef.current.height); };
  const guardarFirma = () => { setFirma(sigRef.current.toDataURL("image/png")); setFirmaOpen(false); };

  // ---- Generar recibo como imagen ----
  const generarRecibo = useCallback((rec, firmaImg) => {
    const W = 600, H = 470;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    // Fondo
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

    // Borde
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Sello "RECIBO DE PAGO"
    const sx = 40, sy = 50, sw = 210, sh = 34;
    ctx.strokeStyle = GREEN; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.stroke();
    ctx.font = `bold 14px ${mono}`; ctx.fillStyle = GREEN; ctx.textBaseline = "middle";
    ctx.fillText("RECIBO DE PAGO", sx + 16, sy + sh / 2);

    // Nombre
    ctx.font = `bold 22px ${sans}`; ctx.fillStyle = INK;
    ctx.fillText(rec.nombre, 40, 120);

    // Tipo y cuota
    ctx.font = `15px ${mono}`; ctx.fillStyle = INK_SOFT;
    ctx.fillText(`${rec.tipo} — Cuota N° ${rec.n} / ${rec.totalCuotas}`, 40, 148);

    // Monto grande
    ctx.font = `bold 42px ${mono}`; ctx.fillStyle = INK;
    ctx.fillText(fmtCOP(rec.monto), 40, 200);

    // Línea separadora
    ctx.strokeStyle = RULE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 220); ctx.lineTo(W - 40, 220); ctx.stroke();

    // Fecha
    ctx.font = `14px ${mono}`; ctx.fillStyle = INK;
    ctx.fillText(`Fecha: ${fmtFecha(rec.fecha)}`, 40, 248);

    // Falta / pagada
    if (rec.faltaDespues > 0) {
      ctx.font = `bold 14px ${mono}`; ctx.fillStyle = RED;
      ctx.fillText(`Falta de esta cuota: ${fmtCOP(rec.faltaDespues)}`, 40, 274);
    } else {
      ctx.font = `bold 14px ${mono}`; ctx.fillStyle = GREEN;
      ctx.fillText("Cuota PAGADA ✓", 40, 274);
    }

    // Línea separadora antes de firma
    ctx.strokeStyle = RULE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 300); ctx.lineTo(W - 40, 300); ctx.stroke();

    // Firma
    if (firmaImg) {
      const img = new Image();
      img.onload = () => {
        const maxW = 200, maxH = 80;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const fw = img.width * ratio, fh = img.height * ratio;
        ctx.drawImage(img, 40, 315, fw, fh);

        // Línea de firma
        ctx.strokeStyle = INK_SOFT; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 410); ctx.lineTo(260, 410); ctx.stroke();
        ctx.font = `11px ${mono}`; ctx.fillStyle = INK_SOFT;
        ctx.fillText("Firma", 40, 428);

        // Fecha en firma
        ctx.fillText(fmtFecha(rec.fecha), 320, 428);
        ctx.strokeStyle = INK_SOFT; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(320, 410); ctx.lineTo(W - 40, 410); ctx.stroke();
        ctx.fillText("Fecha", 320, 428);

        setReciboUrl(c.toDataURL("image/png"));
      };
      img.src = firmaImg;
    } else {
      ctx.font = `12px ${mono}`; ctx.fillStyle = INK_SOFT;
      ctx.fillText("(Sin firma configurada)", 40, 340);
      setReciboUrl(c.toDataURL("image/png"));
    }
  }, []);

  useEffect(() => { generarRecibo(EJEMPLO, firma); }, [firma, generarRecibo]);

  const descargar = () => {
    if (!reciboUrl) return;
    const a = document.createElement("a"); a.href = reciboUrl; a.download = `recibo-cuota-${EJEMPLO.n}.png`; a.click();
    setCompartido(true);
  };
  const compartir = async () => {
    if (!reciboUrl) return;
    try {
      const blob = await (await fetch(reciboUrl)).blob();
      const file = new File([blob], `recibo-cuota-${EJEMPLO.n}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] }); setCompartido(true); return;
      }
    } catch (e) { }
    descargar();
  };

  return (
    <div style={S.stage}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <div style={S.header}><span style={S.headerTitle}>Recibo</span></div>
        <div style={S.body}>

          {/* Firma */}
          <div style={S.firmaSection}>
            <div style={S.firmaHead}>
              <span style={S.lbl}>Tu firma</span>
              <button style={S.firmaBtn} onClick={() => setFirmaOpen(true)}>{firma ? "Cambiar firma" : "Configurar firma"}</button>
            </div>
            {firma && <img src={firma} alt="Firma" style={S.firmaPreview} />}
            {!firma && <div style={S.firmaEmpty}>Aún no has configurado tu firma. Toca el botón para dibujarla.</div>}
          </div>

          {/* Recibo generado */}
          {reciboUrl && (
            <div style={S.reciboWrap}>
              <img src={reciboUrl} alt="Recibo" style={S.reciboImg} />
            </div>
          )}

          <div style={S.actions}>
            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={compartir}>
              {compartido ? "✓ Compartido" : "Compartir recibo"}
            </button>
          </div>
          <div style={S.hint}>En el celular se abre WhatsApp directo para enviar la imagen. En computador se descarga el archivo.</div>

          {/* Modal: dibujar firma */}
          {firmaOpen && (
            <div style={S.overlay} onClick={() => setFirmaOpen(false)}>
              <div style={S.modal} onClick={(e) => e.stopPropagation()}>
                <div style={S.panelTitle}>Dibuja tu firma</div>
                <div style={S.sigHint}>Usa el dedo (celular) o el mouse (computador).</div>
                <div style={S.sigWrap}>
                  <canvas ref={sigRef} width={500} height={160} style={S.sigCanvas}
                    onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
                </div>
                <div style={S.actions}>
                  <button style={{ ...S.btn, ...S.btnGhost }} onClick={limpiarFirma}>Borrar</button>
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={guardarFirma}>Guardar firma</button>
                </div>
                <div style={S.sigNote}>La firma se guarda y se usa en todos tus recibos.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; }
button:focus-visible { outline: 2px solid ${RED}; outline-offset: 1px; }
`;

const S = {
  stage: { minHeight: "100vh", width: "100%", background: "#e7e0cd", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "20px 12px 40px", fontFamily: sans, color: INK },
  phone: { width: "100%", maxWidth: 420, background: PAPER, border: `1px solid ${INK}`, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.15)", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: `2px solid ${INK}`, background: PAPER_DK },
  headerTitle: { fontFamily: mono, fontWeight: 600, fontSize: 16, letterSpacing: "0.14em", textTransform: "uppercase" },
  body: { padding: "18px" },
  lbl: { fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT },
  firmaSection: { border: `1.5px solid ${RULE}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 },
  firmaHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  firmaBtn: { fontFamily: mono, fontSize: 12, fontWeight: 600, background: INK, color: PAPER, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" },
  firmaPreview: { marginTop: 10, maxWidth: 180, maxHeight: 60, display: "block" },
  firmaEmpty: { fontFamily: sans, fontSize: 13, color: INK_SOFT, marginTop: 8 },
  reciboWrap: { border: `1.5px solid ${INK}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  reciboImg: { width: "100%", display: "block" },
  actions: { display: "flex", gap: 12, marginTop: 14 },
  btn: { flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "13px 10px", borderRadius: 8, cursor: "pointer" },
  btnPrimary: { background: INK, color: PAPER, border: `1.5px solid ${INK}` },
  btnGhost: { background: "transparent", color: INK, border: `1.5px solid ${INK}` },
  hint: { fontFamily: sans, fontSize: 12, color: INK_SOFT, marginTop: 10, textAlign: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(30,26,20,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 400, background: PAPER, border: `2px solid ${INK}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 16px 40px rgba(0,0,0,.35)" },
  panelTitle: { fontFamily: mono, fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" },
  sigHint: { fontFamily: sans, fontSize: 13, color: INK_SOFT, marginTop: 6 },
  sigWrap: { marginTop: 12, border: `2px solid ${INK}`, borderRadius: 8, overflow: "hidden", background: "#fff" },
  sigCanvas: { width: "100%", height: 120, display: "block", cursor: "crosshair", touchAction: "none" },
  sigNote: { fontFamily: mono, fontSize: 10.5, color: INK_SOFT, marginTop: 10, textAlign: "center" },
};