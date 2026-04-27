import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { User, Edit2, Save, X, DollarSign, Clock, Calendar as CalendarIcon, UserMinus, Search, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, subDays, nextWednesday, previousThursday, isThursday, isWednesday, addDays, isWeekend, startOfYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { logAuditAction } from '../lib/audit';
import Layout from '../components/Layout';
import { fillMissingDaysForUser, DTRLog } from '../lib/attendance';

interface UserProfile {
  uid: string;
  name: string;
  username?: string;
  email: string;
  role: 'admin' | 'employee' | 'intern' | 'accounting';
  department?: string;
  targetHours?: number;
  startDate?: string;
  dailyAllowance?: number;
  salary?: number;
  status?: 'active' | 'archived';
}

export default function Users() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<DTRLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editAllowance, setEditAllowance] = useState<number | ''>('');
  const [editTargetHours, setEditTargetHours] = useState<number | ''>('');
  const [editSalary, setEditSalary] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<'employee' | 'intern'>('intern');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'department'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Calculate default cut-off: Previous/Current Thursday to next Wednesday
  const getCutOffDates = () => {
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
    
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  };

  const defaultCutOff = getCutOffDates();
  const [cutOffStart, setCutOffStart] = useState<string>(defaultCutOff.start);
  const [cutOffEnd, setCutOffEnd] = useState<string>(defaultCutOff.end);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserLogs(selectedUser.uid);
    } else {
      setLogs([]); // Clear logs when no user is selected
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Fetch users
      const usersQuery = query(collection(db, 'users'), where('role', 'in', ['employee', 'intern']));
      const usersSnapshot = await getDocs(usersQuery);
      // Only include active users (or users without a status, for backward compatibility)
      const fetchedUsers = usersSnapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(user => user.status !== 'archived');
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLogs = async (userId: string) => {
    try {
      // Fetch logs specifically for the selected user to calculate their progress/allowance
      const logsQuery = query(collection(db, 'dtr_logs'), where('userId', '==', userId));
      const logsSnapshot = await getDocs(logsQuery);
      let fetchedLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DTRLog));
      
      const userObj = users.find(u => u.uid === userId);
      if (userObj) {
        // dynamically generate absent logs starting from user start date to today
        const intervalStart = userObj.startDate ? new Date(userObj.startDate) : startOfYear(new Date());
        const intervalEnd = new Date();
        fetchedLogs = fillMissingDaysForUser(fetchedLogs, userObj, intervalStart, intervalEnd);
      }
      
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error fetching user logs:", error);
    }
  };

  const handleArchiveUser = async () => {
    if (!selectedUser || !profile) return;
    
    if (window.confirm(`Are you sure you want to remove ${selectedUser.name}? They will be archived and no longer appear in this list.`)) {
      try {
        const userRef = doc(db, 'users', selectedUser.uid);
        await updateDoc(userRef, { status: 'archived' });
        
        await logAuditAction(
          profile.uid,
          profile.name,
          'archive_user',
          `Archived user ${selectedUser.name} (${selectedUser.email})`,
          selectedUser.uid
        );
        
        // Remove from local state
        setUsers(users.filter(u => u.uid !== selectedUser.uid));
        setSelectedUser(null);
      } catch (error) {
        console.error("Error archiving user:", error);
        alert("Failed to remove user.");
      }
    }
  };

  const handleUserClick = (user: UserProfile) => {
    setSelectedUser(user);
    setEditAllowance(user.dailyAllowance || '');
    setEditTargetHours(user.targetHours || '');
    setEditSalary(user.salary || '');
    setIsEditing(false);
  };

  const handleSort = (field: 'name' | 'department') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSaveFinancials = async () => {
    if (!selectedUser || !profile) return;
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const updates: any = {};
      let details = '';
      if (selectedUser.role === 'intern') {
        const newAllowance = Number(editAllowance) || 0;
        const newTargetHours = Number(editTargetHours) || 0;
        updates.dailyAllowance = newAllowance;
        updates.targetHours = newTargetHours;
        details = `Updated settings for ${selectedUser.name}: Allowance PHP ${newAllowance}, Target Hours ${newTargetHours}`;
      } else if (selectedUser.role === 'employee') {
        const newSalary = Number(editSalary) || 0;
        updates.salary = newSalary;
        details = `Updated monthly salary for ${selectedUser.name} to PHP ${newSalary}`;
      }
      
      await updateDoc(userRef, updates);
      
      await logAuditAction(
        profile.uid,
        profile.name,
        'update_financials',
        details,
        selectedUser.uid
      );
      
      // Update local state
      setUsers(users.map(u => u.uid === selectedUser.uid ? { ...u, ...updates } : u));
      setSelectedUser({ ...selectedUser, ...updates });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to save changes.");
    }
  };

  const getAttendanceChartData = (userId: string) => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => l.userId === userId && l.date === dStr);
      return {
        name: format(d, 'EEE'),
        fullDate: format(d, 'MMM dd, yyyy'),
        present: dayLogs.filter(l => l.status !== 'absent').length,
        late: dayLogs.filter(l => l.status === 'late').length,
        absent: dayLogs.filter(l => l.status === 'absent').length,
      };
    });
  };

  const calculateInternProgress = (userId: string, targetHours: number = 0) => {
    let userLogs = logs.filter(log => log.userId === userId);
    
    // Overall completion 
    const allTimeTotalHours = userLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
    const overallPercentage = targetHours > 0 ? Math.min(100, Math.round((allTimeTotalHours / targetHours) * 100)) : 0;
    
    // Expected finish date
    let expectedFinishDate = null;
    if (targetHours > 0) {
      const remaining = targetHours - allTimeTotalHours;
      if (remaining <= 0) {
        // Find last log date if exist
        userLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        expectedFinishDate = userLogs.length > 0 ? new Date(userLogs[0].date) : new Date();
      } else {
        let daysToAdd = Math.ceil(remaining / 8);
        let dateCursor = new Date();
        while (daysToAdd > 0) {
          dateCursor = addDays(dateCursor, 1);
          if (!isWeekend(dateCursor)) {
            daysToAdd--;
          }
        }
        expectedFinishDate = dateCursor;
      }
    }

    // Cut-off period progress
    let cutOffLogs = userLogs;
    if (cutOffStart && cutOffEnd) {
      cutOffLogs = userLogs.filter(log => log.date >= cutOffStart && log.date <= cutOffEnd && log.status !== 'absent');
    }
    const cutOffTotalHours = cutOffLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);

    const uniqueDays = new Set(userLogs.map(l => l.date)).size;

    return { allTimeTotalHours, overallPercentage, cutOffTotalHours, expectedFinishDate, uniqueDays };
  };

  const calculateEmployeeProgress = (userId: string) => {
    // For employees, maybe just show days present this month
    const currentMonth = format(new Date(), 'yyyy-MM');
    const userLogs = logs.filter(log => log.userId === userId && log.date.startsWith(currentMonth) && log.status !== 'absent');
    return { daysPresent: userLogs.length };
  };

  const calculateCutOffAllowance = (userId: string, dailyAllowance: number = 0) => {
    if (!cutOffStart || !cutOffEnd) return { days: 0, total: 0 };
    const start = cutOffStart;
    const end = cutOffEnd;
    
    const userLogsPeriod = logs.filter(log => {
      if (log.userId !== userId) return false;
      return log.date >= start && log.date <= end && log.status !== 'absent';
    });

    const daysPresent = userLogsPeriod.length;
    return {
      days: daysPresent,
      total: daysPresent * dailyAllowance
    };
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div></div>;
  }

  const filteredUsers = users.filter(u => {
    if (u.role !== activeTab) return false;
    if (!searchQuery) return true;
    const queryLower = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(queryLower) || u.email.toLowerCase().includes(queryLower);
  }).sort((a, b) => {
    const aValue = (a[sortField] || '').toLowerCase();
    const bValue = (b[sortField] || '').toLowerCase();
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Layout title="User Management & Progress">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button 
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'intern' ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => { setActiveTab('intern'); setSelectedUser(null); setSearchQuery(''); }}
            >
              Interns
            </button>
            <button 
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'employee' ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => { setActiveTab('employee'); setSelectedUser(null); setSearchQuery(''); }}
            >
              Employees
            </button>
          </div>
          
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}s by name or email...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              />
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sort:</span>
              <button
                onClick={() => handleSort('name')}
                className={`flex items-center text-xs px-2 py-1 rounded-md transition-colors ${sortField === 'name' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                Name {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />)}
              </button>
              <button
                onClick={() => handleSort('department')}
                className={`flex items-center text-xs px-2 py-1 rounded-md transition-colors ${sortField === 'department' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                Dept {sortField === 'department' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />)}
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No matching users found.' : `No ${activeTab}s found.`}
              </div>
            ) : (
              filteredUsers.map(user => (
              <button
                key={user.uid}
                onClick={() => handleUserClick(user)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                  selectedUser?.uid === user.uid ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                }`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    user.role === 'intern' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {user.name}
                    {user.username && <span className="ml-2 text-xs font-normal text-gray-400">@{user.username}</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {user.role} • {user.department}
                    {user.role === 'intern' && user.startDate && ` • Started: ${format(new Date(user.startDate), 'MMM d, yyyy')}`}
                  </p>
                </div>
              </button>
            )))}
          </div>
        </div>

        {/* User Details */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt={selectedUser.name} className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                  ) : (
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${
                      selectedUser.role === 'intern' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                      {selectedUser.name}
                      {selectedUser.username && <span className="ml-3 text-sm font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/30">@{selectedUser.username}</span>}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">{selectedUser.role} • {selectedUser.department}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                    {selectedUser.phone && <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.phone}</p>}
                  </div>
                </div>
                <button
                  onClick={handleArchiveUser}
                  className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors"
                  title="Remove User"
                >
                  <UserMinus className="w-4 h-4 mr-1.5" />
                  Remove
                </button>
              </div>

              {/* Global Cut-off Selector */}
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Cut-off Period</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Calculates progress and allowance for this date range.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Start:</span>
                    <input 
                      type="date" 
                      value={cutOffStart} 
                      onChange={e => setCutOffStart(e.target.value)} 
                      className="w-32 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" 
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">End:</span>
                    <input 
                      type="date" 
                      value={cutOffEnd} 
                      onChange={e => setCutOffEnd(e.target.value)} 
                      className="w-32 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Progress Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-amber-500" />
                    Progress Tracking
                  </h4>
                  
                  {selectedUser.role === 'intern' ? (
                    <div className="space-y-4">
                      {(() => {
                        const progress = calculateInternProgress(selectedUser.uid, selectedUser.targetHours);
                        return (
                          <>
                            <div className="flex justify-between items-center text-sm mb-1 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                              <span className="text-gray-700 dark:text-gray-200 font-medium tracking-tight">Cut-off Period Hours</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 text-xl">{progress.cutOffTotalHours.toFixed(1)} <span className="text-sm font-medium">hrs</span></span>
                            </div>
                            
                            <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Overall Progress</span>
                                <span className="font-bold text-gray-900 dark:text-white text-lg">
                                  {progress.allTimeTotalHours.toFixed(1)} <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/ {selectedUser.targetHours} hrs</span>
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                                <div 
                                  className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-amber-400 to-amber-500 relative" 
                                  style={{ width: `${progress.overallPercentage}%` }}
                                >
                                  <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-2 text-xs">
                                <span className="font-semibold text-amber-600 dark:text-amber-400">{progress.overallPercentage}% Complete</span>
                                <span className="text-gray-500 dark:text-gray-400 text-right">
                                  Est. Finish: <span className="font-medium text-gray-700 dark:text-gray-300">{progress.expectedFinishDate ? format(progress.expectedFinishDate, 'MMM d, yyyy') : 'N/A'}</span>
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-right">
                                Started: {selectedUser.startDate ? format(new Date(selectedUser.startDate), 'MMM d, yyyy') : 'N/A'}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const progress = calculateEmployeeProgress(selectedUser.uid);
                        return (
                          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <CalendarIcon className="w-5 h-5 mr-2 text-emerald-500" />
                              <span className="text-sm">Days Present (This Month)</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">{progress.daysPresent}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Financials Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                      <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                      Financials
                    </h4>
                    {!isEditing ? (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-xs flex items-center text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 font-medium"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setIsEditing(false)}
                          className="text-xs flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
                        >
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </button>
                        <button 
                          onClick={handleSaveFinancials}
                          className="text-xs flex items-center text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 font-medium"
                        >
                          <Save className="w-3 h-3 mr-1" /> Save
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedUser.role === 'intern' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Target Hours</label>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editTargetHours}
                              onChange={(e) => setEditTargetHours(e.target.value ? Number(e.target.value) : '')}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              placeholder="e.g. 500"
                            />
                          ) : (
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {selectedUser.targetHours || '0'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">hrs</span>
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Daily Allowance (PHP)</label>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAllowance}
                              onChange={(e) => setEditAllowance(e.target.value ? Number(e.target.value) : '')}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              placeholder="e.g. 300"
                            />
                          ) : (
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              ₱{selectedUser.dailyAllowance?.toLocaleString() || '0'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ day</span>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-600">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Cut-off Allowance Earned</h5>
                        {(() => {
                          const calc = calculateCutOffAllowance(selectedUser.uid, selectedUser.dailyAllowance);
                          return (
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center shadow-sm">
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Days Present</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">{calc.days} days</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Calculated Allowance</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₱{calc.total.toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monthly Salary (PHP)</label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editSalary}
                            onChange={(e) => setEditSalary(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="e.g. 25000"
                          />
                        ) : (
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            ₱{selectedUser.salary?.toLocaleString() || '0'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ month</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Individual Chart & Reports */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-gray-100 dark:border-gray-700 pt-6">
                 {/* Attendance Chart */}
                 <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                   <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Attendance Overview (7 Days)</h4>
                   <div className="h-48">
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={getAttendanceChartData(selectedUser.uid)}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                         <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} width={30} />
                         <Tooltip 
                           cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                           content={({ active, payload, label }) => {
                             if (active && payload && payload.length) {
                               return (
                                 <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg shadow-lg">
                                   <p className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
                                     {payload[0].payload.fullDate || label}
                                   </p>
                                   {payload.map((entry: any, index: number) => (
                                     <div key={index} className="flex items-center space-x-2 text-sm mt-1">
                                       <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                       <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
                                       <span className="font-medium text-gray-900 dark:text-white">{entry.value}</span>
                                     </div>
                                   ))}
                                 </div>
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

                 {/* Recent Activity/Accomplishments */}
                 <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex flex-col h-64">
                   <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                     <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                     Recent Activities
                   </h4>
                   <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar flex-1">
                     {(() => {
                       const userLogs = logs
                         .filter(log => log.userId === selectedUser.uid && log.activities)
                         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                         .slice(0, 10);
                       
                       if (userLogs.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">No recent activities logged.</p>;
                       
                       return userLogs.map(log => (
                         <div key={log.id} className="text-sm border-l-2 border-indigo-200 dark:border-indigo-900/50 pl-3 py-1">
                           <p className="font-medium text-gray-900 dark:text-white">{format(new Date(log.date), 'MMM dd, yyyy')}</p>
                           <p className="text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{log.activities}</p>
                         </div>
                       ));
                     })()}
                   </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col items-center justify-center p-12 text-center text-gray-500 dark:text-gray-400">
              <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">No User Selected</p>
              <p className="text-sm mt-1">Select an employee or intern from the list to view their progress and manage financials.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
}
