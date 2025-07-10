import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [trips, setTrips] = useState([]);
  const [userTrips, setUserTrips] = useState({ created_trips: [], booked_trips: [] });
  const [loading, setLoading] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '', email: '', phone: '', employee_id: '', department: '', password: ''
  });
  const [tripForm, setTripForm] = useState({
    origin: '', destination: '', departure_time: '', available_seats: 3, price_per_person: '', notes: ''
  });

  useEffect(() => {
    if (token) {
      fetchUserProfile();
      setCurrentView('dashboard');
    }
  }, [token]);

  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Something went wrong');
    }

    return response.json();
  };

  const fetchUserProfile = async () => {
    try {
      const data = await apiCall('/api/user/profile');
      setUser(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      logout();
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/trips');
      setTrips(data.trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTrips = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/user/trips');
      setUserTrips(data);
    } catch (error) {
      console.error('Error fetching user trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      setCurrentView('dashboard');
    } catch (error) {
      alert('Login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const register = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm)
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      setCurrentView('dashboard');
    } catch (error) {
      alert('Registration failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setCurrentView('login');
  };

  const createTrip = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiCall('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          ...tripForm,
          departure_time: new Date(tripForm.departure_time).toISOString(),
          available_seats: parseInt(tripForm.available_seats),
          price_per_person: parseFloat(tripForm.price_per_person)
        })
      });
      alert('Trip created successfully!');
      setTripForm({ origin: '', destination: '', departure_time: '', available_seats: 3, price_per_person: '', notes: '' });
      setCurrentView('dashboard');
    } catch (error) {
      alert('Error creating trip: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const bookTrip = async (tripId) => {
    try {
      setLoading(true);
      await apiCall(`/api/trips/${tripId}/book`, { method: 'POST' });
      alert('Trip booked successfully!');
      fetchTrips();
    } catch (error) {
      alert('Error booking trip: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelTrip = async (tripId) => {
    if (window.confirm('Are you sure you want to cancel this trip?')) {
      try {
        setLoading(true);
        await apiCall(`/api/trips/${tripId}`, { method: 'DELETE' });
        alert('Trip cancelled successfully!');
        fetchUserTrips();
      } catch (error) {
        alert('Error cancelling trip: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-700 mb-2">Turkish Airlines</h1>
          <p className="text-gray-600">Car Pooling for Personnel</p>
        </div>
        
        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="text-center mt-4 text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={() => setCurrentView('register')}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-700 mb-2">Register</h1>
          <p className="text-gray-600">Turkish Airlines Personnel</p>
        </div>
        
        <form onSubmit={register} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={registerForm.phone}
              onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <input
              type="text"
              value={registerForm.employee_id}
              onChange={(e) => setRegisterForm({ ...registerForm, employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              value={registerForm.department}
              onChange={(e) => setRegisterForm({ ...registerForm, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <p className="text-center mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <button
            onClick={() => setCurrentView('login')}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-red-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Turkish Airlines Car Pooling</h1>
          <div className="flex items-center space-x-4">
            <span>Welcome, {user?.name}</span>
            <button
              onClick={() => setCurrentView('create-trip')}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              Create Trip
            </button>
            <button
              onClick={() => setCurrentView('my-trips')}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              My Trips
            </button>
            <button
              onClick={logout}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Available Trips</h2>
            <button
              onClick={fetchTrips}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {trips.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No trips available. Create the first one!</p>
          ) : (
            <div className="grid gap-4">
              {trips.map((trip) => (
                <div key={trip.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-lg">{trip.origin}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-lg">{trip.destination}</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Departure:</strong> {formatDateTime(trip.departure_time)}</p>
                        <p><strong>Created by:</strong> {trip.creator_name}</p>
                        <p><strong>Available seats:</strong> {trip.available_seats}/{trip.max_riders}</p>
                        <p><strong>Price per person:</strong> ₺{trip.price_per_person}</p>
                        {trip.notes && <p><strong>Notes:</strong> {trip.notes}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      {trip.available_seats > 0 && !trip.is_creator && (
                        <button
                          onClick={() => bookTrip(trip.id)}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                        >
                          Book Trip
                        </button>
                      )}
                      {trip.is_creator && (
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                          Your Trip
                        </span>
                      )}
                      {trip.available_seats === 0 && (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                          Full
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCreateTrip = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-red-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Create New Trip</h1>
          <button
            onClick={() => setCurrentView('dashboard')}
            className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>
      
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
          <form onSubmit={createTrip} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
              <input
                type="text"
                value={tripForm.origin}
                onChange={(e) => setTripForm({ ...tripForm, origin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g., Istanbul Airport"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <input
                type="text"
                value={tripForm.destination}
                onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g., City Center"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
              <input
                type="datetime-local"
                value={tripForm.departure_time}
                onChange={(e) => setTripForm({ ...tripForm, departure_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Seats</label>
              <select
                value={tripForm.available_seats}
                onChange={(e) => setTripForm({ ...tripForm, available_seats: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Person (₺)</label>
              <input
                type="number"
                step="0.01"
                value={tripForm.price_per_person}
                onChange={(e) => setTripForm({ ...tripForm, price_per_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0.00"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={tripForm.notes}
                onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows="3"
                placeholder="Any additional information..."
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Creating Trip...' : 'Create Trip'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderMyTrips = () => {
    useEffect(() => {
      fetchUserTrips();
    }, []);

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-red-600 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">My Trips</h1>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              Back to Dashboard
            </button>
          </div>
        </nav>
        
        <div className="container mx-auto p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Trips I Created</h3>
              {userTrips.created_trips.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No trips created yet.</p>
              ) : (
                <div className="space-y-4">
                  {userTrips.created_trips.map((trip) => (
                    <div key={trip.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{trip.origin} → {trip.destination}</p>
                          <p className="text-sm text-gray-600">{formatDateTime(trip.departure_time)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          trip.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trip.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Bookings: {trip.bookings} | Available: {trip.available_seats}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">Price: ₺{trip.price_per_person}</p>
                      {trip.status === 'active' && (
                        <button
                          onClick={() => cancelTrip(trip.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Cancel Trip
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Trips I Booked</h3>
              {userTrips.booked_trips.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No trips booked yet.</p>
              ) : (
                <div className="space-y-4">
                  {userTrips.booked_trips.map((trip) => (
                    <div key={trip.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{trip.origin} → {trip.destination}</p>
                          <p className="text-sm text-gray-600">{formatDateTime(trip.departure_time)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          trip.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trip.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Created by: {trip.creator_name}</p>
                      <p className="text-sm text-gray-600">Price: ₺{trip.price_per_person}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (currentView === 'dashboard') {
      fetchTrips();
    }
  }, [currentView]);

  if (currentView === 'login') return renderLogin();
  if (currentView === 'register') return renderRegister();
  if (currentView === 'create-trip') return renderCreateTrip();
  if (currentView === 'my-trips') return renderMyTrips();
  return renderDashboard();
}

export default App;