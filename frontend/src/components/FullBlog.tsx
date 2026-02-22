import axios from "axios";
import { useEffect, useState } from "react";
import { Blog } from "../hooks";
import { Appbar } from "./Appbar";
import { Avatar } from "./BlogCard";
import { BACKEND_URL } from "../config";
import { getAuthHeader } from "../lib/auth";
import { formatPostedTime } from "../lib/datetime";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const FullBlog = ({ blog }: { blog: Blog }) => {
  const [comments, setComments] = useState(blog.comments || []);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    setComments(blog.comments || []);
  }, [blog.id, blog.comments]);

  async function submitComment() {
    const content = commentInput.trim();
    if (!content) {
      setCommentError("Comment cannot be empty.");
      return;
    }
    setSubmitting(true);
    setCommentError(null);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/blog/${blog.id}/comments`,
        { content },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      const comment = response.data?.comment;
      if (comment) {
        setComments((existing) => [...existing, comment]);
      }
      setCommentInput("");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setCommentError(e.response?.data?.msg || "Failed to post comment.");
      } else {
        setCommentError("Failed to post comment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Appbar />
      <div className="flex justify-center px-3 py-4 sm:px-6 sm:py-8">
        <div className="grid grid-cols-12 w-full max-w-screen-xl gap-5 rounded-xl border border-slate-200 bg-white p-4 sm:gap-8 sm:p-8">
          <div className="col-span-12 md:col-span-8">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <div className="shrink-0 flex flex-col justify-start pt-1">
                  <Avatar size={"small"} name={blog.author.name || "Anonymous"} />
              </div>
              <div className="text-xl font-extrabold leading-tight break-words sm:text-3xl">{blog.title}</div>
            </div>
            <div className="text-sm text-slate-500 pt-2 sm:pt-3">Posted {formatPostedTime(blog.createdAt)}</div>
            <div className="markdown-body pt-3 text-sm leading-7 break-words sm:pt-4 sm:text-base">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {blog.content}
              </ReactMarkdown>
            </div>
            <div id="comments" className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:mt-8 sm:p-5">
              <div className="text-lg font-semibold">Comments</div>
              <div className="mt-3">
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Write a comment..."
                />
                {commentError ? (
                  <div className="pt-2 text-sm text-red-600">{commentError}</div>
                ) : null}
                <button
                  onClick={submitComment}
                  disabled={submitting}
                  type="button"
                  className="mt-3 inline-flex w-full justify-center items-center rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Posting..." : "Post comment"}
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {comments.length === 0 ? (
                  <div className="text-sm text-slate-500">No comments yet.</div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-sm font-semibold text-slate-800">
                        {comment.author.name || "Anonymous"}
                      </div>
                      <div className="text-xs text-slate-500 pt-0.5">
                        {formatPostedTime(comment.createdAt)}
                      </div>
                      <div className="pt-2 text-sm leading-6 text-slate-700 break-words">
                        {comment.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:mt-3 sm:p-5">
              <div className="min-w-0 flex-1 pr-1">
                <div className="text-lg sm:text-xl font-bold leading-tight break-words">
                  About {blog.author.name || "Anonymous"}
                </div>
                <div className="pt-2 text-sm text-slate-500 leading-6 break-words sm:text-base">
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
