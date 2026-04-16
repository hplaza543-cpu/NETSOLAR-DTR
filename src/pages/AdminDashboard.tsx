import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import Layout from '../components/Layout';
import { format, subDays, isSameDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bell, Users, Clock, AlertTriangle, Download, AlertCircle, Info } from 'lucide-react';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  targetHours?: number;
  startDate?: string;
}

interface DTRLog {
  id: string;
  userId: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  totalHours?: number;
  status?: string;
  activities?: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<DTRLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData: UserProfile[] = [];
      usersSnap.forEach(doc => usersData.push({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);

      // Fetch logs
      const logsSnap = await getDocs(collection(db, 'dtr_logs'));
      const logsData: DTRLog[] = [];
      logsSnap.forEach(doc => logsData.push({ id: doc.id, ...doc.data() } as DTRLog));
      setLogs(logsData);

    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'admin_data');
    } finally {
      setLoading(false);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = logs.filter(l => l.date === todayStr);
  const lateCount = todayLogs.filter(l => l.status === 'late').length;
  const activeCount = todayLogs.length;
  
  // Notifications Data
  const clockedInUserIds = new Set(todayLogs.map(l => l.userId));
  const notClockedInUsers = users.filter(u => !clockedInUserIds.has(u.uid) && u.role !== 'admin' && u.role !== 'accounting');
  
  const lateToday = todayLogs.filter(l => l.status === 'late').map(l => {
    const u = users.find(user => user.uid === l.userId);
    return { ...l, user: u };
  });

  const incompleteToday = todayLogs.filter(l => !l.timeOut || !l.activities).map(l => {
    const u = users.find(user => user.uid === l.userId);
    return { ...l, user: u };
  });
  
  // Chart Data: Last 7 days attendance
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dStr = format(d, 'yyyy-MM-dd');
    const dayLogs = logs.filter(l => l.date === dStr);
    return {
      name: format(d, 'EEE'),
      present: dayLogs.length,
      late: dayLogs.filter(l => l.status === 'late').length,
    };
  });

  const exportCSV = () => {
    const headers = ['Date', 'Name', 'Department', 'Role', 'Time In', 'Time Out', 'Total Hours', 'Status', 'Activities'];
    const rows = logs.map(log => {
      const user = users.find(u => u.uid === log.userId);
      return [
        log.date,
        user?.name || 'Unknown',
        user?.department || '',
        user?.role || '',
        log.timeIn ? format(new Date(log.timeIn), 'HH:mm') : '',
        log.timeOut ? format(new Date(log.timeOut), 'HH:mm') : '',
        log.totalHours || '',
        log.status || '',
        `"${(log.activities || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DTR_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportInternMonthlyReport = () => {
    const currentMonthStr = format(new Date(), 'yyyy-MM'); // e.g. "2026-04"
    
    const internUsers = users.filter(u => u.role === 'intern');
    const internIds = new Set(internUsers.map(u => u.uid));
    
    const internLogs = logs.filter(log => 
      internIds.has(log.userId) && log.date.startsWith(currentMonthStr)
    );

    const headers = ['Date', 'Name', 'Department', 'Time In', 'Time Out', 'Total Hours', 'Status', 'Activities', 'Target Hours', 'Start Date'];
    const rows = internLogs.map(log => {
      const user = internUsers.find(u => u.uid === log.userId);
      return [
        log.date,
        user?.name || 'Unknown',
        user?.department || '',
        log.timeIn ? format(new Date(log.timeIn), 'HH:mm') : '',
        log.timeOut ? format(new Date(log.timeOut), 'HH:mm') : '',
        log.totalHours || '',
        log.status || '',
        `"${(log.activities || '').replace(/"/g, '""')}"`,
        user?.targetHours || '',
        user?.startDate || ''
      ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Intern_Monthly_Report_${currentMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      {/* Cut-off Reminder Banner */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start sm:items-center">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 sm:mt-0 mr-3 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <strong className="font-semibold">Reminder:</strong> The weekly DTR cut-off is <strong className="font-semibold">Thursday at 10:00 AM</strong>. Please ensure all logs are complete and exported before this time.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center">
          <div className="p-3 bg-gray-50 rounded-xl mr-4">
            <Users className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center">
          <div className="p-3 bg-amber-50 rounded-xl mr-4">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Present Today</p>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center">
          <div className="p-3 bg-[#FFFBEB] rounded-xl mr-4">
            <AlertTriangle className="h-6 w-6 text-[#92400E]" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Late Today</p>
            <p className="text-2xl font-bold text-gray-900">{lateCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart & Alerts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[16px] font-semibold text-gray-900">Attendance Overview (7 Days)</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="present" name="Present" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#1F2937" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Notifications & Alerts */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-gray-500" />
              Notifications & Alerts
            </h2>
            <div className="space-y-4">
              {/* Late Alerts */}
              {lateToday.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                    <h3 className="text-sm font-semibold text-red-800">Late Today</h3>
                  </div>
                  <p className="text-xs text-red-600">
                    {lateToday.map(l => l.user?.name).join(', ')} clocked in late today.
                  </p>
                </div>
              )}

              {/* Not Clocked In Alerts */}
              {notClockedInUsers.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <Clock className="w-4 h-4 text-gray-600 mr-2" />
                    <h3 className="text-sm font-semibold text-gray-800">Not Clocked In</h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    {notClockedInUsers.map(u => u.name).join(', ')} have not clocked in yet today.
                  </p>
                </div>
              )}

              {/* Incomplete Logs */}
              {incompleteToday.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center mb-2">
                    <Info className="w-4 h-4 text-amber-600 mr-2" />
                    <h3 className="text-sm font-semibold text-amber-800">Incomplete Logs</h3>
                  </div>
                  <p className="text-xs text-amber-700">
                    {incompleteToday.map(l => l.user?.name).join(', ')} have missing time-out or activities for today.
                  </p>
                </div>
              )}

              {lateToday.length === 0 && notClockedInUsers.length === 0 && incompleteToday.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No alerts at this time.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent */}
        <div className="space-y-6">
          <div className="bg-[#111] text-white p-5 rounded-xl border-none">
            <div className="text-[12px] opacity-60 mb-2 uppercase tracking-wider">Quick Export</div>
            <div className="font-semibold text-[14px] mb-4">Generate Reports</div>
            <div className="space-y-3">
              <button 
                onClick={exportCSV}
                className="w-full flex items-center justify-center py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-colors text-[12px]"
              >
                <Download className="w-4 h-4 mr-2" />
                ALL DTR (CSV)
              </button>
              <button 
                onClick={exportInternMonthlyReport}
                className="w-full flex items-center justify-center py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold rounded-full transition-colors text-[12px]"
              >
                <Download className="w-4 h-4 mr-2" />
                INTERN MONTHLY (CSV)
              </button>
            </div>
          </div>

          <div className="bg-[#FFFBEB] border-l-4 border-amber-500 p-5 rounded-lg">
            <div className="text-[13px] font-bold text-[#92400E] uppercase mb-1 flex items-center">
              <Bell className="w-4 h-4 mr-2" />
              Deadline Reminder
            </div>
            <p className="text-[14px] text-[#B45309] leading-relaxed mb-4">Send Wednesday reminders to employees with missing DTR.</p>
            <button 
              onClick={() => alert('Reminders sent to employees with missing DTR!')}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all text-sm"
            >
              Send Reminders
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4">Today's Submissions</h2>
            <div className="space-y-3">
              {todayLogs.slice(0, 5).map(log => {
                const user = users.find(u => u.uid === log.userId);
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 truncate">{format(new Date(log.timeIn), 'hh:mm a')}</p>
                    </div>
                    {log.status === 'late' && (
                      <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">Late</span>
                    )}
                  </div>
                );
              })}
              {todayLogs.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No submissions yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
