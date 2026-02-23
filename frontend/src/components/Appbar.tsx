import { Link } from "react-router-dom";
import { Avatar } from "./BlogCard";
import { Logout } from "./Logout";
// import { useBlogs } from "../hooks";


export const Appbar = () => {
  const displayName = localStorage.getItem("displayName") || "User";
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  return (
    <div className="border-b flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-10 sm:py-4">
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
            className="text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 font-medium rounded-full text-xs px-3 py-2 text-center sm:text-sm sm:px-5 sm:py-2.5"
          >
            New Post
          </button>
        </Link>
        {isAdmin ? (
          <Link to={"/admin"}>
            <button
              type="button"
              className="text-white bg-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 font-medium rounded-full text-xs px-3 py-2 text-center sm:text-sm sm:px-5 sm:py-2.5"
            >
              Admin
            </button>
          </Link>
        ) : null}
        <Link to={"/account"} className="cursor-pointer" aria-label="Account">
          <Avatar size={"big"} name={displayName}/>
        </Link>
        <Logout />
      </div>
      
    </div>
  );
};
