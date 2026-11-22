// Checks that the Kazakh copy changed only text: every kk/js file must have the same code as its Russian source once comments
// and string literals are taken out. A template literal keeps its ${…} code, in any order (Kazakh word order may move it).
// Usage: node src/kk/code-check.js   Prints each difference with the lines in both files; exit code 1 if there is any.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['blocks', 'core', 'examples', 'lesson', 'program', 'robot', 'scenes', 'sim', 'vm'];

// The only code the copy may change, as [Russian code, Kazakh code], compared as tokens (strings are placeholders).
// blocks.js: as week 10's copy. msg_kk.js defines ScratchMsgsKk; Kazakh fixes on top of Scratch's own Kazakh strings;
// three long category names wrap in the narrow palette column instead of the Russian «Дополнительные моторы».
const ALLOW = {
  blocks: [
    ['Blockly.ScratchMsgsRu', 'Blockly.ScratchMsgsKk'],
    ["CLEAN_UP: '',", "CLEAN_UP: '', OPERATORS_MOD: '', OPERATORS_MATHOP: '', OPERATORS_MATHOP_FLOOR: '', OPERATORS_MATHOP_CEILING: '',"
      + " SOUND_EFFECTS_PITCH: '', SOUND_CHANGEEFFECTBY: '', SOUND_SETEFFECTO: '', SOUND_CLEAREFFECTS: '', SOUND_CHANGEVOLUMEBY: '',"
      + " SOUND_VOLUME: '', EVENT_BROADCAST: '', EVENT_BROADCASTANDWAIT: '', NEW_BROADCAST_MESSAGE: '', DATA_SETVARIABLETO: '',"
      + " DATA_CHANGEVARIABLEBY: '', DATA_ADDTOLIST: '', DATA_DELETEOFLIST: '', DATA_DELETEALLOFLIST: '', DATA_INSERTATLIST: '',"
      + " DATA_REPLACEITEMOFLIST: '', DATA_ITEMOFLIST: '', DATA_ITEMNUMOFLIST: '', DATA_LENGTHOFLIST: '', DATA_LISTCONTAINSITEM: '',"
      + " PROCEDURES_DEFINITION: '', CATEGORY_VARIABLES: '', NEW_VARIABLE_TITLE: '', DELETE_VARIABLE_CONFIRMATION: '', PROCEDURE_USED: '',"],
    ["[[5, ''], [8, ''], [10, '']].forEach(([i, name]) => { const label = workspace.toolbox_.categoryMenu_.categories_[i].label_;"
      + " label.textContent = name; label.style.whiteSpace = ''; });",
      "[[7, ''], [8, ''], [9, '']].forEach(([i, name]) => { const label = workspace.toolbox_.categoryMenu_.categories_[i].label_;"
      + " label.textContent = name; label.style.whiteSpace = ''; });"],
  ],
};

