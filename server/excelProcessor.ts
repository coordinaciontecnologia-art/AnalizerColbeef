import * as XLSX from "xlsx";

export interface PrincipalItem {
  nombre: string;
  ejec: number;
  meta: number;
  diff: number;
  pct: string;
}

export interface LineaRow {
  nombre: string;
  dEjec: number;
  dMeta: number;
  mEjec: number;
  mMeta: number;
  dPct: string;
  mPct: string;
  dTop: PrincipalItem[];
  mTop: PrincipalItem[];
}

export interface LineaCanalRow {
  linea: string;
  canal: string;
  dEjec: number;
  dMeta: number;
  mEjec: number;
  mMeta: number;
  dPct: string;
  mPct: string;
  dTop: PrincipalItem[];
  mTop: PrincipalItem[];
}

export interface IngresosRow {
  nombre: string;
  dEjec: number;
  dMeta: number;
  mEjec: number;
  mMeta: number;
  dPct: string;
  mPct: string;
}

export interface ExcelData {
  ultimoDia: string;
  diasTransc: number;
  diasMes: number;
  factor: string;
  totalLineas: number;
  totalCanales: number;
  tablaLineas: LineaRow[];
  tablaLineaCanal: LineaCanalRow[];
  tablaIngresos: IngresosRow[];
  rows1DiaRaw: { principal: string; linea: string; canal: string; ejec: number; meta: number }[];
  rows1AcumRaw: { principal: string; linea: string; canal: string; ejec: number; meta: number }[];
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * Convierte cualquier valor de fecha de Excel a objeto Date.
 * Soporta: número serial Excel, string ISO, objeto Date.
 */
function excelToDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === "number" && v > 0) {
    // Número serial de Excel → JS Date
    // Excel epoch: 30 dic 1899
    const EXCEL_EPOCH = new Date(1899, 11, 30);
    const ms = EXCEL_EPOCH.getTime() + v * 86400000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Busca el valor de una fila por múltiples posibles nombres de columna.
 */
function getVal(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
    // búsqueda case-insensitive
    const found = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.toLowerCase()
    );
    if (found !== undefined) return row[found];
  }
  return null;
}

