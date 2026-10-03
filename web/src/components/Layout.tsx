import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const navItems = [
  { section: "Transcoding", items: [
    { to: "/convert", label: "Convert" },
    { to: "/tag", label: "Tag" },
    { to: "/lyrics", label: "Lyrics" },
    { to: "/sync", label: "Sync" },
  ]},
  { section: "Library", items: [
    { to: "/library/index", label: "Index" },
    { to: "/library/query", label: "Query" },
    { to: "/library/copy", label: "Copy" },
    { to: "/library/organize", label: "Organize" },
  ]},
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <nav className="w-48 bg-gray-900 text-white flex flex-col gap-4 p-4 shrink-0">
        <div className="text-lg font-bold">Audex</div>
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{section.section}</div>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded px-3 py-2 text-sm ${isActive ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
