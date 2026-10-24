const http = require("node:http");

const submissions = [];
const PORT = process.env.PORT || 3000;

const html = `
  <div style="max-width: 760px; margin: 40px auto; padding: 0 20px; font-family: system-ui, sans-serif; line-height: 1.5">
    <h1 style="color: #5C6AC4;">API para Roblox</h1>
    <p>Gere um número aleatório de 0 a 100 ou envie valores produzidos pelo seu script Roblox.</p>
    <h2>Endpoints</h2>
    <ul>
      <li><code>GET /api/random</code> — retorna um número aleatório entre 0 e 100.</li>
      <li><code>POST /api/data</code> — envia um valor JSON no formato <code>{"value": 42}</code>.</li>
      <li><code>GET /api/data</code> — consulta os valores enviados desde que o servidor iniciou.</li>
    </ul>
    <h2>Exemplo no Roblox</h2>
    <pre style="overflow-x: auto; background: #f3f4f6; padding: 16px; border-radius: 8px;"><code>local HttpService = game:GetService("HttpService")
local url = "SUA_URL/api/random"
local resposta = HttpService:GetAsync(url)
local dados = HttpService:JSONDecode(resposta)
print(dados.value)</code></pre>
    <p>Para enviar um número gerado no Roblox, use <code>POST /api/data</code> com JSON. Ative solicitações HTTP nas configurações da experiência.</p>
  </div>
`;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/random") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ value: Math.floor(Math.random() * 101) }));
    return;
  }

  if (req.method === "GET" && pathname === "/api/data") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ submissions }));
    return;
  }

  if (req.method === "POST" && pathname === "/api/data") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Corpo da solicitação muito grande" }));
        req.destroy();
      }
    });

    req.on("end", () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Envie um JSON válido" }));
        return;
      }

      if (!Number.isInteger(data.value) || data.value < 0 || data.value > 100) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "value deve ser um número inteiro entre 0 e 100" }));
        return;
      }

      const submission = { value: data.value, receivedAt: new Date().toISOString() };
      submissions.push(submission);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, submission }));
    });
    return;
  }

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Rota não encontrada" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
