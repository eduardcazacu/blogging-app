import type { UserListItem } from "../hooks";
import { Avatar } from "./BlogCard";
import { getThemePalette } from "../themes";

interface UsersStripProps {
  users: UserListItem[];
  loading: boolean;
  selectedAuthorId: number | null;
  onSelect: (authorId: number | null) => void;
}

export const UsersStrip = ({ users, loading, selectedAuthorId, onSelect }: UsersStripProps) => {
  if (loading && users.length === 0) {
    return (
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
              <div className="h-2 w-12 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex gap-3 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <UserStripItem
          name="All"
          isSelected={selectedAuthorId === null}
          onClick={() => onSelect(null)}
        />
        {users.map((user) => {
          const displayName = user.name?.trim() || "Anonymous";
          return (
            <UserStripItem
              key={user.id}
              name={displayName}
              themeKey={user.themeKey}
              imageUrl={user.profilePictureUrl}
              isSelected={selectedAuthorId === user.id}
              onClick={() => onSelect(user.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

function UserStripItem({
  name,
  themeKey,
  imageUrl,
  isSelected,
  onClick,
}: {
  name: string;
  themeKey?: string | null;
  imageUrl?: string | null;
  isSelected: boolean;
  onClick: () => void;
}) {
  const theme = getThemePalette(themeKey);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-16 shrink-0 flex-col items-center gap-1.5 bg-transparent p-0 focus:outline-none"
      aria-pressed={isSelected}
      title={name}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full p-0.5 transition-shadow ${isSelected ? "" : "bg-slate-100"}`}
        style={
          isSelected
            ? { boxShadow: `0 0 0 2px ${theme.accent}` }
            : undefined
        }
      >
        <Avatar size="big" name={name} themeKey={themeKey} imageUrl={imageUrl} />
      </span>
      <span
        className={`max-w-[64px] truncate text-[11px] leading-tight ${isSelected ? "font-semibold" : "font-normal text-slate-600"}`}
        style={isSelected ? { color: theme.accent } : undefined}
      >
        {name}
      </span>
    </button>
  );
}
