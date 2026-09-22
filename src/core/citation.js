// 导出层：按 GB/T 7714 / APA / MLA 渲染引用，占位不填补，冻结文本由本模块唯一生成。
import { formatAuthors, missingFields, PH } from './validators.js';

const LABELS = {
  en: { volume: 'vol.', issue: 'no.', pages: 'pp.', in: 'In' },
  zh: { volume: '卷', issue: '期', pages: '页', in: '见' },
};

const ph = (ref, field) => (ref[field] && String(ref[field]).trim() ? String(ref[field]).trim() : PH(field));

const withDoi = (text, doi, style) =>
  doi ? `${text} ${style === 'gbt' ? 'DOI:' : 'https://doi.org/'}${doi}.` : text;

function renderOne(ref, { style, lang }) {
  const a = formatAuthors(ref.authors, style, lang);
  const labels = LABELS[lang] || LABELS.en;
  const title = ref.title || PH('title');
  const year = ref.year || PH('year');
  const venue = ref.venue || PH('venue');
  let body;

  if (style === 'gbt') {
    if (ref.type === 'book') {
      body = `${a.rendered}. ${title}[M]. ${ph(ref, 'publisher')}, ${year}.`;
    } else if (ref.type === 'conference') {
      const pages = ph(ref, 'pages');
      body = `${a.rendered}. ${title}[C]// ${venue}. ${ph(ref, 'location')}, ${year}: ${pages}.`;
    } else {
      const vol = ph(ref, 'volume');
      const issue = ph(ref, 'issue');
      body = `${a.rendered}. ${title}[J]. ${venue}, ${year}, ${vol}(${issue}): ${ph(ref, 'pages')}.`;
    }
    return withDoi(body, ref.doi, style);
  }

  if (style === 'apa') {
    if (ref.type === 'book') {
      body = `${a.rendered} (${year}). ${title}. ${ph(ref, 'publisher')}.`;
    } else if (ref.type === 'conference') {
      body = `${a.rendered} (${year}). ${title}. ${labels.in} ${venue} (${labels.pages} ${ph(ref, 'pages')}), ${ph(ref, 'location')}.`;
    } else {
      const vol = ph(ref, 'volume');
      const issue = ph(ref, 'issue');
      body = `${a.rendered} (${year}). ${title}. ${venue}, ${vol}(${issue}), ${ph(ref, 'pages')}.`;
    }
    return withDoi(body, ref.doi, style);
  }

  // mla
  if (ref.type === 'book') {
    body = `${a.rendered}. ${title}. ${ph(ref, 'publisher')}, ${year}.`;
  } else if (ref.type === 'conference') {
    body = `${a.rendered}. "${title}." ${venue}, ${ph(ref, 'location')}, ${year}, ${labels.pages} ${ph(ref, 'pages')}.`;
  } else {
    body = `${a.rendered}. "${title}." ${venue}, ${labels.volume} ${ph(ref, 'volume')}, ${labels.issue} ${ph(ref, 'issue')}, ${year}, ${labels.pages} ${ph(ref, 'pages')}.`;
  }
  return withDoi(body, ref.doi, style);
}

export const PLACEHOLDER_RE = /⟦[^⟧]+⟧/;

// 供界面高亮：把文本拆为普通片段与占位片段
export function toSegments(text) {
  return text.split(/(⟦[^⟧]+⟧)/).filter((s) => s !== '').map((s) => ({
    text: s,
    placeholder: PLACEHOLDER_RE.test(s),
  }));
}

/**
 * 生成预览（不修改数据）。missingStrategy:
 *  keep  —— 缺失条目照常输出，占位保留在文本中
 *  skip  —— 缺失条目移入 skipped，附缺失字段原因
 *  block —— 缺失条目照常输出，但标记 blocked，冻结时将被拒绝
 */
export function buildPreview(refs, config) {
  const included = [];
  const skipped = [];
  refs.forEach((ref) => {
    const missing = missingFields(ref);
    const authorInfo = formatAuthors(ref.authors, config.style, config.lang);
    const base = { refId: ref.id, missing, authorInfo };
    if (missing.length && config.missingStrategy === 'skip') {
      skipped.push({ ...base, reason: `缺少：${missing.join(', ')}` });
      return;
    }
    const text = renderOne(ref, { ...config });
    included.push({
      ...base,
      text,
      blocked: missing.length > 0, // block 策略下禁止冻结；keep 策略下仅提示
    });
  });
  const numbered = included.map((e, i) =>
    config.style === 'gbt' ? { ...e, text: `[${i + 1}] ${e.text}` } : e,
  );
  return { included: numbered, skipped, canFreeze: !included.some((e) => e.blocked && config.missingStrategy === 'block') };
}

// 冻结文本：批次创建后不再随文献改动而变化
export function freezeText(preview) {
  return preview.included.map((e) => e.text).join('\n');
}

export function downloadText(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
