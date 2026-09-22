import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadState, saveState, uid } from './data/storage.js';
import LibraryView from './ui/LibraryView.jsx';
import BatchHub from './ui/BatchHub.jsx';
import BatchDetail from './ui/BatchDetail.jsx';

function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState('library'); // library | hub | batch
  const [openBatch, setOpenBatch] = useState(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  // 单一状态序列化为一致性的唯一来源：刷新后批次/冻结文本/修订链同生同存。
  useEffect(() => saveState(state), [state]);

  const notify = (msg, isErr = false) => {
    setToast(msg); setToastError(isErr);
    setTimeout(() => setToast(''), 3200);
  };

  const createBatch = (cfg) => {
    const batch = {
      id: uid('b'),
      name: cfg.name.trim(),
      style: cfg.style,
      language: cfg.language,
      missingStrategy: cfg.missingStrategy,
      memberIds: cfg.memberIds,
      frozen: false, frozenAt: null, frozenText: '', frozenManifest: null,
      revisions: [],
      createdAt: new Date().toISOString()
    };
    setState(s => ({ ...s, batches: [...s.batches, batch] }));
    setOpenBatch(batch.id);
    setView('batch');
    notify('批次草稿已建立，可预览确认后冻结');
  };

  const openBatchById = (id) => { setOpenBatch(id); setView('batch'); };
  const batch = state.batches.find(b => b.id === openBatch) || null;

  const frozenCount = state.batches.filter(b => b.frozen).length;

  return (
    <div className="app">
      <aside>
        <div className="logo"><span>∴</span> LITERATURE</div>
        <div className="library-head">
          <span>研究文献库 · 引用导出台</span>
          <strong>{state.records.length}<small> 篇文献</small></strong>
        </div>
        <nav>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>
            ▤ <span>文献库</span><b>{state.records.length}</b>
          </button>
          <button className={view !== 'library' ? 'active' : ''} onClick={() => setView('hub')}>
            ◱ <span>引用批次</span><b>{state.batches.length}</b>
          </button>
        </nav>
        <div className="side-tags">
          <small>批次状态</small>
          <button onClick={() => setView('hub')}>草稿 {state.batches.length - frozenCount}</button>
          <button onClick={() => setView('hub')}>已冻结 {frozenCount}</button>
        </div>
        <div className="side-foot">
          <small>本地存储 · 数据/校验/导出/界面分层 · 无新增依赖</small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="crumb">
              RESEARCH / {view === 'library' ? 'LIBRARY' : view === 'hub' ? 'CITATION BATCHES' : 'BATCH DETAIL'}
            </span>
            <h1>{view === 'library' ? '所有文献' : view === 'hub' ? '引用样式批次导出' : batch?.name || '批次'}</h1>
          </div>
        </header>
        {view === 'library' && <LibraryView state={state} setState={setState} notify={notify} />}
        {view === 'hub' && <BatchHub state={state} onCreate={createBatch} onOpen={openBatchById} />}
        {view === 'batch' && batch && (
          <BatchDetail batch={batch} state={state} setState={setState}
            onBack={() => setView('hub')} notify={notify} />
        )}
        {view === 'batch' && !batch && (
          <div className="hub"><div className="no-result">批次不存在。
            <button className="link" onClick={() => setView('hub')}>返回列表</button></div></div>
        )}
      </main>
      {toast && <div className={'toast ' + (toastError ? 'err' : '')}>{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
