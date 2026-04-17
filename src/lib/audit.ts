import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function logAuditAction(
  userId: string,
  userName: string,
  action: string,
  details: string,
  targetId?: string
) {
  try {
    const auditLog = {
      userId,
      userName,
      action,
      details,
      targetId: targetId || null,
      createdAt: new Date().toISOString()
    };
    
    // Remove undefined values, keep nulls or strings
    const cleanedLog = Object.fromEntries(
      Object.entries(auditLog).filter(([_, v]) => v !== undefined)
    );

    await addDoc(collection(db, 'audit_logs'), cleanedLog);
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Silent fail so we don't disrupt the main application flow
  }
}
