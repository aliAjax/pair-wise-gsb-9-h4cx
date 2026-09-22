// 导出层：DOI 合并 → 缺失检查 → 按样式渲染。
// 纯函数、无 DOM、无依赖。任何缺失字段都不做推断或补全，只渲染占位。
import { requiredFields, splitAuthors } from '../validation/rules.js';

const PH = (zh, en, lang) => lang === 'zh' ? `［缺：${zh}］` : `[missing: ${en}]`;

// ---------------- DOI 合并 ----------------
// 同一（规范化后的）DOI 合并为一组；按输入顺序最早出现的记录为主记录，
// 其余记录进入 aliases，其题名/作者/来源写法原样保留为「别名」。
export function mergeByDoi(records) {
  const groups = [];
  const byDoi = new Map();
  for (const r of records) {
    const doi = normalizeDoi(r.doi);
    if (doi && byDoi.has(doi)) {
      groups[byDoi.get(doi)].aliases.push({ ...r });
    } else {
      const g = { id: 'g' + (groups.length + 1), doi, primary: { ...r }, aliases: [] };
      groups.push(g);
      if (doi) byDoi.set(doi, groups.length - 1);
    }
  }
  return groups;
}

export function normalizeDoi(d) {
  const m = String(d || '').trim().toLowerCase().match(/10\.\d{4,9}\/[^\s]+/);
  return m ? m[0].replace(/[).;，。]+$/, '') : '';
}

// ---------------- 缺失检查 ----------------
function fieldLabel(code, lang) {
  const map = {
    volume: ['卷', 'volume'], issue: ['期', 'issue'], pages: ['页码', 'pages'],
    publisher: ['出版社', 'publisher'], location: ['会议地点', 'conference location'],
    venue: ['来源出版物', 'venue'], title: ['题名', 'title'],
    authors: ['作者', 'author'], year: ['年份', 'year']
  };
  const [zh, en] = map[code] || [code, code];
  return PH(zh, en, lang);
}

function missingIssues(record, style, lang) {
  const issues = [];
  for (const code of requiredFields(record.type)) {
    if (!String(record[code] || '').trim()) issues.push({ code, placeholder: fieldLabel(code, lang) });
  }
  return issues;
}

const v = (r, k) => String(r[k] || '').trim();

// ---------------- 作者名解析与截断 ----------------
// 规则集中在 validation/rules.js（splitAuthors / 截断人数）；
// 本层只负责按样式组装字符串。
function initials(given) {
  const letters = given.replace(/[.]/g, '').split(/[\s-]+/).filter(Boolean);
  return letters.map(w => w[0].toUpperCase() + '.').join('').replace(/-/, '-');
}

function fmtSurnameInverted(name, lang) {
  const cjk = /[一-鿿]/.test(name);
  if (cjk) return name.replace(/\s+/g, '');
  const m = name.match(/^([^,]+),\s*(.+)$/);
  if (m) return `${m[1].trim()}, ${initials(m[2])}`;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.slice(-1)[0];
  const given = parts.slice(0, -1).join(' ');
  return `${last}, ${initials(given)}`;
}

function fmtGivenFirst(name) {
  const cjk = /[一-鿿]/.test(name);
  if (cjk) return name.replace(/\s+/g, '');
  const m = name.match(/^([^,]+),\s*(.+)$/);
  if (m) {
    // "Doe, Jane Mary" → "Jane Mary Doe"（GIVEN 段保留全名）
    return `${m[2].trim()} ${m[1].trim()}`;
  }
  return name.trim();
}

// 按样式截断作者，返回 { text, truncated, total, shown }。
export function formatAuthors(authors, style, lang) {
  const names = splitAuthors(authors);
  const total = names.length;
  if (!total) return { text: PH('作者', 'author', lang), truncated: false, total: 0, shown: 0 };
  const limit = style === 'gbt' ? 3 : style === 'apa' ? 20 : 2;
  const etAl = {
    gbt: lang === 'zh' ? '，等' : ', et al.',
    apa: ', et al.',
    mla: ', et al.'
  };

  if (total === 1) {
    const t = style === 'mla' ? fmtSurnameInverted(names[0], lang)
      : style === 'apa' ? fmtSurnameInverted(names[0], lang)
      : fmtGbtName(names[0], lang);
    return { text: t, truncated: false, total, shown: 1 };
  }
  if (total <= limit) {
    let text;
    if (style === 'gbt') {
      // GB/T：作者间逗号；3 人及以内全列
      text = names.map(n => fmtGbtName(n, lang)).join(lang === 'zh' ? '，' : ', ');
    } else if (style === 'apa') {
      const head = names.slice(0, -1).map(n => fmtSurnameInverted(n, lang)).join(', ');
      text = `${head}, & ${fmtSurnameInverted(names[total - 1], lang)}`;
    } else {
      // MLA：首位倒置，余者名前姓后
      text = `${fmtSurnameInverted(names[0], lang)}, ${names.slice(1).map(fmtGivenFirst).join(', ')}`;
    }
    return { text, truncated: false, total, shown: total };
  }
  // 超限：GB/T 列前 3；APA 列前 20；MLA 列首作者
  const shownCount = style === 'mla' ? 1 : limit;
  let text;
  if (style === 'gbt') text = names.slice(0, 3).map(n => fmtGbtName(n, lang)).join(lang === 'zh' ? '，' : ', ');
  else if (style === 'apa') text = names.slice(0, 20).map(n => fmtSurnameInverted(n, lang)).join(', ');
  else text = fmtSurnameInverted(names[0], lang);
  return { text: text + etAl[style], truncated: true, total, shown: shownCount };
}

