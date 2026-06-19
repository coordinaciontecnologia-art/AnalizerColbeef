import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  createReport, updateReport, getReportById,
  getReportsByUser, deleteReport, countReportsByUser
} from "./db";
import { processExcelBuffer, buildExcelSummary, buildCeoReport, ExcelData, CeoReportData } from "./excelProcessor";
import { filterReportAlerts } from "@shared/reportFilters";
import { nanoid } from "nanoid";
import * as XLSX from "xlsx";

function mergeXlDataIntoReport(
  reportData: Record<string, unknown>,
  xlData?: ExcelData | null
): Record<string, unknown> {
  if (!xlData) return reportData;
  return {
    ...reportData,
    tablaLineas: xlData.tablaLineas,
    tablaLineaCanal: xlData.tablaLineaCanal,
    tablaIngresos: xlData.tablaIngresos,
    ultimoDia: xlData.ultimoDia,
    diasTransc: xlData.diasTransc,
    diasMes: xlData.diasMes,
  };
}

// ── AI PROMPT ──
function buildPrompt(xlSummary: string): string {
  return `Eres analista ejecutivo senior de Colbeef. Analiza el dashboard Power BI (imagen) y los datos del Excel de seguimiento presupuestal (texto).

${xlSummary}

INSTRUCCIÓN: Devuelve SOLO JSON válido sin markdown. Estructura exacta:

{
  "tipo_reporte":"DATOS GENERALES",
  "fecha":"DD/MM/YYYY",
  "hora":"HH:MM",
  "indicadores_generales":{
    "reses_planilladas_real":"0",
    "reses_planilladas_meta":"543",
    "reses_desviacion":"-100%",
    "canales_dia_real":"0",
    "canales_dia_meta":"41",
    "canales_desviacion":"-100%",
    "canales_despostadas":"97",
    "reses_corrales":"193",
    "inv_medias_canales":"1633",
    "inv_medias_cap":"2410",
    "inv_medias_pct":"68%",
    "inv_visceras":"641",
    "inv_visceras_cap":"640",
    "inv_visceras_pct":"100%",
    "hembras":"218",
    "machos":"396"
  },
  "dias_operativos":{
    "beneficio_ejecutados":"1",
    "beneficio_habiles":"1",
    "desposte_ejecutados":"1",
    "desposte_habiles":"0",
    "kg_desposte":"81.277",
    "congelado":"37.439",
    "refrigerado":"43.839"
  },
  "desempeno":{
    "sacrificio_dia_ant_real":"614","sacrificio_dia_ant_ppto":"592","sacrificio_dia_ant_pct":"104%","sacrificio_dia_ant_var":"+3,63%",
    "beneficio_mes_real":"614","beneficio_mes_ppto":"592","beneficio_mes_pct":"104%",
    "desposte_dia_ant_real":"97","desposte_dia_ant_ppto":"70","desposte_dia_ant_pct":"138%","desposte_dia_ant_var":"+38,18%",
    "desposte_mes_real":"97","desposte_mes_ppto":"70","desposte_mes_pct":"138%"
  },
  "inventario_carnes":{
    "total_kilos":"22.949","cava":"17.342","cortes":"15.484","refrigerado":"8.512","alistamiento":"2.839","subproductos":"1.868","congelado":"6.972","etiquetado":"2.768"
  },
  "productos_inventario":[
    {"nombre":"P-MOLIDA 90/10 DE RES","congelado":"4.972","refrigerado":null}
  ],
  "total_congelado":"12.568",
  "total_refrigerado":"10.382",
  "alertas":[
    {"titulo":"...","descripcion":"...","nivel":"rojo"}
  ],
  "comportamiento_metas":["obs1","obs2","obs3","obs4"],
  "analisis_excel":{
    "hallazgos_lineas":["hallazgo1","hallazgo2","hallazgo3"],
    "hallazgos_canales":["hallazgo1","hallazgo2","hallazgo3"],
    "hallazgos_ingresos":["hallazgo1","hallazgo2","hallazgo3"],
    "riesgos_criticos":["riesgo1","riesgo2"],
    "oportunidades":["op1","op2"]
  },
  "recomendaciones":[
    {"numero":1,"titulo":"...","detalle":"..."},
    {"numero":2,"titulo":"...","detalle":"..."},
    {"numero":3,"titulo":"...","detalle":"..."},
    {"numero":4,"titulo":"...","detalle":"..."},
    {"numero":5,"titulo":"...","detalle":"..."},
    {"numero":6,"titulo":"...","detalle":"..."}
  ]
}

Extrae valores REALES de la imagen y cruza con los datos del Excel. analisis_excel debe contener insights profundos del cruce.

IMPORTANTE: NO incluyas la alerta "Sacrificio del día en cero" ni alertas sobre reses planilladas/canales del día en 0 cuando el dashboard muestra esos KPIs en cero — eso es normal al final del día y no debe reportarse como alerta crítica.

Solo JSON.`;
}

