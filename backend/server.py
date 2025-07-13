from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import os
import uuid
import hashlib
import jwt
import googlemaps
from bson import ObjectId

# Initialize FastAPI app
app = FastAPI(title="Turkish Airlines Car Pooling API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/').strip('"')
client = MongoClient(MONGO_URL)
db = client.carpooling_db

# Collections
users_collection = db.users
trips_collection = db.trips
bookings_collection = db.bookings

# JWT Secret
JWT_SECRET = "your-secret-key-here"

# Google Maps client
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')
print(f"Google Maps API Key loaded: {'Yes' if GOOGLE_MAPS_API_KEY else 'No'}")
if GOOGLE_MAPS_API_KEY:
    print(f"API Key length: {len(GOOGLE_MAPS_API_KEY)}")
    
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY) if GOOGLE_MAPS_API_KEY else None
print(f"Google Maps client initialized: {'Yes' if gmaps else 'No'}")

# Security
security = HTTPBearer()

# Pydantic models
class UserCreate(BaseModel):
    name: str
    email: str
    phone: str
    employee_id: str
    department: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    employee_id: str
    department: str

class Location(BaseModel):
    address: str
    coordinates: Dict[str, float]  # {lat: float, lng: float}
    place_id: Optional[str] = None

class TripCreate(BaseModel):
    origin: Location
    destination: Location
    departure_time: datetime
    available_seats: int = Field(default=3, le=3)
    price_per_person: float
    notes: Optional[str] = None

class Trip(BaseModel):
    id: str
    creator_id: str
    creator_name: str
    origin: Location
    destination: Location
    departure_time: datetime
    available_seats: int
    max_riders: int = 3
    price_per_person: float
    notes: Optional[str] = None
    status: str = "active"
    created_at: datetime
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    route_polyline: Optional[str] = None
    bookings: List[dict] = []

class BookingCreate(BaseModel):
    trip_id: str
    pickup_location: Optional[Location] = None

class Booking(BaseModel):
    id: str
    trip_id: str
    user_id: str
    user_name: str
    booking_time: datetime
    pickup_location: Optional[Location] = None
    additional_time_minutes: Optional[float] = None
    status: str = "confirmed"

class LocationRequest(BaseModel):
    address: str

class DistanceRequest(BaseModel):
    origins: List[str]
    destinations: List[str]

class DirectionsRequest(BaseModel):
    origin: str
    destination: str
    waypoints: Optional[List[str]] = None

class RiderMatchRequest(BaseModel):
    rider_location: str
    trip_origin: str
    trip_destination: str
    max_detour_minutes: int = 7

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user_id = payload["user_id"]
    user = users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def calculate_trip_route(origin: Location, destination: Location) -> dict:
    """Calculate route information using Google Maps"""
    if not gmaps:
        return {"distance_km": 0, "duration_minutes": 0, "route_polyline": ""}
    
    try:
        directions_result = gmaps.directions(
            origin=f"{origin.coordinates['lat']},{origin.coordinates['lng']}",
            destination=f"{destination.coordinates['lat']},{destination.coordinates['lng']}",
            mode="driving"
        )
        
        if directions_result and len(directions_result) > 0:
            route = directions_result[0]
            leg = route["legs"][0]
            
            return {
                "distance_km": leg["distance"]["value"] / 1000,  # Convert meters to km
                "duration_minutes": leg["duration"]["value"] / 60,  # Convert seconds to minutes
                "route_polyline": route["overview_polyline"]["points"]
            }
    except Exception as e:
        print(f"Error calculating route: {e}")
    
    return {"distance_km": 0, "duration_minutes": 0, "route_polyline": ""}

