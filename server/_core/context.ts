import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

const DEV_USER_OPEN_ID = "dev-local-colbeef";

async function getDevUser(): Promise<User | null> {
  await upsertUser({
    openId: DEV_USER_OPEN_ID,
    name: "Usuario Local",
    email: "local@colbeef.dev",
    loginMethod: "dev",
    role: "admin",
  });
  return (await getUserByOpenId(DEV_USER_OPEN_ID)) ?? null;
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (ENV.devBypassAuth) {
    user = await getDevUser();
    return { req: opts.req, res: opts.res, user };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
