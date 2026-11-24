// Painel padrão da Órbita Virtual para sites de clientes.
// O dono e a equipe entram com usuário e senha e editam o que o site marcou como editável (ver ../conteudo.js).
// Os campos são lidos do próprio ../index.html: não precisa mudar este arquivo para cada site.
// A sessão é a mesma da Órbita Central e dos outros painéis (mesmo endereço github.io).
import {banco} from '../config.js?v=1';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const paraLogin = v => { v = String(v || '').trim().toLowerCase(); return v.includes('@') ? v : v + '@' + banco.site + '.invalid'; };
const mostrarUsuario = e => String(e || '').endsWith('.invalid') ? String(e).split('@')[0] : e;
const soDigitos = v => String(v || '').replace(/\D/g, '');
const app = document.getElementById('app'), quem = document.getElementById('quem');
const SITE = banco.site;
let sb, email = '', orbita = false, dono = false, aba = 'conteudo', nomeSite = '';

function aviso(texto, tipo = 'ok') {
  let t = document.querySelector('.aviso'); if (!t) { t = document.createElement('div'); t.className = 'aviso'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = texto; t.dataset.tipo = tipo; t.classList.add('mostra'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('mostra'), 4000);
}

async function iniciar() {
  try {
    const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(banco.url, banco.chave, {auth: {persistSession: true, detectSessionInUrl: false, storageKey: 'orbita-sites-sessao'}});
  } catch { app.innerHTML = '<div class="caixa"><p class="erro">Não foi possível carregar. Verifique a internet e recarregue a página.</p></div>'; return; }
  nomeSite = (await sb.from('sites').select('nome').eq('id', SITE).maybeSingle()).data?.nome || document.title;
  document.querySelectorAll('[data-nome-site]').forEach(el => { el.textContent = nomeSite; });
  const {data} = await sb.auth.getSession();
  if (data.session) await entrou(data.session); else telaLogin();
}

// ---------- login ----------
function telaLogin(msg = '') {
  quem.innerHTML = '';
  app.innerHTML = '<form class="caixa login" data-login><img src="' + esc(document.querySelector('link[rel=icon]')?.getAttribute('href') || '') + '" alt="" width="64" height="64"><h1>Painel · ' + esc(nomeSite) + '</h1><p class="nota">Entre com o seu usuário e senha.</p>' +
    (msg ? '<p class="erro" role="alert">' + esc(msg) + '</p>' : '') +
    '<label>Usuário<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>' +
    '<button class="bt principal">Entrar</button><p class="nota">Esqueceu a senha? Peça para o dono criar uma nova na aba Equipe.</p></form>';
  app.querySelector('[data-login]').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), bt = e.target.querySelector('button'); bt.disabled = true; bt.textContent = 'Entrando…';
    const {data, error} = await sb.auth.signInWithPassword({email: paraLogin(f.get('usuario')), password: f.get('senha')});
    if (error) return telaLogin('Usuário ou senha incorretos.');
    await entrou(data.session);
  };
}

async function entrou(sessao) {
  email = sessao.user.email.toLowerCase();
  const minhas = (await sb.from('equipe').select('site,papel')).data || [];
  orbita = minhas.some(r => r.site === '*');
  const aqui = minhas.find(r => r.site === SITE);
  quem.innerHTML = '<span>' + esc(mostrarUsuario(email)) + '</span><button class="bt" data-sair>Sair</button>';
  quem.querySelector('[data-sair]').onclick = async () => { await sb.auth.signOut(); telaLogin(); };
  if (!orbita && !aqui) {
    app.innerHTML = '<div class="caixa login"><h1>Sem acesso a este site</h1><p class="nota">O usuário ' + esc(mostrarUsuario(email)) + ' não tem permissão para editar este site.</p><button class="bt principal" data-trocar>Entrar com outro usuário</button></div>';
    app.querySelector('[data-trocar]').onclick = async () => { await sb.auth.signOut(); telaLogin(); };
    return;
  }
  dono = orbita || aqui?.papel === 'dono';
  desenhar();
}

