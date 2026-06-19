import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Types (mirror server) ──
type Semaforo = "verde" | "amarillo" | "rojo";

interface CeoFce {
  factor: string;
  unidad: string;
  execDia: number;
  metaDia: number;
  pctDia: number;
  execAcum: number;
  metaAcum: number;
  pctAcum: number;
  semaforoDia: Semaforo;
  semaforoAcum: Semaforo;
  comentarioDia: string;
  comentarioAcum: string;
}

interface CeoArea {
  nombre: string;
  factores: CeoFce[];
}

interface InventarioItem {
  nombre: string;
  valor: number | null;
  capacidad: number | null;
  pctOcupacion: number | null;
  unidad: string;
  semaforo: Semaforo;
  nota: string;
}

interface AlertaItem {
  linea: string;
  canal: string;
  principal: string;
  diff: number;
  pct: string;
  unidad: string;
}

interface RecomendacionEjecutiva {
  texto: string;
  nivel: "rojo" | "amarillo" | "verde" | "info";
}

interface EstrategiaComercial {
  tipo: "riesgo" | "oportunidad" | "accion";
  titulo: string;
  detalle: string;
  semaforo: Semaforo;
}

interface ConcentracionCliente {
  principal: string;
  volumenTotal: number;
  pctDelTotal: number;
  lineas: string[];
  lineaPrincipal: string;
  semaforo: Semaforo;
}

interface ConcentracionPorLinea {
  linea: string;
  unidad: string;
  volumenTotal: number;
  top: { principal: string; volumen: number; pct: number; semaforo: Semaforo }[];
  hhiLinea: number;
}

export interface CeoReportData {
  fecha: string;
  diasTransc: number;
  diasMes: number;
  factor: string;
  areas: CeoArea[];
  inventarios: InventarioItem[];
  recomendaciones: RecomendacionEjecutiva[];
  estrategiasComerciales: EstrategiaComercial[];
  concentracionClientes: ConcentracionCliente[];
  concentracionPorLinea: ConcentracionPorLinea[];
  hhiIndex: number;
  alertasDesfasados: AlertaItem[];
  alertasSobrecumplidos: AlertaItem[];
}

// ── Helpers ──
function fmtN(n: number, unidad: string): string {
  if (unidad === "$MILLONES" || unidad === "$COP") {
    return `$${Math.round(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })}M`;
  }
  return Math.round(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function fmtPct(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0").replace("%", ""));
  return `${Math.round(Number.isFinite(n) ? n : 0)}%`;
}

function SemaforoCircle({ s, size = 14 }: { s: Semaforo; size?: number }) {
  const colors: Record<Semaforo, string> = {
    verde: "#22c55e",
    amarillo: "#f59e0b",
    rojo: "#ef4444",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors[s],
        flexShrink: 0,
      }}
    />
  );
}

function pctColor(pct: number): string {
  if (pct >= 100) return "#15803d";
  if (pct >= 85) return "#b45309";
  return "#b91c1c";
}

// ── Area Header Row ──
function AreaHeader({ nombre }: { nombre: string }) {
  const displayName = nombre === "INGRESOS (COP)" ? "INGRESOS ($MILLONES)" : nombre;
  return (
    <tr>
      <td
        colSpan={9}
        style={{
          background: "#1a237e",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.78rem",
          padding: "5px 10px",
          letterSpacing: "0.06em",
          cursor: "pointer",
        }}
      >
        ▶ {displayName}
      </td>
    </tr>
  );
}

// ── FCE Row ──
function FceRow({ f, isSubtotal }: { f: CeoFce; isSubtotal?: boolean }) {
  const bg = isSubtotal ? "#f1f5f9" : "#fff";
  const fw = isSubtotal ? 700 : 400;
  const cellStyle: React.CSSProperties = {
    padding: "4px 8px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "0.77rem",
    fontWeight: fw,
    background: bg,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
  return (
    <tr>
      <td style={{ ...cellStyle, textAlign: "left", paddingLeft: isSubtotal ? 10 : 20 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SemaforoCircle s={f.semaforoAcum} size={10} />
          {f.factor}
        </span>
      </td>
      <td style={{ ...cellStyle, color: "#64748b", fontSize: "0.7rem" }}>{f.unidad}</td>
      <td style={{ ...cellStyle, fontWeight: 700 }}>{fmtN(f.execDia, f.unidad)}</td>
      <td style={{ ...cellStyle, color: "#64748b" }}>{fmtN(f.metaDia, f.unidad)}</td>
      <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(f.pctDia) }}>
        {fmtPct(f.pctDia)}
      </td>
      <td style={{ ...cellStyle, fontWeight: 700 }}>{fmtN(f.execAcum, f.unidad)}</td>
      <td style={{ ...cellStyle, color: "#64748b" }}>{fmtN(f.metaAcum, f.unidad)}</td>
      <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(f.pctAcum) }}>
        {fmtPct(f.pctAcum)}
      </td>
      <td style={{ ...cellStyle, textAlign: "left", fontSize: "0.7rem", color: "#475569", whiteSpace: "normal" }}>
        <div><strong>Día:</strong> {f.comentarioDia}</div>
        <div><strong>Acum:</strong> {f.comentarioAcum}</div>
      </td>
    </tr>
  );
}