export function processExcelBuffer(buffer: Buffer): ExcelData {
  // cellDates: true para que xlsx entregue objetos Date directamente
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // ════════════════════════════════════════════════════════
  // HOJA 1: CONSOLIDADO_BASES_PPTO_EJEC
  // Columnas reales: Principal, Categoria, Linea, Canal, Zona, Fecha, Ejecucion, Meta, variacion
  // ════════════════════════════════════════════════════════
  const ws1 = wb.Sheets["CONSOLIDADO_BASES_PPTO_EJEC"];
  if (!ws1) throw new Error("No se encontró la hoja CONSOLIDADO_BASES_PPTO_EJEC");

  const raw1 = XLSX.utils.sheet_to_json(ws1, { defval: null }) as Record<string, unknown>[];

  const rows1 = raw1
    .map((r) => ({
      principal: String(getVal(r, ["Principal", "PRINCIPAL", "principal"]) ?? "").trim(),
      linea: String(getVal(r, ["Linea", "LINEA", "linea"]) ?? "").trim(),
      canal: String(getVal(r, ["Canal", "CANAL", "canal"]) ?? "").trim(),
      fecha: excelToDate(getVal(r, ["Fecha", "FECHA", "fecha"])),
      ejec: parseFloat(String(getVal(r, ["Ejecucion", "EJECUCION", "ejecucion"]) ?? "0")) || 0,
      meta: parseFloat(String(getVal(r, ["Meta", "META", "meta"]) ?? "0")) || 0,
    }))
    .filter((r) => r.linea && r.fecha !== null);

  // Encontrar la última fecha que tenga al menos algún registro con ejecución > 0
  const rowsConEjec = rows1.filter((r) => r.ejec > 0);
  if (!rowsConEjec.length) throw new Error("No hay registros con ejecución > 0 en CONSOLIDADO_BASES_PPTO_EJEC");

  const fechasDates = rowsConEjec
    .map((r) => r.fecha!)
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

  const uf = new Date(Math.max(...fechasDates.map((d) => d.getTime())));
  const ultimoDiaStr = `${String(uf.getDate()).padStart(2, "0")}/${String(uf.getMonth() + 1).padStart(2, "0")}/${uf.getFullYear()}`;
  const mesAct = uf.getMonth();
  const anioAct = uf.getFullYear();

  /**
   * Días hábiles operativos transcurridos del mes:
   * - Cuenta desde el día 1 hasta el día ANTERIOR a la última fecha con datos (sin incluir el día actual)
   * - Excluye domingos (domingo = 0 en getDay())
   * Ejemplo: si uf = 2 de marzo (lunes), cuenta solo el 1 de marzo (sábado) = 1 día hábil
   */
  function countHabilDays(anio: number, mes: number, hastaExclusive: number): number {
    let count = 0;
    for (let d = 1; d < hastaExclusive; d++) {
      const dow = new Date(anio, mes, d).getDay();
      if (dow !== 0) count++; // excluir domingos
    }
    return count;
  }

  const diasTransc = countHabilDays(anioAct, mesAct, uf.getDate());

  // Días hábiles totales del mes (sin domingos)
  const totalDiasMes = daysInMonth(anioAct, mesAct + 1);
  let diasHabilMes = 0;
  for (let d = 1; d <= totalDiasMes; d++) {
    if (new Date(anioAct, mesAct, d).getDay() !== 0) diasHabilMes++;
  }
  const diasMes = diasHabilMes;
  const factor = diasMes > 0 ? (diasTransc / diasMes).toFixed(4) : "0.0000";

  // Filtros de fecha
  function sameDay(r: { fecha: Date | null }): boolean {
    if (!r.fecha) return false;
    return (
      r.fecha.getFullYear() === uf.getFullYear() &&
      r.fecha.getMonth() === uf.getMonth() &&
      r.fecha.getDate() === uf.getDate()
    );
  }

  function inMesAcum(r: { fecha: Date | null }): boolean {
    if (!r.fecha) return false;
    return (
      r.fecha.getFullYear() === anioAct &&
      r.fecha.getMonth() === mesAct &&
      r.fecha.getTime() <= uf.getTime()
    );
  }

  const rowsDia = rows1.filter(sameDay);
  const rowsAcum = rows1.filter(inMesAcum);

  // Unidades de medida por línea
  const lineaUnidad: Record<string, string> = {
    Beneficio: "reses", Desposte: "canales", Cortes: "kg", SC: "kg",
  };

  /**
   * Top 3 desfasados + top 3 sobre-cumplidos por Principal para un conjunto de filas.
   */
  function topPrincipales(arr: typeof rows1, linea: string): PrincipalItem[] {
    void linea;
    const map: Record<string, { ejec: number; meta: number }> = {};
    arr.forEach((r) => {
      if (!r.principal) return;
      if (!map[r.principal]) map[r.principal] = { ejec: 0, meta: 0 };
      map[r.principal].ejec += r.ejec;
      map[r.principal].meta += r.meta;
    });
    const items: PrincipalItem[] = Object.entries(map)
      .filter(([, v]) => Math.abs(v.ejec - v.meta) >= 0.01)
      .map(([nombre, v]) => ({
        nombre,
        ejec: v.ejec,
        meta: v.meta,
        diff: v.ejec - v.meta,
        pct: (v.meta > 0 ? ((v.ejec / v.meta) - 1) * 100 : 0).toFixed(0) + "%",
      }));
    const desfasados = items.filter((i) => i.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3);
    const sobrecumplidos = items.filter((i) => i.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3);
    return [...desfasados, ...sobrecumplidos];
  }

  // Agrupación por línea
  function groupByLinea(arr: typeof rows1): Record<string, { ejec: number; meta: number }> {
    const out: Record<string, { ejec: number; meta: number }> = {};
    arr.forEach((r) => {
      const k = r.linea || "—";
      if (!out[k]) out[k] = { ejec: 0, meta: 0 };
      out[k].ejec += r.ejec;
      out[k].meta += r.meta;
    });
    return out;
  }

  // Agrupación por línea + canal
  function groupByLineaCanal(arr: typeof rows1): Record<string, { linea: string; canal: string; ejec: number; meta: number }> {
    const out: Record<string, { linea: string; canal: string; ejec: number; meta: number }> = {};
    arr.forEach((r) => {
      const k = `${r.linea}||${r.canal}`;
      if (!out[k]) out[k] = { linea: r.linea, canal: r.canal, ejec: 0, meta: 0 };
      out[k].ejec += r.ejec;
      out[k].meta += r.meta;
    });
    return out;
  }

  const linDia = groupByLinea(rowsDia);
  const linAcum = groupByLinea(rowsAcum);
  const todasLineas = Array.from(new Set([...Object.keys(linDia), ...Object.keys(linAcum)]));

  const tablaLineas: LineaRow[] = todasLineas
    .map((l) => {
      const dEjec = linDia[l]?.ejec || 0;
      const dMeta = linDia[l]?.meta || 0;
      const mEjec = linAcum[l]?.ejec || 0;
      const mMeta = linAcum[l]?.meta || 0;
      return {
        nombre: l,
        dEjec,
        dMeta,
        mEjec,
        mMeta,
        dPct: (dMeta > 0 ? (dEjec / dMeta) * 100 : 0).toFixed(0),
        mPct: (mMeta > 0 ? (mEjec / mMeta) * 100 : 0).toFixed(0),
        dTop: topPrincipales(rowsDia.filter((r) => r.linea === l), l),
        mTop: topPrincipales(rowsAcum.filter((r) => r.linea === l), l),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const lcDiaMap = groupByLineaCanal(rowsDia);
  const lcAcumMap = groupByLineaCanal(rowsAcum);
  const allLcKeys = Array.from(new Set([...Object.keys(lcDiaMap), ...Object.keys(lcAcumMap)]));

  const tablaLineaCanal: LineaCanalRow[] = allLcKeys
    .map((k) => {
      const dia = lcDiaMap[k];
      const acum = lcAcumMap[k];
      const linea = dia?.linea || acum?.linea || k.split("||")[0];
      const canal = dia?.canal || acum?.canal || k.split("||")[1];
      const dEjec = dia?.ejec || 0;
      const dMeta = dia?.meta || 0;
      const mEjec = acum?.ejec || 0;
      const mMeta = acum?.meta || 0;
      return {
        linea,
        canal,
        dEjec,
        dMeta,
        mEjec,
        mMeta,
        dPct: (dMeta > 0 ? (dEjec / dMeta) * 100 : 0).toFixed(0),
        mPct: (mMeta > 0 ? (mEjec / mMeta) * 100 : 0).toFixed(0),
        dTop: topPrincipales(rowsDia.filter((r) => r.linea === linea && r.canal === canal), linea),
        mTop: topPrincipales(rowsAcum.filter((r) => r.linea === linea && r.canal === canal), linea),
      };
    })
    .sort((a, b) => a.linea.localeCompare(b.linea) || a.canal.localeCompare(b.canal));

  // ════════════════════════════════════════════════════════
  // HOJA 2: ESQUEMA_BASE_INGRESOS_1
  // Columnas reales: CUENTA, NOMBRE CUENTA, Unidad, Categoria, Fecha, Ejecucion, Meta,
  //                  variacion, Olimpica, Es olimpica
  // Solo se incluyen filas donde "Es olimpica" = "SI"
  // ════════════════════════════════════════════════════════
  let tablaIngresos: IngresosRow[] = [];
  try {
    const ws2 = wb.Sheets["ESQUEMA_BASE_INGRESOS_1"];
    if (ws2) {
      const raw2 = XLSX.utils.sheet_to_json(ws2, { defval: null }) as Record<string, unknown>[];

      const rows2 = raw2
        .map((r) => ({
          // "Unidad" en el Excel = línea de negocio (Beneficio, Desposte, etc.)
          unidad: String(getVal(r, ["Unidad", "UNIDAD", "unidad"]) ?? "").trim(),
          // "Categoria" en el Excel = subcategoría (Sacrificio, Pesaje, etc.)
          categoria: String(getVal(r, ["Categoria", "CATEGORIA", "categoria", "Categoría"]) ?? "").trim(),
          fecha: excelToDate(getVal(r, ["Fecha", "FECHA", "fecha"])),
          ejec: parseFloat(String(getVal(r, ["Ejecucion", "EJECUCION", "ejecucion"]) ?? "0")) || 0,
          meta: parseFloat(String(getVal(r, ["Meta", "META", "meta"]) ?? "0")) || 0,
          // Solo incluir registros marcados como "SI" en "Es olimpica"
          esOlimpica: String(getVal(r, ["Es olimpica", "ES OLIMPICA", "es olimpica", "Es Olimpica", "EsOlimpica"]) ?? "").trim().toUpperCase(),
        }))
          .filter((r) => r.unidad && r.fecha !== null);

      // Día exacto
      const sameDay2 = (r: { fecha: Date | null }): boolean => {
        if (!r.fecha) return false;
        return (
          r.fecha.getFullYear() === uf.getFullYear() &&
          r.fecha.getMonth() === uf.getMonth() &&
          r.fecha.getDate() === uf.getDate()
        );
      };

      // Acumulado del mes hasta el último día
      const inMes2 = (r: { fecha: Date | null }): boolean => {
        if (!r.fecha) return false;
        return (
          r.fecha.getFullYear() === anioAct &&
          r.fecha.getMonth() === mesAct &&
          r.fecha.getTime() <= uf.getTime()
        );
      };

      // Agrupar por Unidad (línea de negocio)
      const ingDia: Record<string, { ejec: number; meta: number }> = {};
      const ingAcum: Record<string, { ejec: number; meta: number }> = {};

      rows2.filter(sameDay2).forEach((r) => {
        if (!ingDia[r.unidad]) ingDia[r.unidad] = { ejec: 0, meta: 0 };
        ingDia[r.unidad].ejec += r.ejec;
        ingDia[r.unidad].meta += r.meta;
      });

      rows2.filter(inMes2).forEach((r) => {
        if (!ingAcum[r.unidad]) ingAcum[r.unidad] = { ejec: 0, meta: 0 };
        ingAcum[r.unidad].ejec += r.ejec;
        ingAcum[r.unidad].meta += r.meta;
      });

      const todasU = Array.from(new Set([...Object.keys(ingDia), ...Object.keys(ingAcum)]));
      tablaIngresos = todasU
        .map((u) => {
          const dEjec = ingDia[u]?.ejec || 0;
          const dMeta = ingDia[u]?.meta || 0;
          const mEjec = ingAcum[u]?.ejec || 0;
          const mMeta = ingAcum[u]?.meta || 0;
          return {
            nombre: u,
            dEjec,
            dMeta,
            mEjec,
            mMeta,
            dPct: (dMeta > 0 ? (dEjec / dMeta) * 100 : 0).toFixed(0),
            mPct: (mMeta > 0 ? (mEjec / mMeta) * 100 : 0).toFixed(0),
          };
        })
        .filter((r) => r.mMeta > 0 || r.dMeta > 0 || r.mEjec > 0 || r.dEjec > 0)
        .sort((a, b) => b.mEjec - a.mEjec);
    }
  } catch (e) {
    console.warn("[ExcelProcessor] Error leyendo ESQUEMA_BASE_INGRESOS_1:", e);
  }

  return {
    ultimoDia: ultimoDiaStr,
    diasTransc,
    diasMes,
    factor,
    totalLineas: tablaLineas.length,
    totalCanales: tablaLineaCanal.length,
    tablaLineas,
    tablaLineaCanal,
    tablaIngresos,
    rows1DiaRaw: rowsDia.map(r => ({ principal: r.principal, linea: r.linea, canal: r.canal, ejec: r.ejec, meta: r.meta })),
    rows1AcumRaw: rowsAcum.map(r => ({ principal: r.principal, linea: r.linea, canal: r.canal, ejec: r.ejec, meta: r.meta })),
  };
}

// ════════════════════════════════════════════════════════
// REPORTE CEO — Administración en Una Página
// ════════════════════════════════════════════════════════

export type Semaforo = "verde" | "amarillo" | "rojo";

export interface CeoFce {
  factor: string;          // Nombre del Factor Clave de Éxito
  unidad: string;          // Unidad de medida
  execDia: number;         // Ejecución del día
  metaDia: number;         // Meta del día
  pctDia: number;          // % cumplimiento día
  execAcum: number;        // Ejecución acumulada
  metaAcum: number;        // Meta acumulada
  pctAcum: number;         // % cumplimiento acumulado
  semaforoDia: Semaforo;
  semaforoAcum: Semaforo;
  comentarioDia: string;   // Top desfasados/sobre-cumplidos del día
  comentarioAcum: string;  // Top desfasados/sobre-cumplidos acumulados
}

export interface CeoArea {
  nombre: string;
  factores: CeoFce[];
}

export interface InventarioItem {
  nombre: string;       // Ej: "Medias canales", "Vísceras", "Reses en corrales"
  valor: number | null; // Cantidad actual
  capacidad: number | null; // Capacidad máxima (si aplica)
  pctOcupacion: number | null; // % ocupación (si aplica)
  unidad: string;       // Ej: "canales", "kg", "reses"
  semaforo: Semaforo;   // Verde=OK, Amarillo=atención, Rojo=crítico
  nota: string;         // Texto descriptivo
  metaDia?: number | null;      // Meta del día actual
  ejecutadoDiaAnterior?: number | null; // Ejecutado del mismo día de la semana anterior
  diasOperativosCumplidos?: number | null; // Días operativos cumplidos (ej: 2 de 3)
  diasOperativosTotal?: number | null; // Total de días operativos en el período
  pctDiasOperativos?: number | null; // % de días operativos cumplidos
  visceraNeta?: number | null;  // Vísceras netas = inventario - reses sacrificadas día anterior
}

export interface ConcentracionPorLinea {
  linea: string;           // Nombre de la línea (Beneficio, Desposte, Cortes, SC)
  unidad: string;          // Unidad de medida de la línea
  volumenTotal: number;    // Volumen total de la línea
  top: { principal: string; volumen: number; pct: number; semaforo: Semaforo }[];
  hhiLinea: number;        // HHI específico de esta línea
}

export interface ConcentracionCliente {
  principal: string;       // Nombre del cliente/principal
  volumenTotal: number;    // Volumen total ejecutado (en unidades de su línea principal)
  pctDelTotal: number;     // % que representa del total de su línea principal
  lineas: string[];        // Líneas en las que opera
  lineaPrincipal: string;  // Línea donde más volumen genera
  semaforo: Semaforo;      // Riesgo de dependencia
}

export interface EstrategiaComercial {
  tipo: "riesgo" | "oportunidad" | "accion";
  titulo: string;
  detalle: string;
  semaforo: Semaforo;
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
  concentracionPorLinea: ConcentracionPorLinea[];  // Concentración separada por línea
  hhiIndex: number;        // Índice Herfindahl-Hirschman global (0-10000)
  alertasDesfasados: { linea: string; canal: string; principal: string; diff: number; pct: string; unidad: string }[];
  alertasSobrecumplidos: { linea: string; canal: string; principal: string; diff: number; pct: string; unidad: string }[];
}

export interface RecomendacionEjecutiva {
  texto: string;
  nivel: "rojo" | "amarillo" | "verde" | "info";
}

function semaforo(pct: number): Semaforo {
  if (pct >= 100) return "verde";
  if (pct >= 85) return "amarillo";
  return "rojo";
}

function tendencia(pctDia: number, pctAcum: number): "B" | "M" | "—" {
  if (pctDia === 0 && pctAcum === 0) return "—";
  if (pctDia >= pctAcum) return "B";
  return "M";
}

export function buildCeoReport(xlData: ExcelData, rows1Raw: { principal: string; linea: string; canal: string; ejec: number; meta: number }[]): CeoReportData {
  // Para análisis estratégico y concentración, usar datos acumulados del mes
  const rows1Acum = xlData.rows1AcumRaw;
  const getUnidad = (nombre: string): string => {
    const n = nombre.trim().toUpperCase();
    if (n.includes("BENEFICIO")) return "reses";
    if (n.includes("DESPOSTE")) return "canales";
    if (n.includes("CORTES")) return "kg";
    if (n === "SC") return "kg (SC)";
    if (n.includes("VÍSCERAS")) return "und";
    return "$MILLONES";
  };

  const fmtComent = (tops: PrincipalItem[], unidad: string): string => {
    if (!tops.length) return "Sin desviaciones";
    const desfasados = tops.filter(t => t.diff < 0).slice(0, 2);
    const sobrecumplidos = tops.filter(t => t.diff > 0).slice(0, 2);
    const parts: string[] = [];
    if (desfasados.length) {
      parts.push("⬇ " + desfasados.map(t => `${t.nombre.split(" ")[0]} ${t.diff.toFixed(0)} ${unidad}`).join(" · "));
    }
    if (sobrecumplidos.length) {
      parts.push("⬆ " + sobrecumplidos.map(t => `${t.nombre.split(" ")[0]} +${t.diff.toFixed(0)} ${unidad}`).join(" · "));
    }
    return parts.join(" | ") || "Sin desviaciones";
  };

  // Área 1: Operaciones
  const LINEA_ORDER = ["Beneficio", "Desposte", "Cortes", "SC"];
  const lineasOrdenadas = [...xlData.tablaLineas].sort((a, b) => {
    const ia = LINEA_ORDER.findIndex(l => a.nombre.toUpperCase() === l.toUpperCase());
    const ib = LINEA_ORDER.findIndex(l => b.nombre.toUpperCase() === l.toUpperCase());
    return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
  });

  const area1: CeoArea = {
    nombre: "OPERACIONES DEL DÍA",
    factores: lineasOrdenadas.map((l) => {
      const pctD = parseFloat(l.dPct);
      const pctA = parseFloat(l.mPct);
      const unidad = getUnidad(l.nombre);
      return {
        factor: l.nombre,
        unidad,
        execDia: l.dEjec,
        metaDia: l.dMeta,
        pctDia: pctD,
        execAcum: l.mEjec,
        metaAcum: l.mMeta,
        pctAcum: pctA,
        semaforoDia: semaforo(pctD),
        semaforoAcum: semaforo(pctA),
        comentarioDia: fmtComent(l.dTop, unidad),
        comentarioAcum: fmtComent(l.mTop, unidad),
      };
    }),
  };

  // Área 2: Ingresos (COP)
  const INGRESO_ORDER = ["Beneficio", "Comercialización", "Desposte", "Subproductos", "Ingresos No Oper."];
  const ingOrdenados = [...xlData.tablaIngresos].sort((a, b) => {
    const ia = INGRESO_ORDER.findIndex(l => a.nombre.toUpperCase().includes(l.toUpperCase()));
    const ib = INGRESO_ORDER.findIndex(l => b.nombre.toUpperCase().includes(l.toUpperCase()));
    return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
  });

  const fmtCOP = (n: number) => {
    return `$${Math.round(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
  };

  const area2: CeoArea = {
    nombre: "INGRESOS ($MILLONES)",
    factores: ingOrdenados.map((u) => {
      const pctD = parseFloat(u.dPct);
      const pctA = parseFloat(u.mPct);
      return {
        factor: u.nombre,
        unidad: "$MILLONES",
        execDia: u.dEjec,
        metaDia: u.dMeta,
        pctDia: pctD,
        execAcum: u.mEjec,
        metaAcum: u.mMeta,
        pctAcum: pctA,
        semaforoDia: semaforo(pctD),
        semaforoAcum: semaforo(pctA),
        comentarioDia: `Ejec: ${fmtCOP(u.dEjec)} / Meta: ${fmtCOP(u.dMeta)}`,
        comentarioAcum: `Ejec: ${fmtCOP(u.mEjec)} / Meta: ${fmtCOP(u.mMeta)}`,
      };
    }),
  };

  // Calcular día anterior de la semana (mismo día hace 7 días)
  const hoy = new Date(xlData.ultimoDia);
  const diaAnterior = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Beneficio del día actual (rows1Raw es el día actual)
  // Para obtener el día anterior se necesitaría acceso a datos históricos desglosados por fecha
  const beneficioDiaActual = rows1Raw
    .filter(r => r.linea?.toUpperCase() === "BENEFICIO")
    .reduce((sum, r) => sum + r.ejec, 0);
  
  // Usar como aproximación: el ejecutado de Beneficio del día actual
  const beneficioDiaAnterior = beneficioDiaActual;
  
  const metaBeneficio = lineasOrdenadas.find(l => l.nombre.toUpperCase() === "BENEFICIO")?.dMeta || 0;
  const metaDesposte = lineasOrdenadas.find(l => l.nombre.toUpperCase() === "DESPOSTE")?.dMeta || 0;
  
  // Inventarios — se poblarán desde el JSON de la IA cuando haya imagen del dashboard.
  // Por defecto se dejan vacíos (el componente los mostrará como "Pendiente imagen dashboard")
  const inventarios: InventarioItem[] = [
    { 
      nombre: "Medias canales", 
      valor: null, 
      capacidad: null, 
      pctOcupacion: null, 
      unidad: "canales", 
      semaforo: "amarillo", 
      nota: "Dato disponible con imagen Power BI",
      metaDia: metaDesposte || null,
      ejecutadoDiaAnterior: beneficioDiaAnterior || null,
      diasOperativosCumplidos: null,
      diasOperativosTotal: null,
      pctDiasOperativos: null
    },
    { 
      nombre: "Vísceras", 
      valor: null, 
      capacidad: null, 
      pctOcupacion: null, 
      unidad: "und", 
      semaforo: "amarillo", 
      nota: "Dato disponible con imagen Power BI",
      visceraNeta: null,  // Se calcula como: inventario_visceras - beneficioDiaAnterior (reses sacrificadas día anterior)
      ejecutadoDiaAnterior: beneficioDiaAnterior || null
    },
    { 
      nombre: "Reses en corrales", 
      valor: null, 
      capacidad: null, 
      pctOcupacion: null, 
      unidad: "reses", 
      semaforo: "amarillo", 
      nota: "Dato disponible con imagen Power BI",
      metaDia: metaBeneficio || null
    },
    { 
      nombre: "Inventario carnes Colbeef", 
      valor: null, 
      capacidad: null, 
      pctOcupacion: null, 
      unidad: "kg", 
      semaforo: "amarillo", 
      nota: "Dato disponible con imagen Power BI"
    },
  ];

  // ════════════════════════════════════════════════════════
  // RECOMENDACIONES EJECUTIVAS (ordenadas rojo → verde)
  // ════════════════════════════════════════════════════════
  const recomendaciones: RecomendacionEjecutiva[] = [];

  // Rojo: líneas críticas (< 85%)
  for (const l of lineasOrdenadas) {
    const pctA = parseFloat(l.mPct);
    const unidad = getUnidad(l.nombre);
    if (pctA < 85) {
      const diff = l.mMeta - l.mEjec;
      recomendaciones.push({
        texto: `${l.nombre} acumula solo ${pctA.toFixed(0)}% de la meta mensual. Déficit de ${diff.toFixed(0)} ${unidad}. Revisar capacidad operativa y programar jornadas adicionales.`,
        nivel: "rojo",
      });
    }
  }

  // Rojo: SC crítico
  const sc = lineasOrdenadas.find(l => l.nombre.toUpperCase() === "SC");
  if (sc && parseFloat(sc.mPct) < 50) {
    const scMeta = sc.dMeta || 0;
    recomendaciones.push({
      texto: `Objetivo de SC (Subproductos Comestibles) es ${scMeta.toFixed(0)} kg hoy. Verificar proceso de clasificación y recuperación de subproductos para alcanzar la meta.`,
      nivel: "rojo",
    });
  }

  // Amarillo: ingresos en riesgo
  const ingTotalEjec = ingOrdenados.reduce((s, u) => s + u.mEjec, 0);
  const ingTotalMeta = ingOrdenados.reduce((s, u) => s + u.mMeta, 0);
  if (ingTotalMeta > 0) {
    const pctIng = (ingTotalEjec / ingTotalMeta) * 100;
    if (pctIng < 90) {
      recomendaciones.push({
        texto: `Ingresos totales al ${pctIng.toFixed(0)}% de la meta acumulada. Revisar canales con mayor brecha y activar acciones comerciales inmediatas.`,
        nivel: "amarillo",
      });
    }
  }

  // Verde: líneas sobre-cumplidas
  for (const l of lineasOrdenadas) {
    const pctA = parseFloat(l.mPct);
    if (pctA >= 110) {
      recomendaciones.push({
        texto: `${l.nombre} supera la meta mensual en ${(pctA - 100).toFixed(0)}%. Evaluar si el sobre-cumplimiento genera presión en inventarios o costos adicionales.`,
        nivel: "verde",
      });
    }
  }

  // Info: si no hay alertas críticas
  if (recomendaciones.filter(r => r.nivel === "rojo").length === 0) {
    recomendaciones.push({
      texto: "Todas las líneas operativas muestran cumplimiento dentro del rango esperado. Mantener el ritmo operativo actual.",
      nivel: "verde",
    });
  }

  // Nota: el dato de aprovechamiento operativo se muestra en el header del reporte, no en recomendaciones.

  // ════════════════════════════════════════════════════════
  // CONCENTRACIÓN DE CLIENTES POR LÍNEA SEPARADA
  // Cada línea tiene su propia unidad (reses, canales, kg) por lo que
  // NO se pueden mezclar. Calculamos HHI y top-clientes por línea.
  // ════════════════════════════════════════════════════════
  const LINEAS_OPERATIVAS = ["Beneficio", "Desposte", "Cortes", "SC"];

  // Mapa: linea -> principal -> volumen (USANDO DATOS ACUMULADOS DEL MES)
  const lineaPrincipalMap: Record<string, Record<string, number>> = {};
  rows1Acum.forEach((r) => {
    if (!r.principal || !r.linea) return;
    if (!lineaPrincipalMap[r.linea]) lineaPrincipalMap[r.linea] = {};
    if (!lineaPrincipalMap[r.linea][r.principal]) lineaPrincipalMap[r.linea][r.principal] = 0;
    lineaPrincipalMap[r.linea][r.principal] += r.ejec;
  });

  // Construir concentración por línea (USANDO DATOS ACUMULADOS DEL MES)
  const concentracionPorLinea: ConcentracionPorLinea[] = LINEAS_OPERATIVAS
    .filter(linea => lineaPrincipalMap[linea] && Object.keys(lineaPrincipalMap[linea]).length > 0)
    .map(linea => {
      const clientes = lineaPrincipalMap[linea];
      const totalLinea = Object.values(clientes).reduce((s, v) => s + v, 0);
      const topClientes = Object.entries(clientes)
        .map(([principal, volumen]) => {
          const pct = totalLinea > 0 ? (volumen / totalLinea) * 100 : 0;
          const sem: Semaforo = pct > 30 ? "rojo" : pct > 20 ? "amarillo" : "verde";
          return { principal, volumen, pct, semaforo: sem };
        })
        .sort((a, b) => b.volumen - a.volumen)
        .slice(0, 5);
      const hhiLinea = Object.values(clientes).reduce((s, v) => {
        const share = totalLinea > 0 ? (v / totalLinea) * 100 : 0;
        return s + share * share;
      }, 0);
      return {
        linea,
        unidad: getUnidad(linea),
        volumenTotal: totalLinea,
        top: topClientes,
        hhiLinea,
      };
    });

  // concentracionClientes: top clientes globales, pero con % calculado dentro de su línea principal
  // Mapa global: principal -> { volumen por linea }
  const globalPrincipalMap: Record<string, { lineas: Record<string, number> }> = {};
  rows1Raw.forEach((r) => {
    if (!r.principal || !r.linea) return;
    if (!globalPrincipalMap[r.principal]) globalPrincipalMap[r.principal] = { lineas: {} };
    if (!globalPrincipalMap[r.principal].lineas[r.linea]) globalPrincipalMap[r.principal].lineas[r.linea] = 0;
    globalPrincipalMap[r.principal].lineas[r.linea] += r.ejec;
  });

  const concentracionClientes: ConcentracionCliente[] = Object.entries(globalPrincipalMap)
    .map(([principal, v]) => {
      // Línea donde más volumen genera
      const lineaEntries = Object.entries(v.lineas).sort((a, b) => b[1] - a[1]);
      const lineaPrincipal = lineaEntries[0]?.[0] ?? "";
      const volumenEnLineaPrincipal = lineaEntries[0]?.[1] ?? 0;
      // % dentro de su línea principal (no mezcla de unidades)
      const totalDeLineaPrincipal = lineaPrincipalMap[lineaPrincipal]
        ? Object.values(lineaPrincipalMap[lineaPrincipal]).reduce((s, x) => s + x, 0)
        : 0;
      const pctDelTotal = totalDeLineaPrincipal > 0 ? (volumenEnLineaPrincipal / totalDeLineaPrincipal) * 100 : 0;
      const sem: Semaforo = pctDelTotal > 30 ? "rojo" : pctDelTotal > 20 ? "amarillo" : "verde";
      return {
        principal,
        volumenTotal: volumenEnLineaPrincipal,
        pctDelTotal,
        lineas: Object.keys(v.lineas),
        lineaPrincipal,
        semaforo: sem,
      };
    })
    .sort((a, b) => b.pctDelTotal - a.pctDelTotal)
    .slice(0, 10);

  // HHI global: calculado sobre la línea con mayor volumen total (Cortes generalmente)
  const lineaMayorVolumen = concentracionPorLinea.sort((a, b) => b.volumenTotal - a.volumenTotal)[0];
  const hhiIndex = lineaMayorVolumen?.hhiLinea ?? 0;

  // ════════════════════════════════════════════════════════
  // ESTRATEGIAS COMERCIALES (basadas en concentración por línea)
  // ════════════════════════════════════════════════════════
  const estrategiasComerciales: EstrategiaComercial[] = [];

  // Analizar cada línea por separado para detectar riesgos reales
  for (const linConc of concentracionPorLinea) {
    if (linConc.top.length === 0) continue;
    const top1Linea = linConc.top[0];
    const top3PctLinea = linConc.top.slice(0, 3).reduce((s, c) => s + c.pct, 0);

    // Riesgo: cliente único domina una línea
    if (top1Linea.pct > 30) {
      estrategiasComerciales.push({
        tipo: "riesgo",
        titulo: `Alta dependencia en ${linConc.linea}: ${top1Linea.principal.split(" ").slice(0, 3).join(" ")}`,
        detalle: `En ${linConc.linea} (${linConc.unidad}), ${top1Linea.principal} concentra el ${top1Linea.pct.toFixed(0)}% del volumen de la línea (${top1Linea.volumen.toLocaleString("es-CO", { maximumFractionDigits: 0 })} ${linConc.unidad}). Riesgo crítico si este cliente reduce pedidos. Diversificar urgentemente.`,
        semaforo: "rojo",
      });
    }

    // Riesgo: top-3 concentran demasiado
    if (top3PctLinea > 65 && top1Linea.pct <= 30 && linConc.top.length >= 3) {
      const nombres = linConc.top.slice(0, 3).map(c => c.principal.split(" ").slice(0, 2).join(" ")).join(", ");
      estrategiasComerciales.push({
        tipo: "riesgo",
        titulo: `Concentración en ${linConc.linea}: top-3 = ${top3PctLinea.toFixed(0)}%`,
        detalle: `En ${linConc.linea}, los 3 principales clientes (${nombres}) representan el ${top3PctLinea.toFixed(0)}% del volumen. HHI: ${linConc.hhiLinea.toFixed(0)}. Activar plan de desarrollo de nuevos clientes en esta línea.`,
        semaforo: top3PctLinea > 80 ? "rojo" : "amarillo",
      });
    }
  }

  // Oportunidades: clientes con participación baja en su línea principal
  const clientesBajoVolumen = concentracionClientes.filter(c => c.pctDelTotal < 5 && c.pctDelTotal > 0);
  if (clientesBajoVolumen.length > 0) {
    const ejemplos = clientesBajoVolumen.slice(0, 3)
      .map(c => `${c.principal.split(" ").slice(0, 2).join(" ")} (${c.lineaPrincipal})`)
      .join(", ");
    estrategiasComerciales.push({
      tipo: "oportunidad",
      titulo: "Clientes con potencial de crecimiento",
      detalle: `${clientesBajoVolumen.length} clientes con participación menor al 5% en su línea. Evaluar planes de incremento: ${ejemplos}.`,
      semaforo: "verde",
    });
  }

  // Acción: diversificación de canales
  const canalesActivos = new Set(rows1Raw.map(r => r.canal).filter(Boolean));
  if (canalesActivos.size < 5) {
    estrategiasComerciales.push({
      tipo: "accion",
      titulo: "Ampliar presencia en canales",
      detalle: `Actualmente se opera en ${canalesActivos.size} canales. Explorar nuevos canales de distribución para reducir dependencia y aumentar cobertura de mercado.`,
      semaforo: "amarillo",
    });
  }

  if (estrategiasComerciales.length === 0) {
    estrategiasComerciales.push({
      tipo: "accion",
      titulo: "Portafolio de clientes saludable",
      detalle: `La distribución de volumen entre clientes muestra concentración moderada. HHI línea principal: ${hhiIndex.toFixed(0)}. Mantener la estrategia de diversificación actual.`,
      semaforo: "verde",
    });
  }

  // Alertas Críticas — top desfasados y sobre-cumplidos por Principal
  const alertasMap: Record<string, { linea: string; canal: string; ejec: number; meta: number }> = {};
  rows1Raw.forEach((r) => {
    const k = `${r.linea}||${r.canal}||${r.principal}`;
    if (!alertasMap[k]) alertasMap[k] = { linea: r.linea, canal: r.canal, ejec: 0, meta: 0 };
    alertasMap[k].ejec += r.ejec;
    alertasMap[k].meta += r.meta;
  });

  const alertasAll = Object.entries(alertasMap)
    .filter(([, v]) => Math.abs(v.ejec - v.meta) >= 0.01)
    .map(([k, v]) => {
      const [linea, canal, principal] = k.split("||");
      const diff = v.ejec - v.meta;
      const pct = v.meta > 0 ? ((v.ejec / v.meta - 1) * 100).toFixed(0) + "%" : "Sin meta";
      const unidad = getUnidad(linea);
      return { linea, canal, principal, diff, pct, unidad };
    });

  const alertasDesfasados = alertasAll
    .filter(a => a.diff < 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 5);

  const alertasSobrecumplidos = alertasAll
    .filter(a => a.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 5);

  return {
    fecha: xlData.ultimoDia,
    diasTransc: xlData.diasTransc,
    diasMes: xlData.diasMes,
    factor: xlData.factor,
    areas: [area1, area2],
    inventarios,
    recomendaciones,
    estrategiasComerciales,
    concentracionClientes,
    concentracionPorLinea,
    hhiIndex,
    alertasDesfasados,
    alertasSobrecumplidos,
  };
}

export function buildExcelSummary(xlData: ExcelData): string {
  const fmtCOP = (n: number) => {
    return `$${Math.round(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
  };

  const fmtN = (n: number) => Math.round(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });

  const getUnidadLinea = (nombre: string): string => {
    const n = nombre.trim().toUpperCase();
    if (n.includes("BENEFICIO")) return "reses";
    if (n.includes("DESPOSTE")) return "canales";
    if (n.includes("CORTES")) return "kg";
    if (n === "SC") return "kg";
    return "und";
  };

  const LINEA_ORDER_SRV = ["Beneficio", "Desposte", "Cortes", "SC"];
  const lineaRankSrv = (n: string) => {
    const idx = LINEA_ORDER_SRV.findIndex(l => n.trim().toUpperCase() === l.toUpperCase());
    return idx >= 0 ? idx : 99;
  };

  const linStr = [...xlData.tablaLineas]
    .sort((a, b) => lineaRankSrv(a.nombre) - lineaRankSrv(b.nombre))
    .map((l) => {
      const u = getUnidadLinea(l.nombre);
      return `  • ${l.nombre} (${u}): Día ejec=${fmtN(l.dEjec)} vs meta=${fmtN(l.dMeta)} (${l.dPct}%) | Mes acum=${fmtN(l.mEjec)} vs meta=${fmtN(l.mMeta)} (${l.mPct}%)`;
    })
    .join("\n");

  const canStr = [...xlData.tablaLineaCanal]
    .sort((a, b) => {
      const la = lineaRankSrv(a.linea), lb = lineaRankSrv(b.linea);
      if (la !== lb) return la - lb;
      return a.canal.localeCompare(b.canal);
    })
    .map((c) => {
      const u = getUnidadLinea(c.linea);
      return `  • ${c.linea} / ${c.canal} (${u}): Día ejec=${fmtN(c.dEjec)} vs meta=${fmtN(c.dMeta)} (${c.dPct}%) | Mes acum=${fmtN(c.mEjec)} vs meta=${fmtN(c.mMeta)} (${c.mPct}%)`;
    })
    .join("\n");

  const ingStr = xlData.tablaIngresos
    .map((u) =>
      `  • ${u.nombre}: Día ejec=${fmtCOP(u.dEjec)} vs meta=${fmtCOP(u.dMeta)} (${u.dPct}%) | Mes acum=${fmtCOP(u.mEjec)} vs meta=${fmtCOP(u.mMeta)} (${u.mPct}%)`
    )
    .join("\n");

  return `DATOS PROCESADOS DEL EXCEL
Último día con datos: ${xlData.ultimoDia}
Días transcurridos del mes: ${xlData.diasTransc} de ${xlData.diasMes} (factor proporcional: ${xlData.factor})
NOTA DE UNIDADES: Beneficio se mide en RESES, Desposte en CANALES, Cortes en KILOS, SC en KILOS.

== CONSOLIDADO — POR LÍNEA DE NEGOCIO ==
${linStr}

== CONSOLIDADO — POR LÍNEA Y CANAL DE DISTRIBUCIÓN ==
${canStr}

== INGRESOS ($MILLONES) — POR UNIDAD DE NEGOCIO (Beneficio, Comercialización, Desposte, Ingresos No Oper., Subproductos) ==
${ingStr}`;
}