// GB/T 7714：西文姓在前全大写、名缩写；中文姓名原样。
function fmtGbtName(name, lang) {
  const cjk = /[一-鿿]/.test(name);
  if (cjk) return name.replace(/\s+/g, '');
  const m = name.match(/^([^,]+),\s*(.+)$/);
  let surname, given;
  if (m) { surname = m[1].trim(); given = m[2].trim(); }
  else {
    const parts = name.trim().split(/\s+/);
    surname = parts.slice(-1)[0]; given = parts.slice(0, -1).join(' ');
  }
  return `${surname.toUpperCase()} ${initials(given)}`.trim();
}

// ---------------- 单条渲染 ----------------
const DOC_MARK = {
  gbt: { journal: '[J]', book: '[M]', conference: '[C]' },
  apa: { journal: null, book: null, conference: null },
  mla: { journal: null, book: null, conference: null }
};

export function renderGroupLine(group, batch) {
  const { style, language: lang } = batch;
  const r = group.primary;
  const issues = missingIssues(r, style, lang);
  const ph = code => (issues.find(i => i.code === code) || {}).placeholder || fieldLabel(code, lang);
  const authors = formatAuthors(r.authors, style, lang);

  let text;
  if (style === 'gbt') text = renderGbt(r, authors.text, ph, lang);
  else if (style === 'apa') text = renderApa(r, authors.text, ph, lang);
  else text = renderMla(r, authors.text, ph, lang);

  return {
    style, text,
    issues: issues.map(i => i.code),
    placeholders: issues.map(i => i.placeholder),
    authorTruncated: authors.truncated,
    authorTotal: authors.total,
    authorShown: authors.shown,
    merged: group.aliases.length > 0
  };
}

function renderGbt(r, authors, ph, lang) {
  const year = v(r, 'year') || ph('year');
  const title = v(r, 'title') || ph('title');
  const venue = v(r, 'venue') || ph('venue');
  const doi = groupDoiText(groupDoi(r), 'gbt', lang);
  if (r.type === 'journal') {
    const vol = v(r, 'volume') || ph('volume');
    const iss = v(r, 'issue') ? `(${v(r, 'issue')})` : `(${ph('issue')})`;
    const pg = v(r, 'pages') || ph('pages');
    return `${authors}. ${title}${DOC_MARK.gbt.journal}. ${venue}, ${year}, ${vol}${iss}: ${pg}.${doi}`;
  }
  if (r.type === 'book') {
    const pub = v(r, 'publisher') || ph('publisher');
    return `${authors}. ${title}${DOC_MARK.gbt.book}. ${pub}, ${year}.${doi}`;
  }
  const loc = v(r, 'location') || ph('location');
  const pg = v(r, 'pages') ? `: ${v(r, 'pages')}` : '';
  return `${authors}. ${title}${DOC_MARK.gbt.conference}//${venue}, ${loc}, ${year}${pg}.${doi}`;
}

function groupDoi(r) { return normalizeDoi(r.doi); }

function groupDoiText(doi, style, lang) {
  if (!doi) return '';
  if (style === 'gbt') return ` DOI:${doi}.`;
  if (style === 'apa') return ` https://doi.org/${doi}`;
  return ` doi: ${doi}`;
}

