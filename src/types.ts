export interface CustomColumn {
  id: string;
  name: string;
  code: string;
  unit: string;
  type: 'manual' | 'formula';
  formula?: string;
  showInLabel?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: number | string; // Column "Unidad" (usually 100)
  
  // Base nutrients (per 'unit' - Original logic)
  carbs: number | string;
  protein: number | string;
  fatTotal: number | string;
  fatSat: number | string;
  fatTrans: number | string;
  fiber: number | string;
  sodium: number | string;
  water: number | string;
  at: number | string;
  aa: number | string;
  [key: string]: any; 
}

export interface RecipeIngredient {
  id: string;
  ingredientId: string;
  weight: number;      // Peso en gramos del ingrediente (Column C in Original 2)
  quantityLegis?: number; // Var.Grs. (calculated)
}

export interface SavedLabel {
  id: string;
  userId: string;
  name: string;
  html: string;
  format: 'horizontal' | 'vertical' | 'lineal';
  styles: {
    fontSize: number;
    borderColor: string;
    textColor: string;
    width: number;
  };
  createdAt: number;
}
