import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { filterReportAlerts } from "@shared/reportFilters";

interface ReportViewProps {
  data: Record<string, unknown>;
  reportId?: number | null;
}

function toArr(v: unknown): unknown[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return Object.values(v as object);
  if (typeof v === "string") return v.trim() ? [v] : [];
  return [];
}

function fmtCOP(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `$${Math.round(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })}M`;
}

function semClass(pct: number): "v" | "a" | "r" {
  if (pct >= 100) return "v";
  if (pct >= 95) return "a";
  return "r";
}

function semColor(pct: number): string {
  if (pct >= 100) return "#1b5e20";
  if (pct >= 95) return "#e65100";
  return "#b71c1c";
}

function semBg(pct: number): string {
  if (pct >= 100) return "#e8f5e9";
  if (pct >= 95) return "#fff3e0";
  return "#ffebee";
}

function fmtN(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function fmtPct(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0").replace("%", ""));
  return `${Math.round(Number.isFinite(n) ? n : 0)}%`;
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct >= 100) return <TrendingUp size={12} style={{ color: "#1b5e20", flexShrink: 0 }} />;
  if (pct >= 95) return <Minus size={12} style={{ color: "#e65100", flexShrink: 0 }} />;
  return <TrendingDown size={12} style={{ color: "#b71c1c", flexShrink: 0 }} />;
}

function PctBadge({ pct }: { pct: number }) {
  const p = typeof pct === "number" ? pct : parseFloat(String(pct)) || 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 20,
      fontSize: "0.78rem", fontWeight: 800,
      fontFamily: "'Barlow Condensed', sans-serif",
      background: semBg(p), color: semColor(p),
      border: `1px solid ${semColor(p)}30`,
    }}>
      <TrendIcon pct={p} />
      {fmtPct(p)}
    </span>
  );
}

function KpiCard({ icon, label, value, sub, pct }: { icon: string; label: string; value: unknown; sub?: string; pct?: number }) {
  const p = pct ?? 0;
  const borderColor = pct != null ? semColor(p) : "#dde0e3";
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "0.9rem 1rem",
      border: `1px solid ${borderColor}30`,
      borderTop: `3px solid ${borderColor}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: "0.25rem",
    }}>
      <div style={{ fontSize: "0.68rem", color: "#78909c", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", lineHeight: 1, color: pct != null ? semColor(p) : "#1a237e" }}>
        {String(value ?? "—")}
      </div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#90a4ae" }}>{sub}</div>}
      {pct != null && (
        <div style={{ marginTop: "0.3rem" }}>
          <div style={{ height: 5, background: "#eceff1", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(p, 100)}%`, background: semColor(p), borderRadius: 3, transition: "width 0.6s ease" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children, color = "#1a237e" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.4rem 0.9rem", borderRadius: 6,
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: "0.9rem", fontWeight: 800,
      letterSpacing: "1px", textTransform: "uppercase",
      marginBottom: "0.7rem", color: "#fff",
      background: color,
    }}>
      {children}
    </div>
  );
}

function AlertCard({ alert }: { alert: Record<string, unknown> }) {
  const nivel = String(alert.nivel || "");
  const isRed = nivel === "rojo";
  const isAmb = nivel === "amarillo";
  const borderColor = isRed ? "#c62828" : isAmb ? "#e65100" : "#2e7d32";
  const bg = isRed ? "#fff5f5" : isAmb ? "#fffde7" : "#f1f8e9";
  const icon = isRed ? "🚨" : isAmb ? "⚠️" : "✅";
  return (
    <div style={{ borderLeft: `4px solid ${borderColor}`, borderRadius: "0 8px 8px 0", padding: "0.65rem 0.9rem", marginBottom: "0.5rem", background: bg }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.9rem", color: borderColor, marginBottom: "0.2rem" }}>
        {icon} {String(alert.titulo || "")}
      </div>
      <div style={{ fontSize: "0.82rem", color: "#555", lineHeight: 1.45 }}>{String(alert.descripcion || "")}</div>
    </div>
  );
}

function DataTable({ headers, rows, footer }: {
  headers: { label: string; align?: "left" | "right" }[];
  rows: (string | React.ReactNode)[][];
  footer?: (string | React.ReactNode)[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                background: "#1a237e", color: "#fff",
                padding: "0.4rem 0.65rem",
                textAlign: h.align || "left",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, letterSpacing: "0.4px", fontSize: "0.83rem",
                whiteSpace: "nowrap",
              }}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8f9fa" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "0.35rem 0.65rem",
                  borderBottom: "1px solid #eceff1",
                  textAlign: headers[ci]?.align || "left",
                  verticalAlign: "middle",
                  fontFamily: ci > 0 ? "'Barlow Condensed', sans-serif" : undefined,
                  fontWeight: ci > 0 ? 600 : undefined,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ background: "#e8eaf6", fontWeight: 800 }}>
              {footer.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "0.4rem 0.65rem",
                  textAlign: headers[ci]?.align || "left",
                  fontFamily: ci > 0 ? "'Barlow Condensed', sans-serif" : undefined,
                  fontWeight: 800, fontSize: "0.9rem",
                }}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// Orden canónico de líneas y canales
