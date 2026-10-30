import mysql from "mysql2/promise";

async function listUsers() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória.");
  const connection = await mysql.createConnection(databaseUrl);
  const [rows] = await connection.execute("SELECT id, username, name, email FROM users");
  console.log(rows);
  await connection.end();
}

listUsers().catch(console.error);
