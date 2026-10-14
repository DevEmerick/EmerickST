// EmerickST Party v6.2.25 — lider/membro local, confirmacao e posicao automaticas.
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
      .em-party .em-party-btn.primary{background:#4a3e7c;border-color:#9380db;color:#fff}
      .em-party .em-party-hunt{width:100%;border:1px solid #4a526b;border-radius:7px;background:#111827;color:#e4e6f4;padding:8px;font:11px system-ui;margin:6px 0}
      .em-party .em-party-muted{font-size:10px;color:#9daac1}
      .em-party .em-party-inline{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:5px}
      .em-party [data-party-role]{display:block;width:100%;font:600 11px system-ui;color:#e8e6fa;background:#141a28;border:1px solid #544e78;border-radius:7px;padding:9px;cursor:pointer}
      .em-party .em-party-inline{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:7px}
      .em-party .em-party-compact{font-size:10px;color:#aeb8c9}
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
      <div class="em-party-head"><strong class="em-party-title">♛ Party</strong><span class="em-party-pill wait" data-party-pill>Desligada</span></div>
      <div class="em-party-card">
        <label class="em-party-sub" for="emerick-party-role">Função neste personagem</label>
        <select id="emerick-party-role" data-party-role aria-label="Função"><option value="leader">♛ Líder</option><option value="member">Membro</option></select>
        <div style="height:9px"></div>
        <button type="button" class="em-party-btn primary" data-party-toggle style="width:100%">▶ Iniciar Party</button>
        <div class="em-party-sub" style="margin-top:7px;text-align:center" data-party-state>Party desativada. O modo Solo permanece independente.</div>
      </div>
      <div class="em-party-card" data-party-hunt-config>
        <div class="em-party-line"><strong>Hunt</strong><span class="em-party-status" data-party-hunt>Não definida</span></div>
        <div data-party-leader-options>
          <input type="text" class="em-party-hunt" data-party-hunt-input maxlength="100" placeholder="Nome da hunt do líder" autocomplete="off" spellcheck="false">
          <div class="em-party-inline"><span class="em-party-compact">Lure</span><select data-party-lure style="width:90px;background:#141a28;color:#e5e6f4;border:1px solid #454b66;border-radius:6px;padding:6px"><option value="max">MAX</option><option value="off">OFF</option></select></div>
        </div>
        <p class="em-party-sub" data-party-hunt-caption>Somente o líder inicia a hunt, protege e vende o loot.</p>
      </div>
      <div class="em-party-card" data-party-details hidden>
        <div class="em-party-inline"><span class="em-party-compact">Vocação</span><span data-party-vocation-label>não definida</span></div>
        <div class="em-party-inline"><span class="em-party-compact">Posição nesta hunt</span><span data-party-position>não configurada</span></div>
        <div class="em-party-sub" style="margin-top:8px" data-party-pos-notice>Primeira vez: escolha sua posição no jogo.</div>
        <div class="em-party-inline"><span class="em-party-compact">Prontidão</span><span class="em-party-pill wait" data-party-ready>Em espera</span></div>
        <p class="em-party-sub" data-party-native>Aguardando a janela do Stonegy.</p>
      </div>
      <details data-party-setup>
        <summary>⚙ Personagem e vocação</summary>
        <div class="em-party-config">
          <label>Nome exato do meu personagem</label><input data-party-name maxlength="32" placeholder="Ex.: Budas" autocomplete="off">
          <label>Vocação</label><select data-party-vocation><option value="">Selecione</option><option value="knight">Knight</option><option value="sorcerer">Sorcerer</option><option value="druid">Druid</option><option value="paladin">Paladin</option><option value="monk">Monk</option></select>
          <input type="hidden" data-party-room value="local"><input type="hidden" data-party-leader value="">
          <p class="em-party-sub">Sem servidor e sem código de Party. O líder utiliza o fluxo completo de caça e venda; o membro apenas confirma e se posiciona.</p>
          <p class="em-party-warn" data-party-error hidden></p>
        </div>
      </details>
    `;
    body.appendChild(view);

    const el = selector => view.querySelector(selector);
    const name = el('[data-party-name]');
    const room = el('[data-party-room]');
    const leaderName = el('[data-party-leader]');
    const partyHuntInput = el('[data-party-hunt-input]');
    const role = el('[data-party-role]');
    const vocation = el('[data-party-vocation]');
    const state = {
      enabled:false, connected:false, wantJoin:false, joined:false,
      me:'', members:[], error:'', notice:'', leaderHunt:'', cycleStarted:false, phase:'', lastKickAt:0
    };
    const partyLure = el('[data-party-lure]');
    const LURE_MAP_KEY = 'emerickst:party:lure-by-hunt:v1';
    const sent = msg => document.dispatchEvent(new CustomEvent('emerickst-party-out', {detail:msg}));
    const text = (sel, value) => { const node = el(sel); if (node.textContent !== value) node.textContent = value; };
    const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    // Dados exclusivos de cada personagem, vocacao e hunt.
    // Chrome normal e anonimo mantem localStorage independentes.
    const PARTY_HUNT_PREFIX = 'emerickst:party:hunt:v1:';
    const SOLO_SNAPSHOT_KEY = 'emerickst:party:solo-hunt:v1';
    let partyHunt = '';
    const huntKey = () => PARTY_HUNT_PREFIX + 'LOCAL';
    const loadPartyHunt = () => {
      try { return sessionStorage.getItem(huntKey()) || window.__stonegy?.config?.huntName || ''; }
      catch (_) { return window.__stonegy?.config?.huntName || ''; }
    };
    const restoreSoloHunt = () => {
      const bot = window.__stonegy;
      try {
        const raw = sessionStorage.getItem(SOLO_SNAPSHOT_KEY);
        if (raw !== null && bot?.config) {
          let saved;
          try { saved = JSON.parse(raw); } catch (_) { saved = {huntName:raw}; }
          bot.config.huntName = String(saved.huntName || '');
          bot.config.lastHuntName = bot.config.huntName;
          if (['off','max'].includes(saved.lureModo)) bot.config.lureModo = saved.lureModo;
          bot.config.botAtivo = false; // voltar ao Solo sempre pausado
          bot.saveConfig?.();
        }
        sessionStorage.removeItem(SOLO_SNAPSHOT_KEY);
      } catch (_) {}
    };
    const snapshotSoloHunt = () => {
      const cfg = window.__stonegy?.config;
      try {
        if (cfg) sessionStorage.setItem(SOLO_SNAPSHOT_KEY, JSON.stringify({
          huntName:cfg.huntName || '', lureModo:cfg.lureModo || 'max'
        }));
      } catch (_) {}
    };
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
      if (role.value === 'leader') return nativeHuntName() || partyHunt.trim();
      // Membro usa a hunt exibida no proprio jogo; nao precisa de outra janela.
      return nativeHuntName() || '';
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
      setGate(); // libera o Lure apenas depois do clique manual.
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
      // Em Party, o posicionamento tem prioridade sobre o Lure.
      // O monitor da Hunt aguarda positioning.applied antes de abrir o Lure.
      // Nunca alterar posicao durante a confirmacao de prontidao.
      if (nativeDialog()) return;
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
        positioning.selectedThisGrid=true; // nunca repete na mesma hunt
        positioning.opened=true;
        try {
          matching.click();
          positioning.applied=true;
          setGate(); // libera Lure somente depois de clicar no quadrado.
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
    // Papel atribuido diretamente pelo usuario, sem dependencia entre navegadores.
    const valid = () => name.value.trim().length >= 2 && VOCATIONS.has(getVocation(name.value));
    const savedKey = 'emerickst:party:prefs:v1';
    try {
      const saved = JSON.parse(sessionStorage.getItem(savedKey) || '{}');
      name.value = saved.name || '';
      role.value = saved.role === 'member' ? 'member' : 'leader';
      // Recupera Party apos o proprio jogo recarregar por perda de conexao.
      state.enabled = saved.active === true;
    } catch (_) {}
    vocation.value = getVocation(name.value);
    // Identidade desta aba para Dashboard de dano individual.
    window.__emerickLocalCharacterName = name.value.trim();
    // So restaura o snapshot Solo se a Party estava desligada.
    if (!state.enabled) restoreSoloHunt();
    partyHunt = loadPartyHunt();
    partyHuntInput.value = partyHunt;
    const preferredLure = () => {
      const choice = readMap(LURE_MAP_KEY)[norm(partyHunt)];
      return choice === 'off' || choice === 'max' ? choice : (window.__stonegy?.config?.lureModo || 'max');
    };
    partyLure.value = preferredLure();
    el('[data-party-setup]').open = !valid();
    const save = () => {
      window.__emerickLocalCharacterName=name.value.trim();
      try { sessionStorage.setItem(savedKey, JSON.stringify({
        name:name.value.trim(), role:role.value, active:state.enabled
      })); } catch (_) {}
    };
    const pauseHuntBot = () => {
      const bot = window.__stonegy;
      if (!bot?.config) return;
      // Membro nao executa o motor; e o stop da Party tambem o pausa.
      if (bot.config.botAtivo) {
        bot.config.botAtivo = false;
        bot.saveConfig?.();
      }
      if (bot.getFlow?.()) bot.clearFlow?.();
    };
    const setGate = () => {
      const game = state.enabled && partyInHunt();
      const waitingReady = Boolean(game && nativeDialog());
      window.__emerickPartyGate = {
        enabled:state.enabled,
        isLeader:role.value === 'leader',
        readyPending:waitingReady,
        positionPending:Boolean(game && !positioning.applied),
      };
      return state.enabled && role.value === 'leader';
    };
    const stopParty = () => {
      pauseHuntBot();
      state.enabled=false; state.cycleStarted=false;
      state.phase='';state.error='';
      restoreSoloHunt();
      setGate();
      save(); // se o jogo recarregar depois de parar, nao reativar a Party
    };
    function tickAutomation() {
      setGate();
      if (!state.enabled) return;
      const bot=window.__stonegy;
      if (!bot?.config || !bot.startReturn) {
        state.phase='Aguardando motor Hunt...';return;
      }
      if (role.value === 'member') {
        // Nenhuma venda, treino ou nova hunt executada pelo membro.
        if (bot.config.botAtivo || bot.getFlow?.()) pauseHuntBot();
        state.phase = partyInHunt() ? 'Hunt em andamento.' : 'Aguardando a solicitação do líder.';
        return;
      }
      const chosen = partyHunt.trim();
      if (!chosen) {state.phase='Informe a hunt do líder.';return;}
      if (!state.cycleStarted) {
        bot.config.huntName = chosen;
        bot.config.lastHuntName = chosen;
        bot.config.lureModo = partyLure.value === 'off' ? 'off' : 'max';
        bot.saveConfig?.();
        state.cycleStarted=true;
        state.lastKickAt=Date.now();
        state.phase='Líder executando venda, proteções e hunt.';
        if (partyInHunt()) {
          // Ja esta cacando: nao reinicia venda nem cria outra Hunt.
          bot.config.botAtivo=true;
          bot.saveConfig?.();
        } else {
          // O mesmo ponto de entrada do modo Solo, sem atalhos.
          try { bot.startReturn(); }
          catch(e) {state.cycleStarted=false;state.error=String(e?.message || e);}
        }
      } else {
        const hunting=partyInHunt();
        const flow=bot.getFlow?.();
        const busy=bot.isAsyncRunning?.() || bot.isTrainingRunning?.();
        // Monitor primario do Solo continua responsavel por recomecar ciclos.
        // Recuperacao limitada caso a ativacao inicial tenha falhado.
        if (!hunting && !flow && !busy && Date.now()-state.lastKickAt>20000 &&
            !nativeDialog() && !window.__emerickBestiaryBusy) {
          state.lastKickAt=Date.now();
          state.phase='Retomando o ciclo do líder...';
          bot.startReturn();
        } else {
          state.phase=hunting ? 'Hunt em andamento.' :
            flow ? 'Fluxo: '+flow.etapa.replaceAll('_',' ').toLowerCase() :
            'Aguardando próxima etapa da caça.';
        }
      }
    }
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
      const active=state.enabled;
      el('[data-party-details]').hidden=!active;
      el('[data-party-toggle]').textContent=active?'■ Parar Party':'▶ Iniciar Party';
      el('[data-party-toggle]').classList.toggle('running',active);
      text('[data-party-pill]',!active?'Desligada':role.value==='leader'?'Líder ativo':'Membro ativo');
      el('[data-party-pill]').classList.toggle('wait',!active);
      text('[data-party-state]',!active?'Modo Solo disponível na aba Hunt.':(state.error||state.phase||'Ativo.'));
      const leader = role.value==='leader';
      el('[data-party-leader-options]').hidden=!leader;
      text('[data-party-hunt]',huntName() || (leader?partyHunt:'Aguardando o jogo'));
      text('[data-party-hunt-caption]',leader
        ? 'Líder: venda e proteção de itens mantidas. Sem treino.'
        : 'Membro: só confirma e assume a posição. Não vende nem treina.');
      if (leader && shadow.activeElement!==partyHuntInput && partyHuntInput.value!==partyHunt) partyHuntInput.value=partyHunt;
      text('[data-party-vocation-label]',getVocation(name.value)||'não definida');
      const currentHunt=huntName();
      const saved=currentHunt?getPosition(currentHunt):null;
      text('[data-party-position]',!currentHunt?'aguardando hunt':saved?`${saved.x},${saved.y}`:'não configurada');
      el('[data-party-error]').hidden=!state.error;
      text('[data-party-error]',state.error);
    }
    partyHuntInput.addEventListener('change',()=>{
      if (role.value!=='leader') return;
      const next=partyHuntInput.value.trim();
      if (state.enabled && next!==partyHunt) {
        state.error='Pare a Party antes de trocar a hunt.';
        partyHuntInput.value=partyHunt;
        render();return;
      }
      partyHunt=next;
      try {sessionStorage.setItem(huntKey(),partyHunt);}catch(_){}
      partyLure.value=preferredLure();
      state.error='';render();
    });
    partyHuntInput.addEventListener('keydown',e=>{if(e.key==='Enter')partyHuntInput.blur();});
    partyLure.addEventListener('change',()=>{
      if (state.enabled) {partyLure.value=preferredLure();return;}
      const values=readMap(LURE_MAP_KEY);
      values[norm(partyHunt)]=partyLure.value==='off'?'off':'max';
      writeMap(LURE_MAP_KEY,values);
    });
    name.addEventListener('change',()=>{
      vocation.value=getVocation(name.value);
      if (state.enabled) stopParty();
      save();render();
    });
    vocation.addEventListener('change',()=>{
      if (state.enabled) stopParty();
      if(!saveVocation()) state.error='Informe nome e vocação.';
      else state.error='';
      save();render();
    });
    role.addEventListener('change',()=>{
      if (state.enabled) stopParty();
      save();render();
    });
    el('[data-party-toggle]').onclick=()=>{
      if (state.enabled) {stopParty();render();return;}
      if (!valid()) {
        state.error='Informe nome do personagem e vocação nas configurações.';
        el('[data-party-setup]').open=true;render();return;
      }
      if (role.value==='leader' && !partyHunt.trim()) {
        state.error='Informe a hunt na Party.';render();return;
      }
      const bot=window.__stonegy;
      if (bot?.isTrainingRunning?.() || bot?.isAsyncRunning?.()) {
        state.error='Aguarde a ação Solo terminar antes de iniciar Party.';
        render();return;
      }
      snapshotSoloHunt();
      pauseHuntBot();
      state.enabled=true;state.cycleStarted=false;state.error='';
      save();setGate();
      el('[data-party-setup]').open=false;
      tickAutomation();render();
    };
    // Sem sincronizacao: cada instancia possui apenas o papel escolhido.
    setInterval(()=>{if(state.enabled){pollNative();pollPositioning();}},550);
    setInterval(()=>{tickAutomation();if(state.enabled)render();},1000);
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
    setGate();
    sync();render();
  };
})();