def check_rider_compatibility(trip_origin: Location, trip_destination: Location, rider_location: Location, max_detour_minutes: int = 7) -> dict:
    """Check if a rider location is compatible with a trip"""
    if not gmaps:
        return {"compatible": False, "reason": "Maps service not available"}
    
    try:
        # Calculate original route
        original_directions = gmaps.directions(
            origin=f"{trip_origin.coordinates['lat']},{trip_origin.coordinates['lng']}",
            destination=f"{trip_destination.coordinates['lat']},{trip_destination.coordinates['lng']}",
            mode="driving"
        )
        
        if not original_directions:
            return {"compatible": False, "reason": "Original route not found"}
        
        original_duration = original_directions[0]["legs"][0]["duration"]["value"]
        
        # Calculate detour route
        detour_directions = gmaps.directions(
            origin=f"{trip_origin.coordinates['lat']},{trip_origin.coordinates['lng']}",
            destination=f"{trip_destination.coordinates['lat']},{trip_destination.coordinates['lng']}",
            waypoints=[f"{rider_location.coordinates['lat']},{rider_location.coordinates['lng']}"],
            mode="driving"
        )
        
        if not detour_directions:
            return {"compatible": False, "reason": "Detour route not found"}
        
        detour_duration = sum(leg["duration"]["value"] for leg in detour_directions[0]["legs"])
        additional_time = (detour_duration - original_duration) / 60  # Convert to minutes
        
        compatible = additional_time <= max_detour_minutes
        
        return {
            "compatible": compatible,
            "original_duration_minutes": original_duration / 60,
            "detour_duration_minutes": detour_duration / 60,
            "additional_time_minutes": additional_time
        }
    except Exception as e:
        print(f"Error checking rider compatibility: {e}")
        return {"compatible": False, "reason": "Error calculating compatibility"}

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Turkish Airlines Car Pooling API is running"}

@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    if users_collection.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if users_collection.find_one({"employee_id": user_data.employee_id}):
        raise HTTPException(status_code=400, detail="Employee ID already registered")
    
    # Create new user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "phone": user_data.phone,
        "employee_id": user_data.employee_id,
        "department": user_data.department,
        "password": hash_password(user_data.password),
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(user)
    
    # Create JWT token
    token = create_jwt_token(user_id)
    
    return {
        "message": "User registered successfully",
        "user": User(
            id=user_id,
            name=user_data.name,
            email=user_data.email,
            phone=user_data.phone,
            employee_id=user_data.employee_id,
            department=user_data.department
        ),
        "token": token
    }

@app.post("/api/auth/login")
async def login(login_data: UserLogin):
    user = users_collection.find_one({"email": login_data.email})
    
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["id"])
    
    return {
        "message": "Login successful",
        "user": User(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            phone=user["phone"],
            employee_id=user["employee_id"],
            department=user["department"]
        ),
        "token": token
    }

@app.get("/api/user/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return User(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        phone=current_user["phone"],
        employee_id=current_user["employee_id"],
        department=current_user["department"]
    )

