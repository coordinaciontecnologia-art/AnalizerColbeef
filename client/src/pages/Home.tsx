import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Loader2, BarChart3, FileSpreadsheet, Brain, Download } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d1b2a, #1b2838)" }}>
        <Loader2 size={36} className="animate-spin text-white" />
      </div>
    );
  }

  if (isAuthenticated) {
    navigate("/analyzer");
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0f3460 100%)" }}>
      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <div className="mb-6">
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 10vw, 6rem)", lineHeight: 1 }}>
            <span style={{ color: "#2e7d32" }}>Col</span><span style={{ color: "#c0392b" }}>beef</span>
          </div>
          <div
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1rem, 3vw, 1.5rem)", color: "#a8c4e0", letterSpacing: 4, textTransform: "uppercase", marginTop: "0.25rem" }}
          >
            Plataforma de Análisis Ejecutivo
          </div>
        </div>

        <p className="text-lg mb-10 max-w-xl" style={{ color: "#cfd8dc", lineHeight: 1.7 }}>
          Combina imágenes de dashboards Power BI con datos de Excel para generar
          <strong style={{ color: "#4fc3f7" }}> reportes ejecutivos automáticos</strong> con inteligencia artificial.
        </p>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 max-w-3xl w-full">
          {[
            { icon: <BarChart3 size={24} />, label: "KPIs en tiempo real" },
            { icon: <FileSpreadsheet size={24} />, label: "Análisis de Excel" },
            { icon: <Brain size={24} />, label: "IA Integrada" },
            { icon: <Download size={24} />, label: "Exportar a PDF" },
          ].map((f, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div style={{ color: "#4fc3f7" }}>{f.icon}</div>
              <span className="text-sm font-semibold" style={{ color: "#cfd8dc" }}>{f.label}</span>
            </div>
          ))}
        </div>

        <a href={getLoginUrl()}>
          <button
            className="px-12 py-4 rounded-lg font-bold tracking-widest uppercase text-lg transition-all duration-300 hover:scale-105"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              background: "linear-gradient(135deg, #c0392b, #e74c3c)",
              color: "#fff",
              border: "none",
              boxShadow: "0 6px 24px rgba(192,57,43,0.5)",
            }}
          >
            🚀 INGRESAR A LA PLATAFORMA
          </button>
        </a>

        <p className="mt-4 text-xs" style={{ color: "#607d8b" }}>
          Acceso seguro · Historial de reportes · Exportación PDF
        </p>
      </div>
    </div>
  );
}
