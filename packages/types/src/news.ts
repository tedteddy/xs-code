/** 新闻/资讯 — website 和 miniprogram 共享 */
export interface News {
  id: string;
  title: string;
  titleEn: string;
  titleJa: string;
  content: string;
  publishedAt: string;
  category?: string;
}
