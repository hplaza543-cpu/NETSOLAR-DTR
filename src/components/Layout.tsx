import { ReactNode, useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Sun, Moon, LogOut, LayoutDashboard, Users, FileText, Settings, Calendar, FileSpreadsheet, Megaphone, Edit3, Bell, Search, HelpCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../lib/ThemeContext';
import { formatDistanceToNow } from 'date-fns';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;

    // Check initially and then clear notification if we are on the page
    if (location.pathname === '/announcements') {
      setHasNewAnnouncements(false);
    }

    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(4));
    
    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        setRecentAnnouncements(docs);

        if (profile.role !== 'admin' && location.pathname !== '/announcements') {
          const latest = docs[0];
          const lastViewed = localStorage.getItem(`lastViewedAnnouncements_${profile.uid}`);
          
          if (!lastViewed || new Date(latest.createdAt) > new Date(lastViewed)) {
            setHasNewAnnouncements(true);
          } else {
            setHasNewAnnouncements(false);
          }
        }
      }
    }, (error) => {
      console.error("Error listening to announcements:", error);
    });

    return () => unsubscribe();
  }, [location.pathname, profile]);

  // Handle clicking outside of the notification popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const mobileNavItems = (profile?.role === 'admin' || profile?.role === 'accounting')
    ? [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Leaves', path: '/leave-requests', icon: Calendar },
        { name: 'Updates', path: '/announcements', icon: Megaphone },
      ]
    : [
        { name: 'My DTR', path: '/', icon: LayoutDashboard },
        { name: 'Timesheets', path: '/timesheets', icon: FileSpreadsheet },
        { name: 'Leaves', path: '/leave-requests', icon: Calendar },
        { name: 'Updates', path: '/announcements', icon: Megaphone },
      ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex text-gray-900 dark:text-gray-100 font-sans">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-[80px] hover:w-[240px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_24px_-10px_rgba(0,0,0,0.3)] flex flex-col hidden md:flex transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] group overflow-hidden">
        {/* Inner rigid container to prevent text wrapping during transition */}
        <div className="w-[240px] flex flex-col h-full"> 
          <div className="h-[80px] flex items-center px-6 flex-shrink-0">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <span className="font-bold text-lg">N</span>
            </div>
            <span className="text-[20px] font-extrabold text-gray-800 dark:text-white tracking-[0.1em] ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">NETSOLAR</span>
          </div>
          
          <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-4">
                <span className="hidden group-hover:inline">Menu</span>
              </p>
              <nav className="mt-3 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center px-3 py-3 font-medium rounded-xl transition-all duration-200 relative group/link mx-1",
                        isActive 
                          ? "bg-amber-100/80 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" 
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                      )}
                      title={item.name}
                    >
                      <Icon className={cn("flex-shrink-0 h-6 w-6 ml-0.5", isActive ? "text-amber-500 dark:text-amber-400" : "text-gray-400 dark:text-gray-500")} strokeWidth={isActive ? 2.5 : 2} />
                      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap flex-1 flex items-center justify-between text-[15px]">
                        {item.name}
                        {item.path === '/announcements' && hasNewAnnouncements && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="p-3 bg-black/5 dark:bg-white/5 mt-auto">
            <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-colors">
              <div 
                className="flex items-center cursor-pointer py-1 px-1.5 rounded-lg flex-1 overflow-hidden"
                onClick={() => navigate('/settings')}
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={profile?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.name}`} 
                    alt="Avatar" 
                    className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 object-cover"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-3 flex-1 overflow-hidden flex flex-col justify-center">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate leading-[1.2]">{profile?.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-[1.2] mt-0.5">
                    {profile?.username && <span>@{profile.username} • </span>}
                    <span className="capitalize">{profile?.role}</span>
                  </p>
                </div>
              </div>
              
              <div className="items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden group-hover:flex">
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pl-[80px]">
        <header className="sticky top-0 z-40 h-[80px] bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_24px_-10px_rgba(0,0,0,0.4)] flex items-center justify-between px-6 sm:px-10">
          <div className="flex items-center">
            {/* Mobile Logo */}
            <div className="md:hidden w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white mr-3">
              <span className="font-bold text-lg">N</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Dummy Search bar (Desktop) / Icon (Mobile) */}
            <div className="hidden lg:flex items-center relative">
              <Search className="absolute left-3 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 bg-gray-100 dark:bg-gray-700/50 border-none rounded-full text-sm focus:ring-2 focus:ring-amber-500 dark:text-white w-48 lg:w-64 transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
              />
            </div>
            <button className="lg:hidden p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Search className="w-5 h-5" />
            </button>

            {/* Dummy Help/Docs button */}
            <button className="hidden sm:flex p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Notifications Popover Container */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={cn(
                  "relative p-2 rounded-full transition-colors",
                  isNotificationOpen ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <Bell className="w-5 h-5" />
                {hasNewAnnouncements && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-gray-800 animate-pulse"></span>
                )}
              </button>

              {/* Popover Content */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden z-50 transform origin-top-right transition-all">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {recentAnnouncements.length > 0 ? (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {recentAnnouncements.map((announcement) => (
                          <div 
                            key={announcement.id}
                            onClick={() => {
                              navigate('/announcements');
                              setIsNotificationOpen(false);
                            }}
                            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
                                <Megaphone className="w-4 h-4" />
                              </div>
                              <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{announcement.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{announcement.content}</p>
                                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-wider">
                                  {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center">
                        <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">All caught up!</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-center">
                    <button 
                      onClick={() => {
                        navigate('/announcements');
                        setIsNotificationOpen(false);
                      }}
                      className="text-sm font-medium text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                    >
                      View all Announcements
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>
        <div className="flex-1 p-6 sm:p-10 bg-gray-50 dark:bg-gray-900 transition-colors">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-[0_-4px_24px_-10px_rgba(0,0,0,0.1)] z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around items-center h-16">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path === '/admin' && location.pathname.startsWith('/admin') && location.pathname !== '/admin/users');
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
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.path === '/announcements' && hasNewAnnouncements && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-gray-800"></span>
                    )}
                  </div>
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
