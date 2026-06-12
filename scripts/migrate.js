const fs = require("fs/promises");
const path = require("path");

const { pool } = require("../src/config/db");

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "..", "database", "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (error) {
        if (
          ![
            "ER_CANT_DROP_FIELD_OR_KEY",
            "ER_DUP_FIELDNAME",
            "ER_DUP_KEYNAME"
          ].includes(error.code)
        ) {
          throw error;
        }
      }
    }

    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await pool.end();
      console.log("Database migrations completed");
    })
    .catch(async (error) => {
      await pool.end();
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  runMigrations
};
