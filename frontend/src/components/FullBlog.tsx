import axios from "axios";
import { useEffect, useState } from "react";
import { Blog } from "../hooks";
import { Appbar } from "./Appbar";
import { Avatar } from "./BlogCard";
import { BACKEND_URL } from "../config";
import { getAuthHeader, getCurrentUserId } from "../lib/auth";
import { formatPostedTime } from "../lib/datetime";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getThemePalette } from "../themes";
import { extractFirstYouTubeEmbedUrl, getTransformedImageUrl, isImageLikeUrl, stripLeadingFirstYouTubeUrl, withStandaloneImagePreviewMarkdown } from "../lib/content";

export const FullBlog = ({ blog }: { blog: Blog }) => {
  const markdownComponents = {
    img: (props: any) => {
      if (!isImageLikeUrl(props.src)) {
        return null;
      }
      return (
        <a
          href={props.src}
          target="_blank"
          rel="noreferrer noopener"
          className="my-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 no-underline"
        >
          <img
            src={getTransformedImageUrl(props.src, { width: 520, fit: "cover", quality: 74 })}
            alt="Linked image preview"
            loading="lazy"
            className="rounded-md object-cover"
            style={{ width: "96px", height: "96px", margin: 0, maxHeight: "96px", flexShrink: 0 }}
          />
          <div className="text-xs text-slate-600 break-all">{props.src}</div>
        </a>
      );
    },
    a: (props: any) => (
      <a
        href={props.href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-blue-700 underline break-all"
      >
        {props.children}
      </a>
    ),
  };
  const theme = getThemePalette(blog.author.themeKey);
  const currentUserId = getCurrentUserId();
  const canEditPost = typeof blog.author.id === "number" && currentUserId === blog.author.id;
  const [comments, setComments] = useState(blog.comments || []);
  const [postTitle, setPostTitle] = useState(blog.title);
  const [postContent, setPostContent] = useState(blog.content);
  const [postEditedAt, setPostEditedAt] = useState(blog.editedAt || null);
  const [postLikeCount, setPostLikeCount] = useState(blog.likeCount || 0);
  const [postLikedByMe, setPostLikedByMe] = useState(Boolean(blog.likedByMe));
  const [postLikeLoading, setPostLikeLoading] = useState(false);
  const [postEditing, setPostEditing] = useState(false);
  const [postEditTitle, setPostEditTitle] = useState(blog.title);
  const [postEditContent, setPostEditContent] = useState(blog.content);
  const [postEditSaving, setPostEditSaving] = useState(false);
  const [postEditError, setPostEditError] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentEditSaving, setCommentEditSaving] = useState(false);
  const [commentEditError, setCommentEditError] = useState<string | null>(null);
  const firstYouTubeEmbedUrl = extractFirstYouTubeEmbedUrl(postContent);
  const renderedPostContent = stripLeadingFirstYouTubeUrl(postContent);

  useEffect(() => {
    setComments(blog.comments || []);
    setPostTitle(blog.title);
    setPostContent(blog.content);
    setPostEditedAt(blog.editedAt || null);
    setPostEditTitle(blog.title);
    setPostEditContent(blog.content);
    setPostEditing(false);
    setPostEditError(null);
    setEditingCommentId(null);
    setEditingCommentText("");
    setCommentEditError(null);
    setPostLikeCount(blog.likeCount || 0);
    setPostLikedByMe(Boolean(blog.likedByMe));
  }, [blog.id, blog.comments, blog.content, blog.editedAt, blog.likeCount, blog.likedByMe, blog.title]);

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
        setComments((existing) => [...existing, {
          ...comment,
          likeCount: 0,
          likedByMe: false,
        }]);
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

  async function togglePostLike() {
    if (postLikeLoading) {
      return;
    }
    setPostLikeLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/blog/${blog.id}/likes/toggle`,
        {},
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setPostLikeCount(Number(response.data?.likeCount) || 0);
      setPostLikedByMe(Boolean(response.data?.likedByMe));
    } finally {
      setPostLikeLoading(false);
    }
  }

  async function toggleCommentLike(commentId: number) {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/blog/${blog.id}/comments/${commentId}/likes/toggle`,
        {},
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      const likeCount = Number(response.data?.likeCount) || 0;
      const likedByMe = Boolean(response.data?.likedByMe);
      setComments((existing) =>
        existing.map((comment) =>
          comment.id === commentId
            ? { ...comment, likeCount, likedByMe }
            : comment
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function savePostEdit() {
    const title = postEditTitle.trim();
    const content = postEditContent.trim();
    if (!title || !content) {
      setPostEditError("Title and content are required.");
      return;
    }

    setPostEditSaving(true);
    setPostEditError(null);
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/v1/blog/${blog.id}`,
        { title, content },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setPostTitle(title);
      setPostContent(content);
      const editedAt = typeof response.data?.editedAt === "string" ? response.data.editedAt : new Date().toISOString();
      setPostEditedAt(editedAt);
      setPostEditing(false);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setPostEditError(e.response?.data?.msg || "Failed to edit post.");
      } else {
        setPostEditError("Failed to edit post.");
      }
    } finally {
      setPostEditSaving(false);
    }
  }

  async function saveCommentEdit(commentId: number) {
    const content = editingCommentText.trim();
    if (!content) {
      setCommentEditError("Comment cannot be empty.");
      return;
    }

    setCommentEditSaving(true);
    setCommentEditError(null);
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/v1/blog/${blog.id}/comments/${commentId}`,
        { content },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      const editedAt = typeof response.data?.editedAt === "string" ? response.data.editedAt : new Date().toISOString();
      setComments((existing) =>
        existing.map((comment) =>
          comment.id === commentId
            ? { ...comment, content, editedAt }
            : comment
        )
      );
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setCommentEditError(e.response?.data?.msg || "Failed to edit comment.");
      } else {
        setCommentEditError("Failed to edit comment.");
      }
    } finally {
      setCommentEditSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.postBg }}>
      <Appbar />
      <div className="flex justify-center px-3 py-4 sm:px-6 sm:py-8">
        <div className="w-full max-w-screen-xl space-y-5 sm:space-y-6">
          <div
            className="grid grid-cols-12 gap-5 rounded-xl p-4 sm:gap-8 sm:p-8"
            style={{ backgroundColor: theme.postBg }}
          >
            <div className="col-span-12 md:col-span-8">
              <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                  <div className="shrink-0 flex flex-col justify-start pt-1">
                      <Avatar size={"small"} name={blog.author.name || "Anonymous"} themeKey={blog.author.themeKey} />
                  </div>
                  <div className="text-xl font-extrabold leading-tight break-words sm:text-3xl">
                    {postEditing ? (
                      <input
                        value={postEditTitle}
                        onChange={(e) => setPostEditTitle(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xl font-bold text-slate-900 sm:text-3xl"
                      />
                    ) : (
                      postTitle
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canEditPost ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (postEditing) {
                          setPostEditing(false);
                          setPostEditTitle(postTitle);
                          setPostEditContent(postContent);
                          setPostEditError(null);
                        } else {
                          setPostEditing(true);
                          setPostEditTitle(postTitle);
                          setPostEditContent(postContent);
                        }
                      }}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-base leading-none font-semibold text-slate-700 hover:bg-slate-200"
                      aria-label="Edit post"
                      title="Edit post"
                    >
                      ✏️
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={togglePostLike}
                    disabled={postLikeLoading}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${postLikedByMe ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"} disabled:opacity-60`}
                  >
                    🍪 {postLikeCount}
                  </button>
                </div>
              </div>
              <div className="text-sm text-slate-500 pt-2 sm:pt-3">
                Posted {formatPostedTime(blog.createdAt)}
                {postEditedAt ? " · Edited" : ""}
              </div>
              {blog.imageUrl ? (
                <div className="mt-4 overflow-hidden rounded-lg">
                  <img
                    src={getTransformedImageUrl(blog.imageUrl, { width: 1280, fit: "contain", quality: 98 })}
                    alt={postTitle}
                    className="h-auto max-h-[70vh] w-full object-contain sm:max-h-[55vh] lg:max-h-[48vh]"
                    loading="lazy"
                  />
                </div>
              ) : null}
              {firstYouTubeEmbedUrl ? (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-black">
                  <iframe
                    src={firstYouTubeEmbedUrl}
                    title={`${postTitle} video`}
                    loading="lazy"
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : null}
              {postEditing ? (
                <div className="pt-3">
                  <textarea
                    value={postEditContent}
                    onChange={(e) => setPostEditContent(e.target.value)}
                    rows={12}
                    className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  />
                  {postEditError ? <div className="pt-2 text-sm text-red-600">{postEditError}</div> : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void savePostEdit()}
                      disabled={postEditSaving}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {postEditSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPostEditing(false);
                        setPostEditTitle(postTitle);
                        setPostEditContent(postContent);
                        setPostEditError(null);
                      }}
                      className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="markdown-body pt-3 text-sm leading-7 break-words sm:pt-4 sm:text-base">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {withStandaloneImagePreviewMarkdown(renderedPostContent)}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="mt-1 rounded-lg p-3 sm:mt-3 sm:p-5" style={{ backgroundColor: theme.softBg }}>
                <div className="min-w-0 flex-1 pr-1">
                  <div className="text-lg sm:text-xl font-bold leading-tight break-words">
                    About {blog.author.name || "Anonymous"}
                  </div>
                  <div className="pt-2 text-sm leading-6 break-words sm:text-base" style={{ color: theme.text }}>
                    {blog.author.bio?.trim() || "No bio yet."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="comments" className="border-t border-slate-300 pt-5 sm:pt-6">
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
                className="mt-3 inline-flex w-full justify-center items-center rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ backgroundColor: theme.accent }}
              >
                {submitting ? "Posting..." : "Post comment"}
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {comments.length === 0 ? (
                <div className="text-sm text-slate-500">No comments yet.</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">
                          {comment.author.name || "Anonymous"}
                        </div>
                        <div className="text-xs text-slate-500 pt-0.5">
                          {formatPostedTime(comment.createdAt)}
                          {comment.editedAt ? " · Edited" : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {typeof comment.author.id === "number" && comment.author.id === currentUserId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentText(comment.content);
                              setCommentEditError(null);
                            }}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            aria-label="Edit comment"
                            title="Edit comment"
                          >
                            ✏️
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void toggleCommentLike(comment.id)}
                          className={`rounded-full px-2 py-1 text-xs font-medium ${comment.likedByMe ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
                        >
                          🍪 {comment.likeCount || 0}
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 text-sm leading-6 text-slate-700 break-words">
                      {editingCommentId === comment.id ? (
                        <div>
                          <textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            rows={4}
                            className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                          />
                          {commentEditError ? (
                            <div className="pt-2 text-sm text-red-600">{commentEditError}</div>
                          ) : null}
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveCommentEdit(comment.id)}
                              disabled={commentEditSaving}
                              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                            >
                              {commentEditSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                                setCommentEditError(null);
                              }}
                              className="rounded-full bg-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {withStandaloneImagePreviewMarkdown(comment.content)}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
