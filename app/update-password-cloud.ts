import { randomBytes, scryptSync } from "crypto";
import mysql from "mysql2/promise";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function updatePassword() {
  const databaseUrl = process.env.DATABASE_URL;
  const newPassword = process.env.NEXORA_NEW_PASSWORD;
  const username = process.env.NEXORA_TARGET_USERNAME;
  if (!databaseUrl || !newPassword || !username) {
    throw new Error("Defina DATABASE_URL, NEXORA_TARGET_USERNAME e NEXORA_NEW_PASSWORD.");
  }
  const hashed = hashPassword(newPassword);

  const url = new URL(databaseUrl);

  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "4000"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { minVersion: "TLSv1.2" }
  });

  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT id, username, name FROM users WHERE username = ?",
    [username]
  );

  if (!rows || rows.length === 0) {
    console.log("Usuário não encontrado no banco da nuvem!");
    await connection.end();
    process.exit(1);
  }

  console.log("Usuário encontrado:", rows[0]);

  await connection.execute(
    "UPDATE users SET passwordHash = ?, updatedAt = NOW() WHERE username = ?",
    [hashed, username]
  );

  console.log("Senha atualizada com sucesso!");

  await connection.end();
}

updatePassword().catch(console.error);
