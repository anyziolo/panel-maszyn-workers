// Minimalny shim API D1 (prepare().bind().first()/all()/run(), batch())
// oparty na wbudowanym node:sqlite - do lokalnego testowania db.js bez
// prawdziwego Cloudflare Workers/D1 (ktory nie jest dostepny w tym sandboxie).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

export function createD1(schemaPath) {
  const sqlite = new DatabaseSync(":memory:");
  const schema = fs.readFileSync(schemaPath, "utf8");
  sqlite.exec(schema);

  // D1's .bind() returns a NEW immutable prepared-statement instance (it does
  // not mutate the one it was called on) - important because callers like
  // db.js's markNotified() call stmt.bind(u) repeatedly on the SAME base
  // statement object to build a batch of independent bound statements.
  function wrapStatement(sql, boundArgs = []) {
    const api = {
      bind(...args) {
        return wrapStatement(sql, args);
      },
      async first() {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundArgs);
        return row === undefined ? null : row;
      },
      async all() {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...boundArgs);
        return { results };
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...boundArgs);
        return { meta: { last_row_id: info.lastInsertRowid, changes: info.changes } };
      },
      _sql: sql,
      _bound: () => boundArgs,
    };
    return api;
  }

  return {
    prepare(sql) {
      return wrapStatement(sql);
    },
    async batch(stmts) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  };
}
