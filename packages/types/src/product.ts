/** 产品信息 — website 和 miniprogram 共享 */
export interface Product {
  id: string;
  name: string;
  nameEn: string;
  nameJa: string;
  description: string;
  descriptionEn: string;
  descriptionJa: string;
  category: string;
  imageUrl?: string;
  downloadUrl?: string;
  isNew?: boolean;
}
