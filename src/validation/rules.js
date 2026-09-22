// 校验层：字段必填规则与作者拆分。
// 数据层、导出层、界面共用同一套规则，保证「缺什么」口径一致。
export function requiredFields(type) {
  if (type === 'journal') return ['title', 'authors', 'year', 'venue', 'volume', 'issue', 'pages'];
  if (type === 'book') return ['title', 'authors', 'year', 'publisher'];
  if (type === 'conference') return ['title', 'authors', 'year', 'venue', 'location'];
  return ['title', 'authors', 'year'];
}

export const FIELD_NAMES = {
  title: { zh: '题名', en: 'title' },
  authors: { zh: '作者', en: 'authors' },
  year: { zh: '年份', en: 'year' },
  venue: { zh: '来源出版物', en: 'venue' },
  volume: { zh: '卷', en: 'volume' },
  issue: { zh: '期', en: 'issue' },
  pages: { zh: '页码', en: 'pages' },
  publisher: { zh: '出版社', en: 'publisher' },
  location: { zh: '会议地点', en: 'location' },
  doi: { zh: 'DOI', en: 'DOI' }
};

// 支持 ; 、 ；与 & 分隔；"and" 仅在明显是连接词时拆分，避免误伤姓氏。
export function splitAuthors(raw) {
  return String(raw || '')
    .split(/\s*[;；、]\s*|\s*&\s*|\s+and\s+/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// 给出单条记录的缺失字段码（界面高亮与导出占位共用）。
export function missingCodes(record) {
  return requiredFields(record.type).filter(k => !String(record[k] || '').trim());
}
