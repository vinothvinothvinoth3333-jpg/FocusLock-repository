function JoinRoom({ roomCode, onRoomCodeChange, onJoin, disabled = false }) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        onJoin()
      }}
    >
      <label htmlFor="room-code" className="sr-only">
        Room code
      </label>
      <input
        id="room-code"
        value={roomCode}
        onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())}
        maxLength={35}
        placeholder="Enter room code"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
      />
      <button
        type="submit"
        disabled={disabled || !roomCode.trim()}
        className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Join Room
      </button>
    </form>
  )
}

export default JoinRoom
