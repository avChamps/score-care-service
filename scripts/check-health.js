const env = require("../src/config/env");

async function checkHealth() {
  const response = await fetch(`http://localhost:${env.port}/health`);
  const body = await response.json();

  console.log(JSON.stringify(body, null, 2));
}

checkHealth().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
