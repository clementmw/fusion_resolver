import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

    // Create the Prisma adapter
const adapter = new PrismaPg(pool);

// Pass the adapter to PrismaClient
export const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});