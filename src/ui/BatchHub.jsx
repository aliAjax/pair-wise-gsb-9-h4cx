// 界面层：批次导出中心（批次列表 / 新建批次）。
import React, { useMemo, useState } from 'react';
import { STYLES, MISSING_STRATEGIES, LANGUAGES, validateBatchSetup } from '../data/storage.js';
import { buildManifest } from '../export/citation.js';

export default function BatchHub({ state, onCreate, onOpen }) {
  const [cfg, setCfg] = useState({
    name: '', style: 'gbt', language: 'zh', missingStrategy: 'placeholder', memberIds: []
  });
  const [error, setError] = useState('');

  const toggle = id => setCfg(c => ({
    ...c,
    memberIds: c.memberIds.includes(id) ? c.memberIds.filter(x => x !== id) : [...c.memberIds, id]
  }));

  const submit = () => {
    const errs = validateBatchSetup(cfg);
    if (!cfg.memberIds.length) errs.push('请至少选择一篇文献');
    if (errs.length) { setError(errs.join('；')); return; }
    onCreate(cfg);
  };

  // 即时预览规模：合并后条目数 / 缺失数（不落盘，纯展示）
  const preview = useMemo(() => {
    if (!cfg.memberIds.length) return null;
    const recs = cfg.memberIds.map(id => state.records.find(r => r.id === id)).filter(Boolean);
    const m = buildManifest(recs, cfg);
    return {
      groups: m.groups.length,
      missing: m.groups.filter(g => g.current.issues.length).length,
      truncated: m.groups.filter(g => g.current.authorTruncated).length,
      merged: m.groups.filter(g => g.aliases.length > 0).length,
      omitted: m.omitted.length
    };
  }, [cfg, state.records]);

  return (
    <div className="hub">
      <section className="hub-batches">
        <h3>导出批次</h3>
        <p className="muted">批次冻结后文本不可更改；任何修改都以「带原因修订」追加到修订链。</p>
        <div className="batch-cards">
          {state.batches.map(b => (
            <button key={b.id} className={'batch-card ' + (b.frozen ? 'frozen' : 'draft')} onClick={() => onOpen(b.id)}>
              <div className="batch-card-top">
                <strong>{b.name}</strong>
                <span className="badge">{b.frozen ? '已冻结' : '草稿'}</span>
              </div>
              <div className="batch-card-meta">
                {STYLES.find(s => s.id === b.style)?.name} · {LANGUAGES.find(l => l.id === b.language)?.name}
                {' · '}{MISSING_STRATEGIES.find(m => m.id === b.missingStrategy)?.name}
              </div>
              <div className="batch-card-foot">
                <span>{b.memberIds.length} 篇入选</span>
                <span>{b.revisions.length} 条修订</span>
                {b.frozen && <span className="frozen-at">冻结于 {new Date(b.frozenAt).toLocaleString('zh-CN')}</span>}
              </div>
            </button>
          ))}
          {!state.batches.length && <div className="no-result">还没有批次，请在右侧登记新批次。</div>}
        </div>
      </section>

      <section className="hub-new">
        <h3>登记新批次</h3>
        <label>批次名称
          <input value={cfg.name} onChange={e => setCfg({ ...cfg, name: e.target.value })}
            placeholder="例如：学位论文参考文献" />
        </label>
        <div className="cfg-grid">
          <label>引用样式
            <select value={cfg.style} onChange={e => setCfg({ ...cfg, style: e.target.value })}>
              {STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>登记语言
            <select value={cfg.language} onChange={e => setCfg({ ...cfg, language: e.target.value })}>
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="strategy-box">
          <legend>缺失策略（关键信息缺失时如何处理）</legend>
          {MISSING_STRATEGIES.map(m => (
            <label key={m.id} className="radio-row">
              <input type="radio" name="strategy" checked={cfg.missingStrategy === m.id}
                onChange={() => setCfg({ ...cfg, missingStrategy: m.id })} />
              <span><strong>{m.name}</strong><small>{m.desc}</small></span>
            </label>
          ))}
        </fieldset>

        <div className="pick-list">
          <small>勾选文献（同 DOI 自动合并并保留别名）</small>
          {state.records.map(r => (
            <label key={r.id} className={'pick-row ' + (cfg.memberIds.includes(r.id) ? 'on' : '')}>
              <input type="checkbox" checked={cfg.memberIds.includes(r.id)} onChange={() => toggle(r.id)} />
              <span className="pick-title">{r.title || '（无题）'}</span>
              <span className="pick-meta">{r.year || '缺年份'} · {typeName(r.type)}
                {r.doi ? '' : ' · 无 DOI'}</span>
            </label>
          ))}
        </div>

        {preview && (
          <div className="preview-stat">
            <span>合并后 <b>{preview.groups}</b> 条</span>
            <span>含占位 <b>{preview.missing}</b></span>
            <span>作者截断 <b>{preview.truncated}</b></span>
            <span>DOI 合并 <b>{preview.merged}</b></span>
            {cfg.missingStrategy === 'omit' && <span>将跳过 <b>{preview.omitted}</b></span>}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <button className="primary full" onClick={submit}>建立批次（草稿）</button>
      </section>
    </div>
  );
}

function typeName(t) {
  return { journal: '期刊', book: '图书', conference: '会议' }[t] || t;
}
