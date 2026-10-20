import type { Database } from "./database.types";

// The generated Database also carries a `__InternalSupabase` entry that is
// not a schema.
export type Schema = Exclude<keyof Database, "__InternalSupabase">;

// Keep schema explicit at callers while using the standard generated database types.
export type Tables<
  S extends Schema,
  Name extends keyof (Database[S]["Tables"] & Database[S]["Views"]),
> = (Database[S]["Tables"] & Database[S]["Views"])[Name] extends { Row: infer Row }
  ? Row
  : never;
