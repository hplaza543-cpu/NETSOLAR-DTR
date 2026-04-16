import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface DTRLog {
  id: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  totalHours?: number;
  status?: string;
  activities?: string;
  notes?: string;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [todayLog, setTodayLog] = useState<DTRLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DTRLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activities, setActivities] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cumulativeHours, setCumulativeHours] = useState(0);
  const [activeSessionHours, setActiveSessionHours] = useState(0);
  const [error, setError] = useState('');

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (todayLog && !todayLog.timeOut) {
      const updateActiveHours = () => {
        const now = new Date();
        const timeInDate = new Date(todayLog.timeIn);
        const diffMs = now.getTime() - timeInDate.getTime();
        const hours = diffMs / (1000 * 60 * 60);
        setActiveSessionHours(hours);
      };
      updateActiveHours();
      interval = setInterval(updateActiveHours, 60000); // Update every minute
    } else {
      setActiveSessionHours(0);
    }
    return () => clearInterval(interval);
  }, [todayLog]);

  const fetchLogs = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const logsRef = collection(db, 'dtr_logs');
      const q = query(logsRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const logs: DTRLog[] = [];
      let total = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data() as DTRLog;
        logs.push({ id: doc.id, ...data });
        if (data.totalHours) {
          total += data.totalHours;
        }
      });

      // Sort logs by date descending
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecentLogs(logs);
      setCumulativeHours(total);
      
      const today = logs.find(log => log.date === todayStr);
      if (today) {
        setTodayLog(today);
        setActivities(today.activities || '');
        setNotes(today.notes || '');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'dtr_logs');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeIn = async () => {
    if (!user) return;
    try {
      setActionLoading(true);
      const now = new Date();
      
      // Check if late (after 10:00 AM)
      const isLate = now.getHours() >= 10 && now.getMinutes() > 0;
      
      const newLog = {
        userId: user.uid,
        date: todayStr,
        timeIn: now.toISOString(),
        status: isLate ? 'late' : 'on-time',
        createdAt: now.toISOString()
      };

      const docRef = await addDoc(collection(db, 'dtr_logs'), newLog);
      setTodayLog({ id: docRef.id, ...newLog });
      fetchLogs();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'dtr_logs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTimeOut = async () => {
    if (!user || !todayLog) return;
    
    if (!activities.trim()) {
      setError('Please enter your daily activities/tasks before timing out.');
      return;
    }
    
    try {
      setError('');
      setActionLoading(true);
      const now = new Date();
      const timeInDate = new Date(todayLog.timeIn);
      const diffMs = now.getTime() - timeInDate.getTime();
      const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      const logRef = doc(db, 'dtr_logs', todayLog.id);
      await updateDoc(logRef, {
        timeOut: now.toISOString(),
        totalHours,
        activities,
        notes
      });

      setTodayLog({ ...todayLog, timeOut: now.toISOString(), totalHours, activities, notes });
      fetchLogs();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dtr_logs/${todayLog.id}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateActivities = async () => {
    if (!user || !todayLog) return;
    try {
      setActionLoading(true);
      const logRef = doc(db, 'dtr_logs', todayLog.id);
      await updateDoc(logRef, {
        activities,
        notes
      });
      setTodayLog({ ...todayLog, activities, notes });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dtr_logs/${todayLog.id}`);
    } finally {
      setActionLoading(false);
    }
  };

  const effectiveDate = selectedDate || todayStr;
  const displayedLogs = recentLogs.filter(log => log.date === effectiveDate);

  if (loading) {
    return (
      <Layout title="My DTR">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Daily Time Record">
      {profile?.role === 'intern' && profile.targetHours && (
        <div className="mb-6 bg-white p-5 rounded-xl border border-gray-200">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Internship Progress</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {(cumulativeHours + activeSessionHours).toFixed(2)} <span className="text-sm font-medium text-gray-500">/ {profile.targetHours} hrs</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Started: {profile.startDate ? format(new Date(profile.startDate), 'MMM d, yyyy') : 'N/A'}</p>
              <p className="text-sm font-medium text-amber-600 mt-1">
                {Math.min(100, Math.round(((cumulativeHours + activeSessionHours) / profile.targetHours) * 100))}% Completed
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mt-3 overflow-hidden">
            <div 
              className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, ((cumulativeHours + activeSessionHours) / profile.targetHours) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Action Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[20px] border border-gray-200 p-10 text-center relative">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 hidden">Today's Status</h2>
            
            {!todayLog ? (
              <div className="text-center">
                <div className="text-[48px] font-bold text-gray-900 mb-2">
                  {format(new Date(), 'hh:mm a')}
                </div>
                <div className="text-gray-500 mb-8 uppercase tracking-[0.05em] text-[13px]">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </div>
                <button
                  onClick={handleTimeIn}
                  disabled={actionLoading}
                  className="w-full py-4 px-8 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 text-[15px]"
                >
                  {actionLoading ? 'Processing...' : 'TIME IN'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-500">Time In</p>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(todayLog.timeIn), 'hh:mm a')}
                    </p>
                  </div>
                  {todayLog.status === 'late' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <AlertCircle className="w-3 h-3 mr-1" /> Late
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> On Time
                    </span>
                  )}
                </div>

                {!todayLog.timeOut && (
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div>
                      <p className="text-sm text-amber-700 font-medium">Active Session</p>
                      <p className="text-xs text-amber-600/80 mt-0.5">Tracking time automatically...</p>
                    </div>
                    <div className="text-xl font-bold text-amber-600 font-mono">
                      {Math.floor(activeSessionHours)}h {Math.floor((activeSessionHours % 1) * 60)}m
                    </div>
                  </div>
                )}

                {todayLog.timeOut ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-500">Time Out</p>
                      <p className="font-semibold text-gray-900">
                        {format(new Date(todayLog.timeOut), 'hh:mm a')}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {todayLog.totalHours} hrs
                    </span>
                  </div>
                ) : (
                  <div className="pt-4 space-y-4 border-t border-gray-100">
                    {error && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start">
                        <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Daily Activities / Tasks <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={activities}
                        onChange={(e) => {
                          setActivities(e.target.value);
                          if (e.target.value.trim()) setError('');
                        }}
                        rows={3}
                        placeholder="What did you work on today? (Required before Time Out)"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500 text-sm ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                      />
                    </div>
                    
                    <div className="flex space-x-4 pt-4">
                      <button
                        onClick={handleUpdateActivities}
                        disabled={actionLoading}
                        className="flex-1 py-4 px-8 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 text-[15px]"
                      >
                        Save Notes
                      </button>
                      <button
                        onClick={handleTimeOut}
                        disabled={actionLoading}
                        className="flex-1 py-4 px-8 bg-transparent border-2 border-gray-200 hover:border-gray-300 text-gray-800 font-semibold rounded-full transition-colors disabled:opacity-50 text-[15px]"
                      >
                        TIME OUT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-5 gap-4">
              <h2 className="text-[16px] font-semibold text-gray-900">Activity Log</h2>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={todayStr}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-700"
                />
                {selectedDate && selectedDate !== todayStr && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              {displayedLogs.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No logs found for {format(new Date(effectiveDate), 'MMM d, yyyy')}.</div>
              ) : (
                displayedLogs.map((log) => (
                  <div key={log.id} className="flex flex-col py-3 border-b border-gray-200 last:border-0 text-[14px]">
                    <div className="flex items-start">
                      <span className="w-[80px] text-gray-500 font-mono shrink-0">
                        {format(new Date(log.timeIn), 'hh:mm a')}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {format(new Date(log.date), 'MMM d, yyyy')}
                          </span>
                          {log.status === 'late' && (
                            <span className="px-2 py-0.5 rounded text-[11px] uppercase bg-amber-100 text-amber-600 font-medium">Late</span>
                          )}
                        </div>
                        {log.activities ? (
                          <span className="text-gray-800">{log.activities}</span>
                        ) : (
                          <span className="text-gray-400 italic">No activities logged</span>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Out: {log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : 'Active'} 
                          {log.totalHours && ` • ${log.totalHours} hrs`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
