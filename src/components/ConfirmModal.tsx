interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    loading?: boolean;
}

export function ConfirmModal({
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Eliminar',
    loading = false
}: ConfirmModalProps) {
    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-stone-800 mb-2">{title}</h3>
                <p className="text-stone-500 mb-6 text-sm">{message}</p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Eliminando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
