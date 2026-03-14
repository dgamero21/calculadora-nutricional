import { useState, useRef, useEffect } from 'react';
import { Ingredient, RecipeIngredient, CustomColumn } from '../types';
import { evaluateFormula } from '../utils';
import { NutritionalLabel } from './NutritionalLabel';
import { ConfirmModal } from './ConfirmModal';
import { Plus, Trash2, Search, ChevronDown, Save, CheckCircle2, Eraser } from 'lucide-react';
import { db as firestore, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

function IngredientSelect({ db, value, onChange }: { db: Ingredient[], value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIng = db.find(i => i.id === value);
  // Deduplicate by name (keep first occurrence) to avoid showing duplicates in dropdown
  const sortedDb = [...db].sort((a, b) => a.name.localeCompare(b.name));
  const seenNames = new Set<string>();
  const uniqueDb = sortedDb.filter(i => {
    const key = i.name.trim().toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
  const filteredDb = uniqueDb.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));


  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl cursor-pointer flex justify-between items-center hover:border-stone-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
      >
        <span className="truncate text-sm font-medium text-stone-700">{selectedIng ? selectedIng.name : 'Seleccionar ingrediente...'}</span>
        <ChevronDown size={14} className={`text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="relative w-full max-w-lg bg-white border border-stone-200 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in slide-in-from-bottom-8 duration-300 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-stone-100 bg-white sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-stone-800">Seleccionar Ingrediente</h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none text-base placeholder:text-stone-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                  placeholder="Buscar por nombre o marca..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                />
              </div>
            </div>
            
            <div className="overflow-y-auto py-2 custom-scrollbar flex-1">
              {filteredDb.map(ing => (
                <div
                  key={ing.id}
                  className={`px-6 py-4 hover:bg-emerald-50/50 cursor-pointer transition-all flex items-center justify-between group ${value === ing.id ? 'bg-emerald-50/80 text-emerald-800 font-bold' : 'text-stone-600'}`}
                  onClick={() => {
                    onChange(ing.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-base group-hover:translate-x-1 transition-transform">{ing.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded font-bold uppercase tracking-tighter">Materia Prima</span>
                      {ing.kj > 0 && <span className="text-[10px] text-emerald-600 font-medium">{ing.kcal} kcal / 100g</span>}
                    </div>
                  </div>
                  {value === ing.id ? (
                    <div className="bg-emerald-500 p-1.5 rounded-full shadow-lg shadow-emerald-200">
                      <CheckCircle2 size={18} className="text-white" />
                    </div>
                  ) : (
                    <ChevronDown size={14} className="text-stone-300 -rotate-90 group-hover:text-emerald-400 transition-colors" />
                  )}
                </div>
              ))}
              {filteredDb.length === 0 && (
                <div className="p-16 text-stone-400 text-sm text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center">
                    <Search size={32} className="opacity-20" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="font-bold text-stone-800">No hay coincidencias</p>
                    <p className="italic">No encontramos "{search}" en tu base de datos.</p>
                  </div>
                  <button 
                    onClick={() => {setSearch('');}}
                    className="mt-2 text-emerald-600 font-bold hover:underline"
                  >
                    Ver todos los ingredientes
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {filteredDb.length} resultados</span>
              <span className="bg-white px-2 py-1 rounded-lg border border-stone-200">Mostrando base de datos unificada</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Calculator({
  db,
  customColumns,
  state,
  onStateChange
}: {
  db: Ingredient[],
  customColumns: CustomColumn[],
  state: {
    productName: string;
    clientName: string;
    recipe: RecipeIngredient[];
    portionSize: number;
  },
  onStateChange: (newState: Partial<typeof state>) => void
}) {
  const { productName, clientName, recipe, portionSize } = state;
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (recipe.length > 0) {
      setIsLoaded(true);
    }
  }, [recipe]);

  const totalWeight = recipe.reduce((sum, item) => sum + (Number(item.weight) || 0), 0); // Sumatoria de ingredientes (Column E)

  const validRecipe = recipe.filter(r => r.ingredientId && r.quantityLegis && r.quantityLegis > 0);

  // El campo de tamaño de porción es la sumatoria de peso (g) de todos los ingredientes.
  // Pero la porción efectiva en el rótulo es Tamaño de la Porción (g) / cantidad de ingredientes.
  const effectivePortionSize = validRecipe.length > 0 ? totalWeight / validRecipe.length : 0;

  const handleAddRow = () => {
    onStateChange({
      recipe: [...recipe, {
        id: Date.now().toString(),
        ingredientId: '',
        weight: 0,
        quantityLegis: 0
      }]
    });
  };

  const removeRow = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDeleteRow = () => {
    if (confirmDeleteId) {
      onStateChange({
        recipe: recipe.filter(r => r.id !== confirmDeleteId)
      });
      setConfirmDeleteId(null);
    }
  };

  const updateRow = (id: string, field: keyof RecipeIngredient, value: any) => {
    onStateChange({
      recipe: recipe.map(r => {
        if (r.id === id) {
          return { ...r, [field]: value };
        }
        return r;
      })
    });
  };

  const handleClear = () => {
    setShowClearModal(true);
  };

  const confirmClear = () => {
    onStateChange({
      productName: '',
      clientName: '',
      recipe: [],
      portionSize: 0
    });
    setIsLoaded(false);
    setShowClearModal(false);
  };



  const handleSaveRecipe = async () => {
    if (!productName) {
      alert('Por favor, ingresa el nombre del producto.');
      return;
    }

    if (recipe.length === 0) {
      alert('Por favor, agrega al menos un ingrediente a la receta.');
      return;
    }

    const hasIncompleteRows = recipe.some(r => !r.ingredientId || !r.quantityLegis || r.quantityLegis <= 0);
    if (hasIncompleteRows) {
      alert('Por favor, asegúrate de que todos los ingredientes seleccionados tengan una cantidad válida en "Var.Grs.".');
      return;
    }

    setSaving(true);
    try {
      const userId = auth.currentUser?.uid;

      if (!userId) {
        alert('Debes iniciar sesión para guardar recetas.');
        setSaving(false);
        return;
      }

      // Prepare ingredients array for NoSQL document
      const recipeIngredientsToSave = recipe.map(item => {
        const ing = db.find(i => i.id === item.ingredientId);
        if (!ing) return null;

        const carbs = evaluateFormula(ing.carbs, ing, customColumns);
        const protein = evaluateFormula(ing.protein, ing, customColumns);
        const fatTotal = evaluateFormula(ing.fatTotal, ing, customColumns);
        const fatSat = evaluateFormula(ing.fatSat, ing, customColumns);
        const fatTrans = evaluateFormula(ing.fatTrans, ing, customColumns);
        const fiber = evaluateFormula(ing.fiber, ing, customColumns);
        const sodium = evaluateFormula(ing.sodium, ing, customColumns);
        const water = evaluateFormula(ing.water, ing, customColumns);
        const at = evaluateFormula(ing.at, ing, customColumns);
        const aa = evaluateFormula(ing.aa, ing, customColumns);

        return {
          ingredientId: item.ingredientId,
          ingredientName: ing.name,
          weight: item.weight,
          quantityLegis: item.quantityLegis || 0,
          carbs,
          protein,
          fatTotal,
          fatSat,
          fatTrans,
          fiber,
          sodium,
          water,
          at,
          aa
        };
      }).filter(Boolean);

      // Save Recipe
      await addDoc(collection(firestore, 'recipes'), {
        userId,
        clientName: clientName || null,
        productName,
        portionSize: effectivePortionSize,
        totalWeight,
        ingredients: recipeIngredientsToSave,
        createdAt: new Date().toISOString()
      });

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Clear all state after successful save
      onStateChange({
        recipe: [],
        productName: '',
        clientName: ''
      });
      setIsLoaded(false);

    } catch (error: any) {
      console.error('Error saving recipe:', error);
      alert(`Error al guardar la receta: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-medium">
            <CheckCircle2 size={20} />
            Receta guardada exitosamente
          </div>
        </div>
      )}

      {/* Clear Modal */}
      {showClearModal && (
        <ConfirmModal
          title="Limpiar Calculadora"
          message="¿Estás seguro de que deseas limpiar toda la calculadora? Se perderán los datos actuales no guardados."
          confirmLabel="Limpiar"
          onConfirm={confirmClear}
          onCancel={() => setShowClearModal(false)}
        />
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title="Eliminar ingrediente"
          message="¿Estás seguro de que deseas eliminar este ingrediente de la receta?"
          onConfirm={confirmDeleteRow}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Datos del Producto</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Cliente (Opcional)</label>
            <input
              type="text"
              value={clientName}
              onChange={e => onStateChange({ clientName: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div id="tour-product-name">
            <label className="block text-sm font-medium text-stone-600 mb-1">Nombre del Producto</label>
            <input
              type="text"
              value={productName}
              onChange={e => onStateChange({ productName: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ej. Sándwich de Jamón y Queso"
            />
          </div>
          <div id="tour-portion-size">
            <label className="block text-sm font-medium text-stone-600 mb-1">Tamaño de la Porción (g)</label>
            <input
              type="number"
              value={totalWeight}
              readOnly
              className="w-full p-2 bg-stone-100 border border-stone-200 text-stone-500 rounded-xl outline-none cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-4">
          <div>
            <h2 className="text-lg font-medium">Ingredientes de la Receta</h2>
            <p className="text-xs text-stone-500">
              * "Peso" es la cantidad real en la receta. "Peso Legis." es la cantidad declarada para el cálculo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {recipe.length > 0 && (
              <button
                id="tour-clear-recipe"
                onClick={handleClear}
                className="text-stone-500 bg-stone-100 px-3 py-2 rounded-xl hover:bg-stone-200 hover:text-stone-700 flex items-center gap-2 text-sm font-medium transition-colors"
                title="Limpiar Calculadora"
              >
                <Eraser size={16} />
                <span>Limpiar</span>
              </button>
            )}
            <button
              id="tour-add-row"
              onClick={handleAddRow}
              className="text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-stone-200 hover:bg-emerald-100 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              <span>Agregar Fila</span>
            </button>
            <button
              id="tour-save-recipe"
              onClick={handleSaveRecipe}
              disabled={saving || recipe.length === 0 || !productName}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </div>
        </div>
        <div className="overflow-visible mb-4 pb-20 -mx-4 px-4 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[500px]">
            <thead className="text-[11px] uppercase tracking-wider text-stone-500 bg-stone-50/50 border-b border-stone-200/60">
              <tr>
                <th className="px-4 py-4 font-bold min-w-[220px]">Ingrediente / Materia Prima</th>
                <th className="px-2 py-4 font-bold w-24 md:w-32 min-w-[80px]">Peso Total (g)</th>
                <th className="px-2 py-4 font-bold w-28 md:w-40 min-w-[100px]">Peso Legis. (g)</th>
                <th className="px-2 py-4 font-bold w-16 md:w-24 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recipe.map((item) => (
                <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-2 py-2">
                    <div id="tour-ingredient-select">
                      <IngredientSelect
                        db={db}
                        value={item.ingredientId}
                        onChange={(val) => updateRow(item.id, 'ingredientId', val)}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      id="tour-weight-input"
                      type="number"
                      value={item.weight === 0 ? '' : item.weight}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        updateRow(item.id, 'weight', val);
                      }}
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      id="tour-legis-input"
                      type="number"
                      value={item.quantityLegis === 0 ? '' : item.quantityLegis}
                      onChange={e => updateRow(item.id, 'quantityLegis', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(item.id)} className="p-2 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {recipe.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                    No hay ingredientes en la receta. Haz clic en "Agregar Fila" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {validRecipe.length > 0 && (
          <div id="tour-recipe-summary" className="overflow-x-auto">
            <h3 className="text-md font-medium mb-3 text-stone-800">Resumen de Ingredientes</h3>
            <div className="min-w-[600px]">
              {validRecipe.map((item) => {
                const ing = db.find(i => i.id === item.ingredientId);
                if (!ing) return null;

                // Var.Grs. = (Peso Legis. × Peso) / Σ Pesos de todos los ingredientes
                const varGrs = totalWeight > 0
                  ? ((Number(item.quantityLegis) || 0) * (Number(item.weight) || 0)) / totalWeight
                  : 0;

                // Helper to get the base nutrient value per 100g
                const getBaseValue = (key: keyof Ingredient | string) => {
                  let val = ing[key as keyof Ingredient];
                  return evaluateFormula(val, ing, customColumns);
                };

                // Aporte = Var.Grs. × (valor_100g / 100)
                const calc = (key: keyof Ingredient | string) => {
                  const val = getBaseValue(key);
                  return (varGrs * val) / 100;
                };

                const formatVal = (num: number) => {
                  if (num === 0) return '0';
                  return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 5 });
                };
                return (
                  <details key={item.id} className="mb-4 border border-stone-200 rounded-xl overflow-hidden group">
                    <summary className="bg-stone-50 px-4 py-3 font-bold text-stone-800 flex justify-between items-center cursor-pointer list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-stone-200">
                      <div className="flex items-center gap-2">
                        <ChevronDown className="w-4 h-4 text-stone-500 group-open:rotate-180 transition-transform" />
                        <span>{ing.name}</span>
                      </div>
                      <span className="text-emerald-700 text-sm font-medium">Var.Grs: {varGrs.toLocaleString('es-AR', { maximumFractionDigits: 4 })} g</span>
                    </summary>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs bg-white">
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Hidratos Carbono</span>
                        <span className="font-mono">{formatVal(calc('carbs'))} g</span>
                        <span className="text-stone-400 text-[10px]">({formatVal(getBaseValue('carbs'))}/100g)</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium text-emerald-700">AT</span>
                        <span className="font-mono">{formatVal(calc('at'))} g</span>
                        <span className="text-stone-400 text-[10px]">({formatVal(getBaseValue('at'))}/100g)</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium text-emerald-700">AA</span>
                        <span className="font-mono">{formatVal(calc('aa'))} g</span>
                        <span className="text-stone-400 text-[10px]">({formatVal(getBaseValue('aa'))}/100g)</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Proteína</span>
                        <span className="font-mono">{formatVal(calc('protein'))} g</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Grasas Totales</span>
                        <span className="font-mono">{formatVal(calc('fatTotal'))} g</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Gr. Sat.</span>
                        <span className="font-mono">{formatVal(calc('fatSat'))} g</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Gr. Trans</span>
                        <span className="font-mono">{formatVal(calc('fatTrans'))} g</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Fibra</span>
                        <span className="font-mono">{formatVal(calc('fiber'))} g</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Sodio</span>
                        <span className="font-mono">{formatVal(calc('sodium'))} mg</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-stone-500 font-medium">Agua</span>
                        <span className="font-mono">{formatVal(calc('water'))} g</span>
                      </div>
                      {/* Custom columns */}
                      {customColumns
                        .map(col => {
                          const colVal = calc(col.id);
                          return (
                            <div key={col.id} className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">{col.name}</span>
                              <span className="font-mono">{formatVal(colVal)} {col.unit}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </details>
                );


              })}
            </div>
          </div>
        )}
      </div>

      {validRecipe.length > 0 && (
        <NutritionalLabel
          recipe={validRecipe}
          db={db}
          customColumns={customColumns}
          portionSize={effectivePortionSize}
          productName={productName}
          clientName={clientName}
        />
      )}
    </div>
  );
}
