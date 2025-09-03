import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';

// Page Imports
import { LoginForm } from './pages/auth/LoginForm';
import { ProjectsList } from './pages/dashboard/ProjectsList';
import { ProjectDetail } from './pages/dashboard/ProjectDetail'; 
import { ExcelTableDetail } from './pages/spreadsheet/ExcelTableDetail';
// --- STEP 1: Import the newly refactored SheetDetail component ---
import { SheetDetail } from './components/spreadsheet/SheetDetail';

// Icon Imports
import { User, LogOut } from 'lucide-react';

/**
 * This component is the main content router and acts as a gatekeeper.
 * It renders the main layout for authenticated users and handles routing between pages.
 */
function AppContent() {
  const { user, loading, signOut } = useAuth();

  // Display a loading state while checking for an active session.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Session...</p>
        </div>
      </div>
    );
  }
  
  // If no user is found, render only the public/authentication routes.
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        {/* Redirect any other path to the login page */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If a user is authenticated, render the full application layout.
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-xl font-semibold text-gray-800 hover:text-gray-600 transition-colors">
                <h1>Infomration HUB</h1>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
              <button
                onClick={signOut}
                className="flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          {/* Floor 1: The list of all projects */}
          <Route path="/" element={<ProjectsList />} />
          
          {/* Floor 2: The detail page for a single project */}
          <Route path="/project/:projectId" element={<ProjectDetail />} />

          {/* Floor 3: The table view with multiple sheets */}
          <Route path="/project/:projectId/table/:tableId" element={<ExcelTableDetail />} />
          
          {/* --- STEP 2: Add the new route for the single Sheet Detail page --- */}
          {/* Floor 4: The detail view for a single sheet */}
          <Route path="/project/:projectId/table/:tableId/sheet/:sheetId" element={<SheetDetail />} />

          {/* This catch-all route now correctly redirects any unknown paths back to the main dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/**
 * The top-level App component.
 * It sets up the global providers like Auth and the main Router.
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        {/* This top-level Route delegates all path handling to our AppContent component */}
        <Routes>
          <Route path="/*" element={<AppContent />} />
        </Routes>
        <Toaster 
          position="top-center"
          expand={false}
          richColors
        />
      </Router>
    </AuthProvider>
  );
}

export default App;