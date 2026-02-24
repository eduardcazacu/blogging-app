export const FullBlogSkeleton = () => {
  return (
    <div className="flex justify-center px-3 py-4 sm:px-6 sm:py-8 animate-pulse" role="status">
      <div className="grid grid-cols-12 w-full max-w-screen-xl gap-5 rounded-xl border border-slate-200 bg-white p-4 sm:gap-8 sm:p-8">
        <div className="col-span-12 md:col-span-8">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="h-6 w-6 rounded-full bg-slate-200 shrink-0 mt-1" />
            <div className="w-full space-y-2">
              <div className="h-8 w-11/12 rounded-lg bg-slate-200 sm:h-10" />
              <div className="h-8 w-3/4 rounded-lg bg-slate-200 sm:h-10" />
            </div>
          </div>

          <div className="pt-3 h-3 w-36 rounded-full bg-slate-200" />

          <div className="pt-4 space-y-3">
            <div className="h-3 w-full rounded-full bg-slate-200" />
            <div className="h-3 w-[96%] rounded-full bg-slate-200" />
            <div className="h-3 w-[92%] rounded-full bg-slate-200" />
            <div className="h-3 w-[88%] rounded-full bg-slate-200" />
            <div className="h-3 w-[84%] rounded-full bg-slate-200" />
            <div className="h-3 w-[90%] rounded-full bg-slate-200" />
            <div className="h-3 w-[76%] rounded-full bg-slate-200" />
          </div>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-5">
            <div className="h-6 w-28 rounded-lg bg-slate-200" />
            <div className="mt-3 h-24 w-full rounded-lg bg-white border border-slate-200" />
            <div className="mt-3 h-9 w-32 rounded-full bg-slate-200" />

            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="h-3 w-28 rounded-full bg-slate-200" />
                <div className="h-2.5 w-20 rounded-full bg-slate-200" />
                <div className="h-3 w-full rounded-full bg-slate-200" />
                <div className="h-3 w-5/6 rounded-full bg-slate-200" />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="h-2.5 w-24 rounded-full bg-slate-200" />
                <div className="h-3 w-11/12 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4">
          <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:mt-3 sm:p-5">
            <div className="h-7 w-40 rounded-lg bg-slate-200" />
            <div className="pt-3 space-y-2">
              <div className="h-3 w-full rounded-full bg-slate-200" />
              <div className="h-3 w-11/12 rounded-full bg-slate-200" />
              <div className="h-3 w-5/6 rounded-full bg-slate-200" />
            </div>
          </div>
        </div>

        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};
