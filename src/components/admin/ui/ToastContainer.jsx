const TYPES = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  info:    'bg-indigo-600',
  warning: 'bg-yellow-600',
}

export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`${TYPES[t.type] ?? TYPES.info} text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-slide-up`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
