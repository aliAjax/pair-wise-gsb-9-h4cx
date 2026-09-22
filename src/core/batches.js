// 批次模块：创建/冻结批次、冻结快照、修订链、刷新一致性比对
import { buildPreview, freezeText } from './citation.js';
import { missingFields } from './validators.js';

let seq = 0;
export const newBatchId = () => {
  seq += 1;
  return `B${Date.now().toString(36)}${seq}`;
};

export const draftBatch = (refs, config) => {
  const selected = refs.map((r) => r.id);
  const preview = buildPreview(refs, config);
  return {
    id: newBatchId(),
    config,
    refIds: selected,
    createdAt: new Date().toISOString(),
    frozen: false,
    // 冻结后填充
    frozenAt: null,
    frozenText: '',
    snapshot: null, // [{refId, title, doi, text, placeholders, authorAliases}]
    revisions: [], // {id, at, refId, field, before, after, reason}
  };
};

// 确认：冻结清单与占位项。返回错误说明或冻结后的批次
export function confirmFreeze(batch, refs) {
  const chosen = refs.filter((r) => batch.refIds.includes(r.id));
  const preview = buildPreview(chosen, batch.config);
  if (batch.config.missingStrategy === 'block' && preview.included.some((e) => e.blocked)) {
    const bad = preview.included.filter((e) => e.blocked).map((e) => {
      const r = refs.find((x) => x.id === e.refId);
      return `《${r?.title || e.refId}》缺少 ${e.missing.join('、')}`;
    });
    return { error: `缺失策略为"阻止冻结"，请先处理：${bad.join('；')}` };
  }
  if (!preview.included.length) return { error: '清单为空（条目可能全部被跳过），无法冻结。' };

  const snapshot = preview.included.map((e, i) => {
    const r = refs.find((x) => x.id === e.refId);
    return {
      refId: e.refId,
      order: batch.config.style === 'gbt' ? i + 1 : null,
      title: r?.title || '',
      doi: r?.doi || '',
      text: e.text,
      placeholders: e.missing.slice(),
      aliases: r?.aliases?.slice() || [],
    };
  });
  const skipped = preview.skipped.map((e) => ({ refId: e.refId, reason: e.reason }));
  return {
    batch: {
      ...batch,
      frozen: true,
      frozenAt: new Date().toISOString(),
      frozenText: freezeText(preview),
      snapshot,
      skipped,
    },
  };
}

/**
 * 冻结后修改只能走修订：在新文本版本上打补丁，原 frozenText 永不变更。
 * 每条修订必须带原因，形成链式记录。
 */
export function applyRevision(batch, refs, { refId, field, before, after, reason }) {
  if (!batch.frozen) return { error: '批次尚未冻结。' };
  if (!reason || !reason.trim()) return { error: '修订必须填写原因。' };
  const item = batch.snapshot.find((s) => s.refId === refId);
  if (!item) return { error: '该条目不在冻结清单中。' };
  const rev = {
    id: `R${batch.revisions.length + 1}`,
    at: new Date().toISOString(),
    refId,
    field,
    before: String(before ?? ''),
    after: String(after ?? ''),
    reason: reason.trim(),
  };
  const allRevs = batch.revisions.concat(rev);

  // 以当前文献库为基准重新渲染，再叠加全部修订补丁（不污染原始文献数据）
  const patched = refs
    .filter((r) => batch.refIds.includes(r.id))
    .map((r) => {
      const applicable = allRevs.filter((x) => x.refId === r.id);
      const next = { ...r };
      applicable.forEach((x) => {
        if (x.field in next && x.after.trim() !== '') next[x.field] = x.after;
      });
      return next;
    });
  const preview = buildPreview(patched, batch.config);

  const newSnapshot = preview.included.map((e, i) => {
    const orig = batch.snapshot.find((s) => s.refId === e.refId);
    const r = refs.find((x) => x.id === e.refId);
    return {
      refId: e.refId,
      order: batch.config.style === 'gbt' ? i + 1 : null,
      title: r?.title || '',
      doi: r?.doi || '',
      text: e.text,
      placeholders: e.missing.slice(),
      aliases: r?.aliases?.slice() || [],
      // 仍保留占位：修订不得静默补全，除非该字段经修订显式赋值
      placeholderOpen: e.missing.filter((f) => !allRevs.some(
        (x) => x.refId === e.refId && x.field === f && x.after.trim(),
      )),
      origText: orig?.text || '',
    };
  });
  const nextText = preview.included.map((e) => e.text).join('\n');
  return {
    batch: {
      ...batch,
      revisions: [...batch.revisions, rev],
      currentSnapshot: newSnapshot,
      currentText: nextText,
      revisedAt: rev.at,
    },
  };
}

/**
 * 刷新一致性：比对冻结时文献与当前文献库。返回三类差异，均不自动改动冻结文本。
 */
export function driftReport(batch, refs) {
  if (!batch.frozen || !batch.snapshot) return { removed: [], changed: [], placeholdersStillOpen: [] };
  const removed = [];
  const changed = [];
  batch.snapshot.forEach((s) => {
    const r = refs.find((x) => x.id === s.refId);
    if (!r) { removed.push(s); return; }
    const newlyFilled = s.placeholders.filter(
      (f) => r[f] !== undefined && r[f] !== null && String(r[f]).trim() !== '',
    );
    const aliasesChanged = JSON.stringify(r.aliases || []) !== JSON.stringify(s.aliases);
    const missingChanged = JSON.stringify(missingFields(r).sort()) !== JSON.stringify(s.placeholders.sort());
    if (newlyFilled.length || aliasesChanged || missingChanged) {
      changed.push({ snapshot: s, ref: r, newlyFilled });
    }
  });
  return { removed, changed };
}

export function latestText(batch) {
  return batch.currentText !== undefined ? batch.currentText : batch.frozenText;
}
