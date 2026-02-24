import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react"
import { BACKEND_URL } from "../config";
import { clearAuthStorage, getAuthHeader } from "../lib/auth";

export interface Comment {
    id: number;
    content: string;
    createdAt: string;
    author: {
        name: string | null;
    };
}

export  interface Blog{
    "content": string;
    "title": string;
    "id": number;
    "createdAt": string;
    "commentCount"?: number;
    "comments"?: Comment[];
    "topComments"?: Comment[];
    "author": {
        "name": string | null;
        "bio": string;
    }
}


export const useBlog = ({ id }: { id: string }) =>{
    const [loading, setLoading] = useState(true);
    const [blog, setBlog] = useState<Blog>();
    const [authExpired, setAuthExpired] = useState(false);

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/blog/${id}`, {
            headers:{
                Authorization: getAuthHeader()
            }
        })
            .then(response => {
                setBlog(response.data.blog);
            })
            .catch((error: unknown) => {
                if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
                    clearAuthStorage();
                    setAuthExpired(true);
                }
            })
            .finally(() => {
                setLoading(false);
            });
    }, [id])

    return {
        loading,
        blog,
        authExpired
    }
}

export const useBlogs = (initialPages = 1) =>{
    const PAGE_SIZE = 10;
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadedPages, setLoadedPages] = useState(1);
    const [authExpired, setAuthExpired] = useState(false);
    const hasLoadedInitial = useRef(false);
    const requestInFlight = useRef(false);

    const fetchPage = useCallback(async (cursor: number | null, limit = PAGE_SIZE) => {
        if (requestInFlight.current) {
            return;
        }

        requestInFlight.current = true;
        const isInitialLoad = !hasLoadedInitial.current;
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const response = await axios.get(`${BACKEND_URL}/api/v1/blog/bulk`, {
                headers: {
                    Authorization: getAuthHeader()
                },
                params: {
                    limit,
                    ...(cursor !== null ? { cursor } : {})
                }
            });

            const newBlogs = (response.data?.blogs ?? []) as Blog[];
            setBlogs((prev) => (cursor === null ? newBlogs : [...prev, ...newBlogs]));
            if (cursor === null) {
                setLoadedPages(Math.max(1, Math.ceil(newBlogs.length / PAGE_SIZE)));
            } else if (newBlogs.length > 0) {
                setLoadedPages((value) => value + 1);
            }
            setNextCursor(
                typeof response.data?.nextCursor === "number" ? response.data.nextCursor : null
            );
            setHasMore(Boolean(response.data?.hasMore));
            hasLoadedInitial.current = true;
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
                clearAuthStorage();
                setAuthExpired(true);
            }
        } finally {
            requestInFlight.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }, [PAGE_SIZE]);

    useEffect(() => {
        if (hasLoadedInitial.current) {
            return;
        }
        const safeInitialPages = Number.isFinite(initialPages)
            ? Math.max(1, Math.min(10, initialPages))
            : 1;
        void fetchPage(null, safeInitialPages * PAGE_SIZE);
    }, [PAGE_SIZE, fetchPage, initialPages]);

    const fetchNextPage = useCallback(() => {
        if (!hasMore || loading || loadingMore || authExpired || nextCursor === null) {
            return;
        }
        void fetchPage(nextCursor);
    }, [authExpired, fetchPage, hasMore, loading, loadingMore, nextCursor]);

    return {
        loading,
        loadingMore,
        blogs,
        authExpired,
        hasMore,
        loadedPages,
        fetchNextPage
    }
}
