import { Link, useNavigate } from "react-router-dom"
import { Comment } from "../hooks";

interface BlogCardProps{
    authorname: string;
    title: string;
    content: string;
    publishedDate: string;
    id: number;
    topComments?: Comment[];
    commentCount?: number;
}

export const BlogCard = ({
    authorname,
    title,
    content,
    publishedDate,
    id,
    topComments = [],
    commentCount = 0
}: BlogCardProps) => {
  const navigate = useNavigate();

  return ( 
  <div
    className="rounded-xl border border-slate-200 bg-white p-5 w-full max-w-screen-md cursor-pointer shadow-sm hover:shadow-md transition-shadow"
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
            <Avatar size={"small"} name={authorname}/> 
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
        <div className="text-ms font-thin">
            {content.slice(0,100)+"..."}
        </div>
        <div className="text-slate-400 text-sm pt-4">
            {`${Math.ceil(content.length / 100)} minutes(s) read`}
        </div>
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
                  className="text-sm font-medium text-blue-700 hover:underline"
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

export function Avatar({ name, size= "small"}: { name: string, size: "small" | "big"}){
    const initial = name?.trim()?.[0]?.toUpperCase() || "?";
    return <div className={`relative inline-flex items-center justify-center 
    overflow-hidden bg-gray-400 rounded-full ${size === "small" ? "w-6 h-6": "w-10 h-10"}`}>
        
        <span className={`${size === "small" ? "text-xs" : "text-md"} font-small text-gray-900 dark:text-gray-300`}>
            {initial}
        </span>
    </div>
    
}
