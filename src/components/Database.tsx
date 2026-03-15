import React, { useState, useMemo, useEffect } from 'react';
import { Ingredient, CustomColumn } from '../types';
import { evaluateFormula } from '../utils';
import { ConfirmModal } from './ConfirmModal';
import { Plus, Search, Trash2, GripHorizontal, ArrowUpDown, Edit3, Settings2, X, Save, ChevronDown } from 'lucide-react';
import { db as firestore, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDocs } from 'firebase/firestore';
import { FormulaBuilder } from './FormulaBuilder';

type ColumnKey = keyof Ingredient | 'actions' | string;

interface ColumnDef {
  key: ColumnKey;
  label: string;
  formula?: string;
  editable: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Ingrediente', editable: true },
  { key: 'carbs', label: 'Hidratos Carbono (g)', editable: true },
  { key: 'at', label: 'AT (g)', editable: true },
  { key: 'aa', label: 'AA (g)', editable: true },
  { key: 'protein', label: 'Proteína (g)', editable: true },
  { key: 'fatTotal', label: 'Grasas Totales (g)', editable: true },
  { key: 'fatSat', label: 'Gr. Sat. (g)', editable: true },
  { key: 'fatTrans', label: 'Gr. Trans (g)', editable: true },
  { key: 'fiber', label: 'Fibra (g)', editable: true },
  { key: 'sodium', label: 'Na (mg)', editable: true },
  { key: 'water', label: 'Agua (g)', editable: true },
  { key: 'actions', label: 'Acciones', editable: false },
];

