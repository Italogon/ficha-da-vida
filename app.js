// ===== Ficha da Vida — lógica e interface =====
'use strict';

/* ---------- Datas ---------- */
const pad = n => String(n).padStart(2, '0');
const dkey = (dt = new Date()) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const parseD = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseD(k); d.setDate(d.getDate() + n); return dkey(d); };
const today = () => dkey();
const weekKey = (k = today()) => { const d = parseD(k); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return dkey(d); };
const weekDays = wk => Array.from({ length: 7 }, (_, i) => addDays(wk, i));
const monthKey = k => k.slice(0, 7);
const fmtD = k => { const d = parseD(k); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); };
const fmtFull = k => parseD(k).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- Estado ---------- */
const KEY = 'fichaDaVida_v1';
let S;
function freshState() {
  return {
    v: 1, onboarded: false, created: today(), lastProcessed: null,
    profile: { nome: '', idade: '', classe: 'equilibrado', futuro: '', avatar: { type: 'preset', key: 'cavaleiro' }, cover: null, frame: 'none', avatarFrame: 'auto', titulo: '', },
    settings: { tema: 'escuro', accent: '#f59e0b', meta: 'media', orcamento: 0, goldCap: 1000, lembrete: '20:00', lembreteOn: false, backupDias: 7, githubRepo: '', githubPasta: 'backups', recMes: 7, recAno: 37 },
    missions: clone(DEFAULT_MISSIONS),
    lists: clone(DEFAULT_LISTS),
    shop: clone(DEFAULT_SHOP),
    tests: clone(DEFAULT_TESTS),
    marcos: clone(DEFAULT_MARCOS), marcosDone: {},
    log: {}, bonusDone: {}, ledger: [],
    levels: { fisico: 1, mental: 1, criativo: 1, prog: 1 }, levelSpent: { fisico: 0, mental: 0, criativo: 0, prog: 0 },
    testsLog: [], freezes: 0, frozen: {}, repaired: {}, folga: {}, broken: [], best: {}, streakReward: {},
    chests: [], chestDays: {}, chestHistory: [], purchases: [],
    bossWon: {}, framesOwned: ['none'], badges: {}, chronicles: [], reviews: {}, notifiedDay: null,
    roleta: clone(DEFAULT_ROLETA).concat([clone(VIDEO_CAT)]), roletaHist: [], recovery: { active: false, since: null }, recDays: {}, recReturns: 0, mood: {}, refs: [], v13: true
  };
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const f = freshState(); const saved = JSON.parse(raw); S = Object.assign(f, saved); if (!saved.v13) S.v13 = false; S.settings = Object.assign(freshState().settings, S.settings); normalize(); return; } } catch (e) { console.warn(e); }
  S = freshState(); normalize();
}
function normalize() {
  if (!S.v13) { if (!S.roleta.find(c => c.id === 'videos')) S.roleta.push(clone(VIDEO_CAT)); S.refs ||= []; S.v13 = true; }
  for (const c of S.roleta) for (const it of c.itens) it.id ||= uid();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('⚠️ Não consegui salvar (armazenamento cheio?)'); } }

