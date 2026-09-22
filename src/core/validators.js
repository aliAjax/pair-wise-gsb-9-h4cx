// 校验层：必填检测、作者解析与按样式截断。只做规则判断，不补任何数据。
import { AUTHOR_RULES, REQUIRED_FIELDS } from './schema.js';

export const PH = (field) => `⟦${field}⟧`; // 占位标记，界面高亮、导出原样保留

export const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

const COMMON_REQUIRED = ['title', 'authors', 'year'];

export function missingFields(ref) {
  const fields = [...COMMON_REQUIRED, ...(REQUIRED_FIELDS[ref.type] || [])];
  return [...new Set(fields)].filter((f) => isBlank(ref[f]));
}

// 支持 ; ； & 与 " and " 分隔；中文顿号/逗号同样切分
export function parseAuthors(str = '') {
  return String(str)
    .replace(/[；，、]/g, ';')
    .split(/\s*[;&]\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const hasHan = (s) => /[一-鿿]/.test(s);

function gbtName(name, zh) {
  if (zh || hasHan(name)) return name;
  const [last, initials = ''] = name.split(',').map((s) => s.trim());
  return `${last.toUpperCase()} ${initials.replace(/\./g, '').replace(/\s+/g, ' ')}`.trim();
}

function invertName(name) {
  // "Last, A. B." -> "A. B. Last"
  if (hasHan(name) || !name.includes(',')) return name;
  const [last, first = ''] = name.split(',').map((s) => s.trim());
  return `${first} ${last}`.trim();
}

/**
 * 按样式截断作者。返回 { rendered, count, truncated, omitted }
 * 超限只截断，不伪造作者；et al. 文案随语言。
 */
export function formatAuthors(authorsStr, style, lang = 'en') {
  const names = parseAuthors(authorsStr);
  const count = names.length;
  const zh = lang === 'zh' || names.some(hasHan);
  const etc = zh ? '等' : style === 'apa' ? 'et al.' : style === 'mla' ? 'et al.' : 'et al';

  if (style === 'gbt') {
    const { max } = AUTHOR_RULES.gbt;
    const shown = names.slice(0, max).map((n) => gbtName(n, zh));
    const truncated = count > max;
    // 全中文名单用全角顿号/逗号；拉丁名单沿用 GB/T 西文惯例 ", "
    const allZh = names.every((n) => hasHan(n));
    const sep = allZh ? '，' : ', ';
    const rendered = truncated ? shown.join(sep) + sep + etc : shown.join(sep);
    return { rendered, count, truncated, omitted: truncated ? count - max : 0, names };
  }

  if (style === 'apa') {
    if (count > AUTHOR_RULES.apa.max) {
      const head = names.slice(0, AUTHOR_RULES.apaOver.head);
      const tail = names[count - 1];
      return { rendered: `${head.join(', ')}, … ${tail}`, count, truncated: true, omitted: count - AUTHOR_RULES.apaOver.head - 1, names };
    }
    return { rendered: joinApa(names), count, truncated: false, omitted: 0, names };
  }

  // mla
  const { max } = AUTHOR_RULES.mla;
  if (count > max) {
    return { rendered: `${names[0]}, ${etc}`, count, truncated: true, omitted: count - 1, names };
  }
  if (count === 1) return { rendered: names[0], count, truncated: false, omitted: 0, names };
  if (count === 2) return { rendered: `${names[0]}, and ${invertName(names[1])}`, count, truncated: false, omitted: 0, names };
  const rest = names.slice(1).map(invertName);
  return { rendered: `${names[0]}, ${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}`, count, truncated: false, omitted: 0, names };
}

function joinApa(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

// 检查批次配置本身是否合法
export function validateConfig({ style, lang, missingStrategy }) {
  const problems = [];
  if (!['gbt', 'apa', 'mla'].includes(style)) problems.push('未知引用样式');
  if (!['zh', 'en'].includes(lang)) problems.push('未知语言');
  if (!['keep', 'skip', 'block'].includes(missingStrategy)) problems.push('未知缺失策略');
  return problems;
}
