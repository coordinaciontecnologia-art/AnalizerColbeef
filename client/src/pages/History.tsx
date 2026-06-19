import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Trash2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PAGE_SIZE = 10;

function statusBadge(status: string) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Completado</Badge>;
  if (status === "processing") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">⏳ Procesando</Badge>;
  if (status === "error") return <Badge className="bg-red-100 text-red-800 border-red-200">❌ Error</Badge>;
  return <Badge variant="secondary">Pendiente</Badge>;
}

export default function History() {
  const [page, setPage] = useState(0);
  const [, navigate] = useLocation();

  const { data, isLoading, refetch } = trpc.reports.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const deleteReport = trpc.reports.delete.useMutation({
    onSuccess: () => {
      toast.success("Reporte eliminado");
      refetch();
    },
    onError: (err) => toast.error("Error al eliminar: " + err.message),
  });

  const reports = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Eliminar este reporte?")) {
      deleteReport.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl tracking-widest"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: "var(--colbeef-dark)" }}
          >
            📋 HISTORIAL DE REPORTES
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} {total === 1 ? "reporte generado" : "reportes generados"}
          </p>
        </div>
        <Button
          onClick={() => navigate("/analyzer")}
          style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)", color: "#fff", border: "none" }}
          className="font-bold tracking-wider"
        >
          + Nuevo Análisis
        </Button>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <FileText size={48} className="text-muted-foreground opacity-40" />
            <div>
              <p className="text-lg font-semibold text-muted-foreground">No hay reportes aún</p>
              <p className="text-sm text-muted-foreground mt-1">Sube una imagen y/o Excel para generar tu primer informe ejecutivo</p>
            </div>
            <Button
              onClick={() => navigate("/analyzer")}
              style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)", color: "#fff", border: "none" }}
            >
              Crear primer análisis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
              style={{ borderLeftColor: report.status === "completed" ? "#2e7d32" : report.status === "error" ? "#c0392b" : "#e67e00" }}
              onClick={() => navigate(`/report/${report.id}`)}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold text-base truncate"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--colbeef-dark)" }}
                      >
                        {report.title}
                      </span>
                      {statusBadge(report.status)}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {report.reportDate && (
                        <span className="text-xs text-muted-foreground">📅 {report.reportDate}</span>
                      )}
                      {report.reportType && (
                        <span className="text-xs text-muted-foreground">📊 {report.reportType}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        🕐 {new Date(report.createdAt).toLocaleString("es-CO")}
                      </span>
                    </div>
                    {report.status === "error" && report.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 truncate">⚠️ {report.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {report.imageUrl && (
                      <img
                        src={report.imageUrl}
                        alt="thumbnail"
                        className="w-14 h-10 object-cover rounded border"
                        style={{ borderColor: "#dde0e3" }}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); navigate(`/report/${report.id}`); }}
                      title="Ver reporte"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(report.id, e)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
