import { NavLink, Outlet } from 'react-router-dom';

const phoneLinks = [
  { to: '/', label: 'Feed', end: true },
  { to: '/my-pets', label: 'My pets', end: false },
  { to: '/profile', label: 'Profile', end: false },
];

const desktopLinks = [
  ...phoneLinks,
  { to: '/settings', label: 'Settings', end: false },
];

export default function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 p-4 md:block">
        <p className="mb-6 text-lg font-bold">Lost Pet</p>
        <nav className="flex flex-col gap-1">
          {desktopLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-gray-100 font-semibold' : 'text-gray-600'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 pb-20 md:pb-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-gray-200 bg-white md:hidden">
        {phoneLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs ${isActive ? 'font-semibold' : 'text-gray-500'}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