function desenhar() {
  const abas = [['conteudo', 'Conteúdo do site'], ...(dono ? [['equipe', 'Equipe']] : []), ['conta', 'Minha senha']];
  app.innerHTML = '<nav class="abas" role="tablist">' + abas.map(([id, n]) => '<button role="tab" aria-selected="' + (aba === id) + '" data-aba="' + id + '">' + n + '</button>').join('') + '</nav><div id="conteudo"></div>';
  app.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; desenhar(); });
  ({conteudo: telaConteudo, equipe: telaEquipe, conta: telaConta})[aba]();
}
const conteudo = () => document.getElementById('conteudo');

// ---------- campos editáveis (lidos do ../index.html) ----------
async function lerCampos() {
  const html = await (await fetch('../index.html', {cache: 'no-cache'})).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const campos = new Map();
  const grupo = el => el.closest('[data-grupo]')?.dataset.grupo || 'Geral';
  const add = (chave, c) => { if (chave && !campos.has(chave)) campos.set(chave, {chave, ...c}); };
  doc.querySelectorAll('[data-editavel],[data-whats],[data-tel]').forEach(el => {
    if (el.dataset.editavel) {
      const linhas = el.hasAttribute('data-linhas');
      const padrao = linhas ? el.innerHTML.split(/<br\s*\/?>/i).map(p => { const d = document.createElement('div'); d.innerHTML = p; return d.textContent.trim(); }).join('\n') : el.textContent.trim();
      add(el.dataset.editavel, {rotulo: el.dataset.rotulo || el.dataset.editavel, grupo: grupo(el), padrao, tipo: el.dataset.opcoes ? 'opcoes' : el.hasAttribute('data-pix') ? 'pix' : linhas || padrao.length > 90 ? 'longo' : 'texto', opcoes: el.dataset.opcoes?.split('|')});
    }
    const fone = el.dataset.whats || el.dataset.tel;
    if (fone) { const m = (el.getAttribute('href') || '').match(/(?:wa\.me\/|tel:\+?)(\d+)/); add(fone, {rotulo: el.dataset.rotulo || 'WhatsApp', grupo: grupo(el), padrao: m ? m[1].replace(/^55(?=\d{10,11}$)/, '') : '', tipo: 'fone'}); }
  });
  return [...campos.values()];
}

