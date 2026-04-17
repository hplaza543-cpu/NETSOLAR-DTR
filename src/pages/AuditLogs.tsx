import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { ShieldAlert, Activity, User, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  targetId?: string;
  createdAt: string;
}

export default function AuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isAdminOrAccounting = profile?.role === 'admin' || profile?.role === 'accounting';

  useEffect(() => {
    if (isAdminOrAccounting) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [isAdminOrAccounting]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      
      const dataArray: AuditLog[] = [];
      snap.forEach(doc => {
        dataArray.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      setLogs(dataArray);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'audit_logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('financial') || action.includes('user')) return <User className="w-5 h-5 text-blue-500" />;
    if (action.includes('adjustment') || action.includes('leave')) return <FileText className="w-5 h-5 text-amber-500" />;
    if (action.includes('time')) return <Activity className="w-5 h-5 text-green-500" />;
    return <ShieldAlert className="w-5 h-5 text-gray-500" />;
  };

  if (!isAdminOrAccounting) {
    return (
      <Layout title="Audit Logs">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">You do not have permission to view audit logs.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout title="Audit Logs">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="System Audit Logs">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent System Activity</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Showing the latest 100 logged actions.</p>
            </div>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">No audit logs found.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-5 flex items-start space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mt-0.5">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {log.userName} <span className="text-gray-500 dark:text-gray-400 font-normal">({log.action})</span>
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {format(new Date(log.createdAt), 'MMM d, yyyy h:mm:ss a')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {log.details}
                    </p>
                    {log.targetId && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                        Target ID: {log.targetId}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
