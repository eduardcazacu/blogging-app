export const BlogSkeleton = () => {
  return (
    <div
      role="status"
      className="w-full max-w-screen-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse"
    >
      <div className="flex items-center">
        <div className="h-6 w-6 rounded-full bg-slate-200" />
        <div className="ml-2 h-3 w-24 rounded-full bg-slate-200" />
        <div className="ml-2 mt-0.5 h-1 w-1 rounded-full bg-slate-300" />
        <div className="ml-2 h-3 w-20 rounded-full bg-slate-200" />
      </div>

      <div className="pt-2 space-y-2">
        <div className="h-7 w-11/12 rounded-lg bg-slate-200" />
        <div className="h-7 w-3/4 rounded-lg bg-slate-200" />
      </div>

      <div className="mt-2.5 overflow-hidden rounded-lg bg-slate-100">
        <div className="aspect-square w-full bg-slate-200 sm:aspect-auto sm:h-72" />
      </div>

      <div className="pt-2.5 space-y-2">
        <div className="h-3 w-full rounded-full bg-slate-200" />
        <div className="h-3 w-[92%] rounded-full bg-slate-200" />
        <div className="h-3 w-[85%] rounded-full bg-slate-200" />
      </div>

      <div className="pt-3 h-3 w-24 rounded-full bg-slate-200" />

      <div className="mt-3 border-t border-slate-200 pt-2.5">
        <div className="h-3 w-20 rounded-full bg-slate-200" />
        <div className="mt-1.5 space-y-1.5">
          <div className="rounded-md bg-slate-100 p-2">
            <div className="h-2.5 w-28 rounded-full bg-slate-200" />
            <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200" />
          </div>
          <div className="rounded-md bg-slate-100 p-2">
            <div className="h-2.5 w-24 rounded-full bg-slate-200" />
            <div className="mt-2 h-2.5 w-5/6 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading...</span>
    </div>
  );
};
