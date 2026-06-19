import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Upload, FileSpreadsheet, Image as ImageIcon, AlertCircle } from "lucide-react";
import ReportView from "@/components/ReportView";
import * as XLSX from "xlsx";

import CeoReport, { CeoReportData } from "@/components/CeoReport";

interface XlData {
  ultimoDia: string;
  diasTransc: number;
  diasMes: number;
  totalLineas: number;
  totalCanales: number;
  tablaLineas: unknown[];
  tablaLineaCanal: unknown[];
  tablaIngresos: unknown[];
}

export default function Analyzer() {
  const [imgB64, setImgB64] = useState<string | null>(null);
  const [imgMime, setImgMime] = useState<string>("image/jpeg");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgName, setImgName] = useState<string>("");
  const [imgDragOver, setImgDragOver] = useState(false);

  const [xlB64, setXlB64] = useState<string | null>(null);
  const [xlName, setXlName] = useState<string>("");
  const [xlInfo, setXlInfo] = useState<{ ultimoDia: string; totalLineas: number; totalCanales: number } | null>(null);
  const [xlDragOver, setXlDragOver] = useState(false);
  const [xlError, setXlError] = useState<string>("");
  const [xlLoading, setXlLoading] = useState(false);

  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [savedReportId, setSavedReportId] = useState<number | null>(null);
  const [ceoReportData, setCeoReportData] = useState<CeoReportData | null>(null);
  const [showCeoReport, setShowCeoReport] = useState(true); // expandido por defecto

  const imgInputRef = useRef<HTMLInputElement>(null);
  const xlInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = trpc.upload.image.useMutation();
  const uploadExcel = trpc.upload.excel.useMutation();
  const generateReport = trpc.reports.generate.useMutation();
  const utils = trpc.useUtils();

  // ── IMAGE HANDLING ──
  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se aceptan imágenes PNG, JPG o WEBP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImgB64(result.split(",")[1]);
      setImgMime(file.type);
      setImgPreview(result);
      setImgName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImgDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImgDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  }, [loadImage]);

  // ── EXCEL HANDLING (client-side preview) ──
  const parseExcelDate = (v: unknown): Date | null => {
    if (v == null) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === "number" && v > 0) {
      const dc = XLSX.SSF.parse_date_code(v);
      if (!dc) return null;
      return new Date(dc.y, dc.m - 1, dc.d);
    }
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const loadExcel = useCallback((file: File) => {
    setXlError("");
    setXlB64(null);
    setXlName("");
    setXlInfo(null);
    setXlLoading(true);

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setXlError("Solo se aceptan archivos .xlsx o .xls");
      setXlLoading(false);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setXlError("El Excel no puede superar 20 MB");
      setXlLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buf, { type: "array" });
        const sheetNames = wb.SheetNames;
        if (!sheetNames.includes("CONSOLIDADO_BASES_PPTO_EJEC")) {
          setXlError("No se encontró la hoja CONSOLIDADO_BASES_PPTO_EJEC");
          return;
        }
        const ws = wb.Sheets["CONSOLIDADO_BASES_PPTO_EJEC"];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 }) as Record<string, unknown>[];
        const lineas = new Set(rows.map(r => String(r["Linea"] || r["LINEA"] || r["linea"] || "")).filter(Boolean));
        const canales = new Set(rows.map(r => String(r["Canal"] || r["CANAL"] || r["canal"] || "")).filter(Boolean));

        const dates = rows
          .map(r => parseExcelDate(r["Fecha"] || r["FECHA"] || r["fecha"]))
          .filter((d): d is Date => d !== null);
        const lastDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
        const ultimoDia = lastDate
          ? `${String(lastDate.getDate()).padStart(2, "0")}/${String(lastDate.getMonth() + 1).padStart(2, "0")}/${lastDate.getFullYear()}`
          : "—";

        setXlInfo({ ultimoDia, totalLineas: lineas.size, totalCanales: canales.size });

        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        setXlB64(btoa(binary));
        setXlName(file.name);
      } catch (err) {
        setXlError("Error leyendo Excel: " + (err as Error).message);
      } finally {
        setXlLoading(false);
      }
    };
    reader.onerror = () => {
      setXlError("No se pudo leer el archivo Excel");
      setXlLoading(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleXlDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setXlDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadExcel(file);
  }, [loadExcel]);

  // ── GENERATE REPORT ──
  const canGenerate = (imgB64 !== null) || (xlB64 !== null);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (xlLoading) {
      toast.error("Espera a que termine de cargar el Excel");
      return;
    }
    if (xlName && !xlB64) {
      toast.error("El Excel no se cargó correctamente. Vuelve a seleccionarlo.");
      return;
    }
    if (!xlB64) {
      toast.warning("Sube el Excel de seguimiento presupuestal para ver las tablas de desviaciones");
    }

    setReportData(null);
    setSavedReportId(null);
    setCeoReportData(null);

    try {
      let imageUrl: string | undefined;
      let imageKey: string | undefined;
      let excelSummary: string | undefined;

      // Upload image if provided
      if (imgB64) {
        toast.info("Subiendo imagen...");
        const imgResult = await uploadImage.mutateAsync({
          base64: imgB64,
          mimeType: imgMime,
          filename: imgName || "dashboard.jpg",
        });
        imageUrl = imgResult.url;
        imageKey = imgResult.key;
      }

      // Process Excel if provided
      let localXlData: XlData | null = null;
      let localCeoReport: Record<string, unknown> | null = null;
      if (xlB64) {
        toast.info("Procesando Excel...");
        const xlResult = await uploadExcel.mutateAsync({
          base64: xlB64,
          filename: xlName || "datos.xlsx",
        });
        excelSummary = xlResult.summary;
        localXlData = xlResult.xlData as XlData;
        if (xlResult.ceoReport) {
          localCeoReport = xlResult.ceoReport as unknown as Record<string, unknown>;
          setCeoReportData(xlResult.ceoReport as CeoReportData);
        }
      }

      // Generate AI report
      toast.info("Analizando con IA...");
      const result = await generateReport.mutateAsync({
        imageUrl,
        imageKey,
        imageMime: imgMime,
        excelSummary,
        excelBase64: xlB64 ?? undefined,
        excelFilename: xlName || undefined,
        xlData: localXlData ?? undefined,
      });

      const mergedData = result.reportData as Record<string, unknown>;
      setReportData(mergedData);

      // Enriquecer ceoReport con inventarios extraídos por la IA del dashboard
      if (localCeoReport) {
        const aiData = result.reportData as Record<string, unknown>;
        const indGen = (aiData.indicadores_generales ?? {}) as Record<string, string>;
        const invCarnes = (aiData.inventario_carnes ?? {}) as Record<string, string>;

        const parseNum = (v: string | null | undefined): number | null => {
          if (!v) return null;
          const n = parseFloat(String(v).replace(/[.$,]/g, "").replace(",", "."));
          return isNaN(n) ? null : n;
        };

        // Semáforo de CUMPLIMIENTO (meta): verde=bueno cuando es alto
        const semFromPct = (pct: number | null): "verde" | "amarillo" | "rojo" => {
          if (pct === null) return "amarillo";
          if (pct >= 80) return "verde";
          if (pct >= 60) return "amarillo";
          return "rojo";
        };

        // Semáforo de CAPACIDAD (almacenamiento): verde=espacio disponible, rojo=lleno/desbordado
        const semFromCapacidad = (pct: number | null): "verde" | "amarillo" | "rojo" => {
          if (pct === null) return "amarillo";
          if (pct <= 75) return "verde";   // < 75%: hay espacio, sin presión
          if (pct <= 90) return "amarillo"; // 75-90%: atención, se está llenando
          return "rojo";                    // > 90%: crítico, sin espacio
        };

        const mediasVal = parseNum(indGen.inv_medias_canales);
        const mediasCap = parseNum(indGen.inv_medias_cap);
        const mediasPct = mediasCap && mediasVal !== null ? (mediasVal / mediasCap) * 100 : parseNum(indGen.inv_medias_pct?.replace("%", ""));

        const viscerasVal = parseNum(indGen.inv_visceras);
        const viscerasCap = parseNum(indGen.inv_visceras_cap);
        const viscerasPct = viscerasCap && viscerasVal !== null ? (viscerasVal / viscerasCap) * 100 : parseNum(indGen.inv_visceras_pct?.replace("%", ""));

        const corralesVal = parseNum(indGen.reses_corrales);
        const invCarnesVal = parseNum(invCarnes.total_kilos);

        const enrichedCeo = {
          ...localCeoReport,
          inventarios: [
            {
              nombre: "Medias canales",
              valor: mediasVal,
              capacidad: mediasCap,
              pctOcupacion: mediasPct,
              unidad: "canales",
              semaforo: semFromCapacidad(mediasPct),
              nota: mediasVal !== null ? `${Math.round(mediasVal).toLocaleString("es-CO")} de ${mediasCap !== null && mediasCap !== undefined ? Math.round(mediasCap).toLocaleString("es-CO") : "N/D"} cap. — ${mediasPct !== null ? Math.round(mediasPct) + "% ocupado" : ""}` : "Dato disponible con imagen Power BI",
            },
            {
              nombre: "Vísceras",
              valor: viscerasVal,
              capacidad: viscerasCap,
              pctOcupacion: viscerasPct,
              unidad: "und",
              semaforo: semFromCapacidad(viscerasPct),
              nota: viscerasVal !== null ? `${Math.round(viscerasVal).toLocaleString("es-CO")} de ${viscerasCap !== null && viscerasCap !== undefined ? Math.round(viscerasCap).toLocaleString("es-CO") : "N/D"} cap. — ${viscerasPct !== null ? Math.round(viscerasPct) + "% ocupado" : ""}` : "Dato disponible con imagen Power BI",
              visceraNeta: viscerasVal !== null && localCeoReport.inventarios && (localCeoReport.inventarios as Array<{ejecutadoDiaAnterior?: number | null}>).length > 1 && (localCeoReport.inventarios as Array<{ejecutadoDiaAnterior?: number | null}>)[1]?.ejecutadoDiaAnterior ? viscerasVal - ((localCeoReport.inventarios as Array<{ejecutadoDiaAnterior?: number | null}>)[1]?.ejecutadoDiaAnterior ?? 0) : null,
            },
            {
              nombre: "Reses en corrales",
              valor: corralesVal,
              capacidad: null,
              pctOcupacion: null,
              unidad: "reses",
              semaforo: corralesVal !== null ? (corralesVal < 150 ? "rojo" : corralesVal <= 250 ? "amarillo" : "verde") : "amarillo",
              nota: corralesVal !== null ? `${corralesVal.toLocaleString("es-CO")} reses disponibles` : "Dato disponible con imagen Power BI",
            },
            {
              nombre: "Inventario carnes Colbeef",
              valor: invCarnesVal,
              capacidad: null,
              pctOcupacion: null,
              unidad: "kg",
              semaforo: invCarnesVal !== null ? "verde" : "amarillo",
              nota: invCarnesVal !== null ? `Total: ${invCarnesVal.toLocaleString("es-CO")} kg` : "Dato disponible con imagen Power BI",
            },
          ],
        };
        setCeoReportData(enrichedCeo as CeoReportData);
      }
      setSavedReportId(result.reportId);
      utils.reports.list.invalidate();
      toast.success("Informe generado exitosamente");

      // Scroll to CEO report (first)
      setTimeout(() => {
        document.getElementById("ceo-report-section")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch (err) {
      toast.error("Error al generar el informe: " + (err as Error).message);
    }
  };

  const isLoading = uploadImage.isPending || uploadExcel.isPending || generateReport.isPending;

  return (
    <div className="space-y-6">
      {/* Upload Panel — no-print: excluded from PDF */}
      <div
        style={{
          background: "linear-gradient(135deg, #0d1b2a, #1b2838, #0f3460)",
          borderRadius: "12px",
          padding: "2rem 1.5rem",
        }}
        className="space-y-5 no-print"
      >
        <div className="text-center">
          <h2
            className="text-white text-2xl tracking-widest mb-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            COLBEEF — ANÁLISIS EJECUTIVO DIARIO
          </h2>
          <p className="text-sm" style={{ color: "#a8c4e0", maxWidth: 700, margin: "0 auto" }}>
            Sube la imagen del dashboard Power BI <strong style={{ color: "#4fc3f7" }}>y/o</strong> el archivo Excel de seguimiento presupuestal. La IA combinará ambas fuentes para generar un informe ejecutivo profundo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* Image Drop Zone */}
          <div>
            <div
              className="text-xs font-bold tracking-widest uppercase mb-2"
              style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              📸 Dashboard Power BI
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
              onDragLeave={() => setImgDragOver(false)}
              onDrop={handleImgDrop}
              onClick={() => imgInputRef.current?.click()}
              className="cursor-pointer transition-all duration-300 rounded-xl p-5 flex flex-col items-center gap-2 text-center"
              style={{
                border: `2px dashed ${imgDragOver || imgB64 ? "#4fc3f7" : "rgba(255,255,255,0.28)"}`,
                background: imgDragOver ? "rgba(79,195,247,0.09)" : "rgba(255,255,255,0.04)",
                minHeight: 140,
              }}
            >
              {imgPreview ? (
                <img src={imgPreview} alt="preview" className="max-h-24 max-w-full rounded-md object-contain" style={{ border: "2px solid rgba(255,255,255,0.15)" }} />
              ) : (
                <ImageIcon size={36} style={{ color: "#4fc3f7" }} />
              )}
              <span className="text-sm" style={{ color: "#cfd8dc" }}>
                {imgB64 ? (
                  <span style={{ color: "#4fc3f7" }}>✅ {imgName}</span>
                ) : (
                  <>Arrastra o <strong style={{ color: "#4fc3f7" }}>selecciona</strong> la imagen</>
                )}
              </span>
              <span className="text-xs" style={{ color: "#607d8b" }}>PNG · JPG · WEBP — máx. 5 MB</span>
              <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])} />
            </div>
          </div>

          {/* Excel Drop Zone */}
          <div>
            <div
              className="text-xs font-bold tracking-widest uppercase mb-2"
              style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              📊 Excel Seguimiento Presupuestal
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setXlDragOver(true); }}
              onDragLeave={() => setXlDragOver(false)}
              onDrop={handleXlDrop}
              onClick={() => xlInputRef.current?.click()}
              className="cursor-pointer transition-all duration-300 rounded-xl p-5 flex flex-col items-center gap-2 text-center"
              style={{
                border: `2px dashed ${xlDragOver || xlB64 ? "#4fc3f7" : xlError ? "#ff7043" : "rgba(255,255,255,0.28)"}`,
                background: xlDragOver ? "rgba(79,195,247,0.09)" : "rgba(255,255,255,0.04)",
                minHeight: 140,
              }}
            >
              <FileSpreadsheet size={36} style={{ color: xlError ? "#ff7043" : "#4fc3f7" }} />
              <span className="text-sm" style={{ color: "#cfd8dc" }}>
                {xlLoading ? (
                  <span style={{ color: "#4fc3f7" }}>⏳ Cargando Excel...</span>
                ) : xlError ? (
                  <span style={{ color: "#ff7043" }}>⚠️ {xlError}</span>
                ) : xlB64 ? (
                  <span style={{ color: "#4fc3f7" }}>✅ {xlName}</span>
                ) : (
                  <>Arrastra o <strong style={{ color: "#4fc3f7" }}>selecciona</strong> el archivo Excel</>
                )}
              </span>
              {xlInfo && (
                <div className="text-xs" style={{ color: "#4fc3f7" }}>
                  📅 Último día: <strong>{xlInfo.ultimoDia}</strong><br />
                  📊 {xlInfo.totalLineas} líneas · {xlInfo.totalCanales} canales
                </div>
              )}
              <span className="text-xs" style={{ color: "#607d8b" }}>XLSX — máx. 20 MB</span>
              <input ref={xlInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && loadExcel(e.target.files[0])} />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            disabled={!canGenerate || isLoading || xlLoading}
            onClick={handleGenerate}
            className="flex items-center gap-2 px-10 py-3 rounded-lg font-bold tracking-widest uppercase transition-all duration-300"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "1.1rem",
              background: canGenerate && !isLoading && !xlLoading
                ? "linear-gradient(135deg, #c0392b, #e74c3c)"
                : "#4a4a4a",
              color: "#fff",
              border: "none",
              boxShadow: canGenerate && !isLoading && !xlLoading ? "0 4px 14px rgba(192,57,43,0.4)" : "none",
              cursor: canGenerate && !isLoading && !xlLoading ? "pointer" : "not-allowed",
            }}
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> PROCESANDO...</>
            ) : (
              <>🔍 GENERAR INFORME COMBINADO</>
            )}
          </button>
        </div>

        {isLoading && (
          <div className="text-center">
            <p className="text-xs" style={{ color: "#78909c" }}>
              {uploadImage.isPending ? "Subiendo imagen..." : uploadExcel.isPending ? "Procesando Excel..." : "Analizando con IA..."}
            </p>
            <div className="mx-auto mt-2" style={{ width: 300, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #c0392b, #e74c3c, #4fc3f7)",
                  animation: "progress 2s ease-in-out infinite",
                  width: "60%",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CEO Report Section — aparece primero, expandido por defecto */}
      {ceoReportData && (
        <div id="ceo-report-section">
          {/* Toggle Header */}
          <div
            className="no-print"
            style={{
              background: "linear-gradient(135deg, #1a237e 0%, #2e7d32 100%)",
              borderRadius: showCeoReport ? "10px 10px 0 0" : 10,
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(26,35,126,0.3)",
            }}
            onClick={() => setShowCeoReport(v => !v)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.4rem" }}>📋</span>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.06em" }}>
                  REPORTE CEO — ADMINISTRACIÓN EN UNA PÁGINA
                </div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem" }}>
                  Metodología Khadem & Lorber · Factores Clave de Éxito · Semáforo de cumplimiento
                </div>
              </div>
            </div>
            <span
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                padding: "5px 16px",
                borderRadius: 20,
                fontSize: "0.82rem",
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {showCeoReport ? "▲ Colapsar" : "▼ Expandir Reporte CEO"}
            </span>
          </div>

          {showCeoReport && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderTop: "none",
                borderRadius: "0 0 10px 10px",
                padding: "20px",
              }}
            >
              <CeoReport data={ceoReportData} />
            </div>
          )}
        </div>
      )}

      {/* Informe Ejecutivo Detallado — colapsable, secundario */}
      {reportData && (
        <div id="report-section">
          <ReportView data={reportData} reportId={savedReportId} />
        </div>
      )}

      <style>{`
        @keyframes progress {
          0% { width: 5%; }
          50% { width: 75%; }
          90% { width: 92%; }
          100% { width: 96%; }
        }
      `}</style>
    </div>
  );
}
