import React, { useState, useEffect } from 'react';
import { db as firestore, auth } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { Trash2, Search, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export function SavedRecipes({
  onLoadRecipe,
  isTourMode = false,
  tutorialData = []
}: {
  onLoadRecipe?: (recipe: any) => void;
  isTourMode?: boolean;
  tutorialData?: any[];
}) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isTourMode) {
      setRecipes(tutorialData);
      setLoading(false);
    } else {
      fetchRecipes();
    }
  }, [isTourMode, tutorialData]);

  const fetchRecipes = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setLoading(true);
    try {
      const q = query(collection(firestore, 'recipes'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Sort locally by createdAt descending
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRecipes(data);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal(id);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteDoc(doc(firestore, 'recipes', deleteModal));
      fetchRecipes();
    } catch (error: any) {
      console.error('Error deleting recipe:', error);
      if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
        alert('No se puede eliminar. Es probable que esta receta sea antigua y no tenga tu ID de usuario asociado. Por favor, elimínala manualmente desde la consola de Firebase.');
      } else {
        alert('Error al eliminar la receta: ' + error.message);
      }
    } finally {
      setDeleteModal(null);
    }
  };

  const filteredRecipes = recipes.filter(r =>
    (r.productName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.clientName || '').toLowerCase().includes(search.toLowerCase())
  );

  const format = (val: number | undefined) => {
    if (val === undefined || val === null || val === 0) return '';
    return val.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6 relative">

      {deleteModal && (
        <ConfirmModal
          title="Eliminar Receta"
          message="¿Estás seguro de que deseas eliminar esta receta guardada? Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      <div className="flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente o producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRecipes.map((recipe, index) => (
            <div 
              key={recipe.id} 
              id={index === 0 ? 'tour-saved-first-card' : undefined}
              className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden"
            >
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
              >
                <div>
                  <h3 className="font-bold text-lg text-stone-800">{recipe.productName}</h3>
                  {recipe.clientName && (
                    <p className="text-sm text-stone-500">Cliente: {recipe.clientName}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1">
                    {new Date(recipe.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {onLoadRecipe && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadRecipe(recipe);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline">Cargar en Calculadora</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(recipe.id, e)}
                    className="p-2 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="text-stone-400">
                    {expandedId === recipe.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {expandedId === recipe.id && (
                <div className="p-4 border-t border-stone-100 bg-stone-50/50">
                  <h4 className="text-xs font-semibold text-stone-600 uppercase mb-3">Ingredientes y Valores Nutricionales</h4>
                  <div className="min-w-[600px]">
                    {recipe.ingredients?.map((ri: any, idx: number) => {
                      const totalWeight = recipe.totalWeight || recipe.ingredients.reduce((sum: number, item: any) => sum + (Number(item.weight) || 0), 0);
                      const varGrs = totalWeight > 0 ? (ri.quantityLegis * ri.weight) / totalWeight : 0;

                      const calc = (val: number | undefined) => {
                        if (val === undefined || val === null) return 0;
                        return (varGrs * val) / 100;
                      };

                      const formatVal = (num: number | undefined) => {
                        if (num === undefined || num === null || num === 0) return '0';
                        return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 5 });
                      };

                      return (
                        <div key={idx} className="mb-6 border border-stone-200 rounded-xl overflow-hidden bg-white">
                          <div className="bg-stone-50 px-4 py-2 border-b border-stone-200 font-bold text-stone-800 flex justify-between">
                            <span>{ri.ingredientName}</span>
                            <div className="flex gap-4">
                              <span className="text-stone-500 font-normal">Peso: {formatVal(ri.weight)}g</span>
                              <span className="text-emerald-700">Var.Grs: {formatVal(varGrs)}</span>
                            </div>
                          </div>
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Hidratos Carbono</span>
                              <span className="font-mono">{formatVal(calc(ri.carbs))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Azúcares Totales</span>
                              <span className="font-mono">{formatVal(calc(ri.at))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Azúcares Añadidos</span>
                              <span className="font-mono">{formatVal(calc(ri.aa))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Proteína</span>
                              <span className="font-mono">{formatVal(calc(ri.protein))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Grasas Totales</span>
                              <span className="font-mono">{formatVal(calc(ri.fatTotal))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Gr. Sat.</span>
                              <span className="font-mono">{formatVal(calc(ri.fatSat))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Gr. Trans</span>
                              <span className="font-mono">{formatVal(calc(ri.fatTrans))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Fibra</span>
                              <span className="font-mono">{formatVal(calc(ri.fiber))} g</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Sodio</span>
                              <span className="font-mono">{formatVal(calc(ri.sodium))} mg</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-stone-500 font-medium">Agua</span>
                              <span className="font-mono">{formatVal(calc(ri.water))} g</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredRecipes.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
              <p className="text-stone-500">No se encontraron recetas guardadas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
