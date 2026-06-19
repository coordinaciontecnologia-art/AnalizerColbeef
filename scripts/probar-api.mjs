import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000/api/trpc";
const root = path.resolve(import.meta.dirname, "..");

const imgPath = path.join(root, "WhatsApp Image 2026-06-18 at 2.13.22 PM.jpeg");
const xlPath = "C:\\Users\\COORD TIC\\Downloads\\BASES DE DATOS COMPILADAS SEGUIMIENTO PPTO (28).xlsx";

async function trpcMutation(procedure, input) {
  const res = await fetch(`${BASE}/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(JSON.stringify(data.error ?? data, null, 2));
  }
  return data.result?.data?.json ?? data;
}

async function trpcQuery(procedure) {
  const input = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
  const res = await fetch(`${BASE}/${procedure}?batch=1&input=${input}`);
  const data = await res.json();
  return data[0]?.result?.data?.json;
}

function toB64(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

console.log("\n=== Colbeef — Prueba de API ===\n");

const user = await trpcQuery("auth.me");
console.log("✓ Auth OK:", user?.name, `(${user?.email})`);

console.log("\n→ Procesando Excel...");
const xlB64 = toB64(xlPath);
const xlResult = await trpcMutation("upload.excel", {
  base64: xlB64,
  filename: path.basename(xlPath),
});
console.log("✓ Excel OK");
console.log("  Último día:", xlResult.xlData?.ultimoDia);
console.log("  Líneas:", xlResult.xlData?.totalLineas, "| Canales:", xlResult.xlData?.totalCanales);
console.log("  CEO Report áreas:", xlResult.ceoReport?.areas?.length ?? "N/D");

console.log("\n→ Subiendo imagen...");
const imgB64 = toB64(imgPath);
const imgResult = await trpcMutation("upload.image", {
  base64: imgB64,
  mimeType: "image/jpeg",
  filename: "dashboard-test.jpg",
});
console.log("✓ Imagen OK:", imgResult.url?.slice(0, 60) + "...");

console.log("\n→ Generando informe con IA (puede tardar 30-60 s)...");
const report = await trpcMutation("reports.generate", {
  imageUrl: imgResult.url,
  imageKey: imgResult.key,
  imageMime: "image/jpeg",
  excelSummary: xlResult.summary,
});
console.log("✓ Informe generado!");
console.log("  ID reporte:", report.reportId);
console.log("  Tipo:", report.reportData?.tipo_reporte);
console.log("  Fecha:", report.reportData?.fecha);

console.log("\n=== PRUEBA EXITOSA ===");
console.log("Abre http://localhost:3000/analyzer para ver la interfaz\n");
