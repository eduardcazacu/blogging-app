import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "./BlogCard";
import { DEFAULT_THEME_KEY, THEME_PALETTES } from "../themes";
// import { useBlogs } from "../hooks";


export const Appbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = localStorage.getItem("displayName") || "User";
  const storedThemeKey = localStorage.getItem("themeKey");
  const currentTheme = THEME_PALETTES.find((theme) => theme.key === storedThemeKey) ?? THEME_PALETTES.find((theme) => theme.key === DEFAULT_THEME_KEY)!;
  const avatarThemeKey = currentTheme.key;
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    () => localStorage.getItem("profilePictureUrl")
  );

  useEffect(() => {
    const handler = () => {
      setProfilePictureUrl(localStorage.getItem("profilePictureUrl"));
    };
    window.addEventListener("profile-picture-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("profile-picture-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const triggerFeedRefresh = () => {
    const state = { refreshFeedAt: Date.now() };
    if (location.pathname === "/blogs") {
      navigate("/blogs", { replace: true, state });
      return;
    }
    navigate("/blogs", { state });
  };

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 shadow-sm flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-10 sm:py-4">
      <button
        type="button"
        onClick={triggerFeedRefresh}
        className="cursor-pointer flex items-center bg-transparent p-0"
        aria-label="Go to blogs and refresh feed"
      >
        <img
          src="/topbar-logo.png"
          alt="Eddie's Lounge"
          className="h-7 w-auto sm:h-8"
        />
      </button>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("toggle-chat"))}
          className="rounded-full p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2"
          style={{ outlineColor: currentTheme.accent }}
          aria-label="Open chat"
          title="Lounge Chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 sm:h-6 sm:w-6"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
        <Link to={"/publish"}>
          <button
            type="button"
            className="text-white focus:outline-none focus:ring-4 font-medium rounded-full text-xs px-3 py-2 text-center sm:text-sm sm:px-5 sm:py-2.5 transition-opacity hover:opacity-90"
            style={{
              backgroundColor: currentTheme.accent,
              boxShadow: `0 0 0 4px ${currentTheme.softBg}`,
            }}
          >
            New Post
          </button>
        </Link>
        <Link to={"/account"} className="cursor-pointer" aria-label="Account">
          <Avatar size={"big"} name={displayName} themeKey={avatarThemeKey} imageUrl={profilePictureUrl} />
        </Link>
      </div>
      
    </div>
  );
};
