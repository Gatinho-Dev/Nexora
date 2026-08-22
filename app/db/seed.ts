import { getDb } from "../api/queries/connection";
// TODO: import tables from "./schema"

async function seed() {
  getDb(); // initialize connection pool
  console.log("Seeding database...");

  // TODO: insert seed data, e.g.
  // const db = getDb();
  // await db.insert(schema.posts).values([
  //   { title: "First post", content: "Hello world" },
  // ]);

  console.log("Done.");
  process.exit(0); // close MySQL connection pool
}

seed();
