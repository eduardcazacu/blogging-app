import { Appbar } from "../components/Appbar"
import { BlogCard } from "../components/BlogCard"
import { BlogSkeleton } from "../components/BlogSkeleton";
import { useBlogs } from "../hooks"
import { formatPostedTime } from "../lib/datetime";

export const Blogs = () => {

  const {loading, blogs} = useBlogs();

    if (loading){
      return <div>
        <Appbar/>
        <div className="flex justify-center">
          <div>
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
         publishedDate={formatPostedTime(blog.createdAt)}
         commentCount={blog.commentCount || 0}
         topComments={blog.topComments || []} />) }
        
       
      </div>
      </div>
    </div>
    
  )
}