// ── Inventarios Section ──
function InventariosSection({ items }: { items: InventarioItem[] }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderTop: "none",
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, #1a237e 0%, #283593 100%)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.82rem",
          letterSpacing: "0.08em",
          padding: "7px 12px",
          textTransform: "uppercase",
        }}
      >
        ▶ INVENTARIOS Y CAPACIDAD OPERATIVA
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          padding: "8px 12px",
        }}
      >
        {items.map((item, i) => {
          const sc = {
            verde: { bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
            amarillo: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
            rojo: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" },
          }[item.semaforo];
          return (
            <div
              key={i}
              style={{
                background: sc.bg,
                border: `1px solid ${sc.border}`,
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: "0.70rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {item.nombre}
                </span>
                <SemaforoCircle s={item.semaforo} size={12} />
              </div>

              {item.valor !== null ? (
                <>
                  <div
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: 800,
                      color: sc.text,
                      lineHeight: 1.1,
                    }}
                  >
                    {item.valor.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                    <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#64748b", marginLeft: 4 }}>
                      {item.unidad}
                    </span>
                  </div>
                  {item.capacidad !== null && (
                    <div style={{ marginTop: 6 }}>
                      <div
                        style={{
                          height: 6,
                          background: "#e2e8f0",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(item.pctOcupacion ?? 0, 100)}%`,
                            background: item.semaforo === "verde" ? "#22c55e" : item.semaforo === "amarillo" ? "#f59e0b" : "#ef4444",
                            borderRadius: 3,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 3,
                          fontSize: "0.65rem",
                          color: "#64748b",
                        }}
                      >
                        <span>Cap: {item.capacidad.toLocaleString("es-CO", { maximumFractionDigits: 0 })} {item.unidad}</span>
                        <span style={{ fontWeight: 700, color: sc.text }}>
                          {fmtPct(item.pctOcupacion ?? 0)} ocupado
                        </span>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: 2 }}>{item.nota}</div>
                </>
              ) : (
                <div
                  style={{
                    fontSize: "0.70rem",
                    color: "#94a3b8",
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  Requiere imagen Power BI
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recomendaciones Ejecutivas Section ──
function RecomendacionesSection({ items }: { items: RecomendacionEjecutiva[] }) {
  const nivelConfig = {
    rojo: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", icon: "🔴", label: "CRÍTICO" },
    amarillo: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "⚠️", label: "ATENCIÓN" },
    verde: { bg: "#f0fdf4", border: "#86efac", text: "#15803d", icon: "✅", label: "POSITIVO" },
    info: { bg: "#f0f9ff", border: "#bae6fd", text: "#0c4a6e", icon: "📅", label: "INFO" },
  };

  // Ordenar: rojo → amarillo → verde → info
  const orden = { rojo: 0, amarillo: 1, verde: 2, info: 3 };
  const sorted = [...items].sort((a, b) => orden[a.nivel] - orden[b.nivel]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderTop: "none",
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, #1a237e 0%, #283593 100%)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.82rem",
          letterSpacing: "0.08em",
          padding: "7px 12px",
          textTransform: "uppercase",
        }}
      >
        ▶ RECOMENDACIONES EJECUTIVAS
      </div>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((rec, i) => {
          const cfg = nivelConfig[rec.nivel];
          return (
            <div
              key={i}
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 8,
                padding: "9px 14px",
                fontSize: "0.8rem",
                color: cfg.text,
                lineHeight: 1.5,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
              <div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginRight: 8,
                    opacity: 0.7,
                  }}
                >
                  [{cfg.label}]
                </span>
                {rec.texto}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Estrategias Comerciales Section ──
function EstrategiasSection({
  estrategias,
  concentracionPorLinea,
}: {
  estrategias: EstrategiaComercial[];
  concentracionPorLinea: ConcentracionPorLinea[];
}) {
  const tipoIcon = { riesgo: "⚠️", oportunidad: "💡", accion: "🎯" };
  const tipoLabel = { riesgo: "RIESGO", oportunidad: "OPORTUNIDAD", accion: "ACCIÓN" };
  const semCfg = {
    rojo: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" },
    amarillo: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
    verde: { bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
  };

  // Ordenar estrategias: rojo → amarillo → verde
  const ordenSem = { rojo: 0, amarillo: 1, verde: 2 };
  const sortedEstrategias = [...estrategias].sort((a, b) => ordenSem[a.semaforo] - ordenSem[b.semaforo]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderTop: "none",
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, #1a237e 0%, #283593 100%)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.82rem",
          letterSpacing: "0.08em",
          padding: "7px 12px",
          textTransform: "uppercase",
        }}
      >
        ▶ ESTRATEGIAS COMERCIALES
      </div>

      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Columna izquierda: alertas estratégicas */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Análisis Estratégico
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedEstrategias.map((e, i) => {
              const cfg = semCfg[e.semaforo];
              return (
                <div
                  key={i}
                  style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: "0.79rem",
                    color: cfg.text,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{tipoIcon[e.tipo]}</span>
                    <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.7 }}>
                      [{tipoLabel[e.tipo]}]
                    </span>
                    <span style={{ fontSize: "0.82rem" }}>{e.titulo}</span>
                  </div>
                  <div style={{ lineHeight: 1.5, color: "#374151", fontSize: "0.77rem" }}>{e.detalle}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna derecha: concentración por línea separada */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Concentración por Línea (% dentro de cada línea)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...concentracionPorLinea].sort((a, b) => {
              const orden = { "BENEFICIO": 0, "DESPOSTE": 1, "CORTES": 2, "SC": 3 };
              const aOrd = orden[a.linea.toUpperCase() as keyof typeof orden] ?? 99;
              const bOrd = orden[b.linea.toUpperCase() as keyof typeof orden] ?? 99;
              return aOrd - bOrd;
            }).map((linConc, li) => (
              <div key={li}>
                {/* Header de la línea */}
                <div
                  style={{
                    background: "#1a237e",
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: "6px 6px 0 0",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{linConc.linea.toUpperCase()}</span>
                  <span style={{ opacity: 0.8, fontWeight: 400 }}>
                    HHI: {linConc.hhiLinea.toFixed(0)}
                    {linConc.hhiLinea > 2500 ? " — Alta conc." : linConc.hhiLinea > 1500 ? " — Moderada" : " — Baja"}
                  </span>
                </div>
                {/* Top clientes de la línea */}
                <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
                  {linConc.top.map((c, ci) => {
                    const cfg = semCfg[c.semaforo];
                    return (
                      <div
                        key={ci}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 10px",
                          background: ci % 2 === 0 ? "#f8fafc" : "#fff",
                          borderBottom: ci < linConc.top.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <SemaforoCircle s={c.semaforo} size={9} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.principal.length > 32 ? c.principal.slice(0, 32) + "…" : c.principal}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: cfg.text }}>
                            {fmtPct(c.pct)}
                          </span>
                          <span style={{ fontSize: "0.65rem", color: "#94a3b8", marginLeft: 4 }}>
                            {c.volumen.toLocaleString("es-CO", { maximumFractionDigits: 0 })} {linConc.unidad}
                          </span>
                        </div>
                        {/* Barra */}
                        <div style={{ width: 50, flexShrink: 0 }}>
                          <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(c.pct, 100)}%`,
                                background: c.semaforo === "verde" ? "#22c55e" : c.semaforo === "amarillo" ? "#f59e0b" : "#ef4444",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
interface CeoReportProps {
  data: CeoReportData;
}

export default function CeoReport({ data }: CeoReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const exportMutation = trpc.upload.exportCeoExcel.useMutation();

  const handlePrint = () => {
    const el = reportRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) { toast.error("Permite pop-ups para exportar el PDF"); return; }
    const styles = Array.from(document.styleSheets)
      .map(ss => {
        try { return Array.from(ss.cssRules).map(r => r.cssText).join("\n"); } catch { return ""; }
      })
      .join("\n");
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Reporte CEO — Colbeef ${data.fecha}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>
        ${styles}
        @page { size: 8.5in 13in; margin: 6mm 8mm; }
        @media print {
          * { font-size: 0.9rem !important; line-height: 1.3 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', sans-serif; background: #fff; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; width: 100% !important; border-collapse: collapse; font-size: 0.85rem !important; }
          tr { page-break-inside: avoid; }
          th, td { padding: 3px 5px !important; font-size: 0.85rem !important; overflow: visible !important; white-space: normal !important; word-break: break-word !important; }
          thead { display: table-header-group; }
          h1, h2, h3, h4, h5, h6 { margin: 2px 0 !important; font-size: 0.95rem !important; }
          p, span, div { orphans: 2; widows: 2; margin: 2px 0 !important; }
        }
        body { font-family: 'Inter', sans-serif; background: #fff; margin: 0; padding: 0; }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 800);
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportMutation.mutateAsync({ ceoReport: data });
      const a = document.createElement("a");
      a.href = result.url;
      a.download = `reporte-ceo-${data.fecha.replace(/\//g, "-")}.xlsx`;
      a.click();
      toast.success("Excel descargado correctamente");
    } catch {
      toast.error("Error al exportar el Excel");
    }
  };

  const headerStyle: React.CSSProperties = {
    background: "#1a237e",
    color: "#fff",
    padding: "4px 8px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f8fafc", padding: "0 0 8px 0" }}>
      {/* Botones de acción */}
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-end" }}>
        <button
          onClick={handlePrint}
          style={{
            background: "#1a237e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          🖨️ Exportar PDF
        </button>
        <button
          onClick={handleExportExcel}
          disabled={exportMutation.isPending}
          style={{
            background: "#2e7d32",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: exportMutation.isPending ? 0.7 : 1,
          }}
        >
          📊 {exportMutation.isPending ? "Generando..." : "Exportar Excel"}
        </button>
      </div>

      {/* Reporte */}
      <div ref={reportRef}>
        {/* Header corporativo */}
        <div
          style={{
            background: "linear-gradient(135deg, #1a237e 0%, #2e7d32 100%)",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.05em" }}>
              COLBEEF S.A.S. — REPORTE CEO
            </div>
            <div style={{ fontSize: "0.7rem", opacity: 0.85, marginTop: 1 }}>
              Administración en Una Página · Khadem & Lorber
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>📅 {data.fecha}</div>
            <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>
              {data.diasTransc}/{data.diasMes} días
            </div>
          </div>
        </div>

        {/* Leyenda semáforos */}
        <div
          style={{
            background: "#fff",
            borderLeft: "3px solid #1a237e",
            padding: "6px 16px",
            display: "flex",
            gap: 20,
            alignItems: "center",
            fontSize: "0.73rem",
            color: "#475569",
            border: "1px solid #e2e8f0",
            borderTop: "none",
          }}
        >
          <strong style={{ color: "#1e293b" }}>SEMÁFORO:</strong>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SemaforoCircle s="verde" /> ≥ 100% (Excelente)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SemaforoCircle s="amarillo" /> 85-99% (En riesgo)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SemaforoCircle s="rojo" /> &lt; 85% (Crítico)
          </span>

        </div>

        {/* Tabla principal de FCE */}
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderTop: "none" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr>
                <th style={{ ...headerStyle, textAlign: "left", width: "20%" }}>FACTOR CLAVE DE ÉXITO</th>
                <th style={{ ...headerStyle, width: "6%" }}>UNIDAD</th>
                <th style={{ ...headerStyle, width: "7%" }}>STATUS DÍA</th>
                <th style={{ ...headerStyle, width: "7%" }}>META DÍA</th>
                <th style={{ ...headerStyle, width: "6%" }}>% DÍA</th>
                <th style={{ ...headerStyle, width: "7%" }}>STATUS ACUM.</th>
                <th style={{ ...headerStyle, width: "7%" }}>META ACUM.</th>
                <th style={{ ...headerStyle, width: "6%" }}>% ACUM.</th>
                <th style={{ ...headerStyle, textAlign: "left", width: "34%" }}>COMENTARIOS (DÍA / ACUM.)</th>
              </tr>
            </thead>
            <tbody>
              {data.areas.map((area) => (
                <>
                  <AreaHeader key={`h-${area.nombre}`} nombre={area.nombre} />
                  {area.factores.map((f, i) => (
                    <FceRow
                      key={`${area.nombre}-${i}`}
                      f={f}
                      isSubtotal={f.factor === "Total Operaciones"}
                    />
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inventarios */}
        <InventariosSection items={data.inventarios ?? []} />

        {/* Alertas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 6,
          }}
        >
          {/* Desfasados */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#c0392b",
                color: "#fff",
                padding: "7px 14px",
                fontWeight: 700,
                fontSize: "0.8rem",
                letterSpacing: "0.06em",
              }}
            >
              ⬇ TOP DESFASADOS DEL DÍA
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr style={{ background: "#fee2e2" }}>
                  <th style={{ padding: "4px 10px", textAlign: "left", color: "#7f1d1d", fontWeight: 600 }}>Principal</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", color: "#7f1d1d", fontWeight: 600 }}>Línea / Canal</th>
                  <th style={{ padding: "4px 8px", textAlign: "right", color: "#7f1d1d", fontWeight: 600 }}>Diferencia</th>
                  <th style={{ padding: "4px 8px", textAlign: "right", color: "#7f1d1d", fontWeight: 600 }}>% Desv.</th>
                </tr>
              </thead>
              <tbody>
                {data.alertasDesfasados.map((a, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #fee2e2", background: i % 2 === 0 ? "#fff" : "#fff7f7" }}>
                    <td style={{ padding: "4px 10px", fontWeight: 600, color: "#1e293b" }}>
                      {a.principal.length > 30 ? a.principal.slice(0, 30) + "…" : a.principal}
                    </td>
                    <td style={{ padding: "4px 8px", color: "#475569" }}>{a.linea} / {a.canal}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", color: "#b91c1c", fontWeight: 700 }}>
                      {Math.round(a.diff).toLocaleString("es-CO", { maximumFractionDigits: 0 })} {a.unidad}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", color: "#b91c1c", fontWeight: 700 }}>
                      {fmtPct(a.pct)}
                    </td>
                  </tr>
                ))}
                {data.alertasDesfasados.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "8px 10px", color: "#94a3b8", textAlign: "center" }}>Sin desfases</td></tr>
                )}
              </tbody>
            </table>
          </div>

        {/* Tabla FCE */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px 8px 0 0",
            overflow: "hidden",
            marginTop: 6,
          }}
        >
          <div
              style={{
                background: "#2e7d32",
                color: "#fff",
                padding: "7px 14px",
                fontWeight: 700,
                fontSize: "0.8rem",
                letterSpacing: "0.06em",
              }}
            >
              ⬆ TOP SOBRE-CUMPLIDOS DEL DÍA
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr style={{ background: "#dcfce7" }}>
                  <th style={{ padding: "4px 10px", textAlign: "left", color: "#14532d", fontWeight: 600 }}>Principal</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", color: "#14532d", fontWeight: 600 }}>Línea / Canal</th>
                  <th style={{ padding: "4px 8px", textAlign: "right", color: "#14532d", fontWeight: 600 }}>Diferencia</th>
                  <th style={{ padding: "4px 8px", textAlign: "right", color: "#14532d", fontWeight: 600 }}>% Desv.</th>
                </tr>
              </thead>
              <tbody>
                {data.alertasSobrecumplidos.map((a, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #dcfce7", background: i % 2 === 0 ? "#fff" : "#f0fdf4" }}>
                    <td style={{ padding: "4px 10px", fontWeight: 600, color: "#1e293b" }}>
                      {a.principal.length > 30 ? a.principal.slice(0, 30) + "…" : a.principal}
                    </td>
                    <td style={{ padding: "4px 8px", color: "#475569" }}>{a.linea} / {a.canal}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", color: "#15803d", fontWeight: 700 }}>
                      +{Math.round(a.diff).toLocaleString("es-CO", { maximumFractionDigits: 0 })} {a.unidad}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", color: "#15803d", fontWeight: 700 }}>
                      {fmtPct(a.pct)}
                    </td>
                  </tr>
                ))}
                {data.alertasSobrecumplidos.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "8px 10px", color: "#94a3b8", textAlign: "center" }}>Sin sobre-cumplimientos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recomendaciones Ejecutivas */}
        <div style={{ marginTop: 6 }}>
          <RecomendacionesSection items={data.recomendaciones ?? []} />
        </div>

        {/* Estrategias Comerciales */}
        <div style={{ marginTop: 6 }}>
          <EstrategiasSection
            estrategias={data.estrategiasComerciales ?? []}
            concentracionPorLinea={data.concentracionPorLinea ?? []}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            background: "#1e293b",
            color: "#94a3b8",
            padding: "6px 14px",
            fontSize: "0.65rem",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "0 0 8px 8px",
            marginTop: 6,
          }}
        >
          <span>COLBEEF S.A.S. — Confidencial · Solo para uso interno de la Gerencia General</span>
          <span>Generado automáticamente · {new Date().toLocaleString("es-CO")}</span>
        </div>
      </div>
    </div>
  );
}