@app.post("/api/trips")
async def create_trip(trip_data: TripCreate, current_user: dict = Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    
    # Calculate route information
    route_info = calculate_trip_route(trip_data.origin, trip_data.destination)
    
    trip = {
        "id": trip_id,
        "creator_id": current_user["id"],
        "creator_name": current_user["name"],
        "origin": trip_data.origin.dict(),
        "destination": trip_data.destination.dict(),
        "departure_time": trip_data.departure_time,
        "available_seats": trip_data.available_seats,
        "max_riders": 3,
        "price_per_person": trip_data.price_per_person,
        "notes": trip_data.notes,
        "status": "active",
        "created_at": datetime.utcnow(),
        "distance_km": route_info.get("distance_km", 0),
        "duration_minutes": route_info.get("duration_minutes", 0),
        "route_polyline": route_info.get("route_polyline", "")
    }
    
    trips_collection.insert_one(trip)
    
    return {"message": "Trip created successfully", "trip_id": trip_id}

@app.get("/api/trips")
async def get_available_trips(current_user: dict = Depends(get_current_user)):
    trips = list(trips_collection.find({"status": "active"}))
    
    trip_list = []
    for trip in trips:
        # Get bookings for this trip
        bookings = list(bookings_collection.find({"trip_id": trip["id"], "status": "confirmed"}))
        
        # Handle both old string format and new Location format
        try:
            if isinstance(trip["origin"], str):
                # Old format - create Location object with address only
                origin = Location(address=trip["origin"], coordinates={"lat": 0, "lng": 0})
            else:
                # New format - convert dict to Location object
                origin = Location(**trip["origin"])
        except Exception as e:
            print(f"Error parsing origin: {e}")
            origin = Location(address=str(trip["origin"]), coordinates={"lat": 0, "lng": 0})
        
        try:
            if isinstance(trip["destination"], str):
                # Old format - create Location object with address only
                destination = Location(address=trip["destination"], coordinates={"lat": 0, "lng": 0})
            else:
                # New format - convert dict to Location object
                destination = Location(**trip["destination"])
        except Exception as e:
            print(f"Error parsing destination: {e}")
            destination = Location(address=str(trip["destination"]), coordinates={"lat": 0, "lng": 0})
        
        trip_data = {
            "id": trip["id"],
            "creator_id": trip["creator_id"],
            "creator_name": trip["creator_name"],
            "origin": origin,
            "destination": destination,
            "departure_time": trip["departure_time"],
            "available_seats": trip["available_seats"] - len(bookings),
            "max_riders": trip["max_riders"],
            "price_per_person": trip["price_per_person"],
            "notes": trip.get("notes", ""),
            "status": trip["status"],
            "created_at": trip["created_at"],
            "distance_km": trip.get("distance_km", 0),
            "duration_minutes": trip.get("duration_minutes", 0),
            "route_polyline": trip.get("route_polyline", ""),
            "bookings": len(bookings),
            "is_creator": trip["creator_id"] == current_user["id"]
        }
        trip_list.append(trip_data)
    
    return {"trips": trip_list}

@app.get("/api/trips/{trip_id}")
async def get_trip_details(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get bookings for this trip
    bookings = list(bookings_collection.find({"trip_id": trip_id, "status": "confirmed"}))
    booking_details = []
    
    for booking in bookings:
        user = users_collection.find_one({"id": booking["user_id"]})
        booking_info = {
            "id": booking["id"],
            "user_name": user["name"] if user else "Unknown",
            "user_phone": user["phone"] if user else "",
            "booking_time": booking["booking_time"],
            "additional_time_minutes": booking.get("additional_time_minutes", 0)
        }
        
        if "pickup_location" in booking and booking["pickup_location"]:
            booking_info["pickup_location"] = Location(**booking["pickup_location"])
        
        booking_details.append(booking_info)
    
    # Handle both old string format and new Location format
    try:
        if isinstance(trip["origin"], str):
            origin = Location(address=trip["origin"], coordinates={"lat": 0, "lng": 0})
        else:
            origin = Location(**trip["origin"])
    except Exception as e:
        print(f"Error parsing origin: {e}")
        origin = Location(address=str(trip["origin"]), coordinates={"lat": 0, "lng": 0})
    
    try:
        if isinstance(trip["destination"], str):
            destination = Location(address=trip["destination"], coordinates={"lat": 0, "lng": 0})
        else:
            destination = Location(**trip["destination"])
    except Exception as e:
        print(f"Error parsing destination: {e}")
        destination = Location(address=str(trip["destination"]), coordinates={"lat": 0, "lng": 0})
    
    trip_data = {
        "id": trip["id"],
        "creator_id": trip["creator_id"],
        "creator_name": trip["creator_name"],
        "origin": origin,
        "destination": destination,
        "departure_time": trip["departure_time"],
        "available_seats": trip["available_seats"] - len(bookings),
        "max_riders": trip["max_riders"],
        "price_per_person": trip["price_per_person"],
        "notes": trip.get("notes", ""),
        "status": trip["status"],
        "created_at": trip["created_at"],
        "distance_km": trip.get("distance_km", 0),
        "duration_minutes": trip.get("duration_minutes", 0),
        "route_polyline": trip.get("route_polyline", ""),
        "bookings": booking_details,
        "is_creator": trip["creator_id"] == current_user["id"]
    }
    
    return trip_data

@app.post("/api/trips/{trip_id}/book")
async def book_trip(trip_id: str, booking_data: BookingCreate, current_user: dict = Depends(get_current_user)):
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip["creator_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot book your own trip")
    
    # Check if user already booked this trip
    existing_booking = bookings_collection.find_one({
        "trip_id": trip_id,
        "user_id": current_user["id"],
        "status": "confirmed"
    })
    
    if existing_booking:
        raise HTTPException(status_code=400, detail="You have already booked this trip")
    
    # Check available seats
    current_bookings = bookings_collection.count_documents({
        "trip_id": trip_id,
        "status": "confirmed"
    })
    
    if current_bookings >= trip["available_seats"]:
        raise HTTPException(status_code=400, detail="No available seats")
    
    # Calculate additional time if pickup location is provided
    additional_time_minutes = 0
    if booking_data.pickup_location:
        trip_origin = Location(**trip["origin"])
        trip_destination = Location(**trip["destination"])
        compatibility = check_rider_compatibility(
            trip_origin, trip_destination, booking_data.pickup_location, max_detour_minutes=30
        )
        if not compatibility["compatible"]:
            raise HTTPException(status_code=400, detail="Pickup location adds too much detour time")
        additional_time_minutes = compatibility["additional_time_minutes"]
    
    # Create booking
    booking_id = str(uuid.uuid4())
    booking = {
        "id": booking_id,
        "trip_id": trip_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "booking_time": datetime.utcnow(),
        "additional_time_minutes": additional_time_minutes,
        "status": "confirmed"
    }
    
    if booking_data.pickup_location:
        booking["pickup_location"] = booking_data.pickup_location.dict()
    
    bookings_collection.insert_one(booking)
    
    return {"message": "Trip booked successfully", "booking_id": booking_id}

@app.get("/api/user/trips")
async def get_user_trips(current_user: dict = Depends(get_current_user)):
    # Get trips created by user
    created_trips = list(trips_collection.find({"creator_id": current_user["id"]}))
    
    # Get trips booked by user
    user_bookings = list(bookings_collection.find({"user_id": current_user["id"], "status": "confirmed"}))
    booked_trip_ids = [booking["trip_id"] for booking in user_bookings]
    booked_trips = list(trips_collection.find({"id": {"$in": booked_trip_ids}}))
    
    created_list = []
    for trip in created_trips:
        bookings = list(bookings_collection.find({"trip_id": trip["id"], "status": "confirmed"}))
        
        # Handle both old string format and new Location format
        try:
            if isinstance(trip["origin"], str):
                origin = Location(address=trip["origin"], coordinates={"lat": 0, "lng": 0})
            else:
                origin = Location(**trip["origin"])
        except Exception:
            origin = Location(address=str(trip["origin"]), coordinates={"lat": 0, "lng": 0})
        
        try:
            if isinstance(trip["destination"], str):
                destination = Location(address=trip["destination"], coordinates={"lat": 0, "lng": 0})
            else:
                destination = Location(**trip["destination"])
        except Exception:
            destination = Location(address=str(trip["destination"]), coordinates={"lat": 0, "lng": 0})
        
        created_list.append({
            "id": trip["id"],
            "origin": origin,
            "destination": destination,
            "departure_time": trip["departure_time"],
            "available_seats": trip["available_seats"] - len(bookings),
            "price_per_person": trip["price_per_person"],
            "status": trip["status"],
            "distance_km": trip.get("distance_km", 0),
            "duration_minutes": trip.get("duration_minutes", 0),
            "bookings": len(bookings),
            "type": "created"
        })
    
    booked_list = []
    for trip in booked_trips:
        bookings = list(bookings_collection.find({"trip_id": trip["id"], "status": "confirmed"}))
        
        # Handle both old string format and new Location format
        try:
            if isinstance(trip["origin"], str):
                origin = Location(address=trip["origin"], coordinates={"lat": 0, "lng": 0})
            else:
                origin = Location(**trip["origin"])
        except Exception:
            origin = Location(address=str(trip["origin"]), coordinates={"lat": 0, "lng": 0})
        
        try:
            if isinstance(trip["destination"], str):
                destination = Location(address=trip["destination"], coordinates={"lat": 0, "lng": 0})
            else:
                destination = Location(**trip["destination"])
        except Exception:
            destination = Location(address=str(trip["destination"]), coordinates={"lat": 0, "lng": 0})
        
        booked_list.append({
            "id": trip["id"],
            "creator_name": trip["creator_name"],
            "origin": origin,
            "destination": destination,
            "departure_time": trip["departure_time"],
            "price_per_person": trip["price_per_person"],
            "status": trip["status"],
            "distance_km": trip.get("distance_km", 0),
            "duration_minutes": trip.get("duration_minutes", 0),
            "bookings": len(bookings),
            "type": "booked"
        })
    
    return {
        "created_trips": created_list,
        "booked_trips": booked_list
    }

@app.delete("/api/trips/{trip_id}")
async def cancel_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this trip")
    
    # Update trip status
    trips_collection.update_one({"id": trip_id}, {"$set": {"status": "cancelled"}})
    
    # Update all bookings for this trip
    bookings_collection.update_many(
        {"trip_id": trip_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Trip cancelled successfully"}

# Google Maps API endpoints
@app.post("/api/maps/geocode")
async def geocode_location(request: LocationRequest):
    """Convert address to coordinates"""
    if not gmaps:
        raise HTTPException(status_code=500, detail="Maps service not available")
    
    try:
        result = gmaps.geocode(request.address)
        if result:
            location = result[0]
            return {
                "address": location["formatted_address"],
                "coordinates": location["geometry"]["location"],
                "place_id": location["place_id"]
            }
        else:
            raise HTTPException(status_code=404, detail="Address not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding failed: {str(e)}")

@app.post("/api/maps/distance-matrix")
async def calculate_distances(request: DistanceRequest):
    """Calculate distances between multiple points"""
    if not gmaps:
        raise HTTPException(status_code=500, detail="Maps service not available")
    
    try:
        result = gmaps.distance_matrix(
            origins=request.origins,
            destinations=request.destinations,
            mode="driving",
            units="metric"
        )
        
        distances = []
        for i, origin in enumerate(result["origin_addresses"]):
            for j, destination in enumerate(result["destination_addresses"]):
                element = result["rows"][i]["elements"][j]
                if element["status"] == "OK":
                    distances.append({
                        "origin": origin,
                        "destination": destination,
                        "distance": element["distance"]["text"],
                        "distance_value": element["distance"]["value"],
                        "duration": element["duration"]["text"],
                        "duration_value": element["duration"]["value"]
                    })
        
        return {"distances": distances}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distance calculation failed: {str(e)}")

@app.post("/api/maps/directions")
async def get_directions(request: DirectionsRequest):
    """Get directions between two points"""
    if not gmaps:
        raise HTTPException(status_code=500, detail="Maps service not available")
    
    try:
        result = gmaps.directions(
            origin=request.origin,
            destination=request.destination,
            waypoints=request.waypoints,
            mode="driving"
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="No route found")
        
        route = result[0]
        return {
            "summary": route["summary"],
            "distance": route["legs"][0]["distance"]["text"],
            "duration": route["legs"][0]["duration"]["text"],
            "start_address": route["legs"][0]["start_address"],
            "end_address": route["legs"][0]["end_address"],
            "polyline": route["overview_polyline"]["points"],
            "steps": [
                {
                    "instruction": step["html_instructions"],
                    "distance": step["distance"]["text"],
                    "duration": step["duration"]["text"]
                }
                for step in route["legs"][0]["steps"]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Directions failed: {str(e)}")

@app.post("/api/maps/rider-matching")
async def find_compatible_riders(request: RiderMatchRequest):
    """Find riders within acceptable detour distance"""
    if not gmaps:
        raise HTTPException(status_code=500, detail="Maps service not available")
    
    try:
        # Calculate original trip distance and duration
        original_directions = gmaps.directions(
            origin=request.trip_origin,
            destination=request.trip_destination,
            mode="driving"
        )
        
        if not original_directions:
            raise HTTPException(status_code=404, detail="Original route not found")
        
        original_duration = original_directions[0]["legs"][0]["duration"]["value"]
        
        # Calculate detour route
        detour_directions = gmaps.directions(
            origin=request.trip_origin,
            destination=request.trip_destination,
            waypoints=[request.rider_location],
            mode="driving"
        )
        
        if not detour_directions:
            return {"compatible": False, "reason": "No detour route found"}
        
        detour_duration = sum(leg["duration"]["value"] for leg in detour_directions[0]["legs"])
        additional_time = (detour_duration - original_duration) / 60  # Convert to minutes
        
        compatible = additional_time <= request.max_detour_minutes
        
        return {
            "compatible": compatible,
            "original_duration_minutes": original_duration / 60,
            "detour_duration_minutes": detour_duration / 60,
            "additional_time_minutes": additional_time,
            "detour_route": {
                "polyline": detour_directions[0]["overview_polyline"]["points"],
                "distance": sum(leg["distance"]["value"] for leg in detour_directions[0]["legs"]),
                "duration": detour_duration
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rider matching failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)