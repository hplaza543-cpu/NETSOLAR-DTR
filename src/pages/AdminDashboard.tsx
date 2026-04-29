import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import Layout from '../components/Layout';
import { safeFormat } from '../lib/utils';
import { format, subDays, isSameDay, startOfMonth, startOfYear, parseISO, isBefore, isWeekend } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bell, Users, Clock, AlertTriangle, Download, AlertCircle, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { fillMissingDaysForAllUsers, DTRLog } from '../lib/attendance';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  targetHours?: number;
  startDate?: string;
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

      // We only need logs for the last 7 days and current month for the dashboard features
      // To keep query simple and leverage string dates: 
      // yyyy-MM-dd allows lexicographical comparison
      const d7 = subDays(new Date(), 7);
      const startOfMth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const minDate = d7 < startOfMth ? format(d7, 'yyyy-MM-dd') : format(startOfMth, 'yyyy-MM-dd');
      
      const logsQuery = query(collection(db, 'dtr_logs'), where('date', '>=', minDate));
      const logsSnap = await getDocs(logsQuery);
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

  // Notifications Data
  const employeesAndInterns = users.filter(u => u.role !== 'admin' && u.role !== 'accounting');
  const employeeAndInternIds = new Set(employeesAndInterns.map(u => u.uid));
  
  const todayLogs = logs.filter(l => l.date === todayStr && employeeAndInternIds.has(l.userId));
  const lateCount = todayLogs.filter(l => l.status === 'late').length;
  const activeCount = todayLogs.length;

  const clockedInUserIds = new Set(todayLogs.map(l => l.userId));
  const notClockedInUsers = employeesAndInterns.filter(u => !clockedInUserIds.has(u.uid));
  
  const lateToday = todayLogs.filter(l => l.status === 'late').map(l => {
    const u = users.find(user => user.uid === l.userId);
    return { ...l, user: u };
  });

  const incompleteToday = todayLogs.filter(l => !l.timeOut || !l.activities).map(l => {
    const u = users.find(user => user.uid === l.userId);
    return { ...l, user: u };
  });
  
  // Helper to calculate total hours worked by an intern this month
  const getMonthlyTotalHours = (userId: string) => {
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const userLogsThisMonth = logs.filter(l => l.userId === userId && l.date.startsWith(currentMonthStr));
    const total = userLogsThisMonth.reduce((sum, log) => sum + (log.totalHours || 0), 0);
    return total.toFixed(2);
  };

  // Live Employee Status
  const employeeStatuses = employeesAndInterns
    .map(user => {
      const log = todayLogs.find(l => l.userId === user.uid);
      let status: 'active-on-time' | 'active-late' | 'completed' | 'absent' = 'absent';
      let timeIn = '';
      let timeOut = '';

      if (log) {
        timeIn = safeFormat(log.timeIn, 'hh:mm a');
        if (log.timeOut) {
          status = 'completed';
          timeOut = safeFormat(log.timeOut, 'hh:mm a');
        } else {
          status = log.status === 'late' ? 'active-late' : 'active-on-time';
        }
      }

      return {
        user,
        status,
        timeIn,
        timeOut
      };
    })
    .sort((a, b) => {
      const order = { 'active-late': 1, 'active-on-time': 2, 'completed': 3, 'absent': 4 };
      return order[a.status] - order[b.status];
    });

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dStr = format(d, 'yyyy-MM-dd');
    const dayLogs = logs.filter(l => l.date === dStr && employeeAndInternIds.has(l.userId));
    
    // We only calculate missing days if it's not a weekend
    let absentCount = 0;
    if (!isWeekend(d)) {
      // Find out how many employees were actually active on this day. 
      // For simplicity, we just count all active users who don't have a log.
      // E.g., if a user just started yesterday, they shouldn't be "absent" 3 days ago.
      let activeAsOfSet = 0;
      employeesAndInterns.forEach(user => {
        const userStartDateStr = user.startDate || user.createdAt;
        let isActiveOnDate = true;
        if (userStartDateStr) {
           const sDate = userStartDateStr.includes('T') ? parseISO(userStartDateStr) : new Date(userStartDateStr);
           if (!isNaN(sDate.getTime()) && isBefore(d, sDate) && !isSameDay(d, sDate)) {
             isActiveOnDate = false;
           }
        }
        if (isActiveOnDate) activeAsOfSet++;
      });
      absentCount = activeAsOfSet - dayLogs.filter(l => l.status !== 'absent').length;
    }

    return {
      name: format(d, 'EEE'),
      fullDate: format(d, 'MMM dd, yyyy'),
      present: dayLogs.filter(l => l.status !== 'absent').length,
      late: dayLogs.filter(l => l.status === 'late').length,
      absent: Math.max(0, absentCount)
    };
  });

  const exportCSV = async () => {
    try {
      setLoading(true);
      const allLogsSnap = await getDocs(collection(db, 'dtr_logs'));
      let allLogs: DTRLog[] = [];
      allLogsSnap.forEach(doc => allLogs.push({ id: doc.id, ...doc.data() } as DTRLog));

      // Fill missing absent days since start of year for active employees for the full export
      const intervalStart = startOfYear(new Date());
      const intervalEnd = new Date();
      allLogs = fillMissingDaysForAllUsers(allLogs, employeesAndInterns, intervalStart, intervalEnd);

      const headers = ['Date', 'Name', 'Department', 'Role', 'Time In', 'Time Out', 'Total Hours', 'Status', 'Activities'];
      const rows = allLogs.map(log => {
        const user = users.find(u => u.uid === log.userId);
        return [
          log.date,
          user?.name || 'Unknown',
          user?.department || '',
          user?.role || '',
          log.timeIn ? safeFormat(log.timeIn, 'HH:mm', '') : '',
          log.timeOut ? safeFormat(log.timeOut, 'HH:mm', '') : '',
          log.totalHours || '0',
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
    } catch (error) {
      console.error("Failed to export logs:", error);
      alert("Failed to export all DTR data.");
    } finally {
      setLoading(false);
    }
  };

  const exportInternMonthlyReport = async () => {
    try {
      setLoading(true);
      const currentMonthStr = format(new Date(), 'yyyy-MM'); // e.g. "2026-04"
      
      const internUsers = users.filter(u => u.role === 'intern');
      
      const allLogsSnap = await getDocs(collection(db, 'dtr_logs'));
      let internLogs: DTRLog[] = [];
      const internIds = new Set(internUsers.map(u => u.uid));
      allLogsSnap.forEach(doc => {
        const d = ({ id: doc.id, ...doc.data() } as DTRLog);
        if (internIds.has(d.userId) && d.date.startsWith(currentMonthStr)) {
          internLogs.push(d);
        }
      });
      
      // Fill missing days
      const mthStart = startOfMonth(new Date());
      const mthEnd = new Date();
      internLogs = fillMissingDaysForAllUsers(internLogs, internUsers, mthStart, mthEnd);

      const headers = ['Date', 'Name', 'Department', 'Time In', 'Time Out', 'Total Hours', 'Status', 'Activities', 'Target Hours', 'Start Date'];
      const rows = internLogs.map(log => {
        const user = internUsers.find(u => u.uid === log.userId);
        return [
          log.date,
          user?.name || 'Unknown',
          user?.department || '',
          log.timeIn ? safeFormat(log.timeIn, 'HH:mm', '') : '',
          log.timeOut ? safeFormat(log.timeOut, 'HH:mm', '') : '',
          log.totalHours || '0',
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
    } catch (error) {
      console.error("Failed to export logs:", error);
      alert("Failed to export intern DTR data.");
    } finally {
      setLoading(false);
    }
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
      <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 flex items-start sm:items-center">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 sm:mt-0 mr-3 flex-shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-400">
          <strong className="font-semibold">Reminder:</strong> The weekly DTR cut-off is <strong className="font-semibold">Thursday at 10:00 AM</strong>. Please ensure all logs are complete and exported before this time.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl mr-4">
            <Users className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{employeesAndInterns.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl mr-4">
            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Present Today</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center">
          <div className="p-3 bg-[#FFFBEB] dark:bg-amber-900/20 rounded-xl mr-4">
            <AlertTriangle className="h-6 w-6 text-[#92400E] dark:text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Late Today</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{lateCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart & Alerts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">Attendance Overview (7 Days)</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                    position={{ y: -10 }}
                    wrapperStyle={{ outline: 'none', transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.75, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ 
                              type: 'spring', 
                              stiffness: 250, 
                              damping: 25,
                              mass: 1.2
                            }}
                            className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 p-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] min-w-[200px]"
                          >
                            <p className="font-semibold text-gray-900 dark:text-white border-b border-gray-200/50 dark:border-gray-700/50 pb-2 mb-2">
                              {payload[0].payload.fullDate || label}
                            </p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center space-x-2 text-sm mt-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{entry.value}</span>
                              </div>
                            ))}
                          </motion.div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="present" name="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#EAB308" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Notifications & Alerts */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Notifications & Alerts
            </h2>
            <div className="space-y-4">
              {/* Late Alerts */}
              {lateToday.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-500 mr-2" />
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Late Today</h3>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {lateToday.map(l => l.user?.name).join(', ')} clocked in late today.
                  </p>
                </div>
              )}

              {/* Not Clocked In Alerts */}
              {notClockedInUsers.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center mb-2">
                    <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400 mr-2" />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Not Clocked In</h3>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {notClockedInUsers.map(u => u.name).join(', ')} have not clocked in yet today.
                  </p>
                </div>
              )}

              {/* Incomplete Logs */}
              {incompleteToday.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center mb-2">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-500 mr-2" />
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">Incomplete Logs</h3>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    {incompleteToday.map(l => l.user?.name).join(', ')} have missing time-out or activities for today.
                  </p>
                </div>
              )}

              {lateToday.length === 0 && notClockedInUsers.length === 0 && incompleteToday.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No alerts at this time.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent */}
        <div className="space-y-6">
          <div className="bg-[#111] dark:bg-gray-800 text-white p-5 rounded-xl border-none">
            <div className="text-[12px] opacity-60 mb-2 uppercase tracking-wider">Quick Export</div>
            <div className="font-semibold text-[14px] mb-4">Generate Reports</div>
            <div className="space-y-3">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={exportCSV}
                className="w-full flex items-center justify-center py-2.5 px-4 bg-white/10 hover:bg-white/20 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold rounded-full transition-colors text-[12px]"
              >
                <Download className="w-4 h-4 mr-2" />
                ALL DTR (CSV)
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={exportInternMonthlyReport}
                className="w-full flex items-center justify-center py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-400 font-semibold rounded-full transition-colors text-[12px]"
              >
                <Download className="w-4 h-4 mr-2" />
                INTERN MONTHLY (CSV)
              </motion.button>
            </div>
          </div>

          <div className="bg-[#FFFBEB] dark:bg-amber-900/20 border-l-4 border-amber-500 p-5 rounded-lg">
            <div className="text-[13px] font-bold text-[#92400E] dark:text-amber-500 uppercase mb-1 flex items-center">
              <Bell className="w-4 h-4 mr-2" />
              Deadline Reminder
            </div>
            <p className="text-[14px] text-[#B45309] dark:text-amber-400 leading-relaxed mb-4">Send Wednesday reminders to employees with missing DTR.</p>
            <button 
              onClick={() => alert('Reminders sent to employees with missing DTR!')}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all text-sm"
            >
              Send Reminders
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col h-[400px]">
            <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white mb-4">Live Employee Status</h2>
            <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
              {employeeStatuses.map(({ user, status, timeIn, timeOut }) => (
                <div 
                  key={user.uid} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 transition-colors"
                  title={user.role === 'intern' ? `${user.name} - ${getMonthlyTotalHours(user.uid)} hours (This Month)` : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.name} {user.role === 'intern' && <span className="ml-1 text-[10px] text-gray-400 font-normal uppercase">(Intern)</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {status === 'absent' ? 'Not Clocked In' : `In: ${timeIn}`}
                      {timeOut && ` • Out: ${timeOut}`}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {status === 'active-on-time' && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 uppercase tracking-wider">Active</span>}
                    {status === 'active-late' && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase tracking-wider">Late</span>}
                    {status === 'completed' && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 uppercase tracking-wider">Done</span>}
                    {status === 'absent' && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 uppercase tracking-wider">Absent</span>}
                  </div>
                </div>
              ))}
              {employeeStatuses.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No employees found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
