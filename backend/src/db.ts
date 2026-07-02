import { PrismaClient } from "./generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

// Use DATABASE_URL env var if set; otherwise fall back to local dev.db
const dbUrl =
  process.env.DATABASE_URL ??
  (() => {
    const dbPath = path.resolve(__dirname, "../dev.db");
    return `file:${dbPath.replace(/\\/g, "/")}`;
  })();

const adapter = new PrismaLibSql({ url: dbUrl });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter });

export default prisma;
