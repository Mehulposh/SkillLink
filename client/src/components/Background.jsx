// Fixed gradient + floating blurred blobs: the colourful backdrop that makes the glass panels pop
export default function Background() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-indigo-100 via-sky-50 to-fuchsia-100 transition-colors duration-500 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
      <div className="absolute -left-24 -top-24 h-96 w-96 animate-blob rounded-full bg-indigo-400/40 blur-3xl dark:bg-indigo-600/30" />
      <div className="absolute -right-24 top-1/4 h-[28rem] w-[28rem] animate-blob rounded-full bg-fuchsia-400/30 blur-3xl [animation-delay:-6s] dark:bg-fuchsia-700/25" />
      <div className="absolute -bottom-32 left-1/3 h-96 w-96 animate-blob rounded-full bg-sky-400/40 blur-3xl [animation-delay:-12s] dark:bg-cyan-700/20" />
    </div>
  );
}
