/** Alertas que no deben mostrarse ni guardarse en el informe. */
export function isIgnoredAlert(alert: Record<string, unknown>): boolean {
  const titulo = String(alert.titulo ?? alert.title ?? "").toLowerCase();
  const desc = String(alert.descripcion ?? alert.description ?? "").toLowerCase();
  const combined = `${titulo} ${desc}`;

  if (
    titulo.includes("sacrificio del día en cero") ||
    titulo.includes("sacrificio del dia en cero")
  ) {
    return true;
  }

  if (
    combined.includes("reses planilladas") &&
    (combined.includes("canales del día") || combined.includes("canales del dia")) &&
    (combined.includes("en 0") || combined.includes("están en 0") || combined.includes("estan en 0"))
  ) {
    return true;
  }

  return false;
}

export function filterReportAlerts(alertas: unknown): Record<string, unknown>[] {
  const arr = Array.isArray(alertas)
    ? alertas
    : alertas && typeof alertas === "object"
      ? Object.values(alertas as object)
      : [];

  return (arr as Record<string, unknown>[]).filter(a => !isIgnoredAlert(a));
}
