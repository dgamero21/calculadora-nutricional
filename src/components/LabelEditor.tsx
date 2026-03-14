import React, { useState, useEffect } from 'react';
import { NutritionalLabel } from './NutritionalLabel';
import { Ingredient, RecipeIngredient, SavedLabel } from '../types';
import { auth, db as firestore } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Trash2, Clock, Plus, Save, Edit2, AlertCircle, X, Cloud } from 'lucide-react';

export function LabelEditor() {
  const [savedLabels, setSavedLabels] = useState<SavedLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<SavedLabel | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  // Custom Modals & Toasts State
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const [nameModal, setNameModal] = useState<{isOpen: boolean, mode: 'new'|'rename', label?: SavedLabel, name: string, pendingData?: any}>({isOpen: false, mode: 'new', name: 'Nueva Plantilla'});
  const [deleteModal, setDeleteModal] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedLabels();
  }, []);

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const getLocalLabels = (): SavedLabel[] => {
    if (!auth.currentUser) return [];
    const local = localStorage.getItem(`custom_labels_${auth.currentUser.uid}`);
    return local ? JSON.parse(local) : [];
  };

  const saveLocalLabels = (labels: SavedLabel[]) => {
    if (!auth.currentUser) return;
    localStorage.setItem(`custom_labels_${auth.currentUser.uid}`, JSON.stringify(labels));
  };

  const fetchSavedLabels = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    
    let firestoreLabels: SavedLabel[] = [];

    try {
      const q = query(
        collection(firestore, 'custom_labels'), 
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      firestoreLabels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedLabel));
    } catch (err: any) {
      console.error('Firestore fetch failed:', err.message);
      setError('Error al conectar con la nube: ' + err.message);
    }

    const localLabels = getLocalLabels();
    const allLabelsMap = new Map<string, SavedLabel>();
    localLabels.forEach(l => allLabelsMap.set(l.id, l));
    firestoreLabels.forEach(l => allLabelsMap.set(l.id, l));
    
    const mergedLabels = Array.from(allLabelsMap.values());
    mergedLabels.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    setSavedLabels(mergedLabels);
    setLoading(false);
  };

  const handleSave = async (html: string, styles: any, format: any) => {
    if (!auth.currentUser) return;
    
    if (!selectedLabel) {
      // Open modal to ask for name
      setNameModal({
        isOpen: true, 
        mode: 'new', 
        name: 'Nueva Plantilla', 
        pendingData: { html, styles, format }
      });
      return;
    }

    await executeSave(selectedLabel.name, html, styles, format, selectedLabel);
  };

  const executeSave = async (name: string, html: string, styles: any, format: any, existingLabel?: SavedLabel) => {
    if (!auth.currentUser) return;
    
    const labelData = {
      userId: auth.currentUser.uid,
      name,
      html,
      styles,
      format,
      createdAt: existingLabel ? existingLabel.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    try {
      if (existingLabel && !existingLabel.id.startsWith('local_')) {
        // Update existing cloud document
        await setDoc(doc(firestore, 'custom_labels', existingLabel.id), labelData);
      } else {
        // Create new cloud document (even if it was a local label previously)
        await addDoc(collection(firestore, 'custom_labels'), labelData);
        
        // If it was a local label, remove it from local storage now that it's in the cloud
        if (existingLabel && existingLabel.id.startsWith('local_')) {
          const localLabels = getLocalLabels().filter(l => l.id !== existingLabel.id);
          saveLocalLabels(localLabels);
        }
      }
      showToast('Plantilla guardada en la nube con éxito');
      fetchSavedLabels();
    } catch (err: any) {
      console.error('Firestore save failed:', err.message);
      showToast('Error al guardar en la nube: ' + err.message, 'error');
    }
  };

  const confirmNameModal = async () => {
    if (!nameModal.name.trim()) return;
    
    if (nameModal.mode === 'new' && nameModal.pendingData) {
      await executeSave(nameModal.name, nameModal.pendingData.html, nameModal.pendingData.styles, nameModal.pendingData.format);
    } else if (nameModal.mode === 'rename' && nameModal.label) {
      try {
        if (nameModal.label.id.startsWith('local_')) {
          // If renaming a local label, push it to the cloud
          const labelData = { ...nameModal.label, name: nameModal.name };
          const { id, ...dataWithoutId } = labelData as any;
          await addDoc(collection(firestore, 'custom_labels'), dataWithoutId);
          
          // Remove from local
          const localLabels = getLocalLabels().filter(l => l.id !== nameModal.label!.id);
          saveLocalLabels(localLabels);
        } else {
          await setDoc(doc(firestore, 'custom_labels', nameModal.label.id), { ...nameModal.label, name: nameModal.name }, { merge: true });
        }
        fetchSavedLabels();
        if (selectedLabel?.id === nameModal.label.id) {
          setSelectedLabel({ ...nameModal.label, name: nameModal.name });
        }
        showToast('Plantilla renombrada en la nube');
      } catch (err: any) {
        console.error('Firestore rename failed:', err);
        showToast('Error al renombrar en la nube: ' + err.message, 'error');
      }
    }
    setNameModal({isOpen: false, mode: 'new', name: ''});
  };

  const handleRename = (label: SavedLabel, e: React.MouseEvent) => {
    e.stopPropagation();
    setNameModal({isOpen: true, mode: 'rename', label, name: label.name});
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal(id);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const id = deleteModal;
    
    try {
      if (!id.startsWith('local_')) {
        await deleteDoc(doc(firestore, 'custom_labels', id));
      } else {
        const localLabels = getLocalLabels();
        const updated = localLabels.filter(l => l.id !== id);
        saveLocalLabels(updated);
      }
      showToast('Plantilla eliminada');
    } catch (err: any) {
      console.error('Firestore delete failed:', err);
      showToast('Error al eliminar: ' + err.message, 'error');
    }

    fetchSavedLabels();
    if (selectedLabel?.id === id) {
      setSelectedLabel(null);
      setEditorKey(prev => prev + 1);
    }
    setDeleteModal(null);
  };

  const handleSelectLabel = (label: SavedLabel) => {
    setSelectedLabel(label);
    setEditorKey(prev => prev + 1);
  };

  const handleNew = () => {
    setSelectedLabel(null);
    setEditorKey(prev => prev + 1);
    showToast('Editor listo para nueva plantilla');
  };

  const emptyRecipe: RecipeIngredient[] = [];
  const emptyDb: Ingredient[] = [];
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-lg z-50 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Name Modal */}
      {nameModal.isOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800">
                {nameModal.mode === 'new' ? 'Guardar Nueva Plantilla' : 'Renombrar Plantilla'}
              </h3>
              <button onClick={() => setNameModal({isOpen: false, mode: 'new', name: ''})} className="text-stone-400 hover:text-stone-600">
                <X size={20} />
              </button>
            </div>
            <input 
              type="text" 
              value={nameModal.name}
              onChange={e => setNameModal({...nameModal, name: e.target.value})}
              className="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none mb-6 text-stone-700"
              placeholder="Ej. Rótulo Alfajores"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmNameModal()}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setNameModal({isOpen: false, mode: 'new', name: ''})}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmNameModal}
                disabled={!nameModal.name.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Cloud size={16} />
                Guardar en Nube
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-stone-800 mb-2">Eliminar Plantilla</h3>
            <p className="text-stone-500 mb-6 text-sm">¿Estás seguro de que deseas eliminar esta plantilla? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-800">
            {selectedLabel ? `Editando: ${selectedLabel.name}` : 'Editor Libre de Rótulos'}
          </h2>
          <p className="text-sm text-stone-500">
            Usa esta sección para crear o editar rótulos manualmente. Haz clic en cualquier texto del rótulo para modificarlo.
          </p>
        </div>
        <button 
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors text-sm font-medium shrink-0"
        >
          <Plus size={16} />
          Nueva Plantilla
        </button>
      </div>

      {/* Plantillas Guardadas */}
      <div className="mb-8 bg-stone-50 p-4 rounded-xl border border-stone-100">
        <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <Save size={16} className="text-emerald-600" />
          Mis Plantillas Guardadas
        </h3>
        
        {loading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50/50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Error de Firestore</p>
              <p className="text-red-500/80">{error}</p>
            </div>
          </div>
        ) : savedLabels.length === 0 ? (
          <div className="text-center py-6 text-stone-400 text-sm italic bg-white rounded-xl border border-stone-100 shadow-sm">
            No hay plantillas guardadas
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {savedLabels.map(label => (
              <div 
                key={label.id}
                onClick={() => handleSelectLabel(label)}
                className={`shrink-0 w-56 group p-3 rounded-xl border cursor-pointer transition-all snap-start ${
                  selectedLabel?.id === label.id 
                    ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                    : 'bg-white border-stone-200 hover:border-emerald-300 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className={`text-sm font-medium truncate pr-2 ${selectedLabel?.id === label.id ? 'text-emerald-700' : 'text-stone-700'}`}>
                    {label.name}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button 
                      onClick={(e) => handleRename(label, e)}
                      className="p-1 text-stone-400 hover:text-emerald-600 rounded hover:bg-stone-100"
                      title="Renombrar"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(label.id, e)}
                      className="p-1 text-stone-400 hover:text-red-600 rounded hover:bg-stone-100"
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-stone-400">
                  <Clock size={10} />
                  {new Date(label.createdAt).toLocaleDateString()}
                  {label.id.startsWith('local_') && <span className="ml-1 text-amber-500 font-medium" title="Guardado localmente. Haz clic en Guardar para subir a la nube.">⚠️ Local</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-stone-100 pt-6" key={editorKey}>
        <NutritionalLabel 
          recipe={emptyRecipe}
          db={emptyDb}
          portionSize={100}
          productName={selectedLabel ? "" : "Nombre del Producto"}
          clientName={selectedLabel ? "" : "Nombre del Cliente"}
          initialEditable={true}
          initialHtml={selectedLabel?.html}
          initialStyles={selectedLabel?.styles}
          initialFormat={selectedLabel?.format}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