// Dígitos verificadores (evita, por exemplo, um celular com DDD passar como CPF).
const cpfOk = d => { if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false; const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = s * 10 % 11; return r === 10 ? 0 : r; }; return dv(9) === +d[9] && dv(10) === +d[10]; };
const cnpjOk = d => { if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false; const dv = n => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = p.reduce((a, k, i) => a + k * +d[i], 0) % 11; return s < 2 ? 0 : 11 - s; }; return dv(12) === +d[12] && dv(13) === +d[13]; };
function validar(c, v, todos) {
  if (!v) return null;
  if (c.tipo === 'fone') { const d = soDigitos(v); return d.length >= 10 && d.length <= 13 ? null : c.rotulo + ': use o número com DDD, ex.: (87) 99999-9999.'; }
  if (c.tipo === 'opcoes') return c.opcoes.includes(v) ? null : c.rotulo + ': escolha uma opção da lista.';
  if (c.tipo === 'pix') {
    const tipo = todos['pix.tipo'] || 'Celular', d = soDigitos(v);
    const ok = {Celular: d.length >= 10 && d.length <= 13, CPF: cpfOk(d), CNPJ: cnpjOk(d), 'E-mail': /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Chave aleatória': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())}[tipo];
    return ok ? null : 'A chave Pix não combina com o tipo "' + tipo + '". Confira os números.';
  }
  return v.length > 3000 ? c.rotulo + ': texto muito longo.' : null;
}

async function telaConteudo() {
  conteudo().innerHTML = '<p class="nota">Carregando…</p>';
  let campos, salvos;
  try {
    campos = await lerCampos();
    const {data, error} = await sb.from('ajustes').select('dados').eq('site', SITE).eq('chave', 'textos').maybeSingle();
    if (error) throw error;
    salvos = data?.dados || {};
  } catch (e) { conteudo().innerHTML = '<p class="erro">Não foi possível carregar: ' + esc(e.message) + '</p>'; return; }
  if (!campos.length) { conteudo().innerHTML = '<p class="nota">Este site ainda não tem campos editáveis.</p>'; return; }
  const grupos = [...new Set(campos.map(c => c.grupo))];
  const campo = c => {
    const v = salvos[c.chave] ?? c.padrao, id = 'c-' + c.chave.replace(/[^\w-]/g, '_');
    const ajuda = c.tipo === 'fone' ? '<small class="nota">Com DDD. Vale para todos os botões de WhatsApp.</small>' : c.tipo === 'pix' ? '<small class="nota">Confira com atenção: é para esta chave que os clientes vão pagar.</small>' : '';
    if (c.tipo === 'opcoes') return '<label for="' + id + '">' + esc(c.rotulo) + '<select id="' + id + '" data-chave="' + esc(c.chave) + '">' + c.opcoes.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></label>';
    if (c.tipo === 'longo') return '<label for="' + id + '">' + esc(c.rotulo) + '<textarea id="' + id + '" rows="' + Math.min(6, Math.max(2, Math.ceil(v.length / 70))) + '" data-chave="' + esc(c.chave) + '">' + esc(v) + '</textarea></label>';
    return '<label for="' + id + '">' + esc(c.rotulo) + '<input id="' + id + '" data-chave="' + esc(c.chave) + '" value="' + esc(v) + '"' + (c.tipo === 'fone' ? ' inputmode="tel"' : '') + '>' + ajuda + '</label>';
  };
  conteudo().innerHTML = '<form class="editor" data-conteudo><p class="nota">Mude o que precisar e clique em <b>Salvar</b>. Apagar um campo volta ao texto original.</p>' +
    grupos.map(g => '<fieldset class="caixa"><legend>' + esc(g) + '</legend>' + campos.filter(c => c.grupo === g).map(campo).join('') + '</fieldset>').join('') +
    '<div class="rodape"><button class="bt principal">Salvar</button><a class="bt" href="../" target="_blank" rel="noopener">Ver o site</a></div></form>';
  conteudo().querySelector('[data-conteudo]').onsubmit = async e => {
    e.preventDefault();
    const novo = {};
    e.target.querySelectorAll('[data-chave]').forEach(i => { const c = campos.find(x => x.chave === i.dataset.chave), v = i.value.trim(); if (v && v !== c.padrao) novo[c.chave] = v; });
    const todos = Object.fromEntries(campos.map(c => [c.chave, novo[c.chave] ?? c.padrao]));
    for (const c of campos) { const erro = validar(c, todos[c.chave], todos); if (erro) return aviso(erro, 'erro'); }
    const pixMudou = campos.some(c => (c.tipo === 'pix' || c.chave === 'pix.tipo') && (salvos[c.chave] ?? c.padrao) !== todos[c.chave]);
    if (pixMudou && !confirm('A chave Pix vai ficar: ' + todos['pix.chave'] + ' (' + (todos['pix.tipo'] || 'Celular') + ').\nOs clientes vão pagar para essa chave. Está certo?')) return;
    const bt = e.target.querySelector('button.principal'); bt.disabled = true;
    const {error} = await sb.from('ajustes').upsert({site: SITE, chave: 'textos', dados: novo}, {onConflict: 'site,chave'});
    bt.disabled = false;
    if (error) return aviso('Não foi possível salvar: ' + error.message, 'erro');
    salvos = novo; aviso('Salvo! Já aparece no site.');
  };
}

// ---------- equipe (dono) ----------
async function chamarEquipe(corpo) {
  const {data, error} = await sb.functions.invoke(banco.funcaoEquipe || 'equipe', {body: {site: SITE, ...corpo}});
  if (!error) return data;
  let msg = 'Não foi possível falar com o banco.';
  try { msg = (await error.context.json()).erro || msg; } catch {}
  throw new Error(msg);
}
async function telaEquipe() {
  conteudo().innerHTML = '<p class="nota">Carregando…</p>';
  let pessoas;
  try { pessoas = (await chamarEquipe({acao: 'listar'})).equipe; } catch (e) { conteudo().innerHTML = '<p class="erro">' + esc(e.message) + '</p>'; return; }
  const nomes = {dono: 'Dono: edita o site e cadastra a equipe', funcionario: 'Funcionário: edita o site'};
  conteudo().innerHTML = '<section class="caixa"><h2>Equipe</h2>' + (pessoas.length ? '<ul class="pessoas">' + pessoas.map(r => '<li><div><b>' + esc(mostrarUsuario(r.email)) + '</b><small>' + esc(nomes[r.papel] || r.papel) + '</small></div>' +
      (r.email !== email ? '<div><button class="bt" data-senha="' + esc(r.email) + '">Nova senha</button><button class="bt perigo" data-tirar="' + esc(r.email) + '">Tirar acesso</button></div>' : '<small>você</small>') + '</li>').join('') + '</ul>' : '<p class="nota">Ninguém cadastrado.</p>') + '</section>' +
    '<form class="caixa" data-add><h2>Cadastrar pessoa</h2><label>Nome de usuário (ex.: maria)<input name="usuario" required autocomplete="off" autocapitalize="none" spellcheck="false" pattern="[a-zA-Z0-9._\\-]{3,30}"></label>' +
    '<label>Senha inicial (mínimo 8)<input name="senha" type="text" minlength="8" required autocomplete="off"></label>' +
    (orbita ? '<label>Função<select name="papel"><option value="funcionario">Funcionário</option><option value="dono">Dono</option></select></label>' : '') +
    '<button class="bt principal">Cadastrar</button><p class="nota">Passe o usuário, a senha e este endereço para a pessoa.</p></form>';
  const f = conteudo().querySelector('[data-add]');
  f.onsubmit = async e => {
    e.preventDefault(); const d = new FormData(f), bt = f.querySelector('button'); bt.disabled = true;
    try { await chamarEquipe({acao: 'adicionar', usuario: d.get('usuario'), senha: d.get('senha'), papel: d.get('papel') || 'funcionario'}); aviso('Pessoa cadastrada!'); telaEquipe(); }
    catch (err) { aviso(err.message, 'erro'); bt.disabled = false; }
  };
  conteudo().querySelectorAll('[data-tirar]').forEach(b => b.onclick = async () => {
    if (!confirm('Tirar o acesso de ' + mostrarUsuario(b.dataset.tirar) + '?')) return;
    try { await chamarEquipe({acao: 'remover', email: b.dataset.tirar}); aviso('Acesso retirado.'); telaEquipe(); } catch (err) { aviso(err.message, 'erro'); }
  });
  conteudo().querySelectorAll('[data-senha]').forEach(b => b.onclick = async () => {
    const senha = prompt('Nova senha para ' + mostrarUsuario(b.dataset.senha) + ' (mínimo 8 caracteres):'); if (!senha) return;
    if (senha.length < 8) return aviso('A senha precisa ter pelo menos 8 caracteres.', 'erro');
    try { await chamarEquipe({acao: 'senha', email: b.dataset.senha, senha}); aviso('Senha trocada.'); } catch (err) { aviso(err.message, 'erro'); }
  });
}

// ---------- minha senha ----------
function telaConta() {
  conteudo().innerHTML = '<form class="caixa" data-senha-form><h2>Trocar minha senha</h2><label>Nova senha<input name="s1" type="password" minlength="8" autocomplete="new-password" required></label><label>Repita<input name="s2" type="password" minlength="8" autocomplete="new-password" required></label><button class="bt principal">Salvar</button></form>';
  conteudo().querySelector('[data-senha-form]').onsubmit = async e => {
    e.preventDefault(); const d = new FormData(e.target);
    if (d.get('s1') !== d.get('s2')) return aviso('As duas senhas não são iguais.', 'erro');
    const {error} = await sb.auth.updateUser({password: d.get('s1')});
    aviso(error ? 'Não foi possível trocar: ' + error.message : 'Senha trocada!', error ? 'erro' : 'ok'); if (!error) e.target.reset();
  };
}

iniciar();
