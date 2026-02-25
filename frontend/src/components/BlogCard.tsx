import { Link, useNavigate } from "react-router-dom"
import { Comment } from "../hooks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getThemePalette } from "../themes";
import { extractStandaloneImagePreviewUrls, getTransformedImageUrl, isImageLikeUrl } from "../lib/content";

interface BlogCardProps{
    authorname: string;
    title: string;
    content: string;
    publishedDate: string;
    id: number;
    imageUrl?: string | null;
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
    imageUrl,
    topComments = [],
    commentCount = 0,
    themeKey
}: BlogCardProps) => {
  const markdownComponents = {
    img: () => null,
    a: (props: any) => (
      <a
        href={props.href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-blue-700 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </a>
    ),
  };

  const truncateCommentPreview = (value: string, maxLength = 120) => {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    return `${trimmed.slice(0, maxLength).trimEnd()}...`;
  };

  const navigate = useNavigate();
  const theme = getThemePalette(themeKey);
  const standaloneImagePreviewUrls = extractStandaloneImagePreviewUrls(content, 2).filter((url) => url !== imageUrl);
  const excerptData = (() => {
    const markdownWithoutStandaloneImages = content
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return true;
        }
        if (isImageLikeUrl(trimmed)) {
          return false;
        }
        if (/^!\[[^\]]*]\((https?:\/\/\S+)\)$/.test(trimmed)) {
          return false;
        }
        if (/^\[[^\]]*]\((https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:[?#]\S*)?)\)$/i.test(trimmed)) {
          return false;
        }
        if (/^<https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:[?#]\S*)?>$/i.test(trimmed)) {
          return false;
        }
        return true;
      })
      .join("\n")
      .trim();

    const plainForLength = markdownWithoutStandaloneImages
      .replace(/\[[^\]]*]\((https?:\/\/\S+)\)/g, "$1")
      .replace(/[*_`>#~-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const limit = 220;
    if (plainForLength.length <= limit) {
      return {
        markdown: markdownWithoutStandaloneImages,
        truncated: false,
      };
    }

    const truncatedMarkdown = markdownWithoutStandaloneImages.slice(0, limit).trimEnd();
    return {
      markdown: `${truncatedMarkdown}...`,
      truncated: true,
    };
  })();
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const estimatedReadMinutes = Math.max(1, Math.ceil(wordCount / 225));
  const showReadTime = estimatedReadMinutes > 2;

  return ( 
  <div
    className="rounded-xl border bg-white p-4 w-full max-w-screen-md cursor-pointer shadow-sm hover:shadow-md transition-shadow sm:p-4"
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
        {imageUrl ? (
          <div className="mt-2.5 overflow-hidden rounded-lg">
            <img
              src={getTransformedImageUrl(imageUrl, { width: 920, fit: "cover", quality: 76 })}
              alt={title}
              loading="lazy"
              className="aspect-square w-full object-cover sm:aspect-auto sm:h-72"
            />
          </div>
        ) : null}
        {standaloneImagePreviewUrls.length > 0 ? (
          <div className="mt-2.5 space-y-1.5">
            {standaloneImagePreviewUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={getTransformedImageUrl(url, { width: 220, fit: "cover", quality: 70 })}
                  alt="Linked image preview"
                  loading="lazy"
                  className="rounded-md object-cover"
                  style={{ width: "42px", height: "42px", margin: 0, maxHeight: "42px", flexShrink: 0 }}
                />
                <div className="text-xs text-slate-600 break-all">Image link preview</div>
              </a>
            ))}
          </div>
        ) : null}
        <div className="markdown-body pt-2 text-sm font-thin leading-6 text-slate-700">
          {excerptData.markdown ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {excerptData.markdown}
            </ReactMarkdown>
          ) : (
            <p>Read the full post for details...</p>
          )}
        </div>
        {excerptData.truncated ? (
          <div className="pt-1">
            <Link
              to={`/blog/${id}`}
              className="text-sm font-medium underline"
              style={{ color: theme.accent }}
              onClick={(e) => e.stopPropagation()}
            >
              Read the full post
            </Link>
          </div>
        ) : null}
        {showReadTime ? (
          <div className="text-slate-400 text-sm pt-3">
            {`${estimatedReadMinutes} min read`}
          </div>
        ) : null}
        {topComments.length > 0 ? (
          <div className="mt-3 border-t border-slate-200 pt-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comments
            </div>
            <div className="mt-1.5 space-y-1.5">
              {topComments.map((comment) => (
                <div key={comment.id} className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs font-medium text-slate-700">
                    {comment.author.name || "Anonymous"}
                  </div>
                  <div className="text-sm text-slate-600 break-words">
                    {truncateCommentPreview(comment.content)}
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
