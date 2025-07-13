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
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
      />
      {showSuggestions && predictions.length > 0 && (
        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-40 overflow-y-auto mt-1">
          {predictions.map((prediction) => (
            <div
              key={prediction.place_id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handlePlaceSelect(prediction)}
            >
              <div className="text-sm font-medium text-gray-900">{prediction.structured_formatting.main_text}</div>
              <div className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</div>
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

  const mapContainerStyle = {
    width: '100%',
    height: '250px',
    borderRadius: '12px'
  };

  const center = userLocation || { lat: 41.0082, lng: 28.9784 };

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

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={10}
    >
      {directions && <DirectionsRenderer directions={directions} />}
      
      {trips.map((trip) => (
        <Marker
          key={trip.id}
          position={trip.origin.coordinates}
          onClick={() => onTripSelect(trip)}
          icon={{
            url: selectedTrip?.id === trip.id ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new window.google.maps.Size(30, 30)
          }}
        />
      ))}
      
      {userLocation && (
        <Marker
          position={userLocation}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
            scaledSize: new window.google.maps.Size(30, 30)
          }}
        />
      )}
    </GoogleMap>
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
    name: '', email: '', phone: '', employee_id: '', department: '', password: '', home_address: null
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

  // Airport trips state
  const [airportTrips, setAirportTrips] = useState([]);
  const [showAirportTrips, setShowAirportTrips] = useState(false);

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
      setTripType('taxi');
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

  const fetchAirportTrips = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/trips/airport');
      setAirportTrips(data.trips || []);
    } catch (error) {
      console.error('Failed to fetch airport trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (profileData) => {
    try {
      await apiCall('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
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
      setTripType('taxi');
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
      setTripType('taxi');
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

    if (trip.trip_type !== 'personal_car') {
      const paymentMethod = await showPaymentMethodModal(trip);
      if (!paymentMethod) return;
      
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
          fetchWallet();
        }
      } catch (error) {
        alert('Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    } else {
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
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
      
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full">
          <h3 class="text-xl font-bold mb-4 text-center">Choose Payment Method</h3>
          <p class="text-gray-600 mb-6 text-center">Trip cost: ${formatCurrency(trip.price_per_person)}</p>
          <div class="space-y-3">
            <button id="wallet-btn" class="w-full p-4 border-2 border-green-500 text-green-700 rounded-xl hover:bg-green-50 flex items-center justify-between">
              <span class="flex items-center space-x-2">
                <span>💰</span>
                <span>Wallet Payment</span>
              </span>
              <span class="text-sm">${formatCurrency(wallet.balance)}</span>
            </button>
            <button id="cash-btn" class="w-full p-4 border-2 border-blue-500 text-blue-700 rounded-xl hover:bg-blue-50 text-center">
              💵 Cash Payment (Pay driver)
            </button>
            <button id="card-btn" class="w-full p-4 border-2 border-purple-500 text-purple-700 rounded-xl hover:bg-purple-50 text-center">
              💳 Card Payment (Taxi terminal)
            </button>
          </div>
          <button id="cancel-btn" class="w-full mt-4 p-3 text-gray-600 hover:text-gray-800">Cancel</button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const walletBtn = modal.querySelector('#wallet-btn');
      if (wallet.balance < trip.price_per_person) {
        walletBtn.disabled = true;
        walletBtn.className = walletBtn.className.replace('border-green-500 text-green-700 hover:bg-green-50', 'border-gray-300 text-gray-400 cursor-not-allowed');
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
    return new Date(dateString).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // Mobile Login Component
  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">TK</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Turkish Airlines</h1>
          <p className="text-gray-600">Car Pooling App</p>
        </div>
        
        <form onSubmit={login} className="space-y-4">
          <div>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              placeholder="Email"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium text-base"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm text-gray-600">
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

  // Mobile Register Component
  const renderRegister = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm max-h-screen overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">TK</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Join Turkish Airlines</h1>
          <p className="text-gray-600 text-sm">Car Pooling Community</p>
        </div>
        
        <form onSubmit={register} className="space-y-3">
          <input
            type="text"
            value={registerForm.name}
            onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
            placeholder="Full Name"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
            required
          />
          
          <input
            type="email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
            placeholder="Email"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
            required
          />
          
          <input
            type="tel"
            value={registerForm.phone}
            onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
            placeholder="Phone"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
            required
          />
          
          <input
            type="text"
            value={registerForm.employee_id}
            onChange={(e) => setRegisterForm({ ...registerForm, employee_id: e.target.value })}
            placeholder="Employee ID"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
            required
          />
          
          <input
            type="text"
            value={registerForm.department}
            onChange={(e) => setRegisterForm({ ...registerForm, department: e.target.value })}
            placeholder="Department"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
            required
          />
          
          <input
            type="password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
            placeholder="Password"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
            required
          />
          
          {/* Home Address Section */}
          <div className="border-t pt-3 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">🏠 Home Address (Optional)</p>
            <p className="text-xs text-gray-500 mb-3">For easier pickup and airport trip suggestions</p>
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
              <LocationAutocomplete
                onPlaceSelect={(location) => setRegisterForm({ ...registerForm, home_address: location })}
                placeholder="Enter your home address"
                value={registerForm.home_address?.address || ''}
              />
            </LoadScript>
            {registerForm.home_address && (
              <div className="mt-2 p-2 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700">✓ Address saved: {registerForm.home_address.address}</p>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium text-base mt-4"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        <p className="text-center mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <button
            onClick={() => setCurrentView('login')}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );

  // Mobile Dashboard Component
  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">TK</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Turkish Airlines</h1>
                <p className="text-xs text-gray-500">Car Pooling</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCurrentView('wallet')}
                className="flex items-center space-x-1 bg-green-50 px-3 py-2 rounded-lg"
              >
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"/>
                </svg>
                <span className="text-sm font-medium text-green-700">{formatCurrency(wallet.balance)}</span>
              </button>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Mode Toggle */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTripType('taxi')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              tripType === 'taxi' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🚕</span>
              <span>Taxi</span>
            </div>
          </button>
          <button
            onClick={() => setTripType('personal_car')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              tripType === 'personal_car' 
                ? 'bg-white text-green-600 shadow-sm' 
                : 'text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🚗</span>
              <span>Personnel</span>
            </div>
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          {tripType === 'taxi' ? (
            'Professional taxi sharing - Split costs with colleagues'
          ) : (
            'Share rides with personnel traveling your direction'
          )}
        </p>
      </div>

      {/* Quick Stats and Airport Banner */}
      <div className="px-4 py-4">
        {/* Airport Trips Banner */}
        {user?.home_address && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 mb-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg">✈️ Airport Trips</h3>
                <p className="text-blue-100 text-sm">Near your home location</p>
              </div>
              <button
                onClick={() => {
                  setShowAirportTrips(!showAirportTrips);
                  if (!showAirportTrips) fetchAirportTrips();
                }}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg text-sm font-medium"
              >
                {showAirportTrips ? 'Show All' : 'View Airport'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900">
              {showAirportTrips ? airportTrips.length : trips.length}
            </div>
            <div className="text-xs text-gray-500">
              {showAirportTrips ? 'Airport' : 'Available'}
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-bold text-blue-600">{userTrips.created_trips?.length || 0}</div>
            <div className="text-xs text-gray-500">Created</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-bold text-green-600">{userTrips.booked_trips?.length || 0}</div>
            <div className="text-xs text-gray-500">Booked</div>
          </div>
        </div>

        {/* Trips Section */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            {showAirportTrips ? '✈️ Airport Trips' : 
             tripType === 'taxi' ? 'Taxi' : 'Car'} Trips
          </h2>
          <button
            onClick={showAirportTrips ? fetchAirportTrips : fetchTrips}
            disabled={loading}
            className="text-red-600 text-sm font-medium"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {/* Home Address Info */}
        {showAirportTrips && user?.home_address && (
          <div className="bg-green-50 rounded-xl p-3 mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">🏠</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Your Home</p>
                <p className="text-xs text-green-600 truncate">{user.home_address.address}</p>
              </div>
              <span className="text-xs text-green-600 font-medium">Sorted by distance</span>
            </div>
          </div>
        )}
        
        {(showAirportTrips ? airportTrips : trips).length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">
                {showAirportTrips ? '✈️' : tripType === 'taxi' ? '🚕' : '🚗'}
              </span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {showAirportTrips ? 'No airport trips found' : 'No trips yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {showAirportTrips ? 'Airport trips will appear here when available' : 'Be the first to create a trip'}
            </p>
            {!showAirportTrips && (
              <button
                onClick={() => setCurrentView('create-trip')}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-medium"
              >
                Create Trip
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-20">
            {(showAirportTrips ? airportTrips : trips).map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                onClick={() => setSelectedTrip(trip)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      {showAirportTrips && (
                        <span className="text-blue-500 text-sm">✈️</span>
                      )}
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {trip.origin.address.split(',')[0]}
                      </h3>
                      <span className="text-gray-400 text-xs">→</span>
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {trip.destination.address.split(',')[0]}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                      <span>{formatDateTime(trip.departure_time)}</span>
                      <span>{trip.creator_name}</span>
                      {trip.distance_from_home && (
                        <span className="text-green-600">
                          📍 {formatDistance(trip.distance_from_home)} from home
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-600">{formatCurrency(trip.price_per_person)}</span>
                      <span className="text-xs text-gray-500">{trip.available_seats}/{trip.max_riders} seats</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    {trip.trip_type === 'personal_car' ? (
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
                        Wallet only
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                        Cash/Card/Wallet
                      </span>
                    )}
                    {trip.is_creator && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                        Your trip
                      </span>
                    )}
                  </div>
                  
                  {trip.available_seats > 0 && !trip.is_creator && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        bookTrip(trip.id);
                      }}
                      disabled={loading || (trip.trip_type === 'personal_car' && wallet.balance < trip.price_per_person)}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {trip.trip_type === 'personal_car' ? 'Request' : 'Book'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center space-y-1 py-2 px-3 ${
              currentView === 'dashboard' ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
            <span className="text-xs">Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('create-trip')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <span className="text-xs">Create</span>
          </button>
          
          <button
            onClick={() => setCurrentView('my-trips')}
            className={`flex flex-col items-center space-y-1 py-2 px-3 ${
              currentView === 'my-trips' ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <span className="text-xs">My Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('wallet')}
            className={`flex flex-col items-center space-y-1 py-2 px-3 ${
              currentView === 'wallet' ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"/>
            </svg>
            <span className="text-xs">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Mobile Wallet Component
  const renderWallet = () => (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="p-2 -ml-2"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">My Wallet</h1>
            <div className="w-8"></div>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-6 pb-20">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 mb-6 text-white">
          <div className="text-center">
            <p className="text-green-100 text-sm mb-1">Available Balance</p>
            <div className="text-3xl font-bold mb-2">{formatCurrency(wallet.balance)}</div>
            <p className="text-green-100 text-xs">Turkish Lira</p>
          </div>
        </div>
        
        {/* Top-up Packages */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Top-up Packages</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(walletPackages).map(([packageId, packageData]) => (
              <button
                key={packageId}
                onClick={() => topUpWallet(packageId)}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white py-4 px-4 rounded-xl disabled:opacity-50 transition-colors"
              >
                <div className="text-xs opacity-90">{packageData.name}</div>
                <div className="font-bold text-lg">{formatCurrency(packageData.amount)}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Transaction History */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
          {walletTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"/>
              </svg>
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {walletTransactions.slice(0, 10).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium">
                        {transaction.transaction_type === 'topup' ? 'Top-up' : 
                         transaction.transaction_type === 'payment' ? 'Payment' : 'Refund'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-100 text-green-700' : 
                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{transaction.description}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(transaction.created_at)}</p>
                  </div>
                  <div className={`text-right font-bold ${
                    transaction.transaction_type === 'topup' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.transaction_type === 'topup' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
            <span className="text-xs">Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('create-trip')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <span className="text-xs">Create</span>
          </button>
          
          <button
            onClick={() => setCurrentView('my-trips')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <span className="text-xs">My Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('wallet')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-red-600"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"/>
            </svg>
            <span className="text-xs">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Mobile Create Trip Component
  const renderCreateTrip = () => (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="p-2 -ml-2"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">
              Create {tripType === 'taxi' ? 'Taxi' : 'Car'} Trip
            </h1>
            <div className="w-8"></div>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-6 pb-20">
        <form onSubmit={createTrip} className="space-y-6">
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <LocationAutocomplete
                onPlaceSelect={(location) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, origin: location });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, origin: location });
                  }
                }}
                placeholder="Where are you starting from?"
              />
              {((tripType === 'taxi' ? tripForm.origin : personalCarForm.origin)) && (
                <p className="text-xs text-gray-500 mt-2 truncate">
                  {(tripType === 'taxi' ? tripForm.origin : personalCarForm.origin).address}
                </p>
              )}
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <LocationAutocomplete
                onPlaceSelect={(location) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, destination: location });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, destination: location });
                  }
                }}
                placeholder="Where are you going?"
              />
              {((tripType === 'taxi' ? tripForm.destination : personalCarForm.destination)) && (
                <p className="text-xs text-gray-500 mt-2 truncate">
                  {(tripType === 'taxi' ? tripForm.destination : personalCarForm.destination).address}
                </p>
              )}
            </div>
          </LoadScript>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">Departure Time</label>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">Seats</label>
              <select
                value={tripType === 'taxi' ? tripForm.available_seats : personalCarForm.available_seats}
                onChange={(e) => {
                  if (tripType === 'taxi') {
                    setTripForm({ ...tripForm, available_seats: parseInt(e.target.value) });
                  } else {
                    setPersonalCarForm({ ...personalCarForm, available_seats: parseInt(e.target.value) });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                {tripType === 'personal_car' && <option value={4}>4</option>}
                {tripType === 'personal_car' && <option value={5}>5</option>}
              </select>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (₺)</label>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          
          {tripType === 'personal_car' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Car Model</label>
                <input
                  type="text"
                  value={personalCarForm.car_model}
                  onChange={(e) => setPersonalCarForm({ ...personalCarForm, car_model: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
                  placeholder="e.g., Toyota Corolla"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <input
                    type="text"
                    value={personalCarForm.car_color}
                    onChange={(e) => setPersonalCarForm({ ...personalCarForm, car_color: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
                    placeholder="White"
                    required
                  />
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plate</label>
                  <input
                    type="text"
                    value={personalCarForm.license_plate}
                    onChange={(e) => setPersonalCarForm({ ...personalCarForm, license_plate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
                    placeholder="34 ABC 123"
                    required
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={tripType === 'taxi' ? tripForm.notes : personalCarForm.notes}
              onChange={(e) => {
                if (tripType === 'taxi') {
                  setTripForm({ ...tripForm, notes: e.target.value });
                } else {
                  setPersonalCarForm({ ...personalCarForm, notes: e.target.value });
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-base"
              rows="3"
              placeholder="Any additional information..."
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-4 px-4 rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium text-base"
          >
            {loading ? 'Creating Trip...' : 'Create Trip'}
          </button>
        </form>
      </div>
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
            <span className="text-xs">Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('create-trip')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-red-600"
          >
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <span className="text-xs">Create</span>
          </button>
          
          <button
            onClick={() => setCurrentView('my-trips')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <span className="text-xs">My Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('wallet')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"/>
            </svg>
            <span className="text-xs">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Mobile My Trips Component
  const renderMyTrips = () => (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="p-2 -ml-2"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">My Trips</h1>
            <div className="w-8"></div>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-6 pb-20">
        <div className="space-y-6">
          {/* Created Trips */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Trips I Created ({userTrips.created_trips?.length || 0})
            </h3>
            {(userTrips.created_trips?.length || 0) === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                </svg>
                <p className="text-sm">No trips created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userTrips.created_trips.map((trip) => (
                  <div key={trip.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{trip.origin.address.split(',')[0]} → {trip.destination.address.split(',')[0]}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(trip.departure_time)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trip.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {trip.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Bookings: {trip.bookings} | Seats: {trip.available_seats}</span>
                      <span>{formatCurrency(trip.price_per_person)}</span>
                    </div>
                    {trip.status === 'active' && (
                      <button
                        onClick={() => cancelTrip(trip.id)}
                        className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        Cancel Trip
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Booked Trips */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Trips I Booked ({userTrips.booked_trips?.length || 0})
            </h3>
            {(userTrips.booked_trips?.length || 0) === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                </svg>
                <p className="text-sm">No trips booked yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userTrips.booked_trips.map((trip) => (
                  <div key={trip.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{trip.origin.address.split(',')[0]} → {trip.destination.address.split(',')[0]}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(trip.departure_time)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trip.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {trip.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      <p>Driver: {trip.creator_name}</p>
                      <p>Price: {formatCurrency(trip.price_per_person)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
            <span className="text-xs">Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('create-trip')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <span className="text-xs">Create</span>
          </button>
          
          <button
            onClick={() => setCurrentView('my-trips')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-red-600"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <span className="text-xs">My Trips</span>
          </button>
          
          <button
            onClick={() => setCurrentView('wallet')}
            className="flex flex-col items-center space-y-1 py-2 px-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"/>
            </svg>
            <span className="text-xs">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (currentView === 'login') return renderLogin();
  if (currentView === 'register') return renderRegister();
  if (currentView === 'dashboard') return renderDashboard();
  if (currentView === 'create-trip') return renderCreateTrip();
  if (currentView === 'my-trips') return renderMyTrips();
  if (currentView === 'wallet') return renderWallet();
  
  return <div>Loading...</div>;
}

export default App;