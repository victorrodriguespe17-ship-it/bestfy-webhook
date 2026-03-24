// ── Bestfy CRM — Servidor de Webhook Z-API ────────────────────
const http = require('http');
const PORT = process.env.PORT || 3000;

var messages = [];
var MAX_MSGS = 500;
var EXT_TOKEN = process.env.EXT_TOKEN || 'bestfycrm2024';

function addMessage(msg) {
  messages.push(msg);
  if (messages.length > MAX_MSGS) messages = messages.slice(-MAX_MSGS);
}

function parseBody(req, cb) {
  var body = '';
  req.on('data', function(chunk) { body += chunk.toString(); });
  req.on('end', function() {
    try { cb(null, JSON.parse(body)); }
    catch(e) { cb(null, {}); }
  });
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ext-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  var url = req.url.split('?')[0];

  if (req.method === 'POST' && url === '/webhook') {
    parseBody(req, function(err, data) {
      console.log('[webhook] recebido:', JSON.stringify(data).slice(0, 200));
      var phone   = data.phone || data.from || '';
      var fromMe  = !!data.fromMe;
      var text    = (data.text && data.text.message) || data.caption || data.fileName || '';
      var ts      = data.momment || data.timestamp || Date.now();
      if (ts < 1e12) ts = ts * 1000;
      var name    = data.chatName || data.senderName || phone;
      var isGroup = !!data.isGroup;
      var status  = data.status || '';
      if (phone && text) {
        addMessage({ phone, fromMe, text, ts, name, isGroup, status });
        console.log('[webhook] salvo de', phone, ':', text.slice(0, 60));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.method === 'GET' && url === '/messages') {
    var token = req.headers['x-ext-token'] || '';
    if (token !== EXT_TOKEN) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
    var params = new URLSearchParams(req.url.split('?')[1] || '');
    var since  = parseInt(params.get('since') || '0');
    var result = since ? messages.filter(function(m){ return m.ts > since; }) : messages;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, msgs: messages.length, ts: Date.now() }));
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, function() {
  console.log('Bestfy Webhook Server rodando na porta', PORT);
});
