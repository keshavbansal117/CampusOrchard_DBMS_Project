import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CalendarDays, 
  Search, 
  Bell, 
  Menu,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Database,
  Play,
  Terminal,
  ClipboardList,
  ShieldCheck,
  UserCircle2,
  GraduationCap
} from 'lucide-react';

type View = 'dashboard' | 'halls' | 'users' | 'bookings' | 'sql' | 'logs';
type Role = 'admin' | 'faculty' | 'student';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>('admin');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [halls, setHalls] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddHallModalOpen, setIsAddHallModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hallsRes, usersRes, bookingsRes, logsRes] = await Promise.all([
        fetch('/api/halls'),
        fetch('/api/users'),
        fetch('/api/bookings'),
        fetch('/api/logs')
      ]);
      
      const hallsData = await hallsRes.json();
      const usersData = await usersRes.json();
      const bookingsData = await bookingsRes.json();
      const logsData = await logsRes.json();
      
      setHalls(hallsData);
      setUsers(usersData);
      setBookings(bookingsData);
      setLogs(logsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleAction = async (type: string, bookingId: string) => {
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, bookingId, role: currentRole })
      });
      fetchData(); // Refresh data immediately
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddHall = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      type: formData.get('type'),
      capacity: parseInt(formData.get('capacity') as string),
      location: formData.get('location')
    };

    try {
      const res = await fetch('/api/halls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const responseData = await res.json();
      if (!responseData.success) {
        alert("Error adding hall: " + responseData.error);
        return;
      }
      setIsAddHallModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      eventName: formData.get('eventName'),
      resourceId: parseInt(formData.get('resourceId') as string),
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const responseData = await res.json();
      if (!responseData.success) {
        alert("Error creating booking: " + responseData.error);
        return;
      }
      setIsBookingModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Filtering
  const q = searchQuery.toLowerCase();
  const filteredHalls = halls.filter(h => h.name.toLowerCase().includes(q) || (h.building && h.building.toLowerCase().includes(q)));
  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || (u.department && u.department.toLowerCase().includes(q)));
  const filteredBookings = bookings.filter(b => b.eventName.toLowerCase().includes(q) || (b.hallName || '').toLowerCase().includes(q) || (b.userName || '').toLowerCase().includes(q));
  const filteredLogs = logs.filter(l => (l.Action || '').toLowerCase().includes(q) || (l.AdminName && l.AdminName.toLowerCase().includes(q)));

  const renderContent = () => {
    if (loading) {
      return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div></div>;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView halls={filteredHalls} bookings={filteredBookings} users={filteredUsers} currentRole={currentRole} />;
      case 'halls':
        return <HallsView halls={filteredHalls} currentRole={currentRole} onAddHall={() => setIsAddHallModalOpen(true)} onRequestBooking={() => setIsBookingModalOpen(true)} />;
      case 'users':
        return <UsersView users={filteredUsers} />;
      case 'bookings':
        return <BookingsView bookings={filteredBookings} halls={halls} users={users} currentRole={currentRole} onAction={handleAction} onRequestBooking={() => setIsBookingModalOpen(true)} />;
      case 'sql':
        return currentRole === 'admin' ? <SqlConsoleView /> : <DashboardView halls={filteredHalls} bookings={filteredBookings} users={filteredUsers} currentRole={currentRole} />;
      case 'logs':
        return <AdminLogsView logs={filteredLogs} />;
      default:
        return <DashboardView halls={filteredHalls} bookings={filteredBookings} users={filteredUsers} currentRole={currentRole} />;
    }
  };

  // Switch role and ensure they aren't on an invalid tab
  const handleRoleSwitch = (newRole: Role) => {
    setCurrentRole(newRole);
    if (newRole !== 'admin' && (currentView === 'users' || currentView === 'logs' || currentView === 'sql')) {
      setCurrentView('dashboard');
    }
  };

  if (!isAuthenticated) {
    const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (loginEmail === 'admin@campus.edu' && loginPassword === 'admin') {
        setCurrentRole('admin');
        setIsAuthenticated(true);
        setLoginError('');
      } else if (loginEmail === 'faculty@campus.edu' && loginPassword === 'faculty') {
        setCurrentRole('faculty');
        setIsAuthenticated(true);
        setLoginError('');
      } else if (loginEmail === 'student@campus.edu' && loginPassword === 'student') {
        setCurrentRole('student');
        setIsAuthenticated(true);
        setLoginError('');
      } else {
        setLoginError('Invalid credentials. Please check your email and password.');
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-green-700">
            <Building2 className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Campus Orchard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Login to access the Resource Booking System
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleLoginSubmit}>
              {loginError && (
                <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
                  {loginError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Sign in
                </button>
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">
                      Testing Credentials
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 grid grid-cols-1 gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                  <p><strong>Admin:</strong> admin@campus.edu / admin</p>
                  <p><strong>Faculty:</strong> faculty@campus.edu / faculty</p>
                  <p><strong>Student:</strong> student@campus.edu / student</p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-2 text-green-700">
            <Building2 className="h-6 w-6" />
            <span className="text-lg font-bold tracking-tight">Campus Orchard</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavItem 
            icon={<LayoutDashboard className="h-5 w-5" />} 
            label="Dashboard" 
            isActive={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<Building2 className="h-5 w-5" />} 
            label="Seminar Halls" 
            isActive={currentView === 'halls'} 
            onClick={() => setCurrentView('halls')} 
          />
          <NavItem 
            icon={<CalendarDays className="h-5 w-5" />} 
            label="Bookings" 
            isActive={currentView === 'bookings'} 
            onClick={() => setCurrentView('bookings')} 
          />
          
          {currentRole === 'admin' && (
            <>
              <NavItem 
                icon={<Users className="h-5 w-5" />} 
                label="Users" 
                isActive={currentView === 'users'} 
                onClick={() => setCurrentView('users')} 
              />
              <NavItem 
                icon={<ClipboardList className="h-5 w-5" />} 
                label="Admin Logs" 
                isActive={currentView === 'logs'} 
                onClick={() => setCurrentView('logs')} 
              />
            </>
          )}

          <div className="pt-4 mt-4 border-t border-gray-200">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">DBMS Project</p>
            {currentRole === 'admin' ? (
              <NavItem 
                icon={<Database className="h-5 w-5 text-indigo-600" />} 
                label="SQL Console" 
                isActive={currentView === 'sql'} 
                onClick={() => setCurrentView('sql')} 
              />
            ) : (
              <div className="px-3 py-2 text-sm text-gray-400 italic">
                SQL Console (Admin Only)
              </div>
            )}
          </div>
        </nav>
        
        {/* User Identity Display */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                {currentRole === 'admin' && <ShieldCheck className="h-4 w-4 text-green-700" />}
                {currentRole === 'faculty' && <UserCircle2 className="h-4 w-4 text-green-700" />}
                {currentRole === 'student' && <GraduationCap className="h-4 w-4 text-green-700" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 capitalize">{currentRole} User</span>
                <span className="text-xs text-gray-500 capitalize">{currentRole === 'admin' ? 'Full Access' : `${currentRole} View`}</span>
              </div>
            </div>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-xs font-medium text-red-600 hover:text-red-800"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="ml-4 flex items-center gap-2 text-green-700">
              <Building2 className="h-5 w-5" />
              <span className="text-lg font-bold tracking-tight">Campus Orchard</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center flex-1">
            <h1 className="text-xl font-semibold text-gray-900 capitalize">
              {currentView.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent w-64"
              />
            </div>
            <button className="relative p-2 text-gray-400 hover:text-gray-500">
              <Bell className="h-6 w-6" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </div>
      </main>

      {/* Add Hall Modal */}
      {isAddHallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Add New Hall</h3>
              <button onClick={() => setIsAddHallModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddHall} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Hall Name</label>
                <input type="text" name="name" required className="mt-1 block text-black w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" placeholder="e.g. C-Block Auditorium" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select name="type" className="mt-1 block text-black w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500">
                  <option value="Auditorium">Auditorium</option>
                  <option value="Seminar Hall">Seminar Hall</option>
                  <option value="Lab">Lab</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Capacity</label>
                <input type="number" name="capacity" defaultValue="50" min="1" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location (Building)</label>
                <input type="text" name="location" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" placeholder="e.g. Block C" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddHallModalOpen(false)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-500">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Booking Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Request New Booking</h3>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Name</label>
                <input type="text" name="eventName" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" placeholder="e.g. Society Meetup" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Hall</label>
                <select name="resourceId" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500">
                  {halls.map(hall => (
                    <option key={hall.id} value={hall.id}>{hall.name} (Cap: {hall.capacity})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input type="date" name="date" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input type="time" name="startTime" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input type="time" name="endTime" required className="mt-1 text-black block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-500">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Nav Components and other helper components (omitting MobileMenu for brevity, assuming standard responsive sizing handles it gracefully)
function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-green-50 text-green-700' 
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number | string, icon: React.ReactNode }) {
  return (
    <div className="bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd>
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bg = 'bg-gray-100';
  let text = 'text-gray-800';
  let icon = null;

  if (status === 'Approved') {
    bg = 'bg-green-100';
    text = 'text-green-800';
    icon = <CheckCircle2 className="mr-1.5 h-3 w-3 text-green-600" />;
  } else if (status === 'Pending' || status === 'Pending Admin') {
    bg = 'bg-yellow-100';
    text = 'text-yellow-800';
    icon = <Clock className="mr-1.5 h-3 w-3 text-yellow-600" />;
  } else if (status === 'Rejected') {
    bg = 'bg-red-100';
    text = 'text-red-800';
    icon = <XCircle className="mr-1.5 h-3 w-3 text-red-600" />;
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
      {icon}
      {status}
    </span>
  );
}

// ---------------- VIEWS ----------------

function DashboardView({ halls, bookings, users, currentRole }: { halls: any[], bookings: any[], users: any[], currentRole: string }) {
  const activeHalls = halls.filter(h => h.status === 'Active').length;
  // If student, filter dashboard view to only their bookings / metrics (simulated)
  const relevantBookings = currentRole === 'student' ? bookings.filter(b => b.userId === 'S101') : bookings;
  const pendingBookings = relevantBookings.filter(b => b.status.includes('Pending')).length;
  const todayBookings = relevantBookings.filter(b => b.date === '2026-04-15').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Halls" value={halls.length} icon={<Building2 className="h-6 w-6 text-blue-600" />} />
        <StatCard title="Active Halls" value={activeHalls} icon={<CheckCircle2 className="h-6 w-6 text-green-600" />} />
        <StatCard title={currentRole === 'student' ? 'My Pending Requests' : 'Total Pending Requests'} value={pendingBookings} icon={<Clock className="h-6 w-6 text-yellow-600" />} />
        <StatCard title="Today's Events" value={todayBookings} icon={<CalendarDays className="h-6 w-6 text-purple-600" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Bookings</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {relevantBookings.slice(0, 4).map((booking) => {
              const hall = halls.find(h => h.id === booking.hallId);
              return (
                <div key={booking.bookingId} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{booking.eventName}</span>
                    <span className="text-sm text-gray-500">{hall?.name || booking.hallName} • {booking.date}</span>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Halls Status</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {halls.slice(0, 4).map((hall) => (
              <div key={hall.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{hall.name}</span>
                  <span className="text-sm text-gray-500">Capacity: {hall.capacity}</span>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  hall.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {hall.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HallsView({ halls, currentRole, onAddHall, onRequestBooking }: { halls: any[], currentRole: string, onAddHall: () => void, onRequestBooking: () => void }) {
  return (
    <div className="space-y-4">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-gray-900">Seminar Halls</h2>
        {currentRole === 'admin' && (
          <button onClick={onAddHall} className="mt-3 sm:mt-0 inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
            Add New Hall
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {halls.map((hall) => (
          <div key={hall.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{hall.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{hall.building}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  hall.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {hall.status}
                </span>
              </div>
              
              <div className="mt-4 flex items-center text-sm text-gray-500">
                <Users className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                Capacity: {hall.capacity}
              </div>
            </div>
            
            {(currentRole === 'admin' || currentRole === 'student') && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono">ID: {hall.id}</span>
                {currentRole === 'admin' && <button className="text-sm font-medium text-green-600 hover:text-green-500">Edit Details</button>}
                {currentRole === 'student' && <button onClick={onRequestBooking} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">Request Booking</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingsView({ bookings, halls, users, currentRole, onAction, onRequestBooking }: { bookings: any[], halls: any[], users: any[], currentRole: string, onAction: (t: string, id: string) => void, onRequestBooking: () => void }) {
  const visibleBookings = currentRole === 'student' ? bookings.filter(b => b.userId === 1 || b.userId === 'S101') : bookings;

  return (
    <div className="space-y-4">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-gray-900">{currentRole === 'student' ? 'My Bookings' : 'All Bookings'}</h2>
        {currentRole === 'student' && (
          <button onClick={onRequestBooking} className="mt-3 sm:mt-0 inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
            Request New Booking
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden flex flex-col">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Event</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Hall</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date & Time</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Requested By</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {visibleBookings.map((booking) => {
              const hall = halls.find(h => h.id === booking.hallId);
              const user = users.find(u => u.id === booking.userId);
              
              return (
                <tr key={booking.bookingId}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="font-medium text-gray-900">{booking.eventName}</div>
                    <div className="text-gray-500 font-mono text-xs mt-0.5">{booking.bookingId}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {hall?.name || booking.hallName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>{booking.date}</div>
                    <div className="text-xs mt-0.5">{booking.startTime} - {booking.endTime}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div className="font-medium text-gray-900">{user?.name || booking.userName}</div>
                    <div className="text-xs mt-0.5">{user?.department}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className="relative whitespace-nowrap py-4 text-right text-sm font-medium sm:pr-6">
                    {/* Layered Approval Logic Buttons */}
                    {currentRole === 'faculty' && booking.status === 'Pending' && (
                      <button onClick={() => onAction('faculty_approve', booking.bookingId)} className="text-green-600 bg-green-50 px-3 py-1 rounded-md hover:bg-green-100">
                        Approve (Step 1)
                      </button>
                    )}
                    {currentRole === 'admin' && booking.status === 'Pending Admin' && (
                      <button onClick={() => onAction('admin_verify', booking.bookingId)} className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100">
                        Final Verify
                      </button>
                    )}
                    {(currentRole === 'admin' || currentRole === 'faculty') && booking.status !== 'Pending' && booking.status !== 'Pending Admin' && (
                       <span className="text-gray-400 italic">Resolved</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminLogsView({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-4">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            Admin Action Logs
          </h2>
          <p className="text-sm text-gray-500 mt-1">Tracks resource updates, overrides, and layered approval verifications by Admins.</p>
        </div>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Log ID</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Admin Name</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Action Performed</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Action Time (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {logs.map((log) => (
              <tr key={log.LogID} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                  {log.LogID}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                  {log.AdminName}
                </td>
                <td className="px-3 py-4 text-sm text-gray-700">
                  {log.Action}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                  {log.ActionTime}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersView({ users }: { users: any[] }) {
  return (
    <div className="space-y-4">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-gray-900">Users Directory</h2>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden flex flex-col">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Department</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">
                      {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-gray-500 font-mono text-xs">{user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {user.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {user.department}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div>{user.email}</div>
                  <div className="text-xs mt-0.5">{user.phone}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SqlConsoleView() {
  const [query, setQuery] = useState("SELECT l.LogID, a.Name as AdminName, l.Action, l.ActionTime\nFROM Admin_Log l\nJOIN Admin a ON l.AdminID = a.AdminID\nORDER BY l.ActionTime DESC;");
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch('/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.success) {
        setResults(Array.isArray(data.data) ? data.data : [data.data]);
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Terminal className="h-5 w-5 text-indigo-600" />
          SQL Console
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Execute raw SQL queries against the local SQLite database. Available tables: <code className="bg-gray-100 px-1 py-0.5 rounded">Student</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Faculty</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Admin</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Society</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Event</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Resource</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Equipment</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Booking_Request</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Approval</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Admin_Log</code>.
        </p>
      </div>
      <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase">Query Editor</span>
          <button 
            onClick={runQuery}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {loading ? 'Running...' : 'Run Query'}
          </button>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-40 p-4 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          spellCheck="false"
        />
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">SQL Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {results && results.length > 0 && (
        <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Results ({results.length} rows)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(results[0]).map((key) => (
                    <th key={key} scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {results.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 font-mono">
                        {val === null ? <span className="text-gray-300 italic">null</span> : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {results && results.length === 0 && (
        <div className="text-center py-10 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg">
          <Database className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No results</h3>
          <p className="mt-1 text-sm text-gray-500">The query executed successfully but returned 0 rows.</p>
        </div>
      )}
    </div>
  );
}
