import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import './App.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Location autocomplete component
const LocationAutocomplete = ({ onPlaceSelect, placeholder, value }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [predictions, setPredictions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (inputValue && inputValue.length > 2) {
      const service = new window.google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input: inputValue, componentRestrictions: { country: 'tr' } },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setPredictions(predictions || []);
            setShowSuggestions(true);
          } else {
            setPredictions([]);
            setShowSuggestions(false);
          }
        }
      );
    } else {
      setPredictions([]);
      setShowSuggestions(false);
    }
  }, [inputValue]);

  const handlePlaceSelect = (prediction) => {
    const service = new window.google.maps.places.PlacesService(
      document.createElement('div')
    );

    service.getDetails({ placeId: prediction.place_id }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        const location = {
          address: place.formatted_address,
          coordinates: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          },
          place_id: place.place_id
        };
        onPlaceSelect(location);
        setInputValue(place.formatted_address);
        setShowSuggestions(false);
      }
    });
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      {showSuggestions && predictions.length > 0 && (
        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {predictions.map((prediction) => (
            <div
              key={prediction.place_id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handlePlaceSelect(prediction)}
            >
              {prediction.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Trip Map Component
const TripMap = ({ trips, selectedTrip, onTripSelect, userLocation }) => {
  const [directions, setDirections] = useState(null);
  const [map, setMap] = useState(null);

  const mapContainerStyle = {
    width: '100%',
    height: '400px'
  };

  const center = userLocation || { lat: 41.0082, lng: 28.9784 }; // Default to Istanbul

  useEffect(() => {
    if (selectedTrip && selectedTrip.origin && selectedTrip.destination) {
      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route({
        origin: selectedTrip.origin.coordinates,
        destination: selectedTrip.destination.coordinates,
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
        }
      });
    }
  }, [selectedTrip]);

  const onLoad = (map) => {
    setMap(map);
  };

  return (
    <div className="h-96">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={10}
        onLoad={onLoad}
      >
        {directions && <DirectionsRenderer directions={directions} />}
        
        {trips.map((trip) => (
          <Marker
            key={trip.id}
            position={trip.origin.coordinates}
            onClick={() => onTripSelect(trip)}
            icon={{
              url: selectedTrip?.id === trip.id ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: new window.google.maps.Size(40, 40)
            }}
          />
        ))}
        
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: new window.google.maps.Size(40, 40)
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
};

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState([]);
  const [userTrips, setUserTrips] = useState({ created_trips: [], booked_trips: [] });
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [tripType, setTripType] = useState('taxi');

  // Wallet state
  const [wallet, setWallet] = useState({ balance: 0, currency: 'try' });
  const [walletPackages, setWalletPackages] = useState({});
  const [walletTransactions, setWalletTransactions] = useState([]);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '', email: '', phone: '', employee_id: '', department: '', password: ''
  });
  const [tripForm, setTripForm] = useState({
    origin: null, destination: null, departure_time: '', available_seats: 3, price_per_person: '', notes: ''
  });
  const [personalCarForm, setPersonalCarForm] = useState({
    origin: null, destination: null, departure_time: '', available_seats: 3, 
    price_per_person: '', notes: '', car_model: '', car_color: '', license_plate: ''
  });
  const [bookingForm, setBookingForm] = useState({
    pickup_location: null, pickup_bus_stop_id: '', home_address: null, payment_method: 'wallet'
  });

  // Check for token on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUserProfile(savedToken);
    }
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Error getting location:', error)
      );
    }
  }, []);

  const apiCall = async (endpoint, options = {}) => {
    const url = `${BACKEND_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  const fetchUserProfile = async (authToken = token) => {
    try {
      const data = await apiCall('/api/user/profile', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setUser(data);
      setTripType('taxi'); // Default to taxi sharing
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await apiCall(`/api/trips?trip_type=${tripType}`);
      setTrips(data.trips || []);
    } catch (error) {
      console.error('Failed to fetch trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTrips = async () => {
    try {
      const data = await apiCall('/api/user/trips');
      setUserTrips(data);
    } catch (error) {
      console.error('Failed to fetch user trips:', error);
    }
  };

  const fetchWallet = async () => {
    try {
      const data = await apiCall('/api/wallet');
      setWallet(data);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    }
  };

  const fetchWalletPackages = async () => {
    try {
      const data = await apiCall('/api/wallet/packages');
      setWalletPackages(data.packages || {});
    } catch (error) {
      console.error('Failed to fetch wallet packages:', error);
    }
  };

  const fetchWalletTransactions = async () => {
    try {
      const data = await apiCall('/api/wallet/transactions');
      setWalletTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch wallet transactions:', error);
    }
  };

  // Load data when view changes
  useEffect(() => {
    if (currentView === 'dashboard' && token) {
      fetchTrips();
      fetchWallet();
    }
  }, [currentView, token, tripType]);

  useEffect(() => {
    if (currentView === 'my-trips' && token) {
      fetchUserTrips();
    }
  }, [currentView, token]);

  useEffect(() => {
    if (currentView === 'wallet' && token) {
      fetchWallet();
      fetchWalletPackages();
      fetchWalletTransactions();
    }
  }, [currentView, token]);

  useEffect(() => {
    if (currentView === 'home' && token) {
      fetchWallet();
    }
  }, [currentView, token]);

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
      setTripType('taxi'); // Default to taxi sharing
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
      setTripType('taxi'); // Default to taxi sharing
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

  const topUpWallet = async (packageId) => {
    try {
      setLoading(true);
      const data = await apiCall('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({
          package_id: packageId,
          origin_url: window.location.origin
        })
      });
      
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      alert('Top-up failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check for payment success on wallet page
  useEffect(() => {
    if (currentView === 'wallet') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      
      if (sessionId) {
        checkPaymentStatus(sessionId);
      }
    }
  }, [currentView]);

  const checkPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      alert('Payment status check timed out. Please refresh the page.');
      return;
    }

    try {
      const data = await apiCall(`/api/wallet/payment/status/${sessionId}`);
      
      if (data.payment_status === 'paid') {
        alert('Payment successful! Your wallet has been topped up.');
        fetchWallet();
        fetchWalletTransactions();
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      } else if (data.status === 'expired') {
        alert('Payment session expired. Please try again.');
        return;
      }

      setTimeout(() => checkPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  };

  const createTrip = async (e) => {
    e.preventDefault();
    
    let endpoint, formData;
    if (tripType === 'taxi') {
      if (!tripForm.origin || !tripForm.destination) {
        alert('Please select both origin and destination locations');
        return;
      }
      endpoint = '/api/trips';
      formData = {
        origin: tripForm.origin,
        destination: tripForm.destination,
        departure_time: new Date(tripForm.departure_time).toISOString(),
        available_seats: parseInt(tripForm.available_seats),
        price_per_person: parseFloat(tripForm.price_per_person),
        notes: tripForm.notes
      };
    } else {
      if (!personalCarForm.origin || !personalCarForm.destination) {
        alert('Please select both origin and destination locations');
        return;
      }
      endpoint = '/api/trips/personal-car';
      formData = {
        origin: personalCarForm.origin,
        destination: personalCarForm.destination,
        departure_time: new Date(personalCarForm.departure_time).toISOString(),
        available_seats: parseInt(personalCarForm.available_seats),
        price_per_person: parseFloat(personalCarForm.price_per_person),
        notes: personalCarForm.notes,
        car_model: personalCarForm.car_model,
        car_color: personalCarForm.car_color,
        license_plate: personalCarForm.license_plate
      };
    }

    try {
      setLoading(true);
      await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      alert('Trip created successfully!');
      
      // Reset forms
      if (tripType === 'taxi') {
        setTripForm({ origin: null, destination: null, departure_time: '', available_seats: 3, price_per_person: '', notes: '' });
      } else {
        setPersonalCarForm({ 
          origin: null, destination: null, departure_time: '', available_seats: 3, 
          price_per_person: '', notes: '', car_model: '', car_color: '', license_plate: '' 
        });
      }
      
      setCurrentView('dashboard');
    } catch (error) {
      alert('Error creating trip: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const bookTrip = async (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    
    if (!trip) {
      alert('Trip not found');
      return;
    }

    // Show payment method selection for taxi trips
    if (trip.trip_type !== 'personal_car') {
      const paymentMethod = await showPaymentMethodModal(trip);
      if (!paymentMethod) return; // User cancelled
      
      try {
        setLoading(true);
        const bookingData = { 
          trip_id: tripId,
          payment_method: paymentMethod
        };
        
        if (bookingForm.home_address) {
          bookingData.home_address = bookingForm.home_address;
        } else if (bookingForm.pickup_location) {
          bookingData.pickup_location = bookingForm.pickup_location;
        }
        
        await apiCall(`/api/trips/${tripId}/book`, {
          method: 'POST',
          body: JSON.stringify(bookingData)
        });
        alert('Trip booked successfully!');
        fetchTrips();
        if (paymentMethod === 'wallet') {
          fetchWallet(); // Update wallet balance only if wallet was used
        }
      } catch (error) {
        alert('Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Personal car trips - create join request
      try {
        setLoading(true);
        await apiCall(`/api/trips/${tripId}/join-request`, {
          method: 'POST',
          body: JSON.stringify({
            message: 'I would like to join this trip'
          })
        });
        alert('Join request sent successfully!');
        fetchTrips();
      } catch (error) {
        alert('Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const showPaymentMethodModal = (trip) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 class="text-xl font-bold mb-4">Choose Payment Method</h3>
          <p class="text-gray-600 mb-4">Trip cost: ${formatCurrency(trip.price_per_person)}</p>
          <div class="space-y-3">
            <button id="wallet-btn" class="w-full p-3 border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 flex items-center justify-between">
              <span>💰 Wallet Payment</span>
              <span class="text-sm">${formatCurrency(wallet.balance)} available</span>
            </button>
            <button id="cash-btn" class="w-full p-3 border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50">
              💵 Cash Payment (Pay driver directly)
            </button>
            <button id="card-btn" class="w-full p-3 border-2 border-purple-500 text-purple-700 rounded-lg hover:bg-purple-50">
              💳 Card Payment (Use taxi terminal)
            </button>
          </div>
          <div class="mt-4 pt-4 border-t">
            <button id="cancel-btn" class="w-full p-2 text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Disable wallet button if insufficient balance
      const walletBtn = modal.querySelector('#wallet-btn');
      if (wallet.balance < trip.price_per_person) {
        walletBtn.disabled = true;
        walletBtn.className = walletBtn.className.replace('border-green-500 text-green-700 hover:bg-green-50', 'border-gray-300 text-gray-400 cursor-not-allowed');
        walletBtn.innerHTML = `
          <span>💰 Wallet Payment (Insufficient Balance)</span>
          <span class="text-sm">${formatCurrency(wallet.balance)} available</span>
        `;
      }
      
      modal.querySelector('#wallet-btn').onclick = () => {
        if (wallet.balance >= trip.price_per_person) {
          document.body.removeChild(modal);
          resolve('wallet');
        }
      };
      
      modal.querySelector('#cash-btn').onclick = () => {
        document.body.removeChild(modal);
        resolve('cash');
      };
      
      modal.querySelector('#card-btn').onclick = () => {
        document.body.removeChild(modal);
        resolve('card');
      };
      
      modal.querySelector('#cancel-btn').onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };
      
      modal.onclick = (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve(null);
        }
      };
    });
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

  const formatDistance = (km) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}min`;
  };

  const formatCurrency = (amount) => {
    return `₺${parseFloat(amount).toFixed(2)}`;
  };

  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-700 mb-2">Turkish Airlines</h1>
          <p className="text-gray-600">Smart Car Pooling for Personnel</p>
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

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-700 mb-2">Turkish Airlines</h1>
          <p className="text-gray-600">Choose Your Transportation</p>
          <p className="text-sm text-gray-500 mt-2">Welcome, {user?.name}</p>
          <p className="text-sm text-green-600 mt-1">Wallet: {formatCurrency(wallet.balance)}</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => {
              setTripType('taxi');
              setCurrentView('dashboard');
            }}
            className="w-full bg-red-600 text-white py-4 px-6 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center space-x-3"
          >
            <span className="text-2xl">🚕</span>
            <div className="text-left">
              <div className="font-semibold">Taxi Sharing</div>
              <div className="text-sm opacity-90">Share professional taxi rides</div>
              <div className="text-xs opacity-75">Home pickup available</div>
            </div>
          </button>
          
          <button
            onClick={() => {
              setTripType('personal_car');
              setCurrentView('dashboard');
            }}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center space-x-3"
          >
            <span className="text-2xl">🚗</span>
            <div className="text-left">
              <div className="font-semibold">Personnel Car</div>
              <div className="text-sm opacity-90">Share rides in personal vehicles</div>
              <div className="text-xs opacity-75">Bus stop pickup points</div>
            </div>
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setCurrentView('wallet')}
            className="w-full text-green-600 hover:text-green-800 font-medium py-2 mb-2"
          >
            💰 Manage Wallet ({formatCurrency(wallet.balance)})
          </button>
          <button
            onClick={() => setCurrentView('my-trips')}
            className="w-full text-red-600 hover:text-red-800 font-medium py-2"
          >
            View My Trips
          </button>
          <button
            onClick={logout}
            className="w-full text-gray-600 hover:text-gray-800 py-2 mt-2"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-red-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Wallet</h1>
          <div className="flex items-center space-x-4">
            <span>Balance: {formatCurrency(wallet.balance)}</span>
            <button
              onClick={() => setCurrentView('home')}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              Back to Home
            </button>
          </div>
        </div>
      </nav>
      
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-6 py-3">
          <p className="text-gray-600 text-center text-sm">
            {tripType === 'taxi' ? (
              'Professional taxi sharing - Split costs with fellow personnel'
            ) : (
              'Share rides with colleagues traveling in your direction'
            )}
          </p>
        </div>
      </div>
      
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Wallet Balance</h3>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {formatCurrency(wallet.balance)}
              </div>
              <p className="text-gray-600">Available Balance</p>
            </div>
            
            <h4 className="text-lg font-semibold mb-4 text-gray-800">Top-up Packages</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(walletPackages).map(([packageId, packageData]) => (
                <button
                  key={packageId}
                  onClick={() => topUpWallet(packageId)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-md disabled:opacity-50 transition-colors"
                >
                  <div className="text-sm">{packageData.name}</div>
                  <div className="font-bold">{formatCurrency(packageData.amount)}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Transaction History</h3>
            {walletTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No transactions yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {walletTransactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">
                          {transaction.transaction_type === 'topup' ? '💰 Top-up' : 
                           transaction.transaction_type === 'payment' ? '💳 Payment' : '🔄 Refund'}
                        </p>
                        <p className="text-gray-600 text-xs">{transaction.description}</p>
                        <p className="text-gray-500 text-xs">{formatDateTime(transaction.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${transaction.transaction_type === 'topup' ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.transaction_type === 'topup' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Left side - Logo and Navigation */}
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-red-600">Turkish Airlines</h1>
              
              {/* Trip Type Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setTripType('taxi')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tripType === 'taxi' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Taxi Sharing
                </button>
                <button
                  onClick={() => setTripType('personal_car')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tripType === 'personal_car' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Personnel Car
                </button>
              </div>
            </div>
            
            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-6">
              {/* User Info */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.department}</p>
                </div>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-medium text-sm">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              </div>
              
              {/* Wallet */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentView('wallet')}
                  className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(wallet.balance)}</span>
                </button>
              </div>
              
              {/* Action Menu */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentView('create-trip')}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Trip
                </button>
                <button
                  onClick={() => setCurrentView('my-trips')}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  My Trips
                </button>
                <button
                  onClick={logout}
                  className="text-gray-400 hover:text-gray-600 px-3 py-2 text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Content - Trips List */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Available {tripType === 'taxi' ? 'Taxi' : 'Personnel Car'} Trips
                  </h2>
                  <button
                    onClick={fetchTrips}
                    disabled={loading}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
            
            {trips.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No trips available. Create the first one!</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                      selectedTrip?.id === trip.id ? 'ring-2 ring-red-500' : ''
                    }`}
                    onClick={() => setSelectedTrip(trip)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-lg">{trip.origin.address}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-semibold text-lg">{trip.destination.address}</span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Departure:</strong> {formatDateTime(trip.departure_time)}</p>
                          <p><strong>Created by:</strong> {trip.creator_name}</p>
                          <p><strong>Available seats:</strong> {trip.available_seats}/{trip.max_riders}</p>
                          <p><strong>Price per person:</strong> {formatCurrency(trip.price_per_person)}</p>
                          {trip.distance_km > 0 && (
                            <p><strong>Distance:</strong> {formatDistance(trip.distance_km)} • {formatDuration(trip.duration_minutes)}</p>
                          )}
                          {trip.notes && <p><strong>Notes:</strong> {trip.notes}</p>}
                          {trip.trip_type === 'personal_car' && (
                            <p><strong>Car:</strong> {trip.car_color} {trip.car_model} ({trip.license_plate})</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        {trip.available_seats > 0 && !trip.is_creator && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              bookTrip(trip.id);
                            }}
                            disabled={loading || (trip.trip_type === 'personal_car' && wallet.balance < trip.price_per_person)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                            title={
                              trip.trip_type === 'personal_car' && wallet.balance < trip.price_per_person 
                                ? 'Insufficient wallet balance for personal car trip' 
                                : trip.trip_type === 'personal_car' 
                                  ? 'Request to join (Wallet payment required)' 
                                  : 'Book trip (Choose payment method)'
                            }
                          >
                            {trip.trip_type === 'personal_car' ? 'Request Join (Wallet)' : 'Book Trip'}
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
                        {trip.trip_type === 'personal_car' && wallet.balance < trip.price_per_person && !trip.is_creator && (
                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs">
                            Low Wallet Balance
                          </span>
                        )}
                        {trip.trip_type !== 'personal_car' && (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">
                            Cash/Card/Wallet
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Trip Map</h3>
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              <TripMap
                trips={trips}
                selectedTrip={selectedTrip}
                onTripSelect={setSelectedTrip}
                userLocation={userLocation}
              />
            </LoadScript>
            {selectedTrip && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-2">Selected Trip</h4>
                <p className="text-sm text-gray-600">
                  <strong>Route:</strong> {selectedTrip.origin.address} → {selectedTrip.destination.address}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Creator:</strong> {selectedTrip.creator_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Departure:</strong> {formatDateTime(selectedTrip.departure_time)}
                </p>
                {selectedTrip.distance_km > 0 && (
                  <p className="text-sm text-gray-600">
                    <strong>Distance:</strong> {formatDistance(selectedTrip.distance_km)} • {formatDuration(selectedTrip.duration_minutes)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCreateTrip = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-red-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            Create New {tripType === 'taxi' ? 'Taxi' : 'Car'} Trip
          </h1>
          <button
            onClick={() => setCurrentView('dashboard')}
            className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>
      
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
          <form onSubmit={createTrip} className="space-y-4">
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                <LocationAutocomplete
                  onPlaceSelect={(location) => {
                    if (tripType === 'taxi') {
                      setTripForm({ ...tripForm, origin: location });
                    } else {
                      setPersonalCarForm({ ...personalCarForm, origin: location });
                    }
                  }}
                  placeholder="Select trip origin (e.g., Istanbul Airport)"
                />
                {((tripType === 'taxi' ? tripForm.origin : personalCarForm.origin)) && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {(tripType === 'taxi' ? tripForm.origin : personalCarForm.origin).address}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                <LocationAutocomplete
                  onPlaceSelect={(location) => {
                    if (tripType === 'taxi') {
                      setTripForm({ ...tripForm, destination: location });
                    } else {
                      setPersonalCarForm({ ...personalCarForm, destination: location });
                    }
                  }}
                  placeholder="Select trip destination (e.g., City Center)"
                />
                {((tripType === 'taxi' ? tripForm.destination : personalCarForm.destination)) && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {(tripType === 'taxi' ? tripForm.destination : personalCarForm.destination).address}
                  </p>
                )}
              </div>
            </LoadScript>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
              <input
                type="datetime-local"
                value={tripType === 'taxi' ? tripForm.departure_time : personalCarForm.departure_time}
                onChange={(e) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, departure_time: e.target.value });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, departure_time: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Seats</label>
              <select
                value={tripType === 'taxi' ? tripForm.available_seats : personalCarForm.available_seats}
                onChange={(e) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, available_seats: parseInt(e.target.value) });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, available_seats: parseInt(e.target.value) });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                {tripType === 'personal_car' && <option value={4}>4</option>}
                {tripType === 'personal_car' && <option value={5}>5</option>}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Person (₺)</label>
              <input
                type="number"
                step="0.01"
                value={tripType === 'taxi' ? tripForm.price_per_person : personalCarForm.price_per_person}
                onChange={(e) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, price_per_person: e.target.value });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, price_per_person: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0.00"
                required
              />
            </div>
            
            {tripType === 'personal_car' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Car Model</label>
                  <input
                    type="text"
                    value={personalCarForm.car_model}
                    onChange={(e) => setPersonalCarForm({ ...personalCarForm, car_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g., Toyota Corolla"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Car Color</label>
                  <input
                    type="text"
                    value={personalCarForm.car_color}
                    onChange={(e) => setPersonalCarForm({ ...personalCarForm, car_color: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g., White"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                  <input
                    type="text"
                    value={personalCarForm.license_plate}
                    onChange={(e) => setPersonalCarForm({ ...personalCarForm, license_plate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g., 34 ABC 123"
                    required
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={tripType === 'taxi' ? tripForm.notes : personalCarForm.notes}
                onChange={(e) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, notes: e.target.value });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, notes: e.target.value });
                  }
                }}
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
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-red-600 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">My Trips</h1>
            <button
              onClick={() => setCurrentView('home')}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              Back to Home
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
                          <p className="font-semibold">{trip.origin.address} → {trip.destination.address}</p>
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
                      <p className="text-sm text-gray-600 mb-2">Price: {formatCurrency(trip.price_per_person)}</p>
                      {trip.distance_km > 0 && (
                        <p className="text-sm text-gray-600 mb-3">
                          Distance: {formatDistance(trip.distance_km)} • {formatDuration(trip.duration_minutes)}
                        </p>
                      )}
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
                          <p className="font-semibold">{trip.origin.address} → {trip.destination.address}</p>
                          <p className="text-sm text-gray-600">{formatDateTime(trip.departure_time)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          trip.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trip.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Created by: {trip.creator_name}</p>
                      <p className="text-sm text-gray-600 mb-2">Price: {formatCurrency(trip.price_per_person)}</p>
                      {trip.distance_km > 0 && (
                        <p className="text-sm text-gray-600">
                          Distance: {formatDistance(trip.distance_km)} • {formatDuration(trip.duration_minutes)}
                        </p>
                      )}
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

  if (currentView === 'login') return renderLogin();
  if (currentView === 'register') return renderRegister();
  if (currentView === 'home') return renderHome();
  if (currentView === 'dashboard') return renderDashboard();
  if (currentView === 'create-trip') return renderCreateTrip();
  if (currentView === 'my-trips') return renderMyTrips();
  if (currentView === 'wallet') return renderWallet();
  
  return <div>App is loading...</div>;
}

export default App;