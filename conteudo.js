// Conteúdo editável pelo painel do dono (painel/). Fica no banco "Órbita Sites", chave "textos".
// No HTML, o que pode mudar é marcado com:
//   data-editavel="chave" (texto; com data-linhas aceita quebra de linha),
//   data-whats="chave" (links wa.me), data-tel="chave" (links tel:; data-tel-texto também troca o texto),
//   data-mapa="chave" (link do Google Maps segue o endereço dessa chave),
//   data-pix (o campo da chave Pix; a chave copiada vem de "pix.chave" e "pix.tipo").
// Sem banco ou sem resposta, o site fica com o texto original do HTML (ou a última cópia salva no aparelho).
import {banco} from './config.js?v=1';

const CACHE = 'orbita-textos-' + banco.site;
const soDigitos = v => String(v || '').replace(/\D/g, '');
const foneBr = d => d.length === 11 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7) : '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
export function copiaPix(tipo, chave) {
  const d = soDigitos(chave);
  if (tipo === 'Celular') return '+55' + d.replace(/^55(?=\d{10,11}$)/, '');
  if (tipo === 'CPF' || tipo === 'CNPJ') return d;
  if (tipo === 'E-mail') return String(chave).trim().toLowerCase();
  return String(chave).trim();
}

function aplicar(t) {
  if (!t || typeof t !== 'object') return;
  const txt = k => typeof t[k] === 'string' && t[k].trim() ? t[k].trim().slice(0, 3000) : null;
  document.querySelectorAll('[data-editavel]').forEach(el => {
    const v = txt(el.dataset.editavel); if (v == null) return;
    if (el.hasAttribute('data-linhas')) el.replaceChildren(...v.split('\n').flatMap((l, i) => i ? [document.createElement('br'), document.createTextNode(l)] : [document.createTextNode(l)]));
    else el.textContent = v;
  });
  document.querySelectorAll('[data-whats]').forEach(el => {
    const d = soDigitos(t[el.dataset.whats]); if (d.length < 10 || d.length > 13) return;
    el.href = el.href.replace(/wa\.me\/\d+/, 'wa.me/' + (d.length <= 11 ? '55' + d : d));
  });
  document.querySelectorAll('[data-tel]').forEach(el => {
    let d = soDigitos(t[el.dataset.tel]); if (d.length > 11) d = d.replace(/^55/, ''); if (d.length < 10 || d.length > 11) return;
    el.href = 'tel:+55' + d; if (el.hasAttribute('data-tel-texto')) el.textContent = foneBr(d);
  });
  document.querySelectorAll('[data-mapa]').forEach(el => {
    const v = txt(el.dataset.mapa); if (v == null) return;
    el.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.replace(/\s*\n\s*/g, ', '));
  });
  if (document.querySelector('[data-pix]') && txt('pix.chave')) window.CHAVE = copiaPix(txt('pix.tipo') || 'Celular', txt('pix.chave'));
}

try { aplicar(JSON.parse(localStorage.getItem(CACHE) || 'null')); } catch {}
(async () => {
  if (!banco.url || !banco.chave || !banco.site) return;
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(banco.url + '/rest/v1/ajustes?select=dados&chave=eq.textos&site=eq.' + encodeURIComponent(banco.site), {headers: {apikey: banco.chave, Authorization: 'Bearer ' + banco.chave}, signal: ctl.signal});
    clearTimeout(tm); if (!r.ok) return;
    const t = (await r.json())[0]?.dados || {};
    try { localStorage.setItem(CACHE, JSON.stringify(t)); } catch {}
    aplicar(t);
  } catch {}
})();
