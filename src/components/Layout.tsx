import { ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Sun, Moon, LogOut, LayoutDashboard, Users, FileText, Settings, Calendar, FileSpreadsheet, Megaphone, Edit3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../lib/ThemeContext';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = (profile?.role === 'admin' || profile?.role === 'accounting')
    ? [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { name: 'Reports', path: '/admin/reports', icon: FileText },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Leave Requests', path: '/leave-requests', icon: Calendar },
        { name: 'Log Adjustments', path: '/adjustments', icon: Edit3 },
        { name: 'Announcements', path: '/announcements', icon: Megaphone },
        { name: 'Audit Logs', path: '/admin/audit-logs', icon: FileText },
      ]
    : [
        { name: 'My DTR', path: '/', icon: LayoutDashboard },
        { name: 'My Timesheets', path: '/timesheets', icon: FileSpreadsheet },
        { name: 'Leave Requests', path: '/leave-requests', icon: Calendar },
        { name: 'Log Adjustments', path: '/adjustments', icon: Edit3 },
        { name: 'Announcements', path: '/announcements', icon: Megaphone },
      ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex text-gray-900 dark:text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-[240px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col hidden md:flex">
        <div className="h-[80px] flex items-center px-10 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white mr-2.5">
            <span className="font-bold text-lg">N</span>
          </div>
          <span className="text-[20px] font-extrabold text-gray-800 dark:text-white tracking-[0.1em]">NETSOLAR</span>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <div className="mb-6 px-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Menu</p>
            <nav className="mt-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                      isActive 
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" 
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                    )}
                  >
                    <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-amber-500 dark:text-amber-400" : "text-gray-400 dark:text-gray-500")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/50 mt-auto">
          <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors group">
            <div 
              className="flex items-center min-w-0 flex-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/settings')}
              title="View Profile Settings"
            >
              <div className="relative flex-shrink-0">
                <img 
                  src={profile?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.name}`} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 object-cover"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0 ml-2.5 mr-2">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{profile?.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate capitalize leading-tight mt-0.5">{profile?.role}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-0.5 flex-shrink-0">
              <button 
                onClick={() => navigate('/settings')}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="User Settings"
              >
                <Settings className="w-[18px] h-[18px]" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pl-[240px]">
        <header className="sticky top-0 z-40 h-[80px] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sm:px-10">
          <div className="flex items-center">
            {/* Mobile Logo */}
            <div className="md:hidden w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white mr-3">
              <span className="font-bold text-lg">N</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>
        <div className="flex-1 p-6 sm:p-10 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around items-center h-16">
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1",
                    isActive 
                      ? "text-amber-600 dark:text-amber-400" 
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.name.split(' ')[0]}</span>
                </Link>
              );
            })}
            <button
              onClick={() => navigate('/settings')}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1",
                location.pathname === '/settings'
                  ? "text-amber-600 dark:text-amber-400" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              )}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-medium">Settings</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
