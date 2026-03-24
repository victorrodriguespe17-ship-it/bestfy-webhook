const http = require('http');
const PORT = process.env.PORT || 3000;
var messages = [], MAX_MSGS = 1000;
var EXT_TOKEN = process.env.EXT_TOKEN || 'bestfycrm2024';

function addMessage(msg) { messages.push(msg); if (messages.length > MAX_MSGS) messages = messages.slice(-MAX_MSGS); }
function parseBody(req, cb) { var b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{cb(null,JSON.parse(b))}catch(e){cb(null,{})} }); }

function resolvePhone(data) {
  var candidates = [data.phone, data.participantPhone, data.senderPhone, data.connectedPhone, data.from];
  for (var i=0;i<candidates.length;i++) {
    var p = candidates[i]; if (!p) continue;
    var clean = String(p).split('@')[0].split(':')[0].replace(/\D/g,'');
    if (clean.length >= 8 && clean.length <= 13) return clean;
  }
  return String(data.phone||data.from||'').split('@')[0].split(':')[0] || '';
}
function resolveName(data, phone) { return data.chatName||data.senderName||data.pushName||phone; }

var server = http.createServer(function(req,res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Ext-Token');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if (req.method==='OPTIONS') { res.writeHead(200); res.end(); return; }
  var url = req.url.split('?')[0];

  if (req.method==='POST' && url==='/webhook') {
    parseBody(req, function(err,data) {
      console.log('[webhook]', JSON.stringify(data).slice(0,300));
      var phone=resolvePhone(data), name=resolveName(data,phone);
      var text=(data.text&&data.text.message)||data.caption||data.fileName||'';
      var ts=data.momment||data.timestamp||Date.now();
      if (ts&&ts<1e12) ts=ts*1000;
      if (text) addMessage({phone,name,fromMe:!!data.fromMe,text,ts,isGroup:!!data.isGroup,status:data.status||''});
      res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true}));
    }); return;
  }

  if (req.method==='GET' && url==='/messages') {
    if ((req.headers['x-ext-token']||'')!==EXT_TOKEN) { res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return; }
    var since=parseInt(new URLSearchParams(req.url.split('?')[1]||'').get('since')||'0');
    var result=since?messages.filter(m=>m.ts>since):messages;
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); return;
  }

  if (req.method==='GET' && url==='/health') {
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true,msgs:messages.length,ts:Date.now()})); return;
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT,()=>console.log('Bestfy Webhook porta',PORT));
