import Link from "next/link";

export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-emerald-400 hover:underline">
      {label}
    </Link>
  );
}
