import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useUsers, type UserListItem } from "../hooks";
import { Avatar } from "./BlogCard";

type MentionedUser = { id: number; name: string };

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  onMention: (user: MentionedUser) => void;
  excludeUserId?: number | null;
  placeholder?: string;
  rows?: number;
  className?: string;
};

const MAX_SUGGESTIONS = 6;

type NamedUser = UserListItem & { name: string };

export function MentionInput({
  value,
  onChange,
  onMention,
  excludeUserId,
  placeholder,
  rows = 3,
  className,
}: MentionInputProps) {
  const { users } = useUsers();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Index of the active "@" in `value`, or null when no mention is in progress.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const candidates = useMemo<NamedUser[]>(() => {
    if (anchor === null) {
      return [];
    }
    const mentionable = users.filter(
      (user): user is NamedUser =>
        typeof user.name === "string" &&
        user.name.trim().length > 0 &&
        user.id !== excludeUserId
    );
    const q = query.trim().toLowerCase();
    const matches = q.length === 0
      ? mentionable
      : mentionable.filter((user) => user.name.toLowerCase().includes(q));
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [users, anchor, query, excludeUserId]);

  function closeMenu() {
    setAnchor(null);
    setQuery("");
    setHighlight(0);
  }

  // Detect whether the caret sits inside an "@mention" token and update state.
  function refreshMention(text: string, caret: number) {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) {
      closeMenu();
      return;
    }
    const between = before.slice(at + 1);
    // A mention can't span a newline, and the "@" must start the word.
    const prevChar = at > 0 ? before[at - 1] : "";
    const atStartOfWord = at === 0 || prevChar === " " || prevChar === "\n";
    if (between.includes("\n") || !atStartOfWord) {
      closeMenu();
      return;
    }
    setAnchor(at);
    setQuery(between);
    setHighlight(0);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    refreshMention(text, e.target.selectionStart ?? text.length);
  }

  function selectUser(user: NamedUser) {
    if (anchor === null) {
      return;
    }
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, anchor);
    const after = value.slice(caret);
    const insert = `@${user.name} `;
    onChange(before + insert + after);
    onMention({ id: user.id, name: user.name });
    closeMenu();
    const nextCaret = before.length + insert.length;
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      }
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (anchor === null || candidates.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectUser(candidates[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    }
  }

  const menuOpen = anchor !== null && candidates.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(closeMenu, 120)}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      {menuOpen ? (
        <ul className="absolute left-0 z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {candidates.map((user, idx) => (
            <li key={user.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectUser(user);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  idx === highlight ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <Avatar
                  size="small"
                  name={user.name}
                  themeKey={user.themeKey}
                  imageUrl={user.profilePictureUrl}
                />
                <span className="truncate text-slate-800">{user.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
