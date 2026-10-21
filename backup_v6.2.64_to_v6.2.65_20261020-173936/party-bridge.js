// Mundo ISOLATED: unico ponto com acesso a chrome.runtime.
// O canal transporta metadados da Party; nunca comandos para o bot.
(() => {
  if (globalThis.__emerickPartyBridge) return;
  globalThis.__emerickPartyBridge = true;
  const ALLOWED = new Set(['JOIN','LEAVE','PING','REQUEST','VOTE','HELLO','HUNT']);
  let port = null;
  const inbound = message => {
    if (!message || typeof message !== 'object') return;
    document.dispatchEvent(new CustomEvent('emerickst-party-in', {detail:message}));
  };
  const connect = () => {
    try {
      port = chrome.runtime.connect({name:'emerickst-party-v1'});
      port.onMessage.addListener(inbound);
      port.onDisconnect.addListener(() => {
        port = null;
        inbound({type:'DISCONNECTED'});
        setTimeout(connect, 1500);
      });
    } catch (_) { setTimeout(connect, 2000); }
  };
  document.addEventListener('emerickst-party-out', event => {
    const msg = event.detail;
    if (!msg || !ALLOWED.has(msg.type) || !port) return;
    if (msg.type === 'HELLO') { inbound({type:'CONNECTED'}); return; }
    // Tipos e dimensoes sao revalidados pelo service worker.
    const output = {type:msg.type};
    if (msg.type === 'JOIN') {
      output.room = String(msg.room || '').slice(0, 32);
      output.name = String(msg.name || '').slice(0, 40);
      output.role = msg.role === 'leader' ? 'leader' : 'member';
    }
    if (msg.type === 'REQUEST' || msg.type === 'HUNT') output.hunt = String(msg.hunt || '').slice(0, 120);
    if (msg.type === 'VOTE') {
      output.requestId = String(msg.requestId || '').slice(0, 64);
      output.accept = msg.accept === true;
    }
    try { port.postMessage(output); } catch (_) {}
  });
  connect();
})();
