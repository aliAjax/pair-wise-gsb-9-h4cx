import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadBatches, loadRefs, saveBatches, saveRefs } from './core/store.js';
import LibraryView from './ui/LibraryView.jsx';
import BatchView from './ui/BatchView.jsx';

function App() {
  const [items, setItems] = useState(loadRefs);
  const [batches, setBatches] = useState(loadBatches);
  const [selected, setSelected] = useState(() => loadRefs()[0]?.id ?? 1);
  const [view, setView] = useState('library');
  const [notice, setNotice] = useState('');

  // 数据层独立持久化：刷新后批次、冻结文本、修订链从同一存储恢复
  useEffect(() => saveRefs(items), [items]);
  useEffect(() => saveBatches(batches), [batches]);

  const notify = (msg) => {
    setNotice(msg);
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setNotice(''), 2600);
  };

  const frozenCount = batches.filter((b) => b.frozen).length;

  return (
    <div className="app">
      <aside>
        <div className="logo"><span>∴</span> LITERATURE</div>
        <div className="library-head">
          <span>我的研究库</span>
          <strong>{items.length}<small> 篇文献</small></strong>
        </div>
        <nav>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>
            ▤ <span>所有文献</span><b>{items.length}</b>
          </button>
          <button className={view === 'batches' ? 'active' : ''} onClick={() => setView('batches')}>
            ⇱ <span>引用批次导出</span><b>{batches.length || ''}</b>
          </button>
          <button onClick={() => notify('已读筛选在批次视图外暂未启用')}>✓ <span>已读</span></button>
          <button onClick={() => notify('收藏功能即将上线')}>☆ <span>收藏</span></button>
        </nav>
        <div className="side-tags">
          <small>批次状态</small>
          <button onClick={() => setView('batches')}>◈ 草稿 {batches.length - frozenCount}</button>
          <button onClick={() => setView('batches')}>❄ 已冻结 {frozenCount}</button>
        </div>
        <div className="side-foot">
          <button onClick={() => notify('四层架构：数据 / 校验 / 导出 / 界面，零新增依赖')}>⚙ 偏好设置</button>
          <small>本地数据库 · 已同步</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="crumb">{view === 'library' ? 'RESEARCH / LIBRARY' : 'CITATION / BATCH EXPORT'}</span>
            <h1>{view === 'library' ? '所有文献' : '引用样式批次导出'}</h1>
          </div>
          <div className="actions">
            {view === 'library'
              ? null
              : <button className="outline" onClick={() => setView('library')}>← 返回文献库</button>}
          </div>
        </header>
        {view === 'library'
          ? <LibraryView items={items} setItems={setItems} selected={selected} setSelected={setSelected} notify={notify} onGoBatches={() => setView('batches')} />
          : <BatchView refs={items} batches={batches} setBatches={setBatches} notify={notify} />}
      </main>
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
