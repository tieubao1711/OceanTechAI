"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  placeholder: string;
  initialQuery?: string;
};

export function UniversalSearchBar({ placeholder, initialQuery = "" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      className="flex-1 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm placeholder:text-[var(--muted)] focus:border-emerald-500/50 focus:outline-none"
      />
    </form>
  );
}
