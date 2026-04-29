import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '../components/Layout';
import { safeFormat } from '../lib/utils';
import { format, parseISO, startOfYear } from 'date-fns';
import { Search, Calendar, User as UserIcon, Clock, FileText } from 'lucide-react';
import { fillMissingDaysForAllUsers, DTRLog } from '../lib/attendance';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status?: string;
  startDate?: string;
  createdAt?: string;
}

export default function Reports() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<DTRLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchLogs();
    }
  }, [selectedDate, selectedUserId, users]);

  const fetchUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'users'), where('role', 'in', ['employee', 'intern']));
      const usersSnapshot = await getDocs(usersQuery);
      const fetchedUsers = usersSnapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(user => user.status !== 'archived');
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      let baseQuery;
      
      if (selectedDate && !selectedUserId) {
        baseQuery = query(
          collection(db, 'dtr_logs'), 
          where('date', '==', selectedDate)
        );
      } else if (selectedUserId) {
        // If a specific user is selected, if they also selected a date, we could just rely on db query, but to be safe:
        baseQuery = query(
          collection(db, 'dtr_logs'), 
          where('userId', '==', selectedUserId)
        );
      } else {
        // Fallback
        baseQuery = query(collection(db, 'dtr_logs'));
      }

      const logsSnapshot = await getDocs(baseQuery);
      let fetchedLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as DTRLog));
      
      let intervalStart = startOfYear(new Date());
      let intervalEnd = new Date();
      
      if (selectedDate) {
        const d = parseISO(selectedDate);
        intervalStart = d;
        intervalEnd = d;
      }

      // Memory filter
      if (selectedDate && selectedUserId) {
         fetchedLogs = fetchedLogs.filter(log => log.userId === selectedUserId && log.date === selectedDate);
      }

      // Fill missing
      let targetUsers = users;
      if (selectedUserId) {
        targetUsers = users.filter(u => u.uid === selectedUserId);
      }
      fetchedLogs = fillMissingDaysForAllUsers(fetchedLogs, targetUsers, intervalStart, intervalEnd);

      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error fetching generic reports data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.sort((a, b) => new Date(b.timeIn || b.date).getTime() - new Date(a.timeIn || a.date).getTime());

  return (
    <Layout title="Activity Reports">
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Employee
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                >
                  <option value="">All Employees</option>
                  {users.map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.name} ({user.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">Daily Activities Log</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'} found
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 px-4 shadow-sm">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No activity records found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try selecting a different date or employee.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map(log => {
                const user = users.find(u => u.uid === log.userId);
                return (
                  <div key={log.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">
                          {user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{user?.name || 'Unknown User'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mb-2">{user?.role || 'Employee'} • {user?.department || 'No Dept'}</p>
                          
                          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700 mt-3 inline-block w-full sm:mx-w-2xl">
                             <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Accomplishment / Activities</h4>
                             <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                               {log.activities || <span className="italic text-gray-400">No activities reported for this shift.</span>}
                             </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-start sm:items-end text-sm whitespace-nowrap bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col space-y-1.5 w-full">
                          <p className="flex justify-between w-full sm:justify-start">
                            <span className="text-gray-500 dark:text-gray-400 mr-2 sm:w-16">Time In:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{log.timeIn ? safeFormat(log.timeIn, 'hh:mm a') : 'N/A'}</span>
                          </p>
                          <p className="flex justify-between w-full sm:justify-start">
                             <span className="text-gray-500 dark:text-gray-400 mr-2 sm:w-16">Time Out:</span>
                             <span className="font-medium text-gray-900 dark:text-white">{log.timeOut ? safeFormat(log.timeOut, 'hh:mm a') : 'N/A'}</span>
                          </p>
                          <div className="my-1 border-t border-gray-200 dark:border-gray-600"></div>
                          <p className="flex justify-between w-full sm:justify-start">
                             <span className="text-gray-500 dark:text-gray-400 mr-2 sm:w-16">Total:</span>
                             <span className="font-medium text-indigo-600 dark:text-indigo-400">{log.totalHours ? `${log.totalHours.toFixed(1)} hrs` : 'N/A'}</span>
                          </p>
                           <p className="flex justify-between w-full sm:justify-start items-center">
                             <span className="text-gray-500 dark:text-gray-400 mr-2 sm:w-16">Status:</span>
                             {log.status === 'late' ? (
                               <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase tracking-wider">Late</span>
                             ) : log.status === 'on-time' ? (
                               <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 uppercase tracking-wider">On Time</span>
                             ) : (
                               <span className="text-gray-900 dark:text-white capitalize">{log.status}</span>
                             )}
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
