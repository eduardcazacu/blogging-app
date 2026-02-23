import axios from "axios";
import { useEffect, useState } from "react"
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

export const useBlogs = () =>{
    const [loading, setLoading] = useState(true);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [authExpired, setAuthExpired] = useState(false);

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/blog/bulk`, {
            headers:{
                Authorization: getAuthHeader()
            }
        })
            .then(response => {
                setBlogs(response.data.blogs);
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
    }, [])

    return {
        loading,
        blogs,
        authExpired
    }
}
