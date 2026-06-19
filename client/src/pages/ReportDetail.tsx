import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import ReportView from "@/components/ReportView";

export default function ReportDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0");

  const { data: report, isLoading, error } = trpc.reports.get.useQuery(
    { id },
    { enabled: id > 0 }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={36} className="animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Cargando reporte...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <AlertCircle size={48} className="text-red-400" />
        <div>
          <p className="text-lg font-semibold">Reporte no encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">El reporte no existe o no tienes acceso a él.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/history")}>
          <ArrowLeft size={16} className="mr-2" /> Volver al historial
        </Button>
      </div>
    );
  }

  if (report.status === "error") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="flex items-center gap-1">
          <ArrowLeft size={16} /> Volver
        </Button>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <AlertCircle size={48} className="text-red-400" />
          <div>
            <p className="text-lg font-semibold">Error al generar el reporte</p>
            <p className="text-sm text-red-600 mt-1">{report.errorMessage || "Error desconocido"}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report.reportData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
          <ArrowLeft size={16} className="mr-2" /> Volver
        </Button>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Loader2 size={36} className="animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">El reporte aún está siendo procesado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="flex items-center gap-1">
          <ArrowLeft size={16} /> Historial
        </Button>
        <span className="text-muted-foreground text-sm">/ Reporte #{report.id}</span>
      </div>
      <ReportView data={report.reportData as Record<string, unknown>} reportId={report.id} />
    </div>
  );
}
