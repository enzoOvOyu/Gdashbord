// 控制台骨架：Sidebar + Topbar + StatusBar + Outlet（ARCH §3 layouts / §7 分层）
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import s from './layout.module.css';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { StatusBar } from './StatusBar';

export function ConsoleLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className={s.shell}>
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className={s.main}>
        <Topbar onToggleSidebar={() => setDrawerOpen((v) => !v)} />
        <StatusBar />
        <main className={s.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { s as layoutStyles };
