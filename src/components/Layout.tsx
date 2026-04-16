import { ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Sun, LogOut, LayoutDashboard, Users, FileText, Settings, Calendar, FileSpreadsheet, Megaphone, Edit3 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { profile } = useAuth();
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
      ]
    : [
        { name: 'My DTR', path: '/', icon: LayoutDashboard },
        { name: 'My Timesheets', path: '/timesheets', icon: FileSpreadsheet },
        { name: 'Leave Requests', path: '/leave-requests', icon: Calendar },
        { name: 'Log Adjustments', path: '/adjustments', icon: Edit3 },
        { name: 'Announcements', path: '/announcements', icon: Megaphone },
      ];

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col md:flex-row text-[#1F2937] font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-[240px] bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="h-[80px] flex items-center px-10 border-b border-gray-200">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white mr-2.5">
            <span className="font-bold text-lg">N</span>
          </div>
          <span className="text-[20px] font-extrabold text-gray-800 tracking-[0.1em]">NETSOLAR</span>
        </div>
        
        <div className="p-4 flex-1">
          <div className="mb-6 px-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu</p>
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
                        ? "bg-amber-100 text-amber-500" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-amber-500" : "text-gray-400")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50/30 mt-auto">
          <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-gray-200/50 transition-colors group">
            <div 
              className="flex items-center min-w-0 flex-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-gray-200/50 transition-colors"
              onClick={() => navigate('/settings')}
              title="View Profile Settings"
            >
              <div className="relative flex-shrink-0">
                <img 
                  src={profile?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.name}`} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full bg-gray-200 object-cover"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0 ml-2.5 mr-2">
                <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{profile?.name}</p>
                <p className="text-[11px] text-gray-500 truncate capitalize leading-tight mt-0.5">{profile?.role}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-0.5 flex-shrink-0">
              <button 
                onClick={() => navigate('/settings')}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                title="User Settings"
              >
                <Settings className="w-[18px] h-[18px]" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[80px] bg-white border-b border-gray-200 flex items-center px-10">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-8 sm:p-10">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
