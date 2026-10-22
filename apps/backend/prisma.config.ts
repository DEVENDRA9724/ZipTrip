import "dotenv/config";
import { defineConfig } from "prisma/config";

const rawUrl = process.env["DATABASE_URL"] || "";
const isPostgres = /^postgres(ql)?:\/\//.test(rawUrl);

export default defineConfig({
  schema: isPostgres ? "prisma/postgresql/schema.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/postgresql/migrations" : "prisma/migrations",
  },
  datasource: {
    url: isPostgres ? rawUrl : (rawUrl || "file:./portal.db"),
  },
});