function safeParseJSON(raw: string): Record<string, unknown> {
  let s = raw.replace(/```json|```/gi, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No se encontró JSON en la respuesta");
  s = s.slice(start, end + 1);
  try { return JSON.parse(s); } catch (_) { /* continue */ }
  s = s
    .replace(/,\s*([\]\}])/g, "$1")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  try { return JSON.parse(s); } catch (_) { /* continue */ }
  const opens = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const arrOpen = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  for (let i = 0; i < arrOpen; i++) s += "]";
  for (let i = 0; i < opens; i++) s += "}";
  s = s.replace(/,\s*([\]\}])/g, "$1");
  return JSON.parse(s);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── UPLOAD IMAGE ──
  upload: router({
    image: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 5 * 1024 * 1024) throw new Error("La imagen no puede superar 5 MB");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `colbeef/${ctx.user.id}/images/${nanoid()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key };
      }),

    excel: protectedProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const xlData = processExcelBuffer(buffer);
        const summary = buildExcelSummary(xlData);
        const ceoReport = buildCeoReport(xlData, xlData.rows1DiaRaw);
        return { xlData, summary, ceoReport };
      }),

    // Exportar el Reporte CEO a Excel
    exportCeoExcel: protectedProcedure
      .input(z.object({
        ceoReport: z.any(),
      }))
      .mutation(async ({ input }) => {
        const ceo = input.ceoReport as CeoReportData;
        const wb = XLSX.utils.book_new();

        // Hoja 1: Resumen CEO
        const fmtN = (n: number) => Math.round(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
        const fmtCOP = (n: number) => {
          const abs = Math.abs(n);
          if (abs >= 1e9) return "$" + (n / 1e9).toFixed(0) + "B";
          if (abs >= 1e6) return "$" + (n / 1e6).toFixed(0) + "M";
          if (abs >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
          return "$" + n.toFixed(0);
        };

        const rows: unknown[][] = [
          ["COLBEEF S.A.S. — REPORTE CEO"],
          [`Fecha: ${ceo.fecha} | Días hábiles: ${ceo.diasTransc} de ${ceo.diasMes}`],
          [],
          ["FACTOR CLAVE DE ÉXITO", "UNIDAD", "STATUS DÍA", "META DÍA", "% DÍA", "STATUS ACUM.", "META ACUM.", "% ACUM.", "TENDENCIA", "SEMÁFORO DÍA", "SEMÁFORO ACUM.", "COMENTARIO DÍA", "COMENTARIO ACUM."],
        ];

        for (const area of ceo.areas) {
          rows.push([`► ${area.nombre}`]);
          for (const f of area.factores) {
            const isCOP = f.unidad === "$COP";
            const fmt = isCOP ? fmtCOP : fmtN;
            rows.push([
              f.factor,
              f.unidad,
              fmt(f.execDia),
              fmt(f.metaDia),
              f.pctDia.toFixed(0) + "%",
              fmt(f.execAcum),
              fmt(f.metaAcum),
              f.pctAcum.toFixed(0) + "%",
              f.semaforoDia.toUpperCase(),
              f.semaforoAcum.toUpperCase(),
              f.comentarioDia,
              f.comentarioAcum,
            ]);
          }
          rows.push([]);
        }

        rows.push(["TOP DESFASADOS"]);
        rows.push(["Principal", "Línea", "Canal", "Diferencia", "% Desv.", "Unidad"]);
        for (const a of ceo.alertasDesfasados) {
          rows.push([a.principal, a.linea, a.canal, a.diff.toFixed(0), a.pct, a.unidad]);
        }
        rows.push([]);
        rows.push(["TOP SOBRE-CUMPLIDOS"]);
        rows.push(["Principal", "Línea", "Canal", "Diferencia", "% Desv.", "Unidad"]);
        for (const a of ceo.alertasSobrecumplidos) {
          rows.push([a.principal, a.linea, a.canal, a.diff.toFixed(0), a.pct, a.unidad]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 35 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, "Reporte CEO");

        const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
        const key = `colbeef/ceo-reports/reporte-ceo-${Date.now()}.xlsx`;
        const { url } = await storagePut(key, xlsxBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return { url };
      }),
  }),

  // ── REPORTS ──
  reports: router({
    generate: protectedProcedure
      .input(z.object({
        imageUrl: z.string().optional(),
        imageKey: z.string().optional(),
        imageMime: z.string().optional(),
        excelSummary: z.string().optional(),
        xlData: z.any().optional(),
        excelBase64: z.string().optional(),
        excelFilename: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Procesar Excel en servidor (fuente confiable — no depende del cliente)
        let xlData = input.xlData as ExcelData | undefined;
        let excelSummary = input.excelSummary;

        if (input.excelBase64) {
          const buffer = Buffer.from(input.excelBase64, "base64");
          xlData = processExcelBuffer(buffer);
          excelSummary = buildExcelSummary(xlData);
        }

        // Create pending report
        const reportId = await createReport({
          userId: ctx.user.id,
          title: `Informe ${new Date().toLocaleDateString("es-CO")}`,
          status: "processing",
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          excelSummary: excelSummary ?? undefined,
        });

        try {
          const xlSummary = excelSummary || "NO HAY DATOS DE EXCEL DISPONIBLES.";
          const prompt = buildPrompt(xlSummary);

          type MsgContent = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } };
          const contentParts: MsgContent[] = [
            ...(input.imageUrl ? [{ type: "image_url" as const, image_url: { url: input.imageUrl, detail: "high" as const } }] : []),
            { type: "text" as const, text: prompt }
          ];
          const messages = [{ role: "user" as const, content: contentParts }];

          const response = await invokeLLM({ messages, max_tokens: 4000 });
          const rawText = response.choices?.[0]?.message?.content || "";
          const reportData = safeParseJSON(typeof rawText === "string" ? rawText : JSON.stringify(rawText));
          reportData.alertas = filterReportAlerts(reportData.alertas);

          const reportDate = (reportData.fecha as string) || new Date().toLocaleDateString("es-CO");
          const reportType = (reportData.tipo_reporte as string) || "DATOS GENERALES";
          const mergedReportData = mergeXlDataIntoReport(
            reportData as Record<string, unknown>,
            xlData
          );

          await updateReport(reportId, {
            status: "completed",
            title: `Informe ${reportType} — ${reportDate}`,
            reportDate,
            reportType,
            reportData: mergedReportData,
          });

          return { reportId, reportData: mergedReportData, reportDate, reportType };
        } catch (err) {
          await updateReport(reportId, {
            status: "error",
            errorMessage: (err as Error).message,
          });
          throw err;
        }
      }),

    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const [items, total] = await Promise.all([
          getReportsByUser(ctx.user.id, input.limit, input.offset),
          countReportsByUser(ctx.user.id),
        ]);
        return { items, total };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const report = await getReportById(input.id, ctx.user.id);
        if (!report) throw new Error("Reporte no encontrado");
        return report;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteReport(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
