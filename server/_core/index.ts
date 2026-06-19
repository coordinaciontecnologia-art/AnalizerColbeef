import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number, host: string): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const host = ENV.host;
  const preferredPort = ENV.port;
  const port = await findAvailablePort(preferredPort, host);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const localUrl = `http://localhost:${port}/`;
  const networkBase = ENV.publicUrl || `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`;
  const networkUrl = networkBase.endsWith("/") ? networkBase : `${networkBase}/`;

  server.listen(port, host, () => {
    console.log("");
    console.log("  Colbeef — Analisis Ejecutivo Diario");
    console.log("  ===================================");
    console.log(`  Local:    ${localUrl}`);
    console.log(`  Red LAN:  ${networkUrl}`);
    console.log(`  Analisis: ${networkUrl.replace(/\/$/, "")}/analyzer`);
    console.log("");
    console.log("  Comparte la URL de Red LAN con otros equipos de la misma red.");
    console.log("");
  });
}

startServer().catch(console.error);
