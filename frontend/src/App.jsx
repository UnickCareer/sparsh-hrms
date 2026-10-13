/**
 * App.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Tasks from "./pages/Tasks";
import Visitors from "./pages/Visitors";
import SalesQuery from "./pages/SalesQuery";
import VisitMap from "./pages/VisitMap";
import IT from "./pages/IT";
import PerformanceReview from "./pages/PerformanceReview";
import ChatSettings from "./pages/settings/ChatSettings";
import Announcements from "./pages/Announcements";
import Profile from "./pages/Profile";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/routes/ProtectedRoute.jsx";
import Login from "./pages/Login";
import PerformanceReviewDetail from "./pages/PerformanceReviewDetail";
import Chat from "./pages/Chat";

function App() {
    return (
        <BrowserRouter>
         <AuthProvider>
                        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
            <Routes>
                      {/* Standalone — no Sidebar/Topbar, no auth check */}
                      <Route path="/login" element={<Login />} />

                      <Route path="/" element={<Navigate to="/dashboard" replace />} />

                <Route element={<ProtectedRoute />}>
                    <Route element={<DashboardLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/directory" element={<EmployeeDirectory />} />
                        <Route path="/attendance" element={<Attendance />} />
                        <Route path="/leaves" element={<Leaves />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/visitors" element={<Visitors />} />
                        <Route path="/sales-query" element={<SalesQuery />} />
                        <Route path="/visit-map" element={<VisitMap />} />
                        <Route path="/it" element={<IT />} />
                        <Route path="/performance-review" element={<PerformanceReview />} />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/performance-review/:reviewId" element={<PerformanceReviewDetail />} />
                        <Route path="/settings/chat" element={<ChatSettings />} />
                        <Route path="/announcements" element={<Announcements />} />
                        <Route path="/profile" element={<Profile />} />
                    </Route>
                </Route>
            </Routes>
         </AuthProvider>
         </BrowserRouter>
    );
}

export default App;