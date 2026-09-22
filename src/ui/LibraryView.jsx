// 界面层：文献库（列表 / 详情 / 录入编辑）。
// 录入与编辑时按校验层规则标出缺失字段，但不预填、不推断。
import React, { useMemo, useState } from 'react';
import { emptyRecord, uid } from '../data/storage.js';
import { requiredFields, FIELD_NAMES, missingCodes } from '../validation/rules.js';

const TYPE_LABEL = { journal: '期刊论文', book: '图书', conference: '会议论文' };

export default function LibraryView({ state, setState, notify }) {
  const { records, batches } = state;
  const [selected, setSelected] = useState(records[0]?.id);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [editing, setEditing] = useState(null); // record draft or 'new'

  const tags = ['全部', ...new Set(records.flatMap(x => x.tags || []))];
  const filtered = useMemo(() => records.filter(x =>
    (tag === '全部' || (x.tags || []).includes(tag)) &&
    `${x.title}${x.authors}${x.abstract || ''}`.toLowerCase().includes(query.toLowerCase())),
    [records, tag, query]);

  const cur = records.find(x => x.id === selected) || records[0];
  const curMissing = cur ? missingCodes(cur) : [];
  const frozenBatchesWithCur = cur ? batches.filter(b => b.frozen && b.memberIds.includes(cur.id)) : [];

  const update = (k, v) => setState({
    ...state,
    records: records.map(x => x.id === cur.id ? { ...x, [k]: v } : x)
  });

  return (
    <div className="body">
      <section className="paper-list">
        <div className="list-toolbar">
          <div className="search">⌕<input placeholder="搜索标题、作者或摘要…" value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery('')}>×</button>}</div>
          <button className="primary" onClick={() => setEditing({ ...emptyRecord(), id: uid('r') })}>＋ 添加</button>
        </div>
        <div className="tag-filter">
          {tags.map(t => <button key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(t)}>{t}</button>)}
        </div>
        {filtered.map(p => {
          const miss = missingCodes(p);
          return (
            <button className={'paper ' + (cur && selected === p.id ? 'selected' : '')} key={p.id} onClick={() => setSelected(p.id)}>
              <div className="paper-year">{p.year || '缺年'}</div>
              <div className="paper-copy">
                <h3>{p.title || '（无题）'}</h3>
                <p>{p.authors || '（缺作者）'}</p>
                <div>
                  <span className="type-tag">{TYPE_LABEL[p.type]}</span>
                  {(p.tags || []).map(t => <span key={t}>#{t}</span>)}
                  {miss.length > 0 && <span className="miss-inline">缺 {miss.map(c => FIELD_NAMES[c].zh).join('、')}</span>}
                </div>
              </div>
            </button>
          );
        })}
        {!filtered.length && <div className="no-result">没有找到匹配的文献</div>}
      </section>

      <section className="detail">
        {cur && (
          <>
            <div className="detail-top">
              <span className="type-tag big">{TYPE_LABEL[cur.type]}</span>
              <button onClick={() => setEditing({ ...cur })}>✎ 编辑元数据</button>
            </div>
            <h2>{cur.title || '（无题）'}</h2>
            <p className="authors">{cur.authors || '（缺作者）'}</p>

            {curMissing.length > 0 && (
              <div className="missing-banner">
                关键信息缺失（导出时保留占位，不会被补全）：
                {curMissing.map(c => <span key={c} className="chip">［缺：{FIELD_NAMES[c].zh}］</span>)}
              </div>
            )}
            {frozenBatchesWithCur.length > 0 && (
              <div className="frozen-note">
                该文献在 {frozenBatchesWithCur.length} 个已冻结批次中。此处的编辑不改变冻结文本；
                如需修改请在对应批次中「登记修订」并填写原因。
              </div>
            )}

            <div className="detail-section">
              <h4>摘要 <span>ABSTRACT</span></h4>
              <p>{cur.abstract || '（暂无摘要）'}</p>
            </div>
            <div className="detail-section">
              <h4>出版信息 <span>PUBLICATION</span></h4>
              <div className="pub-grid">
                <Cell k="year" zh="年份" r={cur} /><Cell k="venue" zh="来源出版物" r={cur} />
                <Cell k="volume" zh="卷" r={cur} /><Cell k="issue" zh="期" r={cur} />
                <Cell k="pages" zh="页码" r={cur} /><Cell k="publisher" zh="出版社" r={cur} />
                <Cell k="location" zh="会议地点" r={cur} /><Cell k="doi" zh="DOI" r={cur} />
              </div>
            </div>
            <div className="detail-section">
              <h4>我的笔记 <span>PRIVATE</span></h4>
              <textarea className="notes" placeholder="记录你的阅读想法…" value={cur.notes || ''}
                onChange={e => update('notes', e.target.value)} />
            </div>
          </>
        )}
      </section>

      {editing && <RecordEditor initial={editing} onClose={() => setEditing(null)}
        onSave={(rec) => {
          const exists = records.some(r => r.id === rec.id);
          setState({ ...state, records: exists ? records.map(r => r.id === rec.id ? rec : r) : [...records, rec] });
          setSelected(rec.id);
          setEditing(null);
          notify(exists ? '文献已更新' : '文献已加入研究库');
        }} />}
    </div>
  );
}

