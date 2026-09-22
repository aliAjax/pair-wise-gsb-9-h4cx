// 纯逻辑冒烟测试（无测试框架、无新增依赖）：node test/smoke.mjs
import { seedRecords, seedBatches } from '../src/data/seed.js';
import { buildManifest, renderText, mergeByDoi, formatAuthors, normalizeDoi } from '../src/export/citation.js';
import { freezeBatch, createRevision, validateBatchSetup } from '../src/data/storage.js';

let pass = 0;
const ok = (cond, msg) => {
  if (!cond) { console.error('✗ ' + msg); process.exitCode = 1; }
  else { pass++; console.log('✓ ' + msg); }
};

// 1. DOI 规范化与合并：r1 与 r7 同 DOI，别名保留原始写法
const merged = mergeByDoi([seedRecords.find(r => r.id === 'r1'), seedRecords.find(r => r.id === 'r7')]);
ok(merged.length === 1, '同 DOI 合并为 1 组');
ok(merged[0].primary.id === 'r1', '主记录取最早出现者');
ok(merged[0].aliases.length === 1 && merged[0].aliases[0].title.includes('extended cognition thesis'),
  '别名原样保留（题名写法不同也保留）');
ok(normalizeDoi('https://doi.org/10.1093/Analys/58.1.7') === '10.1093/analys/58.1.7', 'DOI 规范化（URL/大小写）');

// 2. 作者截断
const gbtMany = formatAuthors(seedRecords.find(r => r.id === 'r9').authors, 'gbt', 'zh');
ok(gbtMany.truncated && gbtMany.shown === 3 && gbtMany.total === 22 && gbtMany.text.endsWith('，等'),
  'GB/T 超 3 作者截断为前 3 + 等');
const apaMany = formatAuthors(seedRecords.find(r => r.id === 'r9').authors, 'apa', 'en');
ok(apaMany.truncated && apaMany.shown === 20 && apaMany.text.endsWith('et al.'), 'APA 超 20 截断前 20 + et al.');
const mlaTwo = formatAuthors('Brown, J. S.; Collins, A.', 'mla', 'en');
ok(!mlaTwo.truncated && mlaTwo.shown === 2, 'MLA 两位作者不截断');
ok(mlaTwo.text === 'Brown, J. S., A. Collins',
  'MLA 首位倒置、余者名前姓后（实际：' + mlaTwo.text + '）');
const mlaThree = formatAuthors('Brown, J. S.; Collins, A.; Duguid, P.', 'mla', 'en');
ok(mlaThree.truncated && mlaThree.shown === 1 && mlaThree.text === 'Brown, J. S., et al.',
  'MLA 三位及以上按 MLA 9 只列首位 + et al.（实际：' + mlaThree.text + '）');
const gbtTwo = formatAuthors('Clark, A.; Chalmers, D.', 'gbt', 'en');
ok(gbtTwo.text === 'CLARK A., CHALMERS D.', 'GB/T 西文姓大写名缩写（实际：' + gbtTwo.text + '）');
const zhAuthors = formatAuthors('张伟; 李娜; 王芳; 刘洋; 陈静', 'gbt', 'zh');
ok(zhAuthors.truncated && zhAuthors.text === '张伟，李娜，王芳，等', 'GB/T 中文 5 作者截断（实际：' + zhAuthors.text + '）');

// 3. 缺失占位：r2 期刊缺卷期页；r4 书缺出版社；r6 会议缺地点
const m2 = buildManifest([seedRecords.find(r => r.id === 'r2')],
  { style: 'gbt', language: 'zh', missingStrategy: 'placeholder' });
const t2 = m2.groups[0].current.text;
ok(t2.includes('［缺：卷］') && t2.includes('［缺：期］') && t2.includes('［缺：页码］'),
  '期刊缺卷期页码 → 占位进入文本，不静默补全');
const m4 = buildManifest([seedRecords.find(r => r.id === 'r4')],
  { style: 'apa', language: 'en', missingStrategy: 'placeholder' });
