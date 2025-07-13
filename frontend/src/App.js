import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, InfoWindow } from '@react-google-maps/api';
import './App.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 41.0082, // Istanbul coordinates
  lng: 28.9784
};

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

// Chat Component
const ChatComponent = ({ tripId, currentUser, messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-96 flex flex-col">
      <h3 className="text-lg font-bold mb-4">Trip Chat</h3>
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-2 rounded-lg max-w-xs ${
              message.sender_id === currentUser.id
                ? 'bg-red-500 text-white ml-auto'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            <div className="text-xs opacity-75 mb-1">
              {message.sender_name} • {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            <div>{message.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSendMessage} className="flex space-x-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          type="submit"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
        >
          Send
        </button>
      </form>
    </div>
  );
};

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [trips, setTrips] = useState([]);
  const [userTrips, setUserTrips] = useState({ created_trips: [], booked_trips: [] });
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tripType, setTripType] = useState('taxi'); // 'taxi' or 'personal_car'
  
  // Real-time features
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);

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
    home_address: null,
    pickup_location: null
  });

  // Initialize WebSocket connection
  useEffect(() => {
    if (user && token) {
      const newSocket = io(API_URL, {
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Connected to WebSocket');
      });

      newSocket.on('chat_message', (data) => {
        setMessages(prev => [...prev, data.message]);
      });

      newSocket.on('location_update', (data) => {
        setLiveLocations(prev => {
          const updated = prev.filter(loc => loc.user_id !== data.user_id);
          return [...updated, data];
        });
      });

      newSocket.on('join_request', (data) => {
        alert(data.message);
      });

      newSocket.on('trip_booking', (data) => {
        alert(data.message);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token]);

  const sendWebSocketMessage = (messageData) => {
    if (socket && socket.connected) {
      socket.emit('message', messageData);
    }
  };

  const sendChatMessage = (content) => {
    if (selectedTrip && socket) {
      const messageData = {
        type: 'chat_message',
        trip_id: selectedTrip.id,
        content: content,
        message_type: 'text'
      };
      sendWebSocketMessage(messageData);
    }
  };

  const updateLiveLocation = (tripId) => {
    if (navigator.geolocation && socket) {
      navigator.geolocation.getCurrentPosition((position) => {
        const locationData = {
          type: 'location_update',
          trip_id: tripId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed
        };
        sendWebSocketMessage(locationData);
      });
    }
  };

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Error getting location:', error);
        }
      );
    }
  }, []);

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
    
    let endpoint, formData;
    if (tripType === 'taxi') {
      if (!tripForm.origin || !tripForm.destination) {
        alert('Please select both origin and destination locations');
        return;
      }
      endpoint = '/api/trips/taxi';
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

  const bookTrip = async (tripId, useHomeAddress = false) => {
    try {
      setLoading(true);
      const trip = trips.find(t => t.id === tripId);
      
      if (trip?.trip_type === 'personal_car') {
        // For personal car trips, create a join request
        await apiCall(`/api/trips/${tripId}/join-request`, {
          method: 'POST',
          body: JSON.stringify({
            message: 'I would like to join this trip'
          })
        });
        alert('Join request sent successfully!');
      } else {
        // For taxi trips, book directly
        const bookingData = { trip_id: tripId };
        
        if (useHomeAddress && bookingForm.home_address) {
          bookingData.home_address = bookingForm.home_address;
        } else if (bookingForm.pickup_location) {
          bookingData.pickup_location = bookingForm.pickup_location;
        }
        
        await apiCall(`/api/trips/${tripId}/book`, {
          method: 'POST',
          body: JSON.stringify(bookingData)
        });
        alert('Trip booked successfully!');
      }
      fetchTrips();
    } catch (error) {
      alert('Error: ' + error.message);
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

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-red-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Turkish Airlines Smart Car Pooling</h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trips List */}
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
                          <p><strong>Price per person:</strong> ₺{trip.price_per_person}</p>
                          {trip.distance_km > 0 && (
                            <p><strong>Distance:</strong> {formatDistance(trip.distance_km)} • {formatDuration(trip.duration_minutes)}</p>
                          )}
                          {trip.notes && <p><strong>Notes:</strong> {trip.notes}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        {trip.available_seats > 0 && !trip.is_creator && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              bookTrip(trip.id);
                            }}
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
          
          {/* Map */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Trip Map</h3>
            <TripMap
              trips={trips}
              selectedTrip={selectedTrip}
              onTripSelect={setSelectedTrip}
              userLocation={userLocation}
            />
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
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
          <form onSubmit={createTrip} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
              <LocationAutocomplete
                onPlaceSelect={(location) => setTripForm({ ...tripForm, origin: location })}
                placeholder="Select trip origin (e.g., Istanbul Airport)"
              />
              {tripForm.origin && (
                <p className="text-sm text-gray-600 mt-1">Selected: {tripForm.origin.address}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <LocationAutocomplete
                onPlaceSelect={(location) => setTripForm({ ...tripForm, destination: location })}
                placeholder="Select trip destination (e.g., City Center)"
              />
              {tripForm.destination && (
                <p className="text-sm text-gray-600 mt-1">Selected: {tripForm.destination.address}</p>
              )}
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
                      <p className="text-sm text-gray-600 mb-2">Price: ₺{trip.price_per_person}</p>
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
                      <p className="text-sm text-gray-600 mb-2">Price: ₺{trip.price_per_person}</p>
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
      
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Wallet Balance & Top-up */}
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
          
          {/* Transaction History */}
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
      <nav className="bg-red-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            Turkish Airlines - {tripType === 'taxi' ? 'Taxi Sharing' : 'Personnel Car'}
          </h1>
          <div className="flex items-center space-x-4">
            <span>Wallet: {formatCurrency(wallet.balance)}</span>
            <button
              onClick={() => setCurrentView('wallet')}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md"
            >
              💰 Wallet
            </button>
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
              onClick={() => setCurrentView('home')}
              className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md"
            >
              Home
            </button>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trips List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Available {tripType === 'taxi' ? 'Taxi' : 'Car'} Trips
              </h2>
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
                            disabled={loading || wallet.balance < trip.price_per_person}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                            title={wallet.balance < trip.price_per_person ? 'Insufficient wallet balance' : 'Book Trip'}
                          >
                            {trip.trip_type === 'personal_car' ? 'Request Join' : 'Book Trip'}
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
                        {wallet.balance < trip.price_per_person && !trip.is_creator && (
                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs">
                            Low Balance
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Map */}
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