function Cell({ k, zh, r }) {
  const empty = !String(r[k] || '').trim();
  const required = requiredFields(r.type).includes(k);
  return (
    <div><small>{zh}</small>
      <strong className={empty && required ? 'missing-cell' : ''}>
        {empty ? (required ? `［缺：${zh}］` : '—') : r[k]}
      </strong>
    </div>
  );
}

function RecordEditor({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const miss = missingCodes(f);

  const save = () => {
    // 允许保存缺失数据（占位策略的来源），但题名/作者/年份至少给题名，避免完全空记录。
    if (!String(f.title || '').trim()) { setErr('题名不能为空，其余字段缺失可保留，导出时显示占位。'); return; }
    const rec = {
      ...f,
      year: String(f.year || '').trim(),
      tags: Array.isArray(f.tags) ? f.tags : String(f.tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean)
    };
    onSave(rec);
  };

  return (
    <div className="modal-bg">
      <div className="modal wide">
        <button className="close" onClick={onClose}>×</button>
        <span className="crumb">RECORD METADATA</span>
        <h2>{initial.title ? '编辑文献' : '添加一篇文献'}</h2>

        <label>类型
          <select value={f.type} onChange={e => set('type', e.target.value)}>
            <option value="journal">期刊论文（缺卷/期/页码将出现占位）</option>
            <option value="book">图书（缺出版社将出现占位）</option>
            <option value="conference">会议论文（缺地点将出现占位）</option>
          </select>
        </label>
        <label>题名<input value={f.title} onChange={e => set('title', e.target.value)} /></label>
        <label>作者（用 ; 分隔，例：Clark, A.; Chalmers, D.）
          <input value={f.authors} onChange={e => set('authors', e.target.value)} /></label>
        <div className="two">
          <label>年份<input value={f.year} onChange={e => set('year', e.target.value)} /></label>
          <label>登记语言
            <select value={f.language} onChange={e => set('language', e.target.value)}>
              <option value="zh">中文</option><option value="en">English</option>
            </select>
          </label>
        </div>
        <label>来源出版物（期刊名 / 会议名）
          <input value={f.venue} onChange={e => set('venue', e.target.value)} /></label>
        <div className="three">
          <label>卷<input value={f.volume} onChange={e => set('volume', e.target.value)} placeholder="留空即缺失" /></label>
          <label>期<input value={f.issue} onChange={e => set('issue', e.target.value)} placeholder="留空即缺失" /></label>
          <label>页码<input value={f.pages} onChange={e => set('pages', e.target.value)} placeholder="留空即缺失" /></label>
        </div>
        <div className="two">
          <label>出版社（图书）<input value={f.publisher} onChange={e => set('publisher', e.target.value)} /></label>
          <label>会议地点（会议）<input value={f.location} onChange={e => set('location', e.target.value)} /></label>
        </div>
        <label>DOI（同 DOI 的多条记录在批次中合并，别名保留）
          <input value={f.doi} onChange={e => set('doi', e.target.value)} placeholder="10.xxxx/…" /></label>
        <label>关键词（逗号分隔）<input value={Array.isArray(f.tags) ? f.tags.join(',') : (f.tags || '')}
          onChange={e => set('tags', e.target.value)} /></label>
        <label>摘要<textarea rows="2" value={f.abstract} onChange={e => set('abstract', e.target.value)} /></label>

        {miss.length > 0 && (
          <div className="missing-banner small">
            将保留为占位的缺失项：{miss.map(c => <span key={c} className="chip">［缺：{FIELD_NAMES[c].zh}］</span>)}
          </div>
        )}
        {err && <div className="form-error">{err}</div>}
        <button className="primary full" onClick={save}>保存文献</button>
      </div>
    </div>
  );
}
