import { useEffect, useRef } from "react";
import { Appbar } from "../components/Appbar"
import { BlogCard } from "../components/BlogCard"
import { BlogSkeleton } from "../components/BlogSkeleton";
import { useBlogs } from "../hooks"
import { formatPostedTime } from "../lib/datetime";
import { Navigate, useSearchParams } from "react-router-dom";

export const Blogs = () => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const pagesParam = Number(searchParams.get("pages") || "1");
  const initialPages = Number.isFinite(pagesParam) ? Math.max(1, Math.min(10, pagesParam)) : 1;

  const {loading, loadingMore, blogs, authExpired, hasMore, loadedPages, fetchNextPage} = useBlogs(initialPages);

    useEffect(() => {
      if (!hasMore) {
        return;
      }

      const element = loadMoreRef.current;
      if (!element) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting) {
            fetchNextPage();
          }
        },
        {
          root: null,
          rootMargin: "240px 0px",
          threshold: 0
        }
      );

      observer.observe(element);
      return () => observer.disconnect();
    }, [fetchNextPage, hasMore]);

    useEffect(() => {
      const current = Number(searchParams.get("pages") || "1");
      if (current === loadedPages) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.set("pages", String(loadedPages));
      setSearchParams(next, { replace: true });
    }, [loadedPages, searchParams, setSearchParams]);

    if (authExpired) {
      return <Navigate to="/signin" replace />;
    }

    if (loading){
      return <div>
        <Appbar/>
        <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
          <div className="w-full max-w-screen-md space-y-4">
          <BlogSkeleton />
          <BlogSkeleton />
          <BlogSkeleton />
          <BlogSkeleton />
          <BlogSkeleton />
          <BlogSkeleton />
          <BlogSkeleton />
          <BlogSkeleton />
          </div>
          
        </div>
      </div>
    }
  

  return (
    <div>
       <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="w-full max-w-screen-md space-y-4">
        {blogs.map(blog => <BlogCard 
         key={blog.id}
         id={blog.id}
         authorname ={blog.author.name || "Anonymous"}
         title={blog.title}
         content={blog.content}
         imageUrl={blog.imageUrl || undefined}
         publishedDate={formatPostedTime(blog.createdAt)}
         commentCount={blog.commentCount || 0}
         topComments={blog.topComments || []}
         themeKey={blog.author.themeKey || undefined} />) }
        {loadingMore ? (
          <>
            <BlogSkeleton />
            <BlogSkeleton />
          </>
        ) : null}
        {hasMore ? <div ref={loadMoreRef} className="h-2 w-full" /> : null}
       
      </div>
      </div>
    </div>
    
  )
}