/* ---------- Fotos (IndexedDB) ---------- */
let dbP = null;
function idb() {
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => { const r = indexedDB.open('fichaFotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('fotos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbP;
}
async function idbPut(id, blob) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('fotos', 'readwrite'); t.objectStore('fotos').put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbGet(id) { const db = await idb(); return new Promise((res) => { const r = db.transaction('fotos').objectStore('fotos').get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }
async function idbDel(id) { const db = await idb(); return new Promise(res => { const t = db.transaction('fotos', 'readwrite'); t.objectStore('fotos').delete(id); t.oncomplete = res; }); }
async function idbAll() { const db = await idb(); return new Promise(res => { const out = {}; const r = db.transaction('fotos').objectStore('fotos').openCursor(); r.onsuccess = () => { const c = r.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; }); }
const urlCache = {};
async function photoURL(id) { if (!id) return null; if (urlCache[id]) return urlCache[id]; const b = await idbGet(id); if (!b) return null; urlCache[id] = URL.createObjectURL(b); return urlCache[id]; }
function resizeImage(file, max, asDataURL, quality = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      let { width: w, height: h } = img; const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(u);
      if (asDataURL) res(c.toDataURL('image/jpeg', quality)); else c.toBlob(b => res(b), 'image/jpeg', quality);
    };
    img.onerror = () => rej(new Error('imagem inválida')); img.src = u;
  });
}
async function savePhotoFile(file) { const blob = await resizeImage(file, 1280, false); const id = 'f_' + uid(); await idbPut(id, blob); return id; }
// preenche <img data-photo="id"> depois de renderizar
async function hydratePhotos(root = document) {
  for (const el of root.querySelectorAll('img[data-photo]')) { const u = await photoURL(el.dataset.photo); if (u) el.src = u; }
}

/* ---------- Livro-razão (XP e Ouro) ---------- */
function goldNow() { return S.ledger.reduce((s, e) => s + (e.gold || 0), 0); }
function xpTotal(attr) { return S.ledger.reduce((s, e) => s + (e.attr === attr ? (e.xp || 0) : 0), 0); }
function addLedger(ref, attr, xp, gold, why, d = today()) {
  if (gold > 0) { const room = Math.max(0, S.settings.goldCap - goldNow()); if (gold > room) { gold = room; if (room === 0) toast('💰 Bolsa cheia! Gaste na loja para voltar a ganhar ouro.'); } }
  S.ledger.push({ ref, attr, xp, gold, why, d });
}
function removeRef(prefix) { S.ledger = S.ledger.filter(e => !(e.ref === prefix || e.ref.startsWith(prefix + '|'))); }
function hasRef(ref) { return S.ledger.some(e => e.ref === ref); }

/* ---------- Níveis ---------- */
const xpNeed = L => 150 * L + 100;
const maxLevel = attr => S.tests[attr].length + 1;
const xpInLevel = attr => Math.max(0, xpTotal(attr) - S.levelSpent[attr]);
const testUnlocked = attr => S.levels[attr] < maxLevel(attr) && xpInLevel(attr) >= xpNeed(S.levels[attr]);

/* ---------- Missões e dias ---------- */
const activeMissions = () => S.missions.filter(m => !m.off);
const logOf = d => S.log[d] || {};
function entry(d, id) { return logOf(d)[id]; }
function bridge(attr, d) { return !!(S.frozen[attr]?.[d] || S.folga[d] || S.repaired[attr]?.[d] || S.recDays?.[d]); }
function dayOk(attr, d) {
  const L = logOf(d); const ms = activeMissions().filter(m => m.attr === attr);
  const dailyMand = ms.filter(m => m.freq === 'daily' && m.mandatory);
  if (dailyMand.length) return dailyMand.every(m => L[m.id]);
  if (ms.some(m => L[m.id])) return true;
  return (S.bonusDone[d] || []).some(i => dailyBonus(d)[i]?.attr === attr);
}
function streakEnding(attr, d) {
  let n = 0, cur = d, guard = 0;
  while (cur >= S.created && guard++ < 4000) {
    if (dayOk(attr, cur)) n++; else if (!bridge(attr, cur)) break;
    cur = addDays(cur, -1);
  }
  return n;
}
function streak(attr) { const t = today(); const s = dayOk(attr, t) ? streakEnding(attr, t) : streakEnding(attr, addDays(t, -1)); if (s > (S.best[attr] || 0)) S.best[attr] = s; return s; }
function goldMult(attr) {
  const st = STREAK_ATTRS.includes(attr) ? streak(attr) : 0;
  return Math.min(2, 1 + Math.min(0.5, Math.floor(st / 7) * 0.05) + 0.1 * (S.levels[attr] - 1));
}
function weeklyCount(id, wk = weekKey()) { return weekDays(wk).filter(d => entry(d, id)?.kind === 'full').length; }

function processDays() {
  const y = addDays(today(), -1);
  let d = S.lastProcessed ? addDays(S.lastProcessed, 1) : y;
  if (d < S.created) d = S.created;
  const notes = [];
  while (d <= y) {
    if (S.recovery?.active && !tryRecoveryDay(d)) notes.push('🌙 Seus dias de recuperação acabaram. A versão mínima das missões continua salvando a sequência.');
    const risk = STREAK_ATTRS.filter(a => !dayOk(a, d) && !bridge(a, d)).map(a => [a, streakEnding(a, addDays(d, -1))]).filter(([, prev]) => prev > 0);
    if (risk.length && S.freezes > 0) {
      S.freezes--; risk.forEach(([a]) => (S.frozen[a] ||= {})[d] = true);
      notes.push(`🧊 Protetor usado em ${fmtD(d)}: ${risk.map(([a]) => ATTRS[a].nome).join(', ')} salvo(s)!`);
    } else for (const [a, prev] of risk) { S.broken.push({ id: uid(), attr: a, date: d, lost: prev }); notes.push(`💔 Sequência de ${ATTRS[a].nome} (${prev} dias) quebrou. Você tem 48 h para consertar!`); }
    d = addDays(d, 1);
  }
  S.lastProcessed = y;
  // expira consertos vencidos
  S.broken = S.broken.filter(b => Date.now() < parseD(addDays(b.date, 3)).getTime());
  return notes;
}
const REPAIR_COST = 150;
function repairStreak(bid) {
  const b = S.broken.find(x => x.id === bid); if (!b) return;
  if (goldNow() < REPAIR_COST) return toast(`Você precisa de ${REPAIR_COST} 🪙 para consertar.`);
  addLedger('repair:' + bid, null, 0, -REPAIR_COST, 'Conserto de ofensiva');
  let d = b.date; const y = addDays(today(), -1);
  while (d <= y) { if (!dayOk(b.attr, d)) (S.repaired[b.attr] ||= {})[d] = true; d = addDays(d, 1); }
  S.broken = S.broken.filter(x => x.id !== bid);
  S.repairs = (S.repairs || 0) + 1;
  toast(`🔧 Sequência de ${ATTRS[b.attr].nome} consertada!`); afterChange();
}

/* ---------- Missão bônus do dia ---------- */
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
function dailyBonus(d) {
  const n = { leve: 1, media: 2, intensa: 3 }[S.settings.meta] || 2;
  const r = seeded('bonus' + d); const pool = BONUS_POOL.slice(); const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/* ---------- Marcar missões ---------- */
function markMission(id, kind) {
  const d = today(); const m = S.missions.find(x => x.id === id); if (!m) return;
  const cur = entry(d, id);
  if (cur && cur.kind === kind) return unmarkMission(id);
  if (cur) unmarkMission(id, true);
  const hour = new Date().getHours();
  (S.log[d] ||= {})[id] = { kind, t: Date.now(), hour, photo: null };
  const ref = `m:${d}:${id}`;
  if (kind === 'full') addLedger(ref, m.attr, m.freq === 'weekly' ? 15 : 10, Math.round(5 * goldMult(m.attr)), m.nome);
  else addLedger(ref, m.attr, 3, 0, m.nome + ' (mínima)');
  if (m.freq === 'weekly' && kind === 'full') {
    const wk = weekKey(); const wref = `w:${wk}:${id}`;
    if (weeklyCount(id) >= (m.target || 1) && !hasRef(wref)) { addLedger(wref, m.attr, 50, 40, `Meta semanal: ${m.nome}`); toast(`🏆 Meta semanal batida: ${m.nome}! +50 XP +40 🪙`); }
  }
  afterChange();
}
function unmarkMission(id, silent) {
  const d = today(); const m = S.missions.find(x => x.id === id); const e = entry(d, id); if (!e) return;
  delete S.log[d][id];
  removeRef(`m:${d}:${id}`); removeRef(`p:${d}:${id}`);
  if (m?.freq === 'weekly') { const wref = `w:${weekKey()}:${id}`; if (weeklyCount(id) < (m.target || 1)) removeRef(wref); }
  if (!silent) afterChange();
}
function toggleBonus(i) {
  const d = today(); const arr = (S.bonusDone[d] ||= []); const b = dailyBonus(d)[i]; const ref = `b:${d}:${i}`;
  if (arr.includes(i)) { S.bonusDone[d] = arr.filter(x => x !== i); removeRef(ref); }
  else { arr.push(i); addLedger(ref, b.attr, 15, Math.round(10 * goldMult(b.attr)), 'Bônus: ' + b.t); }
  afterChange();
}
async function attachProof(id, file) {
  const d = today(); const e = entry(d, id); if (!e) return toast('Marque a missão primeiro.');
  const pid = await savePhotoFile(file); if (e.photo) idbDel(e.photo); e.photo = pid;
  const m = S.missions.find(x => x.id === id);
  const pref = `p:${d}:${id}`; if (!hasRef(pref) && e.kind === 'full') addLedger(pref, m.attr, 0, Math.max(1, Math.round(5 * goldMult(m.attr) * 0.2)), 'Prova com foto');
  toast('📸 Prova salva no diário!'); afterChange();
}

/* ---------- Chefe semanal ---------- */
function bossOf(wk) { const n = Math.floor(parseD(wk).getTime() / (7 * 864e5)); return BOSSES[((n % BOSSES.length) + BOSSES.length) % BOSSES.length]; }
function bossHP(wk) {
  let pot = 0; for (const m of activeMissions()) { if (!m.mandatory) continue; pot += m.freq === 'daily' ? 70 : (m.target || 1) * 10; }
  return Math.max(100, Math.round(pot * 0.8));
}
function bossDmg(wk) {
  let dmg = 0;
  for (const d of weekDays(wk)) {
    for (const e of Object.values(logOf(d))) dmg += (e.kind === 'full' ? 10 : 4) + (e.photo ? 5 : 0);
    dmg += (S.bonusDone[d] || []).length * 15;
  }
  return dmg;
}

/* ---------- Baús ---------- */
function grantChest(rarity, source) { S.chests.push({ id: uid(), rarity, source, d: today() }); }
function rollRarity() { const r = Math.random(); return r < 0.04 ? 'lendario' : r < 0.2 ? 'raro' : 'comum'; }
const RAR = { comum: { nome: 'Comum', gold: [5, 15], cor: '#9ca3af' }, raro: { nome: 'Raro', gold: [30, 60], cor: '#3b82f6' }, lendario: { nome: 'Lendário', gold: [100, 200], cor: '#f59e0b' } };
function rollPrize(rarity) {
  const cats = Object.entries(S.lists).filter(([, v]) => v.length);
  const g = RAR[rarity].gold; const gold = g[0] + Math.floor(Math.random() * (g[1] - g[0] + 1));
  if (!cats.length) return { cat: null, item: null, gold };
  const [cat, items] = cats[Math.floor(Math.random() * cats.length)];
  return { cat, item: items[Math.floor(Math.random() * items.length)], gold };
}
const CAT_NAMES = { jogos: '🎮 Jogo para relaxar', desenhos: '🎨 Desenho para fazer', lazer: '📺 Lazer livre' };

/* ---------- Emblemas ---------- */
function countKind(id, kind = 'full') { let n = 0; for (const L of Object.values(S.log)) if (L[id]?.kind === kind) n++; return n; }
function countAnyLate() { for (const L of Object.values(S.log)) for (const e of Object.values(L)) if (e.hour >= 0 && e.hour < 4) return 1; return 0; }
const BADGES = [
  { id: 'seq', icon: '🔥', nome: 'Ofensiva', names: ['Faísca', 'Chama', 'Inferno', 'Fênix'], tiers: [7, 30, 100, 365], desc: 'Dias seguidos em qualquer atributo', get: () => Math.max(0, ...STREAK_ATTRS.map(a => Math.max(S.best[a] || 0, streak(a)))) },
  { id: 'ressur', icon: '🔧', nome: 'Ressurreição', tiers: [1], desc: 'Consertar uma sequência', get: () => S.repairs || 0 },
  { id: 'academia', icon: '🏋️', nome: 'Rato de Academia', tiers: [10, 50, 150], desc: 'Treinos completos', get: () => countKind('academia') },
  { id: 'jiu', icon: '🥋', nome: 'Faixa Retomada', tiers: [1], desc: 'Voltar ao Jiu-Jitsu', get: () => countKind('jiu') + (S.marcosDone.jiu_volta ? 1 : 0) },
  { id: 'tfis', icon: '💪', nome: 'Primeiro Teste', tiers: [1], desc: 'Passar no 1º teste físico', get: () => S.levels.fisico - 1 },
  { id: 'leitor', icon: '📚', nome: 'Leitor', tiers: [100, 500, 2000], desc: 'Páginas lidas', get: () => countKind('leitura') * 5 + countKind('leitura', 'min') },
  { id: 'poli', icon: '🗣️', nome: 'Poliglota', tiers: [10, 50, 200], desc: 'Aulas de inglês', get: () => countKind('ingles') },
  { id: 'anbima', icon: '🏦', nome: 'Certificado', tiers: [1], desc: 'Conquistar o certificado ANBIMA', get: () => S.marcosDone.anbima_cert ? 1 : 0 },
  { id: 'concurso', icon: '📝', nome: 'Concurseiro', tiers: [10, 50, 100], desc: 'Horas de estudo para concursos', get: () => Math.floor(countKind('concurso') * 20 / 60) },
  { id: 'traco', icon: '✏️', nome: 'Traço Firme', tiers: [10, 50, 100], desc: 'Sessões de desenho', get: () => countKind('desenho') },
  { id: 'pixel', icon: '👾', nome: 'Pixelador', tiers: [1], desc: 'Primeira pixel art', get: () => S.marcosDone.pixel1 ? 1 : 0 },
  { id: 'escultor', icon: '🧊', nome: 'Escultor de Polígonos', tiers: [1], desc: 'Primeiro modelo 3D', get: () => S.marcosDone.modelo1 ? 1 : 0 },
  { id: 'contador', icon: '📜', nome: 'Contador de Histórias', tiers: [10], desc: 'Horas de narrativa', get: () => countKind('narrativa') },
  { id: 'hello', icon: '👋', nome: 'Hello World', tiers: [1], desc: 'Primeiro projeto de programação', get: () => ['p_python', 'p_js', 'p_java', 'p_cs'].some(k => S.marcosDone[k]) ? 1 : 0 },
  { id: 'polcod', icon: '🧬', nome: 'Poliglota do Código', tiers: [4], desc: 'Marco nas 4 linguagens', get: () => ['p_python', 'p_js', 'p_java', 'p_cs'].filter(k => S.marcosDone[k]).length },
  { id: 'hacker', icon: '🛡️', nome: 'Hacker do Bem', tiers: [1], desc: 'Trilha de cibersegurança', get: () => S.marcosDone.p_cyber ? 1 : 0 },
  { id: 'merc', icon: '💰', nome: 'Mercenário', tiers: [1], desc: 'Primeiro projeto vendido', get: () => S.marcosDone.p_venda ? 1 : 0 },
  { id: 'cronista', icon: '🪶', nome: 'Cronista', tiers: [5, 20, 50], desc: 'Crônicas escritas', get: () => S.chronicles.length },
  { id: 'chefe', icon: '⚔️', nome: 'Matador de Chefes', tiers: [1, 5, 20], desc: 'Chefes semanais derrotados', get: () => Object.keys(S.bossWon).length },
  { id: 'sortudo', icon: '🍀', nome: 'Sortudo', tiers: [1], desc: 'Abrir um baú lendário', get: () => S.chestHistory.filter(h => h.rarity === 'lendario').length },
  { id: 'colec', icon: '🛍️', nome: 'Colecionador', tiers: [10], desc: 'Recompensas compradas', get: () => S.purchases.length },
  { id: 'equil', icon: '⚖️', nome: 'Equilíbrio Perfeito', tiers: [1], desc: 'Os 3 atributos no mesmo nível (2+)', get: () => (S.levels.fisico === S.levels.mental && S.levels.mental === S.levels.criativo && S.levels.fisico >= 2) ? 1 : 0 },
  { id: 'revisor', icon: '🔎', nome: 'Autoconhecimento', tiers: [1, 12, 52], desc: 'Revisões feitas', get: () => Object.keys(S.reviews).length },
  { id: 'resil', icon: '🌱', nome: 'Resiliência', tiers: [1, 3], desc: 'Voltar depois de um Modo Recuperação', get: () => S.recReturns || 0 },
  { id: 'coruja', icon: '🦉', nome: 'Coruja', tiers: [1], secret: true, desc: 'Cumprir uma missão depois da meia-noite', get: countAnyLate },
  { id: 'cheio', icon: '🐉', nome: 'Tesouro do Dragão', tiers: [1], secret: true, desc: 'Encher a bolsa de ouro', get: () => goldNow() >= S.settings.goldCap ? 1 : 0 }
];
function badgeTier(b) { const v = b.get(); let t = -1; b.tiers.forEach((th, i) => { if (v >= th) t = i; }); return t; }
function badgeLabel(b, t) { return b.names ? b.names[t] : (b.tiers.length > 1 ? `${b.nome} ${TIER_NAMES[t]}` : b.nome); }
function checkBadges() {
  for (const b of BADGES) {
    const t = badgeTier(b); const had = S.badges[b.id]?.tier ?? -1;
    if (t > had) {
      for (let k = had + 1; k <= t; k++) addLedger(`badge:${b.id}:${k}`, null, 0, 20 * (k + 1), 'Emblema: ' + badgeLabel(b, k));
      S.badges[b.id] = { tier: t, d: today() };
      celebrate(b.icon, 'Emblema conquistado!', badgeLabel(b, t), `+${20 * (t + 1)} 🪙`);
    }
  }
}

/* ---------- Pós-ação ---------- */
function afterChange() {
  const t = today();
  // baú diário
  if (!S.chestDays[t] && STREAK_ATTRS.every(a => dayOk(a, t))) {
    S.chestDays[t] = true; grantChest(rollRarity(), 'Missões do dia completas');
    if (S.freezes < MAX_FREEZES) { S.freezes++; toast(`🎁 Meta do dia cumprida! Baú + 🧊 1 bloqueio de ofensiva (${S.freezes}/${MAX_FREEZES}).`); }
    else toast('🎁 Meta do dia cumprida! Um baú te espera. (Bloqueios no máximo: 7/7)');
  }
  // marcos de sequência
  for (const a of STREAK_ATTRS) {
    const s = streak(a); const r = (S.streakReward[a] ||= { last: 0 });
    if (s < r.last) r.last = 0;
    for (const [n, rar, extra] of [[7, 'raro', 0], [30, 'raro', 100], [100, 'lendario', 0], [365, 'lendario', 300]]) {
      if (s >= n && r.last < n) { r.last = n; grantChest(rar, `${n} dias de ${ATTRS[a].nome}`); if (extra) addLedger(`sr:${a}:${n}:${t}`, null, 0, extra, `Sequência de ${n} dias`); toast(`🔥 ${n} dias de ${ATTRS[a].nome}! Baú ${RAR[rar].nome} ganho.`); }
    }
  }
  // chefe
  const wk = weekKey();
  if (!S.bossWon[wk] && bossDmg(wk) >= bossHP(wk)) {
    const b = bossOf(wk); S.bossWon[wk] = { nome: b.nome, d: t };
    if (!S.framesOwned.includes(b.frame)) S.framesOwned.push(b.frame);
    grantChest('raro', 'Chefe derrotado'); addLedger('boss:' + wk, null, 0, 50, 'Chefe derrotado: ' + b.nome);
    celebrate(b.emoji, 'Chefe derrotado!', b.nome, `Moldura “${FRAMES[b.frame]}” desbloqueada + baú raro + 50 🪙`);
  }
  checkBadges(); save(); render();
}

/* ---------- Revisões ---------- */
function reviewPeriods() {
  const t = today(); const d = parseD(t); const out = [];
  const wk = weekKey(t);
  if (d.getDay() === 0) out.push({ key: 'w:' + wk, tipo: 'semana', ini: wk, fim: addDays(wk, 6) });
  const pw = addDays(wk, -7); out.push({ key: 'w:' + pw, tipo: 'semana', ini: pw, fim: addDays(pw, 6) });
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const mIni = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  if (d.getDate() >= lastDay - 1) out.push({ key: 'm:' + monthKey(t), tipo: 'mês', ini: mIni, fim: `${monthKey(t)}-${pad(lastDay)}` });
  const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1); const pmEnd = new Date(d.getFullYear(), d.getMonth(), 0);
  if (d.getDate() <= 10) out.push({ key: 'm:' + dkey(pm).slice(0, 7), tipo: 'mês', ini: dkey(pm), fim: dkey(pmEnd) });
  if (d.getMonth() === 11 && d.getDate() >= 20) out.push({ key: 'y:' + d.getFullYear(), tipo: 'ano', ini: `${d.getFullYear()}-01-01`, fim: `${d.getFullYear()}-12-31` });
  if (d.getMonth() === 0 && d.getDate() <= 20) out.push({ key: 'y:' + (d.getFullYear() - 1), tipo: 'ano', ini: `${d.getFullYear() - 1}-01-01`, fim: `${d.getFullYear() - 1}-12-31` });
  return out.filter(p => p.fim >= S.created);
}
const pendingReviews = () => reviewPeriods().filter(p => !S.reviews[p.key]);
function periodStats(ini, fim) {
  let full = 0, min = 0, fotos = 0; const xp = { fisico: 0, mental: 0, criativo: 0, prog: 0 }; let gold = 0, gasto = 0;
  for (const [d, L] of Object.entries(S.log)) if (d >= ini && d <= fim) for (const e of Object.values(L)) { e.kind === 'full' ? full++ : min++; if (e.photo) fotos++; }
  for (const e of S.ledger) if (e.d >= ini && e.d <= fim) { if (e.attr) xp[e.attr] += e.xp || 0; if (e.gold > 0) gold += e.gold; else gasto -= e.gold || 0; }
  const chron = S.chronicles.filter(c => c.d >= ini && c.d <= fim);
  const tests = S.testsLog.filter(x => x.d >= ini && x.d <= fim);
  const bosses = Object.entries(S.bossWon).filter(([k]) => k >= addDays(ini, -6) && k <= fim).length;
  let dias = 0; for (let d = ini < S.created ? S.created : ini; d <= fim && d <= today(); d = addDays(d, 1)) if (STREAK_ATTRS.every(a => dayOk(a, d))) dias++;
  return { full, min, fotos, xp, gold, gasto, chron, tests, bosses, dias };
}
const REVIEW_Q = {
  semana: ['O que deu certo nesta semana?', 'O que ficou para trás?', 'Qual o foco da próxima semana?'],
  'mês': ['Qual foi a maior conquista do mês?', 'O que você quer mudar no próximo mês?', 'Nota do mês (1 a 5) e por quê?'],
  ano: ['Quem você se tornou este ano?', 'Qual foi a maior conquista do ano?', 'O que aprendeu sobre você mesmo?', 'Qual a grande meta para o próximo ano?']
};
const REVIEW_GOLD = { semana: 30, 'mês': 100, ano: 500 };

/* ---------- UI: utilidades ---------- */
const $ = s => document.querySelector(s);
let tab = 'hoje';
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700); }
const celebQ = [];
function celebrate(icon, title, name, sub) {
  if ($('#modal').classList.contains('open') && !$('#modal .celebrate')) { celebQ.push([icon, title, name, sub]); return; }
  if ($('#modal .celebrate')) { celebQ.push([icon, title, name, sub]); return; }
  openModal(`<div class="celebrate"><div class="big-icon pop">${icon}</div><div class="kicker">${esc(title)}</div><h2>${esc(name)}</h2><p class="muted">${esc(sub || '')}</p><button class="btn primary" data-act="close">Incrível!</button></div>`);
  try { navigator.vibrate?.([60, 40, 120]); } catch (e) { }
}
function openModal(html, cls = '') { const m = $('#modal'); m.innerHTML = `<div class="sheet ${cls}"><button class="x" data-act="close" aria-label="Fechar">✕</button>${html}</div>`; m.classList.add('open'); hydratePhotos(m); }
function closeModal() { $('#modal').classList.remove('open'); $('#modal').innerHTML = ''; if (celebQ.length) { const n = celebQ.shift(); setTimeout(() => celebrate(...n), 250); } }
function bar(v, max, cor) { const p = Math.max(0, Math.min(100, max ? v / max * 100 : 0)); return `<div class="bar"><div style="width:${p}%;background:${cor || 'var(--accent)'}"></div></div>`; }
function avatarHTML(size = 72, frameOverride) {
  const a = S.profile.avatar; let inner;
  if (a?.type === 'img' && a.data) inner = `<img src="${a.data}" alt="">`;
  else inner = pixelSVG(a?.key || 'cavaleiro');
  return `<div class="avatar af-${frameOverride || avatarFrame()}" style="width:${size}px;height:${size}px">${inner}</div>`;
}
function avatarFrame() {
  if (S.profile.avatarFrame && S.profile.avatarFrame !== 'auto') return S.profile.avatarFrame;
  const tot = S.levels.fisico + S.levels.mental + S.levels.criativo; return tot >= 12 ? 'ouro' : tot >= 8 ? 'prata' : tot >= 5 ? 'bronze' : 'none';
}
function pixelSVG(key) {
  const A = AVATARS[key] || AVATARS.cavaleiro; let r = '';
  A.g.forEach((row, y) => [...row].forEach((ch, x) => { if (A.pal[ch]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${A.pal[ch]}"/>`; }));
  return `<svg viewBox="-1 -1 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="-1" y="-1" width="12" height="12" fill="#1f2937"/>${r}</svg>`;
}
function totalLevel() { return S.levels.fisico + S.levels.mental + S.levels.criativo + S.levels.prog - 3; }
function currentTitle() { if (S.profile.titulo) return S.profile.titulo; const cl = { guerreiro: 'Guerreiro', sabio: 'Sábio', artesao: 'Artesão', equilibrado: 'Aventureiro' }[S.profile.classe] || 'Aventureiro'; return `${cl} nível ${totalLevel()}`; }

/* ---------- Render principal ---------- */
function applyTheme() {
  document.body.className = 'theme-' + S.settings.tema;
  document.documentElement.style.setProperty('--accent', S.settings.accent);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', S.settings.tema === 'claro' ? '#f8fafc' : S.settings.tema === 'pergaminho' ? '#f3e7c9' : '#0b1020');
}
function render() {
  applyTheme();
  if (!S.onboarded) return renderOnboarding();
  $('#nav').style.display = '';
  const views = { hoje: viewHoje, ficha: viewFicha, loja: viewLoja, cronicas: viewCronicas, mais: viewMais };
  $('#app').innerHTML = `<header class="topbar"><div class="tb-left">${avatarHTML(34)}<div><div class="tb-name">${esc(S.profile.nome || 'Aventureiro')}</div><div class="tb-sub">${esc(currentTitle())}</div></div></div><div class="tb-right"><span class="chip gold">🪙 ${goldNow()}</span><span class="chip" title="Bloqueios de ofensiva">🧊 ${S.freezes}/${MAX_FREEZES}</span></div></header><main class="view">${views[tab]()}</main>`;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  hydratePhotos();
}

/* ---------- Aba: Hoje ---------- */
function avisos() {
  const t = today(); const out = [];
  if (S.recEndedNotice) out.push({ cls: 'info', html: `🌙 Seus dias de recuperação deste período acabaram. Se ainda estiver difícil, tudo bem: a <b>versão mínima</b> já salva a sequência, e conversar com alguém pode ajudar. <button class="btn sm" data-act="sub" data-sub="recuperacao" data-go="1">Ver apoio</button> <button class="btn sm" data-act="recnoticeok">Ok</button>` });
  if (S.recovery?.active) {
    if (S.chests.length) out.push({ cls: 'good', html: `🎁 Você tem <b>${S.chests.length}</b> baú(s) para abrir. <button class="btn sm" data-act="go" data-tab="loja">Abrir</button>` });
    return out;
  }
  for (const b of S.broken) out.push({ cls: 'danger', html: `💔 Sequência de <b>${ATTRS[b.attr].nome}</b> (${b.lost} dias) quebrou. <button class="btn sm" data-act="repair" data-id="${b.id}">Consertar (${REPAIR_COST} 🪙)</button>` });
  if (S.chests.length) out.push({ cls: 'good', html: `🎁 Você tem <b>${S.chests.length}</b> baú(s) para abrir. <button class="btn sm" data-act="go" data-tab="loja">Abrir</button>` });
  const pr = pendingReviews(); if (pr.length) out.push({ cls: 'info', html: `🔎 Revisão da ${pr[0].tipo} disponível. <button class="btn sm" data-act="review" data-key="${pr[0].key}">Fazer</button>` });
  for (const a of Object.keys(ATTRS)) if (testUnlocked(a)) out.push({ cls: 'good', html: `⚔️ Teste de <b>${ATTRS[a].nome}</b> desbloqueado! <button class="btn sm" data-act="test" data-attr="${a}">Ver teste</button>` });
  for (const m of activeMissions().filter(m => m.freq === 'weekly' && m.mandatory)) {
    const c = weeklyCount(m.id); const left = (m.target || 1) - c; const dleft = 7 - ((parseD(t).getDay() + 6) % 7);
    if (left > 0) out.push({ cls: left >= dleft ? 'warn' : 'info', html: `📅 ${esc(m.nome.split('(')[0].trim())}: faltam <b>${left}</b> esta semana (${dleft} dia(s) restantes).` });
  }
  if (backupDue()) { const n = daysSinceBackup(); out.push({ cls: 'warn', html: `💾 ${S.lastBackup ? `Último backup há <b>${n}</b> dia(s).` : 'Você ainda não fez nenhum backup.'} Salve no seu GitHub! <button class="btn sm" data-act="export">Fazer backup</button>` }); }
  const pend = STREAK_ATTRS.filter(a => !dayOk(a, t) && !bridge(a, t));
  if (pend.length && new Date().getHours() >= 18) out.push({ cls: 'warn', html: `🔥 Sequência em risco hoje: ${pend.map(a => ATTRS[a].icon + ' ' + ATTRS[a].nome).join(', ')}` });
  return out;
}
function viewHoje() {
  const t = today(); const wk = weekKey(); const boss = bossOf(wk); const hp = bossHP(wk); const dmg = Math.min(hp, bossDmg(wk)); const won = S.bossWon[wk];
  const av = avisos();
  let h = `<div class="date-line">${esc(fmtFull(t))}</div>`;
  if (S.recovery?.active) h += recoveryBanner();
  h += `<div class="quick no-print"><button class="btn sm" data-act="sub" data-sub="roleta" data-go="1">🎡 Roleta</button><button class="btn sm" data-act="sub" data-sub="relatorio" data-go="1">📄 Relatório</button><button class="btn sm" data-act="sub" data-sub="referencias" data-go="1">📌 Referências</button>${S.recovery?.active ? '' : '<button class="btn sm" data-act="sub" data-sub="recuperacao" data-go="1">🌙 Fase difícil?</button>'}</div>`;
  h += moodRow(t);
  if (av.length) h += `<section class="avisos">${av.map(a => `<div class="aviso ${a.cls}">${a.html}</div>`).join('')}</section>`;
  // sequências
  h += `<section class="streaks">${STREAK_ATTRS.map(a => { const s = streak(a); const ok = dayOk(a, t); return `<div class="streak ${ok ? 'lit' : ''}" style="--c:${ATTRS[a].cor}"><div class="fire">${ok ? '🔥' : '🕯️'}</div><div class="sn">${s}</div><div class="sl">${ATTRS[a].nome}</div></div>`; }).join('')}</section>`;
  // chefe
  h += `<section class="card boss ${won ? 'won' : ''}"><div class="boss-top"><div class="boss-emoji">${boss.emoji}</div><div class="grow"><div class="kicker">Chefe da semana</div><div class="boss-name">${esc(boss.nome)}</div></div><div class="boss-hp">${won ? '☠️ Derrotado' : `${hp - dmg} HP`}</div></div>${bar(hp - dmg, hp, '#ef4444')}<div class="muted small">${S.recovery?.active && !won ? '😴 O chefe também está descansando. Sem pressa: ele espera você.' : won ? `Recompensa: moldura “${FRAMES[boss.frame]}” para a capa do perfil.` : `Cada missão causa dano. Derrote até domingo para ganhar a moldura “${FRAMES[boss.frame]}” + baú raro.`}</div></section>`;
  // missões por atributo
  for (const a of Object.keys(ATTRS)) {
    const ms = activeMissions().filter(m => m.attr === a); if (!ms.length) continue;
    h += `<section class="card"><div class="sec-title" style="--c:${ATTRS[a].cor}"><span>${ATTRS[a].icon} ${ATTRS[a].nome}</span><span class="small muted">x${goldMult(a).toFixed(2)} 🪙</span></div>`;
    for (const m of ms) h += missionRow(m, t);
    h += `</section>`;
  }
  // bônus
  const bon = dailyBonus(t); const bd = S.bonusDone[t] || [];
  h += `<section class="card"><div class="sec-title"><span>🎲 Missões bônus do dia</span><span class="small muted">+15 XP · +10 🪙</span></div>${bon.map((b, i) => `<div class="mission ${bd.includes(i) ? 'done' : ''}"><button class="check" data-act="bonus" data-i="${i}">${bd.includes(i) ? '✓' : ''}</button><div class="grow"><div class="mn">${esc(b.t)}</div><div class="small muted">${ATTRS[b.attr].icon} ${ATTRS[b.attr].nome}</div></div></div>`).join('')}</section>`;
  h += `<p class="muted small center">Complete todas as obrigatórias do dia (versão mínima vale) para ganhar um baú 🎁 e +1 bloqueio de ofensiva 🧊 (até ${MAX_FREEZES}).</p>`;
  return h;
}
function missionRow(m, d) {
  const e = entry(d, m.id); const cls = e ? (e.kind === 'full' ? 'done' : 'half') : '';
  const wk = m.freq === 'weekly' ? `<span class="tag">${weeklyCount(m.id)}/${m.target}/sem</span>` : '';
  return `<div class="mission ${cls}">
    <button class="check" data-act="mark" data-id="${m.id}" data-kind="full" aria-label="Feito">${e?.kind === 'full' ? '✓' : e?.kind === 'min' ? '½' : ''}</button>
    <div class="grow"><div class="mn">${esc(m.nome)} ${m.mandatory && !S.recovery?.active ? '<span class="tag must">obrigatória</span>' : ''} ${wk}</div>
      <div class="small muted">Mínima: ${esc(m.minimo || '—')}</div>
      <div class="m-actions">
        <button class="btn xs ${e?.kind === 'min' ? 'on' : ''}" data-act="mark" data-id="${m.id}" data-kind="min">½ Mínima</button>
        ${m.minutos ? `<button class="btn xs" data-act="timer" data-id="${m.id}">⏱ ${m.minutos} min</button>` : ''}
        <label class="btn xs ${e ? '' : 'disabled'}">📷 ${e?.photo ? 'Trocar foto' : 'Prova'}<input type="file" accept="image/*" data-act="proof" data-id="${m.id}" hidden ${e ? '' : 'disabled'}></label>
        ${e?.photo ? `<img class="thumb" data-photo="${e.photo}" data-act="viewphoto" data-pid="${e.photo}" alt="prova">` : ''}
      </div></div></div>`;
}

/* ---------- Timer ---------- */
let timer = null;
function openTimer(id) {
  const m = S.missions.find(x => x.id === id); if (!m) return;
  if (timer && timer.id !== id) { clearInterval(timer.iv); timer = null; }
  if (!timer) timer = { id, end: null, total: m.minutos * 60, left: m.minutos * 60, iv: null, running: false };
  openModal(`<div class="center"><div class="kicker">${ATTRS[m.attr].icon} ${esc(m.nome)}</div><div id="tclock" class="clock">--:--</div><div class="row center-row"><button class="btn primary" data-act="tstart">▶ Iniciar</button><button class="btn" data-act="tpause">⏸ Pausar</button><button class="btn" data-act="treset">↺</button></div><p class="muted small">Ao terminar, a missão é marcada como feita automaticamente.</p></div>`);
  drawTimer();
}
function drawTimer() { const el = $('#tclock'); if (!el || !timer) return; const l = Math.max(0, timer.running ? Math.round((timer.end - Date.now()) / 1000) : timer.left); el.textContent = `${pad(Math.floor(l / 60))}:${pad(l % 60)}`; }
function timerTick() {
  if (!timer?.running) return; drawTimer();
  if (Date.now() >= timer.end) {
    clearInterval(timer.iv); const id = timer.id; timer = null;
    try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch (e) { }
    notify('⏱ Tempo concluído!', 'Missão marcada como feita. Bom trabalho!');
    closeModal(); if (entry(today(), id)?.kind !== 'full') markMission(id, 'full'); toast('⏱ Tempo concluído! Missão feita.');
  }
}

/* ---------- Aba: Ficha ---------- */
function viewFicha() {
  const p = S.profile;
  let h = `<section class="hero"><div class="cover cf-${p.frame || 'none'}" style="${p.cover ? `background-image:url(${p.cover})` : ''}"></div><div class="hero-body">${avatarHTML(96)}<h2>${esc(p.nome)}</h2><div class="muted">${esc(currentTitle())}${p.idade ? ` · ${esc(p.idade)} anos` : ''}</div>${p.futuro ? `<blockquote>“${esc(p.futuro)}”</blockquote>` : ''}<div class="showcase">${showcaseBadges()}</div><button class="btn sm" data-act="go" data-tab="mais" data-sub="perfil">✏️ Personalizar</button></div></section>`;
  // radar
  h += `<section class="card"><div class="sec-title"><span>📊 Atributos</span></div><div class="radar-wrap">${radarSVG()}</div>`;
  for (const a of Object.keys(ATTRS)) {
    const L = S.levels[a]; const xi = xpInLevel(a); const need = xpNeed(L); const max = L >= maxLevel(a);
    h += `<div class="attr"><div class="attr-top"><span>${ATTRS[a].icon} <b>${ATTRS[a].nome}</b> · Nv ${L}</span><span class="small muted">${max ? 'nível máximo' : `${Math.min(xi, need)}/${need} XP`}</span></div>${bar(max ? 1 : xi, max ? 1 : need, ATTRS[a].cor)}
      ${max ? '' : `<button class="btn xs ${testUnlocked(a) ? 'primary pulse' : ''}" data-act="test" data-attr="${a}">${testUnlocked(a) ? '⚔️ Fazer o teste de nível' : '🔒 Ver próximo teste'}</button>`}</div>`;
  }
  h += `</section>`;
  // marcos / árvore
  const groups = { mental: 'Marcos Mentais', fisico: 'Marcos Físicos', criativo: 'Marcos Criativos' };
  h += `<section class="card"><div class="sec-title"><span>💻 Árvore de Programação</span></div><div class="tree">`;
  for (const g of ['Base', 'Especialização', 'Final']) {
    h += `<div class="tree-g"><div class="kicker">${g}</div>${S.marcos.filter(m => m.attr === 'prog' && m.grupo === g).map(marcoRow).join('')}</div>`;
  }
  h += `</div></section>`;
  h += `<section class="card"><div class="sec-title"><span>🏁 Marcos</span></div>${S.marcos.filter(m => m.attr !== 'prog').map(m => marcoRow(m)).join('')}</section>`;
  // calendário de calor
  h += `<section class="card"><div class="sec-title"><span>🗓️ Calendário de calor</span></div>${heatmap()}</section>`;
  h += `<section class="card"><div class="sec-title"><span>🏅 Emblemas</span><button class="btn xs" data-act="go" data-tab="mais" data-sub="emblemas">Ver todos</button></div><div class="badge-grid">${BADGES.filter(b => (S.badges[b.id]?.tier ?? -1) >= 0).map(b => badgeCard(b)).join('') || '<p class="muted small">Nenhum ainda. Bora começar! 🔥</p>'}</div></section>`;
  return h;
}
function marcoRow(m) { const done = S.marcosDone[m.id]; return `<div class="mission ${done ? 'done' : ''}"><button class="check" data-act="marco" data-id="${m.id}">${done ? '✓' : ''}</button><div class="grow"><div class="mn">${esc(m.nome)}</div>${done ? `<div class="small muted">Concluído em ${fmtD(done)}</div>` : ''}</div></div>`; }
function showcaseBadges() {
  const sel = (S.profile.showcase || []).filter(id => (S.badges[id]?.tier ?? -1) >= 0);
  const list = sel.length ? sel : Object.keys(S.badges).slice(-3);
  return list.map(id => { const b = BADGES.find(x => x.id === id); if (!b) return ''; const t = S.badges[id].tier; return `<span class="mini-badge t${t}" title="${esc(badgeLabel(b, t))}">${b.icon}</span>`; }).join('');
}
function badgeCard(b) {
  const t = S.badges[b.id]?.tier ?? -1; const v = b.get(); const next = b.tiers[t + 1];
  if (t < 0 && b.secret) return `<div class="badge locked"><div class="bi">❓</div><div class="bn">Secreto</div><div class="small muted">???</div></div>`;
  return `<div class="badge ${t >= 0 ? 't' + t : 'locked'}"><div class="bi">${b.icon}</div><div class="bn">${esc(t >= 0 ? badgeLabel(b, t) : b.nome)}</div><div class="small muted">${esc(b.desc)}</div>${next !== undefined ? `<div class="small">${Math.min(v, next)}/${next}</div>` : '<div class="small">✓ Completo</div>'}</div>`;
}
function radarSVG() {
  const keys = Object.keys(ATTRS); const N = keys.length; const R = 80, C = 100; const maxL = Math.max(5, ...keys.map(k => S.levels[k] + xpInLevel(k) / xpNeed(S.levels[k])));
  const pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / N; return [C + r * Math.cos(ang), C + r * Math.sin(ang)]; };
  let g = ''; for (let k = 1; k <= 4; k++) g += `<polygon points="${keys.map((_, i) => pt(i, R * k / 4).join(',')).join(' ')}" fill="none" stroke="var(--line)"/>`;
  const vals = keys.map((k, i) => pt(i, R * Math.min(1, (S.levels[k] + Math.min(1, xpInLevel(k) / xpNeed(S.levels[k]))) / maxL)).join(','));
  const labels = keys.map((k, i) => { const [x, y] = pt(i, R + 14); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--muted)">${ATTRS[k].icon} ${S.levels[k]}</text>`; }).join('');
  return `<svg viewBox="0 0 200 200" class="radar">${g}<polygon points="${vals.join(' ')}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)" stroke-width="2"/>${labels}</svg>`;
}
function heatmap() {
  const weeks = 20; const start = addDays(weekKey(), -7 * (weeks - 1)); let cells = '';
  for (let w = 0; w < weeks; w++) for (let i = 0; i < 7; i++) {
    const d = addDays(start, w * 7 + i); if (d > today()) { cells += `<i class="hm f"></i>`; continue; }
    const n = Object.values(logOf(d)).reduce((s, e) => s + (e.kind === 'full' ? 1 : 0.5), 0) + (S.bonusDone[d] || []).length;
    const lv = n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 6 ? 3 : 4;
    cells += `<i class="hm l${lv} ${S.recDays?.[d] ? 'rec' : ''}" title="${fmtD(d)}: ${n}${S.recDays?.[d] ? ' (recuperação)' : ''}"></i>`;
  }
  return `<div class="heat" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div><div class="small muted heat-leg">menos <i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i> mais · <i class="hm rec"></i> pausa</div>`;
}
function openTest(a) {
  const L = S.levels[a]; const t = S.tests[a][L - 1];
  if (!t) return toast('Nível máximo! Adicione novos testes em Mais → Testes.');
  const un = testUnlocked(a); const need = xpNeed(L);
  openModal(`<div class="kicker">${ATTRS[a].icon} ${ATTRS[a].nome} · Nível ${L} → ${L + 1}</div><h2>Teste de nível</h2>
    <div class="card inner"><div class="small muted">Requisito</div><div>${esc(t.req)}</div></div>
    <div class="card inner"><div class="small muted">Teste</div><div><b>${esc(t.teste)}</b></div></div>
    <div class="small">XP: ${Math.min(xpInLevel(a), need)}/${need}</div>${bar(xpInLevel(a), need, ATTRS[a].cor)}
    ${un ? `<p class="small">Envie uma foto ou print como prova para registrar a conquista:</p>
      <label class="btn">📷 Escolher foto da prova<input type="file" accept="image/*" id="testPhoto" hidden></label><span id="testPhotoOk" class="small muted"></span>
      <label class="chk"><input type="checkbox" id="testReq"> Cumpri o requisito</label>
      <button class="btn primary block" data-act="passtest" data-attr="${a}">✅ Passei no teste!</button>`
      : `<p class="muted small">🔒 Junte ${need} XP neste atributo para desbloquear o teste.</p>`}`);
}
let pendingTestPhoto = null;
async function passTest(a) {
  if (!$('#testReq')?.checked) return toast('Confirme que cumpriu o requisito.');
  if (!pendingTestPhoto) return toast('📷 A foto da prova é obrigatória nos testes.');
  const L = S.levels[a]; const pid = await savePhotoFile(pendingTestPhoto); pendingTestPhoto = null;
  S.levelSpent[a] += xpNeed(L); S.levels[a] = L + 1;
  S.testsLog.push({ attr: a, from: L, to: L + 1, d: today(), photo: pid, teste: S.tests[a][L - 1].teste });
  addLedger(`test:${a}:${L}`, null, 0, 100, `Teste ${ATTRS[a].nome} ${L}→${L + 1}`);
  grantChest(L + 1 >= 4 ? 'lendario' : 'raro', 'Teste de nível');
  closeModal();
  celebrate(ATTRS[a].icon, 'Subiu de nível!', `${ATTRS[a].nome} nível ${L + 1}`, '+100 🪙 e um baú. Que tal escrever uma crônica sobre o teste?');
  $('#modal .celebrate')?.insertAdjacentHTML('beforeend', `<button class="btn block" data-act="newchron" data-tipo="teste" data-attr="${a}" data-titulo="Teste de ${ATTRS[a].nome}: nível ${L + 1}" data-photo="${pid}">🪶 Escrever crônica</button>`);
  afterChange();
}

/* ---------- Aba: Loja ---------- */
function weekSpentReais() { const wk = weekKey(); return S.purchases.filter(p => p.d >= wk).reduce((s, p) => s + (p.reais || 0), 0); }
function viewLoja() {
  const g = goldNow(); const cap = S.settings.goldCap; const orc = Number(S.settings.orcamento) || 0;
  let h = `<section class="card gold-card"><div class="big">🪙 ${g}</div><div class="small muted">Bolsa: ${g}/${cap}</div>${bar(g, cap, '#f59e0b')}${orc ? `<div class="small">💵 Orçamento de lazer da semana: R$ ${weekSpentReais()} / R$ ${orc}</div>` : ''}</section>`;
  // baús
  h += `<section class="card"><div class="sec-title"><span>🎁 Baús</span></div>`;
  h += S.chests.length ? `<div class="chest-row">${S.chests.map(c => `<button class="chest r-${c.rarity}" data-act="openchest" data-id="${c.id}"><div class="ce">🎁</div><div class="small">${RAR[c.rarity].nome}</div><div class="tiny muted">${esc(c.source)}</div></button>`).join('')}</div>` : `<p class="muted small">Nenhum baú agora. Complete as missões do dia para ganhar um!</p>`;
  h += `</section>`;
  // itens
  h += `<section class="card"><div class="sec-title"><span>🏪 Loja de recompensas</span><button class="btn xs" data-act="editshop">✏️ Editar</button></div>`;
  for (const it of S.shop) {
    const can = g >= it.preco;
    h += `<div class="shop-item"><div class="grow"><div class="mn">${esc(it.nome)}</div>${it.reais ? `<div class="small muted">Libera R$ ${it.reais} do orçamento</div>` : ''}</div><button class="btn sm ${can ? 'primary' : 'disabled'}" data-act="buy" data-id="${it.id}">${it.preco} 🪙</button></div>`;
  }
  h += `</section>`;
  // listas
  h += `<section class="card"><div class="sec-title"><span>🎲 Listas de sorteio</span></div><p class="small muted">O que pode sair nos baús. Adicione o que quiser com o tempo.</p>`;
  for (const [k, items] of Object.entries(S.lists)) {
    h += `<details class="list-ed"><summary>${CAT_NAMES[k] || k} <span class="muted small">(${items.length})</span></summary>${items.map((it, i) => `<div class="li"><span class="grow">${esc(it)}</span><button class="btn xs" data-act="rmlist" data-k="${k}" data-i="${i}">✕</button></div>`).join('')}<form class="addform" data-form="addlist" data-k="${k}"><input name="v" placeholder="Adicionar..." required><button class="btn sm">+</button></form></details>`;
  }
  h += `</section>`;
  // históricos
  h += `<section class="card"><div class="sec-title"><span>📜 Histórico</span></div><details><summary>Sorteios (${S.chestHistory.length})</summary>${S.chestHistory.slice().reverse().slice(0, 40).map(x => `<div class="li small"><span class="grow">${fmtD(x.d)} · ${RAR[x.rarity].nome}: ${esc(x.item || '—')}</span><span>+${x.gold} 🪙</span></div>`).join('') || '<p class="muted small">vazio</p>'}</details><details><summary>Compras (${S.purchases.length})</summary>${S.purchases.slice().reverse().slice(0, 40).map(x => `<div class="li small"><span class="grow">${fmtD(x.d)} · ${esc(x.nome)}</span><span>-${x.preco} 🪙</span></div>`).join('') || '<p class="muted small">vazio</p>'}</details></section>`;
  return h;
}
function buy(id) {
  const it = S.shop.find(x => x.id === id); if (!it) return; const g = goldNow();
  if (g < it.preco) return toast(`Faltam ${it.preco - g} 🪙.`);
  const orc = Number(S.settings.orcamento) || 0;
  if (it.reais && orc && weekSpentReais() + it.reais > orc) return toast(`💵 Isso passaria do orçamento da semana (R$ ${orc}).`);
  if (it.tipo === 'protetor' && S.freezes >= MAX_FREEZES) return toast(`🧊 Você já tem o máximo de ${MAX_FREEZES} bloqueios.`);
  if (it.tipo === 'folga' && S.folga[today()]) return toast('Hoje já é dia de folga.');
  addLedger('buy:' + uid(), null, 0, -it.preco, 'Compra: ' + it.nome);
  S.purchases.push({ nome: it.nome, preco: it.preco, reais: it.reais || 0, d: today() });
  if (it.tipo === 'protetor') S.freezes++;
  if (it.tipo === 'bau') grantChest(rollRarity(), 'Comprado na loja');
  if (it.tipo === 'folga') S.folga[today()] = true;
  toast(`🛍️ Comprado: ${it.nome}${it.reais ? ` · R$ ${it.reais} liberados` : ''}. Aproveite!`); afterChange();
}
let openingChest = null;
function openChest(id) {
  const c = S.chests.find(x => x.id === id); if (!c) return;
  const prize = rollPrize(c.rarity); openingChest = { c, prize, rerolled: false };
  openModal(`<div class="center chest-open"><div class="chest-anim r-${c.rarity}">🎁</div><div class="kicker" style="color:${RAR[c.rarity].cor}">Baú ${RAR[c.rarity].nome}</div><div id="prize"></div></div>`);
  setTimeout(drawPrize, 900);
}
function drawPrize() {
  const el = $('#prize'); if (!el || !openingChest) return; const { prize, rerolled } = openingChest;
  el.innerHTML = `<div class="big-icon pop">${prize.cat ? (CAT_NAMES[prize.cat] || '').split(' ')[0] : '🪙'}</div>${prize.item ? `<div class="kicker">${CAT_NAMES[prize.cat]}</div><h2>${esc(prize.item)}</h2>` : ''}<p>+${prize.gold} 🪙</p><div class="row center-row">${!rerolled && prize.item ? `<button class="btn" data-act="reroll">🔄 Re-sortear (1x)</button>` : ''}<button class="btn primary" data-act="claim">Pegar!</button></div>`;
}
function claimChest() {
  const { c, prize } = openingChest; openingChest = null;
  S.chests = S.chests.filter(x => x.id !== c.id);
  addLedger('chest:' + c.id, null, 0, prize.gold, 'Baú ' + RAR[c.rarity].nome);
  S.chestHistory.push({ d: today(), rarity: c.rarity, item: prize.item, cat: prize.cat, gold: prize.gold });
  closeModal(); afterChange();
}

/* ---------- Aba: Crônicas ---------- */
let chronFilter = 'todos';
function viewCronicas() {
  let h = `<div class="row between"><h2 class="h2">📜 Crônicas</h2><button class="btn primary" data-act="newchron">🪶 Escrever</button></div>`;
  h += `<div class="filters">${['todos', 'estante', ...Object.keys(CHRON_TYPES)].map(f => `<button class="pill ${chronFilter === f ? 'on' : ''}" data-act="cfilter" data-f="${f}">${f === 'todos' ? 'Todas' : f === 'estante' ? '📚 Estante' : CHRON_TYPES[f]}</button>`).join('')}</div>`;
  if (chronFilter === 'estante') {
    const books = S.chronicles.filter(c => c.tipo === 'livro');
    return h + (books.length ? `<div class="shelf">${books.map(b => `<div class="book" data-act="showchron" data-id="${b.id}">${b.photo ? `<img data-photo="${b.photo}" alt="">` : `<div class="spine">${esc(b.titulo)}</div>`}<div class="stars">${'★'.repeat(b.nota || 0)}</div></div>`).join('')}</div>` : `<p class="muted center">Sua estante está vazia. Terminou um livro ou mangá? Escreva uma crônica! 📖</p>`);
  }
  const list = S.chronicles.filter(c => chronFilter === 'todos' || c.tipo === chronFilter).slice().reverse();
  if (!list.length) return h + `<p class="muted center">Nenhuma crônica ainda. Terminou algo? Conte como foi! (+15 🪙)</p>`;
  return h + list.map(chronCard).join('');
}
function chronCard(c) {
  return `<article class="card chron"><div class="row between"><span class="tag">${CHRON_TYPES[c.tipo] || ''}</span><span class="small muted">${fmtD(c.d)}</span></div><h3>${esc(c.titulo)}</h3>${c.nota ? `<div class="stars">${'★'.repeat(c.nota)}${'☆'.repeat(5 - c.nota)}</div>` : ''}${c.photo ? `<img class="chron-img" data-photo="${c.photo}" alt="">` : ''}<p class="pre">${esc(c.texto)}</p><div class="row between small muted"><span>${[c.humor ? MOODS[c.humor] : '', c.attr ? ATTRS[c.attr].icon + ' ' + ATTRS[c.attr].nome : ''].filter(Boolean).join(' · ')}</span><span><button class="btn xs" data-act="sharechron" data-id="${c.id}">📤 Card</button> <button class="btn xs" data-act="delchron" data-id="${c.id}">🗑</button></span></div></article>`;
}
let chronPhoto = null;
function openChronForm(pre = {}) {
  chronPhoto = pre.photo ? { existing: pre.photo } : null;
  const tipo = pre.tipo || 'livro';
  openModal(`<h2>🪶 Nova crônica</h2><form data-form="chron" class="form">
    <label>Título<input name="titulo" required value="${esc(pre.titulo || '')}" placeholder="Terminei o livro..."></label>
    <label>Tipo<select name="tipo" id="ctipo">${Object.entries(CHRON_TYPES).map(([k, v]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="guide small muted" id="cguide">${guideHTML(tipo)}</div>
    <label>Nota<div class="rating">${[1, 2, 3, 4, 5].map(n => `<input type="radio" name="nota" value="${n}" id="r${n}"><label for="r${n}">★</label>`).join('')}</div></label>
    <label>O que você achou?<textarea name="texto" rows="6" placeholder="Conte como foi..."></textarea></label>
    <label>Humor<select name="humor"><option value="">—</option>${Object.entries(MOODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>Atributo<select name="attr">${Object.entries(ATTRS).map(([k, v]) => `<option value="${k}" ${k === (pre.attr || (tipo === 'livro' ? 'mental' : '')) ? 'selected' : ''}>${v.icon} ${v.nome}</option>`).join('')}</select></label>
    <label class="btn">📷 Imagem (capa, desenho, print)<input type="file" accept="image/*" id="cphoto" hidden></label><span class="small muted" id="cphotoOk">${pre.photo ? 'Foto do teste anexada ✓' : ''}</span>
    <button class="btn primary block">Publicar (+15 🪙)</button></form>`);
}
function guideHTML(t) { return (GUIDE_QUESTIONS[t] || []).map(q => `💭 ${esc(q)}`).join('<br>'); }
async function submitChron(f) {
  const fd = new FormData(f); const id = uid();
  let photo = null; if (chronPhoto?.file) photo = await savePhotoFile(chronPhoto.file); else if (chronPhoto?.existing) photo = chronPhoto.existing;
  const c = { id, titulo: fd.get('titulo'), tipo: fd.get('tipo'), nota: Number(fd.get('nota')) || 0, texto: fd.get('texto'), humor: fd.get('humor'), attr: fd.get('attr'), photo, d: today() };
  S.chronicles.push(c); addLedger('c:' + id, c.attr, 5, 15, 'Crônica: ' + c.titulo);
  chronPhoto = null; closeModal(); tab = 'cronicas'; afterChange(); toast('🪶 Crônica publicada! +15 🪙');
}
async function shareCard(id) {
  const c = S.chronicles.find(x => x.id === id); if (!c) return;
  const W = 1080, H = 1350; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, '#0b1020'); grd.addColorStop(1, '#2a1846'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = S.settings.accent; g.lineWidth = 14; g.strokeRect(30, 30, W - 60, H - 60);
  let y = 110;
  // avatar
  const av = new Image(); const a = S.profile.avatar;
  av.src = a?.type === 'img' ? a.data : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pixelSVG(a?.key));
  await new Promise(r => { av.onload = r; av.onerror = r; });
  g.save(); g.beginPath(); g.arc(150, y + 50, 60, 0, Math.PI * 2); g.clip(); try { g.drawImage(av, 90, y - 10, 120, 120); } catch (e) { } g.restore();
  g.fillStyle = '#fff'; g.font = 'bold 44px system-ui, sans-serif'; g.fillText(S.profile.nome || 'Aventureiro', 240, y + 40);
  g.fillStyle = '#cbd5e1'; g.font = '32px system-ui, sans-serif'; g.fillText(currentTitle(), 240, y + 88); y += 190;
  g.fillStyle = S.settings.accent; g.font = 'bold 34px system-ui, sans-serif'; g.fillText((CHRON_TYPES[c.tipo] || '').toUpperCase(), 90, y); y += 70;
  g.fillStyle = '#fff'; g.font = 'bold 60px system-ui, sans-serif'; y = wrap(g, c.titulo, 90, y, W - 180, 70, 3) + 10;
  if (c.nota) { g.fillStyle = '#fbbf24'; g.font = '56px system-ui'; g.fillText('★'.repeat(c.nota) + '☆'.repeat(5 - c.nota), 90, y + 40); y += 90; }
  if (c.photo) { const u = await photoURL(c.photo); if (u) { const im = new Image(); im.src = u; await new Promise(r => { im.onload = r; im.onerror = r; }); const ih = 380, iw = Math.min(W - 180, im.width * ih / im.height); try { g.drawImage(im, 90, y, iw, ih); } catch (e) { } y += ih + 40; } }
  g.fillStyle = '#e2e8f0'; g.font = '36px system-ui, sans-serif'; wrap(g, `“${(c.texto || '').slice(0, 260)}${(c.texto || '').length > 260 ? '…' : ''}”`, 90, y + 30, W - 180, 50, c.photo ? 4 : 10);
  g.fillStyle = '#94a3b8'; g.font = '30px system-ui, sans-serif'; g.fillText(`🔥 ${Math.max(...STREAK_ATTRS.map(streak))} dias · Ficha da Vida · ${fmtD(c.d)}`, 90, H - 80);
  cv.toBlob(async blob => {
    const file = new File([blob], 'cronica.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: c.titulo }); return; } catch (e) { } }
    const url = URL.createObjectURL(blob);
    openModal(`<h2>📤 Card da crônica</h2><img src="${url}" class="share-prev" alt=""><a class="btn primary block" href="${url}" download="cronica.png">⬇️ Baixar imagem</a><p class="small muted">No celular, você também pode segurar a imagem para salvar.</p>`);
  }, 'image/png');
}
function wrap(g, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/); let line = '', n = 0;
  for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) { line = words.slice(words.indexOf(w)).join(' '); while (g.measureText(line + '…').width > maxW && line.length) line = line.slice(0, -1); g.fillText(line + (line.length < 2 ? '' : '…'), x, y); return y + lh; } } else line = test; }
  if (line) { g.fillText(line, x, y); y += lh; } return y;
}