const TOKEN = /[A-Za-z_$\u00c0-\uffff][\w$\u00c0-\uffff]*|(?:0[xXbBoO][\da-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?|>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\+\+|--|[-+*/%&|^]=|\*\*|<<|>>|\S/y;
const NO_REGEX_AFTER = /^([\w$\u00c0-\uffff][\w$\u00c0-\uffff.]*|[)\]}'`])$/;
const KEYWORD = /^(return|typeof|case|in|of|new|delete|void|throw|else|do|instanceof|yield|await)$/;

// Code tokens {t, at}: comments dropped; a string, or a template without ${…}, is the token '; a template with ${…} is `
// followed by its expressions, sorted, each as ${ … }.
function tokens(s) {
  let i = 0;
  const scan = (nested) => {
    const out = [];
    let depth = 0;
    while (i < s.length) {
      const c = s[i], at = i;
      if (/\s/.test(c)) { i++; continue; }
      if (s.startsWith('//', i)) { i = s.indexOf('\n', i); if (i < 0) i = s.length; continue; }
      if (s.startsWith('/*', i)) { i = s.indexOf('*/', i + 2); i = i < 0 ? s.length : i + 2; continue; }
      if (c === '"' || c === "'") {
        for (i++; i < s.length && s[i] !== c; i += s[i] === '\\' ? 2 : 1);
        i++;
        out.push({ t: "'", at });
        continue;
      }
      if (c === '`') { out.push(...template()); continue; }
      const last = out.length ? out[out.length - 1].t : '';
      if (c === '/' && (!NO_REGEX_AFTER.test(last) || KEYWORD.test(last))) {
        let cls = false;
        for (i++; i < s.length && (cls || s[i] !== '/'); i++) {
          if (s[i] === '\\') i++;
          else if (s[i] === '[') cls = true;
          else if (s[i] === ']') cls = false;
        }
        for (i++; /[a-z]/.test(s[i] || ''); i++);
        out.push({ t: s.slice(at, i), at });
        continue;
      }
      if (c === '{') depth++;
      if (c === '}' && !depth-- && nested) { i++; return out; }
      TOKEN.lastIndex = i;
      const t = TOKEN.exec(s)[0];
      i += t.length;
      out.push({ t, at });
    }
    return out;
  };
  const template = () => {
    const at = i, groups = [];
    for (i++; i < s.length && s[i] !== '`'; i++) {
      if (s[i] === '\\') i++;
      else if (s[i] === '$' && s[i + 1] === '{') { i += 2; groups.push(scan(true)); i--; }
    }
    i++;
    if (!groups.length) return [{ t: "'", at }];
    const key = (g) => g.map((x) => x.t).join(' ');
    groups.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    return [{ t: '`', at }, ...groups.flatMap((g) => [{ t: '${', at }, ...g, { t: '}', at }])];
  };
  return scan(false);
}

// Puts the allowed Kazakh code back to its Russian form, so only other changes remain.
function allow(kk, pairs) {
  for (const [ru, k] of pairs) {
    const from = tokens(k), to = tokens(ru);
    for (let j = 0; j + from.length <= kk.length; j++) {
      if (from.some((x, n) => x.t !== kk[j + n].t)) continue;
      kk.splice(j, from.length, ...to.map((x) => ({ t: x.t, at: kk[j].at })));
      j += to.length - 1;
    }
  }
  return kk;
}

// Differences as [ru from, ru to, kk from, kk to]: after each one, the next 8 tokens agree again.
function diff(a, b) {
  const out = [];
  const same = (x, y) => { for (let n = 0; n < 8; n++) if ((a[x + n] || {}).t !== (b[y + n] || {}).t) return false; return true; };
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].t === b[j].t) { i++; j++; continue; }
    let next = null;
    for (let d = 1; d < 3000 && !next; d++) for (let x = 0; x <= d; x++) if (same(i + x, j + d - x)) { next = [i + x, j + d - x]; break; }
    if (!next) next = [a.length, b.length];
    out.push([i, next[0], j, next[1]]);
    [i, j] = next;
  }
  return out;
}

const line = (s, at) => s.slice(0, at).split('\n').length;
const show = (list, from, to) => list.slice(from, Math.min(to, from + 14)).map((x) => x.t).join(' ') + (to - from > 14 ? ' …' : '') || '(nothing)';

let bad = 0;
for (const f of FILES) {
  const ruFile = `js/${f}.js`, kkFile = `kk/js/${f}.js`;
  if (!fs.existsSync(path.join(ROOT, kkFile))) { console.log(`${kkFile}: missing`); bad++; continue; }
  const ru = fs.readFileSync(path.join(ROOT, ruFile), 'utf8'), kk = fs.readFileSync(path.join(ROOT, kkFile), 'utf8');
  const a = tokens(ru), b = allow(tokens(kk), ALLOW[f] || []);
  for (const [i, i2, j, j2] of diff(a, b)) {
    bad++;
    const at = (list, n, s) => (list[n] || list[list.length - 1] || { at: s.length }).at;
    console.log(`\n${kkFile}:${line(kk, at(b, j, kk))} (${ruFile}:${line(ru, at(a, i, ru))}), after: ${show(a, Math.max(0, i - 5), i)}`);
    console.log(`  Russian: ${show(a, i, i2)}`);
    console.log(`  Kazakh:  ${show(b, j, j2)}`);
  }
}
console.log(bad ? `\n${bad} code differences: only text may change` : 'Code is the same as in the Russian files.');
process.exitCode = bad ? 1 : 0;
