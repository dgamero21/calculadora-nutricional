interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    loading?: boolean;
    showCancel?: boolean;
}

export function ConfirmModal({
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Eliminar',
    loading = false,
    showCancel = true
}: ConfirmModalProps) {
    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[1000000005] flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 pointer-events-auto">
                <h3 className="text-lg font-bold text-stone-800 mb-2">{title}</h3>
                <p className="text-stone-500 mb-6 text-sm">{message}</p>
                <div className="flex justify-end gap-2">
                    {showCancel && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCancel(); }}
                            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                            disabled={loading}
                            className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        disabled={loading}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 active:scale-95 font-semibold transition-all disabled:opacity-50 shadow-lg shadow-red-200"
                    >
                        {loading ? 'Saliendo...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