/* ---------- Aba: Mais ---------- */
let sub = null;
function viewMais() {
  const subs = { referencias: viewRefs, roleta: viewRoleta, relatorio: viewRelatorio, recuperacao: viewRecuperacao, perfil: viewPerfil, emblemas: viewEmblemas, revisoes: viewRevisoes, missoes: viewMissoes, testes: viewTestes, stats: viewStats, config: viewConfig, diario: viewDiario };
  if (sub && subs[sub]) return `<button class="btn sm back" data-act="sub" data-sub="">← Voltar</button>` + subs[sub]();
  const items = [['roleta', '🎡', 'Roleta', 'Sorteie um filme, desenho, jogo...'], ['relatorio', '📄', 'Relatório', 'Semanal, mensal e anual para imprimir'], ['referencias', '📌', 'Referências', `${S.refs.length} guardada(s): episódios, páginas, painéis`], ['recuperacao', '🌙', 'Modo Recuperação', S.recovery?.active ? 'Ativo agora' : 'Para fases difíceis'], ['perfil', '🎨', 'Personalização', 'Avatar, capa, moldura, tema'], ['revisoes', '🔎', 'Revisões', `Semanal, mensal e anual${pendingReviews().length ? ' · ' + pendingReviews().length + ' pendente(s)' : ''}`], ['emblemas', '🏅', 'Emblemas', `${Object.keys(S.badges).length}/${BADGES.length} conquistados`], ['diario', '📸', 'Diário de provas', 'Todas as fotos por data'], ['stats', '📊', 'Estatísticas', 'Totais e histórico'], ['missoes', '📋', 'Editar missões', 'Obrigatórias, semanais, mínimas'], ['testes', '⚔️', 'Testes de nível', 'Ver e editar'], ['config', '⚙️', 'Configurações', 'Lembretes, orçamento, backup']];
  return `<h2 class="h2">Mais</h2>` + items.map(([k, i, t, d]) => `<button class="menu-item" data-act="sub" data-sub="${k}"><span class="mi-i">${i}</span><span class="grow"><b>${t}</b><br><span class="small muted">${d}</span></span><span>›</span></button>`).join('');
}
function viewPerfil() {
  const p = S.profile;
  return `<h2 class="h2">🎨 Personalização</h2>
  <section class="card"><div class="sec-title"><span>Prévia</span></div><div class="cover small-cover cf-${p.frame}" style="${p.cover ? `background-image:url(${p.cover})` : ''}"></div><div class="center" style="margin-top:-40px">${avatarHTML(80)}</div></section>
  <section class="card"><div class="sec-title"><span>Avatar</span></div><div class="avatar-pick">${Object.keys(AVATARS).map(k => `<button class="ap ${p.avatar?.type === 'preset' && p.avatar.key === k ? 'on' : ''}" data-act="avatar" data-k="${k}">${pixelSVG(k)}</button>`).join('')}</div>
    <label class="btn">🖼️ Usar qualquer imagem (desenho, personagem...)<input type="file" accept="image/*" data-act="avatarimg" hidden></label>
    <div class="small muted" style="margin-top:8px">Moldura do avatar</div><div class="pills">${['auto', 'none', 'bronze', 'prata', 'ouro'].map(f => { const lock = f !== 'auto' && f !== 'none' && !frameUnlockedAvatar(f); return `<button class="pill ${p.avatarFrame === f ? 'on' : ''} ${lock ? 'disabled' : ''}" data-act="aframe" data-f="${f}">${f === 'auto' ? 'Automática (nível)' : FRAMES[f]}${lock ? ' 🔒' : ''}</button>`; }).join('')}</div></section>
  <section class="card"><div class="sec-title"><span>Capa (fundo do perfil)</span></div><label class="btn">🖼️ Escolher imagem de fundo<input type="file" accept="image/*" data-act="coverimg" hidden></label> ${p.cover ? `<button class="btn" data-act="rmcover">Remover</button>` : ''}
    <div class="small muted" style="margin-top:8px">Moldura da capa (ganhe mais derrotando chefes semanais)</div><div class="frame-grid">${Object.keys(FRAMES).map(f => { const own = S.framesOwned.includes(f) || ['bronze', 'prata', 'ouro'].includes(f) && frameUnlockedAvatar(f); return `<button class="fr cf-${f} ${p.frame === f ? 'on' : ''} ${own ? '' : 'locked'}" data-act="cframe" data-f="${f}"><span>${own ? FRAMES[f] : '🔒 ' + FRAMES[f]}</span></button>`; }).join('')}</div></section>
  <section class="card"><div class="sec-title"><span>Dados</span></div><form class="form" data-form="perfil">
    <label>Nome<input name="nome" value="${esc(p.nome)}"></label><label>Idade<input name="idade" type="number" value="${esc(p.idade)}"></label>
    <label>Classe<select name="classe">${[['guerreiro', '⚔️ Guerreiro'], ['sabio', '📘 Sábio'], ['artesao', '🎨 Artesão'], ['equilibrado', '⚖️ Equilibrado']].map(([k, v]) => `<option value="${k}" ${p.classe === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Quem eu quero me tornar<textarea name="futuro" rows="3">${esc(p.futuro)}</textarea></label>
    <label>Título exibido<select name="titulo"><option value="">Automático (classe + nível)</option>${Object.entries(S.badges).map(([id, v]) => { const b = BADGES.find(x => x.id === id); if (!b) return ''; const l = badgeLabel(b, v.tier); return `<option ${p.titulo === l ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>
    <button class="btn primary block">Salvar</button></form></section>
  <section class="card"><div class="sec-title"><span>Tema</span></div><div class="pills">${[['escuro', '🌙 Escuro'], ['claro', '☀️ Claro'], ['pergaminho', '📜 Pergaminho']].map(([k, v]) => `<button class="pill ${S.settings.tema === k ? 'on' : ''}" data-act="tema" data-t="${k}">${v}</button>`).join('')}</div>
    <label class="row">Cor de destaque <input type="color" value="${S.settings.accent}" data-act="accent"></label></section>
  <section class="card"><div class="sec-title"><span>Vitrine de emblemas (até 3)</span></div><div class="pills">${Object.entries(S.badges).map(([id, v]) => { const b = BADGES.find(x => x.id === id); if (!b) return ''; const on = (p.showcase || []).includes(id); return `<button class="pill ${on ? 'on' : ''}" data-act="showcase" data-id="${id}">${b.icon} ${esc(badgeLabel(b, v.tier))}</button>`; }).join('') || '<span class="muted small">Conquiste emblemas para exibir aqui.</span>'}</div></section>`;
}
function frameUnlockedAvatar(f) { const tot = S.levels.fisico + S.levels.mental + S.levels.criativo; return f === 'bronze' ? tot >= 5 : f === 'prata' ? tot >= 8 : f === 'ouro' ? tot >= 12 : true; }
function viewEmblemas() { return `<h2 class="h2">🏅 Emblemas</h2><p class="small muted">Bronze → Prata → Ouro → Lendário. Cada emblema dá ouro.</p><div class="badge-grid">${BADGES.map(badgeCard).join('')}</div>`; }
function viewRevisoes() {
  const pend = pendingReviews(); const done = Object.entries(S.reviews).sort((a, b) => b[1].d.localeCompare(a[1].d));
  return `<h2 class="h2">🔎 Revisões</h2><p class="small muted">Semanal (domingo), mensal (fim do mês) e anual (fim do ano). Cada uma dá ouro: 30 / 100 / 500 🪙.</p>
  ${pend.length ? pend.map(p => `<button class="menu-item" data-act="review" data-key="${p.key}"><span class="mi-i">📝</span><span class="grow"><b>Revisão da ${p.tipo}</b><br><span class="small muted">${fmtD(p.ini)} – ${fmtD(p.fim)}</span></span><span>+${REVIEW_GOLD[p.tipo]} 🪙</span></button>`).join('') : '<p class="muted small">Nenhuma revisão pendente agora. A semanal abre no domingo.</p>'}
  <h3>Anteriores</h3>${done.map(([k, r]) => `<details class="card"><summary><b>${r.tipo === 'semana' ? '📅' : r.tipo === 'mês' ? '🗓️' : '🎆'} ${r.tipo[0].toUpperCase() + r.tipo.slice(1)}: ${fmtD(r.ini)} – ${fmtD(r.fim)}</b></summary>${r.respostas.map(x => `<p><b class="small">${esc(x.q)}</b><br>${esc(x.a) || '<span class="muted">—</span>'}</p>`).join('')}</details>`).join('') || '<p class="muted small">Nenhuma ainda.</p>'}`;
}
function openReview(key) {
  const p = reviewPeriods().find(x => x.key === key); if (!p) return;
  const st = periodStats(p.ini, p.fim);
  openModal(`<div class="kicker">Revisão da ${p.tipo}</div><h2>${fmtD(p.ini)} – ${fmtD(p.fim)}</h2>
   ${p.tipo === 'ano' && S.profile.futuro ? `<blockquote>Você disse que queria se tornar: “${esc(S.profile.futuro)}”</blockquote>` : ''}
   <div class="stat-grid"><div><b>${st.full}</b><span>missões</span></div><div><b>${st.min}</b><span>mínimas</span></div><div><b>${st.dias}</b><span>dias perfeitos</span></div><div><b>${st.fotos}</b><span>provas</span></div><div><b>+${st.gold}</b><span>🪙 ganho</span></div><div><b>${st.gasto}</b><span>🪙 gasto</span></div><div><b>${st.chron.length}</b><span>crônicas</span></div><div><b>${st.tests.length}</b><span>testes</span></div></div>
   <div class="small">${Object.keys(ATTRS).map(a => `${ATTRS[a].icon} +${st.xp[a]} XP`).join(' · ')}</div>
   ${(() => { const best = Object.keys(ATTRS).sort((a, b) => st.xp[b] - st.xp[a]); return `<p class="small">📈 Mais cresceu: <b>${ATTRS[best[0]].nome}</b> · 📉 Ficou para trás: <b>${ATTRS[best[best.length - 1]].nome}</b></p>`; })()}
   <form class="form" data-form="review" data-key="${key}">${REVIEW_Q[p.tipo].map((q, i) => `<label>${esc(q)}<textarea name="q${i}" rows="3"></textarea></label>`).join('')}<button class="btn primary block">Concluir revisão (+${REVIEW_GOLD[p.tipo]} 🪙)</button></form>`);
}
function viewMissoes() {
  return `<h2 class="h2">📋 Missões</h2><p class="small muted">Obrigatórias contam para a sequência e para o baú diário. Atributos sem obrigatória diária mantêm a sequência com qualquer missão daquele atributo, inclusive a versão mínima.</p>` +
    S.missions.map(m => `<div class="card mission-ed ${m.off ? 'off' : ''}"><div class="row between"><b>${ATTRS[m.attr].icon} ${esc(m.nome)}</b><span><button class="btn xs" data-act="editm" data-id="${m.id}">✏️</button></span></div><div class="small muted">${m.freq === 'daily' ? 'Diária' : `Semanal ${m.target}x`} · ${m.mandatory ? 'Obrigatória' : 'Opcional'} · ${m.minutos || 0} min${m.off ? ' · pausada' : ''}</div></div>`).join('') +
    `<button class="btn primary block" data-act="editm" data-id="">+ Nova missão</button>`;
}
function openMissionForm(id) {
  const m = S.missions.find(x => x.id === id) || { nome: '', attr: 'mental', freq: 'daily', target: 3, mandatory: false, minimo: '', minutos: 20 };
  openModal(`<h2>${id ? 'Editar' : 'Nova'} missão</h2><form class="form" data-form="mission" data-id="${id || ''}">
   <label>Nome<input name="nome" required value="${esc(m.nome)}"></label>
   <label>Atributo<select name="attr">${Object.entries(ATTRS).map(([k, v]) => `<option value="${k}" ${m.attr === k ? 'selected' : ''}>${v.icon} ${v.nome}</option>`).join('')}</select></label>
   <label>Frequência<select name="freq"><option value="daily" ${m.freq === 'daily' ? 'selected' : ''}>Diária</option><option value="weekly" ${m.freq === 'weekly' ? 'selected' : ''}>Semanal</option></select></label>
   <label>Vezes por semana (se semanal)<input name="target" type="number" min="1" max="7" value="${m.target || 1}"></label>
   <label class="chk"><input type="checkbox" name="mandatory" ${m.mandatory ? 'checked' : ''}> Obrigatória</label>
   <label>Versão mínima (dias ruins)<input name="minimo" value="${esc(m.minimo || '')}"></label>
   <label>Minutos do timer<input name="minutos" type="number" min="0" value="${m.minutos || 0}"></label>
   ${id ? `<label class="chk"><input type="checkbox" name="off" ${m.off ? 'checked' : ''}> Pausar esta missão</label>` : ''}
   <button class="btn primary block">Salvar</button>${id ? `<button type="button" class="btn danger block" data-act="delm" data-id="${id}">Excluir missão</button>` : ''}</form>`);
}
function viewTestes() {
  return `<h2 class="h2">⚔️ Testes de nível</h2><p class="small muted">Para subir: junte o XP do nível e passe no teste (com foto da prova).</p>` + Object.keys(ATTRS).map(a => `<section class="card"><div class="sec-title" style="--c:${ATTRS[a].cor}"><span>${ATTRS[a].icon} ${ATTRS[a].nome} · Nv ${S.levels[a]}</span><button class="btn xs" data-act="addtest" data-attr="${a}">+ nível</button></div>${S.tests[a].map((t, i) => `<div class="test-row ${i < S.levels[a] - 1 ? 'done' : i === S.levels[a] - 1 ? 'cur' : ''}"><div class="grow"><b>${i + 1} → ${i + 2}</b> ${i < S.levels[a] - 1 ? '✅' : ''}<div class="small">Req.: ${esc(t.req)}</div><div class="small">Teste: ${esc(t.teste)}</div></div><button class="btn xs" data-act="edittest" data-attr="${a}" data-i="${i}">✏️</button></div>`).join('')}</section>`).join('') +
    (S.testsLog.length ? `<section class="card"><div class="sec-title"><span>Histórico</span></div>${S.testsLog.slice().reverse().map(t => `<div class="li"><img class="thumb" data-photo="${t.photo}" data-act="viewphoto" data-pid="${t.photo}" alt=""><span class="grow small">${fmtD(t.d)} · ${ATTRS[t.attr].nome} ${t.from}→${t.to}<br>${esc(t.teste)}</span></div>`).join('')}</section>` : '');
}
function openTestEdit(a, i) {
  const t = i >= 0 ? S.tests[a][i] : { req: '', teste: '' };
  openModal(`<h2>${ATTRS[a].icon} Teste ${i >= 0 ? `${i + 1} → ${i + 2}` : 'novo'}</h2><form class="form" data-form="test" data-attr="${a}" data-i="${i}"><label>Requisito<input name="req" required value="${esc(t.req)}"></label><label>Teste<textarea name="teste" rows="3" required>${esc(t.teste)}</textarea></label><button class="btn primary block">Salvar</button></form>`);
}
function viewStats() {
  const tot = periodStats('0000-01-01', '9999-12-31');
  return `<h2 class="h2">📊 Estatísticas</h2><div class="stat-grid"><div><b>${tot.full}</b><span>missões completas</span></div><div><b>${tot.min}</b><span>mínimas</span></div><div><b>${tot.dias}</b><span>dias perfeitos</span></div><div><b>${tot.gold}</b><span>🪙 ganhos</span></div><div><b>${countKind('academia')}</b><span>treinos</span></div><div><b>${countKind('leitura') * 5 + countKind('leitura', 'min')}</b><span>páginas</span></div><div><b>${Math.round(countKind('ingles') * 20 / 60)}h</b><span>de inglês</span></div><div><b>${Math.round(countKind('concurso') * 20 / 60)}h</b><span>concursos</span></div><div><b>${Object.keys(S.bossWon).length}</b><span>chefes</span></div></div>
  <section class="card"><div class="sec-title"><span>🔥 Sequências</span></div>${STREAK_ATTRS.map(a => `<div class="li"><span class="grow">${ATTRS[a].icon} ${ATTRS[a].nome}</span><span>atual <b>${streak(a)}</b> · recorde <b>${S.best[a] || 0}</b></span></div>`).join('')}</section>
  <section class="card"><div class="sec-title"><span>XP total</span></div>${Object.keys(ATTRS).map(a => `<div class="li"><span class="grow">${ATTRS[a].icon} ${ATTRS[a].nome}</span><b>${xpTotal(a)} XP</b></div>`).join('')}</section>
  <section class="card"><div class="sec-title"><span>Últimos movimentos de ouro</span></div>${S.ledger.filter(e => e.gold).slice(-25).reverse().map(e => `<div class="li small"><span class="grow">${fmtD(e.d)} · ${esc(e.why)}</span><span class="${e.gold > 0 ? 'pos' : 'neg'}">${e.gold > 0 ? '+' : ''}${e.gold}</span></div>`).join('')}</section>`;
}
function viewDiario() {
  const items = [];
  for (const [d, L] of Object.entries(S.log)) for (const [id, e] of Object.entries(L)) if (e.photo) items.push({ d, photo: e.photo, label: S.missions.find(m => m.id === id)?.nome || id });
  for (const t of S.testsLog) items.push({ d: t.d, photo: t.photo, label: `⚔️ Teste ${ATTRS[t.attr].nome} ${t.from}→${t.to}` });
  for (const c of S.chronicles) if (c.photo) items.push({ d: c.d, photo: c.photo, label: '🪶 ' + c.titulo });
  items.sort((a, b) => b.d.localeCompare(a.d));
  return `<h2 class="h2">📸 Diário de provas</h2>${items.length ? `<div class="gallery">${items.map(i => `<figure data-act="viewphoto" data-pid="${i.photo}"><img data-photo="${i.photo}" alt=""><figcaption>${fmtD(i.d)}<br>${esc(i.label)}</figcaption></figure>`).join('')}</div>` : '<p class="muted">Nenhuma foto ainda. Use o botão 📷 nas missões.</p>'}`;
}
function viewConfig() {
  const s = S.settings;
  return `<h2 class="h2">⚙️ Configurações</h2><form class="form card" data-form="config">
   <label>Meta diária (quantas missões bônus por dia)<select name="meta">${[['leve', 'Leve (1)'], ['media', 'Média (2)'], ['intensa', 'Intensa (3)']].map(([k, v]) => `<option value="${k}" ${s.meta === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
   <label>Orçamento semanal de lazer em R$ (0 = desligado)<input name="orcamento" type="number" min="0" value="${s.orcamento}"></label>
   <label>Limite da bolsa de ouro<input name="goldCap" type="number" min="100" step="50" value="${s.goldCap}"></label>
   <label>Horário do lembrete<input name="lembrete" type="time" value="${s.lembrete}"></label>
   <label class="chk"><input type="checkbox" name="lembreteOn" ${s.lembreteOn ? 'checked' : ''}> Lembrete diário (notificação)</label>
   <p class="small muted">O lembrete aparece se as missões obrigatórias não estiverem feitas no horário. Ele funciona com o app aberto ou em segundo plano. Para lembrete garantido com o app fechado, use a versão APK (Capacitor) ou um alarme do celular.</p>
   <label>Modo Recuperação: dias por mês<input name="recMes" type="number" min="0" max="31" value="${s.recMes}"></label>
   <label>Modo Recuperação: dias por ano<input name="recAno" type="number" min="0" max="366" value="${s.recAno}"></label>
   <label>Lembrar de fazer backup a cada (dias)<input name="backupDias" type="number" min="1" max="60" value="${s.backupDias}"></label>
   <label>Seu repositório no GitHub (usuario/repositorio)<input name="githubRepo" placeholder="ex.: italo/ficha-backups" value="${esc(s.githubRepo)}"></label>
   <label>Pasta dentro do repositório<input name="githubPasta" value="${esc(s.githubPasta)}"></label>
   <p class="small muted">⚠️ Use um repositório <b>privado</b> só para os backups (não o do GitHub Pages, que é público). O backup tem suas fotos e anotações.</p>
   <button class="btn primary block">Salvar</button></form>
   <section class="card"><div class="sec-title"><span>💾 Backup</span></div><p class="small muted">Seus dados ficam só neste aparelho. ${S.lastBackup ? `Último backup: <b>${fmtD(S.lastBackup)}</b>.` : 'Nenhum backup feito ainda.'}</p>
   <button class="btn block" data-act="export">⬇️ Exportar backup (com fotos)</button><label class="btn block">⬆️ Importar backup<input type="file" accept="application/json,.json" data-act="import" hidden></label></section>
   <section class="card"><div class="sec-title"><span>⚠️ Zona de perigo</span></div><button class="btn danger block" data-act="reset">Apagar tudo e recomeçar</button></section>
   <p class="small muted center">Ficha da Vida v1.3</p>`;
}

/* ---------- Cadastro inicial ---------- */
let ob = { step: 0, data: {} };
const OB_STEPS = 8;
function renderOnboarding() {
  $('#nav').style.display = 'none';
  const d = ob.data; const s = ob.step; let body = '';
  if (s === 0) body = `<div class="big-icon">🧙</div><h1>Ficha da Vida</h1><p>Sua ficha de RPG da vida real. Missões, níveis, baús e conquistas para você se tornar quem quer ser.</p><button class="btn primary block" data-act="obnext">Começar jornada</button>`;
  if (s === 1) body = `<h2>Como devemos te chamar, aventureiro?</h2><input id="obv" class="big-input" value="${esc(d.nome || '')}" placeholder="Seu nome ou apelido" autofocus>`;
  if (s === 2) body = `<h2>Qual a sua idade?</h2><input id="obv" class="big-input" type="number" min="1" max="120" value="${esc(d.idade || '')}" placeholder="Idade">`;
  if (s === 3) body = `<h2>Escolha sua classe</h2><p class="muted small">É só estética. Você evolui tudo do mesmo jeito.</p><div class="choice-grid">${[['guerreiro', '⚔️', 'Guerreiro', 'foco físico'], ['sabio', '📘', 'Sábio', 'foco mental'], ['artesao', '🎨', 'Artesão', 'foco criativo'], ['equilibrado', '⚖️', 'Equilibrado', 'um pouco de tudo']].map(([k, i, n, x]) => `<button class="choice ${d.classe === k ? 'on' : ''}" data-act="obpick" data-f="classe" data-v="${k}"><span class="ci">${i}</span><b>${n}</b><span class="small muted">${x}</span></button>`).join('')}</div>`;
  if (s === 4) body = `<h2>Quem você quer se tornar?</h2><p class="muted small">Essa frase fica no topo da sua ficha como lembrete.</p><textarea id="obv" class="big-input" rows="4" placeholder="Ex.: Programador que vive do que faz, forte e disciplinado">${esc(d.futuro || '')}</textarea>`;
  if (s === 5) body = `<h2>Suas missões</h2><p class="muted small">Marque as que você quer. As obrigatórias contam para a sequência. Dá para editar tudo depois.</p><div class="ob-missions">${S.missions.map(m => `<label class="chk ob-m"><input type="checkbox" data-mid="${m.id}" ${m.off ? '' : 'checked'}><span>${ATTRS[m.attr].icon} ${esc(m.nome)} ${m.mandatory ? '<span class="tag must">obrigatória</span>' : ''}</span></label>`).join('')}</div>`;
  if (s === 6) body = `<h2>Meta diária</h2><p class="muted small">Quantas missões bônus aparecem por dia.</p><div class="choice-grid">${[['leve', '🌱', 'Leve', '1 bônus'], ['media', '🔥', 'Média', '2 bônus'], ['intensa', '⚡', 'Intensa', '3 bônus']].map(([k, i, n, x]) => `<button class="choice ${(d.meta || 'media') === k ? 'on' : ''}" data-act="obpick" data-f="meta" data-v="${k}"><span class="ci">${i}</span><b>${n}</b><span class="small muted">${x}</span></button>`).join('')}</div><h3>Orçamento semanal de lazer</h3><p class="muted small">Opcional. O ouro libera esse dinheiro na loja. Deixe 0 para pular.</p><input id="obv" class="big-input" type="number" min="0" value="${esc(d.orcamento ?? 0)}" placeholder="R$">`;
  if (s === 7) body = `<h2>Escolha seu avatar</h2><p class="muted small">Pode ser um dos prontos ou qualquer imagem: um desenho seu, um personagem...</p><div class="avatar-pick">${Object.keys(AVATARS).map(k => `<button class="ap ${S.profile.avatar.type === 'preset' && S.profile.avatar.key === k ? 'on' : ''}" data-act="avatar" data-k="${k}">${pixelSVG(k)}</button>`).join('')}</div><label class="btn block">🖼️ Usar uma imagem<input type="file" accept="image/*" data-act="avatarimg" hidden></label><div class="center">${avatarHTML(90)}</div>`;
  if (s === 8) body = `<div class="big-icon pop">📜</div><h2>Sua ficha foi criada!</h2><p>Nível 1 em tudo. Sua jornada começa hoje 🔥</p><div class="center">${avatarHTML(96)}</div><h3>${esc(d.nome || 'Aventureiro')}</h3>${d.futuro ? `<blockquote>“${esc(d.futuro)}”</blockquote>` : ''}<button class="btn primary block" data-act="obfinish">Entrar na ficha</button>`;
  const nav = s > 0 && s < 8 ? `<div class="row between ob-nav"><button class="btn" data-act="obback">Voltar</button><button class="btn primary" data-act="obnext">${s === 7 ? 'Concluir' : 'Continuar'}</button></div>` : '';
  $('#app').innerHTML = `<div class="onboard">${s > 0 ? `<div class="bar ob-bar"><div style="width:${s / OB_STEPS * 100}%;background:var(--accent)"></div></div>` : ''}<div class="ob-body">${body}</div>${nav}</div>`;
}
function obCollect() {
  const v = $('#obv')?.value; const s = ob.step;
  if (s === 1) { if (!v?.trim()) { toast('Digite seu nome 🙂'); return false; } ob.data.nome = v.trim(); }
  if (s === 2) ob.data.idade = v;
  if (s === 4) ob.data.futuro = v;
  if (s === 5) document.querySelectorAll('[data-mid]').forEach(c => { const m = S.missions.find(x => x.id === c.dataset.mid); if (m) m.off = !c.checked; });
  if (s === 6) ob.data.orcamento = Number(v) || 0;
  return true;
}
function obFinish() {
  const d = ob.data;
  Object.assign(S.profile, { nome: d.nome, idade: d.idade, classe: d.classe || 'equilibrado', futuro: d.futuro || '' });
  S.settings.meta = d.meta || 'media'; S.settings.orcamento = d.orcamento || 0;
  S.onboarded = true; S.created = today(); S.lastProcessed = addDays(today(), -1);
  grantChest('comum', 'Presente de boas-vindas');
  save(); tab = 'hoje'; render(); toast('🎁 Presente de boas-vindas: um baú! Abra na Loja.');
}

/* ---------- Notificações ---------- */
async function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }); else new Notification(title, { body });
  } catch (e) { }
}
function reminderCheck() {
  const s = S.settings; if (!S.onboarded || !s.lembreteOn) return;
  const t = today();
  if (backupDue() && S.notifiedBackup !== t) { S.notifiedBackup = t; save(); notify('💾 Hora do backup!', 'Exporte sua ficha e envie para o seu GitHub para não perder nada.'); }
  if (S.notifiedDay === t) return;
  const [hh, mm] = (s.lembrete || '20:00').split(':').map(Number); const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
  if (S.recovery?.active) return;
  const pend = STREAK_ATTRS.filter(a => !dayOk(a, t) && !bridge(a, t));
  S.notifiedDay = t; save();
  if (pend.length) notify('🔥 Sua sequência está em risco!', `Faltam missões de: ${pend.map(a => ATTRS[a].nome).join(', ')}. A versão mínima já salva o dia!`);
}

/* ---------- Backup ---------- */
function daysSinceBackup() { const ref = S.lastBackup || S.created; return Math.floor((parseD(today()) - parseD(ref)) / 864e5); }
function backupDue() { return S.onboarded && daysSinceBackup() >= (S.settings.backupDias || 7); }
async function exportBackup() {
  const photos = await idbAll(); const enc = {};
  for (const [k, b] of Object.entries(photos)) enc[k] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  const blob = new Blob([JSON.stringify({ app: 'fichaDaVida', v: 1, state: S, photos: enc })], { type: 'application/json' });
  const name = `ficha-da-vida-backup-${today()}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  S.lastBackup = today(); save(); render();
  const repo = S.settings.githubRepo; const pasta = S.settings.githubPasta;
  const up = repo ? `https://github.com/${repo}/upload/main${pasta ? '/' + pasta : ''}` : null;
  openModal(`<div class="center"><div class="big-icon pop">💾</div><h2>Backup gerado!</h2><p class="small muted">Arquivo <b>${esc(name)}</b> (${(blob.size / 1024 / 1024).toFixed(2)} MB) salvo nos Downloads.</p><p class="small">Inclui: ficha completa, <b>${Object.keys(enc).length}</b> foto(s) (provas, testes, crônicas, roleta e referências), <b>${S.refs.length}</b> referência(s) e <b>${S.roleta.reduce((a, c) => a + c.itens.length, 0)}</b> item(ns) da roleta.</p></div>
    <a class="btn block" href="${url}" download="${esc(name)}">⬇️ Baixar de novo</a>
    <h3>Agora envie para o seu GitHub</h3>
    ${up ? `<ol class="small"><li>Toque no botão abaixo (abre a página de upload do <b>${esc(repo)}</b>).</li><li>Toque em <b>choose your files</b> e escolha o arquivo em Downloads.</li><li>Toque em <b>Commit changes</b>. Pronto, salvo! ✅</li></ol>
    <a class="btn primary block" href="${up}" target="_blank" rel="noopener">🐙 Abrir upload no GitHub</a>`
    : `<p class="small">Configure seu repositório em <b>Mais → Configurações</b> para este botão abrir direto a página de upload.</p><button class="btn primary block" data-act="go" data-tab="mais" data-sub="config">⚙️ Configurar GitHub</button>`}
    <p class="small muted">Para restaurar: baixe o .json do GitHub e use <b>Importar backup</b>.</p>`);
}
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text()); if (data.app !== 'fichaDaVida') throw new Error('arquivo inválido');
    for (const [k, du] of Object.entries(data.photos || {})) { const b = await (await fetch(du)).blob(); await idbPut(k, b); }
    S = Object.assign(freshState(), data.state); if (!data.state.v13) S.v13 = false; S.settings = Object.assign(freshState().settings, S.settings); normalize(); save(); render(); toast('✅ Backup importado!');
  } catch (e) { toast('⚠️ Não consegui importar: ' + e.message); }
}

/* ========== v1.2: Modo Recuperação ========== */
const SUPPORT_CARD = `<div class="support"><b>💛 Você não está sozinho.</b><br>Se estiver pesado demais, conversar ajuda: alguém de confiança, um profissional de saúde ou o <b>CVV</b>, que atende de graça, 24 h, pelo telefone <b>188</b> ou pelo site <b>cvv.org.br</b> (chat). <a href="tel:188">Ligar 188</a> · <a href="https://cvv.org.br" target="_blank" rel="noopener">cvv.org.br</a></div>`;
function recUsed(prefix) { return Object.keys(S.recDays || {}).filter(d => d.startsWith(prefix)).length; }
function recLeft(d = today()) { return { mes: Math.max(0, S.settings.recMes - recUsed(d.slice(0, 7))), ano: Math.max(0, S.settings.recAno - recUsed(d.slice(0, 4))) }; }
function canRecover(d) { const l = recLeft(d); return l.mes > 0 && l.ano > 0; }
function tryRecoveryDay(d) {
  if (S.recDays[d]) return true;
  if (canRecover(d)) { S.recDays[d] = true; return true; }
  S.recovery = { active: false, since: null }; S.recEndedNotice = true; return false;
}
function ensureRecoveryToday() { if (S.recovery?.active) tryRecoveryDay(today()); }
function activateRecovery() {
  const t = today();
  if (!canRecover(t)) { openModal(`<h2>🌙 Modo Recuperação</h2><p>Seus dias de recuperação deste ${recLeft(t).ano === 0 ? 'ano' : 'mês'} já foram usados.</p><p>Tudo bem: a <b>versão mínima</b> de cada missão continua salvando a sequência, e os protetores 🧊 e o conserto continuam disponíveis.</p>${SUPPORT_CARD}`); return; }
  S.recovery = { active: true, since: t }; S.recDays[t] = true; S.recEndedNotice = false;
  afterChange();
  openModal(`<div class="center"><div class="big-icon pop">🌙</div><h2>Modo Recuperação ativado</h2></div><p>Suas sequências estão <b>congeladas</b>. Nada vai quebrar enquanto o modo estiver ativo.</p><p>As missões ficam todas <b>opcionais</b>. Fez algo hoje? Ótimo, conta. Não fez? Tudo bem também.</p><p class="small muted">Restam ${recLeft(t).mes} dia(s) neste mês e ${recLeft(t).ano} no ano. Você pode sair quando quiser.</p>${SUPPORT_CARD}<button class="btn primary block" data-act="close">Obrigado</button>`);
}
function deactivateRecovery() {
  const t = today(); const since = S.recovery?.since;
  if (since === t) delete S.recDays[t]; // saiu no mesmo dia: devolve o dia
  else S.recReturns = (S.recReturns || 0) + 1;
  S.recovery = { active: false, since: null };
  afterChange(); toast('🌱 Que bom te ver de volta! Vá no seu ritmo.');
}
function recoveryBanner() {
  const n = Object.keys(S.recDays).filter(d => d >= S.recovery.since && d <= today()).length; const l = recLeft();
  return `<section class="card rec-card"><div class="row between"><b>🌙 Modo Recuperação, dia ${n}</b><button class="btn xs no-print" data-act="recoff">Sair do modo</button></div><p class="small">Suas sequências estão congeladas. Qualquer coisa que você fizer hoje já é uma vitória. 💛</p><div class="small muted">Restam ${l.mes} dia(s) no mês · ${l.ano} no ano</div><details class="small"><summary>Precisa conversar?</summary>${SUPPORT_CARD}</details></section>`;
}
function moodRow(d) {
  const cur = S.mood?.[d];
  return `<div class="mood no-print"><span class="small muted">Como você está hoje? <span class="tiny">(opcional)</span></span><div class="mood-btns">${[1, 2, 3, 4, 5].map(n => `<button class="mb ${cur === n ? 'on' : ''}" data-act="mood" data-n="${n}">${MOOD_SCALE[n]}</button>`).join('')}</div></div>`;
}
function viewRecuperacao() {
  const l = recLeft(); const on = S.recovery?.active;
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today(), -29 + i));
  return `<h2 class="h2">🌙 Modo Recuperação</h2>
  <section class="card"><p>Para fases difíceis, como cansaço extremo, burnout, tristeza ou doença, quando manter a rotina fica pesado demais.</p>
  <ul class="small"><li>Todas as sequências ficam <b>congeladas</b>, sem gastar protetor nem ouro.</li><li>As missões ficam <b>opcionais</b>, e o chefe semanal descansa.</li><li>O app para de cobrar e de mandar avisos de sequência em risco.</li><li>No calendário, esses dias aparecem como <b>pausa</b> 🌙, nunca como falha.</li></ul>
  <div class="stat-grid"><div><b>${l.mes}/${S.settings.recMes}</b><span>dias restantes no mês</span></div><div><b>${l.ano}/${S.settings.recAno}</b><span>dias restantes no ano</span></div><div><b>${S.recReturns || 0}</b><span>retornos</span></div></div>
  ${on ? `<button class="btn primary block" data-act="recoff">🌱 Estou pronto para voltar</button>` : `<button class="btn primary block" data-act="recon">🌙 Ativar Modo Recuperação</button>`}
  <p class="small muted">Os dias são gastos um por dia enquanto o modo está ativo. Saindo no mesmo dia em que ativou, o dia é devolvido. Quando os dias acabam, o app volta ao normal, mas a <b>versão mínima</b> continua salvando a sequência.</p></section>
  <section class="card"><div class="sec-title"><span>Humor dos últimos 30 dias</span></div><div class="mood-strip">${last30.map(d => `<span title="${fmtD(d)}" class="${S.recDays[d] ? 'recd' : ''}">${S.mood[d] ? MOOD_SCALE[S.mood[d]] : '·'}</span>`).join('')}</div><p class="tiny muted">Só você vê isso. Fica salvo apenas neste aparelho.</p></section>
  ${SUPPORT_CARD}`;
}

