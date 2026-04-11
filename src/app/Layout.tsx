import { Outlet, NavLink, Link } from "react-router-dom";
import { Gamepad2, Trophy, PlusCircle, Menu, X, LogIn, LogOut, User as UserIcon, Users } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./context/AuthContext";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signInWithGoogle, signOut } = useAuth();

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  const navLinks = [
    { to: "/", label: "Home", icon: <Gamepad2 className="w-5 h-5 mr-2" /> },
    { to: "/tournaments", label: "Tournaments", icon: <Trophy className="w-5 h-5 mr-2" /> },
    { to: "/host", label: "Host", icon: <PlusCircle className="w-5 h-5 mr-2" /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col selection:bg-fuchsia-500 selection:text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <NavLink to="/" onClick={closeMenu} className="flex items-center text-xl font-bold tracking-tighter text-white uppercase group">
                <span className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-transparent bg-clip-text mr-2">Local</span>
                Arena
                <motion.div 
                  className="w-2 h-2 rounded-full bg-cyan-500 ml-1 mb-2"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              </NavLink>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center justify-between flex-1">
              <div className="ml-10 flex items-baseline space-x-4">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                        isActive
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      }`
                    }
                  >
                    {link.icon}
                    {link.label}
                  </NavLink>
                ))}

                {/* 🚨 SECRET ADMIN BUTTON */}
                {user?.email === "tumhara-email@gmail.com" && (
                  <Link 
                    to="/admin" 
                    className="flex items-center px-4 py-2 ml-2 rounded-md text-sm font-bold bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/30 transition-colors"
                  >
                    👑 Admin
                  </Link>
                )}
              </div>

              <div className="flex items-center space-x-4">
                {user ? (
                  <>
                    {/* 🔥 NEW: FRIENDS & CHAT BUTTON (DESKTOP) 🔥 */}
                    <Link to="/inbox" className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 mr-4">
                      <Users className="w-5 h-5 mr-2" />
                      <span className="text-sm font-bold">Friends & Chat</span>
                    </Link>

                    <Link to="/profile" className="flex items-center text-neutral-400 hover:text-white transition-colors">
                      <UserIcon className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">Profile</span>
                    </Link>
                    <button onClick={signOut} className="flex items-center text-red-400 hover:text-red-300 transition-colors">
                      <LogOut className="w-5 h-5 mr-1" />
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </>
                ) : (
                  <button onClick={signInWithGoogle} className="flex items-center bg-white text-neutral-900 px-4 py-2 rounded-md hover:bg-neutral-200 transition-colors">
                    <LogIn className="w-5 h-5 mr-2" />
                    <span className="text-sm font-medium">Login</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="-mr-2 flex md:hidden">
              <button
                onClick={toggleMenu}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-fuchsia-500"
              >
                {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden bg-neutral-900 border-b border-neutral-800 absolute w-full shadow-2xl"
            >
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 rounded-md text-base font-medium ${
                        isActive
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      }`
                    }
                  >
                    {link.icon}
                    {link.label}
                  </NavLink>
                ))}

                <div className="mt-4 pt-4 border-t border-neutral-800">
                  {user ? (
                    <>
                      {/* 🔥 NEW: FRIENDS & CHAT BUTTON (MOBILE) 🔥 */}
                      <Link
                        to="/inbox"
                        onClick={closeMenu}
                        className="flex items-center px-3 py-2 mb-2 rounded-md text-base font-bold bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 w-full"
                      >
                        <Users className="w-5 h-5 mr-2" />
                        Friends & Chat
                      </Link>

                      {user?.email === "tumhara-email@gmail.com" && (
                        <Link
                          to="/admin"
                          onClick={closeMenu}
                          className="flex items-center px-3 py-2 mb-2 rounded-md text-base font-bold bg-red-900/30 text-red-400 border border-red-500/20 w-full"
                        >
                          👑 Admin Panel
                        </Link>
                      )}
                      
                      <Link
                        to="/profile"
                        onClick={closeMenu}
                        className="flex items-center px-3 py-2 rounded-md text-base font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white w-full"
                      >
                        <UserIcon className="w-5 h-5 mr-2" />
                        Profile
                      </Link>
                      
                      <button
                        onClick={() => { signOut(); closeMenu(); }}
                        className="flex items-center px-3 py-2 mt-1 rounded-md text-base font-medium text-red-400 hover:bg-neutral-800 hover:text-red-300 w-full text-left"
                      >
                        <LogOut className="w-5 h-5 mr-2" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { signInWithGoogle(); closeMenu(); }}
                      className="flex items-center justify-center px-3 py-2 mt-2 rounded-md text-base font-medium bg-white text-neutral-900 hover:bg-neutral-200 w-full"
                    >
                      <LogIn className="w-5 h-5 mr-2" />
                      Login
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="flex-grow flex flex-col w-full relative">
        <Outlet />
      </main>
    </div>
  );
}