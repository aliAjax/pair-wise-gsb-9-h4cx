// 数据层：种子文献与种子批次。
// 只描述文献元数据本身，缺失字段一律留空（''），不做任何推断或补全。
const manyAuthors = Array.from({ length: 22 }, (_, i) => `Author${i + 1}, X.`).join('; ');

export const seedRecords = [
  {
    id: 'r1', type: 'journal',
    title: 'The Extended Mind',
    authors: 'Clark, A.; Chalmers, D.',
    year: '1998', venue: 'Analysis',
    volume: '58', issue: '1', pages: '7-19',
    publisher: '', location: '',
    doi: '10.1093/analys/58.1.7',
    language: 'en',
    tags: ['具身认知', '经典'], status: '阅读中',
    abstract: '本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',
    notes: ''
  },
  {
    id: 'r2', type: 'journal',
    title: 'Situated Cognition and the Culture of Learning',
    authors: 'Brown, J. S.; Collins, A.; Duguid, P.',
    year: '1989', venue: 'Educational Researcher',
    volume: '', issue: '', pages: '',
    publisher: '', location: '',
    doi: '10.3102/0013189x018001032',
    language: 'en',
    tags: ['学习科学'], status: '待读',
    abstract: '知识具有情境性，学习是在真实实践中逐步参与的过程。',
    notes: ''
  },
  {
    id: 'r3', type: 'book',
    title: 'Situated Learning: Legitimate Peripheral Participation',
    authors: 'Lave, J.; Wenger, E.',
    year: '1991', venue: '',
    volume: '', issue: '', pages: '',
    publisher: 'Cambridge University Press', location: '',
    doi: '',
    language: 'en',
    tags: ['学习科学', '社会'], status: '待读',
    abstract: '学习发生在真实情境的参与过程中，知识与共同体实践不可分割。',
    notes: ''
  },
  {
    id: 'r4', type: 'book',
    title: 'Designing with Data',
    authors: 'Miller, S.',
    year: '2022', venue: '',
    volume: '', issue: '', pages: '',
    publisher: '', location: '',
    doi: '',
    language: 'en',
    tags: ['设计研究', '方法'], status: '已读',
    abstract: '一套面向设计师的数据研究方法，讨论如何把定性洞察转化为可行动的设计决策。',
    notes: ''
  },
  {
    id: 'r5', type: 'conference',
    title: 'Notes on Post-it Notation: Design Synthesis in Practice',
    authors: 'Newman, M.; Zhao, L.',
    year: '2017', venue: 'Proceedings of the Design Research Society Conference',
    volume: '', issue: '', pages: '412-423',
    publisher: '', location: 'London',
    doi: '10.21606/drs.2016.412',
    language: 'en',
    tags: ['设计研究'], status: '待读',
    abstract: '基于便签的综合实践在工业设计研究中的模式与陷阱。',
    notes: ''
  },
  {
    id: 'r6', type: 'conference',
    title: 'A Framework for Mixed-Initiative Design Critique',
    authors: 'Okafor, N.',
    year: '2024', venue: 'CHI Conference on Human Factors in Computing Systems',
    volume: '', issue: '', pages: '',
    publisher: '', location: '',
    doi: '10.1145/3611111.3622222',
    language: 'en',
    tags: ['人机交互'], status: '待读',
    abstract: '人类设计师与计算批评工具之间主动权分配的框架。',
    notes: ''
  },
  {
    id: 'r7', type: 'journal',
    // 与 r1 同一 DOI，录入时标题/作者写法不同：批次预览中应合并，并把本条作为别名保留。
    title: 'The Extended Mind (extended cognition thesis)',
    authors: 'Andy Clark & David Chalmers',
    year: '1998', venue: 'Analysis',
    volume: '58', issue: '1', pages: '7-19',
    publisher: '', location: '',
    doi: '10.1093/analys/58.1.7',
    language: 'en',
    tags: ['经典'], status: '已读',
    abstract: '同一篇论文的另一条书目记录，用于验证 DOI 合并与别名保留。',
    notes: ''
  },
  {
    id: 'r8', type: 'journal',
    title: '情境认知视角下的学习环境设计研究',
    authors: '张伟; 李娜; 王芳; 刘洋; 陈静',
    year: '2021', venue: '电化教育研究',
    volume: '42', issue: '6', pages: '',
    publisher: '', location: '',
    doi: '10.13811/j.cnki.eer.2021.06.005',
    language: 'zh',
    tags: ['学习科学', '中文'], status: '阅读中',
    abstract: '以情境认知理论审视学习环境设计的要素与路径。',
    notes: ''
  },
  {
    id: 'r9', type: 'journal',
    title: 'Large Team Author Truncation Stress Test',
    authors: manyAuthors,
    year: '2025', venue: 'Journal of Informetric Edge Cases',
    volume: '1', issue: '1', pages: '1-20',
    publisher: '', location: '',
    doi: '10.9999/edge.2025.0001',
    language: 'en',
    tags: ['方法'], status: '待读',
    abstract: '22 位作者，用于验证各样式的作者超限截断规则。',
    notes: ''
  }
];

export const seedBatches = [
  {
    id: 'b1',
    name: '论文初稿 · GB/T 7714',
    style: 'gbt',
    language: 'zh',
    missingStrategy: 'placeholder',
    memberIds: ['r8', 'r1', 'r7', 'r4', 'r3'],
    frozen: false,
    frozenAt: null,
    frozenText: '',
    frozenManifest: null,
    revisions: [],
    createdAt: '2026-09-10T08:00:00.000Z'
  }
];
