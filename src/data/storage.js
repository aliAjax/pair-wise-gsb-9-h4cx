// 数据层：持久化与批次状态机（冻结 / 修订）。
// 本模块不认识引用样式，也不生成引用文本；冻结文本由导出层算好后整体存入，
// 因此「刷新后批次、冻结文本和修订链一致」由单一 JSON 状态天然保证。
import { seedRecords, seedBatches } from './seed.js';
import { buildManifest, renderText } from '../export/citation.js';
import { FIELD_NAMES } from '../validation/rules.js';

const KEY = 'research-library-v2';

export function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadState() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.records) && Array.isArray(s.batches)) return s;
    }
  } catch {
    /* 存储损坏时回落到种子，绝不静默改写用户数据 */
  }
  return { records: seedRecords, batches: seedBatches, seq: 100 };
}

export function saveState(state) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state));
}

export const emptyRecord = () => ({
  id: '', type: 'journal',
  title: '', authors: '', year: '', venue: '',
  volume: '', issue: '', pages: '',
  publisher: '', location: '',
  doi: '', language: 'zh',
  tags: [], status: '待读', abstract: '', notes: ''
});

// ---- 批次配置校验（缺失策略与样式、语言的合法组合）----
export const STYLES = [
  { id: 'gbt', name: 'GB/T 7714-2015' },
  { id: 'apa', name: 'APA 7th' },
  { id: 'mla', name: 'MLA 9th' }
];
export const MISSING_STRATEGIES = [
  { id: 'placeholder', name: '保留占位符', desc: '缺失项以 [缺：xxx] 原样进入导出' },
  { id: 'omit', name: '整体跳过', desc: '存在关键缺失的文献不进入导出，逐条登记原因' },
  { id: 'block', name: '阻止确认', desc: '存在缺失即不允许冻结批次' }
];
export const LANGUAGES = [
  { id: 'zh', name: '中文' },
  { id: 'en', name: 'English' }
];

export function validateBatchSetup(cfg) {
  const errors = [];
  if (!STYLES.some(s => s.id === cfg.style)) errors.push('引用样式不合法');
  if (!MISSING_STRATEGIES.some(m => m.id === cfg.missingStrategy)) errors.push('缺失策略不合法');
  if (!LANGUAGES.some(l => l.id === cfg.language)) errors.push('登记语言不合法');
  if (!String(cfg.name || '').trim()) errors.push('批次名称不能为空');
  return errors;
}

// ---- 冻结 ----
// 冻结时把「配置 + 成员快照 + DOI 合并结果 + 逐条渲染文本」全部落盘，
// 之后文献再被编辑也不会影响已冻结文本。
export function freezeBatch(state, batchId) {
  const batch = state.batches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');
  if (batch.frozen) throw new Error('批次已冻结，不能重复确认');

  const memberRecords = batch.memberIds
    .map(id => state.records.find(r => r.id === id))
    .filter(Boolean)
    .map(r => ({ ...r }));
  const manifest = buildManifest(memberRecords, batch);

  if (batch.missingStrategy === 'block' && manifest.groups.some(g => g.current.issues.length)) {
    const reasons = manifest.groups
      .filter(g => g.current.issues.length)
      .map(g => `${g.primary.title || '（无题）'}：${g.current.issues.map(c => FIELD_NAMES[c]?.zh || c).join('、')}`);
    throw new Error('存在缺失项，按「阻止确认」策略不能冻结：\n' + reasons.join('\n'));
  }

  const frozenAt = new Date().toISOString();
  return {
    ...state,
    batches: state.batches.map(b => b.id === batchId
      ? { ...b, frozen: true, frozenAt, frozenText: renderText(manifest), frozenManifest: manifest }
      : b)
  };
}

// ---- 修订 ----
// 已冻结批次只许通过「带原因的修订」改变；修订链按顺序追加，永不删除。
// reason 必填；patch 只允许触碰白名单字段，且不允许把已有值静默改成空。
export const PATCHABLE_FIELDS = ['title', 'authors', 'year', 'venue', 'volume', 'issue', 'pages',
  'publisher', 'location', 'doi', 'language'];
const PATCHABLE = PATCHABLE_FIELDS;

export function createRevision(state, batchId, groupId, field, value, reason) {
  const batch = state.batches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');
  if (!batch.frozen) throw new Error('批次未冻结，不能登记修订');
  if (!PATCHABLE.includes(field)) throw new Error('该字段不允许通过修订修改');
  if (!String(reason || '').trim()) throw new Error('修订必须填写原因');

  const group = batch.frozenManifest?.groups.find(g => g.id === groupId);
  if (!group) throw new Error('冻结清单中找不到该条目');

  const recordId = group.primary.id;
  const before = group.primary[field] ?? '';
  const after = String(value ?? '');
  if (before === after) throw new Error('字段未发生变化');
  if (before && !after) throw new Error('修订不得清空已有内容（缺失只能保持占位）');

  const revision = {
    id: uid('rv'), at: new Date().toISOString(),
    recordId, field, before, after, reason: reason.trim()
  };

  const records = state.records.map(r => r.id === recordId ? { ...r, [field]: after } : r);
  const batches = state.batches.map(b => {
    if (b.id !== batchId) return b;
    const manifest = reapplyRevisions(b, [...b.revisions, revision]);
    return { ...b, revisions: [...b.revisions, revision], frozenManifest: manifest, frozenText: renderText(manifest) };
  });
  return { ...state, records, batches };
}

// 依据修订链在冻结快照之上重放：冻结文本 = 冻结快照 + 全部已登记修订。
// 修订后缺失若被补齐，占位与问题项随之消失；这一切仍只来自「带原因的修订」。
function reapplyRevisions(batch, revisions) {
  const records = batch.frozenManifest.groups
    .flatMap(g => [g.primary, ...g.aliases])
    .map(r => ({ ...r }));
  for (const rv of revisions) {
    const r = records.find(x => x.id === rv.recordId);
    if (r) r[rv.field] = rv.after;
  }
  return buildManifest(records, batch);
}