const LINEA_ORDER = ["Beneficio", "Desposte", "Cortes", "SC"];
const CANAL_ORDER = ["Canal Directo", "Directo", "Canal Distribuidores", "Distribuidores", "Canal Moderno", "Moderno", "Comercializacion", "Comercialización", "Horeca"];

function lineaRank(nombre: string): number {
  const idx = LINEA_ORDER.findIndex(l => nombre.trim().toUpperCase() === l.toUpperCase());
  return idx >= 0 ? idx : 99;
}

function canalRank(canal: string): number {
  const c = canal.trim().toLowerCase();
  if (c.includes("directo") && !c.includes("distribu")) return 0;
  if (c.includes("distribu")) return 1;
  if (c.includes("moderno")) return 2;
  if (c.includes("comercializ")) return 3;
  if (c.includes("horeca")) return 4;
  return 5;
}

function fmtDiff(ejec: number, meta: number, isKg: boolean): string {
  const diff = Math.abs(ejec - meta);
  const unit = isKg ? " kg" : " und";
  const fmtD = diff >= 1000 ? (diff / 1000).toFixed(0) + "K" : diff.toFixed(0);
  return fmtD + unit;
}

function getUnidad(nombre: string): string {
  const n = nombre.trim().toUpperCase();
  if (n.includes("BENEFICIO")) return "reses";
  if (n.includes("DESPOSTE")) return "canales";
  if (n.includes("CORTES")) return "kg";
  if (n === "SC") return "kg";
  return "und";
}

interface PrincipalItem {
  nombre: string;
  ejec: number;
  meta: number;
  diff: number;
  pct: string;
}

