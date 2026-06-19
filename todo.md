# Colbeef Analyzer - TODO

## Base de Datos
- [x] Definir schema: tabla reports, report_metadata
- [x] Generar y aplicar migración SQL

## Backend (tRPC)
- [x] Router: subir imagen a S3 y obtener URL
- [x] Router: procesar Excel (CONSOLIDADO_BASES_PPTO_EJEC + ESQUEMA_BASE_INGRESOS_1)
- [x] Router: generar reporte con IA (invokeLLM con imagen + datos Excel)
- [x] Router: guardar reporte en base de datos
- [x] Router: listar reportes del usuario (historial)
- [x] Router: obtener detalle de un reporte
- [x] Router: eliminar reporte

## Frontend
- [x] Configurar tema corporativo Colbeef (verde #2e7d32, rojo #c0392b) en index.css
- [x] Layout principal con sidebar (DashboardLayout)
- [x] Página Home / Landing con login
- [x] Página de Análisis: carga de imagen + Excel + botón generar
- [x] Componente de reporte ejecutivo con KPIs, alertas, tablas
- [x] Página de Historial de reportes con filtros por fecha
- [x] Página de detalle de reporte guardado
- [x] Exportación a PDF (window.print)
- [x] Estados de carga, error y vacío

## Calidad
- [x] Validación imagen ≤ 5MB y formatos PNG/JPG/WEBP
- [x] Validación hojas Excel exactas
- [x] Tests vitest para routers principales (6/6 passing)
- [x] Diseño responsivo mobile-first

## Mejoras v2
- [x] Corregir lectura de fechas Excel (números seriales de Excel → fecha real con XLSX.SSF.parse_date_code)
- [x] Tomar la última fecha actualizada del Excel para el análisis del día
- [x] Excluir panel de carga del PDF (clase no-print + @media print en index.css)
- [x] Mejorar visuales del reporte ejecutivo (KpiCard, PctBadge, tablas con agrupación por línea, header degradado, footer corporativo)

## Mejoras v3
- [x] Corregir mapeo de columnas reales del Excel (Linea/Canal/Fecha/Ejecucion/Meta en CONSOLIDADO; Unidad/Categoria/Fecha/Ejecucion/Meta/Es olimpica en INGRESOS)
- [x] Filtrar ingresos solo con Es olimpica=SI
- [x] Detectar última fecha con ejecución > 0 correctamente — validado: 2026-03-02 con Beneficio 614/592.5 (103.6%), Cortes 1425/428.9 (332.3%)

## Mejoras v4
- [x] Columnas más angostas en tablas de desviaciones (padding reducido, fuente 0.78-0.8rem)
- [x] Agregar columnas de comentario narrativo "Comentario Día" y "Comentario Acum." con texto en formato "Superó meta en X kg (+Y%)"
- [x] Incluir Comercialización, Ingresos No Oper. y Subproductos en tabla de ingresos (quitando filtro Es olimpica=SI)
- [x] Validado: 5 unidades de ingresos disponibles: Beneficio, Comercialización, Desposte, Ingresos No Oper., Subproductos

## Mejoras v5
- [x] Orden fijo líneas: Beneficio → Desposte → Cortes → SC (lineaRank)
- [x] Orden fijo canales: Canal Directo → Canal Distribuidores → Canal Moderno → Comercialización → Horeca (canalRank)
- [x] Comentarios narrativos: ⬆ Sobre-cumplimiento: +X kg (+Y%) / ⬇ Desfase: -X kg (-Y%)

## Mejoras v6
- [x] Corregir unidades de medida: Beneficio=reses, Desposte=canales, Cortes=kg, SC=kg (frontend + resumen IA)

## Mejoras v7
- [x] PDF en formato horizontal (landscape) A4 con márgenes 10mm/8mm, tablas sin cortes, textos sin truncar, sidebar oculto

## Mejoras v8
- [x] Corregir PDF en blanco: ventana dedicada con HTML clonado + todos los estilos + fuentes Google
- [x] Corregir días hábiles: excluir domingos y día actual (2 mar 2026 = 1 día hábil previo: el 1 mar sábado)

## Mejoras v9
- [x] Columnas de comentario: top 3 Principales desfasados (⬇ rojo) y sobre-cumplidos (⬆ verde) por línea y por canal, con nombre, diferencia y % de desviación

## Módulo Reporte CEO (v10)
- [x] Generar datos estructurados del Reporte CEO desde el procesador de Excel (buildCeoReport)
- [x] Componente CeoReport: 4 Áreas de Éxito con semáforo (Rojo/Amarillo/Verde) y tendencia
- [x] Exportación a Excel del Reporte CEO (hoja resumen + hoja detalle)
- [x] Integrar botón "Reporte CEO" en el flujo del informe combinado (panel colapsable)
- [x] PDF landscape del Reporte CEO (ventana dedicada con estilos clonados)

## Mejoras Reporte CEO v11
- [x] Eliminar área redundante "CUMPLIMIENTO ACUMULADO DEL MES" del Reporte CEO
- [x] Agregar sección "INVENTARIOS Y CAPACIDAD OPERATIVA" con medias canales, vísceras, reses en corrales e inventario carnes (con barra de % ocupación cuando hay imagen)
- [x] Agregar sección "RECOMENDACIONES EJECUTIVAS" generadas automáticamente desde los datos del Excel
- [x] Reposicionar el Reporte CEO en la parte superior del flujo, expandido por defecto
- [x] El informe ejecutivo detallado queda como sección secundaria debajo del CEO Report
- [x] 9/9 tests pasando (3 nuevos tests para buildCeoReport)

## Mejoras Reporte CEO v12
- [x] Enriquecer inventarios del CEO Report con datos reales extraídos por la IA del dashboard Power BI (inv_medias_canales, inv_visceras, reses_corrales, inventario_carnes.total_kilos)

## Mejoras Reporte CEO v13
- [x] Obs.1: Semáforo invertido en Medias canales y Vísceras (verde=espacio disponible ≤75%, amarillo=75-90%, rojo=>90%)
- [x] Obs.2: Texto corregido: "X de Y días hábiles trabajados" + aprovechamiento operativo %
- [x] Obs.3: Recomendaciones Ejecutivas ordenadas rojo→amarillo→verde→info con iconos y etiquetas de nivel
- [x] Nuevo módulo "ESTRATEGIAS COMERCIALES" con análisis estratégico (riesgos/oportunidades/acciones) y tabla de concentración de clientes
- [x] Índice HHI calculado automáticamente desde los datos del Excel (por Principal)
- [x] 10/10 tests pasando (1 nuevo test para estrategias y concentración)

## Mejoras Reporte CEO v14
- [x] Calcular concentración de clientes por línea separada (Beneficio en reses, Desposte en canales, Cortes en kg)
- [x] Mostrar nombres explícitos del cliente dominante con su línea en los textos de riesgo
- [x] Porcentajes corregidos: cada cliente se mide dentro de su línea, no mezcla de unidades
- [x] Tabla de concentración agrupada por línea con HHI por línea y barras de participación
- [x] 10/10 tests pasando, 0 errores TypeScript

## Mejoras Reporte CEO v15
- [x] Eliminar tarjeta INFO "Aprovechamiento operativo" de Recomendaciones Ejecutivas
- [x] Compactar espaciados: márgenes reducidos (12→6px), paddings (14→8px), fuentes ajustadas, gap reducido (12→8px)
- [x] Reporte CEO optimizado para caber en una página A4 landscape sin islas en blanco
- [x] 10/10 tests pasando, 0 errores TypeScript

## Mejoras Reporte CEO v16
- [x] Usar rows1AcumRaw (datos acumulados del mes) para Concentración por Línea
- [x] Usar rows1AcumRaw para Estrategias Comerciales (riesgos y oportunidades)
- [x] 10/10 tests pasando, 0 errores TypeScript

## Mejoras Reporte CEO v17
- [x] Obs.1 (Inventarios): Meta del día vs. ejecutado semana anterior (campos metaDia, ejecutadoDiaAnterior)
- [x] Obs.2 (Inventarios): Vísceras netas = inventario - reses sacrificadas día anterior (campo visceraNeta)
- [x] Obs.3 (Inventarios): Días operativos cumplidos (campos diasOperativosCumplidos, diasOperativosTotal, pctDiasOperativos)
- [x] Obs.4-7 (Inventarios): Pendiente frontend (no comentarios sobre datos en cero, no redundancia)
- [x] Obs.1 (Recomendaciones): SC reorientada al objetivo (meta del día)
- [x] Obs.2 (Recomendaciones): Vísceras netas (pendiente frontend)
- [x] Backend: 10/10 tests, 0 errores TypeScript

## Mejoras Reporte CEO v18
- [x] Tamaño de letra ajustado (statusDia→execDia, statusAcum→execAcum para mejor legibilidad)
- [x] Columna de Tendencia eliminada del reporte CEO
- [x] Sección Análisis de Ingresos eliminada del reporte detallado (solo en CEO)
- [x] Vísceras cambiadas a "und" (unidades en lugar de kg)
- [x] Semáforo Reses en corrales: rojo <150, amarillo 150-250, verde ≥250
- [x] Etiqueta "Status Día" cambiada a "Ejec. Día"
- [x] Concentración por Línea reorganizada: Beneficio → Desposte → Cortes → SC
- [x] Título "Canales Despostadas" cambiado a "Canales Despostadas del Día"
- [x] Logos de composición: 🐄 vaca y 🐂 toro (en lugar de símbolos genéricos)
- [x] Sección "Inventario Producto" eliminada del reporte detallado
- [x] 10/10 tests pasando, 0 errores TypeScript

## Mejoras Reporte CEO v19
- [x] Tamaño de letra incrementado en PDF del Reporte CEO (font-size: 1.1em)
- [x] Orientación PDF Reporte CEO cambiada a vertical (portrait, 8.5" × 13")
- [x] Tamaño de papel Oficio (8.5" × 13") aplicado para que quepa en una página
- [x] Tamaño de letra incrementado en PDF del reporte detallado (font-size: 11px)
- [x] Orientación PDF reporte detallado cambiada a vertical (portrait, 8.5" × 13")
- [x] Tamaño de papel Oficio aplicado a reporte detallado
- [x] 10/10 tests pasando, 0 errores TypeScript

## Mejoras Reporte CEO v20
- [x] Estilos de impresión PDF optimizados: márgenes reducidos (6mm 8mm), font-size 0.9rem
- [x] Tablas: padding reducido (3px 5px), font-size 0.85rem, overflow visible
- [x] Sección Inventarios: gap reducido (8px), padding (8px 12px), tarjetas compactadas
- [x] Coherencia visual garantizada: sin recortes, sin superposiciones, sin islas en blanco
- [x] 10/10 tests pasando, 0 errores TypeScript

## Mejoras Reporte CEO v21
- [x] Cambiar unidad de vísceras de "kg" a "und"
- [x] Agregar análisis en tarjeta de vísceras: Total - Día anterior (reses beneficiadas) = Vísceras anteriores
- [x] Reemplazar "Reses Planilladas" por "Meta del Día"
- [x] Cambiar etiquetas de composición de "Vacas/Toros" a "Hembras/Machos" (mantener logos 🐄 y 🐂)

## Mejoras Reporte CEO v22
- [x] Eliminar comentario "Ejecutado: 0 · Desv: -100%" de "META DEL DÍA"
- [x] Mostrar solo meta del día en "CANALES DEL DÍA" (sin comentarios)
- [x] Cambiar unidad de vísceras de "kg" a "und" en Analyzer.tsx
- [x] Implementar cálculo de visceraNeta: Total vísceras - Reses beneficiadas día anterior
- [x] 10/10 tests pasando, 0 errores TypeScript, build exitoso

## Mejoras Reporte CEO v23
- [x] Cambiar título "Meta del Día" a "Meta del día beneficio"
- [x] Cambiar título "Canales del Día" a "Meta del día desposte"
- [x] Eliminar tarjeta "Canales Despostadas del Día"
- [x] Cambiar título "Composición" a "Composición de beneficio"
- [x] 10/10 tests pasando, 0 errores TypeScript