function ColumnManagerModal({
  customColumns,
  setCustomColumns,
  onClose
}: {
  customColumns: CustomColumn[],
  setCustomColumns: (cols: CustomColumn[]) => void,
  onClose: () => void
}) {
  const [cols, setCols] = useState<CustomColumn[]>(
    customColumns.filter(c => !c.id.startsWith('sys_'))
  );
  const [saving, setSaving] = useState(false);
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [confirmRemoveName, setConfirmRemoveName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const isInvalid = cols.some(c => 
    !c.name.trim() || 
    c.name === 'Nueva Columna' ||
    (c.type === 'formula' && !c.formula?.trim())
  );

  const handleAdd = () => {
    const newCol: CustomColumn = {
      id: `col_${Date.now()}`,
      name: 'Nueva Columna',
      code: 'nueva_columna',
      unit: 'g',
      type: 'formula',
      formula: '',
      showInLabel: false
    };
    setCols([...cols, newCol]);
    setLastAddedId(newCol.id);
    setIsDirty(true);
  };

  const handleUpdate = (index: number, field: keyof CustomColumn, value: any) => {
    const newCols = [...cols];
    newCols[index] = { ...newCols[index], [field]: value };

    // Always sync code with name
    if (field === 'name') {
      newCols[index].code = value.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    if (JSON.stringify(cols[index]) !== JSON.stringify(newCols[index])) {
      setCols(newCols);
      setIsDirty(true);
    }
  };

  const handleRemove = (index: number, colName: string) => {
    setConfirmRemoveName(colName);
    setConfirmRemoveIndex(index);
  };

  const executeRemove = () => {
    if (confirmRemoveIndex !== null) {
      setCols(cols.filter((_, i) => i !== confirmRemoveIndex));
      setConfirmRemoveIndex(null);
      setIsDirty(true);
    }
  };
  const handleSave = () => {
    // Validate codes
    const codes = cols.map(c => c.code).filter(Boolean);
    const uniqueCodes = new Set(codes);
    if (codes.length !== uniqueCodes.size) {
      alert('Error: Los códigos de las columnas deben ser únicos.');
      return;
    }

    const baseCols = ['carbs', 'protein', 'fatTotal', 'fatSat', 'fatTrans', 'fiber', 'sodium', 'water', 'at', 'aa'];
    const hasReservedCode = cols.some(c => baseCols.includes(c.code));
    if (hasReservedCode) {
      alert(`Error: No puedes usar los siguientes códigos reservados: ${baseCols.join(', ')}`);
      return;
    }

    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    setShowSaveConfirm(false);
    setSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      const systemCols = customColumns.filter(c => c.id.startsWith('sys_'));
      if (userId) {
        try {
          await setDoc(doc(firestore, 'settings', userId), {
            customColumns: cols  // only user cols stored
          }, { merge: true });
        } catch (fsError) {
          console.warn('Could not save to Firestore, falling back to localStorage:', fsError);
          localStorage.setItem(`customColumns_${userId}`, JSON.stringify(cols));
        }
      }

      // Re-merge system columns at the front
      setCustomColumns([...systemCols, ...cols]);
      onClose();
    } catch (error) {
      console.error('Error saving columns:', error);
      alert('Error al guardar las columnas.');
    }
    setSaving(false);
  };

  return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      {confirmRemoveName && confirmRemoveIndex !== null && (
        <ConfirmModal
          title="Eliminar columna"
          message={`¿Estás seguro de que deseas eliminar la columna "${confirmRemoveName}"? Esta acción no se puede deshacer.`}
          onConfirm={executeRemove}
          onCancel={() => { setConfirmRemoveIndex(null); setConfirmRemoveName(''); }}
        />
      )}
      {showSaveConfirm && (
        <ConfirmModal
          title="Guardar Cambios"
          message="¿Estás seguro de que quieres guardar la configuración de las columnas? Esto afectará a la visualización de todos tus ingredientes."
          confirmLabel="Sí, Guardar"
          onConfirm={executeSave}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-stone-800">Configurar Columnas Personalizadas</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 mb-4 space-y-4">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
            <p className="font-semibold mb-1">¿Cómo usar las fórmulas?</p>
            <p>Puedes crear columnas que se calculen automáticamente basadas en otras. Usa los códigos de las columnas base: <strong>carbs, protein, fatTotal, fatSat, fatTrans, fiber, sodium, water, at, aa</strong> o el código de otra columna personalizada.</p>
            <p className="mt-1 text-xs opacity-80">Ejemplo: <code className="bg-blue-100 px-1 rounded">carbs * 4 + protein * 4</code></p>
          </div>

          {cols.map((col, index) => (
            <details
              key={col.id}
              className="bg-stone-50 rounded-xl border border-stone-200 relative group overflow-hidden"
              open={col.id === lastAddedId}
            >
              <summary className="p-4 font-bold text-stone-800 flex justify-between items-center cursor-pointer list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-stone-200 bg-stone-50 group-open:bg-white hover:bg-stone-100 transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-5 h-5 text-stone-500 group-open:rotate-180 transition-transform" />
                  <span>{col.name || 'Nueva Columna'}</span>
                </div>
                {/* Only show delete button for non-system columns */}
                {!col.id.startsWith('sys_') && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleRemove(index, col.name); }}
                    className="text-stone-400 hover:text-red-500 p-2 -my-2 -mr-2"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </summary>

              <div className="p-4 flex flex-col gap-3 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="block text-xs font-medium text-stone-500">Nombre (Visible)</label>
                    <input
                      type="text"
                      value={col.name === 'Nueva Columna' ? '' : col.name}
                      placeholder="Nueva Columna"
                      onChange={e => handleUpdate(index, 'name', e.target.value || 'Nueva Columna')}
                      className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    />
                    <p className="text-[10px] text-stone-400 leading-tight">Nombre que aparecerá en la cabecera de la tabla.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-stone-500">Unidad (ej. g, mg)</label>
                    <input
                      type="text"
                      value={col.unit}
                      onChange={e => handleUpdate(index, 'unit', e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    />
                    <p className="text-[10px] text-stone-400 leading-tight">Unidad de medida del valor.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-stone-500">Tipo de Columna</label>
                    <select
                      value={col.type}
                      onChange={e => handleUpdate(index, 'type', e.target.value as 'manual' | 'formula')}
                      className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                    >
                      <option value="manual">Valor Manual</option>
                      <option value="formula">Fórmula Automática</option>
                    </select>
                    <p className="text-[10px] text-stone-400 leading-tight">Define si entra a mano o se calcula.</p>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id={`showInLabel-${col.id}`}
                      checked={col.showInLabel || false}
                      onChange={e => handleUpdate(index, 'showInLabel', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-stone-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor={`showInLabel-${col.id}`} className="text-xs font-medium text-stone-600 cursor-pointer">
                      Mostrar en Rótulo
                    </label>
                  </div>
                </div>

                {col.type === 'formula' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Fórmula Matemática</label>
                    <FormulaBuilder
                      value={col.formula || ''}
                      onChange={(val) => handleUpdate(index, 'formula', val)}
                      customColumns={cols}
                      currentColCode={col.code}
                    />
                  </div>
                )}
              </div>
            </details>
          ))}

          {cols.length === 0 && (
            <div className="text-center py-8 text-stone-500 text-sm">
              No tienes columnas personalizadas. Haz clic en "Agregar Columna" para crear una.
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center pt-4 border-t border-stone-200">
          <button
            onClick={handleAdd}
            className="text-emerald-600 bg-emerald-50 sm:bg-transparent hover:bg-emerald-100 sm:hover:bg-emerald-50 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-medium transition-colors flex justify-center items-center gap-2"
          >
            <Plus size={16} />
            Agregar Columna
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 sm:py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || isInvalid}
              className="flex-1 px-4 py-2.5 sm:py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors flex justify-center items-center gap-2 text-sm disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IngredientModal({
  ingredient,
  onClose,
  onSave,
  customColumns
}: {
  ingredient?: Ingredient,
  onClose: () => void,
  onSave: (ing: Partial<Ingredient>) => Promise<boolean>,
  customColumns: CustomColumn[]
}) {
  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: '',
    unit: 100,
    carbs: 0,
    protein: 0,
    fatTotal: 0,
    fatSat: 0,
    fatTrans: 0,
    fiber: 0,
    sodium: 0,
    water: 0,
    at: 0,
    aa: 0,
    ...ingredient
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      // Use parent's method to show error if possible, or keep simple for now
      // Actually, let's keep it consistent: handleSaveIngredient will check it
    }
    setSaving(true);
    const success = await onSave(formData);
    setSaving(false);
    if (success) onClose();
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-0">
          <h3 className="text-lg font-bold text-stone-800">
            {ingredient ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={24} />
          </button>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4 mt-2">
          <p className="text-emerald-800 text-xs font-medium flex items-center gap-2">
            <span className="bg-emerald-200 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Importante</span>
            Cargar los valores nutricionales cada 100g.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 space-y-4 pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-600 mb-1">Nombre del Ingrediente</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ej. Harina de Trigo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Hidratos de Carbono (g)</label>
              <input
                type="text"
                value={formData.carbs}
                onChange={e => handleChange('carbs', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Proteína (g)</label>
              <input
                type="text"
                value={formData.protein}
                onChange={e => handleChange('protein', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Grasas Totales (g)</label>
              <input
                type="text"
                value={formData.fatTotal}
                onChange={e => handleChange('fatTotal', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Grasas Saturadas (g)</label>
              <input
                type="text"
                value={formData.fatSat}
                onChange={e => handleChange('fatSat', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Grasas Trans (g)</label>
              <input
                type="text"
                value={formData.fatTrans}
                onChange={e => handleChange('fatTrans', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Fibra Alimentaria (g)</label>
              <input
                type="text"
                value={formData.fiber}
                onChange={e => handleChange('fiber', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Sodio (mg)</label>
              <input
                type="text"
                value={formData.sodium}
                onChange={e => handleChange('sodium', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Agua (g)</label>
              <input
                type="text"
                value={formData.water}
                onChange={e => handleChange('water', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">AT (g)</label>
              <input
                type="text"
                value={formData.at}
                onChange={e => handleChange('at', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">AA (g)</label>
              <input
                type="text"
                value={formData.aa}
                onChange={e => handleChange('aa', e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Custom Manual Columns */}
            {customColumns.filter(c => c.type === 'manual').map(col => (
              <div key={col.id}>
                <label className="block text-sm font-medium text-stone-600 mb-1">{col.name} ({col.unit})</label>
                <input
                  type="text"
                  value={formData[col.id] || 0}
                  onChange={e => handleChange(col.id, e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Ingrediente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Database({
  db,
  setDb,
  fetchIngredients,
  customColumns,
  setCustomColumns,
  isTourMode = false
}: {
  db: Ingredient[],
  setDb: (db: Ingredient[]) => void,
  fetchIngredients: () => void,
  customColumns: CustomColumn[],
  setCustomColumns: (cols: CustomColumn[]) => void,
  isTourMode?: boolean
}) {
  const [search, setSearch] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [draggedCol, setDraggedCol] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string, key: keyof Ingredient | string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: ColumnKey, direction: 'asc' | 'desc' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | undefined>(undefined);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [nameRequiredError, setNameRequiredError] = useState(false);

  // Sync custom columns to the table columns
  useEffect(() => {
    const customColDefs: ColumnDef[] = customColumns.map(c => ({
      key: c.id,
      label: `${c.name} ${c.unit ? `(${c.unit})` : ''}`,
      editable: c.type === 'manual',
      formula: c.formula
    }));

    // Insert custom columns before 'actions'
    const newCols = [...DEFAULT_COLUMNS];
    newCols.splice(newCols.length - 1, 0, ...customColDefs);
    setColumns(newCols);
  }, [customColumns]);

  const filteredDb = db.filter(ing => ing.name.toLowerCase().includes(search.toLowerCase()));

  const sortedDb = useMemo(() => {
    let sortableItems = [...filteredDb];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof Ingredient];
        let bVal: any = b[sortConfig.key as keyof Ingredient];

        const getVal = (val: any, defaultFormula: string) => {
          if (!val || val === '0' || val === 0) return defaultFormula;
          return val;
        };

        if (sortConfig.key === 'name') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredDb, sortConfig, customColumns]);

  const handleSort = (key: ColumnKey) => {
    if (key === 'actions') return;
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const confirmDelete = (ing: Ingredient) => {
    setIngredientToDelete(ing);
  };

  const executeDelete = async () => {
    if (!ingredientToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, 'ingredients', ingredientToDelete.id));
      setDb(db.filter(i => i.id !== ingredientToDelete.id));
      fetchIngredients();
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      alert('Error al eliminar el ingrediente.');
    }
    setLoading(false);
    setIngredientToDelete(null);
  };


  const handleNew = () => {
    setSelectedIngredient(undefined);
    setShowIngredientModal(true);
  };

  const handleEdit = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setShowIngredientModal(true);
  };

  const handleSaveIngredient = async (formData: Partial<Ingredient>) => {
    setLoading(true);
    const userId = auth.currentUser?.uid;

    if (!userId) {
      setLoading(false);
      return;
    }

    // Check for empty name
    if (!formData.name || !formData.name.trim()) {
      setNameRequiredError(true);
      setLoading(false);
      return false;
    }

    // Check for duplicate name
    const newName = (formData.name || '').trim().toLowerCase();
    const duplicate = db.find(ing => {
      const sameName = ing.name.trim().toLowerCase() === newName;
      // When editing, exclude the current ingredient from the check
      const isDifferent = !selectedIngredient || ing.id !== selectedIngredient.id;
      return sameName && isDifferent;
    });

    if (duplicate) {
      setDuplicateError(duplicate.name);
      setLoading(false);
      return false;
    }

    try {
      if (selectedIngredient) {
        // Update existing
        await updateDoc(doc(firestore, 'ingredients', selectedIngredient.id), formData);
      } else {
        // Create new
        const newIng = {
          ...formData,
          userId,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'ingredients'), newIng);
      }
      fetchIngredients();
      return true;
    } catch (error) {
      console.error('Error saving ingredient:', error);
      alert('Error al guardar el ingrediente.');
      return false;
    }
    setLoading(false);
  };

  const startEdit = (ing: Ingredient, key: keyof Ingredient | string) => {
    setEditingCell({ id: ing.id, key });
    const val = ing[key];
    setEditValue(val === 0 ? '' : String(val || ''));
  };

  const saveEdit = async () => {
    if (editingCell) {
      setLoading(true);
      const val = editValue;

      try {
        await updateDoc(doc(firestore, 'ingredients', editingCell.id), {
          [editingCell.key]: val
        });

        // Update local state immediately for better UX
        setDb(db.map(ing => {
          if (ing.id === editingCell.id) {
            return { ...ing, [editingCell.key]: val };
          }
          return ing;
        }));
      } catch (error) {
        console.error('Error updating ingredient:', error);
        alert('Error al actualizar el ingrediente.');
      }
      setEditingCell(null);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const format = (val: number | undefined) => {
    if (val === undefined || val === null) return '';
    if (val === 0) return '0';
    // User requested: 1 decimal place, comma separator, no thousands separator (e.g. "337,5")
    return val.toFixed(1).replace('.', ',');
  };

  const handleDragStart = (index: number) => {
    setDraggedCol(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCol === null || draggedCol === index) return;

    const newCols = [...columns];
    const draggedItem = newCols[draggedCol];
    newCols.splice(draggedCol, 1);
    newCols.splice(index, 0, draggedItem);

    setDraggedCol(index);
    setColumns(newCols);
  };

  const handleDragEnd = () => {
    setDraggedCol(null);
  };

  const handleBulkImport = async (textToImport?: string) => {
    const text = textToImport || bulkText;
    if (!text.trim()) return;
    setBulkLoading(true);
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const lines = text.split('\n');
      const batch = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        // Split by tabs or multiple spaces
        const parts = line.split(/\t| {2,}/).map(p => p.trim());
        if (parts.length < 2) continue; // Skip lines that don't look like data

        const name = parts[0];
        // If it's a header or empty name, skip
        if (name.toLowerCase().includes('ingrediente') || !name) continue;

        const parseVal = (val: string) => {
          if (!val) return 0;
          return Number(val.replace(',', '.')) || 0;
        };

        // Detect if the row has Energy columns (Kcal, Kj) before base nutrients
        // Standard format with energy: Name, Kcal, Kj, Carbs, Protein, FatTotal, FatSat, FatTrans, Fiber, Sodium, Water, AT, AA (13 columns)
        // Standard format without energy: Name, Carbs, Protein, FatTotal... (11 columns)
        let offset = 0;
        if (parts.length >= 13) {
          offset = 2; // Shift by 2 to skip Kcal and Kj
        }

        const carbs = parseVal(parts[1 + offset]);
        const protein = parseVal(parts[2 + offset]);
        const fatTotal = parseVal(parts[3 + offset]);

        const ingData: Partial<Ingredient> = {
          name,
          unit: 100,
          carbs,
          protein,
          fatTotal,
          fatSat: parseVal(parts[4 + offset]),
          fatTrans: parseVal(parts[5 + offset]),
          fiber: parseVal(parts[6 + offset]),
          sodium: parseVal(parts[7 + offset]),
          water: parseVal(parts[8 + offset]),
          at: parseVal(parts[9 + offset]),
          aa: parseVal(parts[10 + offset]),
          userId,
          createdAt: new Date().toISOString()
        };

        // Check if ingredient already exists to update or create
        const existing = db.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          batch.push(updateDoc(doc(firestore, 'ingredients', existing.id), ingData));
        } else {
          batch.push(addDoc(collection(firestore, 'ingredients'), ingData));
        }
      }

      await Promise.all(batch);
      setBulkText('');
      setShowBulkModal(false);
      fetchIngredients();
      alert(`Se procesaron ${batch.length} ingredientes correctamente.`);
    } catch (error) {
      console.error('Error in bulk import:', error);
      alert('Error al importar los datos. Revisa el formato.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar TODOS los ingredientes? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    try {
      const batch = [];
      for (const ing of db) {
        batch.push(deleteDoc(doc(firestore, 'ingredients', ing.id)));
      }

      await Promise.all(batch);
      fetchIngredients();
      alert('Base de datos eliminada correctamente.');
    } catch (error) {
      console.error('Error deleting all:', error);
      alert('Error al eliminar la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 flex flex-col h-[calc(100dvh-185px)] sm:h-[calc(100vh-160px)] min-h-[400px]">
      {showColumnManager && (
        <ColumnManagerModal
          customColumns={customColumns}
          setCustomColumns={setCustomColumns}
          onClose={() => setShowColumnManager(false)}
        />
      )}
      {showIngredientModal && (
        <IngredientModal
          ingredient={selectedIngredient}
          customColumns={customColumns}
          onClose={() => setShowIngredientModal(false)}
          onSave={handleSaveIngredient}
        />
      )}
      {duplicateError && (
        <ConfirmModal
          title="Nombre Duplicado"
          message={`Ya existe un ingrediente con el nombre "${duplicateError}". Por favor, elija un nombre diferente.`}
          confirmLabel="Entendido"
          showCancel={false}
          onConfirm={() => setDuplicateError(null)}
          onCancel={() => setDuplicateError(null)}
        />
      )}
      {nameRequiredError && (
        <ConfirmModal
          title="Dato Obligatorio"
          message="El nombre del ingrediente es obligatorio para poder guardarlo."
          confirmLabel="Corregir"
          showCancel={false}
          onConfirm={() => setNameRequiredError(false)}
          onCancel={() => setNameRequiredError(false)}
        />
      )}
      {showBulkModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800">Importación Masiva</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-stone-400 hover:text-stone-600">
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-4">
              Pega aquí los datos desde Excel. El formato debe ser: Nombre [Tab] Carbohidratos [Tab] Proteína [Tab] Grasas Totales...
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              className="flex-1 w-full p-4 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-xs resize-none"
              placeholder="Ejemplo: Pan Integral	50	10	5..."
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-6 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkImport}
                disabled={bulkLoading || !bulkText.trim()}
                className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {bulkLoading ? 'Procesando...' : 'Importar Datos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {ingredientToDelete && (
        <ConfirmModal
          title="Eliminar ingrediente"
          message={`Estás a punto de eliminar "${ingredientToDelete.name}". Esta acción no se puede deshacer.`}
          onConfirm={executeDelete}
          onCancel={() => setIngredientToDelete(null)}
          loading={loading}
        />
      )}

      {/* Controles de tabla - Responsive Mobile */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 sm:items-center w-full">
        <div className="relative flex-1 w-full min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            id="tour-db-search"
            type="text"
            placeholder="Buscar ingrediente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 sm:py-2 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm text-sm"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            id="tour-db-cols"
            onClick={() => setShowColumnManager(true)}
            className="flex-1 sm:flex-none bg-stone-100 text-stone-700 px-4 py-2.5 sm:py-2 rounded-xl shadow-sm border border-stone-200 hover:bg-stone-200 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
          >
            <Settings2 size={18} />
            <span>Columnas</span>
          </button>
          <button
            id="tour-db-new"
            type="button"
            onClick={handleNew}
            disabled={loading}
            className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2.5 sm:py-2 rounded-xl shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <Plus size={18} />
            <span>Nuevo Ingrediente</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-auto flex-1 relative">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[10px] uppercase text-stone-600 bg-stone-100 sticky top-0 z-30 shadow-sm">
            <tr>
              {/* Sticky row number column */}
              <th className="px-1 py-2 font-semibold border-b border-stone-200 bg-stone-200 sticky left-0 z-20 min-w-[32px] w-[32px] max-w-[32px] text-center">#</th>
              {columns.map((col, index) => (
                <th
                  key={col.key}
                  draggable={col.key !== 'actions'}
                  onDragStart={() => col.key !== 'actions' && handleDragStart(index)}
                  onDragOver={(e) => col.key !== 'actions' && handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`px-2 py-2 font-semibold leading-tight border-b border-stone-200 select-none min-w-[60px] ${col.key === 'actions'
                    ? 'bg-stone-100 border-x border-stone-200'
                    : col.key === 'name'
                      ? 'bg-stone-100 sticky left-[32px] z-20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)] min-w-[150px]'
                      : col.editable
                        ? 'bg-emerald-50/50 border-x border-emerald-100 min-w-[80px]'
                        : 'bg-stone-100 border-x border-stone-200 min-w-[80px]'
                    }`}
                  title={col.formula || (col.editable ? 'Click para editar' : '')}
                >
                  <div className="flex items-center gap-1 justify-between">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-emerald-700 flex-1" onClick={() => handleSort(col.key)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.editable && <Edit3 size={10} className="text-emerald-500" />}
                      </span>
                      {col.key !== 'actions' && (
                        <ArrowUpDown size={10} className={sortConfig?.key === col.key ? 'text-emerald-600' : 'text-stone-400 opacity-50'} />
                      )}
                    </div>
                    {col.key !== 'actions' && (
                      <GripHorizontal size={12} className="text-stone-400 cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedDb.map((ing, i) => {
              return (
                <tr 
                  key={ing.id} 
                  id={i === 0 ? "tour-db-first-row" : undefined}
                  className="border-b border-stone-100 hover:bg-stone-50/80 transition-colors"
                >
                  {/* Sticky row number */}
                  <td className="px-1 py-1.5 text-center text-stone-400 font-mono text-[10px] bg-stone-50 sticky left-0 z-10 border-r border-stone-200 min-w-[32px] w-[32px] max-w-[32px]">
                    {i + 1}
                  </td>
                  {columns.map(col => {
                    if (col.key === 'actions') {
                      return (
                        <td key={col.key} className="px-2 py-1.5 border-x border-stone-100 bg-stone-50/30">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEdit(ing)} className="p-1 text-stone-400 hover:text-emerald-600 rounded hover:bg-emerald-50 transition-colors" title="Editar">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => confirmDelete(ing)} className="p-1 text-stone-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors" title={`Eliminar ${ing.name}`}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      );
                    }

                    const customCol = customColumns.find(c => c.id === col.key);
                    const isEditing = editingCell?.id === ing.id && editingCell?.key === col.key;

                    let val: any = ing[col.key as keyof Ingredient];
                    if (customCol && customCol.type === 'formula') {
                      val = customCol.formula;
                    } else if ((!val || val === '0' || val === 0) && col.formula) {
                      val = col.formula;
                    }

                    const displayVal = evaluateFormula(val, ing, customColumns);

                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 border-x ${col.key === 'name'
                          ? 'bg-white sticky left-[32px] z-10 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)] border-stone-100 min-w-[150px]'
                          : col.editable ? 'bg-white border-emerald-50 hover:bg-emerald-50/50 cursor-text min-w-[80px]' : 'bg-stone-50/30 border-stone-100 min-w-[80px]'
                          }`}
                        onClick={() => col.editable && startEdit(ing, col.key)}
                        title={typeof val === 'string' && val.startsWith('=') ? val : ''}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-white border border-emerald-500 rounded px-1 py-0.5 outline-none text-xs shadow-sm"
                          />
                        ) : (
                          <span className={col.key === 'name' ? 'font-medium text-stone-800' : 'text-stone-700'}>
                            {col.key === 'name' ? val : format(displayVal)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {sortedDb.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-stone-500">
                  No se encontraron ingredientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
