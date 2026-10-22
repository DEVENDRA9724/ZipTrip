// Minimal typings for the better-sqlite3 calls used by tests to build isolated databases from the fixture schema.
// (The package ships no types and @types/better-sqlite3 is not installed.)
declare module 'better-sqlite3' {
  class Database {
    constructor(
      filename: string,
      options?: { readonly?: boolean; fileMustExist?: boolean },
    );
    exec(sql: string): this;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    close(): this;
  }
  export = Database;
}