/* ========== v1.2: Roleta ========== */
let role = { cat: null, dur: 'todos', res: null, wheels: null, spinning: false };
function roleCat(id) { return S.roleta.find(c => c.id === id); }
function rolePool(c) { return c ? c.itens.filter(it => role.dur === 'todos' || it.dur === role.dur) : []; }
function weightedPick(pool) { const w = pool.map(it => it.fav ? 3 : 1); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; } return pool[pool.length - 1]; }
const WHEEL_COLORS = ['#f59e0b', '#3b82f6', '#a855f7', '#22c55e', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#eab308'];
function makeWheel(pool, winner) {
  let segs = pool.slice(); if (segs.length > 12) { const others = segs.filter(x => x !== winner).sort(() => Math.random() - 0.5).slice(0, 11); segs = [winner, ...others].sort(() => Math.random() - 0.5); }
  const i = segs.indexOf(winner); const n = segs.length; const center = (i + 0.5) * 360 / n;
  return { segs, final: 360 * 6 + (360 - center) + (Math.random() - 0.5) * (300 / n) * 0.6, rot: 0 };
}
function wheelSVG(w, idx) {
  const n = w.segs.length; const R = 100; let g = '';
  w.segs.forEach((it, i) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
    const x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0), x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0; const mid = (a0 + a1) / 2; const tx = R + R * 0.6 * Math.cos(mid), ty = R + R * 0.6 * Math.sin(mid);
    const label = it.t.length > 14 ? it.t.slice(0, 13) + '…' : it.t;
    g += n === 1 ? `<circle cx="${R}" cy="${R}" r="${R}" fill="${WHEEL_COLORS[0]}"/>` : `<path d="M${R},${R} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} Z" fill="${WHEEL_COLORS[i % WHEEL_COLORS.length]}" stroke="#0b1020" stroke-width="1"/>`;
    g += `<text x="${tx}" y="${ty}" font-size="${n > 8 ? 7 : 8.5}" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="middle" transform="rotate(${mid * 180 / Math.PI} ${tx} ${ty})">${esc(label)}</text>`;
  });
  return `<div class="wheel-box"><div class="pointer">▼</div><svg viewBox="0 0 200 200" class="wheel" id="wheel${idx}" style="transform:rotate(${w.rot}deg)">${g}<circle cx="100" cy="100" r="12" fill="#0b1020" stroke="#fff" stroke-width="2"/></svg></div>`;
}
function viewRoleta() {
  if (!role.cat || (role.cat !== 'desafio' && !roleCat(role.cat))) role.cat = S.roleta[0]?.id || null;
  const hasDesafio = roleCat('desenhos') && roleCat('estilos');
  let h = `<h2 class="h2">🎡 Roleta</h2><p class="small muted">Na dúvida do que fazer? Gire. É livre: não gasta ouro e não é missão.</p>`;
  h += `<div class="filters">${S.roleta.map(c => `<button class="pill ${role.cat === c.id ? 'on' : ''}" data-act="rcat" data-id="${c.id}">${c.icon} ${esc(c.nome)}</button>`).join('')}${hasDesafio ? `<button class="pill ${role.cat === 'desafio' ? 'on' : ''}" data-act="rcat" data-id="desafio">🎯 Desafio de desenho</button>` : ''}</div>`;
  h += `<div class="pills"><span class="small muted">Tempo:</span>${[['todos', 'Qualquer'], ...Object.entries(DUR)].map(([k, v]) => `<button class="pill ${role.dur === k ? 'on' : ''}" data-act="rdur" data-d="${k}">${v}</button>`).join('')}</div>`;
  h += `<section class="card center">`;
  if (role.wheels) h += `<div class="wheels">${role.wheels.map((w, i) => wheelSVG(w, i)).join('')}</div>`;
  else h += `<div class="big-icon">🎡</div><p class="muted small">${role.cat === 'desafio' ? 'Duas rodas: O QUE desenhar + COMO desenhar.' : 'Toque em Girar!'}</p>`;
  h += `<button class="btn primary block" data-act="spin" ${role.spinning ? 'disabled' : ''}>${role.res ? '🔄 Girar de novo' : '🎡 Girar'}</button>`;
  if (role.res && !role.spinning) {
    const r = role.res;
    const ri = r.itemId ? roleCat(r.cat)?.itens.find(x => x.id === r.itemId) : null;
    h += `<div class="role-res pop"><div class="kicker">${r.desafio ? '🎯 Seu desafio' : 'Saiu'}</div><h2>${esc(r.texto)}</h2>${r.dur ? `<div class="small muted">${DUR[r.dur] || ''}</div>` : ''}
      ${r.imgs?.length ? `<div class="res-imgs">${r.imgs.map(p => `<img data-photo="${p}" data-act="viewphoto" data-pid="${p}" alt="">`).join('')}</div>` : ''}
      ${ri?.desc ? `<p class="small pre">${esc(ri.desc)}</p>` : ''}
      ${ri && (ri.link || ri.desc) ? `<div class="row center-row">${linkButtons(ri.link, ri.min, ri.t, ri.desc)}</div>` : ''}
      <div class="row center-row">${r.feito ? '<span class="tag">✅ Feito!</span>' : `<button class="btn sm" data-act="rdone">✅ Fiz!</button>`}
      ${(r.desafio || r.cat === 'desenhos') && S.missions.find(m => m.id === 'desenho' && !m.off) ? `<button class="btn sm" data-act="timer" data-id="desenho">⏱ Começar agora</button>` : ''}
      <button class="btn sm" data-act="rchron">🪶 Crônica</button></div></div>`;
  }
  h += `</section>`;
  // editor da categoria
  const c = role.cat === 'desafio' ? null : roleCat(role.cat);
  if (c) {
    h += `<section class="card"><div class="sec-title"><span>${c.icon} ${esc(c.nome)} <span class="small muted">(${c.itens.length})</span></span></div>
      ${c.itens.map(it => `<div class="li"><button class="star ${it.fav ? 'on' : ''}" data-act="rfav" data-id="${it.id}" title="Favorito (sai mais vezes)">${it.fav ? '★' : '☆'}</button>${it.img ? `<img class="thumb" data-photo="${it.img}" data-act="viewphoto" data-pid="${it.img}" alt="">` : ''}<span class="grow">${esc(it.t)}${it.link ? ' <span class="tiny">🔗</span>' : ''}${it.min ? ` <span class="tiny muted">${esc(it.min)}</span>` : ''}${it.desc ? `<br><span class="tiny muted">${esc(it.desc.slice(0, 60))}${it.desc.length > 60 ? '…' : ''}</span>` : ''}</span><span class="tag">${DUR[it.dur] || ''}</span>${it.link ? `<a class="btn xs" href="${esc(videoURL(it.link, it.min) || '#')}" target="_blank" rel="noopener">▶️</a>` : ''}<button class="btn xs" data-act="redit" data-id="${it.id}">✏️</button><button class="btn xs" data-act="rrm" data-id="${it.id}">✕</button></div>`).join('') || '<p class="muted small">Lista vazia. Adicione itens abaixo.</p>'}
      <form class="form roleadd" data-form="roleitem"><div class="addform"><input name="t" placeholder="${c.id === 'videos' ? 'Título do vídeo...' : 'Adicionar item...'}" required><select name="dur">${Object.entries(DUR).map(([k, v]) => `<option value="${k}" ${k === 'medio' ? 'selected' : ''}>${v}</option>`).join('')}</select><button class="btn sm">+</button></div>
        <details ${c.id === 'videos' ? 'open' : ''}><summary class="small">🔗 Link, minuto, descrição e imagem (opcional)</summary>
        <label>Link<input name="link" type="url" inputmode="url" placeholder="https://youtube.com/..."></label><label>Minuto de início<input name="min" placeholder="ex.: 12:40"></label>
        <label>Descrição<textarea name="desc" rows="2" placeholder="Sobre o que é, por que mostrar..."></textarea></label><label>Imagem (referência, capa, pôster)<input type="file" name="img" accept="image/*"></label></details></form>
      <label class="chk small" style="margin-top:8px"><input type="checkbox" data-act="rremover" ${c.remover ? 'checked' : ''}> Tirar da lista quando eu marcar "Fiz!"</label>
      <button class="btn xs danger" style="margin-top:8px" data-act="rdelcat" data-id="${c.id}">Excluir categoria</button></section>`;
  }
  h += `<section class="card"><div class="sec-title"><span>➕ Nova categoria</span></div><form class="addform" data-form="rolecat"><input name="icon" placeholder="🎵" maxlength="4" style="max-width:60px"><input name="nome" placeholder="Ex.: Músicas, Séries, Artes..." required><button class="btn sm">Criar</button></form></section>`;
  const hist = S.roletaHist.slice(-15).reverse();
  if (hist.length) h += `<section class="card"><div class="sec-title"><span>📜 Histórico</span></div>${hist.map(x => `<div class="li small"><span class="grow">${fmtD(x.d)} · ${esc(x.texto)}</span>${x.feito ? '✅' : ''}</div>`).join('')}</section>`;
  return h;
}
function spin() {
  if (role.spinning) return;
  let pools;
  if (role.cat === 'desafio') pools = [rolePool(roleCat('desenhos')), rolePool(roleCat('estilos'))];
  else pools = [rolePool(roleCat(role.cat))];
  if (pools.some(p => !p.length)) return toast('Nenhum item com esse filtro de tempo. Adicione itens ou mude o filtro.');
  const winners = pools.map(weightedPick);
  role.wheels = pools.map((p, i) => makeWheel(p, winners[i]));
  role.spinning = true; role.res = null; render();
  requestAnimationFrame(() => requestAnimationFrame(() => role.wheels?.forEach((w, i) => { const el = document.getElementById('wheel' + i); if (el) { el.style.transition = 'transform 3.2s cubic-bezier(.15,.85,.25,1)'; el.style.transform = `rotate(${w.final}deg)`; } })));
  try { navigator.vibrate?.(30); } catch (e) { }
  setTimeout(() => {
    role.wheels.forEach(w => w.rot = w.final % 360);
    const desafio = role.cat === 'desafio';
    const texto = desafio ? `${winners[0].t}, ${winners[1].t.charAt(0).toLowerCase() + winners[1].t.slice(1)}` : winners[0].t;
    role.res = { texto, desafio, cat: role.cat, dur: desafio ? null : winners[0].dur, itemId: desafio ? null : winners[0].id, imgs: winners.map(w => w.img).filter(Boolean), feito: false };
    S.roletaHist.push({ d: today(), cat: role.cat, texto, feito: false }); if (S.roletaHist.length > 300) S.roletaHist.shift();
    role.spinning = false; save(); render();
    try { navigator.vibrate?.([40, 30, 80]); } catch (e) { }
  }, 3300);
}
function roleDone() {
  const r = role.res; if (!r || r.feito) return; r.feito = true;
  const h = S.roletaHist[S.roletaHist.length - 1]; if (h && h.texto === r.texto) h.feito = true;
  const c = roleCat(r.cat); if (c?.remover && r.itemId) c.itens = c.itens.filter(x => x.id !== r.itemId);
  save(); render(); toast('✅ Feito! Que tal registrar numa crônica?');
}

