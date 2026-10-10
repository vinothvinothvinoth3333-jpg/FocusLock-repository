function CreateRoom({ onCreate, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      disabled={disabled}
      className="w-full rounded-xl bg-indigo-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Create Room
    </button>
  )
}

export default CreateRoom
