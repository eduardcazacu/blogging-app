import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom"
import { Comment } from "../hooks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getThemePalette } from "../themes";

interface BlogCardProps{
    authorname: string;
    title: string;
    content: string;
    publishedDate: string;
    id: number;
    topComments?: Comment[];
    commentCount?: number;
    themeKey?: string | null;
}

export const BlogCard = ({
    authorname,
    title,
    content,
    publishedDate,
    id,
    topComments = [],
    commentCount = 0,
    themeKey
}: BlogCardProps) => {
  const navigate = useNavigate();
  const theme = getThemePalette(themeKey);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const estimatedReadMinutes = Math.max(1, Math.ceil(wordCount / 225));
  const showReadTime = estimatedReadMinutes > 2;

  useEffect(() => {
    const checkOverflow = () => {
      const el = previewRef.current;
      if (!el) {
        setHasOverflow(false);
        return;
      }
      setHasOverflow(el.scrollHeight > el.clientHeight + 1);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [content]);

  return ( 
  <div
    className="rounded-xl border bg-white p-5 w-full max-w-screen-md cursor-pointer shadow-sm hover:shadow-md transition-shadow"
    style={{ borderColor: theme.border }}
    onClick={() => navigate(`/blog/${id}`)}
    role="link"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        navigate(`/blog/${id}`);
      }
    }}
  >
        <div className="flex">
            <div className="">
            <Avatar size={"small"} name={authorname} themeKey={themeKey}/> 
            </div>
           <div className="font-extralight pl-2 text-sm flex justify-center flex-col">
           {authorname}
           </div>
           <div className="pl-2 flex justify-center flex-col mt-1">
            <Circle />
           </div>
           <div className="text-sm pl-2 font-thin text-slate-500 flex justify-center flex-col">
           {publishedDate} 
           </div>
        </div>
        <div className="text-2xl font-semibold pt-2">
            {title}
        </div>
        <div className="relative">
          <div ref={previewRef} className="markdown-body text-sm font-thin max-h-24 overflow-hidden">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
          </div>
          {hasOverflow ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white" />
          ) : null}
        </div>
        {showReadTime ? (
          <div className="text-slate-400 text-sm pt-4">
            {`${estimatedReadMinutes} min read`}
          </div>
        ) : null}
        {topComments.length > 0 ? (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comments
            </div>
            <div className="mt-2 space-y-2">
              {topComments.map((comment) => (
                <div key={comment.id} className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs font-medium text-slate-700">
                    {comment.author.name || "Anonymous"}
                  </div>
                  <div className="text-sm text-slate-600 break-words">
                    {comment.content}
                  </div>
                </div>
              ))}
            </div>
            {commentCount > 3 ? (
              <div className="mt-2">
                <Link
                  to={`/blog/${id}#comments`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: theme.accent }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {`View all ${commentCount} comments`}
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
    
    </div>
    
  )
}

export function Circle(){
    return <div className="h-1 w-1 rounded-full bg-slate-500">

    </div>
}

export function Avatar({ name, size= "small", themeKey }: { name: string, size: "small" | "big", themeKey?: string | null }){
    const initial = name?.trim()?.[0]?.toUpperCase() || "?";
    const theme = getThemePalette(themeKey);
    return <div className={`relative inline-flex items-center justify-center 
    overflow-hidden rounded-full border ${size === "small" ? "w-6 h-6": "w-10 h-10"}`}
    style={{ backgroundColor: theme.softBg, borderColor: theme.border }}>
        
        <span className={`${size === "small" ? "text-xs" : "text-md"} font-small`} style={{ color: theme.text }}>
            {initial}
        </span>
    </div>
    
}