/* ========== v1.2: Relatório imprimível ========== */
let rep = { tipo: 'semana', off: 0, fotos: true };
function periodRange(tipo, off) {
  const t = parseD(today());
  if (tipo === 'semana') { const ini = addDays(weekKey(), -7 * off); return { ini, fim: addDays(ini, 6), nome: `Semana de ${fmtD(ini)} a ${fmtD(addDays(ini, 6))}` }; }
  if (tipo === 'mês') { const a = new Date(t.getFullYear(), t.getMonth() - off, 1), b = new Date(t.getFullYear(), t.getMonth() - off + 1, 0); return { ini: dkey(a), fim: dkey(b), nome: a.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }; }
  const y = t.getFullYear() - off; return { ini: `${y}-01-01`, fim: `${y}-12-31`, nome: `Ano de ${y}` };
}
function weekdayStats(ini, fim) {
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  for (let d = ini < S.created ? S.created : ini; d <= fim && d <= today(); d = addDays(d, 1)) { const wd = parseD(d).getDay(); cnt[wd]++; sum[wd] += Object.values(logOf(d)).reduce((s, e) => s + (e.kind === 'full' ? 1 : .5), 0); }
  const avg = sum.map((s, i) => cnt[i] ? s / cnt[i] : null); const valid = avg.map((v, i) => [v, i]).filter(([v]) => v !== null);
  if (valid.length < 2) return null;
  valid.sort((a, b) => b[0] - a[0]); return { best: names[valid[0][1]], worst: names[valid[valid.length - 1][1]], avg, names };
}
function delta(a, b) { const d = a - b; return d === 0 ? '<span class="muted">=</span>' : d > 0 ? `<span class="pos">▲ ${d}</span>` : `<span class="neg">▼ ${-d}</span>`; }
function viewRelatorio() {
  const opts = rep.tipo === 'semana' ? 8 : rep.tipo === 'mês' ? 12 : 3;
  let h = `<div class="no-print"><h2 class="h2">📄 Relatório</h2><div class="pills">${['semana', 'mês', 'ano'].map(t => `<button class="pill ${rep.tipo === t ? 'on' : ''}" data-act="rtipo" data-t="${t}">${t === 'semana' ? '📅 Semanal' : t === 'mês' ? '🗓️ Mensal' : '🎆 Anual'}</button>`).join('')}</div>
    <div class="row"><select data-act="roff">${Array.from({ length: opts }, (_, i) => `<option value="${i}" ${rep.off === i ? 'selected' : ''}>${periodRange(rep.tipo, i).nome}</option>`).join('')}</select>
    <label class="chk small"><input type="checkbox" data-act="rfotos" ${rep.fotos ? 'checked' : ''}> Incluir fotos</label></div>
    <button class="btn primary block" data-act="print">🖨️ Imprimir / Salvar PDF</button><p class="tiny muted">No celular, escolha "Salvar como PDF" na tela de impressão.</p></div>`;
  return h + buildReport(rep.tipo, rep.off, rep.fotos);
}
function buildReport(tipo, off, fotos) {
  const P = periodRange(tipo, off), Q = periodRange(tipo, off + 1);
  const st = periodStats(P.ini, P.fim), pv = periodStats(Q.ini, Q.fim);
  const xpT = Object.values(st.xp).reduce((a, b) => a + b, 0), xpP = Object.values(pv.xp).reduce((a, b) => a + b, 0);
  const recN = Object.keys(S.recDays).filter(d => d >= P.ini && d <= P.fim).length;
  const moods = Object.entries(S.mood || {}).filter(([d]) => d >= P.ini && d <= P.fim).map(([, v]) => v);
  const moodAvg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const badges = Object.entries(S.badges).filter(([, v]) => v.d >= P.ini && v.d <= P.fim).map(([id, v]) => { const b = BADGES.find(x => x.id === id); return b ? `${b.icon} ${badgeLabel(b, v.tier)}` : ''; }).filter(Boolean);
  const bosses = Object.entries(S.bossWon).filter(([k]) => k >= addDays(P.ini, -6) && k <= P.fim).map(([, v]) => v.nome);
  const roul = S.roletaHist.filter(x => x.d >= P.ini && x.d <= P.fim && x.feito);
  const rv = Object.values(S.reviews).filter(r => r.ini >= P.ini && r.fim <= P.fim);
  const wd = weekdayStats(P.ini, P.fim);
  const tipoNome = { semana: 'Relatório semanal', 'mês': 'Relatório mensal', ano: 'Relatório anual' }[tipo];
  let h = `<div class="report">`;
  h += `<section class="card rep-head">${avatarHTML(64)}<div class="grow"><div class="kicker">${tipoNome}</div><h2 style="text-transform:capitalize">${esc(P.nome)}</h2><div class="small">${esc(S.profile.nome)} · ${esc(currentTitle())}</div></div></section>`;
  if (tipo === 'ano' && S.profile.futuro) h += `<blockquote>Quem eu quero me tornar: “${esc(S.profile.futuro)}”</blockquote>`;
  h += `<section class="card"><div class="sec-title"><span>📊 Resumo</span><span class="small muted">vs. período anterior</span></div><div class="stat-grid">
    <div><b>${st.full}</b><span>missões completas ${delta(st.full, pv.full)}</span></div><div><b>${st.min}</b><span>mínimas</span></div>
    <div><b>${st.dias}</b><span>dias perfeitos ${delta(st.dias, pv.dias)}</span></div><div><b>${xpT}</b><span>XP total ${delta(xpT, xpP)}</span></div>
    <div><b>+${st.gold}</b><span>🪙 ganho ${delta(st.gold, pv.gold)}</span></div><div><b>${st.gasto}</b><span>🪙 gasto</span></div>
    <div><b>${st.fotos}</b><span>provas com foto</span></div><div><b>${st.chron.length}</b><span>crônicas</span></div>
    ${recN ? `<div><b>${recN}</b><span>🌙 dias de pausa</span></div>` : ''}</div></section>`;
  const maxXp = Math.max(1, ...Object.values(st.xp));
  h += `<section class="card"><div class="sec-title"><span>⚔️ XP por atributo</span></div>${Object.keys(ATTRS).map(a => `<div class="attr-top small"><span>${ATTRS[a].icon} ${ATTRS[a].nome} · Nv ${S.levels[a]}</span><span>+${st.xp[a]} XP ${delta(st.xp[a], pv.xp[a])}</span></div>${bar(st.xp[a], maxXp, ATTRS[a].cor)}`).join('')}</section>`;
  h += `<section class="card"><div class="sec-title"><span>🔥 Conquistas do período</span></div>
    <div class="small"><b>Sequências atuais:</b> ${STREAK_ATTRS.map(a => `${ATTRS[a].icon} ${streak(a)} (recorde ${S.best[a] || 0})`).join(' · ')}</div>
    ${st.tests.length ? `<div class="small"><b>Testes de nível:</b> ${st.tests.map(t => `${ATTRS[t.attr].nome} ${t.from}→${t.to}`).join(', ')}</div>` : ''}
    ${bosses.length ? `<div class="small"><b>Chefes derrotados:</b> ${bosses.map(esc).join(', ')}</div>` : ''}
    ${badges.length ? `<div class="small"><b>Emblemas:</b> ${badges.map(esc).join(', ')}</div>` : ''}
    ${wd ? `<div class="small"><b>Melhor dia da semana:</b> ${wd.best} · <b>dia mais difícil:</b> ${wd.worst}</div>` : ''}
    ${moodAvg !== null ? `<div class="small"><b>Humor médio:</b> ${MOOD_SCALE[Math.round(moodAvg)]} (${moodAvg.toFixed(1)} de 5, ${moods.length} registro(s))</div>` : ''}
    ${roul.length ? `<div class="small"><b>Da roleta, feito:</b> ${roul.map(x => esc(x.texto)).join(', ')}</div>` : ''}
    ${!st.tests.length && !bosses.length && !badges.length ? '<div class="small muted">Nenhum teste, chefe ou emblema neste período.</div>' : ''}</section>`;
  if (st.chron.length) h += `<section class="card"><div class="sec-title"><span>🪶 Crônicas</span></div>${st.chron.map(c => `<div class="rep-chron"><b>${esc(c.titulo)}</b> <span class="small muted">${fmtD(c.d)} · ${CHRON_TYPES[c.tipo] || ''}</span>${c.nota ? ` <span class="stars">${'★'.repeat(c.nota)}</span>` : ''}${c.texto ? `<p class="small pre">${esc(c.texto.length > 400 ? c.texto.slice(0, 400) + '…' : c.texto)}</p>` : ''}${fotos && c.photo ? `<img class="rep-img" data-photo="${c.photo}" alt="">` : ''}</div>`).join('')}</section>`;
  if (rv.length) h += `<section class="card"><div class="sec-title"><span>🔎 Suas revisões</span></div>${rv.map(r => `<div class="small"><b>${r.tipo[0].toUpperCase() + r.tipo.slice(1)} ${fmtD(r.ini)}–${fmtD(r.fim)}</b>${r.respostas.map(x => `<p><i>${esc(x.q)}</i><br>${esc(x.a) || '—'}</p>`).join('')}</div>`).join('')}</section>`;
  if (fotos) {
    const gal = [];
    for (const [d, L] of Object.entries(S.log)) if (d >= P.ini && d <= P.fim) for (const [id, e] of Object.entries(L)) { const m = S.missions.find(x => x.id === id); if (e.photo && m?.attr === 'criativo') gal.push({ d, photo: e.photo, label: m.nome }); }
    for (const t of st.tests) gal.push({ d: t.d, photo: t.photo, label: `Teste ${ATTRS[t.attr].nome}` });
    gal.sort((a, b) => a.d.localeCompare(b.d));
    if (gal.length) h += `<section class="card"><div class="sec-title"><span>🎨 Galeria de evolução</span></div><div class="gallery">${gal.map(g => `<figure><img data-photo="${g.photo}" alt=""><figcaption>${fmtD(g.d)} · ${esc(g.label)}</figcaption></figure>`).join('')}</div></section>`;
  }
  h += `<p class="tiny muted center">Gerado pela Ficha da Vida em ${fmtD(today())}</p></div>`;
  return h;
}
async function printReport() {
  await hydratePhotos();
  await Promise.all([...document.querySelectorAll('.report img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 3000); })));
  try { window.print(); } catch (e) { toast('Não consegui abrir a impressão neste navegador.'); }
}

/* ========== v1.3: Links de vídeo, fotos em itens, Referências ========== */
function parseMin(m) {
  if (m === undefined || m === null || String(m).trim() === '') return 0;
  const parts = String(m).trim().split(':').map(x => Number(x) || 0);
  if (parts.length === 1) return Math.round(parts[0] * 60);          // "12" = 12 minutos
  return parts.reduce((acc, v) => acc * 60 + v, 0);                   // "12:40" ou "1:02:30"
}
function videoURL(link, min) {
  if (!link) return null; const sec = parseMin(min);
  try {
    const u = new URL(/^https?:\/\//.test(link) ? link : 'https://' + link);
    if (sec > 0) {
      if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) u.searchParams.set('t', sec + 's');
      else u.hash = 't=' + sec;
    }
    return u.toString();
  } catch (e) { return null; }
}
async function shareItem(title, desc, link, min) {
  const url = videoURL(link, min); const text = [title, desc, min ? `▶️ A partir de ${min}` : ''].filter(Boolean).join('\n');
  try { if (navigator.share) { await navigator.share({ title, text, url: url || undefined }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + (url ? '\n' + url : '')); toast('📋 Copiado! Cole no WhatsApp ou onde quiser.'); } catch (e) { toast('Não consegui compartilhar neste navegador.'); }
}
function photoInUse(id) {
  if (!id) return false;
  if (S.roleta.some(c => c.itens.some(it => it.img === id))) return true;
  if (S.refs.some(r => (r.photos || []).includes(id))) return true;
  if (S.chronicles.some(c => c.photo === id) || S.testsLog.some(t => t.photo === id)) return true;
  for (const L of Object.values(S.log)) for (const e of Object.values(L)) if (e.photo === id) return true;
  return false;
}
function dropPhotoIfUnused(id) { if (id && !photoInUse(id)) idbDel(id); }
function linkButtons(link, min, title, desc) {
  const url = videoURL(link, min);
  return `${url ? `<a class="btn sm primary" href="${esc(url)}" target="_blank" rel="noopener">▶️ Abrir${min ? ' em ' + esc(min) : ''}</a>` : ''}${url || desc ? `<button class="btn sm" data-act="share" data-title="${esc(title)}" data-desc="${esc(desc || '')}" data-link="${esc(link || '')}" data-min="${esc(min || '')}">📤 Compartilhar</button>` : ''}`;
}
// ---- item da roleta: editar ----
function openRoleItemForm(id) {
  const c = roleCat(role.cat); const it = c?.itens.find(x => x.id === id); if (!it) return;
  openModal(`<h2>✏️ Editar item</h2><form class="form" data-form="roleedit" data-id="${it.id}">
    <label>Nome<input name="t" required value="${esc(it.t)}"></label>
    <label>Tempo<select name="dur">${Object.entries(DUR).map(([k, v]) => `<option value="${k}" ${it.dur === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Link (vídeo, página, post...)<input name="link" type="url" inputmode="url" placeholder="https://youtube.com/..." value="${esc(it.link || '')}"></label>
    <label>Minuto de início (ex.: 12:40)<input name="min" placeholder="mm:ss" value="${esc(it.min || '')}"></label>
    <label>Descrição<textarea name="desc" rows="3" placeholder="Sobre o que é, por que mostrar...">${esc(it.desc || '')}</textarea></label>
    <label>Imagem (referência, capa, pôster)<input type="file" name="img" accept="image/*"></label>
    ${it.img ? `<div class="row"><img class="thumb big" data-photo="${it.img}" alt=""><label class="chk"><input type="checkbox" name="rmimg"> Remover imagem</label></div>` : ''}
    <button class="btn primary block">Salvar</button></form>`);
}
async function saveRoleItem(f, isNew) {
  const fd = new FormData(f); const c = roleCat(role.cat); if (!c) return;
  let it = isNew ? { id: uid() } : c.itens.find(x => x.id === f.dataset.id); if (!it) return;
  Object.assign(it, { t: fd.get('t').trim(), dur: fd.get('dur') || 'medio', link: (fd.get('link') || '').trim(), min: (fd.get('min') || '').trim(), desc: (fd.get('desc') || '').trim() });
  const file = fd.get('img');
  if (fd.get('rmimg')) { const old = it.img; it.img = null; dropPhotoIfUnused(old); }
  if (file && file.size) { const old = it.img; it.img = await savePhotoFile(file); dropPhotoIfUnused(old); }
  if (isNew) c.itens.push(it);
  closeModal(); save(); render(); toast(isNew ? '➕ Item adicionado!' : 'Salvo ✓');
}
// ---- Referências ----
let refQ = '', refTipo = 'todos';
function refMatches(r) {
  if (refTipo !== 'todos' && r.tipo !== refTipo) return false;
  if (!refQ) return true;
  const q = refQ.toLowerCase().replace(/^#/, '');
  return [r.obra, r.onde, r.desc, ...(r.tags || [])].some(x => String(x || '').toLowerCase().includes(q));
}
function refCards() {
  const list = S.refs.filter(refMatches).slice().reverse();
  if (!list.length) return `<p class="muted center">${S.refs.length ? 'Nada encontrado.' : 'Nenhuma referência ainda. Guarde um episódio, uma página, um painel... 📌'}</p>`;
  return `<div class="ref-grid">${list.map(r => `<button class="ref-card" data-act="refopen" data-id="${r.id}">${r.photos?.[0] ? `<img data-photo="${r.photos[0]}" alt="">` : `<div class="ref-ph">${(REF_TYPES[r.tipo] || '📌').split(' ')[0]}</div>`}<div class="ref-txt"><b>${esc(r.obra)}</b><span class="small">${esc(r.onde || '')}</span>${r.photos?.length > 1 ? `<span class="tiny muted">📷 ${r.photos.length}</span>` : ''}</div>${r.fav ? '<span class="ref-fav">★</span>' : ''}</button>`).join('')}</div>`;
}
function viewRefs() {
  return `<div class="row between"><h2 class="h2">📌 Referências</h2><button class="btn primary" data-act="refnew">+ Nova</button></div>
  <p class="small muted">Guarde onde está aquilo que você gosta: "Episódio X de Turma da Mônica", "Vagabond vol. 12, pág. 37", com as fotos dos melhores painéis.</p>
  <input class="search" data-act="refq" placeholder="🔎 Buscar por obra, tag (#luz), descrição..." value="${esc(refQ)}">
  <div class="filters">${[['todos', 'Todas'], ...Object.entries(REF_TYPES)].map(([k, v]) => `<button class="pill ${refTipo === k ? 'on' : ''}" data-act="reftipo" data-t="${k}">${v}</button>`).join('')}</div>
  ${S.refs.length ? `<button class="btn sm" data-act="refrandom">🎡 Sortear uma referência</button>` : ''}
  <div id="reflist">${refCards()}</div>`;
}
let refDraft = null; // { id?, photos: [], newFiles: [] }
function openRefForm(id) {
  const r = S.refs.find(x => x.id === id) || { obra: '', onde: '', tipo: 'manga', desc: '', link: '', min: '', tags: [], photos: [] };
  refDraft = { id: id || null, photos: (r.photos || []).slice(), newFiles: [] };
  openModal(`<h2>${id ? '✏️ Editar' : '📌 Nova'} referência</h2><form class="form" data-form="ref">
    <label>Obra<input name="obra" required placeholder="Ex.: Vagabond, Turma da Mônica" value="${esc(r.obra)}"></label>
    <label>Onde está<input name="onde" placeholder="Ex.: Volume 12, página 37 · Episódio 45" value="${esc(r.onde)}"></label>
    <label>Tipo<select name="tipo">${Object.entries(REF_TYPES).map(([k, v]) => `<option value="${k}" ${r.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Descrição<textarea name="desc" rows="3" placeholder="Por que isso é uma boa referência?">${esc(r.desc)}</textarea></label>
    <label>Link (opcional)<input name="link" type="url" inputmode="url" value="${esc(r.link || '')}" placeholder="https://"></label>
    <label>Minuto (se for vídeo)<input name="min" placeholder="mm:ss" value="${esc(r.min || '')}"></label>
    <label>Tags (separe por espaço)<input name="tags" placeholder="#luz #anatomia #narrativa" value="${esc((r.tags || []).map(t => '#' + t).join(' '))}"></label>
    <div class="small"><b>Fotos</b> (capa, melhores painéis). A primeira vira a capa.</div>
    <div id="refphotos" class="ref-photos">${refPhotosHTML()}</div>
    <label class="btn">📷 Adicionar fotos<input type="file" accept="image/*" multiple data-act="refaddph" hidden></label>
    <button class="btn primary block">Salvar referência</button>
    ${id ? `<button type="button" class="btn danger block" data-act="refdel" data-id="${id}">Excluir referência</button>` : ''}</form>`);
}
function refPhotosHTML() {
  if (!refDraft) return '';
  const ex = refDraft.photos.map((p, i) => `<div class="rp"><img data-photo="${p}" alt=""><button type="button" class="x-mini" data-act="refrmph" data-i="${i}">✕</button></div>`);
  const nw = refDraft.newFiles.map((f, i) => `<div class="rp"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="x-mini" data-act="refrmnew" data-i="${i}">✕</button></div>`);
  return ex.concat(nw).join('') || '<span class="tiny muted">Nenhuma foto.</span>';
}
function redrawRefPhotos() { const el = $('#refphotos'); if (el) { el.innerHTML = refPhotosHTML(); hydratePhotos(el); } }
async function submitRef(f) {
  const fd = new FormData(f); const isNew = !refDraft.id;
  const r = isNew ? { id: uid(), d: today() } : S.refs.find(x => x.id === refDraft.id);
  const before = (r.photos || []).slice();
  const added = []; for (const file of refDraft.newFiles) added.push(await savePhotoFile(file));
  Object.assign(r, { obra: fd.get('obra').trim(), onde: fd.get('onde').trim(), tipo: fd.get('tipo'), desc: fd.get('desc').trim(), link: fd.get('link').trim(), min: fd.get('min').trim(),
    tags: fd.get('tags').split(/[\s,]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean), photos: refDraft.photos.concat(added) });
  if (isNew) S.refs.push(r);
  for (const p of before) if (!r.photos.includes(p)) dropPhotoIfUnused(p);
  refDraft = null; closeModal(); save(); render(); toast('📌 Referência salva!');
}
function openRefDetail(id) {
  const r = S.refs.find(x => x.id === id); if (!r) return;
  openModal(`<div class="kicker">${REF_TYPES[r.tipo] || ''}</div><h2>${esc(r.obra)}</h2>${r.onde ? `<div class="ref-onde">📍 ${esc(r.onde)}</div>` : ''}
    ${(r.photos || []).map(p => `<img class="ref-full" data-photo="${p}" alt="">`).join('')}
    ${r.desc ? `<p class="pre">${esc(r.desc)}</p>` : ''}
    ${r.tags?.length ? `<div class="pills">${r.tags.map(t => `<button class="pill" data-act="reftag" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="row">${linkButtons(r.link, r.min, `${r.obra}${r.onde ? ' — ' + r.onde : ''}`, r.desc)}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="reffav" data-id="${r.id}">${r.fav ? '★ Favorita' : '☆ Favoritar'}</button><button class="btn sm" data-act="refedit" data-id="${r.id}">✏️ Editar</button>${r.photos?.length ? `<button class="btn sm" data-act="ref2roleta" data-id="${r.id}">🎨 Usar como desenho na roleta</button>` : ''}</div>
    <p class="tiny muted">Guardada em ${fmtD(r.d)}</p>`);
}
function refToRoleta(id) {
  const r = S.refs.find(x => x.id === id); let c = roleCat('desenhos');
  if (!c) { c = { id: 'desenhos', nome: 'Desenhos', icon: '🎨', itens: [] }; S.roleta.push(c); }
  c.itens.push({ id: uid(), t: `${r.obra}${r.onde ? ' (' + r.onde + ')' : ''}`, dur: 'medio', img: r.photos[0], desc: r.desc, link: r.link, min: r.min });
  save(); toast('🎨 Adicionada à roleta de Desenhos, com a foto de referência!');
}

/* ---------- Eventos ---------- */
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-act]'); const navb = ev.target.closest('#nav button');
  if (navb) { tab = navb.dataset.tab; sub = null; render(); window.scrollTo(0, 0); return; }
  if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  if (el.tagName === 'INPUT' || el.tagName === 'LABEL' || el.tagName === 'SELECT') return;
  const A = el.dataset.act, D = el.dataset;
  switch (A) {
    case 'close': closeModal(); break;
    case 'go': tab = D.tab; sub = D.sub || null; closeModal(); render(); window.scrollTo(0, 0); break;
    case 'sub': if (D.go) tab = 'mais'; sub = D.sub || null; closeModal(); render(); window.scrollTo(0, 0); break;
    case 'mark': markMission(D.id, D.kind); break;
    case 'bonus': toggleBonus(Number(D.i)); break;
    case 'timer': openTimer(D.id); break;
    case 'tstart': if (timer && !timer.running) { timer.end = Date.now() + timer.left * 1000; timer.running = true; clearInterval(timer.iv); timer.iv = setInterval(timerTick, 500); drawTimer(); } break;
    case 'tpause': if (timer?.running) { timer.left = Math.max(0, Math.round((timer.end - Date.now()) / 1000)); timer.running = false; clearInterval(timer.iv); drawTimer(); } break;
    case 'treset': if (timer) { clearInterval(timer.iv); timer.running = false; timer.left = timer.total; drawTimer(); } break;
    case 'repair': repairStreak(D.id); break;
    case 'review': openReview(D.key); break;
    case 'test': openTest(D.attr); break;
    case 'passtest': passTest(D.attr); break;
    case 'marco': { const was = S.marcosDone[D.id]; if (was) delete S.marcosDone[D.id]; else { S.marcosDone[D.id] = today(); const m = S.marcos.find(x => x.id === D.id); if (!hasRef('marco:' + D.id)) addLedger('marco:' + D.id, m.attr, 200, 150, 'Marco: ' + m.nome); celebrate('🏁', 'Marco alcançado!', m.nome, '+200 XP +150 🪙'); } afterChange(); break; }
    case 'buy': buy(D.id); break;
    case 'openchest': openChest(D.id); break;
    case 'reroll': if (openingChest && !openingChest.rerolled) { const g = openingChest.prize.gold; openingChest.prize = rollPrize(openingChest.c.rarity); openingChest.prize.gold = g; openingChest.rerolled = true; drawPrize(); } break;
    case 'claim': claimChest(); break;
    case 'rmlist': S.lists[D.k].splice(Number(D.i), 1); save(); render(); break;
    case 'editshop': openShopEditor(); break;
    case 'rmshop': S.shop = S.shop.filter(x => x.id !== D.id); save(); openShopEditor(); render(); break;
    case 'newchron': openChronForm({ tipo: D.tipo, attr: D.attr, titulo: D.titulo, photo: D.photo }); break;
    case 'cfilter': chronFilter = D.f; render(); break;
    case 'showchron': { const c = S.chronicles.find(x => x.id === D.id); if (c) openModal(chronCard(c)); break; }
    case 'delchron': { const c = S.chronicles.find(x => x.id === D.id); if (c && el.dataset.confirm === '1') { S.chronicles = S.chronicles.filter(x => x.id !== D.id); removeRef('c:' + D.id); afterChange(); } else { el.dataset.confirm = '1'; el.textContent = 'Apagar?'; } break; }
    case 'sharechron': shareCard(D.id); break;
    case 'viewphoto': openModal(`<img class="full-photo" data-photo="${D.pid}" alt="">`); break;
    case 'avatar': S.profile.avatar = { type: 'preset', key: D.k }; save(); render(); break;
    case 'aframe': if (D.f === 'auto' || D.f === 'none' || frameUnlockedAvatar(D.f)) { S.profile.avatarFrame = D.f; save(); render(); } else toast('🔒 Suba os atributos para liberar.'); break;
    case 'cframe': { const own = S.framesOwned.includes(D.f) || (['bronze', 'prata', 'ouro'].includes(D.f) && frameUnlockedAvatar(D.f)); if (own) { S.profile.frame = D.f; save(); render(); } else toast('🔒 Derrote o chefe semanal correspondente para ganhar esta moldura.'); break; }
    case 'rmcover': S.profile.cover = null; save(); render(); break;
    case 'tema': S.settings.tema = D.t; save(); render(); break;
    case 'showcase': { const sc = S.profile.showcase ||= []; if (sc.includes(D.id)) S.profile.showcase = sc.filter(x => x !== D.id); else if (sc.length < 3) sc.push(D.id); else toast('Máximo de 3.'); save(); render(); break; }
    case 'editm': openMissionForm(D.id); break;
    case 'delm': if (el.dataset.confirm === '1') { S.missions = S.missions.filter(x => x.id !== D.id); closeModal(); save(); render(); } else { el.dataset.confirm = '1'; el.textContent = 'Toque de novo para excluir'; } break;
    case 'edittest': openTestEdit(D.attr, Number(D.i)); break;
    case 'addtest': openTestEdit(D.attr, -1); break;
    case 'export': exportBackup(); break;
    case 'reset': openModal(`<h2>Apagar tudo?</h2><p>Isso apaga sua ficha, fotos e progresso deste aparelho. Digite <b>APAGAR</b> para confirmar.</p><form class="form" data-form="reset"><input name="v" required><button class="btn danger block">Apagar tudo</button></form>`); break;
    case 'obnext': if (ob.step === 0 || obCollect()) { if (ob.step === 7) ob.step = 8; else ob.step++; render(); } break;
    case 'obback': obCollect(); ob.step = Math.max(0, ob.step - 1); render(); break;
    case 'obpick': ob.data[D.f] = D.v; if (D.f === 'meta') { const v = $('#obv')?.value; ob.data.orcamento = Number(v) || 0; } render(); break;
    case 'obfinish': obFinish(); break;
    case 'recon': activateRecovery(); break;
    case 'recoff': deactivateRecovery(); break;
    case 'recnoticeok': S.recEndedNotice = false; save(); render(); break;
    case 'mood': { const n = Number(D.n); if (S.mood[today()] === n) delete S.mood[today()]; else S.mood[today()] = n; save(); render(); break; }
    case 'rcat': role.cat = D.id; role.res = null; role.wheels = null; render(); break;
    case 'rdur': role.dur = D.d; render(); break;
    case 'spin': spin(); break;
    case 'rdone': roleDone(); break;
    case 'rchron': { const r = role.res; if (r) openChronForm({ titulo: r.texto, tipo: r.cat === 'filmes' ? 'filme' : r.cat === 'livros' ? 'livro' : 'obra', attr: r.cat === 'livros' ? 'mental' : 'criativo' }); break; }
    case 'rfav': { const c = roleCat(role.cat); const it = c?.itens.find(x => x.id === D.id); if (it) { it.fav = !it.fav; save(); render(); } break; }
    case 'rrm': { const c = roleCat(role.cat); if (c) { const it = c.itens.find(x => x.id === D.id); c.itens = c.itens.filter(x => x.id !== D.id); if (it?.img) dropPhotoIfUnused(it.img); save(); render(); } break; }
    case 'rdelcat': if (el.dataset.confirm === '1') { S.roleta = S.roleta.filter(c => c.id !== D.id); role.cat = null; role.res = null; role.wheels = null; save(); render(); } else { el.dataset.confirm = '1'; el.textContent = 'Toque de novo para excluir'; } break;
    case 'rtipo': rep.tipo = D.t; rep.off = 0; render(); break;
    case 'print': printReport(); break;
    case 'redit': openRoleItemForm(D.id); break;
    case 'share': shareItem(D.title, D.desc, D.link, D.min); break;
    case 'refnew': openRefForm(); break;
    case 'refopen': openRefDetail(D.id); break;
    case 'refedit': openRefForm(D.id); break;
    case 'reffav': { const r = S.refs.find(x => x.id === D.id); if (r) { r.fav = !r.fav; save(); openRefDetail(r.id); render(); } break; }
    case 'reftipo': refTipo = D.t; render(); break;
    case 'reftag': refQ = '#' + D.t; refTipo = 'todos'; closeModal(); tab = 'mais'; sub = 'referencias'; render(); break;
    case 'refrandom': { const pool = S.refs.filter(refMatches); if (pool.length) openRefDetail(pool[Math.floor(Math.random() * pool.length)].id); break; }
    case 'ref2roleta': refToRoleta(D.id); break;
    case 'refrmph': if (refDraft) { refDraft.photos.splice(Number(D.i), 1); redrawRefPhotos(); } break;
    case 'refrmnew': if (refDraft) { refDraft.newFiles.splice(Number(D.i), 1); redrawRefPhotos(); } break;
    case 'refdel': if (el.dataset.confirm === '1') { const r = S.refs.find(x => x.id === D.id); S.refs = S.refs.filter(x => x.id !== D.id); (r?.photos || []).forEach(dropPhotoIfUnused); closeModal(); save(); render(); toast('Referência excluída.'); } else { el.dataset.confirm = '1'; el.textContent = 'Toque de novo para excluir'; } break;
  }
});
document.addEventListener('change', async ev => {
  const el = ev.target; const A = el.dataset.act; const f = el.files?.[0];
  if (el.id === 'ctipo') { const g = $('#cguide'); if (g) g.innerHTML = guideHTML(el.value); return; }
  if (el.id === 'testPhoto' && f) { pendingTestPhoto = f; $('#testPhotoOk').textContent = '✓ ' + f.name; return; }
  if (el.id === 'cphoto' && f) { chronPhoto = { file: f }; $('#cphotoOk').textContent = '✓ ' + f.name; return; }
  if (A === 'proof' && f) return attachProof(el.dataset.id, f);
  if (A === 'avatarimg' && f) { S.profile.avatar = { type: 'img', data: await resizeImage(f, 256, true) }; save(); render(); return; }
  if (A === 'coverimg' && f) { S.profile.cover = await resizeImage(f, 1000, true, 0.78); save(); render(); return; }
  if (A === 'refaddph' && el.files?.length) { refDraft?.newFiles.push(...el.files); el.value = ''; redrawRefPhotos(); return; }
  if (A === 'roff') { rep.off = Number(el.value); render(); return; }
  if (A === 'rfotos') { rep.fotos = el.checked; render(); return; }
  if (A === 'rremover') { const c = roleCat(role.cat); if (c) { c.remover = el.checked; save(); } return; }
  if (A === 'accent') { S.settings.accent = el.value; save(); render(); return; }
  if (A === 'import' && f) return importBackup(f);
});
document.addEventListener('input', ev => {
  if (ev.target.dataset?.act === 'refq') { refQ = ev.target.value; const l = $('#reflist'); if (l) { l.innerHTML = refCards(); hydratePhotos(l); } }
});
document.addEventListener('submit', async ev => {
  const f = ev.target; const kind = f.dataset.form; if (!kind) return; ev.preventDefault(); const fd = new FormData(f);
  if (kind === 'addlist') { S.lists[f.dataset.k].push(fd.get('v').trim()); save(); render(); setTimeout(() => document.querySelectorAll('details.list-ed').forEach(d => { if (d.querySelector(`[data-k="${f.dataset.k}"]`)) d.open = true; }), 0); }
  if (kind === 'chron') await submitChron(f);
  if (kind === 'roleitem') await saveRoleItem(f, true);
  if (kind === 'roleedit') await saveRoleItem(f, false);
  if (kind === 'ref') await submitRef(f);
  if (kind === 'rolecat') { const id = 'c_' + uid(); S.roleta.push({ id, nome: fd.get('nome').trim(), icon: (fd.get('icon') || '🎲').trim() || '🎲', itens: [] }); role.cat = id; role.res = null; role.wheels = null; save(); render(); }
  if (kind === 'perfil') { Object.assign(S.profile, { nome: fd.get('nome'), idade: fd.get('idade'), classe: fd.get('classe'), futuro: fd.get('futuro'), titulo: fd.get('titulo') }); save(); render(); toast('Salvo ✓'); }
  if (kind === 'review') {
    const p = reviewPeriods().find(x => x.key === f.dataset.key); if (!p) return;
    S.reviews[p.key] = { tipo: p.tipo, ini: p.ini, fim: p.fim, d: today(), respostas: REVIEW_Q[p.tipo].map((q, i) => ({ q, a: fd.get('q' + i) })) };
    addLedger('rev:' + p.key, null, 0, REVIEW_GOLD[p.tipo], `Revisão da ${p.tipo}`); closeModal(); afterChange(); toast(`🔎 Revisão concluída! +${REVIEW_GOLD[p.tipo]} 🪙`);
  }
  if (kind === 'mission') {
    const id = f.dataset.id; const data = { nome: fd.get('nome'), attr: fd.get('attr'), freq: fd.get('freq'), target: Number(fd.get('target')) || 1, mandatory: !!fd.get('mandatory'), minimo: fd.get('minimo'), minutos: Number(fd.get('minutos')) || 0, off: !!fd.get('off') };
    if (id) Object.assign(S.missions.find(x => x.id === id), data); else S.missions.push({ id: 'm_' + uid(), ...data });
    closeModal(); save(); render();
  }
  if (kind === 'test') { const a = f.dataset.attr, i = Number(f.dataset.i); const t = { req: fd.get('req'), teste: fd.get('teste') }; if (i >= 0) S.tests[a][i] = t; else S.tests[a].push(t); closeModal(); save(); render(); }
  if (kind === 'config') {
    const on = !!fd.get('lembreteOn');
    if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { } }
    Object.assign(S.settings, { meta: fd.get('meta'), orcamento: Number(fd.get('orcamento')) || 0, goldCap: Number(fd.get('goldCap')) || 1000, lembrete: fd.get('lembrete'), lembreteOn: on, backupDias: Number(fd.get('backupDias')) || 7, recMes: Math.max(0, Number(fd.get('recMes')) || 0), recAno: Math.max(0, Number(fd.get('recAno')) || 0), githubRepo: (fd.get('githubRepo') || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''), githubPasta: (fd.get('githubPasta') || '').trim().replace(/^\/+|\/+$/g, '') });
    if (on && 'Notification' in window && Notification.permission === 'denied') toast('⚠️ Notificações bloqueadas no navegador.');
    save(); render(); toast('Salvo ✓');
  }
  if (kind === 'shopitem') { S.shop.push({ id: 's_' + uid(), nome: fd.get('nome'), preco: Number(fd.get('preco')) || 10, reais: Number(fd.get('reais')) || 0, tipo: Number(fd.get('reais')) ? 'real' : 'tempo' }); save(); openShopEditor(); render(); }
  if (kind === 'reset') { if (fd.get('v') === 'APAGAR') { localStorage.removeItem(KEY); indexedDB.deleteDatabase('fichaFotos'); location.reload(); } else toast('Digite APAGAR'); }
});
function openShopEditor() {
  openModal(`<h2>✏️ Editar loja</h2>${S.shop.map(it => `<div class="li"><span class="grow">${esc(it.nome)} <span class="muted small">${it.preco} 🪙${it.reais ? ` · R$ ${it.reais}` : ''}</span></span><button class="btn xs" data-act="rmshop" data-id="${it.id}">✕</button></div>`).join('')}<h3>Nova recompensa</h3><form class="form" data-form="shopitem"><label>Nome<input name="nome" required></label><label>Preço em ouro<input name="preco" type="number" min="1" required></label><label>Valor em R$ do orçamento (0 se não gasta dinheiro)<input name="reais" type="number" min="0" value="0"></label><button class="btn primary block">Adicionar</button></form>`);
}

/* ---------- Início ---------- */
function boot() {
  load();
  if (S.onboarded) {
    const notes = processDays(); ensureRecoveryToday(); afterChange();
    notes.forEach((n, i) => setTimeout(() => toast(n), 600 + i * 900));
  } else render();
  setInterval(reminderCheck, 60000); setTimeout(reminderCheck, 3000);
  // virada do dia com o app aberto
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (S.onboarded) { processDays(); ensureRecoveryToday(); afterChange(); } } }, 30000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
boot();
