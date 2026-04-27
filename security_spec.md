# Firebase Security Validation Spec

## Data Invariants
1. `users`: Only admins can create new users, wait no, people register themselves. But an arbitrary user shouldn't masquerade as another. `role` defaults to 'employee' or 'intern', should be validated upon create, user cannot assign themselves 'admin'. Only an `admin` can update roles.
2. `usernames`: Anyone can read usernames to validate availability, but they must set `uid` matching their own `auth.uid`.
3. `dtr_logs`: Users can only create or update their own time logs. `timeIn` must be the current date context. Total hours cannot exceed 24.
4. `announcements`: Only admins can create, update, or delete. Anyone logged in can read.
5. `adjustments`: Users can only create adjustments for themselves. Admins can read all and update `status`. Users cannot update `status`.
6. `leave_requests`: Users can only create for themselves. Admins can update `status` and read all.
7. `audit_logs`: Any logged in user can append audit logs? Actually yes, standard users invoke `logAuditAction` from the client. But nobody can update or delete audit logs.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: `create users` payload setting `uid` to someone else's ID.
2. **Admin Privilege Escalation**: `update users` payload setting oneself `role: 'admin'`.
3. **Ghost Collection**: Write to an undefined collection (e.g., `test/123`).
4. **Data Overload**: `create dtr_logs` setting a 1MB string to `activities`.
5. **Role Modification (Self)**: employee updating their own `role` property.
6. **Cross-Tenant Modify**: User updating another user's `adjustments`.
7. **Time Traveling Update**: Manipulating `status` of an approved adjustment.
8. **Malicious Announcement Override**: Standard employee attempting to create an announcement.
9. **Shadow Field Injection**: Writing { `userId`, `date`, `isPresident: true` } to `dtr_logs`.
10. **Target Hours Hack**: Employee mutating their own `targetHours` arbitrarily after creation.
11. **Log Erasure**: Any `delete` call on `audit_logs`.
12. **The "String Integer" Trick**: Sending a string containing "10" instead of the number 10 for `targetHours`.

## Next Steps
We will generate the exact rules enforcing this.
