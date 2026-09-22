// 常量定义层：样式、语言、缺失策略与文献类型

export const STYLES = ['gbt', 'apa', 'mla'];

export const STYLE_META = {
  gbt: { name: 'GB/T 7714', full: 'GB/T 7714-2015 顺序编码制' },
  apa: { name: 'APA', full: 'APA 7th Edition' },
  mla: { name: 'MLA', full: 'MLA 9th Edition' },
};

export const LANGS = ['zh', 'en'];

export const LANG_META = {
  zh: { label: '中文', labelEn: 'Chinese' },
  en: { label: 'English', labelEn: 'English' },
};

// missing strategy：缺失字段如何处理
export const MISSING = {
  keep: { id: 'keep', zh: '保留占位', en: 'Keep placeholders' },
  skip: { id: 'skip', zh: '跳过缺失条目', en: 'Skip incomplete entries' },
  block: { id: 'block', zh: '阻止冻结', en: 'Block freeze' },
};
export const MISSING_STRATEGIES = Object.values(MISSING);

export const TYPES = ['journal', 'book', 'conference'];

export const TYPE_META = {
  journal: { zh: '期刊论文', en: 'Journal article' },
  book: { zh: '专著', en: 'Book' },
  conference: { zh: '会议论文', en: 'Conference paper' },
};

// 各类型的必填字段（缺失即触发缺失策略，绝不静默补全）
export const REQUIRED_FIELDS = {
  journal: ['venue', 'year', 'volume', 'issue', 'pages'],
  book: ['publisher'],
  conference: ['venue', 'year', 'location', 'pages'],
};

// 字段元信息（校验与界面共用）
export const FIELD_META = {
  volume: { zh: '卷', en: 'Volume' },
  issue: { zh: '期', en: 'Issue' },
  pages: { zh: '页码', en: 'Pages' },
  publisher: { zh: '出版社', en: 'Publisher' },
  location: { zh: '会议地点', en: 'Conference location' },
  venue: { zh: '出版物/会议', en: 'Venue/Conference' },
  year: { zh: '年份', en: 'Year' },
  title: { zh: '标题', en: 'Title' },
  authors: { zh: '作者', en: 'Authors' },
};

// 样式作者截断规则
export const AUTHOR_RULES = {
  gbt: { max: 3, shownWhenOver: 3 },
  apa: { max: 20 }, // 7th：≤20 全列，21+ 保留前19 + … + 末位
  apaOver: { head: 19 },
  mla: { max: 3 }, // 4 位及以上用 et al.
};

// 存储键
export const STORE_KEYS = {
  refs: 'research-library',
  batches: 'citation-batches',
};
