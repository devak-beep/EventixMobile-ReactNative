import axios from 'axios';

const API_BASE_URL = 'https://eventix-backend-devakkumar-sanjaykumar-sheths-projects.vercel.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Users ──────────────────────────────────────────────
export const registerUser = (data) => api.post('/users/register', data).then(r => r.data);
export const verifyRegisterOtp = (data) => api.post('/users/verify-register-otp', data).then(r => r.data);
export const loginUser = (data) => api.post('/users/login', data).then(r => r.data);
export const verifyLoginOtp = (data) => api.post('/users/verify-login-otp', data).then(r => r.data);
export const resendOtp = (data) => api.post('/users/resend-otp', data).then(r => r.data);
export const getUserById = (id) => api.get(`/users/${id}`).then(r => r.data);
export const updateOtpPreference = (id, otpEnabled) => api.put(`/users/${id}/otp-preference`, { otpEnabled }).then(r => r.data);

// ── Events ─────────────────────────────────────────────
export const getAllPublicEvents = (userRole = 'user') => api.get('/events', { params: { userRole } }).then(r => r.data);
export const getEventById = (id) => api.get(`/events/${id}`).then(r => r.data);
export const createEvent = (data) => api.post('/events', data).then(r => r.data);
export const getMyEvents = (userId) => api.get('/events/my-events', { params: { userId } }).then(r => r.data);
export const getExpiredEvents = (userRole) => api.get('/events/expired', { params: { userRole } }).then(r => r.data);
export const updateEventImage = (eventId, data) => api.patch(`/events/${eventId}/image`, data).then(r => r.data);
export const updateEventDetails = (eventId, data) => api.patch(`/events/${eventId}/details`, data).then(r => r.data);
export const deleteEvent = (eventId, data) => api.delete(`/events/${eventId}`, { data }).then(r => r.data);

// ── Locks ──────────────────────────────────────────────
export const lockSeats = (eventId, body) => api.post(`/events/${eventId}/lock`, body).then(r => r.data);
export const cancelLock = (lockId) => api.post(`/locks/${lockId}/cancel`).then(r => r.data);

// ── Bookings ───────────────────────────────────────────
export const confirmBooking = (lockId) => api.post('/bookings/confirm', { lockId }).then(r => r.data);
export const getAllBookings = () => api.get('/bookings').then(r => r.data);
export const getBookingById = (id) => api.get(`/bookings/${id}`).then(r => r.data);

// ── Payments ───────────────────────────────────────────
export const processPayment = (bookingId, data) => api.post(`/payments/${bookingId}/process`, data).then(r => r.data);
export const cancelBooking = (bookingId) => api.post(`/cancellations/${bookingId}/cancel`).then(r => r.data);

// ── Razorpay ───────────────────────────────────────────
export const createRazorpayOrder = (data) => api.post('/razorpay/create-order', data).then(r => r.data);
export const verifyRazorpayPayment = (data) => api.post('/razorpay/verify-payment', data).then(r => r.data);

// ── Event Requests ─────────────────────────────────────
export const submitEventRequest = (data) => api.post('/event-requests', data, { headers: { 'x-user-id': data.userId, 'x-user-role': data.userRole || 'user' } }).then(r => r.data);
export const getMyEventRequests = (userId) => api.get('/event-requests/my-requests', { headers: { 'x-user-id': userId } }).then(r => r.data);
export const getPendingRequests = (userId, role) => api.get('/event-requests/admin/pending', { headers: { 'x-user-id': userId, 'x-user-role': role } }).then(r => r.data);
export const approveRequest = (requestId, userId, role) => api.put(`/event-requests/${requestId}/approve`, {}, { headers: { 'x-user-id': userId, 'x-user-role': role } }).then(r => r.data);
export const rejectRequest = (requestId, userId, role, reason) => api.put(`/event-requests/${requestId}/reject`, { rejectionReason: reason }, { headers: { 'x-user-id': userId, 'x-user-role': role } }).then(r => r.data);

export default api;
