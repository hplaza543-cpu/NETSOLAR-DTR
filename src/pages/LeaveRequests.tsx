import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  userName?: string; // joined locally
}

export default function LeaveRequests() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('Vacation');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let q;
      if (isAdmin) {
        q = query(collection(db, 'leave_requests'), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'leave_requests'), where('userId', '==', user?.uid));
      }
      
      const snap = await getDocs(q);
      const dataArray: LeaveRequest[] = [];
      snap.forEach(doc => {
        const docData = doc.data() as Record<string, any>;
        dataArray.push({ id: doc.id, ...docData } as LeaveRequest);
      });
      
      // If admin, we might want to join user names, but for simplicity we'll just show the data
      // In a real app, we'd fetch users and map names.
      
      // Sort manually if where clause messes up orderBy
      dataArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setRequests(dataArray);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'leave_requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      setSubmitting(true);
      const newRequest = {
        userId: user.uid,
        startDate,
        endDate,
        type,
        reason,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'leave_requests'), newRequest);
      setStartDate('');
      setEndDate('');
      setType('Vacation');
      setReason('');
      setShowForm(false);
      fetchRequests();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leave_requests');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'leave_requests', id), { status });
      fetchRequests();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leave_requests/${id}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Approved</span>;
      case 'rejected': return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      default: return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium flex items-center"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
    }
  };

  if (loading) {
    return (
      <Layout title="Leave Requests">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Leave Requests">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {!isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
            >
              {showForm ? 'Cancel' : 'Request Time Off'}
            </button>
          </div>
        )}

        {showForm && !isAdmin && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Submit Leave Request</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="Vacation">Vacation Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Emergency">Emergency Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Briefly explain your reason..."
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{isAdmin ? 'All Leave Requests' : 'My Leave Requests'}</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {requests.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No leave requests found.</div>
            ) : (
              requests.map(request => (
                <div key={request.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <Calendar className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-gray-900">{request.type} Leave</span>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500 italic">"{request.reason}"</p>
                      <p className="text-xs text-gray-400 mt-2">Submitted on {format(new Date(request.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  
                  {isAdmin && request.status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'approved')}
                        className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                        className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
