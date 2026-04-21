import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { format, isThursday, isWednesday, nextWednesday, previousThursday, subDays, addDays, isWeekend } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logAuditAction } from '../lib/audit';
import Layout from '../components/Layout';
import { Clock, CheckCircle2, AlertCircle, BarChart as BarChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Resume context if suspended (browser auto-play policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Play a pleasant ascending arpeggio chime
    playNote(523.25, now, 0.4); // C5
    playNote(659.25, now + 0.15, 0.4); // E5
    playNote(783.99, now + 0.3, 0.8); // G5 
  } catch (e) {
    console.error('Audio play failed:', e);
  }
};

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
  const [showTimeOutAlert, setShowTimeOutAlert] = useState(false);
  const [error, setError] = useState('');

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    // Request permission for native OS notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
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

        // Check for 8 hours completion notification
        if (hours >= 8) {
          const notificationKey = `notified_8h_${todayLog.id}`;
          if (!localStorage.getItem(notificationKey)) {
            localStorage.setItem(notificationKey, 'true');
            setShowTimeOutAlert(true);
            playNotificationSound();
            
            // Trigger native OS notification (shows up even if they are in another tab/app)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('8 Hours Completed', {
                body: "You have completed your required 8 hours for today. Don't forget to time out in the NETSOLAR app!"
              });
            }
          }
        }
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
    // Request permission on a direct user gesture (button click)
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.error("Could not request notification permissions:", e);
      }
    }

    if (!user) return;
    try {
      setActionLoading(true);
      const now = new Date();
      
      // Check if late
      let isLate = false;
      if (profile?.role === 'intern') {
        // Interns are late if they time in after 8:30 AM
        isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);
      } else {
        // Employees are late if they time in after 10:00 AM (or based on previous logic)
        isLate = now.getHours() >= 10 && now.getMinutes() > 0;
      }
      
      const newLog = {
        userId: user.uid,
        date: todayStr,
        timeIn: now.toISOString(),
        status: isLate ? 'late' : 'on-time',
        createdAt: now.toISOString()
      };

      const docRef = await addDoc(collection(db, 'dtr_logs'), newLog);
      
      await logAuditAction(
        profile?.uid || user.uid,
        profile?.name || user.email || 'Unknown User',
        'time_in',
        `Timed in at ${format(now, 'hh:mm a')}`,
        docRef.id
      );
      
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
      
      await logAuditAction(
        profile?.uid || user.uid,
        profile?.name || user.email || 'Unknown User',
        'time_out',
        `Timed out at ${format(now, 'hh:mm a')}. Logged ${totalHours} hours.`,
        todayLog.id
      );

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

  const handleManualTimeOut = async (logToUpdate: DTRLog) => {
    const timeOutStr = prompt('Enter Time Out (YYYY-MM-DD HH:MM AM/PM) or leave blank for current time:', format(new Date(), 'yyyy-MM-dd hh:mm a'));
    if (timeOutStr === null) return; // cancelled
    
    const manualActivities = prompt('Enter your daily activities/tasks for this session:');
    if (manualActivities === null || !manualActivities.trim()) {
      alert('Activities are required to set a time out.');
      return;
    }

    try {
      setActionLoading(true);
      
      let now;
      try {
        // Try parsing the input. Let date-fns/browser handle basic formats. 
        // For simplicity we will use new Date() if they left it blank, or the string they typed
        now = timeOutStr.trim() ? new Date(timeOutStr) : new Date();
        if (isNaN(now.getTime())) throw new Error("Invalid date");
      } catch (e) {
        alert("Invalid time format. Please use something like '2026-04-20 05:00 PM' or leave blank for the current time.");
        return;
      }

      const timeInDate = new Date(logToUpdate.timeIn);
      if (now < timeInDate) {
         alert("Time out cannot be earlier than time in.");
         return;
      }

      const diffMs = now.getTime() - timeInDate.getTime();
      const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      const logRef = doc(db, 'dtr_logs', logToUpdate.id);
      await updateDoc(logRef, {
        timeOut: now.toISOString(),
        totalHours,
        activities: manualActivities
      });
      
      await logAuditAction(
        profile?.uid || user?.uid || 'unknown',
        profile?.name || user?.email || 'Unknown User',
        'manual_time_out',
        `Manually timed out for ${logToUpdate.date} at ${format(now, 'hh:mm a')}. Logged ${totalHours} hours.`,
        logToUpdate.id
      );

      // If it's today's log, update it
      if (todayLog && todayLog.id === logToUpdate.id) {
        setTodayLog({ ...todayLog, timeOut: now.toISOString(), totalHours, activities: manualActivities });
      }
      
      fetchLogs();
      alert(`Successfully logged out. Total hours: ${totalHours}`);
    } catch (error) {
      console.error(error);
      alert('Failed to update time out');
    } finally {
      setActionLoading(false);
    }
  };

  const calculateCurrentAllowance = () => {
    if (!profile || profile.role !== 'intern' || !profile.dailyAllowance) return null;
    
    const today = new Date();
    let start, end;
    
    if (isThursday(today)) {
      start = today;
      end = nextWednesday(today);
    } else if (isWednesday(today)) {
      start = previousThursday(today);
      end = today;
    } else {
      start = previousThursday(today);
      end = nextWednesday(today);
    }
    
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    const periodLogs = recentLogs.filter(log => {
      return log.date >= startStr && log.date <= endStr && log.status !== 'absent';
    });

    const daysPresent = periodLogs.length;
    return {
      days: daysPresent,
      total: daysPresent * profile.dailyAllowance,
      startStr,
      endStr
    };
  };

  const getAllowanceHistory = () => {
    if (!profile || profile.role !== 'intern' || !profile.dailyAllowance) return [];
    
    const presentDates = Array.from(new Set(recentLogs.filter(l => l.status !== 'absent').map(l => l.date))).sort();
    if (presentDates.length === 0) return [];

    const periods: Map<string, { startStr: string, endStr: string, days: number, total: number }> = new Map();
    const currentAllowance = calculateCurrentAllowance();

    presentDates.forEach(dateStr => {
      const localDate = new Date(dateStr + 'T12:00:00');
      let start, end;
      
      if (isThursday(localDate)) {
        start = localDate;
        end = nextWednesday(localDate);
      } else if (isWednesday(localDate)) {
        start = previousThursday(localDate);
        end = localDate;
      } else {
        start = previousThursday(localDate);
        end = nextWednesday(localDate);
      }
      
      const pStart = format(start, 'yyyy-MM-dd');
      const pEnd = format(end, 'yyyy-MM-dd');
      const key = `${pStart}_${pEnd}`;
      
      // Skip the current allowance period from the history as it's displayed separately
      if (currentAllowance && key === `${currentAllowance.startStr}_${currentAllowance.endStr}`) {
         return;
      }

      if (periods.has(key)) {
        const period = periods.get(key)!;
        period.days += 1;
        period.total += profile.dailyAllowance!;
      } else {
        periods.set(key, {
          startStr: pStart,
          endStr: pEnd,
          days: 1,
          total: profile.dailyAllowance!
        });
      }
    });

    return Array.from(periods.values()).sort((a, b) => b.startStr.localeCompare(a.startStr));
  };

  const getAttendanceChartData = () => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayLogs = recentLogs.filter(l => l.date === dStr && l.status !== 'absent');
      
      let onTimeHours = 0;
      let lateHours = 0;
      
      dayLogs.forEach(log => {
        let hours = log.totalHours || 0;
        
        // Live active session tracking for today
        if (log.date === todayStr && !log.timeOut) {
          hours += activeSessionHours;
        }
        
        if (log.status === 'late') {
          lateHours += hours;
        } else {
          onTimeHours += hours;
        }
      });

      return {
        name: format(d, 'EEE'),
        fullDate: format(d, 'MMM dd, yyyy'),
        onTime: Number(onTimeHours.toFixed(2)),
        late: Number(lateHours.toFixed(2)),
      };
    });
  };

  const effectiveDate = selectedDate || todayStr;
  const displayedLogs = recentLogs.filter(log => log.date === effectiveDate);

  // Intern Additional Calculations
  let expectedFinishDate = null;
  let totalAllowance = 0;
  const dailyRate = profile?.dailyAllowance || 150;
  
  if (profile?.role === 'intern' && profile.targetHours) {
    const uniqueDays = new Set(recentLogs.map(l => l.date)).size;
    totalAllowance = uniqueDays * dailyRate;
    
    const totalDone = cumulativeHours + activeSessionHours;
    const remaining = profile.targetHours - totalDone;
    
    if (remaining <= 0) {
      // Completed, get the last log date or today
      expectedFinishDate = recentLogs.length > 0 ? new Date(recentLogs[0].date) : new Date();
    } else {
      // Calculate average daily hours based on logs
      let avgDailyHours = 8; // Default standard workday
      
      // Only establish a trend if they have worked a few days. 
      // If they just clocked in for 5 minutes on day 1, projecting that average takes decades.
      if (uniqueDays >= 3) {
        avgDailyHours = totalDone / uniqueDays;
      }
      
      // Set reasonable bounds to prevent wild mathematical estimates (e.g., minimum 4 hours, max 12)
      avgDailyHours = Math.max(4, Math.min(12, avgDailyHours));

      let daysToAdd = Math.ceil(remaining / avgDailyHours);
      let dateCursor = new Date();
      
      // Skip weekends to find the real expected date
      while (daysToAdd > 0) {
        dateCursor = addDays(dateCursor, 1);
        if (!isWeekend(dateCursor)) {
          daysToAdd--;
        }
      }
      expectedFinishDate = dateCursor;
    }
  }

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
      {/* Notification Permission Indicator */}
      {'Notification' in window && Notification.permission === 'default' && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start justify-between">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Enable 8-Hour Notifications</p>
              <p>Get a friendly native alert when your daily hours are complete, even if you are in another tab.</p>
            </div>
          </div>
          <button
            onClick={() => Notification.requestPermission().then(() => window.location.reload())}
            className="ml-4 flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-500/20"
          >
            Allow
          </button>
        </div>
      )}

      {profile?.role === 'intern' && (
        <div className="mb-6 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          {profile.targetHours ? (
            <>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Internship Progress</h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {(cumulativeHours + activeSessionHours).toFixed(2)} <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/ {profile.targetHours} hrs</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Started: {profile.startDate ? format(new Date(profile.startDate), 'MMM d, yyyy') : 'N/A'}</p>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-500 mt-1">
                    {Math.min(100, Math.round(((cumulativeHours + activeSessionHours) / profile.targetHours) * 100))}% Completed
                  </p>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-4 overflow-hidden shadow-inner">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-amber-400 to-amber-500 relative" 
                  style={{ width: `${Math.min(100, ((cumulativeHours + activeSessionHours) / profile.targetHours) * 100)}%` }}
                >
                  <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100 dark:border-gray-700/60">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold mb-1">Total Days</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{new Set(recentLogs.map(l => l.date)).size} days present</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold mb-1">Est. Completion</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {expectedFinishDate ? format(expectedFinishDate, 'MMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold mb-1">Accumulated Allowance</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₱{totalAllowance.toLocaleString()} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(@ ₱{dailyRate}/day)</span></p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Internship Progress</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {(cumulativeHours + activeSessionHours).toFixed(2)} <span className="text-sm font-medium text-gray-500 dark:text-gray-400">hrs completed</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Started: {profile.startDate ? format(new Date(profile.startDate), 'MMM d, yyyy') : 'N/A'}</p>
              </div>
            </div>
          )}

          {(() => {
            const allowance = calculateCurrentAllowance();
            const history = getAllowanceHistory();
            
            if (!allowance) return null;
            return (
              <>
                <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Cut-off Allowance</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {format(new Date(allowance.startStr), 'MMM d')} - {format(new Date(allowance.endStr), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ₱{allowance.total.toLocaleString()}
                      </p>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                        {allowance.days} days present (₱{profile.dailyAllowance}/day)
                      </p>
                    </div>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Past Allowance History</h3>
                    <div className="space-y-3">
                      {history.slice(0, 3).map((period, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                          <div>
                            <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                              {format(new Date(period.startStr), 'MMM d')} - {format(new Date(period.endStr), 'MMM d, yyyy')}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {period.days} days
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-bold text-gray-900 dark:text-white">
                              ₱{period.total.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Action Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[20px] border border-gray-200 dark:border-gray-700 p-10 text-center relative">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 hidden">Today's Status</h2>
            
            {!todayLog ? (
              <div className="text-center">
                <div className="text-[48px] font-bold text-gray-900 dark:text-white mb-2">
                  {format(new Date(), 'hh:mm a')}
                </div>
                <div className="text-gray-500 dark:text-gray-400 mb-8 uppercase tracking-[0.05em] text-[13px]">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </div>
                <button
                  onClick={handleTimeIn}
                  disabled={actionLoading}
                  className="w-full py-4 px-8 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 active:scale-[0.98] text-white font-semibold rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all duration-300 ease-out disabled:opacity-50 text-[15px]"
                >
                  {actionLoading ? 'Processing...' : 'TIME IN'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Time In</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {format(new Date(todayLog.timeIn), 'hh:mm a')}
                    </p>
                  </div>
                  {todayLog.status === 'late' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="w-3 h-3 mr-1" /> Late
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> On Time
                    </span>
                  )}
                </div>

                {!todayLog.timeOut && (
                  <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <div>
                      <p className="text-sm text-amber-700 dark:text-amber-500 font-medium">Active Session</p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Tracking time automatically...</p>
                    </div>
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-500 font-mono">
                      {Math.floor(activeSessionHours)}h {Math.floor((activeSessionHours % 1) * 60)}m
                    </div>
                  </div>
                )}

                {todayLog.timeOut ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Time Out</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {format(new Date(todayLog.timeOut), 'hh:mm a')}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {todayLog.totalHours} hrs
                    </span>
                  </div>
                ) : (
                  <div className="pt-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-start">
                        <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-amber-500 focus:border-amber-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${error ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div className="flex space-x-4 pt-4">
                      <button
                        onClick={handleUpdateActivities}
                        disabled={actionLoading}
                        className="flex-1 py-4 px-8 bg-transparent border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 active:bg-gray-100 dark:active:bg-gray-800 active:scale-[0.98] text-gray-800 dark:text-gray-200 font-semibold rounded-full transition-all duration-300 ease-out disabled:opacity-50 text-[15px]"
                      >
                        Save Notes
                      </button>
                      <button
                        id="timeout-button"
                        onClick={handleTimeOut}
                        disabled={actionLoading}
                        className="flex-1 py-4 px-8 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 active:scale-[0.98] text-white font-semibold rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] transition-all duration-300 ease-out disabled:opacity-50 text-[15px]"
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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-5 gap-4">
              <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">Activity Log</h2>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={todayStr}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm font-semibold bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white cursor-pointer select-none outline-none hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md active:scale-[0.97] transition-all duration-300 ease-out"
                />
                {selectedDate && selectedDate !== todayStr && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              {displayedLogs.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">No logs found for {format(new Date(effectiveDate), 'MMM d, yyyy')}.</div>
              ) : (
                displayedLogs.map((log) => (
                  <div key={log.id} className="flex flex-col py-3 border-b border-gray-200 dark:border-gray-700 last:border-0 text-[14px]">
                    <div className="flex items-start">
                      <span className="w-[80px] text-gray-500 dark:text-gray-400 font-mono shrink-0">
                        {format(new Date(log.timeIn), 'hh:mm a')}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {format(new Date(log.date), 'MMM d, yyyy')}
                          </span>
                          {log.status === 'late' && (
                            <span className="px-2 py-0.5 rounded text-[11px] uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">Late</span>
                          )}
                        </div>
                        {log.activities ? (
                          <span className="text-gray-800 dark:text-gray-300">{log.activities}</span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 italic">No activities logged</span>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Out: {log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : (
                            <span className="flex items-center space-x-2">
                              <span className="text-amber-500 font-medium">Active</span>
                              {profile?.role === 'intern' && log.date !== todayStr && (
                                <button 
                                  onClick={() => handleManualTimeOut(log)}
                                  className="ml-2 px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded text-[10px] uppercase font-bold tracking-wider transition-colors"
                                >
                                  Set Time Out
                                </button>
                              )}
                            </span>
                          )} 
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

      {/* Attendance Overview */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
          <BarChartIcon className="w-5 h-5 mr-2 text-amber-500" />
          Attendance Overview (Last 7 Days)
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getAttendanceChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} width={40} />
              <Tooltip 
                cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                position={{ y: -10 }}
                wrapperStyle={{ outline: 'none', transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const hasOnTime = data.onTime > 0;
                    const hasLate = data.late > 0;
                    const totalHours = (data.onTime + data.late).toFixed(2);
                    const isToday = data.fullDate === format(new Date(), 'MMM dd, yyyy');
                    
                    if (totalHours === "0.00") return null;

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
                        <p className="font-semibold text-gray-900 dark:text-white border-b border-gray-200/50 dark:border-gray-700/50 pb-2 mb-2 flex justify-between items-center">
                          <span>{data.fullDate}</span>
                          {isToday && (
                            <span className="text-amber-500 text-[10px] uppercase font-bold flex items-center ml-3 tracking-wider">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse mr-1.5"></span>
                              Active
                            </span>
                          )}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          {totalHours} <span className="text-xs font-medium text-gray-500 dark:text-gray-400">hrs worked</span>
                        </p>
                        
                        {hasOnTime && (
                          <div className="flex items-center space-x-2 text-sm mt-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Recorded as on time</span>
                          </div>
                        )}
                        {hasLate && (
                          <div className="flex items-center space-x-2 text-sm mt-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Recorded as late</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="onTime" stackId="a" name="On Time" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="late" stackId="a" name="Late" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 8-Hour Completion Notification Toast */}
      <AnimatePresence>
        {showTimeOutAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/50 p-5 pl-6"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <CheckCircle2 className="h-8 w-8 text-amber-500 animate-pulse" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">
                  8 Hours Completed
                </h3>
                <p className="mt-1 text-[13px] font-medium text-gray-500 dark:text-gray-400">
                  You have completed your required 8 hours for today. Don't forget to time out!
                </p>
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => {
                      document.getElementById('timeout-button')?.scrollIntoView({ behavior: 'smooth' });
                      setShowTimeOutAlert(false);
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all shadow-md shadow-amber-500/20"
                  >
                    Time Out Now
                  </button>
                  <button
                    onClick={() => setShowTimeOutAlert(false)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            {/* Left accent border */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-amber-400 to-amber-600 rounded-l-2xl"></div>
          </motion.div>
        )}
      </AnimatePresence>

    </Layout>
  );
}
