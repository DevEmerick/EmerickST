// EmerickST Party: comunicacao LOCAL entre abas do mesmo Chrome.
// Nao aciona o Stonegy nem altera as automacoes do bot.
const clients = new Map();
const rooms = new Map();
const LIMIT = 12000;
const nameText = (s, max) => String(s ?? '').trim().slice(0, max);
const active = c => Date.now() - c.seen < LIMIT;
const members = room => [...clients.values()].filter(c => c.room === room);
const deliver = (c, data) => { try { c.port.postMessage(data); } catch (_) {} };
function broadcast(room) {
  if (!room) return;
  const list = members(room);
  const info = rooms.get(room) || {request:null, notice:'', hunt:''};
  const roster = list.map(c => ({
    id:c.id, name:c.name, role:c.role, online:active(c)
  }));
  for (const c of list) deliver(c, {
    type:'SNAPSHOT', you:c.id, members:roster,
    hunt:info.hunt || '',
    request:info.request && {
      id:info.request.id, hunt:info.request.hunt,
      phase:info.request.phase, votes:info.request.votes,
    }, notice:info.notice || ''
  });
}
function cancel(room, reason) {
  const info = rooms.get(room);
  if (info && info.request) {
    info.request = null;
    info.notice = reason;
  }
}
function leave(c) {
  const room = c.room;
  if (!room) return;
  const wasLeader = c.role === 'leader';
  c.room = ''; c.name = ''; c.role = '';
  if (wasLeader) {
    const info = rooms.get(room);
    if (info) info.hunt='';
  }
  cancel(room, 'Solicitacao cancelada: participante desconectado ou alterado.');
  broadcast(room);
  if (!members(room).length) rooms.delete(room);
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'emerickst-party-v1') return;
  const url = port.sender?.url || port.sender?.tab?.url || '';
  let host = '';
  try { host = new URL(url).hostname; } catch (_) {}
  if (host !== 'stonegy-online.com' && !host.endsWith('.stonegy-online.com')) {
    port.disconnect(); return;
  }
  const c = { id:crypto.randomUUID(), port, name:'', room:'', role:'', seen:Date.now() };
  clients.set(c.id, c);
  deliver(c, {type:'CONNECTED'});
  port.onMessage.addListener(message => {
    if (!message || typeof message !== 'object') return;
    c.seen = Date.now();
    const type = message.type;
    if (type === 'JOIN') {
      const room = nameText(message.room, 24).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      const name = nameText(message.name, 32);
      const role = message.role === 'leader' ? 'leader' : 'member';
      if (room.length < 3 || name.length < 2) {
        deliver(c, {type:'ERROR', message:'Informe nome (2+ letras) e codigo da Party (3+ caracteres).'}); return;
      }
      const peers = members(room).filter(p => p.id !== c.id);
      if (peers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        deliver(c, {type:'ERROR', message:'Ja existe um participante com este nome nesta Party.'}); return;
      }
      if (role === 'leader' && peers.some(p => p.role === 'leader')) {
        deliver(c, {type:'ERROR', message:'Esta Party ja tem um lider conectado.'}); return;
      }
      leave(c);
      Object.assign(c, {room, name, role});
      if (!rooms.has(room)) rooms.set(room, {request:null, notice:'', hunt:''});
      cancel(room, 'Lista de membros alterada. Solicite nova confirmacao.');
      broadcast(room); return;
    }
    if (type === 'LEAVE') { leave(c); deliver(c, {type:'LEFT'}); return; }
    if (!c.room) return;
    if (type === 'PING') { broadcast(c.room); return; }
    if (type === 'HUNT') {
      if (c.role !== 'leader') return; // Somente o lider define a hunt.
      const hunt = nameText(message.hunt,100);
      const info = rooms.get(c.room);
      if (info && info.hunt !== hunt) {
        info.hunt=hunt;
        broadcast(c.room);
      }
      return;
    }
    if (type === 'REQUEST') {
      const list = members(c.room);
      if (c.role !== 'leader') return;
      const hunt = nameText(message.hunt, 100);
      if (!hunt || list.length < 2 || list.some(p => !active(p))) {
        deliver(c, {type:'ERROR', message:'Defina a hunt na aba Hunt e conecte pelo menos 2 participantes ativos.'}); return;
      }
      const info = rooms.get(c.room);
      info.notice = '';
      info.request = {id:crypto.randomUUID(), hunt, phase:'voting', votes:{}, roster:list.map(p => p.id)};
      broadcast(c.room); return;
    }
    if (type === 'VOTE') {
      const info = rooms.get(c.room);
      const req = info?.request;
      if (!req || req.phase !== 'voting' || req.id !== message.requestId || !req.roster.includes(c.id)) return;
      if (message.accept === false) {
        info.request = null;
        info.notice = `${c.name} recusou. Hunt nao iniciada.`;
      } else if (message.accept === true) {
        req.votes[c.id] = true;
        if (req.roster.every(id => req.votes[id] === true)) {
          req.phase = 'ready';
          info.notice = 'Todos aceitaram. Execucao automatica ainda NAO implementada.';
        }
      }
      broadcast(c.room); return;
    }
  });
  port.onDisconnect.addListener(() => {
    leave(c); clients.delete(c.id);
  });
});
// Heartbeats apenas verificam a presenca da extensao, nao o login no jogo.
setInterval(() => {
  for (const c of clients.values()) {
    if (c.room && !active(c)) {
      try { c.port.disconnect(); } catch (_) {}
      leave(c); clients.delete(c.id);
    }
  }
}, 4000);