function renderApa(r, authors, ph, lang) {
  const year = v(r, 'year') || ph('year');
  const title = v(r, 'title') || ph('title');
  const venue = v(r, 'venue') || ph('venue');
  const doi = groupDoiText(groupDoi(r), 'apa', lang);
  if (r.type === 'journal') {
    let seg = ` ${venue}`;
    if (v(r, 'volume')) seg += `, ${v(r, 'volume')}`;
    else seg += `, ${ph('volume')}`;
    if (v(r, 'issue')) seg += `(${v(r, 'issue')})`;
    else seg += `(${ph('issue')})`;
    seg += v(r, 'pages') ? `, ${v(r, 'pages')}` : `, ${ph('pages')}`;
    seg += '.';
    return `${authors} (${year}). ${title}.${seg}${doi}`;
  }
  if (r.type === 'book') {
    const pub = v(r, 'publisher') || ph('publisher');
    return `${authors} (${year}). ${title}. ${pub}.${doi}`;
  }
  // 会议：APA proceedings 章节体例
  const loc = v(r, 'location') || ph('location');
  let tail = '';
  if (v(r, 'pages')) tail = `, pp. ${v(r, 'pages')}`;
  else tail = `, pp. ${ph('pages')}`;
  return `${authors} (${year}). ${title}. In ${venue} (${loc})${tail}.${doi}`;
}

function renderMla(r, authors, ph, lang) {
  const title = v(r, 'title') || ph('title');
  const venue = v(r, 'venue') || ph('venue');
  const year = v(r, 'year') || ph('year');
  const doi = groupDoiText(groupDoi(r), 'mla', lang);
  if (r.type === 'journal') {
    let seg = ` ${venue}`;
    seg += v(r, 'volume') ? `, vol. ${v(r, 'volume')}` : `, vol. ${ph('volume')}`;
    seg += v(r, 'issue') ? `, no. ${v(r, 'issue')}` : `, no. ${ph('issue')}`;
    seg += `, ${year}`;
    seg += v(r, 'pages') ? `, pp. ${v(r, 'pages')}` : `, pp. ${ph('pages')}`;
    seg += '.';
    return `${authors}. "${title}."${seg}${doi}`;
  }
  if (r.type === 'book') {
    const pub = v(r, 'publisher') || ph('publisher');
    return `${authors}. ${title}. ${pub}, ${year}.${doi}`;
  }
  const loc = v(r, 'location') || ph('location');
  let tail = '';
  if (v(r, 'pages')) tail = `, pp. ${v(r, 'pages')}`;
  else tail = `, pp. ${ph('pages')}`;
  return `${authors}. "${title}." ${venue}, ${loc}, ${year}${tail}.${doi}`;
}

// ---------------- 清单（manifest） ----------------
// 一份批次配置作用于一组记录，产出不可变清单：
// groups[].lines 永远包含全部三种样式（预览/切换样式都不丢文本），
// line.text 为当前样式渲染结果；exported 标记该条是否真正导出。
export function buildManifest(records, batch) {
  const merged = mergeByDoi(records);
  const groups = merged.map(g => {
    const lines = ['gbt', 'apa', 'mla'].map(style =>
      renderGroupLine(g, { ...batch, style }));
    const current = lines.find(l => l.style === batch.style);
    return { ...g, lines, current, exported: true, omittedReason: '' };
  });

  let omitted = [];
  if (batch.missingStrategy === 'omit') {
    for (const g of groups) {
      if (g.current.issues.length) {
        g.exported = false;
        g.omittedReason = g.current.issues
          .map(c => c === 'volume' ? '卷' : c === 'issue' ? '期' : c === 'pages' ? '页码'
            : c === 'publisher' ? '出版社' : c === 'location' ? '会议地点'
            : c === 'venue' ? '来源出版物' : c === 'title' ? '题名'
            : c === 'authors' ? '作者' : '年份')
          .join('、');
      }
    }
    omitted = groups.filter(g => !g.exported)
      .map(g => ({ id: g.id, title: g.primary.title || '（无题）', reason: g.omittedReason }));
  }

  return {
    builtAt: new Date().toISOString(),
    style: batch.style,
    language: batch.language,
    missingStrategy: batch.missingStrategy,
    groups,
    omitted
  };
}

export function renderText(manifest) {
  const header = {
    gbt: 'GB/T 7714-2015',
    apa: 'APA 7th Edition',
    mla: 'MLA 9th Edition'
  }[manifest.style];
  const lines = manifest.groups
    .filter(g => g.exported)
    .map((g, i) => `[${i + 1}] ${g.lines.find(l => l.style === manifest.style).text}`);
  if (manifest.omitted.length) {
    lines.push('', `— 按策略跳过 ${manifest.omitted.length} 条（缺失：字段已登记，未静默补全）—`);
    for (const o of manifest.omitted) lines.push(`# 跳过《${o.title}》：缺 ${o.reason}`);
  }
  return `# 引用批次导出 · ${header}\n${lines.join('\n')}`;
}

export { fieldLabel };
