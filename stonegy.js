// ==UserScript==
// @name         EmerickST
// @namespace    stonegy-combate
// // @version      6.2.65
// @description  EmerickST - combate, automacoes e bestiario para Stonegy Online.
// @match        https://stonegy-online.com/*
// @match        https://*.stonegy-online.com/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(() => {
  "use strict";
  if (window.__stonegyTampermonkeyInstalled) return;
  window.__stonegyTampermonkeyInstalled = true;

  const STORAGE_KEY = "stonegyTampermonkeyCombat";
  const HUNT_NAME = "";
  const SELL_PANEL_HINT = "CLIQUE PARA INCLUIR/EXCLUIR DA VENDA";
  const ICON_PROTECTED = "HighlightOffIcon";
  const ICON_UNPROTECTED = "CheckCircleIcon";
  const STONEGY_HOST_ID = "stonegy-tm-overlay";
  const STONEGY_TAB_BUTTON_ID = "stonegy-emerick-tab-button";
  const STONEGY_TAB_STYLE_ID = "stonegy-emerick-tab-styles";
  const BOT_REFIL_KEY = "stonegy_refil_stats";
  const DAMAGE_TYPES = { 1:"EARTH",2:"FIRE",3:"ICE",4:"ENERGY",5:"MANADRAIN",6:"HOLY",7:"DEATH",8:"PHYSICAL",9:"LIFEDRAIN" };
  const DAMAGE_ICONS = { EARTH:"🌿", FIRE:"🔥", ICE:"❄️", ENERGY:"⚡", MANADRAIN:"💧", HOLY:"✨", DEATH:"💀", PHYSICAL:"⚔️", LIFEDRAIN:"🩸" };
  const SPLIT_WEAPON_ORIGINS = new Set(["Fierce Berserk","Berserk","Groundshaker","Auto-Attack"]);
  const WEAPON_ELEMENT_TYPES = new Set(["EARTH","FIRE","ICE","ENERGY","HOLY","DEATH"]);

  const SELETOR_BUSCA_HUNT = 'input[placeholder="Hunt ou criatura"]';
  const SELETOR_MODAL_HUNTS = '[data-guide*="hunts-modal"]';
  const SELETOR_MODO_JOGO = '[data-guide="game-mode-buttons"]';
  const SELETOR_MODO_TRAINING = '[data-guide="game-mode-training-button"]';
  const TEXTO_CONFIRMAR_HUNT = "iniciar hunt";
  const TEXTO_CONCLUIR_LURE = "concluir";
  const TEXTO_START_TRAINING = "start training";
  const TEXTO_FINALIZAR_TREINO = "finalizar treino";
  const TEXTO_FINALIZAR_HUNT = "finalizar hunt";

  let panelHost = null;
  let setPanelVisible = null;

  const flowLabel = (s) => ({
    AGUARDANDO_VENDA: "venda",
    AGUARDANDO_PAINEL: "painel",
    AGUARDANDO_VERIFICAR: "verificar",
    AGUARDANDO_VENDER: "vender",
    AGUARDANDO_FECHAR_VENDA: "fechar venda",
    AGUARDANDO_CHECAR_STAMINA: "stamina",
    AGUARDANDO_TREINAR: "treinar",
    AGUARDANDO_AFK_TREINO: "AFK · iniciar treino",
    AGUARDANDO_INICIAR_HUNT: "hunt",
  }[s] || String(s || "").toLowerCase());

  const __sgIsOurs = (target) => {
    let t = target;
    for (let i = 0; i < 30 && t; i++) {
      try {
        if (t.id === STONEGY_HOST_ID) return true;
        const r = t.getRootNode ? t.getRootNode() : null;
        if (r && r.host && r.host.id === STONEGY_HOST_ID) return true;
      } catch(_) {}
      t = t.parentNode || t.parentElement || null;
      if (t && t.host && t.host.id === STONEGY_HOST_ID) return true;
    }
    return false;
  };
  const __sgInPanel = (event) => {
    if (!event) return false;
    try {
      if (__sgIsOurs(event.target)) return true;
      const path = event.composedPath ? event.composedPath() : [];
      for (const n of path) {
        if (n && n.id === STONEGY_HOST_ID) return true;
        if (n && n.host && n.host.id === STONEGY_HOST_ID) return true;
      }
    } catch(_) {}
    return false;
  };
  const __sgOrigAdd = EventTarget.prototype.addEventListener;
  const __sgOrigRemove = EventTarget.prototype.removeEventListener;
  const __sgWrappers = new WeakMap();
  const __sgProtectedTypes = new Set([
    "keydown","keypress","keyup","beforeinput","input",
    "compositionstart","compositionupdate","compositionend",
    "mousedown","mouseup","click","dblclick",
    "pointerdown","pointerup","contextmenu",
  ]);
  const __sgGetWrapper = (target, type, listener, options) => {
    let map = __sgWrappers.get(listener);
    if (!map) { map = new Map(); __sgWrappers.set(listener, map); }
    const capture = (typeof options === "boolean") ? options : !!(options && options.capture);
    const key = type + "|" + (capture ? "c" : "b") + "|" + (target === window ? "w" : "d");
    let wrapper = map.get(key);
    if (!wrapper) {
      wrapper = function(event) { if (__sgInPanel(event)) return; return listener.call(this, event); };
      map.set(key, wrapper);
    }
    return wrapper;
  };
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    try {
      if ((this === window || this === document) && __sgProtectedTypes.has(type) && typeof listener === "function") {
        const wrapper = __sgGetWrapper(this, type, listener, options);
        return __sgOrigAdd.call(this, type, wrapper, options);
      }
    } catch(_) {}
    return __sgOrigAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    try {
      if ((this === window || this === document) && __sgProtectedTypes.has(type) && typeof listener === "function") {
        const map = __sgWrappers.get(listener);
        if (map) {
          const capture = (typeof options === "boolean") ? options : !!(options && options.capture);
          const key = type + "|" + (capture ? "c" : "b") + "|" + (this === window ? "w" : "d");
          const wrapper = map.get(key);
          if (wrapper) { map.delete(key); return __sgOrigRemove.call(this, type, wrapper, options); }
        }
      }
    } catch(_) {}
    return __sgOrigRemove.call(this, type, listener, options);
  };
  const __sgHijackProp = (obj, prop) => {
    if (!obj) return;
    let stored = null;
    try {
      Object.defineProperty(obj, prop, {
        configurable: true,
        get() { return stored; },
        set(fn) {
          if (typeof fn !== "function") { stored = fn; return; }
          stored = function(event) { if (__sgInPanel(event)) return; return fn.call(this, event); };
        }
      });
    } catch(_) {}
  };
  ["onkeydown","onkeypress","onkeyup","oninput","onbeforeinput","onmousedown","onmouseup","onclick","ondblclick","oncontextmenu"].forEach((p) => {
    __sgHijackProp(window, p);
    __sgHijackProp(document, p);
  });
  const __sgOrigPrevent = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function() { if (__sgInPanel(this)) return; return __sgOrigPrevent.call(this); };
  const __sgOrigStop = Event.prototype.stopPropagation;
  const __sgOrigStopImm = Event.prototype.stopImmediatePropagation;
  Event.prototype.stopPropagation = function() { if (__sgInPanel(this)) return; return __sgOrigStop.call(this); };
  Event.prototype.stopImmediatePropagation = function() { if (__sgInPanel(this)) return; return __sgOrigStopImm.call(this); };

  const __sgTextDecoder = new TextDecoder();
  const __sgLatin1Decoder = new TextDecoder("latin1");
  class Reader {
    constructor(bytes){ this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); this.offset = 0; }
    need(size){ if (this.offset + size > this.view.byteLength) throw new Error("Truncated frame"); }
    u8(){ this.need(1); return this.view.getUint8(this.offset++); }
    i8(){ this.need(1); return this.view.getInt8(this.offset++); }
    u16(){ this.need(2); const v = this.view.getUint16(this.offset, true); this.offset += 2; return v; }
    u32(){ this.need(4); const v = this.view.getUint32(this.offset, true); this.offset += 4; return v; }
    string(){ const l = this.u16(); this.need(l); const v = __sgTextDecoder.decode(new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, l)); this.offset += l; return v; }
  }
  const dictionaryValue = (r, d) => { const v = d[r.u8()]; return (typeof v === "string") ? v.trim() : ""; };
  const compactPosition = (r, hasZ) => ({ x: r.i8(), y: r.i8(), z: hasZ ? r.u8() : 0 });

  function extractNames(bytes){
    const text = __sgLatin1Decoder.decode(bytes);
    const names = {};
    const expr = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    for (const match of text.matchAll(expr)) {
      const start = match.index + match[0].length;
      if (start + 2 > bytes.length) continue;
      const length = bytes[start] | (bytes[start+1] << 8);
      if (length < 1 || length > 40 || start + 2 + length > bytes.length) continue;
      const name = __sgTextDecoder.decode(bytes.subarray(start+2, start+2+length));
      if (/^[\p{L}\p{N} ._'’-]+$/u.test(name)) names[match[0].toLowerCase()] = name;
    }
    return names;
  }
  function decodeCanonical(r){
    const dict = Array.from({length: r.u8()}, () => r.string());
    const damages = [];
    for (let i = 0, count = r.u16(); i < count; i++){
      const flags = r.u16();
      const damageType = DAMAGE_TYPES[r.u8()] || "PHYSICAL";
      const amount = flags & 8192 ? r.u32() : r.u16();
      const isMonster = Boolean(flags & 512);
      const damage = { amount, damageType, position: compactPosition(r, Boolean(flags & 4096)), targetType: isMonster?"monster":"player", isHeal: Boolean(flags&2), isExp: Boolean(flags&1), isManaRestore: Boolean(flags&32768) };
      if (flags & 1024){ if (isMonster) damage.targetRuntimeMonsterId = r.u16(); else damage.targetRuntimePlayerId = r.u8(); }
      else damage.targetId = dictionaryValue(r, dict);
      if (flags & 8) damage.targetNewLife = flags & 16384 ? r.u32() : r.u16();
      if (flags & 16) damage.sourceId = flags & 2048 ? `runtime:${r.u8()}` : dictionaryValue(r, dict).toLowerCase();
      if (flags & 32) r.u8();
      if (flags & 64) damage.attackName = dictionaryValue(r, dict);
      if (flags & 128) r.u8();
      if (flags & 256) damage.targetName = dictionaryValue(r, dict);
      damages.push(damage);
    }
    return damages;
  }
  function decodeV2(r){
    const dict = Array.from({length: r.u8()}, () => r.string());
    const contexts = Array.from({length: r.u8()}, () => {
      const flags = r.u8();
      const ctx = {};
      if (flags & 1) ctx.sourceId = flags & 2 ? `runtime:${r.u8()}` : dictionaryValue(r, dict).toLowerCase();
      if (flags & 4) r.u8();
      if (flags & 8) ctx.attackName = dictionaryValue(r, dict);
      if (flags & 16) r.u8();
      return ctx;
    });
    const damages = [];
    for (let i = 0, count = r.u16(); i < count; i++){
      const flags = r.u16();
      const isMonster = Boolean(flags & 64);
      const damage = { damageType: DAMAGE_TYPES[r.u8()] || "PHYSICAL", amount: flags & 512 ? r.u32() : r.u16(), position: compactPosition(r, Boolean(flags & 256)), targetType: isMonster?"monster":"player", isHeal: Boolean(flags&2), isExp: Boolean(flags&1), isManaRestore: Boolean(flags&2048) };
      if (flags & 128){ if (isMonster) damage.targetRuntimeMonsterId = r.u16(); else damage.targetRuntimePlayerId = r.u8(); }
      else damage.targetId = dictionaryValue(r, dict);
      if (flags & 8) damage.targetNewLife = flags & 1024 ? r.u32() : r.u16();
      if (flags & 16) Object.assign(damage, contexts[r.u8()] || {});
      if (flags & 32) damage.targetName = dictionaryValue(r, dict);
      damages.push(damage);
    }
    return damages;
  }
  function decodeFrame(bytes){
    try {
      if (bytes.length < 4 || bytes[0] !== 83 || bytes[1] !== 71 || bytes[2] !== 5) return null;
      const reader = new Reader(bytes);
      reader.u8(); reader.u8(); reader.u8();
      const opcode = reader.u8();
      const damages = opcode === 25 ? decodeCanonical(reader) : opcode === 28 ? decodeV2(reader) : [];
      return { opcode, damages, names: extractNames(bytes) };
    } catch(_) { return null; }
  }

  const MAX_KEYS = 500;
  const trimKeys = (obj) => {
    const keys = Object.keys(obj);
    if (keys.length <= MAX_KEYS) return;
    keys.slice(0, keys.length - MAX_KEYS).forEach((k) => delete obj[k]);
  };
  let damageTotals = {}, receivedTotals = {}, playerNames = {}, dpsBuckets = {}, dpsStartedAt = null;
  // Estatisticas adicionais de combate.
  let combatRecent = { dealt: {}, received: {} };
  let combatMax = { dealt: 0, received: 0 };
  // Agregados exclusivos por identificador de jogador (nao por janela ou party inteira).
  let combatActorRecent = { dealt: {}, received: {} };
  let combatActorMax = { dealt: {}, received: {} };
  let boxStats = { currentStartedAt: null, lastAttackAt: null, durations: [] };
  let overlayState = {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    damageTotals = saved.damageTotals || {};
    receivedTotals = saved.receivedTotals || {};
    playerNames = saved.playerNames || {};
    dpsBuckets = saved.dpsBuckets || {};
    dpsStartedAt = saved.dpsStartedAt || null;
    combatRecent = {
      dealt: saved.combatRecent?.dealt || {},
      received: saved.combatRecent?.received || {}
    };
    combatMax = {
      dealt: Math.max(0, Number(saved.combatMax?.dealt) || 0),
      received: Math.max(0, Number(saved.combatMax?.received) || 0)
    };
    combatActorRecent = {
      dealt: saved.combatActorRecent?.dealt || {},
      received: saved.combatActorRecent?.received || {}
    };
    combatActorMax = {
      dealt: saved.combatActorMax?.dealt || {},
      received: saved.combatActorMax?.received || {}
    };
    boxStats = saved.boxStats || boxStats;
    overlayState = saved.overlayState || {};
  } catch(_) {}
  let saveTimer = null;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      trimKeys(damageTotals); trimKeys(receivedTotals); trimKeys(playerNames); trimKeys(dpsBuckets);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ damageTotals, receivedTotals, playerNames, dpsBuckets, dpsStartedAt, combatRecent, combatMax, combatActorRecent, combatActorMax, boxStats, overlayState })); } catch(_) {}
    }, 400);
  };
  const boxSummary = () => {
    const now = Date.now();
    if (boxStats.currentStartedAt && now - boxStats.lastAttackAt >= 5000){
      const dur = Math.max(1, Math.round((boxStats.lastAttackAt - boxStats.currentStartedAt) / 1000));
      boxStats.durations.push(dur);
      boxStats.durations = boxStats.durations.slice(-100);
      boxStats.currentStartedAt = null;
    }
    const bySeconds = {};
    boxStats.durations.forEach((v) => { bySeconds[v] = (bySeconds[v] || 0) + 1; });
    return {
      count: boxStats.durations.length,
      last: boxStats.durations.at(-1) ?? null,
      average: boxStats.durations.length ? Math.round(boxStats.durations.reduce((a, b) => a + b, 0) / boxStats.durations.length) : null,
      bySeconds,
      running: Boolean(boxStats.currentStartedAt)
    };
  };
  function trackCombatSecond(direction, amount){
    if (!Number.isFinite(amount) || amount <= 0) return;

    const second = Math.floor(Date.now() / 1000);
    const bucket = combatRecent[direction];

    bucket[second] = (bucket[second] || 0) + amount;

    for (const stamp of Object.keys(bucket)) {
      if (
        Number(stamp) <= second - 60 ||
        Number(stamp) > second
      ) {
        delete bucket[stamp];
      }
    }
  }

  function combatDps60(direction){
    const second = Math.floor(Date.now() / 1000);
    let sum = 0;

    for (
      const [stamp, value]
      of Object.entries(combatRecent[direction])
    ) {
      if (
        Number(stamp) <= second - 60 ||
        Number(stamp) > second
      ) {
        delete combatRecent[direction][stamp];
      } else {
        sum += Number(value) || 0;
      }
    }

    return sum / 60;
  }

  // A janela do personagem usa o nome configurado na Party mesmo quando a Party
  // esta desligada. Sem identidade informada, mantem a visao coletiva legada.
  const emNameKey = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  const emLocalCharacter = () => {
    const name = String(window.__emerickLocalCharacterName || '').trim();
    return name || null;
  };
  const emActorIds = character => {
    const wanted = emNameKey(character);
    const keys = new Set();
    if (!wanted) return keys;
    for (const [id, player] of Object.entries(playerNames)) {
      if (emNameKey(player) === wanted) keys.add(String(id).toLowerCase());
    }
    for (const key of new Set([
      ...Object.keys(damageTotals),...Object.keys(receivedTotals),
      ...Object.keys(combatActorMax.dealt),...Object.keys(combatActorMax.received)
    ])) {
      if (emNameKey(key) === wanted) keys.add(String(key).toLowerCase());
    }
    return keys;
  };
  function emRecordActor(direction, actorId, amount) {
    if (!actorId || !Number.isFinite(amount) || amount <= 0) return;
    const id = String(actorId).toLowerCase();
    const now = Math.floor(Date.now()/1000);
    const byId = combatActorRecent[direction];
    const recent = byId[id] || (byId[id] = {});
    recent[now] = (Number(recent[now]) || 0) + amount;
    for (const stamp of Object.keys(recent)) {
      if (Number(stamp) <= now - 60 || Number(stamp) > now) delete recent[stamp];
    }
    // Limita os acumuladores a jogadores identificados no trafego.
    const ids=Object.keys(byId);
    if (ids.length>100) ids.slice(0,ids.length-100).forEach(key=>delete byId[key]);
  }
  function emActorDps60(direction, ids) {
    const now=Math.floor(Date.now()/1000);
    let sum=0;
    for (const id of ids) {
      const recent=combatActorRecent[direction][id];
      if (!recent) continue;
      for (const [stamp,value] of Object.entries(recent)) {
        if (Number(stamp)<=now-60 || Number(stamp)>now) delete recent[stamp];
        else sum+=Number(value)||0;
      }
    }
    return sum/60;
  }
  const emActorMaxValue = (direction, ids) => {
    let best=0;
    for (const id of ids) {
      best=Math.max(best,Number(combatActorMax[direction][id])||0);
      // Mantem os melhores golpes historicos associados ao mesmo jogador,
      // inclusive quando o protocolo variou a capitalizacao do identificador.
      if (direction==='dealt') for (const [key, total] of Object.entries(damageTotals)) {
        if (String(key).toLowerCase() !== id) continue;
        for (const origin of Object.values(total.byOriginImpacts || {})) {
          best=Math.max(best,Number(origin.bestHit)||0);
        }
      }
    }
    return best;
  };

  function groupImpacts(damages){
    const impacts = [];
    const pending = new Map();
    for (const damage of damages){
      if (damage.isHeal || damage.isExp || damage.isManaRestore || damage.targetType !== "monster" || !damage.sourceId) continue;
      const origin = typeof damage.attackName === "string" && damage.attackName.trim() ? damage.attackName.trim() : "Nao identificada";
      const impact = { sourceId: damage.sourceId, origin, amount: damage.amount, terminal: damage.targetNewLife === 0, paired: false };
      const target = Number.isInteger(damage.targetRuntimeMonsterId) ? `runtime:${damage.targetRuntimeMonsterId}` : typeof damage.targetId === "string" && damage.targetId ? `id:${damage.targetId}` : null;
      const isComponent = damage.damageType === "PHYSICAL" || WEAPON_ELEMENT_TYPES.has(damage.damageType);
      if (!target || !SPLIT_WEAPON_ORIGINS.has(origin) || !isComponent){ impacts.push(impact); continue; }
      const key = damage.sourceId + "|" + origin + "|" + target;
      const previous = pending.get(key);
      const complementary = previous && ((previous.type === "PHYSICAL" && WEAPON_ELEMENT_TYPES.has(damage.damageType)) || (damage.damageType === "PHYSICAL" && WEAPON_ELEMENT_TYPES.has(previous.type)));
      if (complementary){ previous.impact.amount += damage.amount; previous.impact.terminal ||= impact.terminal; previous.impact.paired = true; pending.delete(key); }
      else { impacts.push(impact); pending.set(key, { impact, type: damage.damageType }); }
    }
    return impacts;
  }
  function accumulateOrigins(damages){
    for (const impact of groupImpacts(damages)){
      const total = damageTotals[impact.sourceId]; if (!total) continue;

      if (
        Number.isFinite(impact.amount) &&
        impact.amount > 0
      ) {
        combatMax.dealt = Math.max(
          combatMax.dealt,
          impact.amount
        );
        const actor = String(impact.sourceId).toLowerCase();
        combatActorMax.dealt[actor] = Math.max(Number(combatActorMax.dealt[actor]) || 0, impact.amount);
      }
      total.byOriginImpacts ||= {};
      const originTotal = total.byOriginImpacts[impact.origin] || { damage: 0, hits: 0, pairedHits: 0 };
      originTotal.bestHit = Math.max(Number.isFinite(originTotal.bestHit) ? originTotal.bestHit : 0, impact.amount);
      if (!impact.terminal){ originTotal.damage += impact.amount; originTotal.hits += 1; if (impact.paired) originTotal.pairedHits += 1; }
      total.byOriginImpacts[impact.origin] = originTotal;
    }
  }
  function summary(totals){
    const elapsed = dpsStartedAt ? Math.max(1/60, (Date.now() - dpsStartedAt) / 60000) : 0;
    return Object.entries(totals).map(([sourceId, value]) => ({
      sourceId, name: playerNames[sourceId] || sourceId, damage: value.damage, hits: value.hits,
      averagePerMinute: elapsed ? Math.round(value.damage / elapsed) : 0,
      byType: value.byType || {}, byOrigin: value.byOriginImpacts || {},
      originHits: Object.values(value.byOriginImpacts || {}).reduce((s, i) => s + i.hits, 0),
    })).sort((a, b) => b.damage - a.damage);
  }
  function dpsSummary(){
    if (!dpsStartedAt) return { averagePerMinute: 0, values: Array(60).fill(null), timestamps: Array(60).fill(null) };
    const elapsedMs = Date.now() - dpsStartedAt;
    const elapsedMinutes = Math.max(1/60, elapsedMs / 60000);
    const totalDamage = Object.values(dpsBuckets).reduce((t, d) => t + Number(d || 0), 0);
    const averagePerMinute = elapsedMs < 10000 ? 0 : Math.round(totalDamage / elapsedMinutes);
    const completed = Math.floor(elapsedMs / 60000);
    const first = Math.max(0, completed - 60);
    const count = Math.min(60, completed);
    const leading = 60 - count;
    const values = Array.from({ length: 60 }, (_, slot) => {
      if (slot < leading) return null;
      const minute = first + slot - leading;
      const start = Math.max(0, minute - 4);
      let total = 0;
      for (let i = start; i <= minute; i++) total += dpsBuckets[i] || 0;
      return Math.round(total / ((minute - start + 1) * 60));
    });
    return { averagePerMinute, values, timestamps: Array.from({ length: 60 }, (_, slot) => slot < leading ? null : dpsStartedAt + (first + slot - leading) * 60000) };
  }
  function processCombat(frame){
    Object.assign(playerNames, frame.names || {});
    for (const damage of frame.damages || []){
      if (damage.isHeal || damage.isExp || damage.isManaRestore) continue;
      if (damage.targetType === "monster" && damage.sourceId){
        const time = Date.parse(frame.time || "") || Date.now();
        boxSummary();
        boxStats.currentStartedAt ||= time;
        boxStats.lastAttackAt = time;
        const total = damageTotals[damage.sourceId] || { damage: 0, hits: 0, byType: {} };
        total.damage += damage.amount; total.hits += 1;
        total.byType[damage.damageType] = (total.byType[damage.damageType] || 0) + damage.amount;
        damageTotals[damage.sourceId] = total;
        trackCombatSecond('dealt', damage.amount);
        emRecordActor('dealt', damage.sourceId, damage.amount);
        dpsStartedAt ||= time;
        const minute = Math.floor((time - dpsStartedAt) / 60000);
        dpsBuckets[minute] = (dpsBuckets[minute] || 0) + damage.amount;
      }
      if (damage.targetType === "player"){
        const targetId = damage.targetRuntimePlayerId ? `runtime:${damage.targetRuntimePlayerId}` : damage.targetId;
        if (!targetId) continue;
        // O protocolo informa targetName em alguns golpes de jogador;
        // retem esta associacao quando o dicionario de nomes nao a trouxe.
        if (typeof damage.targetName === 'string' && damage.targetName.trim()) {
          playerNames[String(targetId).toLowerCase()] = damage.targetName.trim();
        }
        const total = receivedTotals[targetId] || { damage: 0, hits: 0, byType: {} };
        total.damage += damage.amount; total.hits += 1;
        total.byType[damage.damageType] = (total.byType[damage.damageType] || 0) + damage.amount;
        receivedTotals[targetId] = total;

        trackCombatSecond('received', damage.amount);
        emRecordActor('received', targetId, damage.amount);

        if (
          Number.isFinite(damage.amount) &&
          damage.amount > 0
        ) {
          combatMax.received = Math.max(
            combatMax.received,
            damage.amount
          );
          const actor=String(targetId).toLowerCase();
          combatActorMax.received[actor] = Math.max(Number(combatActorMax.received[actor]) || 0, damage.amount);
        }
      }
    }
    accumulateOrigins(frame.damages || []);
    persist();
  }

  const escapeHtml = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapeAttr = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const BOT_LOG_MAX = 250;
  const botLogBuffer = [];
  let botLogFilter = "all";
  let botLogUiTimer = null;
  const botLog = (level, message, data) => {
    const entry = { t: Date.now(), level: String(level || "info"), msg: String(message || "") };
    botLogBuffer.push(entry);
    if (botLogBuffer.length > BOT_LOG_MAX) botLogBuffer.shift();
    try {
      const time = new Date(entry.t).toLocaleTimeString("pt-BR");
      const prefix = `[Stonegy ${time}]`;
      if (entry.level === "error") console.error(prefix, message, data ?? "");
      else if (entry.level === "warn") console.warn(prefix, message, data ?? "");
      else if (entry.level === "success") console.log(`%c${prefix} ${message}`, "color:#22c55e", data ?? "");
      else if (entry.level === "flow") console.log(`%c${prefix} ${message}`, "color:#38bdf8;font-weight:bold", data ?? "");
      else console.log(prefix, message, data ?? "");
    } catch(_) {}
    if (botLogUiTimer) return;
    botLogUiTimer = setTimeout(() => { botLogUiTimer = null; botRenderLog(); }, 150);
  };

  // ==================== TOASTS ====================
  const botToast = (level, message) => {
    if (!botRoot) return;
    let container = botRoot.querySelector("[data-toast-container]");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      container.dataset.toastContainer = "1";
      botRoot.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast " + (level || "info");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("leaving"), 2700);
    setTimeout(() => { try { toast.remove(); } catch(_) {} }, 3000);
    while (container.children.length > 5) container.removeChild(container.firstChild);
  };
  const botLogAndToast = (level, msg) => { botLog(level, msg); botToast(level, msg); };

  // ==================== REFIL STATS ====================
  let botRefilStats = { huntCount: 0, sellCount: 0, huntDurations: [] };
  let botWasInHunt = false;
  let botHuntStartAt = 0;
  let botSellPendingSuccess = false;
  const botLoadRefilStats = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(BOT_REFIL_KEY) || "{}");
      botRefilStats = {
        huntCount: Math.max(0, Number(saved.huntCount) || 0),
        sellCount: Math.max(0, Number(saved.sellCount) || 0),
        huntDurations: Array.isArray(saved.huntDurations) ? saved.huntDurations.filter(n => Number.isFinite(n) && n > 0).slice(-100) : [],
      };
    } catch(_) { botRefilStats = { huntCount: 0, sellCount: 0, huntDurations: [] }; }
  };
  const botSaveRefilStats = () => { try { localStorage.setItem(BOT_REFIL_KEY, JSON.stringify(botRefilStats)); } catch(_) {} };
  botLoadRefilStats();

  const botFmtDuration = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2,"0")}s`;
    return `${sec}s`;
  };
  const botRefilAverage = () => {
    const d = botRefilStats.huntDurations || [];
    if (!d.length) return 0;
    return d.reduce((a, b) => a + b, 0) / d.length;
  };
  const botTrackHuntSession = () => {
    const inHunt = botInHunt();
    if (inHunt && !botWasInHunt) {
      botHuntStartAt = Date.now();
    } else if (!inHunt && botWasInHunt && botHuntStartAt > 0) {
      const dur = Date.now() - botHuntStartAt;
      if (dur >= 30000) {
        botRefilStats.huntCount += 1;
        botRefilStats.huntDurations.push(dur);
        if (botRefilStats.huntDurations.length > 100) botRefilStats.huntDurations.shift();
        botSaveRefilStats();
        botLog("flow", `⚔ Hunt #${botRefilStats.huntCount} · ${botFmtDuration(dur)}`);
      }
      botHuntStartAt = 0;
    }
    botWasInHunt = inHunt;
  };

  const botRenderRefilPanel = (container) => {
    const s = botRefilStats;
    const avg = botRefilAverage();
    const durations = s.huntDurations || [];
    const last = durations.length ? durations[durations.length - 1] : 0;
    const best = durations.length ? Math.max(...durations) : 0;
    const rows = [
      { icon: "🛒", label: "Vendas", value: String(s.sellCount) },
      { icon: "⚔️", label: "Hunts", value: String(s.huntCount) },
      { icon: "⏱️", label: "Média", value: botFmtDuration(avg) },
      { icon: "🕐", label: "Última", value: botFmtDuration(last) },
      { icon: "🏆", label: "Maior", value: botFmtDuration(best) },
    ];
    const html = rows.map((r) => (
      `<div class="log-line" data-level="flow"><span class="log-time">—</span>` +
      `<span class="log-msg">${r.icon} ${escapeHtml(r.label)}: ${escapeHtml(r.value)}</span></div>`
    )).join("");
    const resetHtml = `<div class="log-line log-refil-reset" data-refil-reset="1" data-level="info"><span class="log-time">—</span><span class="log-msg">↺ Clique para resetar</span></div>`;
    container.innerHTML = html + resetHtml;
  };

  const botRenderLog = () => {
    if (!botRoot) return;
    const container = botRoot.querySelector("[data-log-rows]");
    if (!container) return;
    const filter = botLogFilter;
    if (filter === "refil") { botRenderRefilPanel(container); return; }
    const list = filter === "all" ? botLogBuffer : botLogBuffer.filter((e) => e.level === filter);
    if (!list.length){ container.innerHTML = `<div class="log-empty">Nenhum registro ainda.</div>`; return; }
    container.innerHTML = list.map((e, i) => {
      const time = new Date(e.t).toLocaleTimeString("pt-BR");
      const isLast = i === list.length - 1;
      return `<div class="log-line${isLast ? " log-latest" : ""}" data-level="${e.level}"><span class="log-time">${time}</span><span class="log-msg">${escapeHtml(e.msg)}</span></div>`;
    }).join("");
    container.scrollTop = container.scrollHeight;
  };
  const botClearLog = () => { botLogBuffer.length = 0; botRenderLog(); };

  const BOT_CONFIG_KEY = "stonegy_config_menu";
  const BOT_FLOW_KEY = "stonegy_fluxo_automatico";
  const BOT_DEFAULTS = { configVersion: 51, botAtivo: false, antiInatividadeAtivo: true, autoRecovery: true, autoResume: true, autoReload: true, unprotectExtras: true, showInventoryMarkers: true, skipProtection: false, lureModo: "max", huntName: HUNT_NAME, protectedItems: [], minStaminaHours: 5, trainingHours: 10 };
  const BOT_FLOW_TTL = 15 * 60 * 1000;
  const BOT_PAGE_COOLDOWN_MS = 1400;
  const BOT_PAGE_TIMEOUT_MS = 5000;
  const BOT_PANEL_READY_TIMEOUT_MS = 12000;
  const BOT_VERIFY_DELAY_MS = 1300;
  const BOT_MAX_PROTECT_ATTEMPTS = 100;
  const BOT_INTENT_COOLDOWN_MS = 5000;
  const BOT_STAGNATION_LIMIT = 6;
  const BOT_RECOVERY_MAX_ATTEMPTS = 3;
  const BOT_RESTART_COOLDOWN_MS = 30000;
  const BOT_SCREEN_SETTLE_MS = 1500;
  const BOT_RESUME_COOLDOWN_MS = 3000;
  const BOT_RESUME_SCAN_MS = 500;
  const BOT_INV_MARKERS_SCAN_MS = 900;
  const BOT_MONITOR_COOLDOWN_MS = 3000;
  const BOT_REENTRY_COOLDOWN_MS = 15000;
  const BOT_SELL_RETRY_MS = 2500;
  const BOT_SELL_MAX_RETRIES = 3;
  const BOT_RELOAD_COOLDOWN_MS = 5000;
  const BOT_MAX_PAGES = 20;
  const BOT_FONT_MIN = 0.85;
  const BOT_FONT_MAX = 1.35;
  const BOT_FONT_STEP = 0.08;
  const BOT_STEP_TIMEOUTS = {
    AGUARDANDO_VENDA: 12000,
    AGUARDANDO_PAINEL: 20000,
    AGUARDANDO_VERIFICAR: 120000,
    AGUARDANDO_VENDER: 25000,
    AGUARDANDO_FECHAR_VENDA: 20000,
    AGUARDANDO_CHECAR_STAMINA: 15000,
    AGUARDANDO_TREINAR: 13 * 60 * 60 * 1000,
    AGUARDANDO_AFK_TREINO: 60000,
    AGUARDANDO_INICIAR_HUNT: 120000,
  };
  const BOT_STEP_DEFAULT_TIMEOUT = 15000;
  const BOT_CONFIG = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BOT_CONFIG_KEY) || "{}");
      // Preserva o estado de configuracoes existentes; em instalacoes novas, inicia pausado.
      const botAtivo = saved.configVersion === BOT_DEFAULTS.configVersion
        ? saved.botAtivo !== false
        : (Object.keys(saved).length > 0 ? true : BOT_DEFAULTS.botAtivo);
      const protectedItems = Array.isArray(saved.protectedItems) ? saved.protectedItems.map(String).filter(Boolean) : [];
      const savedHunt = (saved.configVersion === BOT_DEFAULTS.configVersion &&
                         typeof saved.huntName === "string")
        ? saved.huntName.trim()
        : HUNT_NAME;
      const lureRaw = saved.lureModo;
      let lureParsed = "max";
      if (lureRaw === "off") lureParsed = "off";
      else if (lureRaw === "max") lureParsed = "max";
      else if (Number.isInteger(Number(lureRaw)) && Number(lureRaw) > 0) lureParsed = "max";
      const minStaminaRaw = Number(saved.minStaminaHours);
      const minStaminaHours = Number.isInteger(minStaminaRaw) && minStaminaRaw >= 0 && minStaminaRaw <= 12 ? minStaminaRaw : 5;
      const trainingRaw = Number(saved.trainingHours);
      const trainingHours = Number.isInteger(trainingRaw) && trainingRaw >= 4 && trainingRaw <= 12 ? trainingRaw : 10;
      return {
        ...BOT_DEFAULTS, ...saved,
        configVersion: BOT_DEFAULTS.configVersion,
        huntName: savedHunt, lastHuntName: savedHunt,
        botAtivo,
        antiInatividadeAtivo: true,
        autoRecovery: true,
        autoReload: true,
        autoResume: true,
        unprotectExtras: saved.unprotectExtras !== false,
        showInventoryMarkers: saved.showInventoryMarkers !== false,
        skipProtection: saved.skipProtection === true,
        lureModo: lureParsed,
        protectedItems,
        minStaminaHours,
        trainingHours,
      };
    } catch(_) { return { ...BOT_DEFAULTS, huntName: HUNT_NAME, lastHuntName: HUNT_NAME }; }
  })();

  let botRoot = null, botStatus = null, botFlow = null, botHuntState = null, botBusy = false, botLastActivity = 0, botObserver = null, botScheduled = false, botPanelWaitStart = 0, botVerifyUntil = 0, botProtectAttempts = 0;
  let botPage = 0;
  let botLastPageChange = 0;
  let botWaitingPage = false;
  let botLastHuntLog = 0;
  let botRecoveryCount = 0;
  let botLastRecoveryStep = null;
  let botRestartCooldownUntil = 0;
  let botScreenSig = "", botScreenSigSince = 0;
  let botLastResumeClick = 0;
  let botInactivityActive = false;
  let botInvCaptureHandler = null;
  let botLastInvToggleAt = 0;
  let botLureTriggerClickedAt = 0;
  let botMonitorLastSetFlow = 0;
  let botLastAbortFrom = null;
  let botLastAbortAt = 0;
  let botSellLastClickAt = 0;
  let botSellRetryCount = 0;
  let botSaleCloseClickAt = 0;
  let botSaleCloseAttempts = 0;
  let botSaleHiddenSince = 0;
  const botPendingIntent = new Map();
  let botLastWrongCount = -1;
  let botStagnantCycles = 0;
  let botHuntAsyncRunning = false;
  // Um unico bloqueio leve para impedir que Bestiary/Posicionamento
  // interajam com o jogo enquanto o lider ajusta a hunt ou o lure.
  const emHuntPriority = { active:false, stage:'idle', lastLure:'' };
  window.__emerickHuntPriority = emHuntPriority;
  // Uma sequencia por entrada na Hunt; nunca usar um segundo motor paralelo.
  const emPartyAfterHunt = {
    seen:false, done:false, running:false, nextTry:0, failures:0
  };
  let botTrainingAsyncRunning = false;
  let botTrainingStartedAt = 0;
  let botTrainingTotalMs = 0;
  let botLastReloadClick = 0;
  let botConnLostActive = false;

  const botSaveConfig = () => { try { localStorage.setItem(BOT_CONFIG_KEY, JSON.stringify(BOT_CONFIG)); } catch(_) {} };
  // Modo Party: o lider usa o motor Solo (venda/protecao/refil/hunt/lure).
  // O membro so acompanha prontidao e posicionamento; nao inicia bot nem venda.
  const botPartyAllowsHunt = () => {
    const gate = window.__emerickPartyGate;
    return !gate?.enabled || gate.isLeader === true;
  };
  const botIsPartyLeader = () => Boolean(window.__emerickPartyGate?.enabled && window.__emerickPartyGate?.isLeader);
  const botIsPartyMember = () => Boolean(window.__emerickPartyGate?.enabled && !window.__emerickPartyGate?.isLeader);
  const botNormalize = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  const botTextValue = (el) => { if (!el) return ""; return [el.textContent, el.getAttribute?.("aria-label"), el.getAttribute?.("title"), el.getAttribute?.("value"), el.getAttribute?.("alt"), el.dataset?.label].filter((i) => typeof i === "string" && i.trim()).join(" "); };
  const botVisible = (el) => {
    if (!el) return false;
    try {
      if (el.offsetWidth <= 0 && el.offsetHeight <= 0) {
        const s = getComputedStyle(el);
        if (s.position !== "fixed" && s.position !== "sticky") return false;
      }
      return true;
    } catch(_) { return false; }
  };
  const __sgScanCache = { nodes: null, at: 0 };
  const __sgGetNodes = () => {
    const now = Date.now();
    if (__sgScanCache.nodes && now - __sgScanCache.at < 200) return __sgScanCache.nodes;
    __sgScanCache.nodes = document.querySelectorAll("button,[role=button],a,h1,h2,h3,h4,h5,h6,p,span,div,input,label");
    __sgScanCache.at = now;
    return __sgScanCache.nodes;
  };

  const botFindAnyTextMulti = (texts) => {
    const wanted = texts.map(botNormalize).filter(Boolean);
    if (!wanted.length) return null;
    let partialMatch = null;
    for (const el of __sgGetNodes()) {
      if (!botVisible(el)) continue;
      if (el.closest("#stonegy-tm-overlay")) continue;
      const label = botNormalize(botTextValue(el));
      if (!label) continue;
      for (const w of wanted) { if (label === w) return el; }
      if (!partialMatch) for (const w of wanted) { if (label.includes(w)) { partialMatch = el; break; } }
    }
    return partialMatch;
  };
  const botFindAnyText = (...texts) => botFindAnyTextMulti(texts);

  const botFindClickableAncestor = (el) => {
    if (!el) return null;
    let cur = el;
    let firstCursorPointer = null;
    for (let i = 0; i < 10 && cur; i++) {
      if (cur instanceof HTMLElement) {
        const tag = cur.tagName;
        const role = cur.getAttribute?.("role");
        if (tag === "BUTTON" || role === "button" || role === "link") return cur;
        const cs = getComputedStyle(cur);
        if (cs.cursor && cs.cursor.includes("pointer") && !firstCursorPointer) firstCursorPointer = cur;
      }
      cur = cur.parentElement;
    }
    return firstCursorPointer || el;
  };
  const botClick = (el) => {
    if (!el) return false;
    const target = botFindClickableAncestor(el) || el;
    try {
      const r = target.getBoundingClientRect();
      const jitter = 0.3;
      const cx = r.left + r.width * (0.5 + (Math.random() - 0.5) * jitter);
      const cy = r.top + r.height * (0.5 + (Math.random() - 0.5) * jitter);
      const base = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
      const pointerOpts = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
      try { target.dispatchEvent(new PointerEvent("pointerdown", pointerOpts)); } catch(_) {}
      try { target.dispatchEvent(new MouseEvent("mousedown", base)); } catch(_) {}
      try { target.dispatchEvent(new PointerEvent("pointerup", pointerOpts)); } catch(_) {}
      try { target.dispatchEvent(new MouseEvent("mouseup", base)); } catch(_) {}
      // Dispara apenas um click: target.click() já gera o evento de clique.
      // Enviar também um MouseEvent("click") aqui poderia executar a ação duas vezes.
      target.click();
      return true;
    } catch(_) {
      try { target.click(); return true; } catch(__) { return false; }
    }
  };

  // ==================== BUSCA DE HUNT ====================
  const botTypeInputNative = (input, texto) => {
    if (!input) return false;
    try {
      const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      input.focus();
      setter.call(input, texto);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch(_) {
      try { input.value = texto; input.dispatchEvent(new Event("input", { bubbles: true })); return true; } catch(__) { return false; }
    }
  };

  const botFindSearchInput = () => {
    const input = document.querySelector(SELETOR_BUSCA_HUNT);
    if (input && botVisible(input)) return input;
    return null;
  };

  const botFindPlayButton = () => {
    // A raiz real do Stonegy e um DIV clicavel que contem Jogar/Explorar.
    // Nao clicar no primeiro H5 sem verificar se o controle esta visivel.
    const raiz = [...document.querySelectorAll('[data-tour="home-play-explore"]')]
      .find(el => botVisible(el) && !el.closest('#stonegy-tm-overlay'));
    if (!raiz) return null;
    const h5s = [...raiz.querySelectorAll('h5')].filter(botVisible);
    const labels=h5s.map(el=>botNormalize(el.textContent));
    if (!labels.includes('JOGAR') && !labels.includes('PLAY') &&
        !labels.includes('EXPLORAR') && !labels.includes('EXPLORE')) return null;
    return raiz;
  };

  const botFindHuntResult = (name) => {
    const raiz = document.querySelector(SELETOR_MODAL_HUNTS) ?? document;
    const alvo = String(name || "").toLowerCase();
    if (!alvo) return null;
    const ps = [...raiz.querySelectorAll("p")];
    let exact = null, partial = null;
    for (const p of ps) {
      if (p.closest("#stonegy-tm-overlay")) continue;
      const t = (p.textContent || "").trim().toLowerCase();
      if (t === alvo) { exact = p; break; }
      if (!partial && t.includes(alvo)) partial = p;
    }
    return exact || partial;
  };

  // ==================== STAMINA ====================
  const botReadStamina = () => {
    const el = document.querySelector('[style*="talkcursor"]');
    if (!el || el.closest("#stonegy-tm-overlay")) return null;
    const p = el.querySelector("p");
    if (!p) return null;
    const txt = (p.textContent || "").trim();
    const m = txt.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours + minutes / 60;
  };
  const botFmtStamina = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2,"0")}`;
  };
  const botFmtCountdown = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };
  const botParseHMS = (s) => {
    const m = String(s || "").match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
    if (!m) return 0;
    return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  };

  // ==================== STATUS DA HUNT (lê direto do jogo) ====================
  const botReadHuntStatus = () => {
    let huntTime = null, maxTime = null, remaining = null;
    for (const p of document.querySelectorAll("p")) {
      if (p.closest("#stonegy-tm-overlay")) continue;
      const t = (p.textContent || "").trim();
      let m;
      if ((m = t.match(/^Hunt\s*Time:\s*(\d{1,3}:\d{2}:\d{2})$/i))) huntTime = m[1];
      else if ((m = t.match(/^Max:\s*(\d{1,3}:\d{2}:\d{2})$/i))) maxTime = m[1];
      else if ((m = t.match(/^Remaining:\s*(\d{1,3}:\d{2}:\d{2})$/i))) remaining = m[1];
    }
    if (!huntTime || !maxTime) return null;
    let huntName = null;
    if (remaining) {
      for (const p of document.querySelectorAll("p")) {
        if (p.closest("#stonegy-tm-overlay")) continue;
        const t = (p.textContent || "").trim();
        if (!/^Remaining:\s*\d{1,3}:\d{2}:\d{2}$/i.test(t)) continue;
        const parent = p.parentElement;
        const h5 = parent ? parent.querySelector("h5") : null;
        if (h5) {
          const name = (h5.textContent || "").trim();
          if (name && name.length <= 60) { huntName = name; break; }
        }
      }
    }
    return { huntName, huntTime, maxTime, remaining };
  };

  // ==================== MODOS DE JOGO / TRAINING ====================
  const botFindGameModePanel = () => {
    const el = document.querySelector(SELETOR_MODO_JOGO);
    if (el && botVisible(el)) return el;
    return null;
  };
  const botFindTrainingModeButton = () => {
    // Preferir data-guide; nao confundir com START TRAINING.
    const el=document.querySelector(SELETOR_MODO_TRAINING);
    if (el && botVisible(el) && !el.closest('#stonegy-tm-overlay')) return el;
    const matches=[...document.querySelectorAll('h5,p,button,[role="button"]')]
      .filter(node=>node.isConnected && botVisible(node) &&
        !node.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]') &&
        ['TRAINING','TREINO'].includes(botNormalize(node.textContent||'')));
    const leaf=matches.filter(node=>
      !matches.some(other=>other!==node && node.contains(other)));
    if (leaf.length!==1) return null;
    return leaf[0].closest('button,[role="button"],.highlight-animation') || leaf[0];
  };
  // Stonegy exibe o mesmo comando em PT e EN. O clique pertence ao
  // container highlight-animation (nao ao texto h5 isolado).
  const botFindStartTrainingButton = () => {
    const names = new Set(['INICIAR TREINO', 'START TRAINING']);
    for (const h of document.querySelectorAll('h5')) {
      if (h.closest('#stonegy-tm-overlay') || !botVisible(h)) continue;
      if (!names.has(botNormalize(h.textContent || ''))) continue;
      return h.closest('.highlight-animation') || botFindClickableAncestor(h) || h;
    }
    return null;
  };
  const botFindFinalizarTreinoButton = () => {
    const labels=new Set([
      'FINALIZAR TREINO','ENCERRAR TREINO',
      'FINISH TRAINING','STOP TRAINING','END TRAINING'
    ]);
    const found=[...document.querySelectorAll('h5')].filter(h=>
      h.isConnected && botVisible(h) &&
      !h.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]') &&
      labels.has(botNormalize(h.textContent||'')));
    if (found.length!==1) return null;
    return found[0].closest('.highlight-animation') || found[0];
  };
  const botTreinando = () => Boolean(botFindFinalizarTreinoButton());

  // ==================== CONEXÃO PERDIDA ====================
  const botFindConnectionLostPanel = () => {
    const phrases = ["CONEXAO PERDIDA", "CONEXAO COM O JOGO FOI PERDIDA", "CONNECTION LOST", "RECARREGUE PARA TENTAR NOVAMENTE"];
    for (const el of document.querySelectorAll("p, h5, h4, h6, div, span")) {
      if (el.closest("#stonegy-tm-overlay")) continue;
      const t = botNormalize(el.textContent || "");
      if (!t || t.length > 200) continue;
      for (const p of phrases) { if (t.includes(p)) return el; }
    }
    return null;
  };
  const botFindReloadButton = () => {
    const set = new Set(["RECARREGAR", "RELOAD", "TENTAR NOVAMENTE", "TRY AGAIN", "TENTAR DE NOVO"]);
    for (const el of document.querySelectorAll("h5, h4, h6")) {
      if (el.closest("#stonegy-tm-overlay")) continue;
      const t = botNormalize(el.textContent || "");
      if (!t || t.length > 40) continue;
      if (!set.has(t)) continue;
      if (botVisible(el)) return el;
    }
    for (const el of document.querySelectorAll("button, [role=button], div, span")) {
      if (el.closest("#stonegy-tm-overlay")) continue;
      const t = botNormalize(botTextValue(el));
      if (!t || t.length > 40) continue;
      if (!set.has(t)) continue;
      if (el.children.length > 2) continue;
      if (botVisible(el)) return el;
    }
    return null;
  };
  const botHandleConnectionLost = () => {
    const panel = botFindConnectionLostPanel();
    if (!panel) {
      if (botConnLostActive) { botConnLostActive = false; botLogAndToast("success", "✓ Reconectado"); }
      return false;
    }
    if (!botConnLostActive) { botConnLostActive = true; botLog("warn", "🔌 Conexão perdida!"); botLogAndToast("flow", "🔌 Reconectando"); }
    const btn = botFindReloadButton();
    if (!btn) { botLog("error", "✗ Conexão perdida · RECARREGAR não achado"); return true; }
    if (Date.now() - botLastReloadClick < BOT_RELOAD_COOLDOWN_MS) return true;
    botLastReloadClick = Date.now();
    botLog("info", "→ RECARREGAR");
    botClick(btn);
    return true;
  };

  // ==================== LURE ====================
  const botFindLureTrigger = () => {
    // HTML nativo enviado: <div aria-label="LURE"><h5>4</h5>...</div>.
    // O numero sozinho pode ser HP ou inventario; nunca usar esse fallback.
    const exact = [...document.querySelectorAll('[aria-label]')].find(el =>
      botVisible(el) && !el.closest('#stonegy-tm-overlay') &&
      botNormalize(el.getAttribute('aria-label')) === 'LURE'
    );
    if (exact) return exact;
    // Nao usa outro numero como fallback, evitando clicar em HP ou inventario.
    return null;
  };
  const botFindLureOptions = () => {
    return [...document.querySelectorAll("h5")]
      .filter(h => /^lure\s+\d+\s*-\s*\d+$/i.test((h.textContent || "").trim()))
      .map(label => {
        // O ancestral com cursor clicavel e o cartao real; a arvore varia entre hunts.
        const card = botFindClickableAncestor(label) || label.parentElement;
        if (!card || !botVisible(card)) return null;
        // O titulo e "Lure N - M". Ler o primeiro h5 retornava NaN (virava zero).
        const faixa = /^lure\s+(\d+)\s*-\s*(\d+)$/i.exec((label.textContent || "").trim());
        const num = faixa ? Number(faixa[2]) : 0;
        const selecionado = [...card.querySelectorAll("p")].some(p => (p.textContent || "").trim().toLowerCase() === "selecionado");
        return { el: card, card, num: Number.isFinite(num) ? num : 0, texto: label.textContent.trim(), selecionado };
      })
      .filter(Boolean);
  };
  const botPickLureOption = (_target) => {
    const options = botFindLureOptions();
    if (!options.length) return null;
    return options.reduce((a, b) => (b.num > a.num ? b : a), options[0]);
  };
  const botLureOpen = () => botFindLureOptions().length > 0;

  // ==================== HELPERS DE ESPERA ====================
  const botEsperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const botJitter = (min, max) => botEsperar(min + Math.random() * (max - min));
  async function botEsperarAte(fn, timeout = 4000) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeout) {
      const r = fn();
      if (r) return r;
      await botEsperar(200);
    }
    return null;
  }
  function botAcharH5(texto) {
    const alvo = String(texto || "").toLowerCase();
    return [...document.querySelectorAll("h5")]
      .find(el => el.closest("#stonegy-tm-overlay") ? false : (el.textContent || "").trim().toLowerCase() === alvo);
  }

  // ==================== FLUXO ASYNC DE HUNT + LURE ====================
  async function botExecutarAjustarLure() {
    if (BOT_CONFIG.lureModo === 'off') {
      emHuntPriority.lastLure = 'OFF';
      return true;
    }
    // Espera o jogo estabilizar; ate tres tentativas espaçadas.
    // Lure nunca concorre com o posicionamento neste navegador.
    emHuntPriority.active = true;
    emHuntPriority.stage = 'lure';
    try {
      await botJitter(1100, 1700);
      let opcoes = botFindLureOptions();
      if (!opcoes.length) {
        for (let attempt=0;attempt<3;attempt++) {
          const botaoQtd = botFindLureTrigger();
          if (botaoQtd && botClick(botaoQtd)) {
            botLog('info', '🎯 Abrindo Lure');
            opcoes = await botEsperarAte(() => {
              const found=botFindLureOptions();return found.length?found:null;
            }, 2700) || [];
            if (opcoes.length) break;
          }
          await botEsperar(1200);
        }
      }
      if (!opcoes.length) {
        emHuntPriority.lastLure = 'Não encontrado';
        botLog('error', '✗ Lure não encontrado; não selecionei outro controle');
        return false;
      }
      // Usar a maior faixa, como no motor Solo.
      const escolha = opcoes.reduce((a,b) => b.num>a.num?b:a);
      if (!escolha.selecionado) {
        await botJitter(450, 850);
        if (!botClick(escolha.card)) {
          botLog('error', '✗ Clique de Lure falhou');return false;
        }
        botLog('info', '🎯 ' + escolha.texto);
        await botJitter(600, 1000);
      }
      const concluir = await botEsperarAte(() =>
        botAcharH5(TEXTO_CONCLUIR_LURE), 3500);
      if (!concluir || !botClick(concluir)) {
        emHuntPriority.lastLure = 'Concluir não encontrado';
        botLog('error', '✗ Concluir Lure não encontrado');return false;
      }
      await botJitter(650, 1100);
      emHuntPriority.lastLure = escolha.texto;
      botLog('success', '✓ Lure ' + escolha.texto + ' concluído');
      return true;
    } finally {
      // O ciclo de hunt pode refazer a tentativa de lure.
      // Manter a prioridade ate o fim da sequencia completa.
      emHuntPriority.active=Boolean(botHuntAsyncRunning);
      emHuntPriority.stage=botHuntAsyncRunning?'lure':'ready';
    }
  }

  async function botExecutarIniciarHuntEAjustarLure() {
    if (!botPartyAllowsHunt()) return false;
    const cfg = BOT_CONFIG;
    if (!cfg.huntName || !cfg.huntName.trim()) {
      botLogAndToast("error", "⚠ Defina uma hunt alvo");
      return false;
    }
    botLog("info", `▶ ${cfg.huntName}${botIsPartyLeader()?' · Party líder':' · Solo'}`);
    emHuntPriority.active=true;
    emHuntPriority.stage='iniciando';
    // Nunca iniciar outra hunt se ela ja estiver em andamento.
    if (botInHunt()) {
      if (botIsPartyLeader()) {
        emHuntPriority.stage='position';
        botLog('info', 'Hunt detectada; primeiro posicionamento, depois Lure');
        return true;
      }
      botLog('info', 'Hunt detectada; verificando Lure');
      return await botExecutarAjustarLure();
    }
    let busca = botFindSearchInput();
    if (!busca) {
      const jogar = botFindPlayButton();
      if (!jogar) { botLog("error", "✗ Jogar não achado"); return false; }
      botLog("info", "▶ Jogar");
      await botJitter(500, 1200);
      if (!botClick(jogar)) {botLog('error','✗ Clique em Jogar falhou');return false;}
      // O painel de hunts pode renderizar em varias etapas apos Jogar.
      busca = await botEsperarAte(() => {
        const input=botFindSearchInput();
        return input || (botInHunt() ? 'em-hunt' : null);
      }, botIsPartyLeader() ? 15000 : 9000);
      if (busca === "em-hunt") {
        botLogAndToast("flow", "✓ Em hunt");
        if (botIsPartyLeader()) {
          emHuntPriority.stage='position';
          return true;
        }
        await botJitter(1000, 2000);
        return await botExecutarAjustarLure();
      }
      if (!busca) { botLog("error", "✗ Busca não abriu"); return false; }
    }
    await botJitter(400, 900);
    if (!busca?.isConnected || !botVisible(busca)) {
      busca=await botEsperarAte(()=>botFindSearchInput(),4000);
    }
    if (!busca || !botTypeInputNative(busca, cfg.huntName)) {
      botLog('error','✗ Campo de busca da Hunt não está pronto');return false;
    }
    botLog("info", `🔎 ${cfg.huntName}`);
    await botJitter(800, 1500);
    const resultado = await botEsperarAte(() => botFindHuntResult(cfg.huntName), 8500);
    if (!resultado) { botLog("error", `✗ ${cfg.huntName} não achado`); return false; }
    await botJitter(300, 800);
    if (!botClick(resultado)) {botLog('error','✗ Clique no resultado da Hunt falhou');return false;}
    botLog("success", "✓ Resultado");
    const conf = await botEsperarAte(() => botAcharH5(TEXTO_CONFIRMAR_HUNT) || botFindStartHuntButton(), 8500);
    if (!conf) { botLog("error", "✗ Iniciar não achado"); return false; }
    await botJitter(400, 900);
    if (!botClick(conf)) {botLog('error','✗ Clique em Iniciar Hunt falhou');return false;}
    botLog("success", "✓ Iniciar");
    // Na Party aguarda a confirmacao dos participantes pelo jogo.
    // Party: contar apenas tentativas com prontidao observada.
    // Sem janela ou com perda de conexao, nao presumir cancelamento.
    let partyReadyObserved = false;
    const comecou = await botEsperarAte(() => {
      if (botIsPartyLeader() && !partyReadyObserved) {
        partyReadyObserved = [...document.querySelectorAll('h5')].some(h =>
          !h.closest('#stonegy-tm-overlay') && botVisible(h) &&
          botNormalize(h.textContent) === 'CONFIRMACAO DE PRONTIDAO');
      }
      return botInHunt();
    }, botIsPartyLeader() ? 60000 : 6000);
    if (!comecou) {
      if (partyReadyObserved && !botFindConnectionLostPanel())
        window.__emerickPartyGate?.onInviteFailed?.();
      botLog("error", "✗ Hunt não iniciou"); return false;
    }
    if (botIsPartyLeader()) window.__emerickPartyGate?.onInviteStarted?.();
    botLogAndToast("flow", "✓ Em hunt");
    if (botIsPartyLeader()) {
      // Party: o posicionamento vem antes do Lure.
      // O monitor abaixo aguarda a selecao nativa do quadrado.
      emHuntPriority.stage='position';
      return true;
    }
    // Solo: mantem exatamente a sequencia que ja funcionava.
    await botJitter(1000, 2000);
    await botExecutarAjustarLure();
    return true;
  }

  // ==================== PARTY: POSICAO > LURE > BESTIARIO ====================
  function botPartyPostHuntTick() {
    const gate = window.__emerickPartyGate;
    if (!gate?.enabled || !gate.isLeader) {
      if (!emPartyAfterHunt.running) {
        emPartyAfterHunt.seen=false;
        emPartyAfterHunt.done=false;
        emHuntPriority.active=false;
        emHuntPriority.stage='idle';
      }
      return;
    }
    const hunting=botInHunt();
    if (!hunting) {
      if (emPartyAfterHunt.seen && !emPartyAfterHunt.running) {
        emPartyAfterHunt.seen=false;
        emPartyAfterHunt.done=false;
        emPartyAfterHunt.failures=0;
        emPartyAfterHunt.nextTry=0;
        emHuntPriority.active=false;
        emHuntPriority.stage='idle';
      }
      return;
    }
    if (!emPartyAfterHunt.seen) {
      emPartyAfterHunt.seen=true;
      emPartyAfterHunt.done=false;
      emPartyAfterHunt.failures=0;
      emPartyAfterHunt.nextTry=0;
      emHuntPriority.stage='position';
      emHuntPriority.active=true;
      botLog('flow','📍 Party: aguardando posicionamento antes do Lure');
    }
    if (emPartyAfterHunt.done || emPartyAfterHunt.running) return;
    // Enquanto nao se posicionar, NAO entrar no Lure nem no Bestiary.
    if (gate.positionPending || gate.readyPending) {
      emHuntPriority.active=true;
      emHuntPriority.stage='position';
      return;
    }
    if (!BOT_CONFIG.botAtivo || botHuntAsyncRunning || botBusy || botGetFlow() ||
        botConnLostActive || botInactivityActive || Date.now()<emPartyAfterHunt.nextTry)
      return;
    emPartyAfterHunt.running=true;
    emHuntPriority.active=true;
    emHuntPriority.stage='lure';
    botLog('flow','🎯 Party: posição definida; agora ajustando Lure');
    botExecutarAjustarLure().then(ok => {
      if (!botInHunt() || !botIsPartyLeader()) return;
      if (ok) {
        emPartyAfterHunt.done=true;
        emHuntPriority.stage='done';
        emHuntPriority.active=false;
        botLog('success','✓ Party: posição e Lure concluídos; Bestiary liberado');
      } else {
        emPartyAfterHunt.failures++;
        emPartyAfterHunt.nextTry=Date.now()+12000;
        emHuntPriority.stage='lure-retry';
        emHuntPriority.active=true;
        botLog('warn','⚠ Lure não concluído; nova tentativa em 12s (Bestiary aguarda)');
      }
    }).catch(e => {
      emPartyAfterHunt.failures++;
      emPartyAfterHunt.nextTry=Date.now()+12000;
      emHuntPriority.stage='lure-retry';
      emHuntPriority.active=true;
      botLog('error','✗ Lure Party: '+String(e?.message||e));
    }).finally(() => { emPartyAfterHunt.running=false; });
  }

  // ==================== FLUXO ASYNC DE TREINO ====================
  async function botEsperarTreino(ms) {
    const inicio = Date.now();
    let ultimoLog = Date.now();
    while (Date.now() - inicio < ms) {
      if (botFindConnectionLostPanel()) return false;
      const flow = botGetFlow();
      if (!flow || flow.etapa !== "AGUARDANDO_TREINAR") return false;
      const elapsed = Date.now() - inicio;
      const restante = ms - elapsed;
      if (Date.now() - ultimoLog > 30 * 60 * 1000) {
        const restMin = Math.max(1, Math.round(restante / 60000));
        botLog("info", `⏳ Treino · faltam ${Math.floor(restMin/60)}h${String(restMin%60).padStart(2,"0")}`);
        ultimoLog = Date.now();
      }
      await botEsperar(5000);
    }
    return true;
  }

  async function botExecutarTreino() {
    const jaTreinando = botFindFinalizarTreinoButton();
    if (jaTreinando) {
      botLog("warn", "⚠ Treino já em andamento · encerrar");
      await botJitter(600, 1200);
      botClick(jaTreinando);
      await botJitter(1000, 2000);
      return true;
    }

    if (botInHunt()) {
      botLog("info", "🚪 Saindo da hunt para treinar");
      const fimHunt = botAcharH5(TEXTO_FINALIZAR_HUNT) ?? botFindAnyTextMulti(["FINALIZAR HUNT", "FINALIZAR"]);
      if (fimHunt) {
        botClick(fimHunt);
        await botEsperarAte(() => !botInHunt(), 10000);
        await botJitter(1200, 2000);
        if (botInHunt()) {
          botLog("warn", "⚠ Ainda em hunt após tentar sair");
        } else {
          botLog("success", "✓ Fora da hunt");
        }
      } else {
        botLog("warn", "⚠ Botão Finalizar Hunt não achado · tentando prosseguir");
      }
    }

    const horas = BOT_CONFIG.trainingHours;
    botLog("info", `🏋 Treinar ${horas}h`);

    let painelModos = botFindGameModePanel();
    if (!painelModos) {
      const explorar = botFindPlayButton();
      if (!explorar) { botLog("error", "✗ EXPLORER não achado"); return false; }
      botLog("info", "▶ Abrir modos");
      await botJitter(500, 1200);
      botClick(explorar);
      painelModos = await botEsperarAte(() => botFindGameModePanel(), 6000);
      if (!painelModos) { botLog("error", "✗ Painel de modos não abriu"); return false; }
    }

    await botJitter(400, 900);
    const trainingBtn = botFindTrainingModeButton();
    if (!trainingBtn) { botLog("error", "✗ Training não achado"); return false; }
    botClick(trainingBtn);
    botLog("info", "▶ Training");

    const startBtn = await botEsperarAte(() => botFindStartTrainingButton(), 2500);
    if (startBtn) {
      await botJitter(400, 900);
      botClick(startBtn);
      botLog("info", "▶ START TRAINING");
    } else {
      botLog("info", "ℹ Botão START TRAINING não apareceu · seguindo direto");
    }

    const finalizar = await botEsperarAte(() => botFindFinalizarTreinoButton(), 8000);
    if (!finalizar) { botLog("error", "✗ Treino não iniciou"); return false; }

    const durMs = horas * 60 * 60 * 1000;
    botTrainingStartedAt = Date.now();
    botTrainingTotalMs = durMs;
    botLogAndToast("flow", `🏋 Em treino · ${horas}h`);
    botUpdatePanel();

    const ok = await botEsperarTreino(durMs);
    botTrainingStartedAt = 0;
    botTrainingTotalMs = 0;
    botUpdatePanel();
    if (!ok) { botLog("warn", "⏹ Treino interrompido"); return false; }

    await botJitter(600, 1200);
    const btnFim = botFindFinalizarTreinoButton();
    if (!btnFim) { botLog("error", "✗ Finalizar Treino não achado"); return false; }
    botClick(btnFim);
    botLogAndToast("flow", "✓ Treino concluído");
    await botJitter(1000, 2000);
    return true;
  }

  const botFindHuntCard = (huntName) => {
    const wanted = botNormalize(huntName); if (!wanted) return null;
    const words = wanted.split(" ").filter((w) => w.length >= 3);
    const candidates = [];
    for (const el of __sgGetNodes()) {
      if (!botVisible(el)) continue;
      if (el.closest("#stonegy-tm-overlay")) continue;
      const text = botNormalize(el.textContent || ""); if (!text) continue;
      let score = null;
      if (text.includes(wanted)) {
        const excess = text.length - wanted.length;
        if (excess > 200) continue;
        score = excess * 100;
      } else if (words.length >= 2) {
        let lastIndex = -1, ok = true;
        for (const w of words) { const idx = text.indexOf(w, lastIndex + 1); if (idx === -1) { ok = false; break; } lastIndex = idx; }
        if (!ok) continue;
        const excess = text.length - wanted.length;
        if (excess > 250) continue;
        score = excess * 100 + 500;
      } else continue;
      const rawText = (el.textContent || "").trim();
      if (rawText.length < 3) continue;
      let clickableDepth = 12, cur = el;
      for (let i = 0; i < 8 && cur; i++, cur = cur.parentElement) {
        if (cur instanceof HTMLElement) {
          if (cur.tagName === "BUTTON" || cur.getAttribute?.("role") === "button") { clickableDepth = Math.min(clickableDepth, i); break; }
          const cs = getComputedStyle(cur);
          if (cs.cursor.includes("pointer")) { clickableDepth = Math.min(clickableDepth, i); break; }
        }
      }
      let depth = 0; cur = el; while ((cur = cur.parentElement)) depth += 1;
      candidates.push({ element: el, clickableDepth, score: score + clickableDepth * 10 + depth * 0.01 });
    }
    if (!candidates.length) return null;
    const clickable = candidates.filter((c) => c.clickableDepth < 8);
    const pool = clickable.length ? clickable : candidates;
    pool.sort((a, b) => a.score - b.score);
    return pool[0].element;
  };

  const botFindStartHuntButton = () => {
    for (const el of document.querySelectorAll("button, [role=button], div, span, a, h5")) {
      if (!botVisible(el)) continue;
      if (el.closest("#stonegy-tm-overlay")) continue;
      const t = botNormalize(el.textContent || "");
      if (t === "INICIAR HUNT" || t === "START HUNT") return el;
    }
    for (const el of document.querySelectorAll("button, [role=button], div, span, a, h5")) {
      if (!botVisible(el)) continue;
      if (el.closest("#stonegy-tm-overlay")) continue;
      const t = botNormalize(el.textContent || "");
      if (t.includes("INICIAR HUNT") || t.includes("START HUNT")) return el;
    }
    return null;
  };

  const botFindConcluirLureButton = () => botAcharH5(TEXTO_CONCLUIR_LURE) ?? botFindAnyTextMulti(["CONCLUIR", "CONFIRMAR"]);

  // v6.2.36: usar apenas controles pertencentes a VENDA RAPIDA.
  // O jogo pode mostrar 0 / 6: seis itens na mochila, nenhum selecionado.
  const botQuickSellModal = () => {
    const modal = document.querySelector('[data-guide="quick-sell-modal"]');
    return modal && botVisible(modal) && !modal.closest('#stonegy-tm-overlay') ? modal : null;
  };
  const botQuickSellSelected = () => {
    const modal = botQuickSellModal();
    if (!modal) return null;
    for (const p of modal.querySelectorAll('p')) {
      const label = botNormalize(p.textContent || '');
      const match = /^SELECIONADOS\s*:\s*(\d+)\s*\/\s*(\d+)$/.exec(label);
      if (match) return { selected: Number(match[1]), total: Number(match[2]) };
    }
    return null; // UI desconhecida: nunca assumir lista vazia.
  };
  const botFindCancelButton = () => {
    const flow = botGetFlow();
    if (!flow || !['AGUARDANDO_PAINEL','AGUARDANDO_VERIFICAR',
      'AGUARDANDO_VENDER','AGUARDANDO_FECHAR_VENDA'].includes(flow.etapa)) return null;
    const modal = botQuickSellModal();
    // Nunca procurar CANCELAR solto na pagina, especialmente na Party.
    if (!modal) return null;
    const labels = [...modal.querySelectorAll('h5,button,[role="button"]')].filter(el =>
      botVisible(el) && botNormalize(el.textContent || '') === 'CANCELAR');
    const buttons = [...new Set(labels.map(el =>
      el.closest('.highlight-animation') || el.closest('button,[role="button"]'))
      .filter(el => el && botVisible(el) && modal.contains(el)))];
    return buttons.length === 1 ? buttons[0] : null;
  };
  const botBeginSaleClose = (reason) => {
    const cancel = botFindCancelButton();
    if (!cancel) return false;
    // Clique no elemento nativo .highlight-animation, sem subir para outro
    // ancestral cursor:pointer (pode ser o wrapper, sem handler React).
    try { cancel.click(); }
    catch(_) { return false; }
    botLog('flow', `🚪 ${reason} · CANCELAR da venda rapida`);
    botSaleCloseClickAt = Date.now();
    botSaleCloseAttempts = 1;
    botSaleHiddenSince = 0;
    botSetFlow('AGUARDANDO_FECHAR_VENDA');
    return true;
  };
  const botSaleReturnedHome = () =>
    !botQuickSellModal() && !botSellPanelOpen() &&
    Boolean(botFindPlayButton() || botFindGameModePanel());
  const botSaleFinish = () => {
    if (botSellPendingSuccess) {
      botRefilStats.sellCount += 1;
      botSaveRefilStats();
      botSellPendingSuccess = false;
      botLog('flow', `🛒 Venda #${botRefilStats.sellCount}`);
    }
    botSellRetryCount = 0;
    botSellLastClickAt = 0;
    botSaleCloseClickAt = 0;
    botSaleCloseAttempts = 0;
    botSaleHiddenSince = 0;
    botLogAndToast('flow', '✓ Loja fechada · Play/Explore liberado');
    botSetFlow('AGUARDANDO_CHECAR_STAMINA');
  };

  const botListSignature = () => { const parts = []; for (const node of document.querySelectorAll("button,[role=button],a,h1,h2,h3,h4,h5,h6,p,span,label")){ if (!botVisible(node)) continue; const t = botNormalize(node.textContent || ""); if (t.length > 3 && t.length < 120) parts.push(t); if (parts.length >= 80) break; } return parts.join("|"); };
  const botFindPageArrow = (direction) => {
    const target = direction === "prev" ? ["LEFT","<","ARROWLEFT"] : ["RIGHT",">","ARROWRIGHT"];
    const all = [...document.querySelectorAll("button,[role=button],svg,[data-testid],span,div")].filter(botVisible);
    const cands = all.filter((el)=>{
      if (el.disabled) return false;
      if (el.getAttribute?.("aria-disabled") === "true") return false;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.width > 100 || r.height < 12 || r.height > 100) return false;
      const v = `${botNormalize(botTextValue(el))} ${botNormalize(el.getAttribute("data-testid")||"")} ${botNormalize(el.getAttribute("aria-label")||"")}`;
      return target.some((k)=>v.includes(k));
    });
    if (!cands.length) return null;
    return cands.sort((a,b)=>{ const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return direction === "prev" ? ra.left - rb.left : rb.right - ra.right; })[0];
  };
  const botNextPage = () => {
    if (botWaitingPage) return false;
    if (Date.now() - botLastPageChange < BOT_PAGE_COOLDOWN_MS) return false;
    const arrow = botFindPageArrow("next") || botFindPageArrow("prev");
    if (!arrow) return false;
    const before = botListSignature();
    if (!botClick(arrow.parentElement || arrow)) return false;
    botLastPageChange = Date.now(); botWaitingPage = true;
    const started = Date.now();
    const check = () => { const changed = botListSignature() !== before; if (changed || Date.now() - started > BOT_PAGE_TIMEOUT_MS){ botWaitingPage = false; return; } setTimeout(check, 200); };
    setTimeout(check, 250);
    return true;
  };

  const botGetFlow = () => { try { const flow = JSON.parse(localStorage.getItem(BOT_FLOW_KEY) || "null"); if (!flow || !flow.timestamp || Date.now() - flow.timestamp > BOT_FLOW_TTL) { localStorage.removeItem(BOT_FLOW_KEY); return null; } return flow; } catch(_) { return null; } };
  const botSetFlow = (step) => {
    try {
      const prev = botGetFlow();
      const prevStep = prev ? prev.etapa : null;
      localStorage.setItem(BOT_FLOW_KEY, JSON.stringify({ etapa: step, timestamp: Date.now() }));
      if (prevStep !== step) botLog("flow", `🔄 ${prevStep ? flowLabel(prevStep) : "início"} → ${flowLabel(step)}`);
    } catch(_) {}
  };
  const botClearFlow = (reason) => {
    try {
      const prev = botGetFlow();
      if (prev && prev.etapa) botLog("info", `⏹ Fim${reason ? " · " + reason : ""}`);
      if (prev && prev.etapa) { botLastAbortFrom = prev.etapa; botLastAbortAt = Date.now(); }
    } catch(_) {}
    localStorage.removeItem(BOT_FLOW_KEY);
    botBusy = false; botPanelWaitStart = 0; botVerifyUntil = 0; botProtectAttempts = 0;
    botSellLastClickAt = 0; botSellRetryCount = 0;
    botSaleCloseClickAt = 0; botSaleCloseAttempts = 0; botSaleHiddenSince = 0;
    botLastWrongCount = -1; botStagnantCycles = 0;
    botPage = 0; botWaitingPage = false;
  };
  const botResetRecoveryCounters = () => { botRecoveryCount = 0; botLastRecoveryStep = null; };
  // Party e Solo podem apresentar sinais diferentes da mesma hunt.
  // O jogo exibe Hunt Time e Max durante a caçada; não depender apenas
  // do botão Finalizar Hunt (que pode ficar oculto em Party).
  const botInHunt = () => Boolean(
    botAcharH5(TEXTO_FINALIZAR_HUNT) ||
    (() => {
      const signals = [...document.querySelectorAll('p')].filter(p =>
        !p.closest('#stonegy-tm-overlay') && botVisible(p)).map(p => (p.textContent || '').trim());
      return signals.some(s => /^Hunt\s*Time:\s*\d{1,3}:\d{2}:\d{2}$/i.test(s));
    })()
  );

  // ==================== INATIVIDADE ====================
  const botFindInactivityPanel = () => {
    const exactPhrases = ["INATIVIDADE DETECTADA", "INATIVIDADE DETECTADO", "AFK DETECTADO", "INACTIVITY DETECTED", "AFK DETECTED", "VOCE FOI DESCONECTADO POR INATIVIDADE", "VOCE ESTA INATIVO", "DETECTAMOS INATIVIDADE"];
    const el = botFindAnyTextMulti(exactPhrases);
    if (el) return el;
    const lazy = botFindAnyTextMulti(["INATIVIDADE"]);
    if (lazy && botFindResumeButton()) return lazy;
    return null;
  };
  const botFindResumeButton = () => botFindAnyTextMulti(["RETOMAR", "RESUME", "CONTINUAR", "VOLTAR", "RETOMAR JOGO", "RETOMAR HUNT"]);
  const botHandleInactivity = () => {
    // Membros da Party usam protecao/reconexao Solo, mas nao iniciam hunt.
    if (!BOT_CONFIG.botAtivo && !window.__emerickPartyGate?.enabled) return false;
    const panel = botFindInactivityPanel();
    if (!panel) {
      if (botInactivityActive) { botInactivityActive = false; botLogAndToast("success", "✓ Retomado"); }
      return false;
    }
    if (!botInactivityActive) { botInactivityActive = true; botLog("warn", "⚠ AFK!"); botLogAndToast("flow", "⚠ AFK detectado"); }
    if (Date.now() - botLastResumeClick < BOT_RESUME_COOLDOWN_MS) return false;
    const resume = botFindResumeButton();
    if (!resume) { botLog("warn", "⚠ AFK · RETOMAR não achado"); return false; }
    botLastResumeClick = Date.now();
    botLog("info", "→ RETOMAR");
    botClick(resume);
    const flow = botGetFlow();
    if (flow) botSetFlow(flow.etapa);
    botLastActivity = Date.now();
    return true;
  };

  // ==================== INVENTÁRIO ====================
  const botInjectInventoryStyles = () => {
    const existing = document.querySelector("#stonegy-inv-styles");
    if (existing && existing.parentNode) return;
    const head = document.head || document.documentElement;
    if (!head) { setTimeout(botInjectInventoryStyles, 200); return; }
    const style = document.createElement("style");
    style.id = "stonegy-inv-styles";
    style.type = "text/css";
    style.textContent = `
      .stonegy-item-holder-slot.stonegy-inv-protected { position: relative !important; }
      .stonegy-item-holder-slot.stonegy-inv-protected::before {
        content: "" !important; position: absolute !important;
        top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important;
        background: radial-gradient(circle at center, rgba(0,0,0,.10) 0%, rgba(0,0,0,.28) 100%) !important;
        border-radius: 3px !important; pointer-events: none !important; z-index: 99998 !important;
      }
      .stonegy-item-holder-slot.stonegy-inv-protected::after {
        content: "" !important; position: absolute !important;
        top: 50% !important; left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 60% !important; height: 60% !important;
        max-width: 28px !important; max-height: 28px !important;
        min-width: 16px !important; min-height: 16px !important;
        background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%237e77d7' stroke='%23000' stroke-width='1.2' stroke-linejoin='round' d='M12 1.5 4 5v6c0 5.2 3.4 9.9 8 11.5 4.6-1.6 8-6.3 8-11.5V5l-8-3.5z'/%3E%3Cpath fill='%23e1ddff' d='M12 7.5a2.2 2.2 0 0 0-2.2 2.2v.8h-.5a.7.7 0 0 0-.7.7v3.6c0 .4.3.7.7.7h5.4c.4 0 .7-.3.7-.7v-3.6a.7.7 0 0 0-.7-.7h-.5v-.8A2.2 2.2 0 0 0 12 7.5zm0 1.2c.55 0 1 .45 1 1v.8h-2v-.8c0-.55.45-1 1-1z'/%3E%3C/svg%3E") !important;
        background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important;
        filter: drop-shadow(0 0 3px rgba(150,139,255,.45)) drop-shadow(0 1px 2px rgba(0,0,0,.65)) !important;
        pointer-events: none !important; z-index: 99999 !important; opacity: .62 !important;
      }
      body.stonegy-capture-mode, body.stonegy-capture-mode * { cursor: crosshair !important; }
      body.stonegy-capture-mode .stonegy-item-holder-slot { outline: 1px dashed #9a91ff !important; outline-offset: 1px !important; }
    `;
    head.appendChild(style);
  };

  const botFindInventoryItems = () => {
    const items = [];
    const seen = new Set();
    const slots = document.querySelectorAll(".stonegy-item-holder-slot");
    for (const slot of slots) {
      if (slot.closest("#stonegy-tm-overlay")) continue;
      if (!botVisible(slot)) continue;
      const labelEl = slot.querySelector("[aria-label], img[alt]");
      if (!labelEl) continue;
      const name = (labelEl.getAttribute("aria-label") || labelEl.getAttribute("alt") || "").trim();
      if (!name || name.length > 80) continue;
      if (seen.has(slot)) continue;
      seen.add(slot);
      items.push({ name, slot });
    }
    return items;
  };
  const botClearInventoryMarkers = () => { document.querySelectorAll(".stonegy-inv-protected").forEach((el) => el.classList.remove("stonegy-inv-protected")); };
  const botApplyInventoryMarkers = () => {
    if (!BOT_CONFIG.showInventoryMarkers) { botClearInventoryMarkers(); return; }
    if (botSellPanelOpen()) return;
    const list = (BOT_CONFIG.protectedItems || []).map(botNormalize).filter(Boolean);
    const items = botFindInventoryItems();
    for (const item of items) {
      const isProtected = list.some((w) => botNormalize(item.name).includes(w));
      if (isProtected) {
        item.slot.classList.add("stonegy-inv-protected");
        if (!item.slot.style.position) item.slot.style.position = "relative";
      } else {
        item.slot.classList.remove("stonegy-inv-protected");
      }
    }
  };
  const botIsCaptureOn = () => Boolean(botInvCaptureHandler);
  const botToggleInvCapture = () => {
    if (botInvCaptureHandler) {
      document.removeEventListener("click", botInvCaptureHandler, true);
      document.removeEventListener("contextmenu", botInvCaptureHandler, true);
      document.removeEventListener("keydown", botInvCaptureHandler, true);
      botInvCaptureHandler = null;
      document.body.classList.remove("stonegy-capture-mode");
      botLog("info", "📷 Capt OFF");
      botUpdatePanel();
      return false;
    }
    botInvCaptureHandler = (e) => {
      if (e.type === "keydown" && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); botToggleInvCapture(); return; }
      if (e.type === "contextmenu") { e.preventDefault(); e.stopImmediatePropagation(); botToggleInvCapture(); return; }
      if (e.type === "click" && !e.isTrusted) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some((n) => n && n.id === STONEGY_HOST_ID)) return;
      const el = e.target;
      if (!el || !el.closest) return;
      const slot = el.closest(".stonegy-item-holder-slot");
      if (!slot) return;
      const labelEl = slot.querySelector("[aria-label], img[alt]");
      if (!labelEl) return;
      const name = (labelEl.getAttribute("aria-label") || labelEl.getAttribute("alt") || "").trim();
      if (!name) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (Date.now() - botLastInvToggleAt < 250) return;
      botLastInvToggleAt = Date.now();
      const v = name;
      const existingIdx = BOT_CONFIG.protectedItems.findIndex((it) => botNormalize(it) === botNormalize(v));
      if (existingIdx >= 0) { BOT_CONFIG.protectedItems.splice(existingIdx, 1); botLog("warn", `− ${v}`); }
      else { BOT_CONFIG.protectedItems.push(v); botLog("success", `+ ${v}`); }
      botSaveConfig();
      slot.style.transition = "transform .15s ease";
      slot.style.transform = "scale(1.15)";
      setTimeout(() => { slot.style.transform = ""; }, 170);
      botApplyInventoryMarkers();
      botUpdatePanel();
    };
    document.addEventListener("click", botInvCaptureHandler, true);
    document.addEventListener("contextmenu", botInvCaptureHandler, true);
    document.addEventListener("keydown", botInvCaptureHandler, true);
    document.body.classList.add("stonegy-capture-mode");
    botLog("info", "📷 Capt ON · ESC p/ sair");
    botUpdatePanel();
    return true;
  };

  // ==================== ITENS (sell panel) ====================
  // Estado de VENDA RAPIDA: o botao de entrada na loja NAO e a loja aberta.
  // Todos os modos (Solo, Party e AFK) usam o mesmo motor e a mesma deteccao.
  const botSellPanelOpen = () => Boolean(botQuickSellModal());
  const botSellPanelReady = () => {
    const modal=botQuickSellModal();
    if (!modal) return false;
    const svgs=modal.querySelectorAll(`svg[data-testid="${ICON_PROTECTED}"],svg[data-testid="${ICON_UNPROTECTED}"]`);
    if ([...svgs].some(botVisible)) return true;
    // Sem icones renderizados, CANCELAR ainda confirma que o modal terminou de abrir.
    return [...modal.querySelectorAll('h5')].some(h => botVisible(h) && botNormalize(h.textContent)==='CANCELAR');
  };
  const botFindAllSellItems = () => {
    const items = [];
    const seen = new Set();
    const modal=botQuickSellModal();
    if (!modal) return items;
    const nodes = modal.querySelectorAll("[aria-label]");
    for (const node of nodes) {
      if (node.closest("#stonegy-tm-overlay")) continue;
      if (!botVisible(node)) continue;
      const name = node.getAttribute("aria-label") || "";
      if (!name || name.length > 80) continue;
      let wrapper = null, svg = null;
      let cur = node;
      for (let i = 0; i < 12 && cur; i++) {
        if (cur.querySelector) {
          const found = cur.querySelector(`svg[data-testid="${ICON_PROTECTED}"], svg[data-testid="${ICON_UNPROTECTED}"]`);
          if (found) { wrapper = cur; svg = found; break; }
        }
        cur = cur.parentElement;
      }
      if (!wrapper || !svg) continue;
      if (seen.has(wrapper)) continue;
      seen.add(wrapper);
      const state = svg.getAttribute("data-testid");
      const slot = wrapper.querySelector(".stonegy-item-holder-slot") || wrapper;
      const amountEl = wrapper.querySelector(".stonegy-item-holder-amount");
      const amount = amountEl ? Math.max(1, parseInt(amountEl.textContent, 10) || 1) : 1;
      items.push({ name, node, wrapper, slot, svg, iconParent: svg.parentElement, state, isProtected: state === ICON_PROTECTED, amount });
    }
    return items;
  };
  const botHasSellableItems = () => {
    const all = botFindAllSellItems();
    return all.some((it) => !it.isProtected);
  };
  const botHardClick = (el) => {
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width * (0.5 + (Math.random() - 0.5) * 0.25);
      const cy = r.top + r.height * (0.5 + (Math.random() - 0.5) * 0.25);
      const base = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
      const pointerOpts = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
      try { el.dispatchEvent(new PointerEvent("pointerdown", pointerOpts)); } catch(_) {}
      try { el.dispatchEvent(new MouseEvent("mousedown", base)); } catch(_) {}
      try { el.dispatchEvent(new PointerEvent("pointerup", pointerOpts)); } catch(_) {}
      try { el.dispatchEvent(new MouseEvent("mouseup", base)); } catch(_) {}
      try { el.dispatchEvent(new MouseEvent("click", base)); } catch(_) {}
      return true;
    } catch(_) { try { el.click(); return true; } catch(__) { return false; } }
  };
  const botIntentKey = (name, shouldProtect) => botNormalize(name) + "|" + (shouldProtect ? "P" : "U");
  const botClearIntent = (name) => {
    botPendingIntent.delete(botNormalize(name) + "|P");
    botPendingIntent.delete(botNormalize(name) + "|U");
  };
  const botClickProtectToggle = (item, shouldProtect) => {
    const key = botIntentKey(item.name, shouldProtect);
    const last = botPendingIntent.get(key) || 0;
    if (Date.now() - last < BOT_INTENT_COOLDOWN_MS) return false;
    botPendingIntent.set(key, Date.now());
    const targets = [item.wrapper, item.slot, item.iconParent].filter(Boolean);
    for (const t of targets) {
      if (!botVisible(t)) continue;
      botHardClick(t);
      return true;
    }
    return false;
  };
  const botSyncItemsToProtectedList = () => {
    const list = (BOT_CONFIG.protectedItems || []).map(botNormalize).filter(Boolean);
    const all = botFindAllSellItems();
    let protectedCount = 0, unprotectedCount = 0, noopCount = 0, skippedIntent = 0;
    let acted = false;
    const actions = [];
    for (const item of all) {
      const shouldProtect = list.some((w) => botNormalize(item.name).includes(w));
      if (shouldProtect === item.isProtected) { botClearIntent(item.name); noopCount += 1; continue; }
      if (acted) { noopCount += 1; continue; }
      const key = botIntentKey(item.name, shouldProtect);
      const last = botPendingIntent.get(key) || 0;
      if (Date.now() - last < BOT_INTENT_COOLDOWN_MS) { skippedIntent += 1; continue; }
      if (shouldProtect && !item.isProtected) {
        if (botClickProtectToggle(item, true)) { protectedCount += 1; actions.push({ name: item.name, action: "🔒" }); acted = true; }
      } else if (!shouldProtect && item.isProtected && BOT_CONFIG.unprotectExtras) {
        if (botClickProtectToggle(item, false)) { unprotectedCount += 1; actions.push({ name: item.name, action: "🔓" }); acted = true; }
      } else noopCount += 1;
    }
    return { protectedCount, unprotectedCount, noopCount, skippedIntent, total: all.length, actions, acted };
  };
  const botAllItemsInCorrectState = () => {
    const list = (BOT_CONFIG.protectedItems || []).map(botNormalize).filter(Boolean);
    const all = botFindAllSellItems();
    const wrong = [];
    for (const item of all) {
      const shouldProtect = list.some((w) => botNormalize(item.name).includes(w));
      if (shouldProtect !== item.isProtected) {
        if (!shouldProtect && !BOT_CONFIG.unprotectExtras) continue;
        wrong.push({ name: item.name, shouldProtect, isProtected: item.isProtected, item });
      }
    }
    return { ok: wrong.length === 0, wrong, total: all.length };
  };
  const botFindSellConfirmButton = () => {
    const modal=botQuickSellModal();
    if (!modal) return null;
    const list = modal.querySelectorAll("button,[role=button],a,div,span,h5,h4,h6");
    const exact = ["VENDER","SELL","CONFIRMAR","CONFIRM","CONCLUIR","FINALIZAR","VENDER ITENS","VENDER SELECIONADOS","VENDER TUDO","VENDER TODOS","CONFIRMAR VENDA","CONFIRM SELL","ACEITAR","VENDER ITEM"];
    for (const el of list) {
      if (!botVisible(el)) continue;
      if (el.closest("#stonegy-tm-overlay")) continue;
      const t = botNormalize(el.textContent || "");
      if (!t || t.length > 40) continue;
      if (t.includes("RAPIDA") || t.includes("RÁPIDA")) continue;
      if (exact.includes(t)) {
        const r = el.getBoundingClientRect();
        if (r.width > 300 || r.height > 100) continue;
        if (r.width < 40 || r.height < 18) continue;
        return el;
      }
    }
    return null;
  };
  const botApplyVisualMarkers = () => {
    if (!botSellPanelOpen()) return;
    const list = (BOT_CONFIG.protectedItems || []).map(botNormalize).filter(Boolean);
    const all = botFindAllSellItems();
    for (const item of all) {
      const should = list.some((w) => botNormalize(item.name).includes(w));
      const target = item.slot || item.node;
      if (!target) continue;
      const correct = (should === item.isProtected) || (!should && !BOT_CONFIG.unprotectExtras && item.isProtected);
      if (correct && should) { target.style.outline = "2px solid #22c55e"; target.style.outlineOffset = "1px"; }
      else if (!correct) { target.style.outline = "3px solid #dc2626"; target.style.outlineOffset = "1px"; }
      else { target.style.outline = ""; target.style.outlineOffset = ""; }
    }
  };

  // ==================== ESTABILIZAÇÃO ====================
  const botScreenKeySignature = () => {
    const sigs = [];
    if (botFindConnectionLostPanel()) sigs.push("CONEXAO");
    if (botFindInactivityPanel()) sigs.push("INATIVIDADE");
    if (botSellPanelOpen()) sigs.push("PAINELVENDA");
    if (botTreinando()) sigs.push("TREINANDO");
    if (botFindGameModePanel()) sigs.push("MODOSJOGO");
    const single = botFindAnyTextMulti(["VENDA RÁPIDA", "VENDA RAPIDA", "VENDER RÁPIDA", "SELL", "VENDER ITENS", "VENDER SELECIONADOS", "CONFIRMAR VENDA", "PLAY", "EXPLORE", "EXPLORAR", "EXPLORE HUNT", "EXPLORAR HUNT", "FINALIZAR HUNT", "FINALIZAR", "JOGAR"]);
    if (single) {
      const t = botNormalize(botTextValue(single));
      if (/VENDA\s*R[ÁA]PIDA|VENDER\s*R[ÁA]PIDA/.test(t)) sigs.push("VENDARAPIDA");
      else if (/^SELL$/.test(t)) sigs.push("VENDARAPIDA");
      else if (/VENDER\s*(ITENS|SELECIONADOS)|CONFIRMAR\s*VENDA/.test(t)) sigs.push("VENDER");
      else if (/^PLAY$/.test(t)) sigs.push("PLAY");
      else if (/^JOGAR$/.test(t)) sigs.push("JOGAR");
      else if (/EXPLORE|EXPLORAR/.test(t)) sigs.push("EXPLORE");
      else if (/FINALIZAR/.test(t)) sigs.push("FINALIZARHUNT");
    }
    return sigs.join("|");
  };
  const botScreenIsStable = () => {
    const sig = botScreenKeySignature();
    if (sig !== botScreenSig) { botScreenSig = sig; botScreenSigSince = Date.now(); return false; }
    return (Date.now() - botScreenSigSince) >= BOT_SCREEN_SETTLE_MS;
  };
  const botDecideNextStep = () => {
    if (botConnLostActive) return null;
    if (botInactivityActive) return null;
    if (botInHunt()) return null;
    if (botTreinando()) return afk.enabled ? null : botIsPartyLeader() ? null : "AGUARDANDO_TREINAR";
    if (botSellPanelOpen()) return "AGUARDANDO_PAINEL";
    if (botFindAnyTextMulti(["VENDA RÁPIDA", "VENDA RAPIDA", "VENDER RÁPIDA", "SELL"])) return "AGUARDANDO_VENDA";
    if (botFindGameModePanel()) return "AGUARDANDO_CHECAR_STAMINA";
    if (botFindPlayButton()) return "AGUARDANDO_CHECAR_STAMINA";
    if (botFindAnyTextMulti(["JOGAR", "PLAY", "EXPLORE", "EXPLORAR", "EXPLORE HUNT", "EXPLORAR HUNT"])) return "AGUARDANDO_CHECAR_STAMINA";
    return null;
  };
  const botAutoRecover = () => {
    if (botConnLostActive) return;
    if (botInactivityActive) return;
    const flow = botGetFlow();
    const step = flow ? flow.etapa : "(nenhum)";
    if (botLastRecoveryStep === step) botRecoveryCount += 1;
    else { botRecoveryCount = Math.max(1, botRecoveryCount); botLastRecoveryStep = step; }
    if (botRecoveryCount > BOT_RECOVERY_MAX_ATTEMPTS * 3) {
      botLog("error", `⏱ Recovery falhou · pausa ${BOT_RESTART_COOLDOWN_MS/1000}s`);
      botClearFlow("recovery falhou"); botResetRecoveryCounters(); botRestartCooldownUntil = Date.now() + BOT_RESTART_COOLDOWN_MS;
      return;
    }
    if (step === "AGUARDANDO_INICIAR_HUNT" || step === "AGUARDANDO_TREINAR") {
      botLog("warn", `↻ Recovery ${flowLabel(step)}`);
      botClearFlow("recovery " + step); botResetRecoveryCounters();
      return;
    }
    if (!botScreenIsStable()) return;
    const next = botDecideNextStep();
    if (next) {
      botLog("info", `🔄 → ${flowLabel(next)}`);
      if (next === "AGUARDANDO_PAINEL") { botPanelWaitStart = Date.now(); botProtectAttempts = 0; }
      botSetFlow(next);
      return;
    }
    botLog("warn", "⚠ Tela desconhecida · limpar");
    botClearFlow("tela desconhecida"); botResetRecoveryCounters();
  };
  const botWatchdog = () => {
    if (!BOT_CONFIG.botAtivo || !botPartyAllowsHunt()) return;
    if (botConnLostActive) return;
    if (botTrainingAsyncRunning) return;
    const flow = botGetFlow(); if (!flow) return;
    const elapsed = Date.now() - flow.timestamp;
    const limit = BOT_STEP_TIMEOUTS[flow.etapa] || BOT_STEP_DEFAULT_TIMEOUT;
    if (elapsed > limit) {
      botLog("warn", `⏱ ${flowLabel(flow.etapa)} travado ${Math.round(elapsed / 1000)}s/${Math.round(limit / 1000)}s`);
      botAutoRecover();
    }
  };

  // ==================== BESTIARIO EMERICKST (STONEGY ONLY) ====================
  // Implementacao independente baseada no comportamento observavel da interface do Stonegy.
  // Somente a aba Bestiario controla estas rotinas; a logica do bot nao foi modificada.
  const EM_BESTIARY_KEY = "emerickst_bestiary_settings_v1";
  const EM_BESTIARY_PAUSE_KEY = "emerickst_bestiary_paused_v2";
  const emBestiary = {
    results: [], busy: false, status: "idle", message: "Entre em uma hunt para consultar o Bestiario.",
    auto: false, enabled: false, inHunt: false, scanned: false, lastCheckedAt: 0, lastSignature: "",
    startingAt: 0, generation: 0, openedByUs: false, nextAutoAttempt: 0, priorityWaitMs: 900
  };
  try { emBestiary.auto = JSON.parse(localStorage.getItem(EM_BESTIARY_KEY) || "{}").auto === true; } catch (_) {}

  try {
    emBestiary.enabled =
      localStorage.getItem(EM_BESTIARY_PAUSE_KEY) === "0";
  } catch (_) {}
  // Ao iniciar Bestiario, acompanhar automaticamente: o usuario nao
  // precisa habilitar um segundo checkbox escondido.
  if (emBestiary.enabled) emBestiary.auto = true;

  const emSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const emNorm = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  const emVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  };
  const emLeaf = (root, label) => {
    if (!root) return null;
    const wanted = emNorm(label);
    return [...root.querySelectorAll("h4,h5,h6,p,span,button,div")].find(el =>
      el.childElementCount === 0 && emVisible(el) && emNorm(el.innerText || el.textContent) === wanted
    ) || null;
  };
  const emWait = async (fn, ms=2200) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      let found = null;
      try { found = fn(); } catch (_) {}
      if (found) return found;
      await emSleep(140);
    }
    return null;
  };
  const emHuntMonsters = () => {
    const title = [...document.querySelectorAll("h5")].find(el =>
      emVisible(el) && emNorm(el.textContent) === "MONSTERS"
    );
    const list = title?.nextElementSibling;
    if (!list) return [];
    const monsters = [];
    const names = new Set();
    for (const entry of list.children) {
      const name = (entry.children[0]?.textContent || "").trim();
      const rawKills = (entry.children[1]?.textContent || '').trim();
      // Ler apenas o primeiro numero, sem colar dois contadores como 2/100.
      const killMatch = rawKills.match(/^(?:[^\d]*)(\d[\d.,]*)/);
      const kills = killMatch ? Number.parseInt(killMatch[1].replace(/[.,]/g,''),10) : NaN;
      if (!name || names.has(emNorm(name))) continue;
      names.add(emNorm(name));
      monsters.push({ name, kills: Number.isFinite(kills) ? kills : null });
    }
    return monsters;
  };
  const emIsHunt = () => botInHunt();
  const emGameLoading = () => [...document.querySelectorAll("h4,h5,h6,p,span")].some(el =>
    el.childElementCount === 0 && emVisible(el) && /^CARREGANDO( COMBATE)?|^LOADING( COMBAT)?/i.test(emNorm(el.textContent))
  );
  const emPediaRoot = () => {
    const label = emLeaf(document, "Bestiary");
    if (!label) return null;
    let el = label;
    for (let i = 0; i < 12 && el; i++, el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.width >= 380 && r.height >= 280) return el;
    }
    return null;
  };
  const emPediaIcon = () => {
    const mail = document.querySelector('[data-testid="MailOutlineIcon"]');
    if (!mail || !emVisible(mail)) return null;
    const rect = mail.getBoundingClientRect();
    // Nao usa deslocamento absoluto: identifica o proximo SVG visivel na mesma faixa.
    const peers = [...document.querySelectorAll("svg")].filter(el => {
      if (!emVisible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.left > rect.left + 5 && Math.abs(r.top - rect.top) <= 20 && r.left - rect.right < 135;
    });
    peers.sort((a,b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return peers[0] || null;
  };
  const emSafeClick = (element) => {
    if (!element || !emVisible(element)) return false;
    // SVGElement nao implementa necessariamente .click(). O Stonegypedia usa SVG puro.
    // Dispara uma UNICA sequencia de clique, sem duplicar o evento "click".
    if (element instanceof SVGElement) {
      const r = element.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, view: window,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
      try { element.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerId: 1, pointerType: "mouse", isPrimary: true })); } catch (_) {}
      element.dispatchEvent(new MouseEvent("mousedown", opts));
      try { element.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerId: 1, pointerType: "mouse", isPrimary: true })); } catch (_) {}
      element.dispatchEvent(new MouseEvent("mouseup", opts));
      element.dispatchEvent(new MouseEvent("click", opts));
      return true;
    }
    return botClick(element);
  };
  // Prioridade: hunt/venda > confirmacao > lure > posicionamento > Bestiary.
  // Este bloqueio tambem e checado DURANTE a consulta, nao apenas antes.
  const emPriorityBlocked = () => {
    if (emHuntPriority.active) return 'Lure/inicio de Hunt ainda em andamento.';
    const gate = window.__emerickPartyGate;
    if (gate?.enabled && gate.positionPending) return 'Aguardando a posição da Party.';
    if (gate?.enabled && gate.readyPending) return 'Aguardando a confirmação da Party.';
    if (gate?.enabled && [...document.querySelectorAll('h5')].some(el =>
      botVisible(el) && botNormalize(el.textContent) === 'CONFIRMACAO DE PRONTIDAO'))
      return 'Aguardando a confirmação da Party.';
    if (gate?.enabled && [...document.querySelectorAll('button[aria-label^="Selecionar posição "]')].some(botVisible))
      return 'Aguardando o posicionamento da Party.';
    return '';
  };
  const emScanBlocked = () => {
    if (!emIsHunt()) return "A consulta esta disponivel durante uma hunt.";
    const priority = emPriorityBlocked();
    if (priority) return priority;
    if (emGameLoading()) return "Aguardando a tela do jogo terminar de carregar.";
    if (botBusy || botHuntAsyncRunning || botTrainingAsyncRunning || botGetFlow()) {
      return "Aguardando o ciclo de hunt, venda ou treinamento ficar livre.";
    }
    if (botConnLostActive || botInactivityActive) return "Aguardando reconexao ou retorno da inatividade.";
    if (botSellPanelOpen()) return "Feche o painel de vendas antes de consultar.";
    const competingDialog = [...document.querySelectorAll('[role="dialog"],[aria-modal="true"]')]
      .some(el => emVisible(el) && !el.closest("#stonegy-tm-overlay"));
    if (competingDialog) return "Feche outros modais antes de consultar o Bestiario.";
    return "";
  };
  const emProgress = (raw) => {
    const match = /^\s*([\d.,]+)\s*\/\s*([\d.,]+)\s*$/.exec(raw || "");
    if (!match) return null;
    const have = Number.parseInt(match[1].replace(/[.,]/g, ""), 10);
    const total = Number.parseInt(match[2].replace(/[.,]/g, ""), 10);
    return Number.isSafeInteger(have) && Number.isSafeInteger(total) && have >= 0 && total > 0 ? { have, total } : null;
  };
  const emProgressInDetails = (name) => {
    const modal = emPediaRoot();
    const title = emLeaf(modal, name);
    if (!title) return null;
    let current = title;
    for (let i = 0; i < 8 && current && modal.contains(current); i++, current = current.parentElement) {
      const segments = [...current.querySelectorAll("[aria-label]")]
        .map(el => emProgress(el.getAttribute("aria-label"))?.total ? el.getAttribute("aria-label") : null)
        .filter(Boolean);
      if (segments.length) return emProgress(segments[segments.length - 1]);
    }
    return null;
  };
  const emSearchInput = () => {
    const root = emPediaRoot();
    if (!root) return null;
    return [...root.querySelectorAll("input")].find(el =>
      emVisible(el) && /type to search/i.test(el.getAttribute("placeholder") || "")
    ) || null;
  };
  const emSelectBestiary = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const root = emPediaRoot();
      const tab = emLeaf(root, "Bestiary");
      if (tab) emSafeClick(tab);
      const ready = await emWait(() => {
        const modal = emPediaRoot();
        return emSearchInput() && !emLeaf(modal, "Categories:");
      }, 1750);
      if (ready) return true;
      await emSleep(280);
    }
    return false;
  };
  const emCreatureTile = (name) => {
    const root = emPediaRoot();
    if (!root) return null;
    const input = emSearchInput();
    return [...root.querySelectorAll("h4,h5,h6,p,span,div,button,label,a")].find(el =>
      el !== input && el.childElementCount === 0 && emVisible(el) && emNorm(el.textContent) === emNorm(name)
    ) || null;
  };
  const emReadOneCreature = async (monster) => {
    const input = emSearchInput();
    if (!input) return null;

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, "value"
    )?.set;

    if (setter) setter.call(input, monster.name);
    else input.value = monster.name;

    input.dispatchEvent(new Event("input", { bubbles: true }));

    const tile = await emWait(
      () => emCreatureTile(monster.name),
      1800
    );

    if (!tile) return null;

    // Espera a imagem da criatura aparecer no card.
    const icon = (await emWait(() => {
      const found = emCreatureTile(monster.name);
      let node = found;

      for (
        let depth = 0;
        node && depth < 4;
        depth++, node = node.parentElement
      ) {
        const img = node.querySelector("img");
        const src = img?.currentSrc || img?.src || "";

        if (/^(https?:\/\/|data:image\/|blob:)/i.test(src)) {
          return src;
        }
      }

      return null;
    }, 1200)) || "";

    if (!emSafeClick(tile)) {
      return icon ? { icon, error: true } : null;
    }

    const progress = await emWait(
      () => emProgressInDetails(monster.name),
      2200
    );

    const back = emLeaf(emPediaRoot(), "Back");
    if (back) emSafeClick(back);

    await emSleep(170);

    return progress
      ? {
          ...progress,
          icon,
          complete: progress.have >= progress.total
        }
      : { icon, error: true };
  };
  const emFormatEta = (duration) => {
    if (!Number.isFinite(duration) || duration < 0) return "";
    const minutes = Math.max(1, Math.round(duration / 60000));
    if (minutes < 60) return `~${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `~${hours}h${minutes % 60 ? String(minutes % 60).padStart(2,"0") + "min" : ""}` : `~${Math.floor(hours/24)}d`;
  };
  const emEstimateEta = (item) => {
    if (item.error || item.complete || !Number.isFinite(item.firstSeenAt)) return "";
    const elapsed = Date.now() - item.firstSeenAt;
    const gain = item.killsAtCheck - item.firstSeenKills;
    if (elapsed < 60000 || gain < 3 || !Number.isFinite(gain)) return "Calculando...";
    if (elapsed > 30 * 60 * 1000 && gain < 3) return "Sem estimativa";
    const remaining = Math.max(0, item.total - item.have);
    return emFormatEta((remaining * elapsed) / gain);
  };
  const emRenderBestiary = () => {
    const root = botRoot;
    if (!root) return;
    const view = root.querySelector("[data-bestiary-view]");
    if (!view || view.hidden) return;
    const status = view.querySelector("[data-bestiary-status]");
    const auto = view.querySelector("[data-bestiary-auto]");
    const refresh = view.querySelector("[data-bestiary-refresh]");
    const toggle = view.querySelector("[data-bestiary-toggle]");
    const rows = view.querySelector("[data-bestiary-rows]");
    if (!status || !rows) return;
    const inHunt = emIsHunt();
    status.textContent = !emBestiary.enabled
      ? "Bestiário parado."
      : emBestiary.busy
        ? "Consultando Stonegypedia..."
        : emBestiary.message;
    status.dataset.state = !emBestiary.enabled
      ? "paused"
      : emBestiary.busy ? "loading" : emBestiary.status;

    if (toggle) {
      toggle.textContent = emBestiary.enabled
        ? "⏸ Parar"
        : "▶ Iniciar";

      toggle.dataset.running = String(emBestiary.enabled);
      toggle.setAttribute(
        "aria-pressed",
        String(emBestiary.enabled)
      );
    }
    if (auto) {
      auto.checked = emBestiary.auto;
      auto.disabled = !emBestiary.enabled;
    }
    if (refresh) {
      refresh.disabled =
        !emBestiary.enabled || emBestiary.busy || !inHunt;
    }
    if (!inHunt) {
      rows.innerHTML = '<div class="bestiary-empty">Entre em uma hunt para acompanhar as criaturas.</div>';
      return;
    }
    if (!emBestiary.results.length) {
      rows.innerHTML = '<div class="bestiary-empty">Nenhuma criatura consultada. Clique em Atualizar para buscar o progresso real.</div>';
      return;
    }
    rows.innerHTML = emBestiary.results.map(item => {
      const pct = item.error ? 0 : Math.min(100, Math.round(100 * item.have / item.total));
      const count = item.error ? "Não encontrado" : `${item.have.toLocaleString("pt-BR")} / ${item.total.toLocaleString("pt-BR")}`;
      const eta = item.error ? "Tente atualizar novamente" : item.complete ? "Concluído ✓" : `${pct}% • ${emEstimateEta(item) || "Aguardando dados"}`;
      const image = item.icon && (/^(https?:\/\/|data:image\/|blob:)/i.test(item.icon))
        ? `<img class="bestiary-avatar" src="${escapeAttr(item.icon)}" alt="" loading="lazy">`
        : '<span class="bestiary-avatar bestiary-placeholder">✦</span>';
      return `<article class="bestiary-card">${image}<div class="bestiary-info"><div class="bestiary-title"><b>${escapeHtml(item.name)}</b><span>${count}</span></div><div class="bestiary-track"><i class="${item.complete ? "done" : ""}" style="width:${pct}%"></i></div><small>${eta}</small></div></article>`;
    }).join("");
  };
  const emRefreshBestiary = async () => {
    if (!emBestiary.enabled || emBestiary.busy) return;
    const blocked = emScanBlocked();
    if (blocked) {
      emBestiary.message = blocked;
      emBestiary.status = "waiting";
      emRenderBestiary();
      return;
    }
    const monsters = emHuntMonsters();
    if (!monsters.length) {
      emBestiary.status = "waiting";
      emBestiary.message = "Aguardando a lista Monsters no Hunt Analyzer.";
      emRenderBestiary();
      return;
    }
    // Nao tomar controle de um Stonegypedia que ja estava aberto pelo usuario ou outra extensao.
    if (emPediaRoot()) {
      emBestiary.status = "waiting";
      emBestiary.message = "Feche o Stonegypedia aberto antes de atualizar.";
      emRenderBestiary();
      return;
    }
    emBestiary.inHunt = true; // O tick nao deve apagar uma consulta manual iniciada antes do primeiro polling.
    emBestiary.busy = true;
    window.__emerickBestiaryBusy = true;
    emBestiary.status = "loading";
    emBestiary.message = "Consultando...";
    emRenderBestiary();
    const captured = [];
    const run = ++emBestiary.generation;
    let opened = false;
    try {
      const icon = emPediaIcon();
      if (!icon || !emSafeClick(icon)) throw new Error("Ícone do Stonegypedia não encontrado.");
      opened = Boolean(await emWait(emPediaRoot, 2500));
      if (!opened) throw new Error("Stonegypedia não abriu.");
      emBestiary.openedByUs = true;
      if (!await emSelectBestiary()) throw new Error("A aba Bestiary não abriu.");
      for (const monster of monsters) {
        if (!emBestiary.enabled || run !== emBestiary.generation || !emIsHunt() ||
            botBusy || botGetFlow() || botHuntAsyncRunning || botTrainingAsyncRunning || emPriorityBlocked())
          throw new Error('Consulta adiada: o fluxo principal retomou.');
        let progress = await emReadOneCreature(monster);
        if (!progress?.total &&
          emBestiary.enabled &&
          run === emBestiary.generation
        ) {
          progress = await emReadOneCreature(monster);
        }

        if (!emBestiary.enabled || run !== emBestiary.generation || emPriorityBlocked() || !emIsHunt())
          throw new Error('Consulta adiada: hunt, lure ou posição em andamento.');
        const previous = emBestiary.results.find(item => emNorm(item.name) === emNorm(monster.name) && !item.error);
        const snapshot = { name: monster.name, killsAtCheck: monster.kills,
          firstSeenAt: previous?.firstSeenAt || Date.now(),
          firstSeenKills: Number.isFinite(previous?.firstSeenKills) ? previous.firstSeenKills : monster.kills };
        captured.push(progress?.total
          ? {
              ...snapshot,
              ...progress,
              icon: progress.icon || previous?.icon || "",
              error: false
            }
          : {
              ...snapshot,
              icon: progress?.icon || previous?.icon || "",
              error: true
            });
      }
      if (
        !emBestiary.enabled ||
        run !== emBestiary.generation
      ) return;

      if (!captured.length) throw new Error("Consulta interrompida. Tente novamente em um momento seguro.");
      emBestiary.results = captured;
      emBestiary.scanned = true;
      emBestiary.lastCheckedAt = Date.now();
      emBestiary.status = "done";
      emBestiary.message = `Atualizado às ${new Date().toLocaleTimeString("pt-BR")}. Valores entre consultas são estimados.`;
    } catch (error) {
      emBestiary.status = 'waiting';
      emBestiary.message = error?.message || 'Consulta adiada; tentarei novamente quando estiver seguro.';
      emBestiary.scanned = false;
      emBestiary.nextAutoAttempt = Date.now()+15000;
      console.warn('[EmerickST Bestiario]', error);
    } finally {
      // Nunca fechar um modal desconhecido. Fechar apenas o Stonegypedia que abrimos.
      if (opened && emBestiary.openedByUs && emPediaRoot()) {
        // Fechar apenas quando nao existe prontidao nativa simultanea.
        const readiness = [...document.querySelectorAll('h5')].some(el =>
          botVisible(el) && botNormalize(el.textContent)==='CONFIRMACAO DE PRONTIDAO');
        if (!readiness) document.dispatchEvent(new KeyboardEvent('keydown',
          { key:'Escape', code:'Escape', bubbles:true, cancelable:true }));
      }
      emBestiary.openedByUs = false;
      emBestiary.busy = false;
      window.__emerickBestiaryBusy = false;
      emRenderBestiary();
    }
  };
  const emBestiaryTick = () => {
    if (!emBestiary.enabled) return;
    const inHunt = emIsHunt();
    if (!inHunt) {
      if (emBestiary.inHunt) {
        emBestiary.results = [];
        emBestiary.scanned = false;
        emBestiary.generation += 1;
        emBestiary.status = "idle";
        emBestiary.message = "Entre em uma hunt para consultar o Bestiario.";
      }
      emBestiary.inHunt = false;
      emRenderBestiary();
      return;
    }
    if (!emBestiary.inHunt) {
      emBestiary.inHunt = true;
      emBestiary.startingAt = Date.now();
      emBestiary.scanned = false;
      emBestiary.results = [];
      emBestiary.status = "idle";
      emBestiary.message = "Hunt detectada. Aguardando posição e Lure antes da consulta.";
    }
    if (emBestiary.results.length && !emBestiary.busy) {
      const live = emHuntMonsters();
      for (const item of emBestiary.results) {
        if (item.error || item.complete || !Number.isFinite(item.killsAtCheck)) continue;
        const now = live.find(m => emNorm(m.name) === emNorm(item.name));
        if (!Number.isFinite(now?.kills)) continue;
        const diff = now.kills - item.killsAtCheck;
        if (diff > 0) {
          item.have = Math.min(item.total, item.have + diff);
          item.killsAtCheck = now.kills;
          item.complete = item.have >= item.total;
        } else if (diff < 0) {
          // Reset de contador: nao subtrair mortes da estimativa.
          item.killsAtCheck = now.kills;
          item.firstSeenAt = Date.now();
          item.firstSeenKills = now.kills;
          emBestiary.message = "Contador de kills reiniciado. Atualize para confirmar o Bestiario.";
        }
      }
    }
    // Bestiary executa apos as etapas anteriores serem CONCLUIDAS.
    // Sem espera arbitraria por "fluxo livre": emPriorityBlocked determina a ordem.
    if (emBestiary.auto && !emBestiary.busy && !emBestiary.scanned &&
        Date.now()-emBestiary.startingAt >= emBestiary.priorityWaitMs &&
        Date.now() >= emBestiary.nextAutoAttempt && !emScanBlocked() && emHuntMonsters().length) {
      emBestiary.nextAutoAttempt = Date.now() + 15000; // Intervalo minimo entre falhas e tentativas automaticas.
      emRefreshBestiary().catch(error => console.warn("[EmerickST Bestiario]", error));
    }
    emRenderBestiary();
  };

  // ==================== UI ====================
  function createPanel(){
    if (document.querySelector("#stonegy-tm-overlay")) return;
    const host = document.createElement("div");
    host.id = STONEGY_HOST_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    botRoot = shadow;

    const staminaOptions = Array.from({length:13},(_,i)=>`<option value="${i}">${i}h</option>`).join("");
    const trainingOptions = Array.from({length:9},(_,i)=>`<option value="${i+4}">${i+4}h</option>`).join("");

    shadow.innerHTML = `<style>:host{all:initial}
.panel{position:fixed;z-index:2147483647;top:92px;right:18px;width:330px;max-height:calc(100dvh - 104px);overflow:hidden;background:rgba(18,21,28,.97);border:1px solid #d5a64d;border-radius:10px;color:#f6f2e9;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px #0008;display:flex;flex-direction:column}
.panel.collapsed{width:auto}.panel.collapsed #body{display:none}
.panel.mini{
  width:48px !important;height:48px !important;min-width:48px !important;max-width:48px !important;
  max-height:48px !important;border-radius:50% !important;overflow:hidden !important;
  top:auto !important;bottom:18px !important;right:18px !important;left:auto !important;
  cursor:pointer !important;transition:transform .18s ease, box-shadow .18s ease;
}
.panel.mini:hover{transform:scale(1.06);box-shadow:0 0 20px rgba(213,166,77,.6),0 8px 28px #0008}
.panel.mini #body{display:none !important}
.panel.mini header{padding:0 !important;width:48px;height:48px;display:flex;justify-content:center;align-items:center;background:transparent !important;border-radius:50%;cursor:pointer}
.panel.mini header > span,
.panel.mini header .header-btns{display:none !important}
.panel.mini header::after{
  content:"";width:16px;height:16px;border-radius:50%;
  background:var(--mini-color,#64748b);
  box-shadow:0 0 12px var(--mini-color,#64748b),0 0 24px var(--mini-color,#64748b);
  animation:sgMiniPulse 2s ease-in-out infinite;
}
@keyframes sgMiniPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.85}}
header{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#45351a;color:#ffe3a0;font-weight:700;cursor:move;font-size:13px;gap:6px}
header > span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.header-btns{display:flex;gap:3px;flex-shrink:0}
header button{border:1px solid #8e7040;border-radius:4px;background:#352917;color:#ffe4a2;padding:2px 5px;cursor:pointer;font:inherit;line-height:1;font-size:10px;min-width:20px;transition:all .15s ease}
header button:hover{background:#4a3920;transform:translateY(-1px)}
header button:active{transform:translateY(0)}
#body{display:flex;flex:1 1 auto;min-height:0;flex-direction:column;overflow:hidden}
.tabs{display:flex;gap:2px;flex-wrap:wrap;padding:6px 10px 0;border-bottom:1px solid #ffffff14}
.tab{border:0;background:transparent;color:#8b95a1;font-size:10px;font-weight:600;padding:5px 7px 6px;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s ease, border-color .15s ease}
.tab:hover{color:#cbd5e1}
.tab.active{color:#ffe4a2;border-bottom-color:#d5a64d}
.controls{display:flex;gap:6px;padding:7px 10px;align-items:center}
.controls #total{flex:1;color:#8b95a1;font-size:10px;line-height:1.3}
.controls button{border:1px solid #8e7040;border-radius:5px;background:#352917;color:#ffe4a2;padding:3px 8px;cursor:pointer;font:inherit;font-size:10px;transition:all .15s ease}
.controls button:hover{background:#4a3920;transform:translateY(-1px)}
.rows{overflow-y:auto;max-height:230px;padding:4px 10px}
.row{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #ffffff0f;cursor:pointer;font-size:12px;transition:background .15s ease}
.row:hover{background:rgba(255,255,255,.03)}
.row small{color:#8b95a1;font-size:10px}.value{color:#fff0b8;font-weight:700}
.pct{color:#e7b85d;font-weight:700;font-size:11px;margin-left:2px}
.detail{margin:4px 0 6px 8px;padding:4px 8px;border-left:2px solid #8e7040;color:#cbd3dc;font-size:11px}
.type{display:flex;justify-content:space-between;gap:8px}
.dmg-label{display:inline-flex;align-items:center;gap:2px}
.dmg-icon{font-style:normal;margin-right:5px;font-size:12px;line-height:1;display:inline-block;vertical-align:-1px}
.share{height:3px;background:#ffffff14;margin:3px 0 5px;border-radius:2px;overflow:hidden}
.share i{display:block;height:100%;background:#e7b85d}
.empty{color:#8b95a1;font-size:11px;padding:10px 0}
.best{color:#ffe49b;font-size:10px;display:flex;justify-content:space-between;padding:2px 0}
.chart{padding:4px 10px 8px}.chart label{display:flex;justify-content:space-between;color:#8b95a1;font-size:10px;margin-bottom:2px}
.chart canvas{width:100%;height:56px}
.bot-view,.loot-view{padding:0 0 10px;overflow-y:auto;max-height:calc(100dvh - 200px)}
.status-bar{display:flex;align-items:center;gap:7px;padding:8px 12px;background:#141820;border-bottom:1px solid #ffffff0f;font-size:10px;min-width:0}
.status-dot{width:7px;height:7px;border-radius:50%;background:#64748b;flex-shrink:0;transition:all .3s ease}
.status-dot[data-state=active]{background:#22c55e;box-shadow:0 0 6px #22c55e}
.status-dot[data-state=waiting]{background:#f59e0b;box-shadow:0 0 6px #f59e0b;animation:sgPulse 1.4s infinite}
.status-dot[data-state=off]{background:#ef4444}
.status-dot[data-state=inactive]{background:#fbbf24;animation:sgPulse .9s infinite}
.status-dot[data-state=error]{background:#ef4444;animation:sgPulse .5s infinite}
@keyframes sgPulse{0%,100%{opacity:1}50%{opacity:.3}}
.status-text{font-weight:700;color:#e5e7eb;white-space:nowrap;font-size:10px;letter-spacing:.02em;transition:color .2s ease}
.status-flow{color:#7c8695;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
.training-bar{display:none;align-items:center;gap:8px;padding:8px 12px;background:linear-gradient(90deg,#1e3a5f,#2a4a75);border-bottom:1px solid #3f94c8}
.training-bar.on{display:flex}
.training-bar .tt-icon{font-size:14px}
.training-bar .tt-label{color:#93c5fd;font-weight:700;letter-spacing:.06em;font-size:10px}
.training-bar .tt-time{margin-left:auto;color:#e0f2fe;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;font-weight:700;letter-spacing:.05em}

/* ============ HUNT STATUS (lê do jogo) ============ */
.hunt-status{display:none;padding:9px 12px;background:linear-gradient(135deg,#0f172a,#1a2332);border-bottom:1px solid #ffffff14}
.hunt-status.on{display:block}
.hunt-status-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.hunt-status-name{color:#fbbf24;font-size:11px;font-weight:800;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.hunt-status-times{color:#cbd5e1;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;flex-shrink:0;font-weight:600}
.hunt-status-times strong{color:#e0f2fe;font-weight:700}
.hunt-status-track{height:6px;background:#0a0f19;border-radius:3px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}
.hunt-status-fill{height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:3px;transition:width .8s linear, background .4s ease;box-shadow:0 0 8px rgba(34,197,94,.55)}
.hunt-status-fill.mid{background:linear-gradient(90deg,#f59e0b,#fbbf24);box-shadow:0 0 8px rgba(245,158,11,.55)}
.hunt-status-fill.high{background:linear-gradient(90deg,#ef4444,#f87171);box-shadow:0 0 8px rgba(239,68,68,.6)}
.hunt-status-foot{margin-top:5px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#7c8695;letter-spacing:.03em}
.hunt-status-foot strong{color:#93c5fd;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}

.field-grid{display:grid;grid-template-columns:1fr 62px;gap:7px;padding:9px 12px 6px}
.field-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:0 12px 8px}
.field{display:flex;flex-direction:column;gap:3px;min-width:0}
.field-label{color:#8b95a1;font-size:8px;font-weight:800;letter-spacing:.08em}
.field input,.field select{width:100%;border:1px solid #ffffff1a;border-radius:6px;background:#1e2328;color:#ffe4a2;padding:6px 8px;font:inherit;font-size:11px;outline:none;box-sizing:border-box;user-select:text !important;-webkit-user-select:text !important;cursor:text !important;pointer-events:auto !important;transition:border-color .15s ease, box-shadow .15s ease}
.field select{cursor:pointer !important}
.field input:focus,.field select:focus{border-color:#d5a64d;box-shadow:0 0 0 2px #d5a64d33}
.field input.empty-warning{
  border-color:#dc2626 !important;
  box-shadow:0 0 0 2px rgba(220,38,38,.2) !important;
  animation:sgEmptyWarn 1.5s ease-in-out infinite;
}
@keyframes sgEmptyWarn{
  0%,100%{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.2)}
  50%{border-color:#f87171;box-shadow:0 0 0 3px rgba(220,38,38,.35)}
}
.hunt-hint{display:none;margin:0 12px 8px;padding:6px 9px;border-radius:6px;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.35);color:#fca5a5;font-size:10px;line-height:1.35;text-align:center}
.hunt-hint.on{display:block}
.toggle-row{display:grid;grid-template-columns:1fr;gap:4px;padding:0 12px 8px}
.pill{display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 2px;border:1px solid #ffffff14;border-radius:5px;background:#ffffff05;color:#6b7280;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:all .2s ease}
.pill::before{content:"";width:5px;height:5px;border-radius:50%;background:#4b5563;transition:all .3s ease}
.pill:hover{border-color:#ffffff2a;transform:translateY(-1px)}
.pill:active{transform:translateY(0)}
.pill[data-on="true"]{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.4);color:#86efac}
.pill[data-on="true"]::before{background:#22c55e;box-shadow:0 0 4px #22c55e}
.card{margin:0 12px 8px;padding:8px 10px;border:1px solid #ffffff12;border-radius:8px;background:#ffffff05}
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px}
.card-head > span{color:#8b95a1;font-size:8px;font-weight:800;letter-spacing:.08em;flex:1}
.mini-group{display:flex;gap:4px}
.mini{padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;background:#166534;border:1px solid #22c55e;color:#bbf7d0;cursor:pointer;transition:all .15s ease;white-space:nowrap}
.mini:hover{background:#1a7a3f;transform:translateY(-1px)}
.mini:active{transform:translateY(0)}
.mini.capture{background:#1e3a8a;border-color:#3b82f6;color:#dbeafe}
.mini.capture:hover{background:#1e40af}
.mini.capture.active{background:#2563eb;border-color:#60a5fa;color:#fff;box-shadow:0 0 0 2px rgba(59,130,246,.4), 0 0 8px rgba(59,130,246,.6);animation:sgCapturePulse 1.4s infinite}
@keyframes sgCapturePulse{0%,100%{box-shadow:0 0 0 2px rgba(59,130,246,.4), 0 0 8px rgba(59,130,246,.6)}50%{box-shadow:0 0 0 3px rgba(59,130,246,.7), 0 0 14px rgba(59,130,246,.9)}}

/* ============ LISTA DE ITENS PROTEGIDOS ============ */
.bot-protected-wrap{position:relative}
.bot-protected-list{
  display:flex;flex-direction:column;gap:1px;
  max-height:110px;overflow-y:auto;
  padding:3px;border-radius:6px;
  background:#05080d;border:1px solid #ffffff0a;
  scrollbar-width:thin;
}
.bot-protected-list::-webkit-scrollbar{width:5px}
.bot-protected-list::-webkit-scrollbar-thumb{background:#ffffff1a;border-radius:3px}
.bot-protected-list::-webkit-scrollbar-track{background:transparent}
.bot-protected-item{
  display:flex;align-items:center;gap:6px;
  padding:3px 7px;border-radius:3px;
  background:rgba(34,197,94,.05);
  font-size:10px;font-weight:600;color:#86efac;
  transition:background .15s ease;
  min-width:0;line-height:1.2;
}
.bot-protected-item:hover{background:rgba(34,197,94,.14)}
.bot-protected-item .item-bullet{
  color:#22c55e;flex-shrink:0;font-size:6px;opacity:.7;
}
.bot-protected-item .item-name{
  flex:1;min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;
  letter-spacing:.01em;
}
.bot-protected-item .item-remove{
  background:transparent;border:0;
  color:#86efac;opacity:.5;cursor:pointer;
  padding:0 4px;font-size:12px;line-height:1;
  border-radius:3px;transition:all .15s ease;
  flex-shrink:0;font-family:inherit;
}
.bot-protected-item .item-remove:hover{
  opacity:1;color:#fecaca;background:rgba(220,38,38,.25);
}
.bot-protected-empty{
  color:#5c6673;font-size:9px;font-style:italic;
  text-align:center;padding:10px 8px;
}
.bot-protected-count{
  color:#7c8695;font-size:8px;margin-left:6px;
  font-weight:700;letter-spacing:.04em;
}
.bot-protected-wrap.has-overflow::after{
  content:"";position:absolute;
  left:0;right:6px;bottom:0;height:18px;
  background:linear-gradient(to bottom,transparent,#05080d);
  pointer-events:none;border-radius:0 0 5px 5px;
}

.enforce-row{display:flex;align-items:center;gap:7px;margin-top:7px;padding:6px 8px;border:1px solid #ffffff0f;border-radius:6px;background:#ffffff04;cursor:pointer;transition:background .15s ease}
.enforce-row:hover{background:#ffffff08}
.enforce-row input{accent-color:#22c55e;cursor:pointer;flex-shrink:0}
.enforce-row span{color:#8b95a1;font-size:9px;line-height:1.3}
.enforce-row span b{color:#86efac}
.capture-hint{margin-top:6px;padding:5px 8px;border:1px solid rgba(59,130,246,.35);border-radius:6px;background:rgba(59,130,246,.08);color:#93c5fd;font-size:9px;line-height:1.35;display:none}
.capture-hint.on{display:block}
.actions-1{display:grid;grid-template-columns:1fr;gap:6px;padding:8px 12px 4px}
.bot-action{width:100%;border:1px solid #ffffff1a;border-radius:6px;background:#ffffff0a;color:#d1d9e3;padding:6px 8px;font:inherit;font-size:10px;font-weight:600;cursor:pointer;transition:all .15s ease;box-sizing:border-box}
.bot-action:hover{background:#ffffff14;border-color:#ffffff2a;transform:translateY(-1px)}
.bot-action:active{transform:translateY(0)}
.bot-primary{background:#1e4a6b;border-color:#3f94c8;color:#e0f2fe}
.bot-primary:hover{background:#235e88}
.bot-success{background:#166534;border-color:#22c55e;color:#bbf7d0}
.bot-warn{background:#78350f;border-color:#f59e0b;color:#fde68a}
.bot-danger{background:#7f1d1d;border-color:#dc2626;color:#fecaca}
details.console{margin:0 12px 6px;border:1px solid #ffffff0f;border-radius:8px;background:#ffffff04;padding:6px 10px 0}
details.console summary{cursor:pointer;color:#8b95a1;font-size:9px;font-weight:800;letter-spacing:.08em;list-style:none;user-select:none;padding:2px 0 6px;display:flex;align-items:center;gap:5px}
details.console summary::-webkit-details-marker{display:none}
details.console summary::before{content:"▶";font-size:8px;transition:transform .2s ease;display:inline-block;color:#3f94c8}
details.console[open] summary::before{transform:rotate(90deg)}
.log-controls{display:flex;gap:4px;padding:0 0 6px;flex-wrap:wrap}
.log-filter{padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;background:#ffffff0a;border:1px solid #ffffff1a;color:#8b95a1;cursor:pointer;transition:all .15s ease;font-family:inherit}
.log-filter:hover{background:#ffffff14;transform:translateY(-1px)}
.log-filter:active{transform:translateY(0)}
.log-filter.active{background:#1e4a6b;border-color:#3f94c8;color:#e0f2fe}
.log-filter[data-log-filter="flow"]{background:rgba(56,189,248,.08);border-color:rgba(56,189,248,.4);color:#7dd3fc}
.log-filter[data-log-filter="flow"]:hover{background:rgba(56,189,248,.16)}
.log-filter[data-log-filter="flow"].active{background:#0369a1;border-color:#38bdf8;color:#e0f2fe;box-shadow:0 0 6px rgba(56,189,248,.55)}
.log-filter[data-log-filter="refil"]{background:rgba(168,85,247,.08);border-color:rgba(168,85,247,.4);color:#c4b5fd}
.log-filter[data-log-filter="refil"]:hover{background:rgba(168,85,247,.16)}
.log-filter[data-log-filter="refil"].active{background:#6b21a8;border-color:#a855f7;color:#f3e8ff;box-shadow:0 0 6px rgba(168,85,247,.55)}
.log-filter.clear{margin-left:auto;background:#7f1d1d;border-color:#dc2626;color:#fecaca}
.log-filter.clear:hover{background:#991b1b}
.log-rows{max-height:220px;overflow-y:auto;padding:5px 7px;background:#05080d;border:1px solid #ffffff0a;border-radius:6px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;scrollbar-width:thin;margin-bottom:6px}
.log-rows::-webkit-scrollbar{width:6px}
.log-rows::-webkit-scrollbar-thumb{background:#ffffff1a;border-radius:3px}
.log-line{display:flex;gap:6px;padding:2px 0;border-bottom:1px solid #ffffff06;word-break:break-word;transition:background .15s ease}
.log-line:last-child{border-bottom:0}
.log-latest{animation:sgLogFlash 1.2s ease-out}
@keyframes sgLogFlash{
  0%{background:rgba(56,189,248,.35);box-shadow:inset 3px 0 0 #38bdf8}
  60%{background:rgba(56,189,248,.10)}
  100%{background:transparent;box-shadow:inset 3px 0 0 transparent}
}
.log-time{color:#4b5563;flex-shrink:0;font-size:10px}
.log-msg{flex:1;min-width:0}
.log-line[data-level="info"] .log-msg{color:#cbd5e1}
.log-line[data-level="success"] .log-msg{color:#86efac}
.log-line[data-level="warn"] .log-msg{color:#fde68a}
.log-line[data-level="error"] .log-msg{color:#fca5a5}
.log-line[data-level="flow"]{background:rgba(56,189,248,.06);border-left:2px solid #38bdf8;padding-left:6px;margin-left:-2px}
.log-line[data-level="flow"] .log-msg{color:#7dd3fc;font-weight:600;letter-spacing:.01em}
.log-line[data-level="flow"] .log-time{color:#0ea5e9}
.log-refil-reset{cursor:pointer}
.log-refil-reset:hover{background:rgba(220,38,38,.08);border-left:2px solid #dc2626;padding-left:6px;margin-left:-2px}
.log-refil-reset:hover .log-msg{color:#fca5a5;text-decoration:underline}
.log-empty{color:#5c6673;font-size:10px;font-style:italic;text-align:center;padding:10px 0}

/* ==================== TOASTS ==================== */
.toast-container{
  position:fixed;bottom:20px;right:20px;z-index:2147483647;
  display:flex;flex-direction:column;gap:6px;
  pointer-events:none;align-items:flex-end;
  font-family:system-ui,-apple-system,sans-serif;
}
.toast{
  padding:9px 14px;border-radius:8px;
  font:12px/1.3 system-ui,-apple-system,sans-serif;font-weight:600;
  color:#fff;
  box-shadow:0 6px 20px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35);
  animation:sgToastIn .25s cubic-bezier(.4,.6,.4,1.2);
  max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  backdrop-filter:blur(6px);
}
.toast.leaving{animation:sgToastOut .3s ease-in forwards}
.toast.info{background:rgba(30,74,107,.95);border:1px solid #3f94c8;color:#e0f2fe}
.toast.success{background:rgba(22,101,52,.95);border:1px solid #22c55e;color:#dcfce7}
.toast.warn{background:rgba(120,53,15,.95);border:1px solid #f59e0b;color:#fef3c7}
.toast.error{background:rgba(127,29,29,.95);border:1px solid #dc2626;color:#fee2e2}
.toast.flow{background:rgba(3,105,161,.95);border:1px solid #38bdf8;color:#e0f2fe}
@keyframes sgToastIn{
  from{opacity:0;transform:translateY(12px) scale(.94)}
  to{opacity:1;transform:translateY(0) scale(1)}
}
@keyframes sgToastOut{
  from{opacity:1;transform:translateY(0) scale(1)}
  to{opacity:0;transform:translateY(-8px) scale(.96)}
}

/* ================= EMERICKST / NOCTURNE UI v6.2.6 =================
   Visual-only overrides. Preserve bot logic, selectors and data attributes.
   Palette: graphite / ink / soft violet / ice blue.
*/
:host {
  --em-bg: #0b0d14;
  --em-surface: #111522;
  --em-raised: #171b2a;
  --em-line: #292f43;
  --em-line-soft: #22283a;
  --em-text: #edf0fb;
  --em-muted: #929cb5;
  --em-accent: #aaa0ff;
  --em-ice: #83c9ed;
  --em-ok: #6bdbb5;
  color-scheme: dark;
}
.panel {
  width: 346px;
  color: var(--em-text);
  background: linear-gradient(170deg, rgba(21,25,40,.99), rgba(10,13,21,.99) 45%, rgba(11,14,23,.99));
  border: 1px solid #353b55;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.66), 0 0 0 1px rgba(160,153,255,.06) inset, 0 2px 0 rgba(180,190,255,.05) inset;
  font: 12px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.panel::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(90deg, transparent 0%, #6d78f7 23%, #aa8ef8 50%, #5cbedf 77%, transparent 100%);
  opacity: .9;
}
.panel.mini::before{height:0}
.panel.mini{background:#151929;border-color:#656a9c;box-shadow:0 6px 26px rgba(0,0,0,.55),0 0 0 3px rgba(151,139,255,.08)}
.panel.mini:hover{box-shadow:0 8px 28px rgba(0,0,0,.55),0 0 22px rgba(151,139,255,.3)}
header {
  position: relative;
  min-height: 42px;
  box-sizing: border-box;
  padding: 10px 11px;
  gap: 8px;
  background: linear-gradient(118deg, #191d31 0%, #151a2a 70%, #101827 100%);
  border-bottom: 1px solid var(--em-line);
  color: #f4f2ff;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: -.025em;
}
header::before {
  content:"E";
  display:grid;
  place-items:center;
  width:27px;height:27px;
  flex:none;
  border-radius:9px;
  background:linear-gradient(140deg,#746ded,#4a3f8d);
  border:1px solid rgba(198,196,255,.3);
  box-shadow:0 2px 9px rgba(87,77,203,.3),inset 0 1px 0 rgba(255,255,255,.14);
  color:#f6f3ff;
  font-size:13px;
  font-weight:900;
  letter-spacing:-.1em;
}
header > span{flex:1;min-width:0;flex-shrink:1;font-size:13px;letter-spacing:-.02em}
header > span .brand-accent{color:#b6aeff}
header > span::after{content:"  /  CONTROL";font:650 7px/1.3 ui-sans-serif,system-ui,sans-serif;letter-spacing:.09em;color:#727d9d;vertical-align:1px}
.header-btns{gap:4px}
header button {
  min-width:23px;
  height:22px;
  padding:2px 4px;
  background:rgba(255,255,255,.035);
  border:1px solid #353a52;
  border-radius:6px;
  color:#b2bddd;
  font-size:10px;
}
header button:hover{background:#292b49;border-color:#746fb4;color:#f2efff}
.panel.mini header::before{display:none}
.tabs {
  gap:4px;
  padding:9px 10px 8px;
  background:rgba(8,11,20,.36);
  border-bottom:1px solid var(--em-line-soft);
}
.tab {
  flex:1;
  padding:6px 5px;
  min-width:0;
  font-size:10px;
  font-weight:650;
  border:1px solid transparent;
  border-radius:7px;
  color:#929bbb;
  transition:background .15s,border-color .15s,color .15s;
}
.tab:hover{background:#22283a;color:#e5e8fa}
.tab.active{
  color:#d9d4ff;
  border:1px solid #514d82;
  background:linear-gradient(135deg,#302d54,#242844);
  box-shadow:0 1px 6px rgba(95,79,170,.14),inset 0 1px 0 rgba(255,255,255,.07);
}
.controls{padding:9px 11px;gap:6px}
.controls #total{color:#a4afc8;font-size:10px}
.controls button,.log-filter{
  border-radius:7px;
  border:1px solid #383f57;
  background:#1b2030;
  color:#c4cae4;
  font-size:10px;
  font-weight:650;
  padding:5px 8px;
}
.controls button:hover,.log-filter:hover{background:#292d48;border-color:#68669c;color:#f0edff}
.rows{padding:3px 12px 6px;scrollbar-width:thin;scrollbar-color:#3d4463 transparent}
.row{border-color:#252a3c;padding:9px 3px;font-size:11px}
.row:hover{background:rgba(147,135,252,.055)}
.row small,.empty{color:var(--em-muted)}
.value{color:#e1defe}
.pct{color:#91bfe6}
.detail{border-left:2px solid #6e69b2;color:#b5bfd7;background:#171a2b;border-radius:0 5px 5px 0;padding:6px 9px}
.share{height:4px;background:#252a3e}
.share i{background:linear-gradient(90deg,#7a83d8,#a89af3)}
.best{color:#c7bfff}
.chart{padding:9px 12px 12px;border-top:1px solid #24283b;background:rgba(9,12,22,.36)}
.chart label{color:#929fba;font-size:9px;margin-bottom:5px}
.bot-view,.loot-view{scrollbar-color:#3b4260 transparent;scrollbar-width:thin}
.status-bar{padding:10px 12px;background:rgba(17,22,34,.94);border-bottom:1px solid var(--em-line-soft)}
.status-dot{width:8px;height:8px;box-shadow:0 0 0 3px rgba(255,255,255,.035)}
.status-dot[data-state=active]{background:#6bdbb5;box-shadow:0 0 0 3px rgba(107,219,181,.13),0 0 9px rgba(107,219,181,.4)}
.status-dot[data-state=waiting],.status-dot[data-state=inactive]{background:#a49dff;box-shadow:0 0 0 3px rgba(164,157,255,.14),0 0 7px rgba(164,157,255,.3)}
.status-text{color:#e3e8fa;font-size:10px}
.status-flow{color:#8794b2}
.training-bar{background:linear-gradient(100deg,#202440,#1c3145);border-color:#374866}
.training-bar .tt-label{color:#a7b4ff}
.training-bar .tt-time{color:#d6efff}
.hunt-status{background:linear-gradient(135deg,#181e31,#131a2a);border-color:#2b344b}
.hunt-status-name{color:#c6bbff}
.hunt-status-times{color:#9ba8c4}
.hunt-status-times strong,.hunt-status-foot strong{color:#9fd2f3}
.hunt-status-foot{color:#94a0b9}
.hunt-status-track{background:#090c15;height:6px}
.hunt-status-fill{background:linear-gradient(90deg,#746de1,#8fc6ff);box-shadow:0 0 8px rgba(150,140,255,.34)}
.hunt-status-fill.mid{background:linear-gradient(90deg,#7876bf,#c0a4e3);box-shadow:0 0 8px rgba(163,151,222,.28)}
.hunt-status-fill.high{background:linear-gradient(90deg,#b7506d,#f48aa4);box-shadow:0 0 8px rgba(226,97,132,.3)}
.field-grid{padding:11px 12px 7px;gap:8px}
.field-grid-2{gap:8px;padding-bottom:9px}
.field{gap:5px}
.field-label,.card-head > span{color:#9da8c1;font-size:9px;letter-spacing:.085em}
.field input,.field select{
  background:#101522;
  border:1px solid #343b54;
  border-radius:8px;
  color:#e5e9ff;
  padding:8px 9px;
  font-size:11px;
}
.field input::placeholder{color:#636f8b}
.field input:hover,.field select:hover{border-color:#586087}
.field input:focus,.field select:focus{border-color:#8b83e7;box-shadow:0 0 0 3px rgba(136,124,235,.16)}
.field input.empty-warning{border-color:#d96b83 !important;box-shadow:0 0 0 2px rgba(217,107,131,.2) !important}
.hunt-hint{background:rgba(218,98,126,.09);border-color:rgba(218,98,126,.27);color:#f3a6b8}
.toggle-row{padding-bottom:10px}
.pill{padding:8px 4px;border-radius:9px;border:1px solid #34394f;background:#171b2a;color:#8d99b4;font-size:10px;letter-spacing:.09em}
.pill::before{width:7px;height:7px;background:#69738b}
.pill:hover{border-color:#8279bb;transform:translateY(-1px)}
.pill[data-on="true"]{background:linear-gradient(110deg,#17322f,#1b383b);border-color:#397a70;color:#98e6cb}
.pill[data-on="true"]::before{background:#6bdbb5;box-shadow:0 0 8px rgba(107,219,181,.7)}
.card{margin:0 12px 10px;padding:11px;border:1px solid #2b3349;border-radius:11px;background:linear-gradient(140deg,#171c2b,#141826);box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
.card-head{margin-bottom:10px}
.mini{padding:5px 8px;border-radius:6px;background:#24253d;border:1px solid #565284;color:#c9c4fa;font-size:9px}
.mini:hover{background:#313054;border-color:#8278c9}
.mini.capture{background:#1a2a3a;border-color:#466885;color:#adddfa}
.mini.capture:hover{background:#203c52}
.bot-protected-list,.log-rows{background:#0c101b;border-color:#293147;border-radius:8px;scrollbar-color:#3a4365 transparent}
.bot-protected-item{background:rgba(111,209,177,.06);border-radius:5px;color:#a1e6d0;padding:5px 7px}
.bot-protected-item:hover{background:rgba(111,209,177,.12)}
.bot-protected-item .item-bullet,.bot-protected-item .item-remove{color:#71c8ad}
.bot-protected-empty{color:#7d88a4}
.bot-protected-count{color:#9ca9c1}
.bot-protected-wrap.has-overflow::after{background:linear-gradient(to bottom,transparent,#0c101b)}
.enforce-row{padding:8px;border-radius:7px;border:1px solid #293047;background:rgba(10,14,24,.45)}
.enforce-row:hover{background:#20263a}
.enforce-row input{accent-color:#9289ef}
.enforce-row span{font-size:10px;color:#b1bdd4}
.enforce-row span b{color:#c9c1ff}
.capture-hint{background:rgba(111,165,213,.09);color:#b2d9ff;border-color:#42668a}
.actions-1{padding:4px 12px 10px}
.bot-action{padding:9px 10px;border-radius:8px;border:1px solid #343c56;background:#1a2030;color:#cbd4ea;font-size:10px}
.bot-action:hover{border-color:#625c91;background:#252a43}
.bot-primary{background:#27254d;border-color:#645cb6;color:#ded9ff}
.bot-primary:hover{background:#343065}
.bot-success{background:#173b37;border-color:#347d70;color:#a7ead4}
.bot-warn{background:#242236;border-color:#534f78;color:#c9c4e8}
.bot-warn:hover{background:#342b48;border-color:#8070b0}
.bot-danger{background:#442630;border-color:#9f4c66;color:#ffc5d5}
details.console{background:#121726;border:1px solid #2a3146;border-radius:10px;padding:9px 10px 4px}
details.console summary{color:#a8b3cd;font-size:9px;padding:0 0 6px}
details.console summary::before{color:#a79dff}
.log-controls{gap:5px}
.log-filter{font-size:9px;padding:4px 7px}
.log-filter.active{background:#302c54;border-color:#6f66b6;color:#d8d1ff}
.log-filter[data-log-filter="flow"]{background:#1b2a3a;border-color:#3e617b;color:#8fc7ea}
.log-filter[data-log-filter="flow"].active{background:#284962;border-color:#5c94bf;color:#d7f0ff;box-shadow:none}
.log-filter[data-log-filter="refil"]{background:#2b2241;border-color:#59457b;color:#c9b7f3}
.log-filter[data-log-filter="refil"].active{background:#44345e;border-color:#8f70bd;color:#ecdbff;box-shadow:none}
.log-filter.clear{background:#33222e;border-color:#724459;color:#e7a9b9}
.log-filter.clear:hover{background:#542b40}
.log-rows{font-size:10px}
.log-time{color:#7886a4}
.log-line[data-level="warn"] .log-msg{color:#e5acb9}
.log-line[data-level="success"] .log-msg{color:#88d8bc}
.log-line[data-level="flow"] .log-msg{color:#8fcaed}
.log-line[data-level="flow"]{background:rgba(96,167,215,.07);border-color:#69afdc}
.toast{border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);backdrop-filter:blur(10px)}
.toast.info{background:rgba(24,37,59,.96);border-color:#476996;color:#c3e3ff}
.toast.success{background:rgba(20,52,48,.96);border-color:#397f73;color:#bcf5df}
.toast.warn{background:rgba(55,35,54,.96);border-color:#926a8c;color:#f2c4dc}
.toast.error{background:rgba(64,30,47,.96);border-color:#a75b75;color:#ffd0db}
.toast.flow{background:rgba(31,37,74,.96);border-color:#7074b8;color:#e2dbff}
:where(button,input,select,summary):focus-visible{outline:2px solid #a8a0ff;outline-offset:2px}
@media (prefers-reduced-motion: reduce){
  .panel,.panel *{transition-duration:0.01ms !important;animation-duration:0.01ms !important}
}

/* =============== EMERICKST BESTIARIO =============== */
.bestiary-view{overflow-y:auto;min-height:150px;max-height:calc(100dvh - 215px);padding:10px 12px 14px;scrollbar-width:thin;scrollbar-color:#3d4463 transparent}
.bestiary-view[hidden]{display:none!important}
.bestiary-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
.bestiary-toolbar strong{font-size:11px;color:#e1e5ff;letter-spacing:.02em}
.bestiary-toggle{
  padding:6px 10px;
  border:1px solid #605a90;
  border-radius:7px;
  background:#302b50;
  color:#ded9ff;
  font-size:10px;
  font-weight:700;
  cursor:pointer
}
.bestiary-toggle[data-running="false"]{
  background:#1c3a32;
  border-color:#3b7765;
  color:#bcf5dc
}
.bestiary-status[data-state=paused]{
  color:#b5bcd0
}
.bestiary-refresh{padding:6px 10px;border:1px solid #5f5993;border-radius:7px;background:#302b50;color:#ded9ff;font-size:10px;font-weight:700;cursor:pointer}
.bestiary-refresh:hover{background:#3c3569}
.bestiary-refresh:disabled{opacity:.5;cursor:not-allowed}
.bestiary-auto{display:flex;align-items:center;gap:7px;padding:8px 9px;margin-bottom:9px;background:#151b2b;border:1px solid #2c3650;border-radius:8px;color:#aeb9d0;font-size:10px}
.bestiary-auto input{accent-color:#8c81e9}
.bestiary-status{font-size:10px;line-height:1.5;color:#98a8c8;background:#12192a;padding:8px;border:1px solid #29344d;border-radius:7px;margin-bottom:10px}
.bestiary-status[data-state=error]{color:#f0a5b2;border-color:#734255}
.bestiary-status[data-state=done]{color:#a3dbc8;border-color:#315951}
.bestiary-status[data-state=waiting]{color:#c5baf2}
.bestiary-card{display:flex;align-items:center;gap:10px;border:1px solid #292f47;background:#171c2d;border-radius:9px;padding:9px;margin-bottom:7px}
.bestiary-avatar{width:35px;height:35px;object-fit:contain;image-rendering:pixelated;background:#111522;flex:0 0 35px;border:1px solid #414660;border-radius:7px;box-sizing:border-box}
.bestiary-placeholder{display:grid;place-items:center;font-size:19px;color:#b3a5ef;background:#292843}
.bestiary-info{min-width:0;flex:1}
.bestiary-title{display:flex;justify-content:space-between;gap:5px;align-items:center;font-size:10px}
.bestiary-title b{color:#e1e5f8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bestiary-title span{flex:0 0 auto;color:#bac6e0;font-variant-numeric:tabular-nums;font-size:9px}
.bestiary-track{height:5px;margin:6px 0;background:#292e44;border-radius:4px;overflow:hidden}
.bestiary-track i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#7476ca,#a59aee)}
.bestiary-track i.done{background:linear-gradient(90deg,#238e75,#79d7b3)}
.bestiary-info small{font-size:9px;color:#9aa9c4}
.bestiary-empty{font-size:11px;line-height:1.5;color:#96a4c3;padding:12px 2px}

/* DASHBOARD EMERICKST 6.2.11 (visual somente) */
.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:8px 10px 7px}
.tabs .tab{border:1px solid #303850;border-radius:7px;padding:8px 2px;background:#1b2030;color:#aebad1;font-size:10px}
.tabs .tab.active{background:#302b51;border-color:#8173c9;color:#e3dcff}
.dash-view,.settings-view{overflow-y:auto;min-height:0;max-height:calc(100dvh - 175px);scrollbar-width:thin;scrollbar-color:#3d4463 transparent}
.dash-view[hidden],.settings-view[hidden]{display:none!important}
.dash-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 10px 12px}
.dash-metric{min-width:0;display:flex;flex-direction:column;gap:5px;text-align:left;border-radius:10px;padding:11px 9px;background:#151e1e;border:1px solid #2d6550;color:#c9e6d7;font:inherit;cursor:pointer}
.dash-metric[data-metric=received]{background:#241b22;border-color:#713d4b;color:#f2c1ca}
.dash-metric.active{outline:1px solid currentColor;outline-offset:1px}
.dash-metric-label{font-size:10px;font-weight:750}
.dash-number{font-size:17px;line-height:1.15;font-weight:800;font-variant-numeric:tabular-nums;color:#f6f5f8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dash-metric small{font-size:9px;opacity:.75}
.dash-extra{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:4px;
  border-top:1px solid #ffffff1a;
  padding-top:6px;
  width:100%
}
.dash-extra span{
  font-size:9px;
  opacity:.85;
  white-space:nowrap
}
.dash-extra b{
  font-size:11px;
  font-variant-numeric:tabular-nums;
  color:#effbf4;
  white-space:nowrap
}
.dash-metric[data-metric=received] .dash-extra b{
  color:#ffe5e9
}
.dash-section-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 11px 6px}
.dash-section-head strong{font-size:11px;color:#e3e5f4}
.dash-section-actions{display:flex;gap:5px}
.dash-section-actions button,.settings-view button{background:#282540;border:1px solid #4b456f;border-radius:6px;color:#d6cef8;padding:5px 7px;font:inherit;font-size:10px;cursor:pointer}
.dash-view .rows{max-height:215px;overflow-y:auto;padding:0 12px 10px}
.dash-view .row{min-width:0}
.dash-view .row .pct{color:#7dd8b1}
.dash-view[data-selected=received] .row .pct{color:#f18ca0}
.dash-view .share i{background:#39a87d}
.dash-view[data-selected=received] .share i{background:#db596b}
.dash-fold{margin:8px 10px;border-radius:9px;border:1px solid #30364d;background:#191e2c;overflow:hidden}
.dash-fold summary{list-style:none;cursor:pointer;padding:11px 12px;color:#c9d2e4;font-weight:700;font-size:11px;display:flex;justify-content:space-between;align-items:center}
.dash-fold summary::-webkit-details-marker{display:none}
.dash-fold summary:after{content:'⌄';font-size:15px;color:#9488d7}
.dash-fold[open] summary:after{content:'⌃'}
.dash-fold .fold-content{padding:0 11px 10px;max-height:225px;overflow-y:auto}
.dash-fold .fold-content .row{font-size:11px}
.dash-boxes .type{padding:5px 0;border-top:1px solid #ffffff0e;color:#c7d1e5;font-size:11px}
.settings-view{padding:12px}
.settings-card{border:1px solid #343951;background:#191e2d;border-radius:10px;padding:12px;margin-bottom:10px}
.afk-view{padding:13px 11px 15px;display:flex;flex:1 1 auto;min-height:0;flex-direction:column;gap:11px;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-width:thin;scrollbar-color:#555d80 transparent}
.afk-view[hidden]{display:none!important}
.afk-heading{display:flex;align-items:center;justify-content:space-between;font-size:14px;color:#e5e1f8}
.afk-heading span{font-size:10px;color:#97a2bc;font-weight:400}
.afk-status{min-height:32px;padding:8px 10px;background:#1c2230;border:1px solid #343c55;border-radius:9px;color:#bac5dd;font-size:11px}
.afk-status[data-running="true"]{border-color:#5d6689;color:#e1dcff}
.afk-queue-row .afk-queue-pick:not(:disabled){cursor:pointer}
.afk-field input:disabled,.afk-field select:disabled{opacity:.5}
.afk-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px}
.afk-fields:first-of-type{grid-template-columns:minmax(0,1fr) 98px}
.afk-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.afk-field>span{font-size:10px;letter-spacing:.09em;font-weight:700;color:#a8b3c9}
.afk-field input,.afk-field select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #3b465f;border-radius:9px;background:#121726;color:#e7e9f4;min-height:43px;font:12px system-ui;padding:0 11px;outline:none}
.afk-field input:focus,.afk-field select:focus{border-color:#9287d8}
.afk-fields .afk-field:only-child{grid-column:1/-1}
.afk-field input:disabled,.afk-field select:disabled{opacity:.7}
.afk-toggle{min-height:46px;border:1px solid #8173c9;border-radius:10px;background:#362e56;color:#f0eaff;font:600 12px system-ui;cursor:pointer}
.afk-toggle[data-on="true"]{background:#392933;border-color:#a16d80;color:#f0cad6}
.afk-roster{font-size:10px;color:#91a0bb;line-height:1.5;margin:0}
.afk-queue-title{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px;color:#cbd3e8}
.afk-queue-title span{font-size:9px;color:#8895ae}
.afk-queue{display:flex;flex-direction:column;gap:5px;max-height:190px;overflow:auto}
.afk-queue-row{display:flex;gap:7px;align-items:center;min-height:32px;padding:4px 7px;border:1px solid #353d53;border-radius:8px;background:#191e2b}
.afk-queue-row[data-enabled="false"]{opacity:.57}
.afk-queue-row label{display:flex;align-items:center;gap:7px;flex:1;min-width:0;cursor:pointer}
.afk-queue-row label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#e6e8f2}
.afk-queue-row input{accent-color:#b4a6ed;flex-shrink:0}
.afk-queue-row button{border:1px solid #3e4660;border-radius:6px;background:#252b3b;color:#ddd6f5;min-width:27px;height:27px;cursor:pointer;font-size:12px}
.afk-queue-row button:disabled{opacity:.3;cursor:default}
.afk-queue-empty,.afk-queue-hint{font-size:10px;color:#8f9db7;line-height:1.4;margin:0}
/* AFK: edicao dos perfis sem alterar o personagem realmente aberto no jogo */
.afk-roster-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}
.afk-roster-actions strong{font-size:11px;color:#e3e5f4}
.afk-scan{border:1px solid #46415f;border-radius:6px;background:#292540;color:#d9d0f8;font:10px system-ui;padding:6px 9px;cursor:pointer}
.afk-scan:disabled{opacity:.5;cursor:not-allowed}
.afk-game-label{color:#b3c1dc!important}
.afk-game-tip{font-size:10px;color:#899ab7;margin:-5px 0 1px;line-height:1.45}
.afk-queue-row[data-selected="true"]{border-color:#8b7bd2;background:#27243b}
.afk-queue-pick{flex:1;min-width:0;text-align:left;display:flex;flex-direction:column;gap:3px;padding:3px;border:0;background:transparent;color:#ecedfa;cursor:pointer}
.afk-queue-row .afk-queue-pick{border:0;background:none;height:auto;min-width:0;border-radius:0;padding:3px 2px}
.afk-queue-pick strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.afk-queue-pick small{font-size:9px;color:#9ba9c4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.afk-queue-row[data-selected="true"] .afk-queue-pick strong{color:#d7c9ff}
.afk-queue-row[data-enabled="false"]{opacity:1}
.afk-queue-row[data-enabled="false"] .afk-queue-pick{opacity:.63}
.afk-queue-row[data-enabled="false"] .afk-queue-pick[data-afk-pick]{cursor:pointer}
.afk-queue-row input{width:15px;height:15px;margin:0}
.afk-queue-row .afk-queue-arrows{display:flex;gap:4px}
.afk-add{display:flex;gap:6px}
.afk-add input{min-width:0;flex:1;border:1px solid #3b465f;border-radius:7px;background:#121726;color:#e7e9f4;padding:8px 9px;font:11px system-ui}
.afk-add button{border:1px solid #454066;background:#2b2646;color:#e6defe;border-radius:7px;padding:7px 9px;font:10px system-ui;cursor:pointer}
.afk-add button:disabled,.afk-add input:disabled{opacity:.5;cursor:not-allowed}
.afk-editor{border:1px solid #383c57;background:#1b2030;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:10px}
.afk-editor-header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.afk-editor-header small{font-size:9px;letter-spacing:.1em;color:#97a5c0}
.afk-editor-header strong{display:block;margin-top:3px;font-size:13px;color:#e9e3ff}
.afk-editor-vocation{font-size:9px;color:#afbef1;border:1px solid #4c4973;padding:5px 7px;border-radius:6px;white-space:nowrap}
.afk-game-vocation{float:right;font-size:9px;color:#c5c0fa;border:1px solid #514a77;border-radius:5px;padding:2px 5px;font-weight:600}
.afk-auto-label{font-size:9px;color:#86cbb0;border:1px solid #37634e;border-radius:5px;padding:3px 6px;font-weight:700}
.afk-editor .afk-fields{margin:0}
.afk-editor .afk-fields.hunt-row{grid-template-columns:minmax(0,1fr) 90px}
.afk-editor .afk-fields.other-row{grid-template-columns:repeat(2,minmax(0,1fr))}
.afk-level-header{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#a9b4cb;font-size:10px;font-weight:700;letter-spacing:.1em}
.afk-level-toggle{display:flex;align-items:center;gap:5px;letter-spacing:0;font-size:10px;cursor:pointer}
.afk-level-toggle input{accent-color:#a895f1}
.afk-level-row{display:grid;grid-template-columns:78px minmax(0,1fr) 75px;align-items:center;gap:7px}
.afk-level-row[hidden]{display:none!important}
.afk-level-row>input,.afk-level-row>select,.afk-range{width:100%;min-width:0;box-sizing:border-box;border:1px solid #3b465f;border-radius:8px;background:#121726;color:#e7e9f4;min-height:39px;font:11px system-ui;padding:0 8px}
.afk-range{display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;color:#bbaafb;white-space:nowrap}
.afk-range input{min-width:0;width:43px;color:#e7e9f4;background:transparent;border:0;outline:0;font:11px system-ui;text-align:center}
.afk-editor .afk-fields.other-row{grid-template-columns:minmax(0,1fr) 1fr}
/* Hunts dinamicas por level: so visual da aba AFK */
.afk-level-list{display:flex;flex-direction:column;gap:6px;min-width:0}
.afk-level-row{display:grid;grid-template-columns:70px minmax(0,1fr) 68px 26px;gap:6px;align-items:center;min-width:0}
.afk-level-row .afk-level-min,.afk-level-row .afk-level-hunt,.afk-level-row .afk-level-lure{min-width:0;width:100%;height:35px;box-sizing:border-box;border:1px solid #3b465f;background:#121726;border-radius:7px;color:#e7e9f4;font:11px system-ui;padding:0 7px}
.afk-level-row .afk-level-min{color:#c6b5ff;text-align:center;appearance:textfield;-moz-appearance:textfield}
.afk-level-row .afk-level-min::-webkit-inner-spin-button,.afk-level-row .afk-level-min::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.afk-level-row .afk-level-remove{height:31px;padding:0;background:transparent;border:1px solid #3b465f;color:#b6a9c9;border-radius:6px;cursor:pointer}
.afk-level-row .afk-level-remove:hover{border-color:#ad748d;color:#f0bdce}
.afk-level-range{font-size:9px;color:#8e9bbb;margin:-2px 0 2px 3px}
.afk-add-hunt{width:100%;min-height:30px;background:#262c3f;color:#c6b8ef;border:1px dashed #5d567e;border-radius:7px;font:600 10px system-ui;cursor:pointer}
.afk-add-hunt:disabled{opacity:.45;cursor:default}
.afk-editor [data-afk-count]{font-size:9px;color:#8d9bb7;letter-spacing:0}
.afk-editor-placeholder{font-size:10px;color:#9babca;line-height:1.5;margin:0}
.afk-inline-order{font-size:10px;color:#cbbff2;line-height:1.5;word-break:break-word}
.settings-card strong{display:block;font-size:12px;margin-bottom:8px;color:#ded8fa}
.settings-card p{color:#9eaac3;font-size:10px;line-height:1.5;margin:8px 0 0}
.settings-card .settings-buttons{display:flex;gap:7px}
header button[data-settings-trigger=true].selected{background:#514572;border-color:#a69be5;color:#fff}
/* AFK v6.2.35: linhas compactas, sem scroll aninhado */
.afk-view{gap:9px;max-width:100%;box-sizing:border-box}
.afk-view *{box-sizing:border-box}
.afk-roster-actions{gap:6px;min-width:0}
.afk-roster-actions strong{font-size:10px;letter-spacing:.04em;min-width:0}
.afk-scan{flex:none;padding:5px 8px;font-size:10px}
.afk-queue{max-height:none;overflow:visible;gap:4px;min-width:0;width:100%}
.afk-queue-row{height:36px;min-height:36px;padding:3px 5px;gap:5px;min-width:0;width:100%;border-radius:8px}
.afk-queue-row input{width:14px;height:14px;flex:none}
.afk-queue-row .afk-queue-pick{min-width:0;display:flex;flex:1 1 auto;flex-direction:row;align-items:center;gap:6px;overflow:hidden}
.afk-queue-pick strong{font-size:11px;flex:0 1 auto;max-width:52%;line-height:1.2}
.afk-queue-pick small{font-size:9px;flex:1 1 0;min-width:0;line-height:1.2;color:#8996ae}
.afk-queue-row .afk-queue-arrows{gap:3px;flex:none}
.afk-queue-row .afk-queue-arrows button{width:24px;min-width:24px;height:26px;padding:0;font-size:12px;border-radius:6px}
.afk-add-details{border:1px solid #30394e;border-radius:8px;padding:0 8px;color:#aeb9cd}
.afk-add-details summary{cursor:pointer;font-size:10px;padding:8px 0;list-style:none}
.afk-add-details summary::-webkit-details-marker{display:none}
.afk-add-details[open] summary{border-bottom:1px solid #30394e;margin-bottom:8px}
.afk-add-details .afk-add{margin-bottom:8px;min-width:0}
.afk-add-details .afk-add input{min-width:0;width:100%}
.afk-editor{gap:8px;padding:9px}
.afk-game-tip{font-size:9px;line-height:1.35}

/* AFK v6.2.48: somente camada visual — nenhum handler ou estado modificado. */
.afk-view{padding:9px 10px 13px;gap:9px;scroll-padding-top:68px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:linear-gradient(180deg,rgba(32,33,53,.22),transparent 45%)}
.afk-heading{position:sticky;top:-9px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:52px;padding:8px 0;background:linear-gradient(180deg,#131625 88%,rgba(19,22,37,.96));border-bottom:1px solid #303448}
.afk-heading-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.afk-heading-main strong{font-size:15px;line-height:1.15;letter-spacing:.015em;color:#f1edff}
.afk-heading-main span{font-size:9px;line-height:1.2;color:#8994ac;white-space:nowrap}
.afk-heading .afk-toggle{flex:none;min-height:32px;padding:0 12px;border:1px solid #7665b5;border-radius:8px;background:#40345f;color:#f7f0ff;font-size:11px;font-weight:650;white-space:nowrap}
.afk-heading .afk-toggle[data-on="true"]{background:#35232f;border-color:#926678;color:#f4cad5}
.afk-heading .afk-toggle:focus-visible,.afk-queue button:focus-visible,.afk-field input:focus-visible,.afk-field select:focus-visible{outline:2px solid #b5a6ff;outline-offset:2px}
.afk-status{flex-shrink:0;height:auto;min-height:38px;padding:9px 10px 9px 24px;position:relative;background:#1a2030;border:1px solid #343e55;border-radius:8px;color:#bac5d9;font-size:10px;line-height:1.5;max-height:none;overflow:visible;overflow-wrap:anywhere;scrollbar-width:thin}
.afk-status:before{content:'';position:absolute;left:10px;top:12px;width:6px;height:6px;border-radius:50%;background:#76849b}
.afk-status[data-running="true"]{border-color:#545277;color:#ded8fa;background:#201f32}
.afk-status[data-running="true"]:before{background:#9f8cf2;box-shadow:0 0 0 3px #9f8cf222}
.afk-identity{border:1px solid #30394e;border-radius:9px;background:#171c2b;padding:8px 11px;min-width:0}
.afk-identity .afk-field{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:center;gap:2px 8px;min-width:0}
.afk-identity .afk-game-label{grid-column:1;grid-row:1;letter-spacing:.08em;font-size:9px;color:#8e9cb6!important}
.afk-identity [data-afk-current]{grid-column:1;grid-row:2;min-height:22px;height:22px;padding:0;border:0;background:transparent;font-size:13px;font-weight:650;color:#e9e7f8;text-overflow:ellipsis}
.afk-identity [data-afk-current]:focus{border:0;outline:none}
.afk-identity .afk-game-vocation{grid-column:2;grid-row:1 / 3;float:none;font-size:9px;letter-spacing:.02em;color:#beb6ee;border:1px solid #514c72;border-radius:6px;background:#292740;padding:5px 7px}
.afk-identity .afk-game-tip{font-size:9px;line-height:1.2;margin:4px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#7886a0}
.afk-roster-actions{margin:2px 0 -4px;min-height:24px}
.afk-roster-actions strong{font-size:10px;letter-spacing:.07em;color:#c3cbe0}
.afk-auto-label{font-size:9px;border-color:#315d4e;background:#182c29;color:#8cd8b9;padding:3px 6px}
.afk-queue{gap:4px;overflow:visible;max-height:none}
.afk-queue-row{height:34px;min-height:34px;padding:2px 6px;gap:6px;border-color:#303a50;background:#1b2030;border-radius:8px}
.afk-queue-row[data-selected="true"]{background:#27243b;border-color:#7d6bbd;box-shadow:inset 2px 0 0 #a48fed}
.afk-queue-row input{width:14px;height:14px;accent-color:#ad9ce8}
.afk-queue-row .afk-queue-pick{gap:6px;align-items:center;min-width:0}
.afk-queue-pick strong{font-size:11px;color:#e7e8f6;max-width:46%}
.afk-queue-pick small{font-size:9px;color:#8795ac;white-space:nowrap;min-width:0}
.afk-queue-row .afk-queue-arrows{gap:3px}
.afk-queue-row .afk-queue-arrows button{width:22px;min-width:22px;height:23px;background:transparent;color:#afbbd6;border-color:#3a4059;border-radius:5px;opacity:.68}
.afk-queue-row .afk-queue-arrows button:hover:not(:disabled){opacity:1;background:#33334b;border-color:#696086}
.afk-queue-row .afk-queue-arrows button:disabled{opacity:.18}
.afk-editor{gap:9px;padding:11px;border-radius:10px;border-color:#394057;background:#1a1f30}
.afk-editor-header{padding-bottom:9px;border-bottom:1px solid #30374b;min-height:35px}
.afk-editor-header small{font-size:9px;letter-spacing:.07em;color:#8290aa}
.afk-editor-header strong{font-size:13px;margin-top:3px;font-weight:700;color:#e8e5f9}
.afk-editor-vocation{font-size:9px;padding:4px 6px;border-color:#514d77;background:#26253c;color:#c5b9f6}
.afk-editor .afk-fields{gap:9px}
.afk-editor .afk-fields.hunt-row{grid-template-columns:minmax(0,1fr) 84px}
.afk-editor .afk-field{gap:5px}
.afk-editor .afk-field>span{font-size:9px;letter-spacing:.065em;color:#a4b0c8}
.afk-editor .afk-field input,.afk-editor .afk-field select{min-height:35px;height:35px;padding:0 9px;font-size:11px;border-radius:7px;border-color:#3a465f;background:#111726;color:#e0e3f1}
.afk-editor .afk-field select{padding-right:3px}
.afk-editor-placeholder{color:#7e8da6;font-size:9px;line-height:1.35;margin:0}
.afk-inline-order,.afk-roster{display:none}
</style>
<div class="toast-container" data-toast-container></div>
<section class="panel">
  <header>
    <span>Emerick<span class="brand-accent">ST</span></span>
    <div class="header-btns">
      <button type="button" data-settings-trigger="true" title="Configurações" aria-label="Configurações">⚙</button>
      <button id="mini" title="Modo bolinha">⬤</button>
      <button id="collapse" title="Recolher">−</button>
    </div>
  </header>
  <div id="body">
    <div class="tabs">
      <button class="tab active" data-view="dashboard">Dashboard</button>
      <button class="tab" data-view="bot">HUNT</button>
      <button class="tab" data-view="loot">Loot</button>
      <button class="tab" data-view="bestiary">Bestiário</button>
    </div>
    <div class="control-modes" data-control-modes hidden role="group" aria-label="Modo de controle">
      <button type="button" class="control-mode" data-control-mode="solo" aria-pressed="true">Solo</button>
      <button type="button" class="control-mode" data-control-mode="afk" aria-pressed="false">AFK</button>
      <button type="button" class="control-mode" data-control-mode="party" aria-pressed="false">Party</button>
    </div>
    <section class="dash-view" data-dashboard data-selected="dealt">
      <div data-dashboard-character style="font-size:10px;color:#a6b1c5;padding:8px 12px 0">Todos os personagens</div>
      <div class="dash-metrics">
        <button type="button" class="dash-metric active" data-metric="dealt" aria-pressed="true"><span class="dash-metric-label">↗ Dano causado</span><span class="dash-number" data-dealt-total>0</span><small>Infligido aos monstros</small>
        <span class="dash-extra">
          <span>DPS médio (60s)</span>
          <b data-dealt-dps>0</b>
        </span>
        <span class="dash-extra">
          <span>Maior golpe pessoal</span>
          <b data-dealt-max>0</b>
        </span>
        </button>
        <button type="button" class="dash-metric" data-metric="received" aria-pressed="false"><span class="dash-metric-label">↙ Dano recebido</span><span class="dash-number" data-received-total>0</span><small>Sofrido em combate</small>
        <span class="dash-extra">
          <span>DPS médio (60s)</span>
          <b data-received-dps>0</b>
        </span>
        <span class="dash-extra">
          <span>Maior golpe pessoal</span>
          <b data-received-max>0</b>
        </span>
        </button>
      </div>
      <div class="dash-section-head"><strong data-selected-title>Detalhes do dano causado</strong><div class="dash-section-actions"><button id="toggle" type="button">Expandir</button><button id="reset" type="button" title="Zerar estatisticas de combate">Resetar</button></div></div>
      <div class="rows" id="rows"></div>
      <details class="dash-fold" data-origin-fold><summary>Origem dos ataques</summary><div class="fold-content" id="origin-rows"></div></details>
      <details class="dash-fold" data-boxes-fold><summary>Boxes e duração</summary><div class="fold-content dash-boxes" id="boxes-rows"></div></details>
    </section>
    <section class="settings-view" data-settings-view hidden>
      <div class="settings-card"><strong>Configurações do painel</strong><div class="settings-buttons"><button id="font-dec" type="button">A− Fonte</button><button id="font-inc" type="button">A+ Fonte</button></div><p>A posição, a escala e o modo bolinha continuam sendo salvos como antes.</p></div>
      <div class="settings-card"><strong>Estatísticas e automação</strong><p>As métricas de combate continuam no Dashboard. Os controles do bot permanecem na aba Hunt, as proteções ficam na aba Loot e o Bestiário continua independente.</p></div>
    </section>
    <section class="bestiary-view" data-bestiary-view hidden>
      <div class="bestiary-toolbar"><strong>Bestiário</strong><button type="button" class="bestiary-refresh" data-bestiary-refresh title="Conferir progresso real">↻</button><button type="button" class="bestiary-toggle" data-bestiary-toggle aria-pressed="false">▶ Iniciar</button></div>
      <div class="bestiary-status" data-bestiary-status>Aguardando hunt.</div>
      <div data-bestiary-rows><div class="bestiary-empty">Clique em Atualizar durante uma hunt.</div></div>
    </section>
    <section class="afk-view" data-afk-view hidden>
      <div class="afk-heading">
        <div class="afk-heading-main"><strong>AFK</strong><span>Rotação automática</span></div>
        <button type="button" data-afk-toggle class="afk-toggle">▶ Iniciar AFK</button>
      </div>
      <div class="afk-status" data-afk-status>Configure os personagens que vão caçar.</div>
      <div class="afk-identity">
        <label class="afk-field afk-full"><span class="afk-game-label">PERSONAGEM NO JOGO</span>
          <input type="text" data-afk-current placeholder="Aguardando detecção" readonly autocomplete="off" spellcheck="false" title="Detectado automaticamente pela entrada confirmada no Stonegy" />
          <b class="afk-game-vocation" data-afk-current-vocation>AGUARDANDO</b>
        </label>
        <p class="afk-game-tip" data-afk-identity-hint>A lista é lida automaticamente no Stonegy.</p>
      </div>
      <div class="afk-roster-actions"><strong>PERSONAGENS</strong><span class="afk-auto-label">AUTO</span></div>
      <div class="afk-queue" data-afk-queue></div>
      <div class="afk-editor" data-afk-editor-panel>
        <div class="afk-editor-header"><div><small>CONFIGURAÇÕES DE</small><strong data-afk-editing>Selecione um personagem</strong></div><span class="afk-editor-vocation" data-afk-vocation>PERFIL</span></div>
        <div class="afk-level-header"><span>HUNTS POR LEVEL</span><small data-afk-count>1 hunt</small></div>
        <div data-afk-level-list class="afk-level-list"></div>
        <button type="button" data-afk-add-hunt class="afk-add-hunt">＋ Adicionar Hunt</button>
        <div class="afk-fields other-row"><label class="afk-field"><span>STAMINA MÍNIMA</span>
          <select data-afk-stamina>${staminaOptions}</select></label></div>
        <details data-afk-knight-skill hidden><summary style="font-size:10px;color:#a8b3c9;cursor:pointer">Treino Knight · avançado</summary>
          <select data-afk-skill style="width:100%;margin-top:6px;background:#121726;color:#e7e9f4;border:1px solid #3b465f;border-radius:8px;padding:8px"><option value="auto">AUTO</option><option value="Sword">Sword</option><option value="Axe">Axe</option><option value="Club">Club</option></select>
        </details>
        <p class="afk-editor-placeholder" data-afk-editor-hint>Configurações salvas automaticamente por personagem.</p>
      </div>
      <p class="afk-inline-order" data-afk-order>Selecione quem vai participar.</p>
      <p class="afk-roster" data-afk-roster>Aguardando a lista oficial do Stonegy.</p>
    </section>
    <div class="bot-view" data-bot-view hidden>
      <div class="status-bar">
        <span class="status-dot" data-status-dot></span>
        <span class="status-text" data-status></span>
        <span class="status-flow" data-flow></span>
      </div>
      <div class="training-bar" data-training-bar>
        <span class="tt-icon">🏋</span>
        <span class="tt-label">TREINANDO</span>
        <span class="tt-time" data-training-time>--:--:--</span>
      </div>
      <div class="hunt-status" data-hunt-status>
        <div class="hunt-status-head">
          <span class="hunt-status-name" data-hunt-name>—</span>
          <span class="hunt-status-times" data-hunt-times><strong>00:00:00</strong> / 00:00:00</span>
        </div>
        <div class="hunt-status-track">
          <div class="hunt-status-fill" data-hunt-fill></div>
        </div>
        <div class="hunt-status-foot">
          <span>Restante</span>
          <strong data-hunt-remaining>00:00:00</strong>
        </div>
      </div>
      <div class="actions-1">
        <button class="bot-action bot-warn" data-clear>↺ Limpar fluxo</button>
      </div>
      <div class="field-grid">
        <label class="field"><span class="field-label">HUNT ALVO</span><input data-hunt type="text" placeholder="Hunt ou criatura" spellcheck="false" autocomplete="off" /></label>
        <label class="field"><span class="field-label">LURE</span>
          <select data-lure>
            <option value="max">MAX</option>
            <option value="off">OFF</option>
          </select>
        </label>
      </div>
      <div class="hunt-hint" data-hunt-hint>⚠ Defina a hunt alvo acima para o bot começar a caçar</div>
      <div class="field-grid-2">
        <label class="field"><span class="field-label">STAMINA MÍN</span>
          <select data-stamina-min>${staminaOptions}</select>
        </label>
        <label class="field"><span class="field-label">TREINO (H)</span>
          <select data-training-hours>${trainingOptions}</select>
        </label>
      </div>
      <div class="toggle-row">
        <button class="pill" data-bot="toggle" data-on="true" title="Bot ativo">BOT</button>
      </div>

      <details class="console">
        <summary>CONSOLE</summary>
        <div class="log-controls">
          <button class="log-filter active" data-log-filter="all">Todos</button>
          <button class="log-filter" data-log-filter="flow">● Fluxo</button>
          <button class="log-filter" data-log-filter="refil">◆ Refil</button>
          <button class="log-filter" data-log-filter="info">Info</button>
          <button class="log-filter" data-log-filter="success">OK</button>
          <button class="log-filter" data-log-filter="warn">Aviso</button>
          <button class="log-filter" data-log-filter="error">Erro</button>
          <button class="log-filter clear" data-log-clear>Limpar</button>
        </div>
        <div class="log-rows" data-log-rows><div class="log-empty">Nenhum registro ainda.</div></div>
      </details>
    </div>
    <section class="loot-view" data-loot-view hidden>
      <div class="card">
        <div class="card-head">
          <span>ITENS PROTEGIDOS <span class="bot-protected-count" data-protected-count></span></span>
          <div class="mini-group">
            <button class="mini" data-add-item title="Adicionar item por nome">+ ADD</button>
            <button class="mini capture" data-capture-item title="Clique em itens do inventário para adicionar/remover da lista">◎ CAPT</button>
          </div>
        </div>
        <div class="bot-protected-wrap" data-protected-wrap>
          <div class="bot-protected-list" data-protected-list></div>
        </div>
        <div class="capture-hint" data-capture-hint>
          <b>Modo captura ativo.</b> Clique em itens do inventário para adicionar/remover da lista.<br>
          Botão direito ou <b>ESC</b> cancela.
        </div>
        <label class="enforce-row" title="Se ativo: itens fora da lista que estiverem protegidos serão desprotegidos para poderem ser vendidos">
          <input type="checkbox" data-unprotect-extras />
          <span>Desproteger itens <b>fora da lista</b> antes de vender</span>
        </label>
        <label class="enforce-row" title="Marcar com overlay escuro e escudo dourado os itens do inventário que estão na lista de protegidos">
          <input type="checkbox" data-show-inv-markers />
          <span>Marcar itens protegidos <b>no inventário</b></span>
        </label>
        <label class="enforce-row" title="Se ativo: pula a sincronização de proteção e vende direto (para emergência)">
          <input type="checkbox" data-skip-protection />
          <span><b>Pular proteção</b> (vender direto sem sincronizar)</span>
        </label>
      </div>
    </section>
  </div>
</section>`;
    document.documentElement.appendChild(host);
    panelHost = host;
    try { window.__emerickPartyInit?.(shadow); } catch (e) { console.warn("[EmerickST Party]", e); }
    const controlStyle = document.createElement("style");
    controlStyle.textContent = `
      .tabs:has([data-view="party"]){grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .tabs [data-view="party"]{display:none!important}
      .control-modes[hidden]{display:none!important}
      .control-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:8px 10px;background:rgba(8,11,20,.28);border-bottom:1px solid #22283a}
      .control-mode{min-width:0;padding:7px 8px;border:1px solid #343b54;border-radius:8px;background:#171b2a;color:#aeb9d0;font:600 10px system-ui;cursor:pointer}
      .control-mode.active{border-color:#746bb2;background:#2b2949;color:#e4deff}
      .control-mode:disabled{opacity:.55;cursor:not-allowed}
    `;
    shadow.appendChild(controlStyle);
    afkBind(shadow);

    const panel = shadow.querySelector(".panel"), rows = shadow.querySelector("#rows");
    let activeView = overlayState.activeView === "afk" ? "bot"
      : ["bot", "loot", "bestiary"].includes(overlayState.activeView) ? overlayState.activeView : "dashboard";
    let controlMode = ["solo", "afk", "party"].includes(overlayState.controlMode)
      ? overlayState.controlMode : overlayState.activeView === "afk" ? "afk" : "solo";
    if (afk.enabled) controlMode = "afk";
    else if (window.__emerickPartyGate?.enabled) controlMode = "party";
    const controlModes = shadow.querySelector("[data-control-modes]");
    const partyCompatTab = shadow.querySelector('.tabs [data-view="party"]');
    const runningControlMode = () => afk.enabled ? "afk"
      : window.__emerickPartyGate?.enabled ? "party"
      : BOT_CONFIG.botAtivo ? "solo" : "";
    let selectedMetric = overlayState.activeView === "received" ? "received" : overlayState.combatMetric === "received" ? "received" : "dealt";
    let settingsOpen = false;
    let collapsed = overlayState.collapsed === true, dragging = false, dx = 0, dy = 0;
    let fontScale = (Number.isFinite(overlayState.fontScale) ? Math.max(BOT_FONT_MIN, Math.min(BOT_FONT_MAX, overlayState.fontScale)) : 1);
    let miniMode = overlayState.miniMode === true;
    let preMiniPos = null;
    const expanded = new Set();

    const applyFont = () => {
      if (miniMode) return;
      try { panel.style.zoom = String(fontScale); } catch(_) {}
    };
    const applyMini = () => {
      panel.classList.toggle("mini", miniMode);
      if (miniMode) {
        panel.classList.remove("collapsed");
        try { panel.style.zoom = ""; } catch(_) {}
      } else {
        try { panel.style.zoom = String(fontScale); } catch(_) {}
      }
    };
    applyFont();
    applyMini();

    const fit = () => {
      if (miniMode) return;
      const scale = Number.parseFloat(panel.style.zoom) || 1;
      // Evitar corte lateral em resolucoes estreitas e com A+ (zoom).
      panel.style.width = `${Math.max(230, Math.min(330, (window.innerWidth - 24) / scale))}px`;
      const rect = panel.getBoundingClientRect();
      if (rect.width > window.innerWidth - 8) {
        panel.style.width = `${Math.max(100, (window.innerWidth - 16) / scale)}px`;
      }
      // Recolocar o painel na tela quando sua posicao salva estiver fora.
      if (panel.style.left && panel.style.left !== 'auto') {
        const left = panel.getBoundingClientRect().left;
        const right = panel.getBoundingClientRect().right;
        if (left < 6 || right > window.innerWidth - 6) {
          const fix = Math.max(6, Math.min(window.innerWidth - panel.getBoundingClientRect().width - 6, left));
          panel.style.left = `${fix / scale}px`;
        }
      }
      const top = Math.max(0, Math.min(panel.getBoundingClientRect().top, window.innerHeight - 300));
      panel.style.top = `${top / scale}px`;
      panel.style.maxHeight = `${Math.max(0, window.innerHeight - top - 12) / scale}px`;
    };
    setPanelVisible = (visible) => {
      const next = Boolean(visible);
      host.hidden = !next;
      host.style.setProperty("display", next ? "" : "none", next ? "" : "important");
      host.setAttribute("aria-hidden", String(!next));
      if (next) requestAnimationFrame(() => { fit(); update(); });
      updateEmerickTabButtonState();
    };
    const saveOverlay = () => {
      if (miniMode) {
        overlayState = { ...overlayState, activeView, controlMode, combatMetric: selectedMetric, collapsed, fontScale, miniMode };
      } else {
        overlayState = { ...overlayState, activeView, controlMode, combatMetric: selectedMetric, collapsed, fontScale, miniMode, left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) };
      }
      persist();
    };

    const enterMini = () => {
      const r = panel.getBoundingClientRect();
      preMiniPos = { left: r.left, top: r.top };
      miniMode = true;
      panel.classList.add("mini");
      panel.classList.remove("collapsed");
      panel.style.left = "auto";
      panel.style.top = "auto";
      panel.style.bottom = "18px";
      panel.style.right = "18px";
      panel.style.maxHeight = "";
      saveOverlay();
    };
    const exitMini = () => {
      miniMode = false;
      panel.classList.remove("mini");
      panel.style.bottom = "auto";
      if (preMiniPos) {
        panel.style.right = "auto";
        panel.style.left = `${preMiniPos.left}px`;
        panel.style.top = `${preMiniPos.top}px`;
      } else {
        panel.style.right = "18px";
        panel.style.left = "auto";
        panel.style.top = "92px";
      }
      try { panel.style.zoom = String(fontScale); } catch(_) {}
      fit();
      saveOverlay();
    };
    panel.addEventListener("click", (e) => {
      if (!miniMode) return;
      e.preventDefault();
      e.stopPropagation();
      exitMini();
    });
    shadow.querySelector("#mini").onclick = (e) => {
      e.stopPropagation();
      if (miniMode) exitMini(); else enterMini();
    };

    shadow.querySelector("#font-dec").onclick = (e) => {
      e.stopPropagation();
      fontScale = Math.max(BOT_FONT_MIN, Math.round((fontScale - BOT_FONT_STEP) * 100) / 100);
      applyFont();
      fit();
      saveOverlay();
      botToast("info", `🔤 Fonte ${Math.round(fontScale * 100)}%`);
    };
    shadow.querySelector("#font-inc").onclick = (e) => {
      e.stopPropagation();
      fontScale = Math.min(BOT_FONT_MAX, Math.round((fontScale + BOT_FONT_STEP) * 100) / 100);
      applyFont();
      fit();
      saveOverlay();
      botToast("info", `🔤 Fonte ${Math.round(fontScale * 100)}%`);
    };

    const setCollapsed = (value) => {
      collapsed = value;
      panel.classList.toggle("collapsed", value);
      const btn = shadow.querySelector("#collapse");
      if (btn) btn.textContent = value ? "+" : "−";
      fit();
    };
    shadow.querySelector("#collapse").onclick = (e) => {
      e.stopPropagation();
      if (miniMode) return;
      setCollapsed(!collapsed);
      saveOverlay();
    };
    const header = shadow.querySelector("header");
    header.onpointerdown = (e) => {
      if (miniMode) return;
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea") || e.target.closest("select")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      dx = e.clientX - rect.left; dy = e.clientY - rect.top;
      header.setPointerCapture(e.pointerId);
    };
    header.onpointermove = (e) => { if (dragging) { panel.style.right = "auto"; panel.style.left = `${Math.max(0, e.clientX - dx)}px`; panel.style.top = `${Math.max(0, e.clientY - dy)}px`; } };
    header.onpointerup = () => { dragging = false; fit(); saveOverlay(); };
    shadow.querySelector(".tabs").onclick = (e) => { const tab = e.target.closest(".tab"); if (tab && tab.dataset.view !== "party") { activeView = tab.dataset.view; settingsOpen = false; saveOverlay(); update(); } };
    controlModes.addEventListener("click", (e) => {
      const button = e.target.closest("[data-control-mode]");
      if (!button || button.disabled) return;
      const running = runningControlMode();
      if (running && button.dataset.controlMode !== running) {
        botToast("warn", "Pare o modo ativo antes de trocar.");
        return;
      }
      controlMode = button.dataset.controlMode;
      settingsOpen = false;
      saveOverlay();
      update();
    });
    shadow.querySelector("[data-settings-trigger]").onclick = () => { settingsOpen = !settingsOpen; update(); };
    shadow.querySelector("[data-dashboard]").addEventListener("click", (event) => {
      const metric = event.target.closest("[data-metric]");
      if (metric) { selectedMetric = metric.dataset.metric; saveOverlay(); update(); }
    });
    shadow.querySelector("[data-origin-fold]").addEventListener("toggle", update);
    shadow.querySelector("[data-boxes-fold]").addEventListener("toggle", update);
    shadow.querySelector("[data-bestiary-toggle]").onclick = () => {
      emBestiary.enabled = !emBestiary.enabled;

      try {
        localStorage.setItem(
          EM_BESTIARY_PAUSE_KEY,
          emBestiary.enabled ? "0" : "1"
        );
      } catch (_) {}

      if (!emBestiary.enabled) {
        emBestiary.generation += 1;
        emBestiary.message = "Bestiário parado.";
        emBestiary.status = "paused";
      } else {
        // Bestiario ON: consulta automatica apos as etapas prioritarias.
        emBestiary.auto = true;
        try { localStorage.setItem(EM_BESTIARY_KEY, JSON.stringify({auto:true})); } catch (_) {}
        // Revalidar a hunt ao retomar.
        emBestiary.inHunt = false;
        emBestiary.scanned = false;
        emBestiary.results = [];
        emBestiary.status = "idle";
        emBestiary.message = "Bestiário iniciado.";
      }

      emRenderBestiary();

      // Nao abrir Stonegypedia imediatamente: o tick aguarda
      // a conclusao da Hunt, do Lure e do Posicionamento.
    };

    shadow.querySelector("[data-bestiary-refresh]").onclick = () => emRefreshBestiary();
    // Acompanhamento automatico integrado ao botao Iniciar do Bestiario.
    // O botao ↻ permanece disponivel para revalidar o valor real.
    shadow.querySelector("#reset").onclick = () => { damageTotals = {}; receivedTotals = {}; dpsBuckets = {}; dpsStartedAt = null; boxStats = {
          currentStartedAt: null,
          lastAttackAt: null,
          durations: []
        };
        combatRecent = { dealt: {}, received: {} };
        combatMax = { dealt: 0, received: 0 };
        combatActorRecent = { dealt: {}, received: {} };
        combatActorMax = { dealt: {}, received: {} };
        persist();
        update(); };
    shadow.querySelector("#toggle").onclick = () => { const entries = selectedMetric === "received" ? summary(receivedTotals) : summary(damageTotals); const keys = entries.map((e) => `${selectedMetric}:${e.sourceId}`); if (keys.length && keys.every((k) => expanded.has(k))) keys.forEach((k) => expanded.delete(k)); else keys.forEach((k) => expanded.add(k)); update(); };
    shadow.querySelector(".log-controls").onclick = (e) => {
      const f = e.target.closest?.("[data-log-filter]");
      if (f) { botLogFilter = f.dataset.logFilter; shadow.querySelectorAll(".log-filter[data-log-filter]").forEach((b) => b.classList.toggle("active", b.dataset.logFilter === botLogFilter)); botRenderLog(); return; }
      const c = e.target.closest?.("[data-log-clear]");
      if (c) { botClearLog(); botLog("info", "🧹 Console limpo"); }
    };
    shadow.querySelector("[data-log-rows]").addEventListener("click", (e) => {
      const reset = e.target.closest?.("[data-refil-reset]");
      if (!reset) return;
      botRefilStats = { huntCount: 0, sellCount: 0, huntDurations: [] };
      botSaveRefilStats();
      botRenderLog();
      botLogAndToast("flow", "↺ Refil resetado");
    });
    function renderEntries(entries, section) {
      const largest = Math.max(1, ...entries.map((e) => e.damage));
      const totalDamage = entries.reduce((s, e) => s + e.damage, 0) || 1;
      return entries.map((entry) => {
        const key = `${section}:${entry.sourceId}`, open = expanded.has(key);
        const pct = (entry.damage / totalDamage) * 100;
        const pctStr = pct >= 10 ? pct.toFixed(1) : pct.toFixed(2);
        const details = open
          ? section === "origin"
            ? Object.entries(entry.byOrigin || {}).sort((a, b) => b[1].damage - a[1].damage).map(([origin, value]) => `<div class="best"><span>${escapeHtml(origin)} (${value.hits})</span><strong>${Number.isFinite(value.bestHit) ? value.bestHit.toLocaleString("pt-BR") : "-"}</strong></div>`).join("") || "Aguardando novos ataques"
            : Object.entries(entry.byType || {}).sort((a, b) => b[1] - a[1]).map(([type, value]) => `<div class="type"><span class="dmg-label"><i class="dmg-icon">${DAMAGE_ICONS[type] || ""}</i>${type}</span><span>${value.toLocaleString("pt-BR")}</span></div>`).join("") || "Sem dano"
          : "";
        const best = section === "origin" && !open ? Object.entries(entry.byOrigin || {}).sort((a, b) => b[1].bestHit - a[1].bestHit)[0] : null;
        return `<div class="row" data-key="${escapeHtml(key)}"><span>${escapeHtml(entry.name)} <b class="pct">${pctStr}%</b><small> · ${section === "origin" ? entry.originHits : entry.averagePerMinute.toLocaleString("pt-BR") + "/min"}</small></span><span class="value">${entry.damage.toLocaleString("pt-BR")}</span></div><div class="share"><i style="width:${Math.round((entry.damage / largest) * 100)}%"></i></div>${best ? `<div class="best"><span>${escapeHtml(best[0])}</span><strong>${best[1].bestHit.toLocaleString("pt-BR")}</strong></div>` : ""}${open ? `<div class="detail">${details}</div>` : ""}`;
      }).join("");
    }
    function update() {
      shadow.querySelectorAll(".tabs .tab").forEach((tab) => {
        const active = tab === partyCompatTab
          ? activeView === "bot" && controlMode === "party"
          : tab.dataset.view === activeView;
        tab.classList.toggle("active", active);
      });
      const running = runningControlMode();
      controlModes.hidden = settingsOpen || activeView !== "bot";
      controlModes.querySelectorAll("[data-control-mode]").forEach((button) => {
        const selected = button.dataset.controlMode === controlMode;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = Boolean(running && button.dataset.controlMode !== running);
        button.title = button.disabled ? "Pare o modo ativo antes de trocar." : "";
      });
      const botView = shadow.querySelector("[data-bot-view]");
      const lootView = shadow.querySelector("[data-loot-view]");
      const bestiaryView = shadow.querySelector("[data-bestiary-view]");
      const afkView = shadow.querySelector("[data-afk-view]");
      const dashboard = shadow.querySelector("[data-dashboard]");
      const settings = shadow.querySelector("[data-settings-view]");
      settings.hidden = !settingsOpen;
      dashboard.hidden = settingsOpen || activeView !== "dashboard";
      botView.hidden = settingsOpen || activeView !== "bot" || controlMode !== "solo";
      lootView.hidden = settingsOpen || activeView !== "loot";
      bestiaryView.hidden = settingsOpen || activeView !== "bestiary";
      afkView.hidden = settingsOpen || activeView !== "bot" || controlMode !== "afk";
      shadow.querySelector("[data-settings-trigger]").classList.toggle("selected", settingsOpen);
      if (settingsOpen) return;
      if (activeView === "afk") { afkRender(shadow); return; }
      if (activeView === "bestiary") { emRenderBestiary(); return; }
      if (activeView === "bot" || activeView === "loot") { botUpdatePanel(); return; }

      // Totais, DPS, nomes, origens e participacao sao sempre coletivos.
      // SOMENTE o maior golpe causado/recebido pertence ao personagem desta aba.
      const localCharacter=emLocalCharacter();
      const actorIds=localCharacter ? emActorIds(localCharacter) : null;
      const dealt=summary(damageTotals);
      const received=summary(receivedTotals);
      const sum = (items) => items.reduce((acc, item) => acc + item.damage, 0).toLocaleString("pt-BR");
      shadow.querySelector("[data-dealt-total]").textContent = sum(dealt);
      shadow.querySelector("[data-received-total]").textContent = sum(received);
      const heading=shadow.querySelector('[data-dashboard-character]');
      if (heading) heading.textContent=localCharacter
        ? 'Equipe completa · maiores golpes: '+localCharacter
        : 'Equipe completa · configure o nome na Party para maiores golpes';

      const formatDps = (n) => n.toLocaleString("pt-BR", {maximumFractionDigits:1});
      shadow.querySelector("[data-dealt-dps]").textContent =
        formatDps(combatDps60('dealt'));
      shadow.querySelector("[data-received-dps]").textContent =
        formatDps(combatDps60('received'));
      shadow.querySelector("[data-dealt-max]").textContent =
        actorIds ? emActorMaxValue('dealt',actorIds).toLocaleString('pt-BR') : '—';
      shadow.querySelector("[data-received-max]").textContent =
        actorIds ? emActorMaxValue('received',actorIds).toLocaleString('pt-BR') : '—';
      dashboard.dataset.selected = selectedMetric;
      shadow.querySelectorAll("[data-metric]").forEach((btn) => {
        const active = btn.dataset.metric === selectedMetric;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      shadow.querySelector("[data-selected-title]").textContent =
        selectedMetric === "dealt" ? "Detalhes do dano causado" : "Detalhes do dano recebido";
      const entries = selectedMetric === "received" ? received : dealt;
      rows.innerHTML = entries.length ? renderEntries(entries, selectedMetric) : '<div class="empty">Nenhum dano registrado.</div>';

      // Origem preserva por jogador os mesmos ataques e melhores golpes da aba antiga.
      const origin = shadow.querySelector("#origin-rows");
      if (shadow.querySelector("[data-origin-fold]").open) {
        origin.innerHTML = dealt.length ? renderEntries(dealt, "origin") : '<div class="empty">Nenhuma origem registrada.</div>';
      }

      const boxes = boxSummary();
      if (shadow.querySelector("[data-boxes-fold]").open) {
        shadow.querySelector("#boxes-rows").innerHTML =
          `<div class="type"><span>Boxes concluídas</span><b>${boxes.count}</b></div>` +
          `<div class="type"><span>Média</span><b>${boxes.average === null ? "-" : boxes.average + " s"}</b></div>` +
          `<div class="type"><span>Última</span><b>${boxes.last === null ? "-" : boxes.last + " s"}</b></div>` +
          `<div class="type"><span>Estado</span><b>${boxes.running ? "Em combate" : "Aguardando"}</b></div>`;
      }
    }
    const onRowClick = (e) => { const row = e.target.closest(".row"); if (!row) return; const key = row.dataset.key; if (expanded.has(key)) expanded.delete(key); else expanded.add(key); update(); };
    rows.onclick = onRowClick;
    shadow.querySelector("#origin-rows").onclick = onRowClick;
    window.addEventListener("resize", fit);
    if (!miniMode && Number.isFinite(overlayState.left) && Number.isFinite(overlayState.top)) { panel.style.right = "auto"; panel.style.left = `${overlayState.left}px`; panel.style.top = `${overlayState.top}px`; }
    setCollapsed(collapsed); fit(); update();
    setInterval(update, 1500);
  }

  // ==================== BOTAO EMERICKST NO MENU NATIVO ====================
  const panelIsVisible = () => Boolean(panelHost?.isConnected && getComputedStyle(panelHost).display !== "none");
  const updateEmerickTabButtonState = () => {
    const button = document.getElementById(STONEGY_TAB_BUTTON_ID);
    if (!button) return;
    const open = panelIsVisible();
    const label = open ? "Ocultar painel EmerickST" : "Abrir painel EmerickST";
    button.dataset.open = String(open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  const findStonegyTabBar = () => {
    const anchor = document.querySelector('[data-guide="character-stats-button"]');
    const sidebar = anchor?.parentElement;
    if (!sidebar || !emVisible(anchor) || !(sidebar instanceof HTMLElement)) return null;
    // A barra real usa o pai direto da ancora, como a extensao de referencia demonstrou.
    // Exigir flex-direction/quantidade exata impedia a criacao do botao em certas telas.
    const siblings = [...sidebar.children];
    if (siblings.length < 4 || siblings.length > 18) return null;
    const nativeIcons = siblings.filter(el => el.querySelector("svg"));
    if (nativeIcons.length < 4) return null;
    return { sidebar, anchor };
  };
  const injectEmerickTabStyles = () => {
    if (document.getElementById(STONEGY_TAB_STYLE_ID)) return;
    const target = document.head || document.documentElement;
    if (!target) return;
    const style = document.createElement("style");
    style.id = STONEGY_TAB_STYLE_ID;
    style.textContent = `
      #${STONEGY_TAB_BUTTON_ID}{box-sizing:border-box;display:flex;align-items:center;justify-content:center;
        flex:0 0 auto;margin:0;padding:0;border:3px solid #5c6465;border-radius:50%;
        background:radial-gradient(circle at 48% 30%,#333c40,#202a2e 65%,#151b1e);
        color:#858d90;cursor:pointer;box-shadow:inset 0 0 0 2px #151a1d,0 2px 4px #0009;
        transition:border-color .15s,background .15s,color .15s,box-shadow .15s}
      #${STONEGY_TAB_BUTTON_ID}:hover{border-color:#828a8b;color:#bec6c8;background:radial-gradient(circle at 48% 30%,#3b464a,#263135 65%,#151b1e)}
      #${STONEGY_TAB_BUTTON_ID}[data-open="true"]{border-color:#70777b;color:#aab0b3;box-shadow:inset 0 0 0 2px #171b20,0 0 0 1px #514c78}
      #${STONEGY_TAB_BUTTON_ID} svg{width:52%;height:52%;display:block;pointer-events:none}
      #${STONEGY_TAB_BUTTON_ID}:focus-visible{outline:2px solid #b8b0ff;outline-offset:2px}
    `;
    target.appendChild(style);
  };
  let emLastMenuProbe = 0;
  const ensureEmerickTabButton = () => {
    const logo = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.6 5.6H7.3v12.8h10.3M7.6 12h8.2" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"/></svg>';

    const existing = document.getElementById(
      STONEGY_TAB_BUTTON_ID
    );

    const found = findStonegyTabBar();

    // Aguarda o menu nativo estar disponivel.
    if (!found) {
      if (existing?.isConnected) {
        updateEmerickTabButtonState();
      }

      return existing?.isConnected ? existing : null;
    }

    const { sidebar, anchor } = found;

    injectEmerickTabStyles();

    if (existing?.isConnected) {
      // O EmerickST deve permanecer sempre em primeiro.
      // Funciona mesmo se o Stonegy reordenar a barra.
      if (
        existing.parentElement !== sidebar ||
        sidebar.firstElementChild !== existing
      ) {
        sidebar.insertBefore(
          existing,
          sidebar.firstElementChild
        );
      }

      // Substitui o escudo antigo pelo E do EmerickST.
      if (existing.dataset.emerickLogo !== "e") {
        existing.innerHTML = logo;
        existing.dataset.emerickLogo = "e";
      }

      updateEmerickTabButtonState();

      return existing;
    }

    if (Date.now() - emLastMenuProbe < 900) {
      return null;
    }

    emLastMenuProbe = Date.now();

    const bounds = anchor.getBoundingClientRect();

    const size = bounds.width > 12
      ? Math.round(bounds.width)
      : 40;

    const button = document.createElement("div");

    button.id = STONEGY_TAB_BUTTON_ID;

    button.setAttribute("role", "button");

    button.tabIndex = 0;

    button.style.width = `${size}px`;

    button.style.height =
      `${Math.round(bounds.height > 12 ? bounds.height : size)}px`;

    button.style.minWidth = button.style.width;

    try {
      button.style.margin =
        getComputedStyle(anchor).margin;
    } catch (_) {}

    // Logotipo E.
    button.innerHTML = logo;
    button.dataset.emerickLogo = "e";

    const toggle = event => {
      event.preventDefault();
      event.stopPropagation();

      if (setPanelVisible) {
        setPanelVisible(!panelIsVisible());
      }
    };

    button.addEventListener(
      "pointerdown",
      event => event.stopPropagation()
    );

    button.addEventListener(
      "mousedown",
      event => event.stopPropagation()
    );

    button.addEventListener("click", toggle);

    button.addEventListener("keydown", event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        toggle(event);
      }
    });

    // PRIMEIRA POSICAO:
    // imediatamente acima do primeiro icone nativo.
    sidebar.insertBefore(
      button,
      sidebar.firstElementChild
    );

    updateEmerickTabButtonState();

    return button;
  };

  // ==================== ABA HUNT ====================
  const botRenderProtectedList = () => {
    if (!botRoot) return;
    const list = botRoot.querySelector("[data-protected-list]");
    const wrap = botRoot.querySelector("[data-protected-wrap]");
    const countEl = botRoot.querySelector("[data-protected-count]");
    if (!list) return;
    const items = BOT_CONFIG.protectedItems || [];
    if (countEl) countEl.textContent = items.length ? `(${items.length})` : "";
    if (!items.length) {
      list.innerHTML = `<div class="bot-protected-empty">Nenhum item na lista</div>`;
      if (wrap) wrap.classList.remove("has-overflow");
      return;
    }
    list.innerHTML = items.map((name, idx) => {
      const safe = escapeHtml(name);
      const safeAttr = escapeAttr(name);
      return `<div class="bot-protected-item">` +
        `<span class="item-bullet">●</span>` +
        `<span class="item-name" title="${safeAttr}">${safe}</span>` +
        `<button type="button" class="item-remove" data-remove="${idx}" title="Remover">✕</button>` +
      `</div>`;
    }).join("");
    requestAnimationFrame(() => {
      if (!wrap) return;
      const hasOverflow = list.scrollHeight > list.clientHeight + 2;
      wrap.classList.toggle("has-overflow", hasOverflow);
    });
  };

  // ==================== HUNT STATUS (lê do jogo) ====================
  const botUpdateHuntStatus = () => {
    if (!botRoot) return;
    const el = botRoot.querySelector("[data-hunt-status]");
    if (!el) return;
    const st = botReadHuntStatus();
    if (!st) { el.classList.remove("on"); return; }
    el.classList.add("on");
    const nameEl = el.querySelector("[data-hunt-name]");
    const timesEl = el.querySelector("[data-hunt-times]");
    const fillEl = el.querySelector("[data-hunt-fill]");
    const remEl = el.querySelector("[data-hunt-remaining]");
    if (nameEl) nameEl.textContent = st.huntName || "Hunt ativa";
    if (timesEl) timesEl.innerHTML = `<strong>${escapeHtml(st.huntTime)}</strong> / ${escapeHtml(st.maxTime)}`;
    if (remEl) remEl.textContent = st.remaining || "—";
    const curS = botParseHMS(st.huntTime);
    const maxS = botParseHMS(st.maxTime);
    const ratio = maxS > 0 ? Math.min(1, curS / maxS) : 0;
    const pct = Math.round(ratio * 100);
    if (fillEl) {
      fillEl.style.width = pct + "%";
      fillEl.classList.toggle("mid", ratio >= 0.6 && ratio < 0.85);
      fillEl.classList.toggle("high", ratio >= 0.85);
    }
  };

  const botUpdatePanel = () => {
    if (!botRoot || !botStatus || !botFlow) return;
    const flow = botGetFlow(); const inHunt = botInHunt(); const inTraining = botTreinando();
    const statusText = !BOT_CONFIG.botAtivo ? "PAUSADO"
      : botConnLostActive ? "CONEXÃO PERDIDA"
      : botInactivityActive ? "INATIVIDADE!"
      : botTrainingAsyncRunning ? "TREINANDO"
      : botHuntAsyncRunning ? "EXECUTANDO HUNT"
      : inTraining ? "EM TREINO"
      : inHunt ? "DENTRO DA HUNT"
      : flow ? "EM PROCESSO" : "FORA DA HUNT";
    const statusState = !BOT_CONFIG.botAtivo ? "off"
      : botConnLostActive ? "error"
      : botInactivityActive ? "inactive"
      : inHunt ? "active"
      : flow ? "waiting" : "idle";
    botStatus.textContent = statusText;
    const dot = botRoot.querySelector("[data-status-dot]");
    if (dot) dot.dataset.state = statusState;
    const panel = botRoot.querySelector(".panel");
    if (panel) {
      let color = "#64748b";
      if (statusState === "active") color = "#22c55e";
      else if (statusState === "waiting") color = "#a49dff";
      else if (statusState === "inactive") color = "#a49dff";
      else if (statusState === "error" || statusState === "off") color = "#ef4444";
      panel.style.setProperty("--mini-color", color);
    }
    if (flow) {
      const elapsed = Math.round((Date.now() - flow.timestamp) / 1000);
      botFlow.textContent = `${flowLabel(flow.etapa)} · ${elapsed}s`;
    } else botFlow.textContent = botHuntAsyncRunning ? "executando..." : botTrainingAsyncRunning ? "treinando..." : "sem fluxo";
    const tbar = botRoot.querySelector("[data-training-bar]");
    const ttime = botRoot.querySelector("[data-training-time]");
    if (tbar && ttime) {
      const show = Boolean(botTrainingStartedAt && botTrainingTotalMs);
      tbar.classList.toggle("on", show);
      if (show) {
        const elapsed = Date.now() - botTrainingStartedAt;
        const restante = Math.max(0, botTrainingTotalMs - elapsed);
        ttime.textContent = botFmtCountdown(restante);
      } else {
        ttime.textContent = "--:--:--";
      }
    }
    try { botUpdateHuntStatus(); } catch(_) {}
    const botPill = botRoot.querySelector("[data-bot=toggle]"); if (botPill) botPill.dataset.on = String(BOT_CONFIG.botAtivo);
    const active = botRoot.activeElement;
    const enforce = botRoot.querySelector("[data-unprotect-extras]"); if (enforce && active !== enforce) enforce.checked = Boolean(BOT_CONFIG.unprotectExtras);
    const invMark = botRoot.querySelector("[data-show-inv-markers]"); if (invMark && active !== invMark) invMark.checked = Boolean(BOT_CONFIG.showInventoryMarkers);
    const skipProt = botRoot.querySelector("[data-skip-protection]"); if (skipProt && active !== skipProt) skipProt.checked = Boolean(BOT_CONFIG.skipProtection);
    const huntInput = botRoot.querySelector("[data-hunt]");
    if (huntInput) {
      huntInput.readOnly = Boolean(window.__emerickPartyGate?.enabled);
      huntInput.title = huntInput.readOnly ? "Em Party, altere a hunt na aba Party" : "";
      if (active !== huntInput) huntInput.value = BOT_CONFIG.huntName;
    }
    const huntHint = botRoot.querySelector("[data-hunt-hint]");
    const isEmpty = !BOT_CONFIG.huntName || !BOT_CONFIG.huntName.trim();
    if (huntInput) huntInput.classList.toggle("empty-warning", isEmpty);
    if (huntHint) huntHint.classList.toggle("on", isEmpty);
    const lureSel = botRoot.querySelector("[data-lure]"); if (lureSel && active !== lureSel) lureSel.value = String(BOT_CONFIG.lureModo);
    const staminaSel = botRoot.querySelector("[data-stamina-min]"); if (staminaSel && active !== staminaSel) staminaSel.value = String(BOT_CONFIG.minStaminaHours);
    const trainingSel = botRoot.querySelector("[data-training-hours]"); if (trainingSel && active !== trainingSel) trainingSel.value = String(BOT_CONFIG.trainingHours);
    const capBtn = botRoot.querySelector("[data-capture-item]");
    if (capBtn) capBtn.classList.toggle("active", botIsCaptureOn());
    const capHint = botRoot.querySelector("[data-capture-hint]");
    if (capHint) capHint.classList.toggle("on", botIsCaptureOn());
    botRenderProtectedList();
    if (botRoot.querySelector('[data-afk-view]')?.hidden===false) {
      if (afk.enabled && afk.phase==='switch') {
        // A lista no jogo pode estar sendo montada; durante a troca, atualizar
        // apenas o texto de status e nunca reconstruir a lista AFK a cada 1s.
        const status=botRoot.querySelector('[data-afk-status]');
        if (status) {
          status.textContent=`TROCANDO PERSONAGEM · ${afk.target} · ${afk.stage} · ${afk.message}`;
          status.dataset.running='true';
        }
      } else afkRender(botRoot);
    }
  };
  function setupBotTab() {
    const shadow = botRoot; if (!shadow || (botStatus && botFlow)) return;
    botStatus = shadow.querySelector("[data-status]");
    botFlow = shadow.querySelector("[data-flow]");
    const lure = shadow.querySelector("[data-lure]");
    const huntInput = shadow.querySelector("[data-hunt]");
    const staminaSel = shadow.querySelector("[data-stamina-min]");
    const trainingSel = shadow.querySelector("[data-training-hours]");
    if (!botStatus || !botFlow || !lure) return;
    lure.value = String(BOT_CONFIG.lureModo);
    if (huntInput) {
      huntInput.value = BOT_CONFIG.huntName;
      let huntSaveTimer = null;
      const commitHunt = (raw, silent) => {
        const v = String(raw || "").trim();
        if (v === BOT_CONFIG.huntName) { if (!silent) botUpdatePanel(); return; }
        BOT_CONFIG.huntName = v; BOT_CONFIG.lastHuntName = v;
        botSaveConfig();
        if (v) botLog("info", `🎯 ${v}`);
        else botLog("warn", "⚠ Hunt alvo esvaziada");
        if (!silent) botUpdatePanel();
      };
      huntInput.oninput = (e) => { clearTimeout(huntSaveTimer); const v = e.target.value; huntSaveTimer = setTimeout(() => commitHunt(v, true), 600); };
      huntInput.onchange = (e) => { clearTimeout(huntSaveTimer); commitHunt(e.target.value, false); };
      huntInput.onblur = (e) => { clearTimeout(huntSaveTimer); commitHunt(e.target.value, false); };
      huntInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(huntSaveTimer); commitHunt(e.target.value, false); huntInput.blur(); } };
    }
    if (staminaSel) {
      staminaSel.value = String(BOT_CONFIG.minStaminaHours);
      staminaSel.onchange = (e) => {
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= 0 && v <= 12) { BOT_CONFIG.minStaminaHours = v; botSaveConfig(); botLog("info", `⏱ Stamina mín: ${v}h`); }
      };
    }
    if (trainingSel) {
      trainingSel.value = String(BOT_CONFIG.trainingHours);
      trainingSel.onchange = (e) => {
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= 4 && v <= 12) { BOT_CONFIG.trainingHours = v; botSaveConfig(); botLog("info", `🏋 Treino: ${v}h`); }
      };
    }
    const addBtn = shadow.querySelector("[data-add-item]");
    if (addBtn) addBtn.onclick = () => {
      const name = window.prompt("Nome EXATO do item (como aparece no aria-label do jogo, ex: Health Potion):");
      if (name && name.trim()) {
        const v = name.trim();
        if (!BOT_CONFIG.protectedItems.some((it) => botNormalize(it) === botNormalize(v))) {
          BOT_CONFIG.protectedItems.push(v); botSaveConfig(); botUpdatePanel(); botApplyInventoryMarkers();
          botLog("success", `+ ${v}`);
        }
      }
    };
    const capBtn = shadow.querySelector("[data-capture-item]");
    if (capBtn) capBtn.onclick = () => { botToggleInvCapture(); };
    shadow.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-remove]");
      if (!btn) return;
      const idx = Number(btn.dataset.remove);
      if (Number.isInteger(idx) && idx >= 0) {
        const removed = BOT_CONFIG.protectedItems[idx];
        BOT_CONFIG.protectedItems.splice(idx, 1);
        botSaveConfig(); botUpdatePanel(); botApplyInventoryMarkers();
        botLog("warn", `− ${removed}`);
      }
    });
    const enforceCb = shadow.querySelector("[data-unprotect-extras]");
    if (enforceCb) {
      enforceCb.checked = Boolean(BOT_CONFIG.unprotectExtras);
      enforceCb.onchange = () => { BOT_CONFIG.unprotectExtras = enforceCb.checked; botSaveConfig(); botUpdatePanel(); botLog("info", `Desproteger: ${enforceCb.checked ? "ON" : "OFF"}`); };
    }
    const invMarkCb = shadow.querySelector("[data-show-inv-markers]");
    if (invMarkCb) {
      invMarkCb.checked = Boolean(BOT_CONFIG.showInventoryMarkers);
      invMarkCb.onchange = () => { BOT_CONFIG.showInventoryMarkers = invMarkCb.checked; botSaveConfig(); botUpdatePanel(); botApplyInventoryMarkers(); botLog("info", `Marcadores: ${invMarkCb.checked ? "ON" : "OFF"}`); };
    }
    const skipProtCb = shadow.querySelector("[data-skip-protection]");
    if (skipProtCb) {
      skipProtCb.checked = Boolean(BOT_CONFIG.skipProtection);
      skipProtCb.onchange = () => { BOT_CONFIG.skipProtection = skipProtCb.checked; botSaveConfig(); botUpdatePanel(); botLog("warn", `Pular prot: ${skipProtCb.checked ? "ON" : "OFF"}`); };
    }
    shadow.querySelector("[data-bot=toggle]").onclick = () => {
      if (afk.enabled) {
        botLogAndToast('warn','Controle a caça pelo botão Iniciar/Parar AFK.');
        return;
      }
      if (window.__emerickPartyGate?.enabled) {
        botLogAndToast("warn", "Controle a caça pelo botão Iniciar/Parar Party.");
        return;
      }
      BOT_CONFIG.botAtivo = !BOT_CONFIG.botAtivo;
      botSaveConfig(); botUpdatePanel(); botApplyInventoryMarkers();
      botLogAndToast(BOT_CONFIG.botAtivo ? "success" : "warn", BOT_CONFIG.botAtivo ? "🟢 BOT ON" : "🔴 BOT OFF");
    };
    lure.onchange = (e) => {
      const raw = e.target.value;
      BOT_CONFIG.lureModo = (raw === "off") ? "off" : "max";
      botSaveConfig(); botUpdatePanel();
      botLog("info", `🎯 Lure: ${BOT_CONFIG.lureModo === "off" ? "OFF" : "MAX"}`);
    };
    shadow.querySelector("[data-clear]").onclick = () => {
      botClearFlow("manual");
      botResetRecoveryCounters();
      botHuntAsyncRunning = false;
      botTrainingAsyncRunning = false;
      botTrainingStartedAt = 0;
      botTrainingTotalMs = 0;
      botLogAndToast("flow", "↺ Fluxo limpo");
      botUpdatePanel();
    };
    botUpdatePanel();
  }

  // ==================== KILL SWITCH ====================
  const botKillSwitch = () => {
    botClearFlow("kill switch");
    botResetRecoveryCounters();
    botRestartCooldownUntil = Date.now() + BOT_RESTART_COOLDOWN_MS;
    botPendingIntent.clear();
    botHuntAsyncRunning = false;
    botTrainingAsyncRunning = false;
    botTrainingStartedAt = 0;
    botTrainingTotalMs = 0;
    botLogAndToast("warn", "🛑 Parado 30s");
    botUpdatePanel();
  };

  // ==================== LOOP ====================
  function botProcess() {
    // Primeiro, em Solo, Lider E Membro: os mecanismos de seguranca.
    // A restricao de executar caça/venda vem APOS reconexao e AFK.
    if (botBusy || (!BOT_CONFIG.botAtivo && !window.__emerickPartyGate?.enabled)) return;
    if (botHandleConnectionLost()) { botUpdatePanel(); return; }
    if (botHandleInactivity()) { botUpdatePanel(); return; }
    if (!BOT_CONFIG.botAtivo || !botPartyAllowsHunt()) return;
    const flow = botGetFlow(); if (!flow) return;
    botBusy = true;
    try {
      if (flow.etapa === "AGUARDANDO_VENDA") {
        if (botSellPanelOpen() || botSellPanelReady()) {
          botPanelWaitStart = Date.now(); botProtectAttempts = 0;
          botLog("flow", "🛒 Loja aberta");
          botSetFlow("AGUARDANDO_PAINEL");
          return;
        }
        const sellButton = botFindAnyTextMulti(["VENDA RÁPIDA", "VENDA RAPIDA", "VENDER RÁPIDA", "SELL"]);
        if (sellButton && botClick(sellButton)) {
          botPanelWaitStart = Date.now(); botProtectAttempts = 0;
          botLog("flow", "🛒 Abrindo loja");
          botSetFlow("AGUARDANDO_PAINEL");
        } else if (Date.now() - flow.timestamp > 3000 && (botFindPlayButton() || botFindGameModePanel())) {
          botLog("flow", "✓ Sem itens");
          botSetFlow("AGUARDANDO_CHECAR_STAMINA");
        }
      }
      else if (flow.etapa === "AGUARDANDO_PAINEL") {
        if (botSellPanelReady()) {
          const totalItems = botFindAllSellItems().length;
          botLog("flow", `📦 ${totalItems} item${totalItems === 1 ? "" : "s"}`);
          if (BOT_CONFIG.skipProtection && !botIsPartyLeader()) {
            botLog("warn", "⏭ Pular prot");
            botSetFlow("AGUARDANDO_VENDER");
            botSellRetryCount = 0; botSellLastClickAt = 0;
            return;
          }
          const r = botSyncItemsToProtectedList();
          if (r.protectedCount || r.unprotectedCount) botLog("info", `🔒 ${r.actions.map(a => `${a.action}${a.name}`).join(" · ")}`);
          else if (r.skippedIntent) botLog("info", `⏳ ${r.skippedIntent} cooldown`);
          botProtectAttempts += 1;
          botVerifyUntil = Date.now() + BOT_VERIFY_DELAY_MS;
          botSetFlow("AGUARDANDO_VERIFICAR");
        } else if (Date.now() - botPanelWaitStart > BOT_PANEL_READY_TIMEOUT_MS) {
          botLog("error", "✗ Painel não abriu");
          if (afk.enabled) afkStop('Venda rápida não abriu. AFK pausado.');
          else botClearFlow("painel não abriu");
        }
      }
      else if (flow.etapa === "AGUARDANDO_VERIFICAR") {
        if (Date.now() < botVerifyUntil) return;
        const v = botAllItemsInCorrectState();
        if (v.ok) {
          botLog("flow", `✓ Proteção OK · ${v.total}`);
          botProtectAttempts = 0; botLastWrongCount = -1; botStagnantCycles = 0;
          const nativeSelected = botQuickSellSelected();
          // Mesmo com itens na mochila, o contador nativo 0 / N
          // confirma que nenhum foi selecionado apos sincronizar protecao.
          if (nativeSelected?.selected === 0 || !botHasSellableItems()) {
            if (nativeSelected?.selected === 0 && botHasSellableItems())
              botLog('warn', '⚠ Contador 0 / N diverge dos icones; CANCELAR por seguranca');
            if (botBeginSaleClose('Nenhum item selecionado para venda')) return;
            // Uma venda anterior pode ter fechado a loja sozinha.
            if (botSaleReturnedHome()) { botSaleFinish(); return; }
            if (Date.now() - flow.timestamp > 12000 && afk.enabled)
              afkStop('Venda rápida: CANCELAR não encontrado. AFK pausado.');
            else botLog('warn','⚠ Nenhum item selecionado: aguardando CANCELAR da venda');
            return;
          }
          botSetFlow("AGUARDANDO_VENDER");
          botSellRetryCount = 0; botSellLastClickAt = 0;
          botSellPendingSuccess = false;
          return;
        }
        const wrongCount = v.wrong.length;
        if (wrongCount === botLastWrongCount) botStagnantCycles += 1;
        else { botStagnantCycles = 0; botLastWrongCount = wrongCount; }
        if (botStagnantCycles >= BOT_STAGNATION_LIMIT) {
          botLog("error", `✗ Prot travada: ${v.wrong.map(w => w.name).join(", ")}`);
          botClearFlow("estagnação");
          return;
        }
        if (botProtectAttempts < BOT_MAX_PROTECT_ATTEMPTS) {
          const stillWrong = v.wrong.map(w => w.name).join(", ");
          const r = botSyncItemsToProtectedList();
          if (r.protectedCount || r.unprotectedCount) botLog("info", `↻ ${r.actions.map(a => `${a.action}${a.name}`).join(" · ")} → falta ${stillWrong}`);
          else if (r.skippedIntent) botLog("info", `↻ cooldown → falta ${stillWrong}`);
          botProtectAttempts += 1;
          botVerifyUntil = Date.now() + BOT_VERIFY_DELAY_MS;
          botSetFlow("AGUARDANDO_PAINEL");
        } else {
          botLog("error", `✗ Sync falhou ${BOT_MAX_PROTECT_ATTEMPTS}x`);
          botClearFlow("sync esgotado");
        }
      }
      else if (flow.etapa === "AGUARDANDO_VENDER") {
        if (!BOT_CONFIG.skipProtection || botIsPartyLeader()) {
          const v = botAllItemsInCorrectState();
          if (!v.ok) {
            botLog('error', `✗ Protecao final: ${v.wrong.map(w=>w.name).join(', ')}`);
            botClearFlow('protecao alterada antes da venda');
            return;
          }
        }
        // A confirmacao nativa tem prioridade: 0 / 6 nao significa mochila
        // vazia; significa que nenhum item pode ser vendido nesta rodada.
        const nativeSelected = botQuickSellSelected();
        if (nativeSelected?.selected === 0 || !botHasSellableItems()) {
          if (botBeginSaleClose('Lista sem selecionados')) return;
          if (botSaleReturnedHome()) { botSaleFinish(); return; }
          if (Date.now() - flow.timestamp > 12000 && afk.enabled)
            afkStop('Venda rápida: não foi possível fechar a lista vazia.');
          return;
        }
        // Aguardar o jogo processar a venda; sem rajadas a cada 400 ms.
        if (botSellPendingSuccess &&
            Date.now() - botSellLastClickAt < BOT_SELL_RETRY_MS) return;
        const confirm = botFindSellConfirmButton();
        if (!confirm) {
          if (botSaleReturnedHome()) { botSaleFinish(); return; }
          // Pode restar apenas CANCELAR apos finalizar a venda.
          if (botSellPendingSuccess && botBeginSaleClose('Venda efetuada')) return;
          return;
        }
        if (botSellRetryCount >= BOT_SELL_MAX_RETRIES) {
          botLog('warn','⚠ Vender sem confirmacao: tentando fechar a loja');
          if (botBeginSaleClose('Limite de tentativas')) return;
          botClearFlow('nao foi possivel concluir a venda');
          return;
        }
        if (botClick(confirm)) {
          botLog('flow', `🖱 VENDER · tentativa ${botSellRetryCount+1}`);
          botSellLastClickAt = Date.now();
          botSellRetryCount += 1;
          botSellPendingSuccess = true;
        }
      }
      else if (flow.etapa === "AGUARDANDO_FECHAR_VENDA") {
        // Nao iniciar PLAY, HUNT ou BESTIARIO com a loja aberta.
        if (botSaleReturnedHome()) {
          if (!botSaleHiddenSince) botSaleHiddenSince = Date.now();
          if (Date.now() - botSaleHiddenSince >= 650) botSaleFinish();
          return;
        }
        botSaleHiddenSince = 0;
        const cancel = botFindCancelButton();
        if (cancel && Date.now() - botSaleCloseClickAt >= 2500 &&
            botSaleCloseAttempts < 3) {
          try {
            cancel.click();
            botSaleCloseAttempts += 1;
            botSaleCloseClickAt = Date.now();
            botLog('warn', `↻ CANCELAR da venda · tentativa ${botSaleCloseAttempts}`);
          } catch(_) { /* falha segura: nao clicar em outra janela */ }
        }
        if (Date.now() - flow.timestamp > 14000) {
          botLog('error','✗ Venda rapida nao fechou: Hunt bloqueada por seguranca');
          if (afk.enabled) afkStop('Venda rápida não fechou. AFK pausado; verifique a janela.');
          else botClearFlow('janela de venda permaneceu aberta');
        }
      }
      else if (flow.etapa === "AGUARDANDO_CHECAR_STAMINA") {
        // Transicao por level: esta etapa so vem APOS o fluxo de venda.
        if (afk.enabled && afk.levelTransition?.state==='selling') {
          afk.levelTransition=null; afkPersist();
        }
        // Stamina individual da Party.
        // O treinamento pertence ao controlador da Party.
        if (botIsPartyLeader()) {
          const st=botReadStamina();
          const threshold=Number(window.__emerickPartyGate?.minStaminaHours);
          if (st!==null && Number.isFinite(threshold) && st<=threshold) {
            window.__emerickPartyGate?.requestTraining?.('stamina');
            return;
          }
          botSetFlow("AGUARDANDO_INICIAR_HUNT");
          return;
        }
        const st = botReadStamina();
        if (afk.enabled && afk.phase==='hunt') {
          if (st === null) {
            afkSay('Stamina não identificada; aguardando leitura segura.');
            return;
          }
          const own=afkProfile(afk.current);
          if (!own) {afkStop('Personagem atual não configurado.');return;}
          botSetFlow(st <= Number(own.stamina)
            ? 'AGUARDANDO_AFK_TREINO' : 'AGUARDANDO_INICIAR_HUNT');
          return;
        }
        if (st === null) {
          botLog("warn", "⚠ Stamina não lida · assumindo OK");
          botSetFlow("AGUARDANDO_INICIAR_HUNT");
          return;
        }
        const stStr = botFmtStamina(st);
        if (st < BOT_CONFIG.minStaminaHours) {
          botLog("flow", `⏱ ${stStr} → treinar`);
          botSetFlow("AGUARDANDO_TREINAR");
        } else {
          botLog("flow", `⏱ ${stStr} → caçar`);
          botSetFlow("AGUARDANDO_INICIAR_HUNT");
        }
      }
      else if (flow.etapa === "AGUARDANDO_AFK_TREINO") {
        afkHandleTrainingStep();
      }
      else if (flow.etapa === "AGUARDANDO_TREINAR") {
        if (botIsPartyLeader()) {
          botLog("flow", "♛ Party · pular treino pendente");
          botSetFlow("AGUARDANDO_INICIAR_HUNT");
          return;
        }
        if (botTrainingAsyncRunning) return;
        botTrainingAsyncRunning = true;
        botLog("info", "🚦 Iniciando treino");
        botExecutarTreino()
          .then((ok) => {
            botTrainingAsyncRunning = false;
            botTrainingStartedAt = 0;
            botTrainingTotalMs = 0;
            if (ok) {
              botLogAndToast("flow", "✅ Treino concluído");
              botSetFlow("AGUARDANDO_VENDA");
            } else {
              botLog("warn", "⚠ Treino falhou");
              botClearFlow("falha treino");
            }
          })
          .catch((e) => {
            botTrainingAsyncRunning = false;
            botTrainingStartedAt = 0;
            botTrainingTotalMs = 0;
            botLog("error", `✗ ${e?.message || e}`);
            botClearFlow("erro treino");
          });
      }
      else if (flow.etapa === "AGUARDANDO_INICIAR_HUNT") {
        if (botHuntAsyncRunning) return;
        // AFK: um perfil editado durante a caça vale para a próxima Hunt.
        // Este é o mesmo ponto do motor compartilhado usado por Solo/Party.
        if (afk.enabled && afk.phase==='hunt' && !afkApplyProfile()) {
          afkStop(`Configure a Hunt de ${afk.current} antes de iniciar a proxima.`);
          return;
        }
        if (!BOT_CONFIG.huntName || !BOT_CONFIG.huntName.trim()) {
          botLogAndToast("error", "⚠ Defina uma hunt alvo na aba Hunt");
          botClearFlow("hunt vazia");
          return;
        }
        botHuntAsyncRunning = true;
        botLog("info", "🚦 Iniciando hunt");
        botExecutarIniciarHuntEAjustarLure()
          .then((ok) => {
            botHuntAsyncRunning = false;
            if (!botIsPartyLeader() || !ok) {
              emHuntPriority.active=false;
              emHuntPriority.stage='ready';
            } else {
              emHuntPriority.active=true;
              emHuntPriority.stage='position';
            }
            if (ok) {
              if (afk.enabled && afk.phase==='hunt') {
                afk.runningTier=afkHuntFor(afk.current)?.index??null;
                afkPersist();
              }
              botLogAndToast("flow", "✅ Ciclo completo");
              botClearFlow("ciclo completo");
            } else {
              botLog("warn", "⚠ Hunt falhou");
              botClearFlow("falha na hunt");
            }
          })
          .catch((e) => {
            botHuntAsyncRunning = false;
            emHuntPriority.active=false;
            emHuntPriority.stage='ready';
            botLog("error", `✗ ${e?.message || e}`);
            botClearFlow("erro async");
          });
      }
    } finally { botBusy = false; botUpdatePanel(); }
  }

  const botStartReturn = () => {
    if (!botPartyAllowsHunt()) { botLog("warn", "Party: aguardando lider e participantes."); return; }
    if (!BOT_CONFIG.botAtivo) { BOT_CONFIG.botAtivo = true; botSaveConfig(); }
    if (!BOT_CONFIG.huntName || !BOT_CONFIG.huntName.trim()) {
      botLogAndToast("error", "⚠ Defina uma hunt alvo antes de iniciar");
      botUpdatePanel();
      return;
    }
    botRestartCooldownUntil = 0;
    botResetRecoveryCounters();
    botScreenSig = ""; botScreenSigSince = 0;
    botLastAbortFrom = null; botLastAbortAt = 0;
    botSellRetryCount = 0; botSellLastClickAt = 0;
    botSaleCloseClickAt = 0; botSaleCloseAttempts = 0; botSaleHiddenSince = 0;
    botSellPendingSuccess = false;
    botPendingIntent.clear();
    botLastWrongCount = -1; botStagnantCycles = 0;
    botPage = 0; botWaitingPage = false;
    botHuntAsyncRunning = false;
    botTrainingAsyncRunning = false;
    botTrainingStartedAt = 0;
    botTrainingTotalMs = 0;
    botLogAndToast("flow", "▶ Iniciando ciclo");
    botSetFlow("AGUARDANDO_VENDA");
    botProcess();
  };
  // ==================== AFK: ORQUESTRACAO SOLO POR PERSONAGEM ====================
  // Perfis compartilhados na mesma conta; execucao restrita a esta aba (sessionStorage).
  const AFK_PROFILES_KEY = 'emerickst_afk_profiles_v1';
  const AFK_SESSION_KEY = 'emerickst_afk_session_v1';
  const afkNorm = value => botNormalize(value);
  const afkReadJson = (storage, key, fallback) => {
    try { return JSON.parse(storage.getItem(key) || 'null') || fallback; }
    catch (_) { return fallback; }
  };
  const afkProfiles = afkReadJson(localStorage, AFK_PROFILES_KEY, {roster:[], profiles:{}});
  if (!Array.isArray(afkProfiles.roster)) afkProfiles.roster=[];
  if (!afkProfiles.profiles || typeof afkProfiles.profiles !== 'object') afkProfiles.profiles={};
  if (!Array.isArray(afkProfiles.queue)) afkProfiles.queue=[];
  const afk = Object.assign({enabled:false, current:'', phase:'idle', target:'', stage:'',
    visited:[], since:0, attempt:0, lastAction:0, message:'Escolha os personagens e a ordem da rotação.', solo:null},
    afkReadJson(sessionStorage, AFK_SESSION_KEY, {}));
  if (!Array.isArray(afk.visited)) afk.visited=[];
  if (typeof afk.editing !== 'string') afk.editing='';
  if (!afk.enabled && afk.detectedSource==='informado manualmente') {
    afk.current='';afk.currentVocation='';afk.detectedSource='aguardando entrada';
  }
  let afkBusy=false;
  const afkPersist = () => {
    try { localStorage.setItem(AFK_PROFILES_KEY, JSON.stringify(afkProfiles)); } catch (_) {}
    try { sessionStorage.setItem(AFK_SESSION_KEY, JSON.stringify(afk)); } catch (_) {}
  };
  const afkSay = (message, level='info') => {
    if (afk.message !== message) botLog(level, '🌙 AFK · '+message);
    afk.message=message; afkPersist();
  };
  const afkProfile = name => {
    const key=afkNorm(name);
    if (!key) return null;
    if (!afkProfiles.profiles[key]) afkProfiles.profiles[key]={
      name: String(name).trim(), hunt:'', lure:'max', stamina:1, next:''};
    return afkProfiles.profiles[key];
  };
  // Migracao lazy: preserva os campos legados e a configuracao da segunda Hunt.
  const afkHunts = p => {
    if (!p) return [];
    if (!Array.isArray(p.hunts) || !p.hunts.length) {
      p.hunts=[{minLevel:1,hunt:String(p.hunt||''),lure:p.lure==='off'?'off':'max'}];
      if (p.secondEnabled && Number.isSafeInteger(Number(p.threshold)) && Number(p.threshold)>=2)
        p.hunts.push({minLevel:Number(p.threshold),hunt:String(p.hunt2||''),lure:p.lure2==='off'?'off':'max'});
    }
    return p.hunts;
  };
  const afkValidHunts = p => {
    const rows=afkHunts(p);
    return rows.length>=1 && rows.length<=8 && rows.every((r,i)=>
      Number.isSafeInteger(Number(r.minLevel)) && Number(r.minLevel)>=1 &&
      Number(r.minLevel)<=9999 && (i===0 || Number(r.minLevel)>Number(rows[i-1].minLevel)));
  };
  // Perfil nativo: avatar e level sao IRMAOS; o bloco seguinte tem vocacao e nome.
  // O container do avatar pode ter dimensoes 0 (arte absoluta), portanto
  // nao descartamos a identidade apenas por offsetWidth/offsetHeight.
  const afkLiveIdentity = () => {
    // Perfil real: data-guide, sem classes CSS dependentes de sistema/zoom.
    // Level fica no avatar; vocacao e nome ficam no bloco seguinte.
    const found=[];
    for (const avatar of document.querySelectorAll('[data-guide="character-profile-avatar"]')) {
      if (!avatar.isConnected || avatar.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]')) continue;
      const options=[avatar.nextElementSibling,avatar.parentElement?.nextElementSibling];
      let identity=null;
      for (const info of options) {
        if (!info?.isConnected || info.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]')) continue;
        const headings=[...info.children].filter(e=>e.tagName==='H5');
        if (headings.length!==2) continue;
        const vocation=String(headings[0].textContent||'').trim().toLowerCase();
        const name=String(headings[1].textContent||'').trim();
        if (!/^(monk|knight|paladin|sorcerer|druid)$/.test(vocation) ||
            name.length<2 || name.length>64) continue;
        identity={name,vocation};
        break;
      }
      if (!identity) continue;
      // Nao usar stamina, relogio nem outros numeros da pagina como level.
      const texts=[...avatar.querySelectorAll('p')]
        .map(p=>String(p.textContent||'').trim())
        .filter(s=>/^\d{1,4}$/.test(s));
      const levels=[...new Set(texts.map(Number).filter(n=>n>=1&&n<=9999))];
      if (levels.length>1) return null;
      found.push({...identity,level:levels.length===1?levels[0]:null});
    }
    if (!found.length) return null;
    // React pode duplicar o mesmo perfil; perfis conflitantes sao rejeitados.
    if (new Set(found.map(x=>afkNorm(x.name)+'|'+x.vocation)).size!==1) return null;
    const levels=[...new Set(found.map(x=>x.level).filter(Number.isInteger))];
    if (levels.length>1) return null;
    return {...found[0],level:levels.length===1?levels[0]:null};
  };
  const afkLevel = name => {
    const live=afkLiveIdentity();
    if (live && afkNorm(live.name)!==afkNorm(name)) return null;
    if (live && Number.isInteger(live.level)) return live.level;
    const saved=afkProfiles.roster.find(r=>afkNorm(r.name)===afkNorm(name))?.level;
    const cached=Number.isSafeInteger(saved) && saved>=1 && saved<=9999 ? saved : null;
    // A lista SEUS PERSONAGENS e confiavel APOS uma entrada confirmada.
    // Usar este valor como fallback somente para o mesmo personagem da sessao.
    // A troca automatica de Hunt por level continua exigindo leitura NATIVA ao vivo.
    if (botInHunt() && afkNorm(name)===afkNorm(afk.current)) {
      const confirmed=String(afk.detectedSource||'').startsWith('entrada');
      return confirmed && !afk.pendingLogin && afk.phase!=='switch' ? cached : null;
    }
    return cached;
  };
  const afkHuntFor = name => {
    const p=afkProfile(name), rows=afkHunts(p);
    if (!afkValidHunts(p)) return null;
    // Primeira Hunt = padrao. So as Hunts seguintes possuem desbloqueio por level.
    // Uma Hunt funciona inclusive se o level ainda nao estiver disponivel.
    const level=afkLevel(name);
    const index=rows.length===1 ? 0 : level===null ? -1
      : Math.max(0,rows.findLastIndex(row=>level>=Number(row.minLevel)));
    if (index<0) return null;
    return {hunt:String(rows[index].hunt||'').trim(),lure:rows[index].lure==='off'?'off':'max',
      minLevel:Number(rows[index].minLevel),index,level};
  };
  // Requer duas leituras seguidas para reconhecer uma promocao de Hunt.
  let afkLevelProbe='';
  const afkTransitionTick = () => {
    if (!afk.enabled || afk.phase!=='hunt' || window.__emerickPartyGate?.enabled) return false;
    const now=Date.now(), transition=afk.levelTransition;
    if (transition) {
      if (transition.character!==afkNorm(afk.current)) {
        afkStop('Transicao de Hunt perdeu a identidade do personagem.');return true;
      }
      if (transition.state==='finishing') {
        if (botInHunt()) {
          if (now-transition.startedAt>20000) afkStop('Finalizar Hunt nao foi confirmado em 20 segundos.');
          return true;
        }
        if (!botFindPlayButton() && !botFindGameModePanel()) {
          if (now-transition.startedAt>20000) afkStop('Fim da Hunt sem retorno ao jogo.');
          return true;
        }
        transition.state='selling'; transition.startedAt=now;afkPersist();
        afkSay('Hunt finalizada; iniciando a venda antes da proxima Hunt.');
        botStartReturn(); // O MESMO motor de venda/protecao do Solo.
        return true;
      }
      // Esperar o motor EXISTENTE fechar/ignorar venda e checar stamina.
      if (transition.state==='selling') {
        if (!botGetFlow() && !botInHunt() && now-transition.startedAt>30000) {
          afkStop('Transicao de level: venda nao iniciou ou nao concluiu.');return true;
        }
        return false;
      }
    }
    if (!botInHunt() || botGetFlow() || botHuntAsyncRunning || botTrainingAsyncRunning) {
      afkLevelProbe='';return false;
    }
    const live=afkLiveIdentity();
    if (!live || !Number.isInteger(live.level) || afkNorm(live.name)!==afkNorm(afk.current)) {afkLevelProbe='';return false;}
    const profile=afkProfile(afk.current), rows=afkHunts(profile);
    if (!afkValidHunts(profile) || rows.length<2) return false;
    const chosen=afkHuntFor(afk.current);
    if (!chosen?.hunt) return false;
    const running=botReadHuntStatus()?.huntName;
    if (!running) return false;
    const matches=rows.map((r,i)=>afkNorm(r.hunt)===afkNorm(running)?i:-1).filter(i=>i>=0);
    const tracked=Number.isInteger(afk.runningTier)?afk.runningTier:-1;
    const currentIndex=(tracked>=0 && matches.includes(tracked)) ? tracked : (matches.length===1?matches[0]:-1);
    // So interrompe a Hunt reconhecida de uma faixa INFERIOR.
    if (currentIndex<0 || chosen.index<=currentIndex) {afkLevelProbe='';return false;}
    const signal=[afkNorm(afk.current),live.level,currentIndex,chosen.index,running].join('|');
    if (afkLevelProbe!==signal) {afkLevelProbe=signal;return false;}
    const targets=[...document.querySelectorAll('[data-guide="hunt-finish-button"]')]
      .filter(el=>botVisible(el) && !el.closest('#stonegy-tm-overlay') &&
        [...el.querySelectorAll('h5')].some(h=>afkNorm(h.textContent)==='FINALIZAR HUNT'));
    if (targets.length!==1) return false;
    const finish=targets[0].querySelector('.highlight-animation')||targets[0];
    if (!botVisible(finish)) return false;
    afk.levelTransition={character:afkNorm(afk.current),from:running,to:chosen.hunt,
      state:'finishing',startedAt:now};
    afkPersist(); // trava antes do clique: evita duplos comandos
    if (!afkNativeClick(finish)) {afk.levelTransition=null;afkPersist();return false;}
    afkSay(`Level ${live.level}: finalizando ${running} para vender e iniciar ${chosen.hunt}.`);
    return true;
  };
  // A fonte de verdade dos personagens e o HTML SEUS PERSONAGENS.
  // Uma fila antiga pode conter nomes digitados incorretamente: so nomes
  // confirmados pela lista do jogo sao exibidos e podem ser executados.
  // Mantemos ordem/checkbox/Hunt/Skill dos nomes autenticos.
  const afkQueueSync = () => {
    // Nunca reconciliar a fila automaticamente durante uma Hunt ou troca.
    // A lista do Stonegy pode montar em partes ao trocar de pagina;
    // a conciliacao neste momento removia o proximo personagem da fila.
    // Manter as mudancas explicitas do usuario na fila (marcar/reordenar).
    if (afk.enabled) return afkProfiles.queue;
    const official=[];const valid=new Set();
    for (const row of afkProfiles.roster) {
      const name=String(row?.name||'').trim();const key=afkNorm(name);
      if (!name || !key || valid.has(key)) continue;
      const voc=String(row.vocation||'').toLowerCase();
      if (!/^(monk|paladin|knight|sorcerer|druid)$/.test(voc)) continue;
      official.push({name,vocation:voc});valid.add(key);
    }
    // Ate a PRIMEIRA leitura oficial, guardar a fila antiga somente no
    // armazenamento: nao exibir nem executar nomes que podem ser manuais.
    // Assim, ao ler a lista, conservamos a ordem/checkbox dos nomes validos.
    // So reconciliar quando uma lista oficial de pelo menos dois
    // personagens foi confirmada; caso contrario conservar tudo.
    if (valid.size < 2) return afkProfiles.queue;
    const old=afkProfiles.queue;
    const seen=new Set();const queue=[];
    for (const row of old) {
      const key=afkNorm(row?.name);
      if (!valid.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({name:official.find(c=>afkNorm(c.name)===key).name,enabled:row.enabled===true});
    }
    for (const row of official) {
      const key=afkNorm(row.name);
      if (seen.has(key)) continue;
      seen.add(key);queue.push({name:row.name,enabled:false});
    }
    // Perfis digitados errados sao apagados SOMENTE depois de uma leitura
    // oficial completa. Nao apagar informacoes durante montagem da tela.
    if (valid.size) {
      for (const key of Object.keys(afkProfiles.profiles))
        if (!valid.has(key)) delete afkProfiles.profiles[key];
    }
    if (JSON.stringify(queue)!==JSON.stringify(old)) {
      afkProfiles.queue=queue;afkPersist();
    }
    return afkProfiles.queue;
  };
  const afkSequence = () => afkQueueSync().filter(row=>row.enabled).map(row=>row.name);
  // O perfil pode ser editado sempre; a fila so pode ser alterada daqui para
  // frente, enquanto estamos caçando. A troca em andamento fica congelada.
  const afkQueueCanEdit = (list, index) => {
    if (!afk.enabled) return true;
    if (afk.phase!=='hunt' || index<0 || index>=list.length) return false;
    const currentIndex=list.findIndex(row=>afkNorm(row.name)===afkNorm(afk.current));
    if (currentIndex<0 || index<=currentIndex) return false;
    return !afk.visited.some(name=>afkNorm(name)===afkNorm(list[index].name));
  };
  const afkNames = () => afkProfiles.roster.map(x=>x.name);
  const afkVocation = name => afkProfiles.roster.find(c=>afkNorm(c.name)===afkNorm(name))?.vocation || '';
  // Na pagina SEUS PERSONAGENS, os cartoes sao a referencia principal.
  // O cabecalho e a classe externa variam durante a navegacao React.
  // Nao e seguro usar o primeiro cartao nem a posicao como identidade.
  // Localiza os cartoes REAIS da tela de selecao pelo texto semantico.
  // Os hashes css-* do MUI mudam; nao devem impedir o AFK de chegar a Zhang.
  // A estrutura estavel: cartao clicavel com h5 Nome e h5 Level N VOCACAO.
  const afkFindCards = () => {
    const vocationRe=/^Level\s+\d+\s+(KNIGHT|SORCERER|DRUID|PALADIN|MONK)\s*$/i;
    const visible = el => {
      if (!el?.isConnected || el.closest('#stonegy-tm-overlay')) return false;
      try {
        const css=getComputedStyle(el);
        if (css.display==='none' || css.visibility==='hidden' || css.visibility==='collapse') return false;
        const rect=el.getBoundingClientRect();
        return rect.width>8 && rect.height>8;
      } catch (_) { return false; }
    };
    const cards=[];
    const used=new Set();
    // Os cards têm cursor:pointer inline, mesmo quando CSS class é trocada.
    const nodes=document.querySelectorAll('.css-1n31i2o > .css-16d0rbh, div[style*="cursor: pointer"], div[style*="cursor:pointer"], [role="button"]');
    for (const node of nodes) {
      if (used.has(node) || !visible(node)) continue;
      const headings=[...node.querySelectorAll('h5')];
      if (headings.length!==2) continue;
      const name=String(headings[0].textContent||'').trim();
      const info=String(headings[1].textContent||'').trim();
      const match=vocationRe.exec(info);
      if (!name || !match || name.length>64 || vocationRe.test(name)) continue;
      // O pai do cartao deve ser o agrupamento comum da lista.
      // Evita reconhecer popups ou outros controles isolados.
      cards.push({name,vocation:match[1].toLowerCase(),level:Number(/\d+/.exec(info)?.[0]),node});
      used.add(node);
    }
    const byParent=new Map();
    for (const card of cards) {
      const parent=card.node.parentElement;
      if (!parent || !visible(parent)) continue;
      if (!byParent.has(parent)) byParent.set(parent,[]);
      byParent.get(parent).push(card);
    }
    const groups=[...byParent.values()].filter(g=>g.length>=2 &&
      new Set(g.map(c=>afkNorm(c.name))).size===g.length);
    if (groups.length!==1) return [];
    return groups[0];
  };
  const afkSelectionRoot = () => {
    const cards=afkFindCards();
    if (cards.length<2) return null;
    return cards[0].node.closest('.css-1nqo1lq') || cards[0].node.closest('.css-1n31i2o') || cards[0].node.parentElement;
  };
  const afkScanRoster = () => {
    const cards=afkFindCards();
    if (!cards.length) return cards;
    const previous=JSON.stringify(afkProfiles.roster);
    afkProfiles.roster=cards.map(({name,vocation,level})=>({name,vocation,level}));
    for (const {name} of cards) afkProfile(name);
    afkQueueSync(); // sincroniza nomes validos sem perder ordem/configuracoes.
    if (!afkProfiles.queue.some(x=>afkNorm(x.name)===afkNorm(afk.editing)))
      afk.editing=afkProfiles.queue[0]?.name || '';
    // O personagem selecionado na tela NAO e necessariamente o que esta logado.
    if (afk.current && afkVocation(afk.current)) afk.currentVocation=afkVocation(afk.current);
    if (JSON.stringify(afkProfiles.roster)!==previous) {
      afkPersist();
      afkSay(`${cards.length} personagens reconhecidos na seleção.`);
    }
    return cards;
  };
  const afkApplyProfile = () => {
    const profile=afkProfile(afk.current);
    const chosen=afkHuntFor(afk.current);
    if (!profile || !chosen?.hunt) return false;
    BOT_CONFIG.huntName=chosen.hunt;
    BOT_CONFIG.lastHuntName=BOT_CONFIG.huntName;
    BOT_CONFIG.lureModo=chosen.lure;
    BOT_CONFIG.minStaminaHours=Number(profile.stamina);
    botSaveConfig();
    return true;
  };
  const afkStop = (reason='AFK parado') => {
    afk.enabled=false; afk.phase='idle'; afk.target=''; afk.stage='';
    afk.levelTransition=null; afk.runningTier=null; afkLevelProbe='';
    afk.selectedVerified=false; afk.selectionAttempts=0; afk.selectedAt=0;
    BOT_CONFIG.botAtivo=false;
    botSaveConfig();
    if (botGetFlow()) botClearFlow('AFK parado');
    if (afk.solo) {
      BOT_CONFIG.huntName=afk.solo.hunt;
      BOT_CONFIG.lastHuntName=afk.solo.hunt;
      BOT_CONFIG.lureModo=afk.solo.lure;
      BOT_CONFIG.minStaminaHours=afk.solo.stamina;
      botSaveConfig();
    }
    afk.solo=null;
    afkSay(reason, 'warn');
    botUpdatePanel();
  };
  // Recuperacao excepcional de identidade.
  // Nunca trocar enquanto existe Hunt, Training, venda ou fluxo em andamento.
  const afkBeginRecovery = reason => {
    if (botFindConnectionLostPanel() || botInHunt() || botTreinando() ||
        botHuntAsyncRunning || botTrainingAsyncRunning || botBusy ||
        botGetFlow() || window.__emerickPartyGate?.enabled) {
      afkSay('Identidade duvidosa durante atividade. Nao vou trocar personagem automaticamente. Pare as atividades e confira a entrada.', 'warn');
      return;
    }

    if (!afkSelectionRoot() && !botFindPlayButton() &&
        !botFindGameModePanel()) {
      afkSay('Nao foi encontrada uma tela segura para recuperar a selecao.', 'warn');
      return;
    }

    const order=afkSequence();
    if (!order.length) {
      afkSay('Nenhum personagem habilitado para recuperar.', 'warn');
      return;
    }

    // Preservar configuracoes Solo para eventual cancelamento.
    afk.solo={
      hunt:BOT_CONFIG.huntName,
      lure:BOT_CONFIG.lureModo,
      stamina:BOT_CONFIG.minStaminaHours
    };

    afk.enabled=true;
    afk.phase='recovery';
    afk.stage='menu';
    afk.target=order[0];
    afk.pendingLogin=null;
    afk.since=Date.now();
    afk.lastAction=0;
    afk.attempt=0;
    afk.entryAttempts=0;
    afk.selectedVerified=false;
    afk.selectedAt=0;
    afk.selectionAttempts=0;
    afk.selectionScreenSeen=false;
    afk.listWaitingSince=0;

    BOT_CONFIG.botAtivo=false;
    botSaveConfig();

    afkSay(`Conferencia necessaria (${reason}). Abrindo a lista uma vez para iniciar por ${afk.target}.`, 'warn');
  };

  const afkStart = () => {
    // Iniciar AFK e um comando autonomo: nunca depende do botao Hunt.
    if (window.__emerickPartyGate?.enabled) {
      afkSay('A Party está ligada. Pare a Party antes de iniciar AFK.', 'warn'); return;
    }
    const sequence=afkSequence();
    if (!sequence.length) {
      afkSay('Marque os personagens na Ordem de execução antes de iniciar.', 'warn'); return;
    }
    // Confirmar o personagem real antes de iniciar uma automacao.
    const onSelection=Boolean(afkSelectionRoot() || afkFindEnterWorld());
    const live=afkLiveIdentity();
    const inWorld=!onSelection && Boolean(
      live || botFindPlayButton() || botFindGameModePanel() ||
      botInHunt() || botTreinando()
    );

    if (onSelection) {
      // Recuperar somente quando a lista nativa ja esta aberta.
      if (afkSelectionRoot())
        afkBeginRecovery('lista de personagens ja aberta');
      else
        afkSay('Entre no mundo antes de iniciar o AFK.','warn');
      return;
    }

    if (live && inWorld && !afk.pendingLogin) {
      const matches=afkProfiles.roster.filter(r=>
        afkNorm(r.name)===afkNorm(live.name));

      if (matches.length!==1 ||
          afkNorm(matches[0].vocation)!==afkNorm(live.vocation)) {
        afkSay('Perfil nativo diverge da lista salva. AFK nao iniciou.','warn');
        return;
      }

      afk.current=matches[0].name;
      afk.currentVocation=live.vocation;
      afk.detectedSource='entrada confirmada pelo perfil nativo';
      afk.detectedAt=Date.now();
      afk.pendingLogin=null;
      afkPersist();

    } else if (!inWorld || !afk.current?.trim() ||
               afk.pendingLogin ||
               !String(afk.detectedSource||'').startsWith('entrada')) {

      // Aguardar o React montar o perfil. Nunca clicar na engrenagem.
      if (afk.phase!=='identify') {
        afk.enabled=true;
        afk.phase='identify';
        afk.stage='waiting-profile';
        afk.since=Date.now();
        afk.target='';
        BOT_CONFIG.botAtivo=false;
        botSaveConfig();
      }

      afkSay(
        'Identificando personagem. Aguardando ate 20s sem acionar engrenagem.',
        'warn'
      );
      return;
    }

    const startingAt=sequence.findIndex(n=>
      afkNorm(n)===afkNorm(afk.current));

    if (startingAt<0) {
      afkSay(
        `Personagem ${afk.current} nao marcado na fila. Nada executado.`,
        'warn'
      );
      return;
    }

    const profile=afkProfile(afk.current);
    if (!afkHuntFor(afk.current)?.hunt) {
      const rows=afkHunts(profile);
      const level=afkLevel(afk.current);
      const configured=afkValidHunts(profile) && rows.some(r=>String(r.hunt||'').trim());
      const reason=!configured ? `Configure a Hunt de ${afk.current}.`
        : level===null ? `Level de ${afk.current} não detectado. Abra o perfil nativo ou visite SEUS PERSONAGENS para atualizar a lista.`
        : `Level ${level} fora das Hunts configuradas para ${afk.current}; confira o level mínimo inicial.`;
      afkSay(reason, 'warn'); return;
    }
    if ((afkSelectionRoot() || afkFindEnterWorld()) && !afkLiveIdentity()) {
      afkSay(`Entre no mundo com ${afk.current} antes de iniciar o AFK.`, 'warn'); return;
    }
    if (botFindConnectionLostPanel()) {
      afkSay('Stonegy desconectado. Reconecte antes de iniciar AFK.', 'warn'); return;
    }
    if (botHuntAsyncRunning || botTrainingAsyncRunning || botBusy) {
      afkSay('Há uma ação de Hunt/Treino em andamento. Aguarde concluir e tente Iniciar AFK.', 'warn'); return;
    }
    // Guardar configuracoes Solo sem exigir que o bot Solo esteja desligado.
    // Se houver um ciclo antigo aguardando, substituimos somente o ESTADO
    // desse ciclo; nunca criamos outro motor ou interrompemos uma acao async.
    afk.solo={hunt:BOT_CONFIG.huntName,lure:BOT_CONFIG.lureModo,stamina:BOT_CONFIG.minStaminaHours};
    afk.enabled=true; afk.phase='hunt'; afk.target=''; afk.stage='';
    afk.levelTransition=null; afk.runningTier=null; afkLevelProbe='';
    afk.selectedVerified=false; afk.selectionAttempts=0; afk.selectedAt=0;
    afk.visited=[]; afk.attempt=0; afk.lastAction=Date.now();
    if (!afkApplyProfile()) {afkStop('Perfil AFK inválido.');return;}
    if (botGetFlow() && !botInHunt() && !botTreinando()) {
      botClearFlow('AFK assumiu o ciclo Solo');
    }
    BOT_CONFIG.botAtivo=true;
    botSaveConfig();
    if (botTreinando()) {
      afkSay(`AFK ativado para ${afk.current}. Treinamento detectado; verificando stamina.`, 'success');
    } else if (botInHunt()) {
      afkSay(`AFK ativado para ${afk.current}. Acompanhando a Hunt atual.`, 'success');
    } else {
      afkSay(`AFK ativado: ${afk.current} · iniciando venda e ciclo de Hunt.`, 'success');
      botStartReturn(); // caminho identico ao botao Iniciar do motor Solo
      if (!botGetFlow() && !botInHunt() && !botTreinando()) {
        afkStop('Nao foi possivel abrir o ciclo Solo; verifique o status do jogo.');
        return;
      }
    }
    botUpdatePanel();
  };
  const afkGoSwitch = () => {
    const sequence=afkSequence();
    const index=sequence.findIndex(name=>afkNorm(name)===afkNorm(afk.current));
    if (index<0) {afkStop('Personagem atual não está na fila selecionada.');return;}
    // Rotacao circular: o ultimo retorna ao primeiro habilitado.
    if (sequence.length<2 ||
        new Set(sequence.map(afkNorm)).size!==sequence.length) {
      afkStop('Rotacao continua requer ao menos 2 personagens distintos habilitados.');
      return;
    }
    const wrapped=index===sequence.length-1;
    const target=sequence[wrapped ? 0 : index+1];
    if (wrapped) {
      // Nova volta: o historico antigo nao bloqueia o primeiro.
      afk.visited=[];
    } else {
      if (!afk.visited.some(name=>afkNorm(name)===afkNorm(afk.current)))
        afk.visited.push(afk.current);
      if (afk.visited.some(name=>afkNorm(name)===afkNorm(target))) {
        afkStop('Rotacao repetida na mesma volta; AFK interrompido.');
        return;
      }
    }
    afk.phase='switch'; afk.stage='menu'; afk.target=target;
    afk.since=Date.now(); afk.lastAction=0; afk.attempt=0;
    afk.selectionAttempts=0; afk.selectedVerified=false; afk.selectedAt=0;
    afk.entryAttempts=0;afk.waitListNotified=false;
    afk.selectionScreenSeen=false; afk.listWaitingSince=0;
    BOT_CONFIG.botAtivo=false;botSaveConfig();
    if (botGetFlow()) botClearFlow('treino AFK iniciado');
    afkSay(`Treino ativo. Trocando ${afk.current} → ${target}.`);
  };
  // Diferentemente da função Solo, esta rotina NÃO espera horas e NÃO finaliza treino.
  // Detecta a classe da arma SOMENTE em um slot de equipamento identificado.
  // Um aria-label na mochila nao comprova que o item esta equipado.
  const afkEquippedKnightSkill = () => {
    const found=new Set();
    const equipped=/(?:equipment[-_\s]?(?:weapon|main[-_\s]?hand|slot)|equipped[-_\s]?(?:weapon|main[-_\s]?hand)|(?:main|right)[-_\s]?hand(?:[-_\s]?slot)?|weapon[-_\s]?(?:slot|equipped))/i;
    const excluded=/(?:backpack|quick[-_\s]?sell|stash|depot|market|loot[-_\s]?(?:bag|window|panel))/i;
    for (const holder of document.querySelectorAll('.stonegy-item-holder-content')) {
      if (!holder.isConnected || holder.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]')) continue;
      const icon=holder.querySelector('[role="img"][aria-label]');
      const item=String(icon?.getAttribute('aria-label')||'').trim();
      if (!item) continue;
      let node=holder, marked=false, blocked=false;
      for (let depth=0;node && depth<9;depth++,node=node.parentElement) {
        const attrs=['data-guide','data-testid','data-slot','aria-label','id'];
        const meta=attrs.map(k=>String(node.getAttribute?.(k)||''));
        const classes=String(node.className||'').split(/\s+/).filter(c=>!/^css-/.test(c));
        const description=[...meta,...classes].join(' ');
        if (excluded.test(description)) blocked=true;
        if (equipped.test(description)) marked=true;
      }
      if (blocked || !marked) continue;
      const categories=['Sword','Axe','Club'].filter(kind=>
        new RegExp('\\b'+kind+'\\b','i').test(item));
      if (categories.length!==1) return null;
      found.add(categories[0]);
    }
    return found.size===1 ? [...found][0] : null;
  };
  // Identificar skill selecionada NA TELA DE TREINO nativa, sem clicar.
  // Somente aceita as seis skills juntas e UMA selecao inequivoca.
  const afkSelectedTrainingSkill = () => {
    const panel=document.querySelector('[data-guide="training-standard-panel"]');
    if (!panel?.isConnected || !botVisible(panel) || !botFindStartTrainingButton()) return null;
    const valid=new Set(['SWORD','AXE','CLUB','FIST','DISTANCE','MAGIC']);
    const inspected=new Set(), found=[];
    for (const p of document.querySelectorAll('p')) {
      if (!p.isConnected || !botVisible(p) || p.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]')) continue;
      const group=p.parentElement?.parentElement;
      if (!group?.isConnected || inspected.has(group)) continue;
      inspected.add(group);
      const cards=[...group.children].map(card=>({
        card,label:botNormalize(card.querySelector('p')?.textContent||'')
      }));
      if (cards.length!==6 || new Set(cards.map(x=>x.label)).size!==6 ||
          cards.some(x=>!valid.has(x.label) || !x.card.isConnected)) continue;
      const flags='[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"],[data-selected="true"],[data-state="selected"]';
      const marked=cards.filter(x=>x.card.matches?.(flags));
      if (marked.length>1) return null;
      let selected=marked[0];
      if (!selected) {
        // React/Material UI: 5 cards com uma classe e 1 diferente.
        // Comparacao RELATIVA; nunca fixar css-5uu3a9 ou similares.
        const counts=new Map();
        for (const x of cards) {
          const key=String(x.card.className||'');
          counts.set(key,(counts.get(key)||0)+1);
        }
        if (counts.size!==2 || ![...counts.values()].includes(5) ||
            ![...counts.values()].includes(1)) continue;
        selected=cards.find(x=>counts.get(String(x.card.className||''))===1);
      }
      if (selected) found.push(selected.label);
    }
    return found.length===1 ? found[0][0]+found[0].slice(1).toLowerCase() : null;
  };
  async function afkBeginTraining(skillOverride = null) {
    // Nao clicar novamente em Training quando a tela ja esta aberta.
    if (botTreinando()) return true;
    if (botInHunt()) {
      afkSay('Aguardando terminar a Hunt antes do treino.');
      return false;
    }

    const scope=() => {
      const panel=document.querySelector('[data-guide="training-standard-panel"]');
      const start=botFindStartTrainingButton();
      return panel && panel.isConnected && botVisible(panel) &&
        start && start.isConnected && botVisible(start) ? panel : null;
    };

    if (!scope()) {
      if (!botFindGameModePanel()) {
        const play=botFindPlayButton();
        if (!play || !botClick(play)) {
          afkSay('Nao consegui abrir Modos de jogo.','warn');
          return false;
        }
        if (!await botEsperarAte(()=>botFindGameModePanel(),8000)) {
          afkSay('Modos de jogo nao apareceu em 8s.','warn');
          return false;
        }
      }

      if (!scope()) {
        const mode=await botEsperarAte(()=>botFindTrainingModeButton(),7000);
        if (!mode || !mode.isConnected || !botVisible(mode)) {
          afkSay('Opcao Training nao encontrada.','warn');
          return false;
        }
        // Clique direto no controle nativo, sem subir ao ancestral.
        try { mode.click(); }
        catch (_) {
          afkSay('Erro no clique nativo de Training.','warn');
          return false;
        }
        if (!await botEsperarAte(scope,8000)) {
          afkSay('Cliquei Training, mas a tela de treino nao abriu.','warn');
          return false;
        }
      }
    }

    afkSay('Tela Training confirmada; verificando skill.');

    const own=afkProfile(afk.current);
    const profession=afkProfiles.roster.find(c=>
      afkNorm(c.name)===afkNorm(afk.current)
    )?.vocation?.toLowerCase()||'';

    const autoSkill={
      monk:'Fist', paladin:'Distance',
      sorcerer:'Magic', druid:'Magic'
    }[profession];

    // Preferencia manual prevalece; em AUTO, usa SOMENTE a arma equipada confirmada.
    const chosen=own?.skill && own.skill!=='auto' ? own.skill : null;
    const fromEquipment=profession==='knight' && !skillOverride && !chosen
      ? afkEquippedKnightSkill() : null;
    // Se nao ha slot identificado, aceitar a skill REALMENTE marcada no jogo.
    // Isto resolve Knight com Sword selecionada sem adivinhar pela mochila.
    const fromScreen=profession==='knight' && !skillOverride && !chosen && !fromEquipment
      ? afkSelectedTrainingSkill() : null;
    const desired=skillOverride || chosen ||
      (profession==='knight' ? (fromEquipment || fromScreen) : autoSkill);
    if (!desired && profession==='knight') {
      afkSay('Knight: selecione Sword/Axe/Club na tela Training ou configure a skill no perfil AFK.', 'warn');
      return false;
    }

    if (!desired) {
      afkSay(`Defina uma skill de treino para ${afk.current}.`,'warn');
      return false;
    }

    const alias={
      fist:'FIST',distance:'DISTANCE',magic:'MAGIC',
      sword:'SWORD',axe:'AXE',club:'CLUB'
    };
    const wanted=alias[String(desired).trim().toLowerCase()];

    if (!wanted) {
      afkSay(`Skill desconhecida: ${desired}. Nao vou iniciar.`,'warn');
      return false;
    }

    const allSkills=new Set([
      'SWORD','AXE','CLUB','FIST','DISTANCE','MAGIC'
    ]);

    const findChoices=()=>{
      if (!scope()) return null;

      // As seis skills compartilham um mesmo container.
      for (const p of document.querySelectorAll('p')) {
        if (!p.isConnected || !botVisible(p) ||
            botNormalize(p.textContent)!==wanted ||
            p.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]')) {
          continue;
        }

        const card=p.parentElement;
        const group=card?.parentElement;
        if (!card || !group || !card.isConnected) continue;

        const choices=[...group.children].map(child=>({
          card:child,
          label:botNormalize(child.querySelector('p')?.textContent||'')
        })).filter(x=>allSkills.has(x.label) && x.card.isConnected);

        if (choices.length===6 &&
            new Set(choices.map(x=>x.label)).size===6 &&
            choices.filter(x=>x.label===wanted).length===1) {
          return choices;
        }
      }
      return null;
    };

    const choices=await botEsperarAte(findChoices,8000);
    if (!choices) {
      afkSay(
        `Painel de skills nao identificado para ${desired}; treino interrompido.`,
        'warn'
      );
      return false;
    }

    const target=choices.find(x=>x.label===wanted).card;

    // Verificar a selecao sem fixar as classes css-*.
    const selected=()=>{
      if (!target.isConnected || !scope()) return false;

      if (target.matches(
        '[aria-checked="true"],[aria-selected="true"],' +
        '[aria-pressed="true"],[data-state="selected"],[data-selected="true"]'
      )) return true;

      const peers=choices.filter(
        x=>x.card!==target && x.card.isConnected
      );
      if (peers.length!==5) return false;

      const classes=peers.map(x=>String(x.card.className||''));
      const frequent=classes.find(
        cl=>classes.filter(c=>c===cl).length>=4
      );

      return Boolean(
        frequent && String(target.className||'')!==frequent
      );
    };

    if (!selected()) {
      afkSay(`Selecionando skill ${desired}.`);
      try { target.click(); }
      catch (_) {
        afkSay(`Nao consegui clicar no cartao ${desired}.`,'warn');
        return false;
      }

      if (!await botEsperarAte(selected,3500)) {
        afkSay(
          `Clique em ${desired} sem confirmacao visual. Sem iniciar treino.`,
          'warn'
        );
        return false;
      }
    }

    const start=await botEsperarAte(
      ()=>scope() && botFindStartTrainingButton(),6500
    );

    if (!start || !start.isConnected || !botVisible(start)) {
      afkSay('Skill confirmada, mas START TRAINING indisponivel.','warn');
      return false;
    }

    if (botTreinando()) return true;

    afkSay(`Skill ${desired} confirmada; clicando START TRAINING.`);
    try { start.click(); }
    catch (_) {
      afkSay('Erro no clique nativo START TRAINING.','warn');
      return false;
    }

    const running=await botEsperarAte(
      ()=>botFindFinalizarTreinoButton(),12000
    );

    if (!running) {
      afkSay(
        'Cliquei START TRAINING mas o jogo nao confirmou treino; sem trocar.',
        'warn'
      );
    }
    return Boolean(running);
  }
  function afkHandleTrainingStep() {
    if (!afk.enabled || afk.phase!=='hunt' || botTrainingAsyncRunning) return;
    botTrainingAsyncRunning=true;
    afkSay('Iniciando treinamento sem esperar sua conclusão.');
    afkBeginTraining().then(ok=>{
      if (!afk.enabled) return;
      if (ok) afkGoSwitch();
      else afkStop('Treino não confirmado: '+afk.message);
    }).catch(e=>afkStop('Erro ao iniciar treino: '+String(e?.message||e).slice(0,80)))
      .finally(()=>{botTrainingAsyncRunning=false;});
  }
  // Controle exato do Stonegy; nao usar botClick generico no icone de engrenagem.
  // O clique generico pode subir ate um contêiner grande e acionar outro edificio.
  const afkNativeClick = element => {
    if (!element || !botVisible(element) || element.closest('#stonegy-tm-overlay')) return false;
    try { element.click(); return true; } catch (_) { return false; }
  };
  const afkFindGear = () => {
    const matches=[...document.querySelectorAll('svg[viewBox="0 0 26 26"]')].filter(svg => {
      if (!botVisible(svg) || svg.closest('#stonegy-tm-overlay')) return false;
      const paths=[...svg.querySelectorAll('path[d]')];
      return paths.some(p => (p.getAttribute('d')||'').startsWith('M22.7008 13.4392'));
    });
    // SVGElement nao implementa .click() em todos os navegadores.
    // Usar exclusivamente o pequeno elemento HTML pai do SVG.
    return matches.length===1 ? matches[0].closest('.css-1l740qp') || matches[0].parentElement : null;
  };
  const afkFindSwitchMenuOption = () => {
    // Stonegy em portugues ou ingles, sem depender das classes css-*.
    const labels=new Set([
      'TROCAR PERSONAGEM','MUDAR PERSONAGEM',
      'CHANGE CHARACTER','SWITCH CHARACTER'
    ]);
    const exact=el=>el?.isConnected &&
      !el.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]') &&
      botVisible(el) && labels.has(afkNorm(el.textContent||''));

    const selectors='p,h5,h6,span,button,[role="menuitem"],[role="option"]';
    let nodes=[...document.querySelectorAll(selectors)].filter(exact);

    // Suporte a texto direto em div, sem usar hash do Material UI.
    if (!nodes.length) {
      nodes=[...document.querySelectorAll('div')].filter(el=>
        el.children.length===0 && exact(el));
    }

    // Se houver elementos aninhados, usar somente o mais especifico.
    const deepest=nodes.filter(el=>
      !nodes.some(other=>other!==el && el.contains(other)));

    if (deepest.length!==1) return null;

    const el=deepest[0];
    return el.closest(
      'button,[role="menuitem"],[role="option"],[role="button"]'
    ) || el;
  };
  const afkFindEnterWorld = () => {
    // Mesmo elemento nativo para Windows/Mac, independentemente do idioma.
    const labels=new Set(['ENTRAR NO MUNDO','ENTER THE WORLD']);
    const buttons=[...document.querySelectorAll('h5')].filter(h=>
      h.isConnected &&
      !h.closest('#stonegy-tm-overlay,[hidden],[aria-hidden="true"]') &&
      botVisible(h) &&
      labels.has(afkNorm(h.textContent||'')));

    if (buttons.length!==1) return null;

    return buttons[0].closest('.highlight-animation') || buttons[0];
  };
  // Identificacao automatica SOMENTE apos uma entrada confirmada no jogo.
  // Isso cobre a escolha MANUAL no Stonegy, alem da rotacao AFK existente.
  // Nunca assumir o primeiro cartao como "personagem aberto no jogo".
  const afkCaptureManualEntry = event => {
    if (!event.isTrusted || (afk.enabled && afk.phase==='switch')) return;
    const target=event.target;
    if (!(target instanceof Element)) return;
    const world=afkFindEnterWorld();
    if (!world || !world.contains(target)) return;
    const cards=afkFindCards();
    if (cards.length<2) return;
    const selected=afkSelectedCard(cards);
    if (!selected) return;
    // O clique no botao inicia a navegacao, mas nao confirma login.
    afk.pendingLogin={name:selected.name,vocation:selected.vocation,at:Date.now()};
    afk.detectedSource='aguardando entrada';
    afkPersist();
  };
  const afkAutoIdentityTick = () => {
    // O motor de troca ja confirma o proprio destino na funcao afkDriveSwap.
    // Nao sobrescrever afk.current durante a navegacao automatica.
    if (afk.enabled && (afk.phase==='switch' ||
        afk.phase==='recovery')) return;
    const now=Date.now();
    const cards=afkFindCards();
    if (cards.length>=2) {
      // O personagem anterior nao deve ser apresentado como "aberto no jogo"
      // enquanto o Stonegy esta na tela SEUS PERSONAGENS.
      if (!afk.enabled && !afk.pendingLogin && afk.detectedSource!=='aguardando entrada') {
        afk.current='';
        afk.currentVocation='';
        afk.detectedSource='aguardando entrada';
        afkPersist();
      }
      return;
    }
    // Detectar perfil mesmo quando a extensao carrega depois do login.
    const live=afkLiveIdentity();
    if (!afk.pendingLogin && live && !afkFindEnterWorld()) {
      const matches=afkProfiles.roster.filter(r=>
        afkNorm(r.name)===afkNorm(live.name) &&
        afkNorm(r.vocation)===afkNorm(live.vocation));
      if (matches.length===1) {
        if (afk.enabled && afk.phase==='hunt' && afk.current &&
            afkNorm(afk.current)!==afkNorm(live.name)) {
          afkStop('Perfil nativo mudou durante o AFK. Pausado sem trocar personagem.');
          return;
        }
        if (!afk.enabled &&
            (afkNorm(afk.current)!==afkNorm(live.name) ||
             !String(afk.detectedSource||'').startsWith('entrada'))) {
          afk.current=matches[0].name;
          afk.currentVocation=live.vocation;
          afk.detectedSource='entrada confirmada pelo perfil nativo';
          afk.detectedAt=now;
          afkPersist();
        }
      }
    }
    const pending=afk.pendingLogin;
    if (!pending) return;
    if (!pending.name || !Number.isFinite(pending.at) || now-pending.at>45000) {
      afk.pendingLogin=null;
      if (afk.detectedSource==='aguardando entrada') afk.detectedSource='nao confirmado';
      afkPersist();
      return;
    }
    // Confirmacao conservadora: a selecao saiu, o botao de entrar sumiu,
    // e a interface de jogo (Hunt, Play/Explore ou Treino) apareceu.
    if (afkFindEnterWorld() ||
        !(botFindPlayButton() || botFindGameModePanel() || botTreinando() || botInHunt())) return;
    const name=String(pending.name).trim();
    afk.pendingLogin=null;
    if (!name) return;
    if (afk.enabled && afk.phase==='hunt' && afk.current && afkNorm(afk.current)!==afkNorm(name)) {
      afkStop('Troca manual detectada. AFK pausado para evitar usar o perfil errado.');
    }
    afk.current=name;
    afk.currentVocation=afkVocation(name) || (/^(monk|paladin|knight|sorcerer|druid)$/i.test(String(pending.vocation||'')) ? pending.vocation.toLowerCase() : '');
    afk.detectedSource='entrada manual confirmada';
    afk.detectedAt=now;
    afkSay(`Personagem aberto identificado automaticamente: ${name}.`, 'success');
    afkPersist();
  };
  // A tela de personagens pode exibir ENTRAR NO MUNDO com o PRIMEIRO
  // personagem ja selecionado. Um clique enviado nao confirma a selecao.
  // O cartao realmente ativo tem background linear-gradient no Stonegy.
  const afkSelectedCard = cards => {
    const selected=cards.filter(({node})=>{
      const inline=node.style.backgroundImage || node.style.background || '';
      let computed='';
      try { computed=getComputedStyle(node).backgroundImage || ''; } catch (_) {}
      return /(?:linear|radial)-gradient\(/i.test(inline+' '+computed)
        || node.getAttribute('aria-selected')==='true'
        || node.getAttribute('data-selected')==='true'
        || node.getAttribute('data-state')==='selected';
    });
    // A tela da Stonegy abre com o primeiro personagem destacado.
    // Nunca inferir selecao pela posicao do cartao ou por click enviado.
    return selected.length===1 ? selected[0] : null;
  };
  const afkClickTargetCard = (card, expectedName) => {
    const node=card?.node;
    if (!(node instanceof HTMLElement) || !node.isConnected || node.closest('#stonegy-tm-overlay')) return false;
    const headings=[...node.querySelectorAll('h5')];
    if (afkNorm(headings[0]?.textContent)!==afkNorm(expectedName) ||
        !/Level\s+\d+\s+(KNIGHT|SORCERER|DRUID|PALADIN|MONK)\b/i.test(headings[1]?.textContent||'')) return false;
    // O React escuta onClick neste proprio MuiBox (css-16d0rbh).
    // Ao contrario de botClick(), nao sobe na hierarquia ate outro cursor:pointer.
    try {node.click(); return true;} catch (_) {return false;}
  };
  // Recuperacao separada: a funcao original de troca fica intacta.
  const afkDriveRecovery = () => {
    if (!afk.enabled || afk.phase!=='recovery') return;
    // Nao recuperar sem ter encontrado a lista verdadeira.
    if (afk.stage==='menu' && afkFindCards().length<2) {
      afkStop('Lista nao confirmada. Nenhuma engrenagem acionada.');
      return;
    }

    const now=Date.now();
    const target=afk.target;
    const order=afkSequence();

    if (!target || afkNorm(order[0])!==afkNorm(target)) {
      afkStop('Fila alterada durante a recuperacao; AFK pausado.');
      return;
    }

    if (now-afk.since>90000) {
      afkStop('Recuperacao atingiu 90 segundos. AFK pausado, sem repeticao.');
      return;
    }

    if (botFindConnectionLostPanel() || botInHunt() ||
        botTreinando() || botHuntAsyncRunning ||
        botTrainingAsyncRunning || botBusy || botGetFlow()) {
      afkStop('Atividade inesperada durante a recuperacao. AFK pausado.');
      return;
    }

    const cards=afkFindCards();
    const world=afkFindEnterWorld();

    if (cards.length>=2) {
      const candidates=cards.filter(c=>
        afkNorm(c.name)===afkNorm(target));

      if (candidates.length!==1) {
        afkStop('Personagem alvo ausente ou duplicado na lista.');
        return;
      }

      const selected=afkSelectedCard(cards);

      if (afk.stage==='verify') {
        if (now-afk.lastAction<6000) return;

        afk.entryAttempts=(afk.entryAttempts||0)+1;
        if (afk.entryAttempts>2) {
          afkStop('ENTRAR NO MUNDO nao abriu o jogo na recuperacao.');
          return;
        }

        afk.selectedVerified=false;
        afk.selectedAt=0;
        afk.stage='selection';
        afk.lastAction=0;

        afkSay(`Lista ainda aberta; conferindo novamente o cartao ${target}.`);
        return;
      }

      if (selected && afkNorm(selected.name)===afkNorm(target)) {
        if (!afk.selectedVerified) {
          afk.selectedVerified=true;
          afk.selectedAt=now;
          afk.stage='entry';

          afkSay(`Recuperacao: ${target} selecionado. Verificando estabilidade.`);
          return;
        }

        if (now-afk.selectedAt<900) return;

        if (!world) {
          if (now-afk.selectedAt>15000)
            afkStop('ENTRAR NO MUNDO nao apareceu na recuperacao.');
          return;
        }

        if (now-afk.lastAction<1100) return;

        if (!afkNativeClick(world)) {
          afkStop('Falha ao entrar no mundo apos recuperacao.');
          return;
        }

        afk.stage='verify';
        afk.lastAction=now;
        afkSay(`Recuperacao: entrando no mundo com ${target}.`);
        afkPersist();
        return;
      }

      afk.selectedVerified=false;
      afk.selectedAt=0;

      if (now-afk.lastAction<2400) return;

      if ((afk.selectionAttempts||0)>=3) {
        afkStop(`Nao foi possivel selecionar ${target} em tres cliques.`);
        return;
      }

      if (!afkClickTargetCard(candidates[0],target)) {
        afkStop('Falha ao clicar no cartao exato de '+target);
        return;
      }

      afk.stage='selection';
      afk.selectionAttempts=(afk.selectionAttempts||0)+1;
      afk.lastAction=now;

      afkSay(`Recuperacao: selecionando ${target} (${afk.selectionAttempts}/3).`);
      afkPersist();
      return;
    }

    if (afk.stage==='verify') {
      if (now-afk.lastAction<1600) return;

      if (!(botFindPlayButton() || botFindGameModePanel() ||
            botInHunt() || botTreinando())) {
        if (now-afk.lastAction>15000)
          afkStop('Mundo nao confirmou a entrada; AFK pausado.');
        return;
      }

      if (!afk.selectedVerified) {
        afkStop('Entrada nao validada; AFK pausado.');
        return;
      }

      const native=afkLiveIdentity();
      if (native && afkNorm(native.name)!==afkNorm(target)) {
        afkStop('Perfil no jogo nao corresponde ao selecionado; AFK pausado.');
        return;
      }

      // Entrada confirmada. Reiniciar usando o AFK original.
      afk.current=target;
      afk.currentVocation=afkVocation(target);
      afk.detectedSource='entrada apos selecionar cartao';
      afk.detectedAt=now;
      afk.pendingLogin=null;
      afk.enabled=false;
      afk.phase='idle';
      afk.stage='';
      afk.target='';
      afk.selectionAttempts=0;
      afk.selectedVerified=false;
      afk.selectedAt=0;

      afkSay(`Identidade recuperada: ${target}. Iniciando a rotacao existente.`, 'success');
      afkStart();
      return;
    }

    if (afk.stage==='wait-list') {
      if (now-afk.lastAction>20000)
        afkStop('A lista nao apareceu apos TROCAR PERSONAGEM. AFK pausado.');
      return;
    }

    if (afk.stage==='selection' || afk.stage==='entry' ||
        afk.selectionScreenSeen) {
      if (!afk.listWaitingSince)
        afk.listWaitingSince=now;

      if (now-afk.listWaitingSince>15000)
        afkStop('Lista desapareceu antes de confirmar entrada. AFK pausado.');
      return;
    }

    if (now-afk.lastAction<1600) return;

    if (afk.attempt>=3) {
      afkStop('Nao foi possivel abrir TROCAR PERSONAGEM.');
      return;
    }

    const option=afkFindSwitchMenuOption();

    if (option) {
      if (!afkNativeClick(option)) {
        afkStop('Falha ao clicar TROCAR PERSONAGEM.');
        return;
      }

      afk.stage='wait-list';
      afk.selectionScreenSeen=true;
      afkSay(`Recuperacao: abrindo lista para selecionar ${target}.`);
    } else {
      // A recuperacao de identidade nao abre menu sem confirmacao.
      afkStop('Lista indisponivel. Sem clicar na engrenagem.');
      return;
    }

    afk.lastAction=now;
    afk.attempt++;
    afkPersist();
  };

  const afkDriveSwap = () => {
    if (!afk.enabled || afk.phase!=='switch') return;
    const now=Date.now();
    if (now-afk.since>90000) {afkStop('Troca excedeu 90 segundos; AFK pausado.');return;}
    if (botFindConnectionLostPanel()) return;
    // Manter o alvo congelado durante a navegacao. Jamais regressar
    // para o primeiro personagem por causa do destaque padrao do jogo.
    const seq=afkSequence();
    const pos=seq.findIndex(name=>afkNorm(name)===afkNorm(afk.current));
    const next=pos>=0 && seq.length>=2 ? seq[(pos+1)%seq.length] : null;
    if (!next || afkNorm(next)!==afkNorm(afk.target)) {
      afkStop('Ordem mudou no meio da troca; AFK pausado.');return;
    }
    const cards=afkFindCards();
    const world=afkFindEnterWorld();
    // A presenca dos cartoes tem prioridade ABSOLUTA sobre qualquer etapa
    // pendente: enquanto a lista existir, nunca clicar na engrenagem.
    if (cards.length>=2) {
      const matches=cards.filter(c=>afkNorm(c.name)===afkNorm(afk.target));
      if (matches.length!==1) {afkStop('Nome do proximo personagem ausente ou repetido: '+afk.target);return;}
      const selected=afkSelectedCard(cards);
      if (afk.stage==='verify') {
        if (now-afk.lastAction<6000) return;
        afk.entryAttempts=(afk.entryAttempts||0)+1;
        if (afk.entryAttempts>2) {
          afkStop('ENTRAR NO MUNDO nao abriu o jogo. Nao foi selecionado outro personagem.');return;
        }
        afk.selectedVerified=false;afk.selectedAt=0;
        afk.stage='selection';afk.lastAction=0;
        afkSay(`Tela de personagens ainda aberta; conferindo ${afk.target} novamente.`);
        return;
      }
      if (selected && afkNorm(selected.name)===afkNorm(afk.target)) {
        if (!afk.selectedVerified) {
          afk.selectedVerified=true;afk.selectedAt=now;afk.stage='entry';
          afkSay(`${afk.target} destacado na lista. Aguardando confirmação estável.`);
          return;
        }
        if (now-afk.selectedAt<900) return;
        if (!world) {
          if (now-afk.selectedAt>15000) afkStop('ENTRAR NO MUNDO nao encontrado para '+afk.target);
          return;
        }
        if (now-afk.lastAction<1100) return;
        if (!afkNativeClick(world)) {afkStop('Nao foi possivel clicar ENTRAR NO MUNDO.');return;}
        afk.stage='verify';afk.lastAction=now;
        afkSay(`ENTRAR NO MUNDO clicado com ${afk.target} selecionado; aguardando o jogo.`);
        afkPersist();return;
      }
      // Nao ha confirmacao de selecao. Clicar SOMENTE no cartao com nome exato.
      afk.selectedVerified=false;afk.selectedAt=0;
      if (now-afk.lastAction<2400) return;
      if ((afk.selectionAttempts||0)>=3) {
        afkStop(`O Stonegy nao selecionou ${afk.target} em 3 cliques. Parei para evitar voltar a ${afk.current}.`);return;
      }
      if (!afkClickTargetCard(matches[0],afk.target)) {
        afkStop('Falha ao clicar no cartao exato de '+afk.target);return;
      }
      afk.stage='selection';afk.selectionAttempts=(afk.selectionAttempts||0)+1;
      afk.lastAction=now;
      afkSay(`Cartao ${afk.target} clicado (${afk.selectionAttempts}/3). Selecionado antes: ${selected?.name||'indefinido'}.`);
      afkPersist();return;
    }
    // Se a lista desapareceu depois do clique em ENTRAR NO MUNDO,
    // aguardar a interface normal carregar antes de gravar a identidade.
    if (afk.stage==='verify') {
      if (now-afk.lastAction<1600) return;
      if (!(botFindPlayButton() || botFindGameModePanel() || botTreinando())) {
        if (now-afk.lastAction>15000) afkStop('Entrada no mundo nao confirmada; AFK pausado.');
        return;
      }
      if (!afk.selectedVerified) {afkStop('Entrada sem confirmar selecao; AFK pausado.');return;}
      const entering=afk.target;
      afk.current=entering;afk.currentVocation=afkVocation(entering);afk.target='';afk.stage='';afk.phase='hunt';
      afk.selectionAttempts=0;afk.selectedAt=0;afk.selectedVerified=false;
      afk.detectedSource='entrada apos selecionar cartao';
      afk.detectedAt=now;
      if (!afkApplyProfile()) {afkStop('Hunt nao configurada para '+afk.current);return;}
      afkSay(`Personagem atual atualizado para ${afk.current}; iniciando venda.`, 'success');
      afkPersist();
      if (!botTreinando()) botStartReturn();
      return;
    }
    if (afk.stage==='wait-list') {
      if (now-afk.lastAction>20000) afkStop('Lista nao apareceu apos Trocar Personagem. Sem repetir engrenagem.');
      return;
    }
    // Uma vez na selecao, jamais voltar ao menu nem clicar na engrenagem.
    if (afk.stage==='selection' || afk.stage==='entry' || afk.selectionScreenSeen) {
      if (!afk.listWaitingSince) afk.listWaitingSince=now;
      if (now-afk.listWaitingSince>15000)
        afkStop('Lista sumiu antes de confirmar entrada. AFK pausado.');
      return;
    }
    if (now-afk.lastAction<1600) return;
    if (afk.attempt>=3) {afkStop('Nao consegui abrir Trocar Personagem.');return;}
    const option=afkFindSwitchMenuOption();
    if (option) {
      if (!afkNativeClick(option)) {afkStop('Falha no menu Trocar Personagem.');return;}
      afk.stage='wait-list';afk.selectionScreenSeen=true;
      afkSay(`Abrindo lista para selecionar ${afk.target}.`);
    } else {
      const gear=afkFindGear();
      if (!gear || !afkNativeClick(gear)) {afkStop('Nao foi possivel abrir a engrenagem exata.');return;}
      afkSay('Abrindo a engrenagem do jogo.');
    }
    afk.lastAction=now;afk.attempt++;afkPersist();
  };
  const afkTick = () => {
    afkAutoIdentityTick();
    afkScanRoster();
    if (!afk.enabled) return;
    if (window.__emerickPartyGate?.enabled) {afkStop('Party ativada; AFK interrompido.');return;}

    if (afk.phase==='identify') {
      if (Date.now()-afk.since>20000) {
        afkStop(
          'Perfil nao identificado em 20s. Nenhuma troca executada.'
        );
        return;
      }

      if (!afkSelectionRoot() && !afkFindEnterWorld() &&
          (afkLiveIdentity() ||
           (afk.current && !afk.pendingLogin &&
            String(afk.detectedSource||'').startsWith('entrada') &&
            (botFindPlayButton() || botFindGameModePanel() ||
             botInHunt() || botTreinando())))) {

        afk.enabled=false;
        afk.phase='idle';
        afk.stage='';
        afkStart();
      }
      return;
    }

    if (afk.phase==='recovery' && !afkSelectionRoot()) {
      afkStop('Identidade incerta: nao abrir engrenagem sem lista confirmada.');
      return;
    }
    if (afk.phase==='recovery') {
      if (!afkBusy) {
        try {
          afkDriveRecovery();
        } catch(error) {
          afkStop('Erro na recuperacao: '+
            String(error?.message||error).slice(0,140));
        }
      }
      return;
    }

    if (afk.phase==='switch') {
      if (!afkBusy) {
        try { afkDriveSwap(); }
        catch (error) { afkStop('Erro na selecao: '+String(error?.message||error).slice(0,140)); }
      }
      return;
    }
    if (afk.phase!=='hunt' || botHuntAsyncRunning || botTrainingAsyncRunning || botBusy) return;
    if (afkTransitionTick()) return;
    // Recupera o motor caso o navegador tenha recarregado com AFK ativo,
    // mas BOT_CONFIG.botAtivo desligado. Nao reinicia outra Hunt no meio.
    if (!BOT_CONFIG.botAtivo && !afkSelectionRoot() && !afkFindEnterWorld() &&
        (botGetFlow() || botInHunt() || botTreinando() || botFindPlayButton())) {
      BOT_CONFIG.botAtivo=true;
      botSaveConfig();
      afkSay(`AFK retomado para ${afk.current}.`, 'success');
    }
    // Edicoes feitas com o AFK ativo sao aplicadas somente na fronteira
    // entre ciclos, nunca no meio da Hunt, venda ou treinamento.
    if (!botInHunt() && !botTreinando() && !botGetFlow()) {
      const active=afkProfile(afk.current);
      const chosen=afkHuntFor(afk.current);
      if (chosen?.hunt && (
        BOT_CONFIG.huntName!==chosen.hunt ||
        BOT_CONFIG.lureModo!==chosen.lure ||
        BOT_CONFIG.minStaminaHours!==Number(active.stamina)
      )) {
        afkApplyProfile();
        afkSay(`Configuracoes atualizadas para ${afk.current}; usando no proximo ciclo.`, 'success');
      }
    }
    if (botGetFlow()?.etapa==='AGUARDANDO_AFK_TREINO') return;
    if (botTreinando()) {
      const stamina=botReadStamina();
      const profile=afkProfile(afk.current);
      if (stamina===null || !profile) {afkSay('Treinando; aguardando leitura de stamina.');return;}
      if (stamina <= Number(profile.stamina)) {afkGoSwitch();return;}
      // Retorno a personagem treinando com stamina suficiente: finalizar treino para caçar.
      if (afkBusy || Date.now()-afk.lastAction<3500) return;
      afkBusy=true;
      const finish=botFindFinalizarTreinoButton();
      if (finish && botClick(finish)) {
        afk.lastAction=Date.now();afkSay('Stamina recuperada; finalizando treino para voltar à Hunt.');
        setTimeout(()=>{afkBusy=false;if(afk.enabled && !botTreinando() && !botGetFlow())botStartReturn();},1800);
      } else {afkBusy=false;afkStop('Não foi possível finalizar treino antigo.');}
      return;
    }
    if (!BOT_CONFIG.botAtivo && !botGetFlow() && !botInHunt()) {
      if (!afkApplyProfile()) {afkStop('Perfil de Hunt ausente.');return;}
      botStartReturn();
    }
  };
  const afkBind = root => {
    const current=root.querySelector('[data-afk-current]');
    const stamina=root.querySelector('[data-afk-stamina]');
    const levels=root.querySelector('[data-afk-level-list]');
    const addHunt=root.querySelector('[data-afk-add-hunt]');
    const queue=root.querySelector('[data-afk-queue]');
    const saveEditing=() => {
      if (!afk.editing) return;
      const profile=afkProfile(afk.editing);
      if (!profile) return;
      profile.stamina=Number(stamina.value);
      const skill=root.querySelector('[data-afk-skill]');
      if (skill) profile.skill=skill.value;
      afkPersist();
    };
    const setEditing=name=>{
      if (!name) return;
      // Nunca altera afk.current: selecionar no editor NÃO troca no jogo.
      saveEditing();
      const found=afkQueueSync().find(row=>afkNorm(row.name)===afkNorm(name));
      if (!found) return;
      afk.editing=found.name;
      afkPersist();afkRender(root,true);
    };
    for (const field of [stamina,root.querySelector('[data-afk-skill]')].filter(Boolean)) {
      field.addEventListener('input',saveEditing);
      field.addEventListener('change',()=>{saveEditing();afkRender(root);});
    }
    levels.addEventListener('input',event=>{
      const control=event.target.closest('[data-afk-level-field]');
      if (!control || !afk.editing) return;
      const p=afkProfile(afk.editing),rows=afkHunts(p);
      const index=Number(control.closest('[data-afk-level-index]')?.dataset.afkLevelIndex);
      if (!Number.isInteger(index)||index<0||index>=rows.length) return;
      const field=control.dataset.afkLevelField, raw=control.value;
      if (field==='minLevel') {
        const level=Number(raw);
        if (!/^\d{1,4}$/.test(raw)||!Number.isSafeInteger(level)||level<1||level>9999||
            (index>0&&level<=Number(rows[index-1].minLevel))||
            (index<rows.length-1&&level>=Number(rows[index+1].minLevel))) {
          control.setCustomValidity('Use um level maior que o anterior e menor que o proximo.');return;
        }
        control.setCustomValidity('');rows[index].minLevel=level;
      } else if (field==='hunt') rows[index].hunt=raw.trim();
      else if (field==='lure') rows[index].lure=raw==='off'?'off':'max';
      else return;
      p.hunt=rows[0].hunt;p.lure=rows[0].lure; // espelha valores legados
      afkPersist();
    });
    levels.addEventListener('change',event=>{
      const input=event.target.closest('[data-afk-level-field]');
      if (input?.dataset.afkLevelField==='minLevel' && !input.checkValidity()) {
        const index=Number(input.closest('[data-afk-level-index]')?.dataset.afkLevelIndex);
        input.setCustomValidity('');input.value=String(afkHunts(afkProfile(afk.editing))[index].minLevel);
      }
      afkRender(root);
    });
    levels.addEventListener('click',event=>{
      const remove=event.target.closest('[data-afk-remove-hunt]');
      if (!remove || !afk.editing) return;
      const p=afkProfile(afk.editing),rows=afkHunts(p),index=Number(remove.dataset.afkRemoveHunt);
      if (index>0 && index<rows.length) {rows.splice(index,1);afkPersist();afkRender(root,true);}
    });
    addHunt.addEventListener('click',()=>{
      const p=afkProfile(afk.editing);if (!p) return;
      const rows=afkHunts(p);if (rows.length>=8 || !afkValidHunts(p)) return;
      const minLevel=Math.min(9999,Number(rows.at(-1).minLevel)+(rows.length===1&&Number(rows[0].minLevel)===1?99:100));
      if (minLevel<=Number(rows.at(-1).minLevel)) return;
      rows.push({minLevel,hunt:'',lure:'max'});
      afkPersist();afkRender(root,true);
    });
    queue.addEventListener('change',event=>{
      const check=event.target.closest?.('[data-afk-include]');
      if (!check) return;
      const name=check.closest('[data-afk-row]')?.dataset.afkRow;
      const list=afkQueueSync();
      const index=list.findIndex(row=>afkNorm(row.name)===afkNorm(name));
      if (!afkQueueCanEdit(list,index)) {afkRender(root,true);return;}
      const row=list[index];
      row.enabled=check.checked;
      afkPersist();afkRender(root,true);
    });
    queue.addEventListener('click',event=>{
      const pick=event.target.closest?.('[data-afk-pick]');
      if (pick) {setEditing(pick.closest('[data-afk-row]')?.dataset.afkRow);return;}
      const button=event.target.closest?.('[data-afk-move]');
      if (!button) return;
      saveEditing();
      const direction=button.dataset.afkMove==='up'?-1:1;
      const name=button.closest('[data-afk-row]')?.dataset.afkRow;
      const list=afkQueueSync();
      const pos=list.findIndex(row=>afkNorm(row.name)===afkNorm(name));
      let other=pos+direction;
      if (pos<0) return;
      if (list[pos].enabled) while (other>=0 && other<list.length && !list[other].enabled)
        other+=direction;
      if (other<0 || other>=list.length ||
          !afkQueueCanEdit(list,pos) || !afkQueueCanEdit(list,other)) return;
      [list[pos],list[other]]=[list[other],list[pos]];
      afkPersist();afkRender(root,true);
    });
    root.querySelector('[data-afk-toggle]').addEventListener('click',()=>{
      if (afk.enabled) afkStop('AFK parado manualmente.');
      else {
        saveEditing();
        // Identidade confirmada automaticamente por ENTRAR NO MUNDO.
        // Nao copiar valores do campo visual nem inferir pelo perfil editado.
        afkStart();
      }
      afkRender(root,true);
    });
    afkQueueSync();
    if (!afk.editing && afkProfiles.queue.length) afk.editing=afkProfiles.queue[0].name;
    afkRender(root,true);
  };
  const afkRender = (root,force=false) => {
    if (!root) return;
    const active=root.activeElement;
    const list=afkQueueSync();
    const editing=afkNorm(afk.editing);
    const selected=list.find(row=>afkNorm(row.name)===editing);
    // Se a lista mudou, usar primeiro perfil disponivel sem mudar o char NO JOGO.
    if (!selected && list.length) {
      afk.editing=list[0].name;
      afkPersist();
    }
    const profile=afkProfile(afk.editing);
    const actual=root.querySelector('[data-afk-current]');
    const shownName=afk.enabled && afk.phase==='switch' && afkFindCards().length>=2 ? '' : afk.current;
    if (actual && actual.value!==shownName) actual.value=shownName;
    if (actual) {
      // A entrada confirmada atualiza afk.current automaticamente. Um perfil
      // selecionado no editor nao corresponde ao personagem autenticado.
      actual.readOnly=true;
      actual.disabled=false;
      const detected=String(afk.detectedSource||'');
      actual.title=detected.startsWith('entrada')
        ? 'Identificado automaticamente ao entrar no mundo'
        : 'Detecta automaticamente na selecao e entrada do Stonegy';
    }
    const currentBadge=root.querySelector('[data-afk-current-vocation]');
    if (currentBadge) currentBadge.textContent=shownName ? (afkVocation(shownName)||afk.currentVocation||'DESCONHECIDA').toUpperCase() : 'AGUARDANDO';
    const identityHint=root.querySelector('[data-afk-identity-hint]');
    if (identityHint) {
      const detected=String(afk.detectedSource||'');
      identityHint.textContent=detected.startsWith('entrada') && afk.current
        ? `Detectado: ${afk.current} · ${(afkVocation(afk.current)||afk.currentVocation||'vocação pendente').toUpperCase()}. Editar um perfil não troca no jogo.`
        : detected==='aguardando entrada'
          ? 'Aguardando ENTRAR NO MUNDO para confirmar o personagem.'
          : afk.current
            ? `Última identidade registrada: ${afk.current}. Confirme entrando no mundo pelo Stonegy.`
            : 'Aguardando uma entrada confirmada no Stonegy; não é necessário cadastrar personagens.';
    }
    for (const [field,value] of [
      ['stamina',String(profile?.stamina??1)],
      ['skill',profile?.skill||'auto']
    ]) {
      const el=root.querySelector('[data-afk-'+field+']');
      if (!el) continue;
      if ((force || el!==active) && el.value!==value) el.value=value;
      // Edicao dos perfis nunca depende de AFK estar ligado.
      el.disabled=!profile;
    }
    const rowsNode=root.querySelector('[data-afk-level-list]');
    const rows=afkHunts(profile);
    const count=root.querySelector('[data-afk-count]');
    if (count) count.textContent=rows.length+' '+(rows.length===1?'hunt':'hunts');
    const add=root.querySelector('[data-afk-add-hunt]');
    if (add) add.disabled=!profile || rows.length>=8 || !afkValidHunts(profile);
    const sig=JSON.stringify([afk.editing,rows]);
    if (rowsNode && rowsNode.dataset.signature!==sig &&
        (force || !rowsNode.contains(active))) {
      rowsNode.replaceChildren(...rows.flatMap((r,index)=>{
        const line=document.createElement('div');line.className='afk-level-row';line.dataset.afkLevelIndex=index;
        const min=document.createElement('input');min.type='number';min.min='1';min.max='9999';min.step='1';
        min.className='afk-level-min';min.dataset.afkLevelField='minLevel';min.value=String(r.minLevel);
        min.title='Level inicial desta Hunt';min.setAttribute('aria-label','Level minimo da Hunt '+(index+1));
        const hunt=document.createElement('input');hunt.type='text';hunt.className='afk-level-hunt';
        hunt.dataset.afkLevelField='hunt';hunt.value=r.hunt||'';hunt.placeholder='Hunt alvo';
        hunt.setAttribute('aria-label','Nome da Hunt '+(index+1));
        const lure=document.createElement('select');lure.className='afk-level-lure';lure.dataset.afkLevelField='lure';
        for (const mode of ['max','off']) {const option=document.createElement('option');option.value=mode;
          option.textContent=mode.toUpperCase();lure.append(option);}
        lure.value=r.lure==='off'?'off':'max';lure.title='Lure exclusivo desta Hunt';
        const remove=document.createElement('button');remove.type='button';remove.className='afk-level-remove';
        remove.dataset.afkRemoveHunt=index;remove.title='Excluir esta Hunt';remove.textContent='×';
        if (index===0) {remove.disabled=true;remove.style.visibility='hidden';}
        line.append(min,hunt,lure,remove);
        const note=document.createElement('small');note.className='afk-level-range';
        note.textContent=rows.length===1 ? 'Hunt unica · qualquer level'
          : index===0 ? `Hunt padrao · ate level ${Number(rows[1].minLevel)-1}`
          : index===rows.length-1 ? `Level ${r.minLevel}+`
          : `Level ${r.minLevel}–${Number(rows[index+1].minLevel)-1}`;
        return [line,note];
      }));
      rowsNode.dataset.signature=sig;
    }
    const heading=root.querySelector('[data-afk-editing]');
    if (heading) heading.textContent=afk.editing||'Selecione um personagem';
    const vocation=root.querySelector('[data-afk-vocation]');
    const known=afkProfiles.roster.find(x=>afkNorm(x.name)===afkNorm(afk.editing));
    // Disponibilizar escolha manual do Knight; nao alterar skill de outras vocacoes.
    const knightField=root.querySelector('[data-afk-knight-skill]');
    if (knightField) knightField.hidden=String(known?.vocation||'').toLowerCase()!=='knight';
    if (vocation) vocation.textContent=known?.vocation?.toUpperCase()||'PERFIL';
    const hint=root.querySelector('[data-afk-editor-hint]');
    if (hint) hint.textContent=profile
      ? (afk.enabled
        ? 'Edicoes salvas. O personagem atual usa as mudancas no proximo ciclo seguro.'
        : 'Hunts, Lures e Stamina salvos automaticamente para este personagem.')
      : 'Aguarde a leitura da lista SEUS PERSONAGENS no Stonegy.';
    const queue=root.querySelector('[data-afk-queue]');
    if (queue) {
      const signature=JSON.stringify([list,afk.enabled,afk.phase,afk.current,afk.visited,afk.editing,list.map(x=>{
        const p=afkProfiles.profiles[afkNorm(x.name)];
        const v=afkProfiles.roster.find(c=>afkNorm(c.name)===afkNorm(x.name));
        return [afkHunts(p),v?.vocation||'',v?.level||0];
      })]);
      if (queue.dataset.signature!==signature) {
        queue.dataset.signature=signature;
        queue.replaceChildren(...(list.length?list.map((row,index)=>{
          const el=document.createElement('div');
          el.className='afk-queue-row';
          el.dataset.afkRow=row.name;
          el.dataset.enabled=String(row.enabled);
          el.dataset.selected=String(afkNorm(row.name)===afkNorm(afk.editing));
          const check=document.createElement('input');
          check.type='checkbox';check.dataset.afkInclude='true';
          check.checked=row.enabled;check.disabled=!afkQueueCanEdit(list,index);
          check.title=row.enabled?'Ignorar na rotação':'Incluir na rotação';
          const pick=document.createElement('button');
          pick.type='button';pick.className='afk-queue-pick';pick.dataset.afkPick='true';
          // Mesmo durante o AFK, clicar no nome abre seu editor, sem trocar no jogo.
          pick.disabled=false;
          const main=document.createElement('strong');main.textContent=row.name;
          const secondary=document.createElement('small');
          const info=afkProfiles.profiles[afkNorm(row.name)];
          const voc=afkProfiles.roster.find(c=>afkNorm(c.name)===afkNorm(row.name))?.vocation;
          const selectedHunt=afkHuntFor(row.name);
          const present=afkHunts(info).some(r=>String(r.hunt||'').trim());
          const description=selectedHunt?.hunt || (present
            ? (afkLevel(row.name)===null?'Level não identificado':'Level fora das faixas')
            : 'Hunt não configurada');
          secondary.textContent=[voc?String(voc).toUpperCase():null,description].filter(Boolean).join(' · ');
          pick.append(main,secondary);
          el.append(check,pick);
          const arrows=document.createElement('div');arrows.className='afk-queue-arrows';
          const previousSelected=list.slice(0,index).some(item=>item.enabled);
          const nextSelected=list.slice(index+1).some(item=>item.enabled);
          for (const [direction,arrow,blocked] of [
            ['up','↑',row.enabled?!previousSelected:index===0],
            ['down','↓',row.enabled?!nextSelected:index===list.length-1]
          ]) {
            const button=document.createElement('button');button.type='button';
            button.dataset.afkMove=direction;button.textContent=arrow;
            button.title=direction==='up'?'Subir na ordem':'Descer na ordem';
            const destination=direction==='up'
              ? (row.enabled ? list.findLastIndex((x,j)=>j<index&&x.enabled) : index-1)
              : (row.enabled ? list.findIndex((x,j)=>j>index&&x.enabled) : index+1);
            button.disabled=blocked || !afkQueueCanEdit(list,index) || !afkQueueCanEdit(list,destination);
            arrows.append(button);
          }
          el.append(arrows);
          return el;
        }):[(()=>{
          const el=document.createElement('p');el.className='afk-queue-empty';
          el.textContent='Personagens detectados automaticamente quando a tela SEUS PERSONAGENS aparecer.';
          return el;
        })()]));
      }
    }
    const status=root.querySelector('[data-afk-status]');
    if (status) {
      const phase=afk.enabled ? (afk.phase==='switch'?'TROCANDO PERSONAGEM':afk.phase==='identify'?'IDENTIFICANDO':afk.phase==='recovery'?'RECUPERANDO':'HUNT ATIVA') : 'DESLIGADO';
      status.textContent=`${phase} · ${afk.message}`;
      status.dataset.running=String(afk.enabled);
    }
    const toggle=root.querySelector('[data-afk-toggle]');
    if (toggle) {
      toggle.textContent=afk.enabled?'■ Parar AFK':'▶ Iniciar AFK';
      toggle.dataset.on=String(afk.enabled);
      toggle.title=afk.enabled?'Clique para interromper o modo AFK':'Inicia a Hunt diretamente, sem ativar a aba Hunt';
    }
    const sequence=afkSequence();
    const order=root.querySelector('[data-afk-order]');
    if (order) order.textContent=sequence.length?'Ordem: '+sequence.join(' → '):'Nenhum personagem selecionado para jogar.';
    const roster=root.querySelector('[data-afk-roster]');
    if (roster) roster.textContent=!afkProfiles.roster.length
      ? 'Lista ainda não detectada. Na tela SEUS PERSONAGENS, o bot registra os nomes e as vocações automaticamente.'
      : sequence.length
        ? `${sequence.length} incluído(s) · ${list.length-sequence.length} ignorado(s). Nomes e vocações lidos do Stonegy.`
        : 'Marque quem participa da rotação; os demais são ignorados. Sem cadastro manual.';
  };

  // No reload que ocorre na troca, nunca religar o motor enquanto o menu
  // de seleção do próximo personagem ainda está aberto.
  if (afk.enabled && afk.phase==='switch') {
    BOT_CONFIG.botAtivo=false;
    botSaveConfig();
  } else if (afk.enabled && afk.phase==='hunt') {
    afkApplyProfile();
  }

  const botKeepActive = () => { if (!BOT_CONFIG.antiInatividadeAtivo || document.readyState === "unloading" || Date.now() - botLastActivity < 5000) return; botLastActivity = Date.now(); const x = Math.max(1, Math.floor(innerWidth / 2)), y = Math.max(1, Math.floor(innerHeight / 2)); const t = document.elementFromPoint(x, y) || document.body; if (!t) return; t.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, view: window, clientX: x, clientY: y })); t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, view: window, clientX: x, clientY: y })); };
  function botMonitorHunt() {
    // O lider pode estar em uma aba sem foco: continuar monitorando o ciclo.
    if (!BOT_CONFIG.botAtivo || !botPartyAllowsHunt()) return;
    if (botHandleConnectionLost()) { botUpdatePanel(); return; }
    if (botHandleInactivity()) { botUpdatePanel(); return; }
    botTrackHuntSession();
    if (Date.now() < botRestartCooldownUntil) return;
    const current = botInHunt();
    botHuntState = current;
    if (!current && !botGetFlow() && !botHuntAsyncRunning && !botTrainingAsyncRunning &&
        !(afk.enabled && afk.levelTransition)) {
      if (!botScreenIsStable()) { botUpdatePanel(); return; }
      if (Date.now() - botMonitorLastSetFlow < BOT_MONITOR_COOLDOWN_MS) { botUpdatePanel(); return; }
      const next = botDecideNextStep();
      if (next) {
        if (botLastAbortFrom === next && Date.now() - botLastAbortAt < BOT_REENTRY_COOLDOWN_MS) { botUpdatePanel(); return; }
        if (next === "AGUARDANDO_VENDA" || next === "AGUARDANDO_PAINEL" || next === "AGUARDANDO_CHECAR_STAMINA" || next === "AGUARDANDO_TREINAR" || next === "AGUARDANDO_INICIAR_HUNT") {
          botLog("info", `👁 → ${flowLabel(next)}`);
          if (next === "AGUARDANDO_PAINEL") { botPanelWaitStart = Date.now(); botProtectAttempts = 0; }
          botMonitorLastSetFlow = Date.now();
          botSetFlow(next);
        }
      }
    }
    botUpdatePanel();
  }
  function botResumeLoop() {
    if (!BOT_CONFIG.botAtivo && !window.__emerickPartyGate?.enabled) return;
    botHandleInactivity();
  }
  function startBotModule() {
    if (!document.body) return;
    if (!document.querySelector("#stonegy-tm-overlay")) createPanel();
    botInjectInventoryStyles();
    setupBotTab();
    ensureEmerickTabButton();
    botObserver = new MutationObserver(() => {
      if (botScheduled) return;
      botScheduled = true;
      queueMicrotask(() => {
        botScheduled = false;
        ensureEmerickTabButton();
        botProcess();
        botApplyInventoryMarkers();
      });
    });
    botObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    // Captura uma entrada MANUAL no mundo, sem interceptar ou clicar no jogo.
    document.addEventListener('click', afkCaptureManualEntry, true);
    document.addEventListener("keydown", (e) => { if (e.altKey && e.shiftKey && e.key.toLowerCase() === "r") { e.preventDefault(); botStartReturn(); } });
    document.addEventListener("keydown", (e) => { if (e.altKey && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); botKillSwitch(); } });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { botHuntState = botInHunt(); botProcess(); } });
    window.addEventListener("focus", () => { botHuntState = botInHunt(); botProcess(); });
    setInterval(botProcess, 400);
    setInterval(ensureEmerickTabButton, 2500);
    setInterval(emBestiaryTick, 2000);
    setInterval(botWatchdog, 400);
    setInterval(botResumeLoop, BOT_RESUME_SCAN_MS);
    setInterval(botMonitorHunt, 500);
    setInterval(botPartyPostHuntTick, 500);
    setInterval(afkTick, 900);
    setInterval(botKeepActive, 120000);
    setInterval(botUpdatePanel, 1000);
    setInterval(() => { if (botSellPanelOpen()) botApplyVisualMarkers(); }, 500);
    setInterval(botApplyInventoryMarkers, BOT_INV_MARKERS_SCAN_MS);
    setInterval(() => { if (!document.querySelector("#stonegy-inv-styles")) botInjectInventoryStyles(); }, 5000);
    botHuntState = botInHunt(); botUpdatePanel();
    botLog("success", "🟢 Stonegy ON");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startBotModule, { once: true }); else startBotModule();

  // ==================== HOOK WEBSOCKET ====================
  const OriginalWebSocket = window.WebSocket;
  const processValue = (value) => {
    if (typeof value === "string") {
      try {
        const message = JSON.parse(value);
        if (message?.type === "auth" || message?.data?.tokenKey || message?.token || message?.authorization) return;
        if (message?.type === "hunt:update_players" && Array.isArray(message?.data?.players)) {
          const names = {};
          message.data.players.filter((p) => Number.isInteger(p?.runtimePlayerId) && typeof p?.name === "string").forEach((p) => { names[`runtime:${p.runtimePlayerId}`] = p.name; });
          processCombat({ damages: [], names, time: new Date().toISOString() });
        }
      } catch(_) {}
      return;
    }
    const handleBytes = (bytes) => {
      const decoded = decodeFrame(bytes);
      if (decoded?.damages?.length || Object.keys(decoded?.names || {}).length) {
        processCombat({ damages: decoded?.damages || [], names: decoded?.names || {}, time: new Date().toISOString() });
      }
    };
    if (value instanceof ArrayBuffer) handleBytes(new Uint8Array(value));
    else if (ArrayBuffer.isView(value)) handleBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    else if (value instanceof Blob) value.arrayBuffer().then((buf) => handleBytes(new Uint8Array(buf))).catch(() => {});
  };
  function CapturedWebSocket(...args) {
    const socket = Reflect.construct(OriginalWebSocket, args, new.target === CapturedWebSocket ? OriginalWebSocket : new.target);
    socket.addEventListener("message", (event) => processValue(event.data));
    return socket;
  }
  CapturedWebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(CapturedWebSocket, OriginalWebSocket);
  window.WebSocket = CapturedWebSocket;

  // ==================== DEBUG EXPORT ====================
  window.__stonegy = {
    version: "6.2.65",
    afk: () => ({...afk, profiles:afkProfiles}),
    config: BOT_CONFIG,
    saveConfig: botSaveConfig,
    getFlow: botGetFlow,
    setFlow: botSetFlow,
    clearFlow: () => botClearFlow("debug"),
    killSwitch: botKillSwitch,
    log: botLog,
    toast: botToast,
    logHistory: () => botLogBuffer.slice(),
    clearLog: botClearLog,
    flowHistory: () => botLogBuffer.filter((e) => e.level === "flow"),
    readStamina: botReadStamina,
    fmtStamina: botFmtStamina,
    fmtCountdown: botFmtCountdown,
    fmtDuration: botFmtDuration,
    readHuntStatus: botReadHuntStatus,
    refilStats: () => ({ ...botRefilStats, avg: botRefilAverage() }),
    resetRefil: () => { botRefilStats = { huntCount: 0, sellCount: 0, huntDurations: [] }; botSaveRefilStats(); if (botLogFilter === "refil") botRenderLog(); return botRefilStats; },
    showRefil: () => { botLogFilter = "refil"; if (botRoot) { botRoot.querySelectorAll(".log-filter[data-log-filter]").forEach((b) => b.classList.toggle("active", b.dataset.logFilter === "refil")); } botRenderLog(); },
    gameModePanel: botFindGameModePanel,
    trainingModeButton: botFindTrainingModeButton,
    startTrainingButton: botFindStartTrainingButton,
    finalizarTreinoButton: botFindFinalizarTreinoButton,
    isTraining: botTreinando,
    runTraining: () => { botTrainingAsyncRunning = true; return botExecutarTreino().finally(() => { botTrainingAsyncRunning = false; botTrainingStartedAt = 0; botTrainingTotalMs = 0; }); },
    // Exclusivo da Party: inicia e confirma, sem finalizar o treino.
    beginPartyTraining: async (skill) => {
      const gate=window.__emerickPartyGate;
      if (!gate?.enabled || !gate.closing || afk.enabled || botInHunt() ||
          botFindConnectionLostPanel() || botHuntAsyncRunning ||
          botTrainingAsyncRunning || BOT_CONFIG.botAtivo || botGetFlow()) return false;
      if (!['Fist','Distance','Magic','Sword','Axe','Club'].includes(skill)) return false;
      botTrainingAsyncRunning=true;
      try { return await afkBeginTraining(skill); }
      finally { botTrainingAsyncRunning=false; }
    },
    connectionLostPanel: botFindConnectionLostPanel,
    reloadButton: botFindReloadButton,
    isConnLost: () => botConnLostActive,
    clickReload: () => { const b = botFindReloadButton(); if (b) { botClick(b); return true; } return false; },
    syncNow: botSyncItemsToProtectedList,
    verifyItems: botAllItemsInCorrectState,
    hasSellable: botHasSellableItems,
    itemsInInventory: botFindInventoryItems,
    itemsInSellPanel: botFindAllSellItems,
    sellButton: botFindSellConfirmButton,
    cancelButton: botFindCancelButton,
    startHuntButton: botFindStartHuntButton,
    searchInput: botFindSearchInput,
    playButton: botFindPlayButton,
    huntResult: botFindHuntResult,
    typeInput: botTypeInputNative,
    lureTrigger: botFindLureTrigger,
    lureOptions: botFindLureOptions,
    concluirLure: botFindConcluirLureButton,
    acharH5: botAcharH5,
    runHuntFlow: () => { botHuntAsyncRunning = true; return botExecutarIniciarHuntEAjustarLure().finally(() => { botHuntAsyncRunning = false; emHuntPriority.active=false; emHuntPriority.stage='ready'; }); },
    runLureOnly: () => botExecutarAjustarLure(),
    clickableAncestor: botFindClickableAncestor,
    click: botClick,
    startReturn: botStartReturn,
    isAsyncRunning: () => botHuntAsyncRunning,
    isTrainingRunning: () => botTrainingAsyncRunning,
    pendingIntents: () => Array.from(botPendingIntent.entries()),
    clearIntents: () => botPendingIntent.clear(),
    injectInvStyles: botInjectInventoryStyles,
    applyInvMarkers: botApplyInventoryMarkers,
  };

  const startPanel = () => createPanel();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startPanel, { once: true }); else startPanel();
})();
