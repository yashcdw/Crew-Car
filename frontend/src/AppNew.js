import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
  Autocomplete
} from '@react-google-maps/api';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 41.0082, // Istanbul coordinates
  lng: 28.9784
};

// Location Autocomplete Component
const LocationAutocomplete = ({ onPlaceSelect, placeholder = "Enter location", value = "" }) => {
  const [autocomplete, setAutocomplete] = useState(null);
  const inputRef = useRef(null);

  const onLoad = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const location = {
          address: place.formatted_address,
          coordinates: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          },
          place_id: place.place_id
        };
        onPlaceSelect(location);
      }
    }
  };

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        defaultValue={value}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </Autocomplete>
  );
};

// Map Component with Live Tracking
const TripMap = ({ trips, selectedTrip, onTripSelect, userLocation, liveLocations = [] }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });

  const [map, setMap] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);

  const onLoad = useCallback((map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  useEffect(() => {
    if (selectedTrip && selectedTrip.route_polyline && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route({
        origin: new window.google.maps.LatLng(
          selectedTrip.origin.coordinates.lat,
          selectedTrip.origin.coordinates.lng
        ),
        destination: new window.google.maps.LatLng(
          selectedTrip.destination.coordinates.lat,
          selectedTrip.destination.coordinates.lng
        ),
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirectionsResponse(result);
        }
      });
    } else {
      setDirectionsResponse(null);
    }
  }, [selectedTrip]);

  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={10}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {userLocation && (
        <Marker
          position={userLocation}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new window.google.maps.Size(40, 40)
          }}
          title="Your Location"
        />
      )}
      
      {trips.map((trip) => (
        <Marker
          key={trip.id}
          position={trip.origin.coordinates}
          onClick={() => onTripSelect(trip)}
          icon={{
            url: trip.trip_type === 'personal_car' 
              ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
              : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new window.google.maps.Size(35, 35)
          }}
          title={`${trip.origin.address} → ${trip.destination.address}`}
        />
      ))}
      
      {/* Live tracking markers */}
      {liveLocations.map((location) => (
        <Marker
          key={location.user_id}
          position={{ lat: location.latitude, lng: location.longitude }}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
            scaledSize: new window.google.maps.Size(30, 30)
          }}
          title={`${location.user_name} (Live)`}
        />
      ))}
      
      {directionsResponse && (
        <DirectionsRenderer 
          directions={directionsResponse}
          options={{
            polylineOptions: {
              strokeColor: '#dc2626',
              strokeWeight: 4
            }
          }}
        />
      )}
    </GoogleMap>
  );
};

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

  useEffect(() => {
    if (token) {
      fetchUserProfile();
      setCurrentView('home');
    }
  }, [token]);

  useEffect(() => {
    if (currentView === 'dashboard') {
      fetchTrips();
    }
    if (currentView === 'my-trips') {
      fetchUserTrips();
    }
  }, [currentView, tripType]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (user && token) {
      const wsUrl = API_URL.replace('http', 'ws').replace('https', 'wss');
      const newSocket = new WebSocket(`${wsUrl}/ws/${user.id}`);

      newSocket.onopen = () => {
        console.log('Connected to WebSocket');
      };

      newSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chat_message') {
          setMessages(prev => [...prev, data.message]);
        } else if (data.type === 'location_update') {
          setLiveLocations(prev => {
            const updated = prev.filter(loc => loc.user_id !== data.user_id);
            return [...updated, data];
          });
        } else if (data.type === 'join_request' || data.type === 'trip_booking') {
          alert(data.message);
        }
      };

      newSocket.onclose = () => {
        console.log('WebSocket disconnected');
      };

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user, token]);

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

  const sendWebSocketMessage = (messageData) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(messageData));
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
      const data = await apiCall(`/api/trips?trip_type=${tripType}`);
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

  const fetchTripMessages = async (tripId) => {
    try {
      const data = await apiCall(`/api/trips/${tripId}/messages`);
      setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
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
      setCurrentView('home');
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
      setCurrentView('home');
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
    if (socket) {
      socket.close();
      setSocket(null);
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

  const initiateCall = async (userId) => {
    try {
      const data = await apiCall('/api/calls/initiate', {
        method: 'POST',
        body: JSON.stringify({
          to_user_id: userId,
          trip_id: selectedTrip?.id
        })
      });
      alert('Call initiated successfully!');
    } catch (error) {
      alert('Error initiating call: ' + error.message);
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

  // Render functions will be added in the next part due to size constraints
  // ... (login, register, home, dashboard, create-trip, my-trips renders)

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

  // Return based on current view
  if (currentView === 'home') return renderHome();
  
  // Other render functions would be implemented similarly
  return <div>App is loading...</div>;
}

export default App;