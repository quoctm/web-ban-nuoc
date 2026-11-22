export type Category = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

export type Variant = {
  id: string;
  size: "M" | "L";
  price_vnd: number;
};

export type Product = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string;
  image_path: string | null;
  is_available: boolean;
  allow_sugar: boolean;
  allow_ice: boolean;
  variants: Variant[];
};
