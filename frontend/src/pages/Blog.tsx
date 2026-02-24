import { Navigate, useParams } from "react-router-dom";
import { useBlog } from "../hooks";
import { FullBlog } from "../components/FullBlog";
import { Appbar } from "../components/Appbar";
import { FullBlogSkeleton } from "../components/FullBlogSkeleton";

export const Blog = () => {
  const { id } = useParams();
  const { loading, blog, authExpired } = useBlog({
    id: id || "",
  });

  if (authExpired) {
    return <Navigate to="/signin" replace />;
  }

  if (loading || !blog) {
    return (
      <div>
        <Appbar />
        <FullBlogSkeleton />
      </div>
    );
  }

  return (
    <div>
      <FullBlog blog={blog} />
    </div>
  );
};

export default Blog;
