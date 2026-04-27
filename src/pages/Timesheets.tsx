import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { FileSpreadsheet, Download } from 'lucide-react';
import { format, endOfMonth } from 'date-fns';
import { fillMissingDaysForUser, DTRLog } from '../lib/attendance';
import { motion } from 'motion/react';

export default function Timesheets() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<DTRLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    if (user && profile) {
      fetchLogs();
    }
  }, [user, profile]);

  const fetchLogs = async () => {
    if (!user || !profile) return;
    try {
      setLoading(true);
      const q = query(collection(db, 'dtr_logs'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const data: DTRLog[] = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as DTRLog));
      
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLogs(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'dtr_logs');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredLogs = () => {
    const monthLogs = logs.filter(log => log.date.startsWith(selectedMonth));
    if (!profile) return monthLogs;
    
    // dynamically generate absent logs for this month
    const startOfMonth = new Date(selectedMonth + '-01T00:00:00');
    const endOfThisMonth = endOfMonth(startOfMonth);
    
    return fillMissingDaysForUser(monthLogs, profile, startOfMonth, endOfThisMonth);
  };

  const filteredLogs = getFilteredLogs();
  
  const totalHours = filteredLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
  const absentDays = filteredLogs.filter(log => log.status === 'absent').length;
  const lateDays = filteredLogs.filter(log => log.status === 'late').length;

  const exportCSV = () => {
    const headers = ['Date', 'Time In', 'Time Out', 'Total Hours', 'Status', 'Activities'];
    const rows = filteredLogs.map(log => [
      log.date,
      log.timeIn ? format(new Date(log.timeIn), 'HH:mm') : '',
      log.timeOut ? format(new Date(log.timeOut), 'HH:mm') : '',
      log.totalHours || '',
      log.status || '',
      `"${(log.activities || '').replace(/"/g, '""')}"`
    ].join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `My_Timesheet_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Layout title="My Timesheets">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Timesheets">
      <div className="space-y-6">
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Select Month</label>
              <motion.input
                whileTap={{ scale: 0.95 }}
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Days Logged</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredLogs.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mr-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalHours.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mr-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Late Days</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{lateDays}</p>
             </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 flex items-center justify-center mr-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Absent Days</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{absentDays}</p>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Time In</th>
                  <th className="px-6 py-3 font-medium">Time Out</th>
                  <th className="px-6 py-3 font-medium">Total Hrs</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      No logs found for this month.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {format(new Date(log.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {log.timeIn ? format(new Date(log.timeIn), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {log.totalHours || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {log.status === 'late' ? (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded text-xs font-medium">Late</span>
                        ) : log.status === 'absent' ? (
                          <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs font-medium">Absent</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded text-xs font-medium">On Time</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}