ok(m4.groups[0].current.text.includes('[missing: publisher]'), '图书缺出版社 → 英文占位');
const m6 = buildManifest([seedRecords.find(r => r.id === 'r6')],
  { style: 'mla', language: 'en', missingStrategy: 'placeholder' });
ok(m6.groups[0].current.text.includes('[missing: conference location]'), '会议缺地点 → 占位');

// 4. 缺失策略：omit 跳过并登记；block 阻止冻结
const omitBatch = { id: 'x', style: 'gbt', language: 'zh', missingStrategy: 'omit' };
const mOmit = buildManifest([seedRecords.find(r => r.id === 'r2'), seedRecords.find(r => r.id === 'r1')], omitBatch);
ok(mOmit.groups.find(g => g.primary.id === 'r2').exported === false, 'omit：缺失条目标记为不导出');
ok(mOmit.omitted.length === 1 && mOmit.omitted[0].reason.includes('卷'), 'omit：跳过原因逐条登记');
ok(renderText(mOmit).includes('# 跳过'), 'omit：导出文本含跳过登记段');
let blocked = false;
try {
  freezeBatch({ records: seedRecords, batches: [{ ...omitBatch, id: 'x', missingStrategy: 'block', memberIds: ['r2'], name: 'n', frozen: false }] }, 'x');
} catch (e) { blocked = /卷/.test(e.message); }
ok(blocked, 'block：存在缺失时冻结被拒绝并给出原因');

// 5. 配置校验
ok(validateBatchSetup({ name: ' ', style: 'bad', language: 'zh', missingStrategy: 'placeholder' }).length >= 2,
  '非法样式与空名称被拒');

// 6. 冻结快照 + 修订链重放
let state = { records: structuredClone(seedRecords), batches: structuredClone(seedBatches), seq: 1 };
state = freezeBatch(state, 'b1');
const b1 = state.batches[0];
ok(b1.frozen && typeof b1.frozenText === 'string' && b1.frozenManifest.groups.length === 4,
  '冻结：成员 5 篇含同 DOI 对 → 清单 4 条');
const beforeText = b1.frozenText;
// r4 缺出版社，占位应在冻结文本里
ok(beforeText.includes('［缺：出版社］'), '冻结文本保留占位项');
// 直接改文献库，不影响冻结文本
state.records = state.records.map(r => r.id === 'r4' ? { ...r, publisher: 'Someone Else Press' } : r);
ok(state.batches[0].frozenText === beforeText, '冻结后文献库编辑不改变冻结文本');
// 修订需要原因
let revErr = false;
try { createRevision(state, 'b1', b1.frozenManifest.groups.find(g => g.primary.id === 'r4').id, 'publisher', 'MIT Press', ''); }
catch { revErr = true; }
ok(revErr, '无原因修订被拒');
// 不许清空已有值
let clearErr = false;
try { createRevision(state, 'b1', b1.frozenManifest.groups.find(g => g.primary.id === 'r1').id, 'pages', '', '误删'); }
catch { clearErr = true; }
ok(clearErr, '修订不得清空已有内容');
// 合法修订：占位被补齐，修订链 +1，冻结文本重放
state = createRevision(state, 'b1', b1.frozenManifest.groups.find(g => g.primary.id === 'r4').id,
  'publisher', 'MIT Press', '核对版权页后补全出版社');
const after = state.batches[0];
ok(after.revisions.length === 1 && after.revisions[0].before === '' && after.revisions[0].after === 'MIT Press',
  '修订记录 before/after 与原因');
ok(!after.frozenText.includes('［缺：出版社］') && after.frozenText.includes('MIT Press'),
  '修订后冻结文本重放：占位消失、新值进入');
ok(after.frozenText !== beforeText, '冻结文本随修订更新');

// 7. 持久化一致性：序列化再读回，批次/冻结文本/修订链同体
const json = JSON.stringify(state);
const restored = JSON.parse(json);
const rb = restored.batches[0];
ok(rb.frozenText === after.frozenText && rb.revisions[0].reason === '核对版权页后补全出版社'
  && rb.frozenManifest.groups.length === 4, '刷新（JSON 往返）后批次、冻结文本、修订链一致');

console.log(`\n${pass} 项通过`);
