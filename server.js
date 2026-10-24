
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const WARNING_LIMIT = 5;

let submissions = [];
let alerts = [];
let games = {};

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    submissions = Array.isArray(data.submissions) ? data.submissions : [];
    alerts = Array.isArray(data.alerts) ? data.alerts : [];
    games = data.games && typeof data.games === "object" ? data.games : {};
  } catch {
    submissions = [];
    alerts = [];
    games = {};
  }
}

function saveData() {
  try {
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify({
      submissions,
      alerts,
      games
    }, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (error) {
    console.error("Não foi possível guardar os dados:", error.message);
  }
}

loadData();

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function getRanking() {
  return Object.values(games).sort((a, b) => b.alertCount - a.alertCount);
}

function recordAlert(data) {
  const placeId = String(data.gamePlaceId || data.placeId || "unknown");
  const gameName = String(data.gameName || "Jogo sem nome").slice(0, 150);
  const reason = String(data.reason || "Alerta enviado pelo anti-cheat").slice(0, 500);
  const alertText = String(data.alert || "CHEATER ALERT!!").slice(0, 150);
  const now = new Date().toISOString();

  if (!games[placeId]) {
    games[placeId] = {
      placeId,
      gameName,
      alertCount: 0,
      firstSeen: now,
      lastSeen: now
    };
  }

  const game = games[placeId];
  game.gameName = gameName;
  game.alertCount++;
  game.lastSeen = now;

  const incident = {
    id: alerts.length + 1,
    placeId,
    gameName,
    alert: alertText,
    reason,
    path: String(data.path || "unknown").slice(0, 500),
    receivedAt: now,
    countForGame: game.alertCount,
    warning: game.alertCount >= WARNING_LIMIT
  };

  alerts.push(incident);

  if (alerts.length > 10000) {
    alerts = alerts.slice(-10000);
  }

  saveData();

  console.log(
    `[ANTI-CHEAT] ${gameName} (${placeId}) | ` +
    `Alertas: ${game.alertCount} | ${reason}`
  );

  if (game.alertCount === WARNING_LIMIT) {
    console.warn(
      `[AVISO] O jogo ${gameName} (${placeId}) atingiu ` +
      `${WARNING_LIMIT} alertas detectados.`
    );
  }

  return incident;
}

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roblox Anti-Cheat Monitor</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0b1020;color:#edf2ff;font-family:system-ui,sans-serif}
main{max-width:1100px;margin:auto;padding:25px}
h1{margin-bottom:5px}
.sub{color:#aab5d0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:25px 0}
.card,section{background:#141c31;border:1px solid #293653;border-radius:13px;padding:18px}
.number{font-size:30px;font-weight:700;margin-top:8px}
h2{font-size:19px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:12px;border-bottom:1px solid #293653;overflow-wrap:anywhere}
th{color:#aab5d0}
.wrap{overflow-x:auto}
.warning{color:#ffb454;font-weight:700}
.ok{color:#7de5a4}
small{color:#aab5d0}
code{overflow-wrap:anywhere}
@media(max-width:600px){main{padding:14px}th,td{padding:8px;font-size:13px}}
</style>
</head>
<body>
<main>
<h1>Roblox Anti-Cheat Monitor</h1>
<div class="sub">Monitoramento de alertas recebidos dos jogos</div>

<div class="cards">
<div class="card">Jogos monitorados<div class="number" id="gameCount">0</div></div>
<div class="card">Alertas registrados<div class="number" id="alertCount">0</div></div>
<div class="card">Jogos com avisos<div class="number" id="warningCount">0</div></div>
<div class="card">Jogo com mais alertas<div class="number" id="topGame" style="font-size:19px">Nenhum</div></div>
</div>

<section>
<h2>Ranking de jogos com mais alertas</h2>
<div class="wrap"><table>
<thead><tr><th>Jogo</th><th>Place ID</th><th>Alertas</th><th>Status</th><th>Último alerta</th></tr></thead>
<tbody id="ranking"><tr><td colspan="5">Carregando...</td></tr></tbody>
</table></div>
</section>

<br>

<section>
<h2>Alertas recentes</h2>
<div class="wrap"><table>
<thead><tr><th>Data</th><th>Jogo</th><th>Motivo</th><th>Caminho</th></tr></thead>
<tbody id="recent"><tr><td colspan="4">Carregando...</td></tr></tbody>
</table></div>
</section>
<p class="sub"><small>Os dados representam alertas enviados pelo anti-cheat, não uma confirmação independente de invasão. Atualização automática a cada 5 segundos.</small></p>
</main>
<script>
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);

async function update() {
  try {
    const r = await fetch("/api/stats", {cache:"no-store"});
    if (!r.ok) throw new Error("Erro HTTP");
    const d = await r.json();

    document.getElementById("gameCount").textContent = d.games.length;
    document.getElementById("alertCount").textContent = d.totalAlerts;
    document.getElementById("warningCount").textContent =
      d.games.filter(g => g.alertCount >= d.warningLimit).length;

    const top = d.games[0];
    document.getElementById("topGame").textContent =
      top ? top.gameName : "Nenhum";

    document.getElementById("ranking").innerHTML = d.games.length
      ? d.games.map(g => \`<tr>
          <td>\${esc(g.gameName)}</td>
          <td>\${esc(g.placeId)}</td>
          <td>\${g.alertCount}</td>
          <td class="\${g.alertCount >= d.warningLimit ? "warning" : "ok"}">
            \${g.alertCount >= d.warningLimit ? "AVISO" : "Monitorado"}
          </td>
          <td>\${esc(g.lastSeen)}</td>
        </tr>\`).join("")
      : '<tr><td colspan="5">Nenhum alerta recebido ainda.</td></tr>';

    document.getElementById("recent").innerHTML = d.alerts.length
      ? d.alerts.slice().reverse().slice(0,50).map(a => \`<tr>
          <td>\${esc(a.receivedAt)}</td>
          <td>\${esc(a.gameName)} (\${esc(a.placeId)})</td>
          <td>\${esc(a.reason)}</td>
          <td>\${esc(a.path)}</td>
        </tr>\`).join("")
      : '<tr><td colspan="4">Nenhum alerta recebido ainda.</td></tr>';
  } catch(e) {
    document.getElementById("ranking").innerHTML =
      '<tr><td colspan="5">Não foi possível carregar os dados.</td></tr>';
  }
}
update();
setInterval(update, 5000);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const pathname = new URL(
    req.url,
    "http://" + (req.headers.host || "localhost")
  ).pathname;

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    return res.end(html);
  }

  if (req.method === "GET" && pathname === "/api/random") {
    return sendJSON(res, 200, {
      value: Math.floor(Math.random() * 101)
    });
  }

  if (req.method === "GET" && pathname === "/api/data") {
    return sendJSON(res, 200, {submissions});
  }

  if (req.method === "GET" && pathname === "/api/alerts") {
    return sendJSON(res, 200, {alerts});
  }

  if (req.method === "GET" && pathname === "/api/games") {
    return sendJSON(res, 200, {games: getRanking()});
  }

  if (req.method === "GET" && pathname === "/api/stats") {
    return sendJSON(res, 200, {
      totalAlerts: alerts.length,
      warningLimit: WARNING_LIMIT,
      games: getRanking(),
      alerts: alerts.slice(-100)
    });
  }

  if (req.method === "POST" && pathname === "/api/data") {
    let body = "";
    let rejected = false;

    req.on("data", chunk => {
      if (rejected) return;

      body += chunk.toString();

      if (Buffer.byteLength(body) > 10000) {
        rejected = true;
        sendJSON(res, 413, {error:"Corpo muito grande"});
        req.destroy();
      }
    });

    req.on("end", () => {
      if (rejected) return;

      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return sendJSON(res, 400, {error:"Envie um JSON válido"});
      }

      const isAlert =
        data.type === "cheater_alert" ||
        data.alert === "CHEATER ALERT!!";

      if (isAlert) {
        const incident = recordAlert(data);
        return sendJSON(res, 201, {
          ok: true,
          type: "cheater_alert",
          incident,
          warning: incident.warning
        });
      }

      if (
        !Number.isInteger(data.value) ||
        data.value < 0 ||
        data.value > 100
      ) {
        return sendJSON(res, 400, {
          error:"value deve ser um número inteiro entre 0 e 100"
        });
      }

      const submission = {
        value:data.value,
        receivedAt:new Date().toISOString()
      };

      submissions.push(submission);
      if (submissions.length > 10000) {
        submissions = submissions.slice(-10000);
      }
      saveData();

      return sendJSON(res, 201, {ok:true, submission});
    });
    return;
  }

  return sendJSON(res, 404, {error:"Rota não encontrada"});
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor iniciado na porta " + PORT);
});
