import axios from "axios";
import { useEffect, useState } from "react"
import { BACKEND_URL } from "../config";
import { getAuthHeader } from "../lib/auth";

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

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/blog/${id}`, {
            headers:{
                Authorization: getAuthHeader()
            }
        })
            .then(response => {
                setBlog(response.data.blog);
                setLoading(false)
            })
    }, [id])

    return {
        loading,
        blog
    }
}

export const useBlogs = () =>{
    const [loading, setLoading] = useState(true);
    const [blogs, setBlogs] = useState<Blog[]>([]);

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/blog/bulk`, {
            headers:{
                Authorization: getAuthHeader()
            }
        })
            .then(response => {
                setBlogs(response.data.blogs);
                setLoading(false)
            })
    }, [])

    return {
        loading,
        blogs
    }
}
