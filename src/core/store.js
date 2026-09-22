// 数据层：文献与批次的持久化、DOI 合并、种子数据
import { STORE_KEYS, TYPES } from './schema.js';

// 旧库 cite 字段为 APA 式文本；迁移时据 venue 猜测类型，缺字段一律留空（不静默补全）
const rawSeed = [
  { id: 1, title: 'The Extended Mind', authors: 'Clark, A. & Chalmers, D.', year: 1998, venue: 'Analysis', tags: ['具身认知', '经典'], abstract: '本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。', status: '阅读中', doi: '10.1093/analys/58.1.7' },
  { id: 2, title: 'Situated Learning', authors: 'Lave, J. & Wenger, E.', year: 1991, venue: 'Cambridge University Press', tags: ['学习科学', '社会'], abstract: '学习发生在真实情境的参与过程中，知识与共同体实践不可分割。', status: '待读', publisher: 'Cambridge University Press', type: 'book', doi: '' },
  { id: 3, title: 'Designing with Data', authors: 'Miller, S.', year: 2022, venue: 'MIT Press', tags: ['设计研究', '方法'], abstract: '一套面向设计师的数据研究方法，讨论如何把定性洞察转化为可行动的设计决策。', status: '已读', publisher: 'MIT Press', type: 'book', doi: '' },
  //  deliberately incomplete references —— 预览中以占位呈现
  { id: 4, title: 'Attention Is All You Need', authors: 'Vaswani, A.; Shazeer, N.; Parmar, N.; Uszkoreit, J.; Jones, L.; Gomez, A. N.; Kaiser, Ł.; Polosukhin, I.', year: 2017, venue: 'NeurIPS', tags: ['机器学习'], abstract: '提出 Transformer 架构，完全基于注意力机制。', status: '已读', type: 'conference', location: '', doi: '10.48550/arXiv.1706.03762' },
  { id: 5, title: '延展认知的再审视', authors: '陈巍; 李恒威; 陈波; 王华', year: 2020, venue: '哲学研究', tags: ['具身认知'], abstract: '对延展认知论题的中文学术回应。', status: '待读', type: 'journal', volume: '', issue: '3', pages: '54-66', doi: '', lang: 'zh' },
];

const normDoi = (d) => (d || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

function normalizeRef(r) {
  const type = TYPES.includes(r.type)
    ? r.type
    : r.publisher
      ? 'book'
      : 'journal'; // 旧数据无 publisher 字段时按期刊处理，卷期页留空 → 占位
  return {
    id: r.id,
    title: r.title || '',
    authors: r.authors || '',
    year: r.year || '',
    venue: r.venue || '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    abstract: r.abstract || '',
    notes: r.notes || '',
    status: r.status || '待读',
    type,
    volume: r.volume ?? '',
    issue: r.issue ?? '',
    pages: r.pages ?? '',
    publisher: r.publisher ?? '',
    location: r.location ?? '',
    doi: normDoi(r.doi),
    aliases: Array.isArray(r.aliases) ? r.aliases : (r.aliasDoi ? [r.aliasDoi] : []),
    lang: r.lang === 'zh' ? 'zh' : 'en',
  };
}

export function loadRefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEYS.refs));
    const list = Array.isArray(raw) && raw.length ? raw : rawSeed;
    return list.map(normalizeRef);
  } catch {
    return rawSeed.map(normalizeRef);
  }
}

export function loadBatches() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEYS.batches)) || [];
  } catch {
    return [];
  }
}

export function saveRefs(refs) {
  localStorage.setItem(STORE_KEYS.refs, JSON.stringify(refs));
}

export function saveBatches(batches) {
  localStorage.setItem(STORE_KEYS.batches, JSON.stringify(batches));
}

/**
 * 同一 DOI 合并：后加入的重复条目并入既有条目，作者串作为别名保留。
 * 返回 { refs, merged: {intoId, alias} | null }
 */
export function mergeByDoi(refs, incoming) {
  const ref = normalizeRef(incoming);
  ref.doi = normDoi(ref.doi);
  if (!ref.doi) return { refs: [...refs, ref], merged: null };
  const existing = refs.find((r) => normDoi(r.doi) === ref.doi);
  if (!existing) {
    // 也可能与某个别名 DOI 相同
    const aliasHost = refs.find((r) => r.aliases.some((a) => normDoi(a) === ref.doi));
    if (!aliasHost) return { refs: [...refs, ref], merged: null };
    const alias = ref.authors && !aliasHost.aliases.includes(ref.authors) ? ref.authors : '';
    return {
      refs: refs.map((r) => (r.id === aliasHost.id && alias ? { ...r, aliases: [...r.aliases, alias] } : r)),
      merged: { intoId: aliasHost.id, alias },
    };
  }
  const aliases = new Set(existing.aliases);
  // 被合并条目的自身 DOI 作为别名 DOI 保留；作者串不同则作为作者别名
  if (incoming.doi && normDoi(incoming.doi) !== existing.doi) aliases.add(normDoi(incoming.doi));
  if (ref.authors && ref.authors !== existing.authors) aliases.add(ref.authors);
  return {
    refs: refs.map((r) => (r.id === existing.id ? { ...r, aliases: [...aliases] } : r)),
    merged: { intoId: existing.id, alias: ref.authors },
  };
}

export { normalizeRef, normDoi };
