import { Appbar } from "../components/Appbar"
import { BlogCard } from "../components/BlogCard"
import { BlogSkeleton } from "../components/BlogSkeleton";
import { useBlogs } from "../hooks"

function formatPublishedDate(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
      <div  className="flex justify-center">
        <div className="">
        {blogs.map(blog => <BlogCard 
         id={blog.id}
         authorname ={blog.author.name || "Anonymous"}
         title={blog.title}
         content={blog.content}
         publishedDate={formatPublishedDate(blog.createdAt)} />) }
        
       
      </div>
      </div>
    </div>
    
  )
}