function TopPrincipalesCell({ items, linea }: { items: PrincipalItem[]; linea: string }) {
  const unidad = getUnidad(linea);
  if (!items || items.length === 0) return <span style={{ color: "#aaa", fontSize: "0.72rem" }}>Sin datos</span>;
  const desfasados = items.filter((i) => i.diff < 0);
  const sobrecumplidos = items.filter((i) => i.diff > 0);
  const fmtItem = (item: PrincipalItem) => {
    const abs = Math.abs(item.diff);
    const fmtD = abs >= 1000 ? (abs / 1000).toFixed(0) + "K" : abs.toFixed(0);
    return `${item.nombre}: ${item.diff > 0 ? "+" : "-"}${fmtD} ${unidad} (${fmtPct(item.pct)})`;
  };
  return (
    <div style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>
      {sobrecumplidos.length > 0 && (
        <div>
          {sobrecumplidos.map((i, idx) => (
            <div key={idx} style={{ color: "#1b5e20", fontStyle: "italic" }}>
              ⬆ {fmtItem(i)}
            </div>
          ))}
        </div>
      )}
      {desfasados.length > 0 && (
        <div>
          {desfasados.map((i, idx) => (
            <div key={idx} style={{ color: "#b71c1c", fontStyle: "italic" }}>
              ⬇ {fmtItem(i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LineaTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length) return <div style={{ color: "#aaa", fontSize: "0.85rem", padding: "0.5rem" }}>Sin datos.</div>;

  // Orden canónico: Beneficio → Desposte → Cortes → SC
  const sorted = [...rows].sort((a, b) => lineaRank(String(a.nombre || "")) - lineaRank(String(b.nombre || "")));

  const tdStyle: React.CSSProperties = {
    padding: "0.3rem 0.45rem",
    borderBottom: "1px solid #eceff1",
    verticalAlign: "middle",
    whiteSpace: "nowrap" as const,
  };
  const thStyle: React.CSSProperties = {
    background: "#1a237e", color: "#fff",
    padding: "0.35rem 0.45rem",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, letterSpacing: "0.4px", fontSize: "0.8rem",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }}>Línea</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Ejec.Día</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Meta Día</th>
            <th style={{ ...thStyle, textAlign: "right" }}>%Día</th>
            <th style={{ ...thStyle, textAlign: "left", background: "#283593" }}>Comentario Día</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Ejec.Acum</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Meta Acum</th>
            <th style={{ ...thStyle, textAlign: "right" }}>%Acum</th>
            <th style={{ ...thStyle, textAlign: "left", background: "#283593" }}>Comentario Acum.</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, ri) => {
            const dp = parseFloat(String(r.dPct)) || 0;
            const mp = parseFloat(String(r.mPct)) || 0;
            const nombre = String(r.nombre || "");
            const dTop = (r.dTop as PrincipalItem[]) || [];
            const mTop = (r.mTop as PrincipalItem[]) || [];
            return (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{nombre}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>{fmtN(r.dEjec as number)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>{fmtN(r.dMeta as number)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}><PctBadge pct={dp} /></td>
                <td style={{ ...tdStyle, background: "#f9fbe7", maxWidth: 220, whiteSpace: "normal" as const }}><TopPrincipalesCell items={dTop} linea={nombre} /></td>
                <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>{fmtN(r.mEjec as number)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>{fmtN(r.mMeta as number)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}><PctBadge pct={mp} /></td>
                <td style={{ ...tdStyle, background: "#f9fbe7", maxWidth: 220, whiteSpace: "normal" as const }}><TopPrincipalesCell items={mTop} linea={nombre} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LineaCanalTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length) return <div style={{ color: "#aaa", fontSize: "0.85rem", padding: "0.5rem" }}>Sin datos.</div>;

  // Orden canónico: líneas Beneficio→Desposte→Cortes→SC, canales Directo→Distribuidores→Moderno→Comercialización→Horeca
  const sortedRows = [...rows].sort((a, b) => {
    const la = lineaRank(String(a.linea || ""));
    const lb = lineaRank(String(b.linea || ""));
    if (la !== lb) return la - lb;
    return canalRank(String(a.canal || "")) - canalRank(String(b.canal || ""));
  });

  const lineaTotals: Record<string, { dEjec: number; dMeta: number; mEjec: number; mMeta: number }> = {};
  sortedRows.forEach((r) => {
    const l = String(r.linea || "");
    if (!lineaTotals[l]) lineaTotals[l] = { dEjec: 0, dMeta: 0, mEjec: 0, mMeta: 0 };
    lineaTotals[l].dEjec += (r.dEjec as number) || 0;
    lineaTotals[l].dMeta += (r.dMeta as number) || 0;
    lineaTotals[l].mEjec += (r.mEjec as number) || 0;
    lineaTotals[l].mMeta += (r.mMeta as number) || 0;
  });

  let lastLinea = "";
  const tableRows: React.ReactNode[][] = [];

  sortedRows.forEach((r, i) => {
    const linea = String(r.linea || "");
    const canal = String(r.canal || "");
    const dp = parseFloat(String(r.dPct)) || 0;
    const mp = parseFloat(String(r.mPct)) || 0;
    const isNewLinea = linea !== lastLinea;
    if (isNewLinea) {
      lastLinea = linea;
      const lt = lineaTotals[linea];
      const ldp = lt?.dMeta > 0 ? (lt.dEjec / lt.dMeta) * 100 : 0;
      const lmp = lt?.mMeta > 0 ? (lt.mEjec / lt.mMeta) * 100 : 0;
      tableRows.push([
        <td key={`h-${i}`} colSpan={9} style={{
          background: `${semBg(lmp)}`,
          padding: "0.4rem 0.65rem",
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: "0.88rem", fontWeight: 800,
          color: semColor(lmp), letterSpacing: "0.5px",
          textTransform: "uppercase", borderBottom: `2px solid ${semColor(lmp)}30`,
        }}>
          ▸ {linea} &nbsp;
          <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#666" }}>
            Día: {fmtN(lt?.dEjec)}/{fmtN(lt?.dMeta)} <PctBadge pct={ldp} /> ·
            Acum: {fmtN(lt?.mEjec)}/{fmtN(lt?.mMeta)} <PctBadge pct={lmp} />
          </span>
        </td>
      ] as unknown as React.ReactNode[]);
    }
    const dTopCanal = (r.dTop as PrincipalItem[]) || [];
    const mTopCanal = (r.mTop as PrincipalItem[]) || [];
    tableRows.push([
      <span key="c" style={{ paddingLeft: "1rem", color: "#546e7a", fontSize: "0.79rem" }}>{canal}</span>,
      fmtN(r.dEjec as number),
      fmtN(r.dMeta as number),
      <PctBadge key="dp" pct={dp} />,
      <TopPrincipalesCell key="cdia" items={dTopCanal} linea={linea} />,
      fmtN(r.mEjec as number),
      fmtN(r.mMeta as number),
      <PctBadge key="mp" pct={mp} />,
      <TopPrincipalesCell key="cacum" items={mTopCanal} linea={linea} />,
    ]);
  });

  const thS: React.CSSProperties = {
    background: "#1a237e", color: "#fff",
    padding: "0.32rem 0.4rem",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, letterSpacing: "0.4px", fontSize: "0.78rem",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.79rem" }}>
        <thead>
          <tr>
            <th style={{ ...thS, textAlign: "left" }}>Línea / Canal</th>
            <th style={{ ...thS, textAlign: "right" }}>Ejec.Día</th>
            <th style={{ ...thS, textAlign: "right" }}>Meta Día</th>
            <th style={{ ...thS, textAlign: "right" }}>%Día</th>
            <th style={{ ...thS, textAlign: "left", background: "#283593" }}>Coment. Día</th>
            <th style={{ ...thS, textAlign: "right" }}>Ejec.Acum</th>
            <th style={{ ...thS, textAlign: "right" }}>Meta Acum</th>
            <th style={{ ...thS, textAlign: "right" }}>%Acum</th>
            <th style={{ ...thS, textAlign: "left", background: "#283593" }}>Coment. Acum.</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, ri) => {
            if (row.length === 1 && (row[0] as React.ReactElement)?.type === "td") {
              return <tr key={ri}>{row[0] as React.ReactNode}</tr>;
            }
            return (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                {(row as React.ReactNode[]).map((cell, ci) => (
                  <td key={ci} style={{
                    padding: "0.28rem 0.4rem",
                    borderBottom: "1px solid #eceff1",
                    textAlign: [1, 2, 5, 6].includes(ci) ? "right" : "left",
                    verticalAlign: "middle",
                    fontFamily: [1, 2, 5, 6].includes(ci) ? "'Barlow Condensed', sans-serif" : undefined,
                    fontWeight: [1, 2, 5, 6].includes(ci) ? 600 : undefined,
                    maxWidth: [4, 8].includes(ci) ? 160 : undefined,
                    whiteSpace: [4, 8].includes(ci) ? "normal" as const : "nowrap" as const,
                  }}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IngresosTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length) return <div style={{ color: "#aaa", fontSize: "0.85rem", padding: "0.5rem" }}>Sin datos de ingresos.</div>;
  const sorted = [...rows].sort((a, b) => ((b.mEjec as number) || 0) - ((a.mEjec as number) || 0));
  const tD: { dE: number; dM: number; mE: number; mM: number } = sorted.reduce(
    (acc: { dE: number; dM: number; mE: number; mM: number }, r) => ({
      dE: acc.dE + ((r.dEjec as number) || 0),
      dM: acc.dM + ((r.dMeta as number) || 0),
      mE: acc.mE + ((r.mEjec as number) || 0),
      mM: acc.mM + ((r.mMeta as number) || 0),
    }),
    { dE: 0, dM: 0, mE: 0, mM: 0 }
  );
  const headers = [
    { label: "Unidad de Negocio" },
    { label: "Ejec. Día", align: "right" as const },
    { label: "Meta Día", align: "right" as const },
    { label: "% Día", align: "right" as const },
    { label: "Ejec. Acum.", align: "right" as const },
    { label: "Meta Acum.", align: "right" as const },
    { label: "% Acum.", align: "right" as const },
  ];
  const tableRows = sorted.map(r => {
    const dp = parseFloat(String(r.dPct)) || 0;
    const mp = parseFloat(String(r.mPct)) || 0;
    return [
      <strong key="n">{String(r.nombre || "")}</strong>,
      fmtCOP(r.dEjec as number),
      fmtCOP(r.dMeta as number),
      <PctBadge key="dp" pct={dp} />,
      fmtCOP(r.mEjec as number),
      fmtCOP(r.mMeta as number),
      <PctBadge key="mp" pct={mp} />,
    ];
  });
  const tdp = tD.dM > 0 ? tD.dE / tD.dM * 100 : 0;
  const tmp = tD.mM > 0 ? tD.mE / tD.mM * 100 : 0;
  const footer = [
    "TOTAL",
    fmtCOP(tD.dE), fmtCOP(tD.dM), <PctBadge key="tdp" pct={tdp} />,
    fmtCOP(tD.mE), fmtCOP(tD.mM), <PctBadge key="tmp" pct={tmp} />,
  ];
  return <DataTable headers={headers} rows={tableRows} footer={footer} />;
}

const SECTION_COLORS = {
  blue: "#1565c0",
  red: "#b71c1c",
  green: "#1b5e20",
  amber: "#e65100",
  navy: "#1a237e",
  teal: "#004d40",
  purple: "#4a148c",
  darkblue: "#0d47a1",
  indigo: "#283593",
};

export default function ReportView({ data: d, reportId }: ReportViewProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!reportRef.current) return;

    // Clonar el HTML del reporte
    const reportHTML = reportRef.current.outerHTML;

    // Recopilar todos los estilos de la página actual
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          // Hojas de estilo cross-origin: usar el link original
          if (sheet.href) return `@import url('${sheet.href}');`;
          return "";
        }
      })
      .join("\n");

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Colbeef_Informe_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700;800&family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <style>
          ${styles}
          @page { size: A4 landscape; margin: 10mm 8mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fff; font-family: 'Barlow', sans-serif; font-size: 10px; }
          .no-print { display: none !important; }
          .print-report-wrapper { width: 100% !important; max-width: 100% !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          td, th { white-space: normal !important; word-break: break-word !important; }
        </style>
      </head>
      <body>
        ${reportHTML}
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 800);
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const ind = (d.indicadores_generales || {}) as Record<string, unknown>;
  const dop = (d.dias_operativos || {}) as Record<string, unknown>;
  const des = (d.desempeno || {}) as Record<string, unknown>;
  const ic = (d.inventario_carnes || {}) as Record<string, unknown>;
  const ae = (d.analisis_excel || {}) as Record<string, unknown>;
  const prods = toArr(d.productos_inventario) as Record<string, unknown>[];
  const alertas = filterReportAlerts(d.alertas);
  const recs = toArr(d.recomendaciones) as Record<string, unknown>[];
  const comp = toArr(d.comportamiento_metas) as string[];

  const allInsights: string[] = [
    ...toArr(ae.hallazgos_lineas).map(h => `📐 ${h}`),
    ...toArr(ae.hallazgos_canales).map(h => `🚚 ${h}`),
    ...toArr(ae.riesgos_criticos).map(h => `🔴 ${h}`),
    ...toArr(ae.oportunidades).map(h => `🟢 ${h}`),
  ];

  const medPct = parseFloat(String(ind.inv_medias_pct || "0")) || 0;
  const visPct = parseFloat(String(ind.inv_visceras_pct || "0")) || 0;

  const card: React.CSSProperties = {
    background: "#fff",
    padding: "1.1rem 1.4rem",
    borderTop: "1px solid #e8eaf6",
    marginBottom: 0,
  };

  const gridTwo: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.2rem",
  };

  return (
    <>
      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          @page { size: 8.5in 13in; margin: 10mm 8mm; }

          /* Ocultar chrome de la app */
          .no-print,
          [data-sidebar],
          nav, header, aside,
          [class*="sidebar"],
          [class*="Sidebar"] { display: none !important; }

          /* Reset body */
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-size: 11px !important;
          }

          /* El wrapper del reporte ocupa todo el ancho */
          .print-report-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          /* Forzar colores de impresión */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Tablas: no cortar filas entre páginas */
          table { page-break-inside: auto; width: 100% !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }

          /* Secciones: evitar cortes en medio de un bloque */
          .print-section { page-break-inside: avoid; }

          /* Textos y badges: no truncar */
          td, th { white-space: normal !important; word-break: break-word !important; }

          /* Columnas de comentario: ancho suficiente */
          td[style*="maxWidth"] { max-width: none !important; }
        }
      `}</style>

      {/* ── WRAPPER (only this is printed) ── */}
      <div ref={reportRef} className="print-report-wrapper" style={{ background: "#f4f6f8", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}>

        {/* ══ REPORT HEADER ══ */}
        <div style={{
          background: "linear-gradient(135deg, #0d1b2a 0%, #1a237e 60%, #283593 100%)",
          padding: "1.5rem 2rem 1.3rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.8rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3rem", lineHeight: 1 }}>
              <span style={{ color: "#69f0ae" }}>Col</span><span style={{ color: "#ff5252" }}>beef</span>
            </div>
            <span style={{ fontSize: "2rem" }}>🐄</span>
            <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.2)", margin: "0 0.5rem" }} />
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.4rem", fontWeight: 800, color: "#fff", letterSpacing: 1, textTransform: "uppercase", lineHeight: 1.1 }}>
                Informe Ejecutivo
              </div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem", color: "#90caf9", letterSpacing: 2, textTransform: "uppercase" }}>
                {String(d.tipo_reporte || "Datos Generales")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
            <div style={{ background: "rgba(255,255,255,0.12)", padding: "0.3rem 0.9rem", borderRadius: 20, fontSize: "0.9rem", color: "#e3f2fd", fontWeight: 600 }}>
              📅 {String(d.fecha || "—")} · 🕐 {String(d.hora || "—")}
            </div>
            <button
              onClick={handlePrint}
              className="no-print"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0.35rem 1rem", borderRadius: 8,
                background: "rgba(255,255,255,0.15)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.3)",
                fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.5px",
              }}
            >
              <Printer size={14} /> EXPORTAR PDF
            </button>
          </div>
        </div>

        {/* ══ 1. KPIs GENERALES ══ */}
        <div style={{ ...card, background: "#fff" }}>
          <SectionHeader color={SECTION_COLORS.navy}>📊 Indicadores Generales del Día</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.8rem" }}>
            {[
              { icon: "🐄", label: "Meta del día beneficio", value: ind.reses_planilladas_meta },
              { icon: "🔪", label: "Meta del día desposte", value: ind.canales_dia_meta },
              { icon: "🐄", label: "Composición de beneficio", value: `${ind.hembras ?? "—"}🐄 / ${ind.machos ?? "—"}🐂`, sub: "Hembras / Machos" },
            ].map((k, i) => <KpiCard key={i} {...k} />)}
          </div>

          {/* Barras de inventario */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
            {[
              { label: "🏭 Inv. Medias", val: ind.inv_medias_canales, cap: ind.inv_medias_cap, pct: medPct, pctStr: ind.inv_medias_pct },
              { label: "😀 Inv. Vísceras", val: ind.inv_visceras, cap: ind.inv_visceras_cap, pct: visPct, pctStr: ind.inv_visceras_pct, visceraNeta: ind.visceraNeta },
            ].map((bar, i) => (
              <div key={i} style={{ background: "#f8f9fa", borderRadius: 8, padding: "0.7rem 0.9rem", border: "1px solid #eceff1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#546e7a", textTransform: "uppercase", letterSpacing: "0.5px" }}>{bar.label}</span>
                  <PctBadge pct={bar.pct} />
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1a237e", fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {String(bar.val ?? "—")} <span style={{ fontSize: "0.78rem", color: "#90a4ae", fontWeight: 400 }}>/ cap. {String(bar.cap ?? "—")}</span>
                </div>
                {bar.visceraNeta != null && (
                  <div style={{ fontSize: "0.75rem", color: "#546e7a", marginTop: "0.3rem", fontStyle: "italic" }}>
                    Vísceras anteriores: {String(bar.visceraNeta ?? "—")} und
                  </div>
                )}
                <div style={{ height: 6, background: "#eceff1", borderRadius: 3, marginTop: "0.4rem", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(bar.pct, 100)}%`, background: semColor(bar.pct), borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ 2. ALERTAS + DESEMPEÑO ══ */}
        <div style={{ ...card, ...gridTwo }}>
          <div>
            <SectionHeader color={SECTION_COLORS.red}>🚨 Alertas del Día</SectionHeader>
            {alertas.length
              ? alertas.map((a, i) => <AlertCard key={i} alert={a as Record<string, unknown>} />)
              : <div style={{ color: "#aaa", fontSize: "0.85rem", padding: "0.5rem" }}>Sin alertas críticas.</div>}
          </div>
          <div>
            <SectionHeader color={SECTION_COLORS.green}>✅ Desempeño Operativo</SectionHeader>
            {[
              { tit: "🐄 Sacrificio Día Ant.", real: des.sacrificio_dia_ant_real, ppto: des.sacrificio_dia_ant_ppto, pct: des.sacrificio_dia_ant_pct },
              { tit: "📅 Beneficio del Mes", real: des.beneficio_mes_real, ppto: des.beneficio_mes_ppto, pct: des.beneficio_mes_pct },
              { tit: "🔪 Desposte Día Ant.", real: des.desposte_dia_ant_real, ppto: des.desposte_dia_ant_ppto, pct: des.desposte_dia_ant_pct },
              { tit: "📦 Desposte del Mes", real: des.desposte_mes_real, ppto: des.desposte_mes_ppto, pct: des.desposte_mes_pct },
            ].map((item, i) => {
              const p = parseFloat(String(item.pct || "0")) || 0;
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.6rem", borderRadius: 6, marginBottom: "0.4rem", background: semBg(p), border: `1px solid ${semColor(p)}20` }}>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#2c3e50" }}>{item.tit}</div>
                    <div style={{ fontSize: "0.75rem", color: "#78909c" }}>Ejec: <strong>{String(item.real ?? "—")}</strong> · Ppto: {String(item.ppto ?? "—")}</div>
                  </div>
                  <PctBadge pct={p} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ 3. TABLA LÍNEAS ══ */}
        <div style={card}>
          <SectionHeader color={SECTION_COLORS.indigo}>📐 Desviaciones por Línea de Negocio — Datos del Excel</SectionHeader>
          <LineaTable rows={(d.tablaLineas as Record<string, unknown>[]) || []} />
        </div>

        {/* ══ 4. TABLA CANALES ══ */}
        <div style={card}>
          <SectionHeader color={SECTION_COLORS.darkblue}>🚚 Desviaciones por Canal de Distribución — Datos del Excel</SectionHeader>
          <LineaCanalTable rows={(d.tablaLineaCanal as Record<string, unknown>[]) || []} />
        </div>

        {/* ══ 5. DÍAS OPERATIVOS + INVENTARIO ══ */}
        <div style={{ ...card, ...gridTwo }}>
          <div>
            <SectionHeader color={SECTION_COLORS.amber}>📅 Días Operativos y Desposte</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.8rem" }}>
              {[
                { tit: "🐄 Beneficio", ejec: dop.beneficio_ejecutados, hab: dop.beneficio_habiles },
                { tit: "🔪 Desposte", ejec: dop.desposte_ejecutados, hab: dop.desposte_habiles },
              ].map((item, i) => (
                <div key={i} style={{ background: "#e3f2fd", borderRadius: 8, padding: "0.6rem 0.8rem", border: "1px solid #bbdefb" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.88rem", color: "#0d47a1", marginBottom: "0.4rem" }}>{item.tit}</div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.62rem", color: "#78909c", textTransform: "uppercase", fontWeight: 700 }}>Ejec.</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: "#1565c0" }}>{String(item.ejec ?? "—")}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.62rem", color: "#78909c", textTransform: "uppercase", fontWeight: 700 }}>Háb.</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: "#546e7a" }}>{String(item.hab ?? "—")}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#f3e5f5", borderRadius: 8, padding: "0.6rem 0.8rem", border: "1px solid #e1bee7" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.88rem", color: "#4a148c", marginBottom: "0.4rem" }}>📐 Kg Desposte Acumulado</div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                {[["Total kg", dop.kg_desposte], ["Congelado", dop.congelado], ["Refrigerado", dop.refrigerado]].map(([l, v], i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.62rem", color: "#78909c", textTransform: "uppercase", fontWeight: 700 }}>{String(l)}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#4a148c" }}>{String(v ?? "—")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <SectionHeader color={SECTION_COLORS.blue}>🏭 Inventarios — Foto Rápida</SectionHeader>
            <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "0.5rem 0.8rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, color: "#1b5e20", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>🏭 TOTAL KILOS</span>
              <strong style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", color: "#1b5e20" }}>{String(ic.total_kilos ?? "—")} kg</strong>
            </div>
            {[["❄️ Congelado", ic.congelado], ["🌡️ Cava/Refrigerado", ic.cava], ["🔪 Cortes", ic.cortes], ["📦 Alistamiento", ic.alistamiento], ["🧪 Subproductos", ic.subproductos], ["🏷️ Etiquetado", ic.etiquetado]]
              .filter(([, v]) => v != null)
              .map(([l, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0.4rem", borderBottom: "1px solid #f0f0f0", fontSize: "0.86rem" }}>
                  <span style={{ color: "#546e7a" }}>{String(l)}</span>
                  <strong style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>{String(v)} kg</strong>
                </div>
              ))}
          </div>
        </div>

        {/* ══ 7. PRODUCTOS + COMPORTAMIENTO ══ */}
        <div style={{ ...card, ...gridTwo }}>
          <div>
            <SectionHeader color={SECTION_COLORS.navy}>📈 Comportamiento de Metas</SectionHeader>
            {comp.map((s, j) => (
              <div key={j} style={{ display: "flex", gap: "0.45rem", padding: "0.32rem 0", fontSize: "0.85rem", color: "#444", borderBottom: "1px solid #f0f0f0", lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0, fontSize: "0.9rem" }}>{"📊🔺💡🔍⚙️📌🎯".split("").filter((_, i) => i % 2 === 0)[j % 7]}</span>
                <span>{String(s)}</span>
              </div>
            ))}
            {allInsights.length > 0 && (
              <div style={{ marginTop: "0.7rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#78909c", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.3rem" }}>📋 Insights del Excel</div>
                {allInsights.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.45rem", padding: "0.28rem 0", fontSize: "0.83rem", color: "#333", borderBottom: "1px solid #f5f5f5", lineHeight: 1.4 }}>{String(s)}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ 8. RECOMENDACIONES ══ */}
        <div style={card}>
          <SectionHeader color={SECTION_COLORS.purple}>🎯 Recomendaciones Ejecutivas</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
            {recs.map((r, i) => {
              const rec = r as Record<string, unknown>;
              return (
                <div key={i} style={{ display: "flex", gap: "0.7rem", padding: "0.7rem", border: "1px solid #e8eaf6", borderRadius: 8, background: "#f8f9ff", borderLeft: "4px solid #c0392b" }}>
                  <div style={{ background: "#c0392b", color: "#fff", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
                    {String(rec.numero ?? i + 1)}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem", fontWeight: 800, color: "#1a237e", marginBottom: "0.2rem" }}>{String(rec.titulo ?? "")}</div>
                    <div style={{ fontSize: "0.82rem", color: "#546e7a", lineHeight: 1.45 }}>{String(rec.detalle ?? "")}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Semáforo */}
          <div style={{ marginTop: "1rem", background: "#f8f9fa", borderRadius: 8, padding: "0.7rem 1rem", border: "1px solid #eceff1" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.88rem", color: "#1a237e", marginBottom: "0.5rem", letterSpacing: "0.5px", textTransform: "uppercase" }}>🚦 Semáforo de Seguimiento</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem" }}>
              {[
                { color: "#1b5e20", bg: "#e8f5e9", label: "Verde ≥ 100% meta proporcional" },
                { color: "#e65100", bg: "#fff3e0", label: "Amarillo 95–99%" },
                { color: "#b71c1c", bg: "#ffebee", label: "Rojo < 95%" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.83rem", fontWeight: 600, color: s.color }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: "linear-gradient(135deg, #0d1b2a, #1a237e)", padding: "0.8rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.85rem", color: "#90caf9", letterSpacing: "0.5px" }}>
            🐄 <strong style={{ color: "#fff" }}>Colbeef</strong> · Análisis generado por IA · {new Date().toLocaleString("es-CO")}
            {reportId && <span style={{ color: "#64b5f6" }}> · Reporte #{reportId}</span>}
          </span>
          <span style={{ fontSize: "0.75rem", color: "#546e7a" }}>Confidencial — Uso interno</span>
        </div>
      </div>
    </>
  );
}
