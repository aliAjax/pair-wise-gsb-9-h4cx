// 界面层：批次详情 —— 预览三样式、缺失占位、冻结、导出、修订链。
import React, { useMemo, useState } from 'react';
import { STYLES, MISSING_STRATEGIES, LANGUAGES, PATCHABLE_FIELDS, createRevision, freezeBatch } from '../data/storage.js';
import { buildManifest } from '../export/citation.js';

const PATCH_LABEL = {
  title: '题名', authors: '作者', year: '年份', venue: '来源出版物',
  volume: '卷', issue: '期', pages: '页码',
  publisher: '出版社', location: '会议地点', doi: 'DOI', language: '语言'
};

export default function BatchDetail({ batch, state, setState, onBack, notify }) {
  const frozen = batch.frozen;
  // 草稿时实时计算；冻结后只显示落盘清单（刷新后依旧如此）。
  const manifest = useMemo(() => frozen ? batch.frozenManifest
    : buildManifest(batch.memberIds.map(id => state.records.find(r => r.id === id)).filter(Boolean), batch),
    [frozen, batch, state.records]);

  const [viewStyle, setViewStyle] = useState(batch.style);
  const [revFor, setRevFor] = useState(null); // { groupId }
  const [revField, setRevField] = useState('pages');
  const [revValue, setRevValue] = useState('');
  const [revReason, setRevReason] = useState('');
  const [revError, setRevError] = useState('');

  const doFreeze = () => {
    try {
      setState(freezeBatch(state, batch.id));
      notify('清单与占位已冻结；此后修改只能走带原因修订');
    } catch (e) { notify(e.message, true); }
  };

  const download = () => {
    const blob = new Blob([batch.frozenText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${batch.name}-${batch.style}.txt`;
    a.click();
    notify('已导出冻结文本');
  };

  const copy = () => {
    navigator.clipboard?.writeText(batch.frozenText || '');
    notify('冻结文本已复制');
  };

  const submitRevision = () => {
    try {
      setState(createRevision(state, batch.id, revFor, revField, revValue, revReason));
      setRevFor(null); setRevValue(''); setRevReason(''); setRevError('');
      notify('修订已登记，冻结文本已随修订链重放');
    } catch (e) {
      setRevError(e.message);
    }
  };

  return (
    <div className="batch-detail">
      <div className="detail-bar">
        <button className="link" onClick={onBack}>← 返回批次列表</button>
        <span className={'badge ' + (frozen ? 'frozen' : 'draft')}>{frozen ? '已冻结' : '草稿'}</span>
      </div>
      <h2>{batch.name}</h2>
      <div className="batch-config">
        <span>{STYLES.find(s => s.id === batch.style)?.name}</span>
        <span>登记语言：{LANGUAGES.find(l => l.id === batch.language)?.name}</span>
        <span>缺失策略：{MISSING_STRATEGIES.find(m => m.id === batch.missingStrategy)?.name}</span>
        <span>{batch.memberIds.length} 篇入选 → 合并后 {manifest.groups.length} 条</span>
      </div>

      <div className="style-tabs">
        {STYLES.map(s => (
          <button key={s.id} className={viewStyle === s.id ? 'on' : ''}
            onClick={() => setViewStyle(s.id)}
            title={s.id === batch.style ? '本批次样式' : '仅预览，不改变批次样式'}>
            {s.name}{s.id === batch.style ? '（本批次）' : '（预览）'}
          </button>
        ))}
      </div>

      <div className="entries">
        {manifest.groups.map((g, i) => {
          const line = g.lines.find(l => l.style === viewStyle);
          const ownLine = g.lines.find(l => l.style === batch.style);
          return (
            <div key={g.id} className={'entry ' + (g.exported ? '' : 'omitted')}>
              <div className="entry-head">
                <span className="entry-no">[{i + 1}]</span>
                <span className="entry-flags">
                  {g.aliases.length > 0 && <span className="flag merged">同 DOI 合并 ×{g.aliases.length + 1}</span>}
                  {line.authorTruncated &&
                    <span className="flag trunc">作者截断 {line.authorShown}/{line.authorTotal}</span>}
                  {ownLine.issues.length > 0 && <span className="flag missing">
                    {g.exported ? `占位 ×${ownLine.issues.length}` : `跳过：缺${ownLine.issues.map(c => PATCH_LABEL[c]).join('、')}`}
                  </span>}
                </span>
                {frozen && g.exported && (
                  <button className="tiny" onClick={() => { setRevFor(g.id); setRevError(''); }}>登记修订</button>
                )}
              </div>
              <p className={'cite-line ' + (viewStyle === batch.style ? '' : 'preview-style')}>{line.text}</p>
              {g.aliases.length > 0 && (
                <div className="aliases">
                  <small>别名（合并保留，不参与渲染）：</small>
                  {g.aliases.map(a => (
                    <div key={a.id} className="alias-row">
                      · {a.title} <i>/ {a.authors}</i>{g.doi && <code>{g.doi}</code>}
                    </div>
                  ))}
                </div>
              )}
              {revFor === g.id && (
                <div className="rev-form">
                  <strong>带原因修订</strong>
                  <div className="rev-row">
                    <select value={revField} onChange={e => setRevField(e.target.value)}>
                      {PATCHABLE_FIELDS.map(f => <option key={f} value={f}>{PATCH_LABEL[f]}</option>)}
                    </select>
                    <input placeholder="修订后的值（不得清空已有内容）"
                      value={revValue} onChange={e => setRevValue(e.target.value)} />
                  </div>
                  <input placeholder="修订原因（必填）" value={revReason} onChange={e => setRevReason(e.target.value)} />
                  {revError && <div className="form-error">{revError}</div>}
                  <div className="rev-actions">
                    <button onClick={() => setRevFor(null)}>取消</button>
                    <button className="primary" onClick={submitRevision}>提交修订并重放冻结文本</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="freeze-zone">
        {!frozen ? (
          <>
            <p className="muted">确认后将冻结：当前成员清单、合并结果、每条占位项与三样式文本。
              冻结后文献库中的再编辑不会改变本批次。</p>
            <button className="primary" onClick={doFreeze}>确认并冻结清单</button>
          </>
        ) : (
          <>
            <div className="frozen-text">
              <div className="frozen-text-head">
                <small>冻结文本（{new Date(batch.frozenAt).toLocaleString('zh-CN')} 冻结）</small>
                <div><button className="tiny" onClick={copy}>复制</button>
                  <button className="tiny" onClick={download}>下载 .txt</button></div>
              </div>
              <pre>{batch.frozenText}</pre>
            </div>
          </>
        )}
      </div>

      <div className="revisions">
        <h4>修订链（{batch.revisions.length}）</h4>
        {batch.revisions.length === 0 && <p className="muted">尚无修订。冻结后对任何条目的修改都会在此留下原因记录。</p>}
        {batch.revisions.map(rv => {
          const g = batch.frozenManifest?.groups.find(x =>
            x.primary.id === rv.recordId || x.aliases.some(a => a.id === rv.recordId));
          return (
            <div key={rv.id} className="rev-item">
              <div className="rev-item-head">
                <strong>《{g?.primary.title || rv.recordId}》 · {PATCH_LABEL[rv.field]}</strong>
                <small>{new Date(rv.at).toLocaleString('zh-CN')}</small>
              </div>
              <div className="rev-diff"><del>{rv.before || '（空/占位）'}</del> → <b>{rv.after}</b></div>
              <div className="rev-reason">原因：{rv.reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
