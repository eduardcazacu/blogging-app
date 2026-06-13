import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react"
import { BACKEND_URL } from "../config";
import { clearAuthStorage, getAuthHeader } from "../lib/auth";

export interface Comment {
    id: number;
    content: string;
    createdAt: string;
    editedAt?: string | null;
    likeCount?: number;
    likedByMe?: boolean;
    author: {
        id?: number;
        name: string | null;
    };
}

export  interface Blog{
    "content": string;
    "title": string;
    "id": number;
    "createdAt": string;
    "editedAt"?: string | null;
    "imageKey"?: string | null;
    "imageUrl"?: string | null;
    "likeCount"?: number;
    "likedByMe"?: boolean;
    "commentCount"?: number;
    "comments"?: Comment[];
    "topComments"?: Comment[];
    "author": {
        "id"?: number;
        "name": string | null;
        "bio": string;
        "themeKey"?: string | null;
        "profilePictureUrl"?: string | null;
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

export interface UserListItem {
    id: number;
    name: string | null;
    themeKey: string | null;
    profilePictureUrl: string | null;
}

export const useUsers = () => {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [authExpired, setAuthExpired] = useState(false);

    useEffect(() => {
        let cancelled = false;
        axios
            .get(`${BACKEND_URL}/api/v1/user/list`, {
                headers: { Authorization: getAuthHeader() },
            })
            .then((response) => {
                if (cancelled) return;
                const list = Array.isArray(response.data?.users)
                    ? (response.data.users as UserListItem[])
                    : [];
                setUsers(list);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                if (
                    axios.isAxiosError(error) &&
                    (error.response?.status === 401 || error.response?.status === 403)
                ) {
                    clearAuthStorage();
                    setAuthExpired(true);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return { loading, users, authExpired };
};

export interface ChatMessage {
    id: number;
    content: string;
    createdAt: string;
    author: {
        id: number;
        name: string | null;
        themeKey: string | null;
        profilePictureUrl: string | null;
    };
}

export const useChat = (open: boolean) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [retentionHours, setRetentionHours] = useState(24);
    const [authExpired, setAuthExpired] = useState(false);
    const lastIdRef = useRef(0);

    const handleAuthError = useCallback((error: unknown) => {
        if (
            axios.isAxiosError(error) &&
            (error.response?.status === 401 || error.response?.status === 403)
        ) {
            clearAuthStorage();
            setAuthExpired(true);
            return true;
        }
        return false;
    }, []);

    const mergeMessages = useCallback((incoming: ChatMessage[]) => {
        if (incoming.length === 0) {
            return;
        }
        setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const next = [...prev];
            for (const msg of incoming) {
                if (!seen.has(msg.id)) {
                    next.push(msg);
                }
            }
            return next;
        });
        lastIdRef.current = incoming.reduce(
            (acc, m) => Math.max(acc, m.id),
            lastIdRef.current
        );
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }
        let cancelled = false;

        const fetchMessages = async (initial: boolean) => {
            if (!initial && document.visibilityState !== "visible") {
                return;
            }
            if (initial) {
                setLoading(true);
                lastIdRef.current = 0;
                setMessages([]);
            }
            try {
                const response = await axios.get(`${BACKEND_URL}/api/v1/chat/messages`, {
                    headers: { Authorization: getAuthHeader() },
                    params: initial ? {} : { since: lastIdRef.current },
                });
                if (cancelled) {
                    return;
                }
                if (typeof response.data?.retentionHours === "number") {
                    setRetentionHours(response.data.retentionHours);
                }
                mergeMessages((response.data?.messages ?? []) as ChatMessage[]);
            } catch (error: unknown) {
                if (!cancelled) {
                    handleAuthError(error);
                }
            } finally {
                if (initial && !cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchMessages(true);
        const timer = setInterval(() => {
            void fetchMessages(false);
        }, 3000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [open, mergeMessages, handleAuthError]);

    const sendMessage = useCallback(
        async (content: string) => {
            const trimmed = content.trim();
            if (!trimmed) {
                return false;
            }
            setSending(true);
            try {
                const response = await axios.post(
                    `${BACKEND_URL}/api/v1/chat/messages`,
                    { content: trimmed },
                    { headers: { Authorization: getAuthHeader() } }
                );
                const message = response.data?.message as ChatMessage | undefined;
                if (message) {
                    mergeMessages([message]);
                }
                return true;
            } catch (error: unknown) {
                handleAuthError(error);
                return false;
            } finally {
                setSending(false);
            }
        },
        [mergeMessages, handleAuthError]
    );

    const updateSettings = useCallback(async (hours: number) => {
        const response = await axios.put(
            `${BACKEND_URL}/api/v1/chat/settings`,
            { retentionHours: hours },
            { headers: { Authorization: getAuthHeader() } }
        );
        if (typeof response.data?.retentionHours === "number") {
            setRetentionHours(response.data.retentionHours);
        }
        return response.data?.retentionHours as number | undefined;
    }, []);

    return {
        messages,
        loading,
        sending,
        retentionHours,
        authExpired,
        sendMessage,
        updateSettings,
    };
};

export const useBlogs = (initialPages = 1, authorId: number | null = null) =>{
    const PAGE_SIZE = 10;
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadedPages, setLoadedPages] = useState(1);
    const [authExpired, setAuthExpired] = useState(false);
    const fetchTokenRef = useRef(0);
    const lastAuthorIdRef = useRef<number | null | undefined>(undefined);

    const fetchPage = useCallback(async (cursor: number | null, limit = PAGE_SIZE) => {
        const token = ++fetchTokenRef.current;
        if (cursor === null) {
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
                    ...(cursor !== null ? { cursor } : {}),
                    ...(authorId != null ? { authorId } : {})
                }
            });

            if (token !== fetchTokenRef.current) {
                return;
            }

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
        } catch (error: unknown) {
            if (token !== fetchTokenRef.current) {
                return;
            }
            if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
                clearAuthStorage();
                setAuthExpired(true);
            }
        } finally {
            if (token === fetchTokenRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [PAGE_SIZE, authorId]);

    useEffect(() => {
        if (lastAuthorIdRef.current !== undefined && lastAuthorIdRef.current === authorId) {
            return;
        }
        const isFirst = lastAuthorIdRef.current === undefined;
        lastAuthorIdRef.current = authorId;

        setBlogs([]);
        setNextCursor(null);
        setHasMore(true);
        setLoadedPages(1);

        const limitMultiplier = isFirst
            ? (Number.isFinite(initialPages) ? Math.max(1, Math.min(10, initialPages)) : 1)
            : 1;
        void fetchPage(null, limitMultiplier * PAGE_SIZE);
    }, [PAGE_SIZE, fetchPage, initialPages, authorId]);

    const fetchNextPage = useCallback(() => {
        if (!hasMore || loading || loadingMore || authExpired || nextCursor === null) {
            return;
        }
        void fetchPage(nextCursor);
    }, [authExpired, fetchPage, hasMore, loading, loadingMore, nextCursor]);

    const refreshBlogs = useCallback(() => {
        setBlogs([]);
        setNextCursor(null);
        setHasMore(true);
        setLoadedPages(1);
        void fetchPage(null, PAGE_SIZE);
    }, [PAGE_SIZE, fetchPage]);

    return {
        loading,
        loadingMore,
        blogs,
        authExpired,
        hasMore,
        loadedPages,
        fetchNextPage,
        refreshBlogs
    }
}
