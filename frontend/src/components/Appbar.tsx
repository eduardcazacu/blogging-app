import { Link } from "react-router-dom";
import { Avatar } from "./BlogCard";
import { DEFAULT_THEME_KEY, THEME_PALETTES } from "../themes";
// import { useBlogs } from "../hooks";


export const Appbar = () => {
  const displayName = localStorage.getItem("displayName") || "User";
  const storedThemeKey = localStorage.getItem("themeKey");
  const currentTheme = THEME_PALETTES.find((theme) => theme.key === storedThemeKey) ?? THEME_PALETTES.find((theme) => theme.key === DEFAULT_THEME_KEY)!;
  const avatarThemeKey = currentTheme.key;

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 shadow-sm flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-10 sm:py-4">
      <Link
        to={"/blogs"}
        className="cursor-pointer flex items-center"
      > 
        <img
          src="/topbar-logo.png"
          alt="Eddie's Lounge"
          className="h-7 w-auto sm:h-8"
        />
      </Link>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
          <Avatar size={"big"} name={displayName} themeKey={avatarThemeKey} />
        </Link>
      </div>
      
    </div>
  );
};
