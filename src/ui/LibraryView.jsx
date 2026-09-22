import React, { useMemo, useState } from 'react';
import { TYPE_META } from '../core/schema.js';
import { mergeByDoi } from '../core/store.js';

const EMPTY = { title: '', authors: '', year: '2024', venue: '', abstract: '', tags: '', type: 'journal', volume: '', issue: '', pages: '', publisher: '', location: '', doi: '', lang: 'zh' };

export default function LibraryView({ items, setItems, selected, setSelected, notify, onGoBatches }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const tags = ['全部', ...new Set(items.flatMap((x) => x.tags))];
  const filtered = useMemo(() => items.filter((x) =>
    (tag === '全部' || x.tags.includes(tag)) &&
    `${x.title}${x.authors}${x.abstract}`.toLowerCase().includes(query.toLowerCase())),
  [items, tag, query]);
  const cur = items.find((x) => x.id === selected) || items[0];

  const update = (k, v) => setItems(items.map((x) => (x.id === cur.id ? { ...x, [k]: v } : x)));

  const add = () => {
    if (!form.title) { notify('标题不能为空'); return; }
    const p = {
      ...form,
      id: Date.now(),
      year: form.year ? Number(form.year) : '',
      tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
      status: '待读',
      lang: form.lang === 'zh' ? 'zh' : 'en',
    };
    const { refs, merged } = mergeByDoi(items, p);
    setItems(refs);
    if (merged) {
      const host = refs.find((r) => r.id === merged.intoId);
      setSelected(host ? host.id : p.id);
      notify(`相同 DOI 已合并到《${host ? host.title : '既有文献'}》，别名已保留`);
    } else {
      setSelected(p.id);
      notify('文献已加入研究库');
    }
    setForm(EMPTY);
    setShow(false);
  };

  const bib = () => { navigator.clipboard?.writeText(cur ? `${cur.authors} (${cur.year}). ${cur.title}.` : ''); notify('引用文本已复制'); };

  return (
    <>
      <div className="lib-head-actions">
        <button className="outline" onClick={onGoBatches}>⇱ 批次导出</button>
        <button className="primary" onClick={() => setShow(true)}>＋ 添加文献</button>
      </div>
      <div className="toolbar">
        <div className="search">⌕<input placeholder="搜索标题、作者或摘要…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')}>×</button>}</div>
        <div className="tag-filter">{tags.map((t) => <button className={tag === t ? 'on' : ''} onClick={() => setTag(t)} key={t}>{t}</button>)}</div>
      </div>
      <div className="body">
        <section className="paper-list">
          {filtered.map((p) => (
            <button className={'paper ' + (selected === p.id ? 'selected' : '')} onClick={() => setSelected(p.id)} key={p.id}>
              <div className="paper-year">{p.year || '⟦year⟧'}</div>
              <div className="paper-copy">
                <h3>{p.title || '⟦title⟧'}</h3>
                <p>{p.authors || '⟦authors⟧'}</p>
                <div>
                  <span className="type-chip">{TYPE_META[p.type].zh}</span>
                  {p.tags.map((t) => <span key={t}>#{t}</span>)}
                  {p.doi && <span title={p.doi}>DOI</span>}
                  {p.aliases.length > 0 && <span title={p.aliases.join(' | ')}>别名×{p.aliases.length}</span>}
                </div>
              </div>
              <small className={'status ' + p.status}>{p.status}</small>
            </button>
          ))}
          {!filtered.length && <div className="no-result">没有找到匹配的文献</div>}
        </section>
        <section className="detail">
          {cur && (
            <>
              <div className="detail-top">
                <span className="status reading">{TYPE_META[cur.type].zh} · {cur.lang === 'zh' ? '中文' : 'English'}</span>
                <button onClick={() => notify('已加入收藏')}>☆ 收藏</button>
              </div>
              <h2>{cur.title}</h2>
              <p className="authors">{cur.authors}</p>
              <div className="cite-actions">
                <button onClick={bib}>▣ 复制引用</button>
                <button onClick={() => update('status', cur.status === '已读' ? '待读' : '已读')}>{cur.status === '已读' ? '标记为待读' : '标记为已读'}</button>
              </div>
              <div className="detail-section">
                <h4>摘要 <span>ABSTRACT</span></h4>
                <p>{cur.abstract}</p>
              </div>
              <div className="detail-section">
                <h4>出版信息 <span>PUBLICATION · 留空即缺失，不会自动补全</span></h4>
                <div className="pub-grid">
                  <div><small>出版物 / 会议</small><input value={cur.venue} onChange={(e) => update('venue', e.target.value)} /></div>
                  <div><small>年份</small><input value={cur.year} onChange={(e) => update('year', e.target.value)} /></div>
                  {cur.type === 'journal' && <>
                    <div><small>卷 volume</small><input value={cur.volume} placeholder="⟦volume⟧" onChange={(e) => update('volume', e.target.value)} /></div>
                    <div><small>期 issue</small><input value={cur.issue} placeholder="⟦issue⟧" onChange={(e) => update('issue', e.target.value)} /></div>
                    <div><small>页码 pages</small><input value={cur.pages} placeholder="⟦pages⟧" onChange={(e) => update('pages', e.target.value)} /></div>
                  </>}
                  {cur.type === 'book' && <div><small>出版社 publisher</small><input value={cur.publisher} placeholder="⟦publisher⟧" onChange={(e) => update('publisher', e.target.value)} /></div>}
                  {cur.type === 'conference' && <>
                    <div><small>会议地点 location</small><input value={cur.location} placeholder="⟦location⟧" onChange={(e) => update('location', e.target.value)} /></div>
                    <div><small>页码 pages</small><input value={cur.pages} placeholder="⟦pages⟧" onChange={(e) => update('pages', e.target.value)} /></div>
                  </>}
                  <div><small>DOI</small><input value={cur.doi} onChange={(e) => update('doi', e.target.value.trim().toLowerCase())} placeholder="10.xxxx/…" /></div>
                  <div><small>文献类型</small>
                    <select value={cur.type} onChange={(e) => update('type', e.target.value)}>
                      {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.zh}</option>)}
                    </select>
                  </div>
                </div>
                {cur.aliases.length > 0 && <p className="aliases">合并别名：{cur.aliases.join(' ｜ ')}</p>}
              </div>
              <div className="detail-section">
                <h4>我的笔记 <span>PRIVATE</span></h4>
                <textarea className="notes" placeholder="记录你的阅读想法…" value={cur.notes || ''} onChange={(e) => update('notes', e.target.value)} />
              </div>
            </>
          )}
        </section>
      </div>

      {show && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setShow(false)}>×</button>
            <span className="crumb">NEW REFERENCE</span>
            <h2>添加一篇文献</h2>
            <label>标题<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="论文或书籍标题" /></label>
            <label>作者（用 ; 或 &amp; 分隔）<input value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} placeholder="Clark, A.; Chalmers, D." /></label>
            <div className="two">
              <label>类型
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.zh}</option>)}
                </select>
              </label>
              <label>语言
                <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>
                  <option value="zh">中文</option><option value="en">English</option>
                </select>
              </label>
            </div>
            <div className="two">
              <label>年份<input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
              <label>出版物 / 会议<input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
            </div>
            <div className="two">
              {form.type === 'journal' && <>
                <label>卷<input value={form.volume} placeholder="缺失则留空" onChange={(e) => setForm({ ...form, volume: e.target.value })} /></label>
                <label>期<input value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} /></label>
              </>}
              {(form.type === 'journal' || form.type === 'conference') && <label>页码<input value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} /></label>}
              {form.type === 'book' && <label>出版社<input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></label>}
              {form.type === 'conference' && <label>会议地点<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>}
            </div>
            <label>DOI（同 DOI 将自动合并并保留别名）<input value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} placeholder="10.xxxx/…" /></label>
            <label>关键词<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="用逗号分隔" /></label>
            <label>摘要<textarea rows="3" value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} /></label>
            <button className="primary full" onClick={add}>保存文献</button>
          </div>
        </div>
      )}
    </>
  );
}
