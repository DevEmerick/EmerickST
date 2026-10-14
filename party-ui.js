// EmerickST Party v6.2.21 — interface compacta e confirmacao nativa automatica.
// Mundo MAIN. Nao executa hunts, nao altera WebSocket nem faz movimentos.
(() => {
  if (window.__emerickPartyInit) return;
  window.__emerickPartyInit = shadow => {
    if (!shadow || shadow.querySelector('[data-party-view]')) return;
    const tabs = shadow.querySelector('.tabs');
    const body = shadow.querySelector('#body');
    if (!tabs || !body) return;

    const style = document.createElement('style');
    style.textContent = `
      .tabs:has([data-view="party"]){display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
      .tabs [data-view="party"]{min-width:0;font-size:10px}
      .em-party{padding:11px;overflow-y:auto;min-height:0;max-height:calc(100dvh - 180px);font:11px/1.45 system-ui,sans-serif;color:#dbe2f3}
      .em-party[hidden],.em-party [hidden]{display:none!important}
      .em-party *{box-sizing:border-box}
      .em-party-card{border:1px solid #333c52;border-radius:10px;padding:11px;margin-bottom:9px;background:#1c2231}
      .em-party-head,.em-party-line{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .em-party-head{margin-bottom:11px}
      .em-party-line{min-height:24px}
      .em-party-title{font-size:12px;font-weight:750;color:#e8e6fa}
      .em-party-sub{font-size:10px;color:#9daac1;line-height:1.45}
      .em-party-status{font-size:10px;color:#b8c5dd;text-align:right}
      .em-party .em-party-btn{border:1px solid #635a98;background:#312b52;color:#e5ddff;border-radius:7px;padding:8px 10px;font:700 11px system-ui;cursor:pointer}
      .em-party .em-party-btn.running{border-color:#65515c;background:#322430;color:#f2bdc8}
      .em-party .em-party-btn:disabled{opacity:.45;cursor:not-allowed}
      .em-party-pill{font-size:9px;border:1px solid #42674e;border-radius:12px;color:#96dfb5;background:#1b3428;padding:3px 7px;white-space:nowrap}
      .em-party-pill.wait{border-color:#605a72;background:#302a41;color:#cabee3}
      .em-party-member{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #ffffff14;padding:8px 0;gap:8px}
      .em-party-member:first-child{border:0}
      .em-party details{margin:4px 0 10px;border:1px solid #343b51;border-radius:9px;background:#171d2b}
      .em-party summary{padding:10px 11px;font-size:10px;color:#b8bed4;cursor:pointer}
      .em-party-config{padding:0 11px 11px}
      .em-party-config label{display:block;color:#adb7cc;font-size:10px;margin:8px 0 4px}
      .em-party-config input,.em-party-config select{width:100%;min-width:0;background:#111827;border:1px solid #46506a;border-radius:6px;padding:8px;color:#ecedfa;font:11px system-ui}
      .em-party-warn{color:#edc398;font-size:10px;margin-top:7px;line-height:1.45}
      .em-party-highlight{color:#aeeacb}
      .em-party [data-party-position]{color:#aeeacb;font-weight:650}
      .em-party-config select[data-party-vocation]{border-color:#675b96}
    `;
    shadow.appendChild(style);
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.view = 'party';
    tab.textContent = 'Party';
    tabs.appendChild(tab);
    const view = document.createElement('section');
    view.className = 'em-party';
    view.dataset.partyView = '';
    view.hidden = true;
    view.innerHTML = `
      <div class="em-party-head">
        <strong class="em-party-title">♜ Party</strong>
        <span class="em-party-pill wait" data-party-pill>Desativada</span>
      </div>
      <div class="em-party-card">
        <div class="em-party-line">
          <div><strong>Party automática</strong><div class="em-party-sub" data-party-state>Ative para conectar seus personagens.</div></div>
          <button type="button" class="em-party-btn" data-party-toggle>Ativar</button>
        </div>
      </div>
      <div data-party-details hidden>
        <div class="em-party-card">
          <div class="em-party-line"><strong>Participantes</strong><span class="em-party-status" data-party-count>Aguardando</span></div>
          <div data-party-members class="em-party-sub">Aguardando conexão...</div>
        </div>
        <div class="em-party-card">
          <div class="em-party-line"><strong>Hunt da Party</strong><span class="em-party-status" data-party-hunt>Definida pelo líder</span></div>
          <div class="em-party-sub" style="margin-top:7px">Vocação: <span data-party-vocation-label>não definida</span></div>
          <div class="em-party-sub" style="margin-top:7px">Posição nesta hunt: <span data-party-position>não configurada</span></div>
          <div class="em-party-sub" style="margin-top:6px" data-party-pos-notice>Primeira vez: escolha um quadrado no jogo.</div>
        </div>
        <div class="em-party-card">
          <div class="em-party-line"><strong>Confirmação do jogo</strong><span class="em-party-pill wait" data-party-ready>Em espera</span></div>
          <div class="em-party-sub" style="margin-top:6px" data-party-native>Aguardando janela de prontidão.</div>
          <div class="em-party-sub" style="margin-top:7px">Ao abrir a confirmação do Stonegy, o bot confirma automaticamente se todos estiverem conectados e identificados.</div>
        </div>
      </div>
      <details data-party-setup>
        <summary>⚙ Configurar personagens e conexão</summary>
        <div class="em-party-config">
          <label>Meu personagem</label><input data-party-name maxlength="32" placeholder="Ex.: Budas" autocomplete="off">
          <label>Código da Party (mesmo nas duas janelas)</label><input data-party-room maxlength="24" placeholder="Ex.: EMERICK01" autocomplete="off">
          <label>Função do personagem</label>
          <select data-party-role><option value="leader">Líder</option><option value="member">Membro</option></select>
          <label>Vocação do personagem</label>
          <select data-party-vocation>
            <option value="">Selecione a vocação</option>
            <option value="knight">Knight</option>
            <option value="sorcerer">Sorcerer</option>
            <option value="druid">Druid</option>
            <option value="paladin">Paladin</option>
            <option value="monk">Monk</option>
          </select>
          <p class="em-party-sub">Preencha uma vez em cada janela. Apenas o líder escolhe a hunt no jogo.</p>
          <p class="em-party-warn" data-party-error hidden></p>
        </div>
      </details>
    `;
    body.appendChild(view);

    const el = selector => view.querySelector(selector);
    const name = el('[data-party-name]');
    const room = el('[data-party-room]');
    const role = el('[data-party-role]');
    const vocation = el('[data-party-vocation]');
    const state = {
      enabled:false, connected:false, wantJoin:false, joined:false,
      me:'', members:[], error:'', notice:'', leaderHunt:''
    };
    const sent = msg => document.dispatchEvent(new CustomEvent('emerickst-party-out', {detail:msg}));
    const text = (sel, value) => { const node = el(sel); if (node.textContent !== value) node.textContent = value; };
    const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    // Dados exclusivos de cada personagem, vocacao e hunt.
    // Chrome normal e anonimo mantem localStorage independentes.
    const POSITIONS_KEY = 'emerickst:party:positions:v1';
    const VOCATIONS_KEY = 'emerickst:party:vocations:v1';
    const LAST_MOVE_KEY = 'emerickst:party:last-position:v1';
    const VOCATIONS = new Set(['knight','sorcerer','druid','paladin','monk']);
    const MOVE_COOLDOWN_MS = 61000; // tolerancia de 1 segundo
    const readMap = key => {
      try {
        const result = JSON.parse(localStorage.getItem(key) || '{}');
        return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
      } catch (_) { return {}; }
    };
    const writeMap = (key, data) => {
      try { localStorage.setItem(key, JSON.stringify(data)); return true; }
      catch (_) { return false; }
    };
    const getVocation = character => readMap(VOCATIONS_KEY)[norm(character)] || '';
    function saveVocation() {
      if (!norm(name.value) || !VOCATIONS.has(vocation.value)) return false;
      const values = readMap(VOCATIONS_KEY);
      values[norm(name.value)] = vocation.value;
      return writeMap(VOCATIONS_KEY, values);
    }
    const identity = () => JSON.stringify([norm(name.value), getVocation(name.value)]);
    const positionId = hunt => JSON.stringify([norm(name.value), getVocation(name.value), norm(hunt)]);
    const getPosition = hunt => {
      if (!norm(name.value) || !VOCATIONS.has(getVocation(name.value)) || !norm(hunt)) return null;
      const data = readMap(POSITIONS_KEY)[positionId(hunt)];
      return data && Number.isInteger(data.x) && Number.isInteger(data.y) ? data : null;
    };
    const lastMovedAt = () => Number(readMap(LAST_MOVE_KEY)[identity()] || 0);
    const markMoved = () => {
      const data = readMap(LAST_MOVE_KEY);
      data[identity()] = Date.now();
      writeMap(LAST_MOVE_KEY, data);
    };
    const cooldownLeft = () => Math.max(0, MOVE_COOLDOWN_MS - (Date.now() - lastMovedAt()));
    const gridSelector = 'button[aria-label^="Selecionar posição "]';
    const parseTile = button => {
      const label = button?.getAttribute('aria-label') || '';
      const match = /^Selecionar posição\s+(-?\d+)\s*,\s*(-?\d+)$/i.exec(label);
      if (!match) return null;
      const x = Number(match[1]);
      const y = Number(match[2]);
      return Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) <= 32 && Math.abs(y) <= 32
        ? {x,y} : null;
    };
    const visible = element => Boolean(element?.isConnected && element.getClientRects().length);
    // A mesma fonte nativa de nome da hunt utilizada no monitor do EmerickST.
    function nativeHuntName() {
      for (const p of document.querySelectorAll('p')) {
        if (!/^Remaining:\s*\d{1,3}:\d{2}:\d{2}$/i.test((p.textContent || '').trim())) continue;
        const h5 = p.parentElement?.querySelector('h5');
        const result = (h5?.textContent || '').trim();
        if (result && result.length <= 100) return result;
      }
      return '';
    }
    // O lider envia o nome aos membros pelo canal local ja existente.
    function huntName() {
      if (!state.enabled || !valid()) return '';
      if (role.value === 'leader') return nativeHuntName() || (shadow.querySelector('[data-hunt]')?.value || '').trim();
      return state.joined && state.connected ? (state.leaderHunt || '').trim() : '';
    }
    // Estado por entrada na hunt, nao por rerender do React.
    const positioning = {
      hunt:'', hadGame:false, noGameSince:0, opened:false,
      grid:null, selectedThisGrid:false, applied:false, noGridSince:0,
      message:'', lastBroadcast:''
    };
    function setPositionMessage(message) {
      if (positioning.message !== message) {
        positioning.message = message;
        text('[data-party-pos-notice]',message);
      }
    }
    function saveManualTile(tile) {
      const hunt = huntName();
      const choice = getVocation(name.value);
      if (!hunt || !VOCATIONS.has(choice) || !valid()) {
        setPositionMessage('Para salvar: informe personagem, vocação e hunt do líder.');
        return;
      }
      if (cooldownLeft() > 0) {
        setPositionMessage('Aguarde 1 minuto entre mudanças de posição.');
        return;
      }
      const pos = parseTile(tile);
      if (!pos) return;
      const values = readMap(POSITIONS_KEY);
      values[positionId(hunt)] = {
        ...pos, character:name.value.trim(), vocation:choice,
        hunt, chosenAt:Date.now(), source:'manual'
      };
      if (!writeMap(POSITIONS_KEY,values)) {
        setPositionMessage('Não foi possível salvar a posição no navegador.');
        return;
      }
      markMoved();
      positioning.opened = true;
      positioning.selectedThisGrid = true; positioning.applied=true;
      setPositionMessage(`Posição ${pos.x},${pos.y} salva para ${hunt}.`);
      render();
    }
    // Somente o clique real do usuario cria ou altera o registro.
    document.addEventListener('click',event => {
      if (!state.enabled || event.isTrusted !== true) return;
      const tile = event.target?.closest?.(gridSelector);
      if (!tile || !visible(tile)) return;
      saveManualTile(tile);
    },true);
    function partyInHunt() {
      return [...document.querySelectorAll('h5')].some(h =>
        visible(h) && norm(h.textContent) === 'finalizar hunt'
      ) || [...document.querySelectorAll('p')].some(p =>
        visible(p) && /^Hunt Time:\s*\d{1,3}:\d{2}:\d{2}$/i.test((p.textContent || '').trim())
      );
    }
    function positionOpenButton() {
      for (const title of document.querySelectorAll('h5')) {
        if (!visible(title) || norm(title.textContent) !== 'posicionamento') continue;
        const parent = title.closest('.highlight-animation');
        if (parent && visible(parent) && parent.querySelector('[data-testid="PlaceIcon"]')) return parent;
      }
      return null;
    }
    function pollPositioning() {
      if (!state.enabled || !valid()) return;
      const hunt = huntName();
      const vocationName = getVocation(name.value);
      if (!hunt || !VOCATIONS.has(vocationName)) {
        setPositionMessage(!VOCATIONS.has(vocationName)
          ? 'Selecione sua vocação em Configurações.'
          : 'Aguardando a hunt definida pelo líder.');
        return;
      }
      const key = positionId(hunt);
      if (positioning.hunt !== key) {
        positioning.hunt=key; positioning.opened=false;
        positioning.grid=null; positioning.selectedThisGrid=false; positioning.applied=false;
      }
      const squares = [...document.querySelectorAll(gridSelector)].filter(visible);
      const inGame = partyInHunt() || squares.length >= 3;
      if (!inGame) {
        if (!positioning.noGameSince) positioning.noGameSince=Date.now();
        if (Date.now()-positioning.noGameSince > 2500 && positioning.hadGame) {
          positioning.opened=false; positioning.grid=null;
          positioning.selectedThisGrid=false; positioning.applied=false; positioning.hadGame=false;
        }
        return;
      }
      positioning.noGameSince=0;
      positioning.hadGame=true;
      const saved = getPosition(hunt);
      if (squares.length >= 3) {
        const grid = squares[0].parentElement;
        if (positioning.grid !== grid) {
          positioning.grid=grid; positioning.selectedThisGrid=false;
        }
        positioning.noGridSince=0;
        if (!saved) {
          setPositionMessage('Escolha um quadrado amarelo; o bot salvará sua posição.');
          return;
        }
        if (positioning.selectedThisGrid || positioning.applied) return;
        const matching = squares.find(tile => {
          const p=parseTile(tile);
          return p && p.x === saved.x && p.y === saved.y && !tile.disabled;
        });
        if (!matching) {
          setPositionMessage(`Posição ${saved.x},${saved.y} indisponível. Escolha manualmente.`);
          positioning.selectedThisGrid=true;
          return;
        }
        if (cooldownLeft() > 0) {
          setPositionMessage(`Aguardando o intervalo de posição (${Math.ceil(cooldownLeft()/1000)}s).`);
          return;
        }
        positioning.selectedThisGrid=true; positioning.applied=true; // nunca repete na mesma hunt
        positioning.opened=true;
        try {
          matching.click();
          markMoved();
          setPositionMessage(`Posição ${saved.x},${saved.y} aplicada automaticamente.`);
        } catch (error) {
          setPositionMessage('Falha ao selecionar a posição: ' + String(error?.message || error).slice(0,80));
        }
        return;
      }
      if (positioning.grid) {
        if (!positioning.noGridSince) positioning.noGridSince=Date.now();
        if (Date.now()-positioning.noGridSince > 1500) positioning.grid=null;
      }
      if (!saved) {
        setPositionMessage('Primeira hunt: abra Posicionamento e selecione um quadrado.');
        return;
      }
      if (positioning.opened || positioning.applied) return;
      if (cooldownLeft() > 0) {
        setPositionMessage(`Próxima posição liberada em ${Math.ceil(cooldownLeft()/1000)}s.`);
        return;
      }
      const open = positionOpenButton();
      if (!open) return;
      positioning.opened=true;
      try {
        open.click();
        setPositionMessage(`Abrindo grade para posição ${saved.x},${saved.y}.`);
      } catch (error) {
        setPositionMessage('Não foi possível abrir Posicionamento.');
      }
    }
    const valid = () => name.value.trim().length >= 2 && /^[A-Za-z0-9_-]{3,24}$/.test(room.value.trim());
    const savedKey = 'emerickst:party:prefs:v1';
    try {
      const saved = JSON.parse(sessionStorage.getItem(savedKey) || '{}');
      name.value = saved.name || '';
      room.value = saved.room || '';
      role.value = saved.role === 'member' ? 'member' : 'leader';
    } catch (_) {}
    vocation.value = getVocation(name.value);
    el('[data-party-setup]').open = !valid();
    const save = () => { try { sessionStorage.setItem(savedKey, JSON.stringify({name:name.value.trim(),room:room.value.trim(),role:role.value})); } catch (_) {} };
    function join() {
      if (!state.enabled || !state.connected || !valid()) return;
      state.wantJoin = true;
      sent({type:'JOIN',name:name.value.trim(),room:room.value.trim(),role:role.value});
    }
    const allOnline = () => state.enabled && state.connected && state.joined &&
      state.members.length >= 2 && state.members.every(p => p.online && p.name) &&
      state.members.filter(p => p.role === 'leader').length === 1 &&
      state.members.some(p => p.id === state.me);

    // Identifica apenas o modal nativo de prontidao, jamais botoes do EmerickST.
    function nativeDialog() {
      const headings = [...document.querySelectorAll('h5')].filter(h =>
        norm(h.textContent) === 'confirmacao de prontidao' && h.getClientRects().length
      );
      for (const heading of headings) {
        let root = heading.parentElement;
        for (let depth = 0; root && root !== document.body && depth < 9; depth++, root = root.parentElement) {
          const visible = [...root.querySelectorAll('h5')].filter(h => h.getClientRects().length);
          const action = label => visible.find(h => norm(h.textContent) === label);
          const confirm = action('confirmar');
          if (!confirm || !action('cancelar') || !action('sair da party')) continue;
          const lines = [...root.querySelectorAll('p')].map(p => norm(p.textContent));
          if (!lines.includes('inicio de hunt em party')) continue;
          const fraction = lines.find(t => /^\d+\s*\/\s*\d+\s*confirmados$/.test(t));
          if (!fraction) continue;
          const match = fraction.match(/^(\d+)\s*\/\s*(\d+)/);
          if (!match) continue;
          // No Stonegy o clique pertence ao card animado pai do h5.
          const target = confirm.closest('.highlight-animation');
          if (!target || !root.contains(target) || !target.getClientRects().length) continue;
          return {root, target, lines, confirmed:Number(match[1]), total:Number(match[2])};
        }
      }
      return null;
    }
    function participants(dialog) {
      return [...dialog.root.querySelectorAll('p')].flatMap(p => {
        const label = norm(p.textContent);
        if (!label || label === 'inicio de hunt em party' || /confirmados$/.test(label)) return [];
        const row = p.parentElement;
        if (!row) return [];
        const status = [...row.children].find(s => s !== p && s.tagName === 'P' &&
          ['pendente','confirmado'].includes(norm(s.textContent)));
        if (!status) return [];
        return [{name:label.replace(/\s*\(leader\)$/, ''), leader:/\(leader\)$/.test(label), status:norm(status.textContent)}];
      });
    }
    function namesMatch(dialog, roster) {
      if (dialog.total !== state.members.length || roster.length !== dialog.total) return false;
      const leader = state.members.find(p => p.role === 'leader');
      if (!leader || !roster.some(p => p.leader && p.name === norm(leader.name))) return false;
      const unique = new Set(roster.map(p => p.name));
      return unique.size === roster.length && state.members.every(p => unique.has(norm(p.name)));
    }
    const ready = {root:null, attempts:0, lastClick:0, lastSeen:0, observed:null};
    function resetReady() {ready.root=null;ready.attempts=0;ready.lastClick=0;ready.observed=null;}
    function pollNative() {
      if (!state.enabled) {resetReady();return;}
      const dialog = nativeDialog();
      if (!dialog) {
        if (Date.now() - ready.lastSeen > 1500) resetReady();
        const visibleTitle = [...document.querySelectorAll('h5')].some(h =>
          norm(h.textContent) === 'confirmacao de prontidao' && h.getClientRects().length
        );
        text('[data-party-native]', visibleTitle
          ? 'A janela esta visivel, mas o formato dos participantes ou botoes mudou. Envie o HTML atualizado.'
          : 'Aguardando a janela Confirmação de Prontidão do Stonegy.');
        text('[data-party-ready]', 'Em espera');
        return;
      }
      ready.lastSeen = Date.now();
      // A prontidao real e confirmada pelo proprio Stonegy.
      // Falhas de sincronizacao da Central Party nao impedem a
      // confirmacao do personagem que aparece no modal nativo.
      const roster = participants(dialog);
      const configuredName = norm(name.value);
      if (!configuredName || !roster.length || dialog.total !== roster.length) {
        text('[data-party-native]', 'Janela reconhecida, mas faltam o nome do personagem ou os participantes no jogo.');
        text('[data-party-ready]', 'Verificar');
        return;
      }
      const mine = roster.find(p => p.name === configuredName);
      if (!mine) {
        text('[data-party-native]', `Janela encontrada. Seu personagem (${name.value.trim()}) nao consta nela: ${roster.map(p=>p.name).join(', ')}.`);
        text('[data-party-ready]', 'Verificar nome');
        return;
      }
      if (!mine || mine.status !== 'pendente') {
        text('[data-party-native]', mine?.status === 'confirmado' ? 'Personagem confirmado pelo Stonegy.' : 'Personagem sem status Pendente; nenhum clique.');
        text('[data-party-ready]', mine?.status === 'confirmado' ? 'Confirmado' : 'Em espera');
        return;
      }
      // A nova janela reinicia as tentativas. Se o React reciclar o elemento,
      // o estado da contagem de confirmados tambem invalida a tentativa anterior.
      if (ready.root !== dialog.root) {
        resetReady(); ready.root = dialog.root;
      }
      if (ready.observed !== null && dialog.confirmed !== ready.observed) {
        ready.observed = dialog.confirmed;
        ready.attempts = 0;
      }
      if (ready.attempts >= 2) {
        text('[data-party-native]', 'Clique enviado duas vezes sem confirmacao do jogo. Confirme manualmente e informe o resultado.');
        text('[data-party-ready]', 'Verificar');
        return;
      }
      if (Date.now() - ready.lastClick < 2800) {
        text('[data-party-native]', 'Clique enviado no botao Confirmar. Aguardando resposta do Stonegy...');
        text('[data-party-ready]', 'Enviado');
        return;
      }
      try {
        // Clica no DIV.highlight-animation, nao no texto H5.
        ready.root = dialog.root;
        ready.observed = dialog.confirmed;
        ready.attempts++;
        ready.lastClick = Date.now();
        dialog.target.click();
        text('[data-party-native]', `Clique ${ready.attempts}/2 enviado ao botao Confirmar do Stonegy.`);
        text('[data-party-ready]', 'Enviado');
      } catch (e) {
        text('[data-party-native]', 'Falha no clique: ' + String(e?.message || e).slice(0,100));
        text('[data-party-ready]', 'Falhou');
      }
    }
    function render() {
      const active = state.enabled;
      el('[data-party-details]').hidden = !active;
      el('[data-party-toggle]').textContent = active ? 'Desativar' : 'Ativar';
      el('[data-party-toggle]').classList.toggle('running',active);
      el('[data-party-pill]').textContent = !active ? 'Desativada' : allOnline() ? 'Pronta' : 'Aguardando';
      el('[data-party-pill]').classList.toggle('wait', !allOnline());
      const status = !active ? 'Ative para conectar seus personagens.' :
        state.error ? state.error : !state.connected ? 'Conectando à extensão...' :
        !state.joined ? 'Conectando personagem...' :
        !allOnline() ? 'Aguardando os demais personagens.' : 'Todos online. Confirmação automática ativa.';
      text('[data-party-state]',status);
      text('[data-party-count]', `${state.members.filter(p=>p.online).length}/${state.members.length} conectados`);
      const members = el('[data-party-members]');
      members.replaceChildren();
      for (const person of state.members) {
        const row = document.createElement('div');
        row.className='em-party-member';
        const label = document.createElement('span');
        label.textContent = `${person.role === 'leader' ? '♛ ' : '• '}${person.name}${person.id === state.me ? ' (você)' : ''}`;
        const status = document.createElement('span');
        status.className = 'em-party-pill' + (person.online ? '' : ' wait');
        status.textContent = person.online ? 'Online' : 'Ausente';
        row.append(label,status);
        members.appendChild(row);
      }
      if (!state.members.length) members.textContent='Nenhum participante conectado.';
      const me = state.members.find(p => p.id === state.me);
      const currentHunt = huntName();
      text('[data-party-hunt]',currentHunt || 'Definida pelo líder');
      text('[data-party-vocation-label]',getVocation(name.value)
        ? getVocation(name.value).replace(/^./,c=>c.toUpperCase()) : 'não definida');
      const record = getPosition(currentHunt);
      text('[data-party-position]',!currentHunt ? 'aguardando hunt'
        : record ? `${record.x},${record.y}` : 'não configurada');
      el('[data-party-error]').hidden = !state.error;
      text('[data-party-error]',state.error);
    }
    name.addEventListener('change',() => {
      vocation.value=getVocation(name.value);
      render();
    });
    vocation.addEventListener('change',() => {
      if (!saveVocation()) {
        state.error='Informe o personagem e escolha uma vocação válida.';
      } else {
        state.error='';
        positioning.hunt='';positioning.opened=false;
      }
      render();
    });
    for (const input of [name,room,role]) {
      const changed = () => {
        save();
        if (state.enabled) {
          state.enabled=false; state.wantJoin=false; state.joined=false; state.members=[];
          state.error='Configuração alterada. Ative novamente para reconectar.';
          if (state.connected) sent({type:'LEAVE'});
          render();
        }
      };
      input.addEventListener('change',changed);
      input.addEventListener('input',changed);
    }
    el('[data-party-toggle]').onclick = () => {
      if (state.enabled) {
        state.enabled = false;
        state.wantJoin = false;
        if (state.connected) sent({type:'LEAVE'});
        state.joined = false;
        state.members = [];
        state.error = '';
        render();
        return;
      }
      if (!valid()) {
        state.error='Preencha nome, código da Party e função antes de ativar.';
        el('[data-party-setup]').open = true;
        render();
        return;
      }
      save();
      state.error='';
      state.enabled = true;
      el('[data-party-setup]').open = false;
      join();
      render();
    };
    document.addEventListener('emerickst-party-in',event => {
      const m=event.detail;
      if (!m || typeof m !== 'object') return;
      if (m.type === 'CONNECTED') {
        state.connected=true; positioning.lastBroadcast='';
        if (state.enabled) join();
      } else if (m.type === 'DISCONNECTED') {
        state.connected=false; state.joined=false; state.members=[]; state.leaderHunt='';
      } else if (m.type === 'LEFT') {
        state.joined=false; state.members=[]; state.leaderHunt='';
      } else if (m.type === 'ERROR') {
        state.error=String(m.message || 'Falha de conexão').slice(0,140);
        state.wantJoin=false;
      } else if (m.type === 'SNAPSHOT') {
        state.me=m.you;
        state.members=Array.isArray(m.members) ? m.members : [];
        state.joined=state.members.some(p=>p.id===state.me);
        state.leaderHunt=state.joined && typeof m.hunt === 'string' ? m.hunt.slice(0,100) : '';
        state.error='';
      }
      render();
    });
    setInterval(() => {if (state.enabled) {pollNative(); pollPositioning();}},550);
    setInterval(() => {
      if (state.enabled && state.joined && state.connected) {
        if (role.value==='leader') {
          const chosen=huntName().slice(0,100);
          if (positioning.lastBroadcast!==chosen) {
            positioning.lastBroadcast=chosen;
            sent({type:'HUNT',hunt:chosen});
          }
        }
        sent({type:'PING'});
      }
      if (state.enabled && state.joined) render();
    },3000);
    function sync() {
      const active=tab.classList.contains('active');
      const settings=shadow.querySelector('[data-settings-view]');
      view.hidden=!active || Boolean(settings && !settings.hidden);
    }
    const observer=new MutationObserver(sync);
    observer.observe(tab,{attributes:true,attributeFilter:['class']});
    const settings=shadow.querySelector('[data-settings-view]');
    if (settings) observer.observe(settings,{attributes:true,attributeFilter:['hidden']});
    tabs.addEventListener('click',()=>queueMicrotask(sync));
    sync();render();
    sent({type:'HELLO'});
  };
})();
