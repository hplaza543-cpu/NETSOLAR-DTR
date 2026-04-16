import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { FileSpreadsheet, Download } from 'lucide-react';
import { format } from 'date-fns';

interface DTRLog {
  id: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  totalHours?: number;
  status?: string;
  activities?: string;
}

export default function Timesheets() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DTRLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const fetchLogs = async () => {
    if (!user) return;
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

  const filteredLogs = logs.filter(log => log.date.startsWith(selectedMonth));
  
  const totalHours = filteredLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
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
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Select Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-sm font-medium"
              />
            </div>
          </div>
          <button
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Days Logged</p>
            <p className="text-2xl font-bold text-gray-900">{filteredLogs.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Hours</p>
            <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Late Days</p>
            <p className="text-2xl font-bold text-red-600">{lateDays}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Time In</th>
                  <th className="px-6 py-3 font-medium">Time Out</th>
                  <th className="px-6 py-3 font-medium">Total Hrs</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No logs found for this month.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {format(new Date(log.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {log.timeIn ? format(new Date(log.timeIn), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {log.totalHours || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {log.status === 'late' ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">Late</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">On Time</span>
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
