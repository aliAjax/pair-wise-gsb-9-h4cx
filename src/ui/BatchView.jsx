import React, { useEffect, useMemo, useState } from 'react';
import { LANG_META, MISSING, MISSING_STRATEGIES, STYLE_META, STYLES, TYPE_META } from '../core/schema.js';
import { buildPreview, downloadText, toSegments } from '../core/citation.js';
import { applyRevision, confirmFreeze, draftBatch, driftReport } from '../core/batches.js';
import { missingFields } from '../core/validators.js';

function CiteText({ text }) {
  return <>{toSegments(text).map((seg, i) => (seg.placeholder
    ? <mark key={i} className="ph" title="缺失字段占位，未静默补全">{seg.text}</mark>
    : seg.text))}</>;
}

export default function BatchView({ refs, batches, setBatches, notify }) {
  const [config, setConfig] = useState({ style: 'gbt', lang: 'zh', missingStrategy: 'keep' });
  const [checked, setChecked] = useState(() => new Set(refs.map((r) => r.id)));
  const [activeId, setActiveId] = useState(null);
  const [revFor, setRevFor] = useState(null); // {refId, field}
  const [revForm, setRevForm] = useState({ after: '', reason: '' });

  const chosen = refs.filter((r) => checked.has(r.id));
  const preview = useMemo(() => buildPreview(chosen, config), [chosen, config]);

  const active = batches.find((b) => b.id === activeId) || null;
  const drift = active ? driftReport(active, refs) : null;

  // 查看草稿时，编辑器跟随该草稿的配置与清单；新建配置不影响已冻结批次
  useEffect(() => {
    if (active && !active.frozen) {
      setConfig(active.config);
      setChecked(new Set(active.refIds));
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncDraft = () => {
    if (!active || active.frozen) return;
    setBatches(batches.map((b) => (b.id === active.id
      ? { ...b, config, refIds: refs.filter((r) => checked.has(r.id)).map((r) => r.id) }
      : b)));
    notify('草稿配置与清单已更新（尚未冻结）');
  };

  const toggle = (id) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const create = () => {
    const batch = draftBatch(refs, config);
    batch.refIds = refs.filter((r) => checked.has(r.id)).map((r) => r.id);
    setBatches([...batches, batch]);
    setActiveId(batch.id);
    notify('批次已创建：清单待确认，点击"确认并冻结"生效');
  };

  const freeze = () => {
    if (!active || active.frozen) return;
    const res = confirmFreeze(active, refs);
    if (res.error) { notify(res.error); return; }
    setBatches(batches.map((b) => (b.id === active.id ? res.batch : b)));
    notify('清单与占位项已冻结：后续修改将走带原因的修订');
  };

  const exportTxt = (text, name) => {
    downloadText(name, text);
    notify('已导出冻结文本（占位原样保留）');
  };

  const openRevision = (snap, field) => {
    const r = refs.find((x) => x.id === snap.refId);
    setRevFor({ refId: snap.refId, field, title: snap.title });
    setRevForm({ after: r && r[field] != null ? String(r[field]) : '', reason: '' });
  };

  const submitRevision = () => {
    const res = applyRevision(active, refs, {
      refId: revFor.refId,
      field: revFor.field,
      after: revForm.after,
      reason: revForm.reason,
    });
    if (res.error) { notify(res.error); return; }
    setBatches(batches.map((b) => (b.id === active.id ? res.batch : b)));
    setRevFor(null);
    notify(`修订 ${revFor.field} 已追加到修订链`);
  };

  return (
    <div className="batch-wrap">
      <div className="batch-col batch-left">
        <div className="batch-card">
          <h3>批次配置 <span>BATCH CONFIG</span></h3>
          <label>引用样式
            <select value={config.style} onChange={(e) => setConfig({ ...config, style: e.target.value })}>
              {STYLES.map((s) => <option key={s} value={s}>{STYLE_META[s].name} — {STYLE_META[s].full}</option>)}
            </select>
          </label>
          <label>登记语言
            <div className="seg">
              {Object.entries(LANG_META).map(([k, m]) => (
                <button key={k} className={config.lang === k ? 'on' : ''} onClick={() => setConfig({ ...config, lang: k })}>{m.label}</button>
              ))}
            </div>
          </label>
          <label>缺失策略 <small>卷期页 / 出版社 / 会议地点缺失时</small>
            <div className="seg vert">
              {MISSING_STRATEGIES.map((m) => (
                <button key={m.id} className={config.missingStrategy === m.id ? 'on' : ''} onClick={() => setConfig({ ...config, missingStrategy: m.id })}>
                  <strong>{m.zh}</strong><span>{m.en}</span>
                </button>
              ))}
            </div>
          </label>
          <p className="hint">任何字段都不会被静默补全；缺失位置保留 <code>⟦field⟧</code> 占位。作者超限时按所选样式自动截断（GB/T 3 位+等、APA 20 位规则、MLA 3 位+et al.）。</p>
          {active && !active.frozen
            ? <button className="primary full" onClick={syncDraft}>↻ 更新草稿 {active.id} 的配置与清单</button>
            : <button className="primary full" onClick={create}>＋ 创建批次</button>}
        </div>

        <div className="batch-card">
          <h3>批次记录 <span>{batches.length} BATCHES</span></h3>
          {batches.length === 0 && <p className="hint">尚无批次。</p>}
          {batches.map((b) => (
            <button key={b.id} className={'batch-item ' + (activeId === b.id ? 'on' : '')} onClick={() => setActiveId(b.id)}>
              <div><strong>{b.id}</strong> {STYLE_META[b.config.style].name} · {LANG_META[b.config.lang].label}</div>
              <small>{b.frozen ? `已冻结 · ${b.refIds.length} 条 · ${b.revisions.length} 修订` : '待确认冻结'}</small>
              {b.frozen && <span className="frozen-dot" title="frozen" />}
            </button>
          ))}
        </div>
      </div>

      <div className="batch-col batch-mid">
        <div className="batch-card">
          <h3>清单与预览 <span>CHECKLIST · {chosen.length} 选中</span></h3>
          <div className="check-list">
            {refs.map((r) => {
              const miss = missingFields(r);
              return (
                <label key={r.id} className={'check-row ' + (checked.has(r.id) ? '' : 'off')}>
                  <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)} />
                  <div>
                    <strong>{r.title || '⟦title⟧'}</strong>
                    <small>{TYPE_META[r.type].zh} · {r.authors || '⟦authors⟧'} · {r.year || '⟦year⟧'}{r.doi ? ` · DOI ${r.doi}` : ''}</small>
                    {miss.length > 0 && <em className="miss">缺失 {miss.join(' / ')}</em>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="batch-card">
          <h3>引用预览 <span>{STYLE_META[config.style].name} · 未冻结</span></h3>
          <ol className={config.style === 'gbt' ? 'cite-list gbt' : 'cite-list numbered'} start={1}>
            {preview.included.map((e, i) => (
              <li key={e.refId} className={e.blocked && config.missingStrategy === 'block' ? 'blocked' : ''}>
                {config.style !== 'gbt' && <span className="idx">{i + 1}.</span>}
                <CiteText text={e.text.replace(/^\[\d+\]\s*/, '')} />
                {e.missing.length > 0 && <div className="row-tags"><em className="miss">占位：{e.missing.join('、')}</em></div>}
                {e.authorInfo.truncated && <div className="row-tags"><em className="trunc">作者已截断：{e.authorInfo.count} → 省略 {e.authorInfo.omitted} 位</em></div>}
              </li>
            ))}
          </ol>
          {preview.skipped.length > 0 && (
            <div className="skipped">
              <h4>策略跳过（{preview.skipped.length}）</h4>
              {preview.skipped.map((s) => (
                <p key={s.refId}>《{refs.find((r) => r.id === s.refId)?.title}》— {s.reason}</p>
              ))}
            </div>
          )}
          {config.missingStrategy === 'block' && !preview.canFreeze && (
            <p className="error-line">当前存在缺失条目，"阻止冻结"策略下无法确认。</p>
          )}
        </div>
      </div>

      <div className="batch-col batch-right">
        {!active && <div className="batch-card placeholder-card"><h3>冻结台 <span>FREEZE DESK</span></h3><p className="hint">创建或选择一个批次后，在此确认冻结、追加修订并导出。</p></div>}
        {active && (
          <>
            <div className="batch-card">
              <h3>{active.id} <span>{active.frozen ? 'FROZEN' : 'DRAFT'}</span></h3>
              <p className="hint">{STYLE_META[active.config.style].full} · {LANG_META[active.config.lang].label} · {MISSING[active.config.missingStrategy].zh}</p>
              {!active.frozen
                ? <button className="primary full" onClick={freeze}>✓ 确认并冻结清单与占位项</button>
                : <>
                  <button className="outline full" onClick={() => exportTxt(active.frozenText, `${active.id}-frozen.txt`)}>↓ 导出冻结文本</button>
                  {active.currentText !== undefined && (
                    <button className="outline full" onClick={() => exportTxt(active.currentText, `${active.id}-revised-r${active.revisions.length}.txt`)}>
                      ↓ 导出当前修订文本（R{active.revisions.length}）
                    </button>
                  )}
                </>}
            </div>

            {active.frozen && (
              <div className="batch-card">
                <h3>冻结快照 <span>不可变</span></h3>
                <ol className="cite-list gbt frozen">
                  {active.snapshot.map((s) => (
                    <li key={s.refId}>
                      <CiteText text={s.text.replace(/^\[\d+\]\s*/, '')} />
                      <div className="row-tags">
                        {s.placeholders.map((f) => (
                          <button key={f} className="rev-link" onClick={() => openRevision(s, f)}>修订 {f} →</button>
                        ))}
                        {s.aliases.length > 0 && <em className="alias">别名：{s.aliases.join('｜')}</em>}
                      </div>
                    </li>
                  ))}
                </ol>
                {active.skipped?.length > 0 && (
                  <div className="skipped"><h4>冻结时跳过</h4>{active.skipped.map((s) => <p key={s.refId}>ref#{s.refId} — {s.reason}</p>)}</div>
                )}
              </div>
            )}

            {active.frozen && active.currentSnapshot && (
              <div className="batch-card revised">
                <h3>修订后文本 <span>R{active.revisions.length} · 冻结原文不变</span></h3>
                <ol className="cite-list gbt">
                  {active.currentSnapshot.map((s) => (
                    <li key={s.refId}>
                      <CiteText text={s.text.replace(/^\[\d+\]\s*/, '')} />
                      {s.placeholderOpen?.length > 0 && <div className="row-tags"><em className="miss">仍占位：{s.placeholderOpen.join('、')}</em></div>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {active.frozen && (
              <div className="batch-card">
                <h3>修订链 <span>{active.revisions.length} REVISIONS</span></h3>
                {active.revisions.length === 0 && <p className="hint">尚无修订。冻结后不允许直接改动，所有修改在此登记原因。</p>}
                <ul className="rev-chain">
                  {active.revisions.map((rv) => (
                    <li key={rv.id}>
                      <strong>{rv.id}</strong> <code>{rv.field}</code>
                      <span className="diff"><del>{rv.before || '⟦空⟧'}</del> → <ins>{rv.after || '⟦空⟧'}</ins></span>
                      <small>{new Date(rv.at).toLocaleString()} · 原因：{rv.reason}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {active.frozen && drift && (drift.removed.length > 0 || drift.changed.length > 0) && (
              <div className="batch-card drift">
                <h3>刷新一致性检查 <span>DRIFT</span></h3>
                {drift.removed.map((s) => <p key={s.refId} className="error-line">文献库中 ref#{s.refId}《{s.title}》已删除 —— 冻结文本仍保留原条目。</p>)}
                {drift.changed.map(({ snapshot: s, ref: r, newlyFilled }) => (
                  <p key={s.refId} className="warn-line">
                    《{s.title}》库内有变化{newlyFilled.length ? `（已补字段：${newlyFilled.join('、')}）` : ''}；冻结文本不变，如需采纳请发起修订。
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {revFor && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setRevFor(null)}>×</button>
            <span className="crumb">REVISION · {active.id}</span>
            <h2>修订字段：{revFor.field}</h2>
            <p className="hint">《{revFor.title}》—— 冻结文本不会被覆盖，本次修改作为新版本追加到修订链。</p>
            <label>新值<input value={revForm.after} onChange={(e) => setRevForm({ ...revForm, after: e.target.value })} placeholder={`填入 ${revFor.field}（留空则仍保留占位）`} /></label>
            <label>修改原因（必填）<textarea rows="3" value={revForm.reason} onChange={(e) => setRevForm({ ...revForm, reason: e.target.value })} placeholder="例：从出版社官网核实卷期信息" /></label>
            <div className="two">
              <button className="outline" onClick={() => setRevFor(null)}>取消</button>
              <button className="primary" onClick={submitRevision}>提交修订</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
