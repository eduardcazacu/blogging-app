import { useEffect, useRef, useState } from "react";
import { Appbar } from "../components/Appbar"
import { BlogCard } from "../components/BlogCard"
import { BlogSkeleton } from "../components/BlogSkeleton";
import { useBlogs } from "../hooks"
import { formatPostedTime } from "../lib/datetime";
import { Navigate, useSearchParams } from "react-router-dom";
import { getThemePalette } from "../themes";

const BASE_BG_COLOR = "#f1f5f9";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 241, g: 245, b: 249 };
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function parseColorToRgb(color: string) {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    return hexToRgb(trimmed);
  }
  const rgbMatch = trimmed.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i
  );
  if (!rgbMatch) {
    return { r: 241, g: 245, b: 249 };
  }
  return {
    r: Math.max(0, Math.min(255, Number(rgbMatch[1]))),
    g: Math.max(0, Math.min(255, Number(rgbMatch[2]))),
    b: Math.max(0, Math.min(255, Number(rgbMatch[3]))),
  };
}

function interpolateHexColor(fromHex: string, toHex: string, t: number) {
  const from = parseColorToRgb(fromHex);
  const to = parseColorToRgb(toHex);
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(from.r + (to.r - from.r) * clamped);
  const g = Math.round(from.g + (to.g - from.g) * clamped);
  const b = Math.round(from.b + (to.b - from.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function blendWeightedColors(samples: Array<{ color: string; weight: number }>) {
  if (samples.length === 0) {
    return BASE_BG_COLOR;
  }

  let totalWeight = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const sample of samples) {
    const w = Math.max(0, sample.weight);
    const rgb = parseColorToRgb(sample.color);
    totalWeight += w;
    r += rgb.r * w;
    g += rgb.g * w;
    b += rgb.b * w;
  }

  if (totalWeight <= 0) {
    return BASE_BG_COLOR;
  }

  return `rgb(${Math.round(r / totalWeight)}, ${Math.round(g / totalWeight)}, ${Math.round(b / totalWeight)})`;
}

export const Blogs = () => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastResolvedBgRef = useRef(BASE_BG_COLOR);
  const [activeBgColor, setActiveBgColor] = useState(BASE_BG_COLOR);
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

    useEffect(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-blog-card="true"]'));
      if (cards.length === 0) {
        setActiveBgColor(BASE_BG_COLOR);
        return;
      }

      let rafId: number | null = null;

      const updateBgFromScroll = () => {
        const viewportFocusY = window.innerHeight * 0.22;
        const visibleSamples: Array<{ color: string; weight: number }> = [];
        let prevCandidate: { distance: number; color: string } | null = null;
        let nextCandidate: { distance: number; color: string } | null = null;

        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const distance = centerY - viewportFocusY;
          const color = card.getAttribute("data-theme-bg") || BASE_BG_COLOR;
          const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;

          if (isVisible) {
            const absDistance = Math.abs(distance);
            visibleSamples.push({
              color,
              // Strongly bias cards near the upper viewport focus point.
              weight: 1 / Math.pow(absDistance + 30, 1.22),
            });
          }

          if (distance <= 0) {
            if (!prevCandidate || distance > prevCandidate.distance) {
              prevCandidate = { distance, color };
            }
          } else if (!nextCandidate || distance < nextCandidate.distance) {
            nextCandidate = { distance, color };
          }
        }

        let nextColor = lastResolvedBgRef.current;
        if (visibleSamples.length > 0) {
          nextColor = blendWeightedColors(visibleSamples);
        } else if (prevCandidate && nextCandidate) {
          const span = nextCandidate.distance - prevCandidate.distance;
          const progress = span <= 0 ? 0 : (0 - prevCandidate.distance) / span;
          nextColor = interpolateHexColor(prevCandidate.color, nextCandidate.color, progress);
        } else if (prevCandidate) {
          nextColor = prevCandidate.color;
        } else if (nextCandidate) {
          nextColor = nextCandidate.color;
        }

        lastResolvedBgRef.current = nextColor;
        setActiveBgColor((current) => (current === nextColor ? current : nextColor));
      };

      const onScrollOrResize = () => {
        if (rafId !== null) {
          return;
        }
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          updateBgFromScroll();
        });
      };

      updateBgFromScroll();
      window.addEventListener("scroll", onScrollOrResize, { passive: true });
      window.addEventListener("resize", onScrollOrResize);

      return () => {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
        }
        window.removeEventListener("scroll", onScrollOrResize);
        window.removeEventListener("resize", onScrollOrResize);
      };
    }, [blogs]);

    if (authExpired) {
      return <Navigate to="/signin" replace />;
    }

    if (loading){
      return <div className="min-h-screen bg-slate-100">
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
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: activeBgColor,
      }}
    >
       <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="w-full max-w-screen-md space-y-4">
        {blogs.map(blog => {
          const themeBackground = getThemePalette(blog.author.themeKey).softBg;
          return (
            <div key={blog.id} data-blog-card="true" data-theme-bg={themeBackground}>
              <BlogCard 
               id={blog.id}
               authorname ={blog.author.name || "Anonymous"}
               title={blog.title}
               content={blog.content}
               imageUrl={blog.imageUrl || undefined}
               likeCount={blog.likeCount || 0}
               likedByMe={Boolean(blog.likedByMe)}
               publishedDate={formatPostedTime(blog.createdAt)}
               commentCount={blog.commentCount || 0}
               topComments={blog.topComments || []}
               themeKey={blog.author.themeKey || undefined} />
            </div>
          );
        }) }
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
