
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-[#111]">
      <Navbar />
      <main className="flex-1 container px-4 py-6">
        <Outlet />
      </main>
      <footer className="py-4 px-4 text-center text-sm text-muted-foreground border-t border-white/10">
        <p>&copy; {new Date().getFullYear()} Artist Prediction Market. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Layout;
