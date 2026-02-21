import { Blog } from "../hooks";
import { Appbar } from "./Appbar";
import { Avatar } from "./BlogCard";

function formatPublishedDate(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const FullBlog = ({ blog }: { blog: Blog }) => {
  return (
    <div>
      <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-12 w-full max-w-screen-xl gap-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="col-span-12 md:col-span-8">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <div className="shrink-0 flex flex-col justify-start pt-1">
                  <Avatar size={"small"} name={blog.author.name || "Anonymous"} />
              </div>
              <div className="text-3xl font-extrabold">{blog.title}</div>
            </div>
            <div className="text-slate-500 pt-3">Posted on {formatPublishedDate(blog.createdAt)}</div>
            <div className="pt-4 leading-7">{blog.content}</div>
          </div>

          <div className="col-span-11 md:col-span-4">
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="min-w-0 flex-1 pr-1">
                <div className="text-lg sm:text-xl font-bold leading-tight break-words">
                  About {blog.author.name || "Anonymous"}
                </div>
                <div className="pt-2 text-slate-500 leading-6 break-words">
                  {blog.author.bio?.trim() || "No bio yet."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
