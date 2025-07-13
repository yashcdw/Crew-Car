from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Union
from datetime import datetime, timedelta
import os
import uuid
import hashlib
import jwt
import googlemaps
import json
import asyncio
from twilio.rest import Client as TwilioClient
from dotenv import load_dotenv
import redis
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Load environment variables from .env file
load_dotenv()

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
personal_car_trips_collection = db.personal_car_trips
bookings_collection = db.bookings
join_requests_collection = db.join_requests
messages_collection = db.messages
live_tracking_collection = db.live_tracking
bus_stops_collection = db.bus_stops
payment_transactions_collection = db.payment_transactions
wallet_collection = db.wallet

# JWT Secret
JWT_SECRET = "your-secret-key-here"

# Google Maps client
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')
print(f"Google Maps API Key loaded: {'Yes' if GOOGLE_MAPS_API_KEY else 'No'}")
if GOOGLE_MAPS_API_KEY:
    print(f"API Key length: {len(GOOGLE_MAPS_API_KEY)}")
    
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY) if GOOGLE_MAPS_API_KEY else None
print(f"Google Maps client initialized: {'Yes' if gmaps else 'No'}")

# Twilio client
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None

# Stripe client
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY) if STRIPE_API_KEY else None
print(f"Stripe integration initialized: {'Yes' if stripe_checkout else 'No'}")

# Wallet top-up packages (server-side defined for security)
WALLET_PACKAGES = {
    "small": {"amount": 10.0, "currency": "try", "name": "Small Top-up"},
    "medium": {"amount": 25.0, "currency": "try", "name": "Medium Top-up"},
    "large": {"amount": 50.0, "currency": "try", "name": "Large Top-up"},
    "jumbo": {"amount": 100.0, "currency": "try", "name": "Jumbo Top-up"}
}

# Redis client for real-time features
try:
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    redis_client.ping()
    print("Redis client initialized: Yes")
except:
    redis_client = None
    print("Redis client initialized: No")

# Security
security = HTTPBearer()

# Helper function for WebSocket
async def get_trip_participants(trip_id: str) -> List[str]:
    """Get all user IDs participating in a trip (creator + riders)"""
    trip = await trips_collection.find_one({"id": trip_id})
    if not trip:
        return []
    
    # Add trip creator
    participants = [trip["creator_id"]]
    
    # Add all confirmed riders
    bookings = await bookings_collection.find({"trip_id": trip_id, "status": "confirmed"}).to_list(length=None)
    participants.extend([booking["user_id"] for booking in bookings])
    
    return list(set(participants))  # Remove duplicates

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, str] = {}  # user_id -> connection_id

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        connection_id = str(uuid.uuid4())
        self.active_connections[connection_id] = websocket
        self.user_connections[user_id] = connection_id
        return connection_id

    def disconnect(self, connection_id: str, user_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if user_id in self.user_connections:
            del self.user_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.user_connections:
            connection_id = self.user_connections[user_id]
            if connection_id in self.active_connections:
                websocket = self.active_connections[connection_id]
                try:
                    await websocket.send_text(message)
                except:
                    # Connection might be closed, clean up
                    self.disconnect(connection_id, user_id)

    async def broadcast_to_trip(self, message: str, trip_id: str):
        # Get all users in this trip
        trip_users = await get_trip_participants(trip_id)
        for user_id in trip_users:
            await self.send_personal_message(message, user_id)

manager = ConnectionManager()

# Pydantic models
class Location(BaseModel):
    address: str
    coordinates: Dict[str, float]  # {lat: float, lng: float}
    place_id: Optional[str] = None

class UserCreate(BaseModel):
    name: str
    email: str
    phone: str
    employee_id: str
    department: str
    password: str
    home_address: Optional[Location] = None

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
    home_address: Optional[Location] = None
    address: str
    coordinates: Dict[str, float]  # {lat: float, lng: float}
    place_id: Optional[str] = None

class BusStop(BaseModel):
    id: str
    name: str
    location: Location
    description: Optional[str] = None

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
    pickup_bus_stop_id: Optional[str] = None
    home_address: Optional[Location] = None  # New field for home pickup
    payment_method: str = "wallet"  # "wallet" or "stripe"

class Booking(BaseModel):
    id: str
    trip_id: str
    user_id: str
    user_name: str
    booking_time: datetime
    pickup_location: Optional[Location] = None
    pickup_bus_stop: Optional[BusStop] = None
    home_address: Optional[Location] = None  # New field for home pickup
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

class PersonalCarTripCreate(BaseModel):
    origin: Location
    destination: Location
    departure_time: datetime
    available_seats: int = Field(default=3, le=3)
    price_per_person: float
    notes: Optional[str] = None
    car_model: str
    car_color: str
    license_plate: str

class JoinRequestCreate(BaseModel):
    pickup_bus_stop_id: Optional[str] = None
    message: Optional[str] = None

class CallRequest(BaseModel):
    to_user_id: str
    trip_id: Optional[str] = None

class WalletTopupRequest(BaseModel):
    package_id: str
    origin_url: str

class WalletPaymentRequest(BaseModel):
    amount: float
    description: str
    recipient_user_id: Optional[str] = None

class WalletTransaction(BaseModel):
    id: str
    user_id: str
    transaction_type: str  # "topup", "payment", "refund"
    amount: float
    currency: str
    description: str
    status: str  # "pending", "completed", "failed"
    created_at: datetime
    payment_session_id: Optional[str] = None

class Wallet(BaseModel):
    user_id: str
    balance: float
    currency: str
    last_updated: datetime

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

def get_or_create_wallet(user_id: str) -> dict:
    """Get or create wallet for a user"""
    wallet = wallet_collection.find_one({"user_id": user_id})
    if not wallet:
        wallet = {
            "user_id": user_id,
            "balance": 0.0,
            "currency": "try",
            "last_updated": datetime.utcnow()
        }
        wallet_collection.insert_one(wallet)
    return wallet

def update_wallet_balance(user_id: str, amount: float, transaction_type: str = "topup") -> dict:
    """Update wallet balance and return updated wallet"""
    wallet = get_or_create_wallet(user_id)
    
    if transaction_type == "payment" and wallet["balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    new_balance = wallet["balance"] + amount if transaction_type == "topup" else wallet["balance"] - amount
    
    wallet_collection.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "balance": new_balance,
                "last_updated": datetime.utcnow()
            }
        }
    )
    
    wallet["balance"] = new_balance
    wallet["last_updated"] = datetime.utcnow()
    return wallet

def create_wallet_transaction(user_id: str, transaction_type: str, amount: float, description: str, 
                             payment_session_id: str = None, status: str = "pending") -> str:
    """Create a wallet transaction record"""
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "user_id": user_id,
        "transaction_type": transaction_type,
        "amount": amount,
        "currency": "try",
        "description": description,
        "status": status,
        "created_at": datetime.utcnow(),
        "payment_session_id": payment_session_id
    }
    
    payment_transactions_collection.insert_one(transaction)
    return transaction_id

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
# Wallet endpoints
@app.get("/api/wallet")
async def get_wallet(current_user: dict = Depends(get_current_user)):
    """Get user's wallet balance"""
    wallet = get_or_create_wallet(current_user["id"])
    return {
        "user_id": wallet["user_id"],
        "balance": wallet["balance"],
        "currency": wallet["currency"],
        "last_updated": wallet["last_updated"]
    }

@app.get("/api/wallet/packages")
async def get_wallet_packages():
    """Get available wallet top-up packages"""
    return {"packages": WALLET_PACKAGES}

@app.post("/api/wallet/topup")
async def create_wallet_topup(request: WalletTopupRequest, current_user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for wallet top-up"""
    if not stripe_checkout:
        raise HTTPException(status_code=500, detail="Payment service not available")
    
    # Validate package
    if request.package_id not in WALLET_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = WALLET_PACKAGES[request.package_id]
    amount = package["amount"]
    currency = package["currency"]
    
    # Build success and cancel URLs
    success_url = f"{request.origin_url}/wallet/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/wallet"
    
    try:
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency=currency,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user["id"],
                "package_id": request.package_id,
                "transaction_type": "wallet_topup"
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create transaction record
        transaction_id = create_wallet_transaction(
            user_id=current_user["id"],
            transaction_type="topup",
            amount=amount,
            description=f"Wallet top-up - {package['name']}",
            payment_session_id=session.session_id,
            status="pending"
        )
        
        return {
            "url": session.url,
            "session_id": session.session_id,
            "transaction_id": transaction_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@app.get("/api/wallet/payment/status/{session_id}")
async def get_wallet_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get the status of a wallet payment session"""
    if not stripe_checkout:
        raise HTTPException(status_code=500, detail="Payment service not available")
    
    try:
        # Check transaction exists for this user
        transaction = payment_transactions_collection.find_one({
            "payment_session_id": session_id,
            "user_id": current_user["id"]
        })
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # If already processed, return stored status
        if transaction["status"] in ["completed", "failed"]:
            return {
                "status": transaction["status"],
                "payment_status": "paid" if transaction["status"] == "completed" else "failed",
                "amount_total": int(transaction["amount"] * 100),  # Convert to cents
                "currency": transaction["currency"]
            }
        
        # Get status from Stripe
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        if checkout_status.payment_status == "paid" and transaction["status"] != "completed":
            # Update wallet balance
            update_wallet_balance(current_user["id"], transaction["amount"], "topup")
            
            # Update transaction status
            payment_transactions_collection.update_one(
                {"payment_session_id": session_id},
                {"$set": {"status": "completed"}}
            )
            
        elif checkout_status.status == "expired":
            payment_transactions_collection.update_one(
                {"payment_session_id": session_id},
                {"$set": {"status": "failed"}}
            )
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")

@app.get("/api/wallet/transactions")
async def get_wallet_transactions(current_user: dict = Depends(get_current_user)):
    """Get user's wallet transaction history"""
    transactions = list(payment_transactions_collection.find({"user_id": current_user["id"]}).sort("created_at", -1))
    
    transaction_list = []
    for transaction in transactions:
        transaction_list.append({
            "id": transaction["id"],
            "transaction_type": transaction["transaction_type"],
            "amount": transaction["amount"],
            "currency": transaction["currency"],
            "description": transaction["description"],
            "status": transaction["status"],
            "created_at": transaction["created_at"]
        })
    
    return {"transactions": transaction_list}

@app.post("/api/wallet/pay")
async def pay_with_wallet(request: WalletPaymentRequest, current_user: dict = Depends(get_current_user)):
    """Make a payment using wallet balance"""
    wallet = get_or_create_wallet(current_user["id"])
    
    if wallet["balance"] < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    try:
        # Update wallet balance
        update_wallet_balance(current_user["id"], request.amount, "payment")
        
        # Create transaction record
        transaction_id = create_wallet_transaction(
            user_id=current_user["id"],
            transaction_type="payment",
            amount=request.amount,
            description=request.description,
            status="completed"
        )
        
        return {
            "message": "Payment successful",
            "transaction_id": transaction_id,
            "remaining_balance": wallet["balance"] - request.amount
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment failed: {str(e)}")

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    connection_id = await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle different types of real-time messages
            if message_data["type"] == "location_update":
                # Store live location
                location_update = {
                    "trip_id": message_data["trip_id"],
                    "user_id": user_id,
                    "latitude": message_data["latitude"],
                    "longitude": message_data["longitude"],
                    "heading": message_data.get("heading"),
                    "speed": message_data.get("speed"),
                    "timestamp": datetime.utcnow()
                }
                live_tracking_collection.replace_one(
                    {"trip_id": message_data["trip_id"], "user_id": user_id},
                    location_update,
                    upsert=True
                )
                
                # Broadcast to trip participants
                await manager.broadcast_to_trip(
                    json.dumps({
                        "type": "location_update",
                        "user_id": user_id,
                        "latitude": message_data["latitude"],
                        "longitude": message_data["longitude"],
                        "heading": message_data.get("heading"),
                        "speed": message_data.get("speed")
                    }),
                    message_data["trip_id"]
                )
            
            elif message_data["type"] == "chat_message":
                # Handle chat messages
                user = users_collection.find_one({"id": user_id})
                message = {
                    "id": str(uuid.uuid4()),
                    "trip_id": message_data["trip_id"],
                    "sender_id": user_id,
                    "sender_name": user["name"] if user else "Unknown",
                    "content": message_data["content"],
                    "message_type": message_data.get("message_type", "text"),
                    "timestamp": datetime.utcnow()
                }
                messages_collection.insert_one(message)
                
                # Broadcast to trip participants
                await manager.broadcast_to_trip(
                    json.dumps({
                        "type": "chat_message",
                        "message": {
                            "id": message["id"],
                            "sender_id": user_id,
                            "sender_name": message["sender_name"],
                            "content": message["content"],
                            "message_type": message["message_type"],
                            "timestamp": message["timestamp"].isoformat()
                        }
                    }),
                    message_data["trip_id"]
                )
    
    except WebSocketDisconnect:
        manager.disconnect(connection_id, user_id)

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
    
    # Initialize wallet with 0 balance
    get_or_create_wallet(user_id)
    
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

def find_nearest_bus_stops(location: Location, max_distance_km: float = 2.0) -> List[BusStop]:
    """Find bus stops within specified distance of a location"""
    if not gmaps:
        return []
    
    try:
        # Get all bus stops from database
        all_bus_stops = list(bus_stops_collection.find())
        nearby_stops = []
        
        for stop in all_bus_stops:
            # Calculate distance between location and bus stop
            result = gmaps.distance_matrix(
                origins=[f"{location.coordinates['lat']},{location.coordinates['lng']}"],
                destinations=[f"{stop['location']['coordinates']['lat']},{stop['location']['coordinates']['lng']}"],
                mode="walking",
                units="metric"
            )
            
            if result["rows"][0]["elements"][0]["status"] == "OK":
                distance_km = result["rows"][0]["elements"][0]["distance"]["value"] / 1000
                if distance_km <= max_distance_km:
                    stop_obj = BusStop(
                        id=stop["id"],
                        name=stop["name"],
                        location=Location(**stop["location"]),
                        description=stop.get("description")
                    )
                    nearby_stops.append((distance_km, stop_obj))
        
        # Sort by distance and return bus stop objects
        nearby_stops.sort(key=lambda x: x[0])
        return [stop for _, stop in nearby_stops]
    except Exception as e:
        print(f"Error finding nearest bus stops: {e}")
        return []

@app.get("/api/trips")
async def get_available_trips(trip_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get available trips - both taxi and personal car"""
    all_trips = []
    
    # Get taxi trips
    if not trip_type or trip_type == "taxi":
        taxi_trips = list(trips_collection.find({"status": "active"}))
        for trip in taxi_trips:
            trip["trip_type"] = "taxi"
        all_trips.extend(taxi_trips)
    
    # Get personal car trips
    if not trip_type or trip_type == "personal_car":
        personal_trips = list(personal_car_trips_collection.find({"status": "active"}))
        for trip in personal_trips:
            trip["trip_type"] = "personal_car"
        all_trips.extend(personal_trips)
    
    trip_list = []
    for trip in all_trips:
        # Get bookings/requests for this trip
        if trip["trip_type"] == "taxi":
            bookings = list(bookings_collection.find({"trip_id": trip["id"], "status": "confirmed"}))
            current_riders = len(bookings)
        else:
            join_requests = list(join_requests_collection.find({"trip_id": trip["id"], "status": "approved"}))
            current_riders = len(join_requests)
        
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
            "trip_type": trip["trip_type"],
            "origin": origin,
            "destination": destination,
            "departure_time": trip["departure_time"],
            "available_seats": trip["available_seats"] - current_riders,
            "max_riders": trip.get("max_riders", 3),
            "price_per_person": trip["price_per_person"],
            "notes": trip.get("notes", ""),
            "status": trip["status"],
            "created_at": trip["created_at"],
            "distance_km": trip.get("distance_km", 0),
            "duration_minutes": trip.get("duration_minutes", 0),
            "route_polyline": trip.get("route_polyline", ""),
            "current_riders": current_riders,
            "is_creator": trip["creator_id"] == current_user["id"],
            # Personal car specific fields
            "car_model": trip.get("car_model"),
            "car_color": trip.get("car_color"),
            "license_plate": trip.get("license_plate"),
            "nearest_bus_stop": trip.get("nearest_bus_stop")
        }
        trip_list.append(trip_data)
    
    # Sort by departure time
    trip_list.sort(key=lambda x: x["departure_time"])
    
    return {"trips": trip_list}

# Personal car trips (new functionality)
@app.post("/api/trips/personal-car")
async def create_personal_car_trip(trip_data: PersonalCarTripCreate, current_user: dict = Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    
    # Calculate route information
    route_info = calculate_trip_route(trip_data.origin, trip_data.destination)
    
    # Find nearest bus stops to origin
    nearest_bus_stops = find_nearest_bus_stops(trip_data.origin)
    nearest_bus_stop = nearest_bus_stops[0] if nearest_bus_stops else None
    
    trip = {
        "id": trip_id,
        "creator_id": current_user["id"],
        "creator_name": current_user["name"],
        "trip_type": "personal_car",
        "origin": trip_data.origin.dict(),
        "destination": trip_data.destination.dict(),
        "departure_time": trip_data.departure_time,
        "available_seats": trip_data.available_seats,
        "max_riders": trip_data.available_seats,
        "price_per_person": trip_data.price_per_person,
        "notes": trip_data.notes,
        "status": "active",
        "created_at": datetime.utcnow(),
        "distance_km": route_info.get("distance_km", 0),
        "duration_minutes": route_info.get("duration_minutes", 0),
        "route_polyline": route_info.get("route_polyline", ""),
        # Personal car specific fields
        "car_model": trip_data.car_model,
        "car_color": trip_data.car_color,
        "license_plate": trip_data.license_plate,
        "nearest_bus_stop": nearest_bus_stop.dict() if nearest_bus_stop else None
    }
    
    personal_car_trips_collection.insert_one(trip)
    
    return {"message": "Personal car trip created successfully", "trip_id": trip_id}

@app.post("/api/trips/{trip_id}/join-request")
async def create_join_request(trip_id: str, request_data: JoinRequestCreate, current_user: dict = Depends(get_current_user)):
    """Create a join request for personal car trips"""
    trip = personal_car_trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip["creator_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot request to join your own trip")
    
    # Check if user already has a pending or approved request
    existing_request = join_requests_collection.find_one({
        "trip_id": trip_id,
        "requester_id": current_user["id"],
        "status": {"$in": ["pending", "approved"]}
    })
    
    if existing_request:
        raise HTTPException(status_code=400, detail="You already have a request for this trip")
    
    # Get bus stop if specified
    pickup_bus_stop = None
    if request_data.pickup_bus_stop_id:
        bus_stop_data = bus_stops_collection.find_one({"id": request_data.pickup_bus_stop_id})
        if bus_stop_data:
            pickup_bus_stop = BusStop(**bus_stop_data)
    
    # Create join request
    request_id = str(uuid.uuid4())
    join_request = {
        "id": request_id,
        "trip_id": trip_id,
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "pickup_bus_stop": pickup_bus_stop.dict() if pickup_bus_stop else None,
        "message": request_data.message,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    join_requests_collection.insert_one(join_request)
    
    # Send real-time notification to trip creator
    await manager.send_personal_message(
        json.dumps({
            "type": "join_request",
            "trip_id": trip_id,
            "requester_name": current_user["name"],
            "message": f"'{current_user['name']}' is requesting to tag along",
            "request_id": request_id
        }),
        trip["creator_id"]
    )
    
    return {"message": "Join request sent successfully", "request_id": request_id}

@app.post("/api/join-requests/{request_id}/respond")
async def respond_to_join_request(request_id: str, action: str, current_user: dict = Depends(get_current_user)):
    """Approve or reject a join request"""
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    join_request = join_requests_collection.find_one({"id": request_id})
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")
    
    # Verify the current user is the trip creator
    trip = personal_car_trips_collection.find_one({"id": join_request["trip_id"]})
    if not trip or trip["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this request")
    
    # Update request status
    new_status = "approved" if action == "approve" else "rejected"
    join_requests_collection.update_one(
        {"id": request_id},
        {"$set": {"status": new_status, "responded_at": datetime.utcnow()}}
    )
    
    # Send notification to requester
    await manager.send_personal_message(
        json.dumps({
            "type": "join_request_response",
            "trip_id": join_request["trip_id"],
            "status": new_status,
            "message": f"Your request to join the trip has been {new_status}"
        }),
        join_request["requester_id"]
    )
    
@app.get("/api/trips/{trip_id}/messages")
async def get_trip_messages(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat messages for a trip"""
    # Verify user is part of this trip
    participants = await get_trip_participants(trip_id)
    if current_user["id"] not in participants:
        raise HTTPException(status_code=403, detail="Not authorized to view messages for this trip")
    
    messages = list(messages_collection.find({"trip_id": trip_id}).sort("timestamp", 1))
    
    message_list = []
    for msg in messages:
        message_list.append({
            "id": msg["id"],
            "sender_id": msg["sender_id"],
            "sender_name": msg["sender_name"],
            "content": msg["content"],
            "message_type": msg["message_type"],
            "timestamp": msg["timestamp"]
        })
    
    return {"messages": message_list}

@app.get("/api/trips/{trip_id}/live-tracking")
async def get_live_tracking(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Get live tracking data for a trip"""
    # Verify user is part of this trip
    participants = await get_trip_participants(trip_id)
    if current_user["id"] not in participants:
        raise HTTPException(status_code=403, detail="Not authorized to view tracking for this trip")
    
    tracking_data = list(live_tracking_collection.find({"trip_id": trip_id}))
    
    locations = []
    for location in tracking_data:
        user = users_collection.find_one({"id": location["user_id"]})
        locations.append({
            "user_id": location["user_id"],
            "user_name": user["name"] if user else "Unknown",
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "heading": location.get("heading"),
            "speed": location.get("speed"),
            "timestamp": location["timestamp"]
        })
    
    return {"locations": locations}

@app.post("/api/calls/initiate")
async def initiate_call(call_request: CallRequest, current_user: dict = Depends(get_current_user)):
    """Initiate a voice call using Twilio"""
    if not twilio_client:
        raise HTTPException(status_code=500, detail="Calling service not available")
    
    # Get the target user's phone number
    target_user = users_collection.find_one({"id": call_request.to_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Create a conference call
        conference_name = f"trip_{call_request.trip_id}_{uuid.uuid4().hex[:8]}" if call_request.trip_id else f"call_{uuid.uuid4().hex[:8]}"
        
        # Call the initiator first
        call1 = twilio_client.calls.create(
            to=current_user["phone"],
            from_=TWILIO_PHONE_NUMBER,
            url=f"http://demo.twilio.com/docs/voice.xml"  # Replace with your TwiML URL
        )
        
        # Call the target user
        call2 = twilio_client.calls.create(
            to=target_user["phone"],
            from_=TWILIO_PHONE_NUMBER,
            url=f"http://demo.twilio.com/docs/voice.xml"  # Replace with your TwiML URL
        )
        
        return {
            "message": "Call initiated successfully",
            "conference_name": conference_name,
            "call_sid_1": call1.sid,
            "call_sid_2": call2.sid
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")

@app.get("/api/bus-stops/nearby")
async def get_nearby_bus_stops(lat: float, lng: float, radius_km: float = 2):
    """Get nearby bus stops"""
    location = Location(
        address="",
        coordinates={"lat": lat, "lng": lng}
    )
    
    bus_stops = find_nearest_bus_stops(location, radius_km)
    return {"bus_stops": [stop.dict() for stop in bus_stops]}

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
    # Check both taxi trips and personal car trips
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        # Check personal car trips collection
        trip = personal_car_trips_collection.find_one({"id": trip_id})
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
    
    # Determine trip type and validate payment method
    trip_type = trip.get("trip_type", "taxi")  # Default to taxi for legacy trips
    trip_cost = trip["price_per_person"]
    
    # Validate payment method based on trip type
    if trip_type == "personal_car":
        # Personal car trips only accept wallet payments
        if booking_data.payment_method != "wallet":
            raise HTTPException(status_code=400, detail="Personal car trips only accept wallet payments")
        
        # Check wallet balance and deduct payment
        wallet = get_or_create_wallet(current_user["id"])
        if wallet["balance"] < trip_cost:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        
        # Deduct amount from wallet
        update_wallet_balance(current_user["id"], trip_cost, "payment")
        
        # Create payment transaction
        create_wallet_transaction(
            user_id=current_user["id"],
            transaction_type="payment",
            amount=trip_cost,
            description=f"Personal car trip booking - {trip['origin']['address']} to {trip['destination']['address']}",
            status="completed"
        )
        
        # Credit to trip creator's wallet
        update_wallet_balance(trip["creator_id"], trip_cost, "topup")
        create_wallet_transaction(
            user_id=trip["creator_id"],
            transaction_type="topup",
            amount=trip_cost,
            description=f"Personal car trip payment received - {trip['origin']['address']} to {trip['destination']['address']}",
            status="completed"
        )
        
    elif trip_type == "taxi":
        # Taxi trips accept cash, card, or wallet payments
        if booking_data.payment_method not in ["cash", "card", "wallet"]:
            raise HTTPException(status_code=400, detail="Invalid payment method. Taxi trips accept: cash, card, or wallet")
        
        if booking_data.payment_method == "wallet":
            # Check wallet balance and deduct payment
            wallet = get_or_create_wallet(current_user["id"])
            if wallet["balance"] < trip_cost:
                raise HTTPException(status_code=400, detail="Insufficient wallet balance")
            
            # Deduct amount from wallet
            update_wallet_balance(current_user["id"], trip_cost, "payment")
            
            # Create payment transaction
            create_wallet_transaction(
                user_id=current_user["id"],
                transaction_type="payment",
                amount=trip_cost,
                description=f"Taxi trip booking - {trip['origin']['address']} to {trip['destination']['address']}",
                status="completed"
            )
            
            # Credit to trip creator's wallet
            update_wallet_balance(trip["creator_id"], trip_cost, "topup")
            create_wallet_transaction(
                user_id=trip["creator_id"],
                transaction_type="topup",
                amount=trip_cost,
                description=f"Taxi trip payment received - {trip['origin']['address']} to {trip['destination']['address']}",
                status="completed"
            )
        # For cash and card payments, no immediate wallet transaction is needed
        # The transaction will be handled outside the app (cash on ride, card payment through taxi terminal)
    
    # Calculate additional time for rider pickup
    additional_time = 0
    pickup_location = None
    pickup_bus_stop = None
    
    if booking_data.pickup_location:
        pickup_location = booking_data.pickup_location
        try:
            origin_location = Location(**trip["origin"])
            compatibility = check_rider_compatibility(
                origin_location, 
                Location(**trip["destination"]), 
                pickup_location
            )
            additional_time = compatibility.get("additional_time_minutes", 0)
        except Exception as e:
            print(f"Error calculating pickup time: {e}")
    
    if booking_data.pickup_bus_stop_id:
        bus_stop_data = bus_stops_collection.find_one({"id": booking_data.pickup_bus_stop_id})
        if bus_stop_data:
            pickup_bus_stop = BusStop(**bus_stop_data)
    
    # Create booking
    booking_id = str(uuid.uuid4())
    booking = {
        "id": booking_id,
        "trip_id": trip_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "booking_time": datetime.utcnow(),
        "pickup_location": pickup_location.dict() if pickup_location else None,
        "pickup_bus_stop": pickup_bus_stop.dict() if pickup_bus_stop else None,
        "home_address": booking_data.home_address.dict() if booking_data.home_address else None,
        "additional_time_minutes": additional_time,
        "status": "confirmed",
        "payment_method": booking_data.payment_method,
        "amount_paid": trip_cost,
        "trip_type": trip_type
    }
    
    bookings_collection.insert_one(booking)
    
    # Send real-time notification to trip creator
    await manager.send_personal_message(
        json.dumps({
            "type": "booking_notification",
            "trip_id": trip_id,
            "message": f"New booking from {current_user['name']} (Payment: {booking_data.payment_method})",
            "booking_id": booking_id
        }),
        trip["creator_id"]
    )
    
    return {
        "message": "Trip booked successfully",
        "booking_id": booking_id,
        "payment_method": booking_data.payment_method,
        "amount_paid": trip_cost,
        "trip_type": trip_type
    }

@app.get("/api/user/trips")
async def get_user_trips(current_user: dict = Depends(get_current_user)):
    # Get taxi trips created by user
    created_taxi_trips = list(trips_collection.find({"creator_id": current_user["id"]}))
    
    # Get personal car trips created by user
    created_personal_trips = list(personal_car_trips_collection.find({"creator_id": current_user["id"]}))
    
    # Get trips booked by user (taxi trips only)
    user_bookings = list(bookings_collection.find({"user_id": current_user["id"], "status": "confirmed"}))
    booked_trip_ids = [booking["trip_id"] for booking in user_bookings]
    booked_trips = list(trips_collection.find({"id": {"$in": booked_trip_ids}}))
    
    # Get personal car trips user has joined
    user_join_requests = list(join_requests_collection.find({"requester_id": current_user["id"], "status": "approved"}))
    joined_trip_ids = [request["trip_id"] for request in user_join_requests]
    joined_personal_trips = list(personal_car_trips_collection.find({"id": {"$in": joined_trip_ids}}))
    
    def format_trip(trip, trip_type, category):
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
        
        # Get current bookings/requests
        if trip_type == "taxi":
            current_bookings = bookings_collection.count_documents({"trip_id": trip["id"], "status": "confirmed"})
        else:
            current_bookings = join_requests_collection.count_documents({"trip_id": trip["id"], "status": "approved"})
        
        formatted = {
            "id": trip["id"],
            "origin": origin,
            "destination": destination,
            "departure_time": trip["departure_time"],
            "available_seats": trip["available_seats"] - current_bookings,
            "price_per_person": trip["price_per_person"],
            "status": trip["status"],
            "distance_km": trip.get("distance_km", 0),
            "duration_minutes": trip.get("duration_minutes", 0),
            "current_riders": current_bookings,
            "type": category,
            "trip_type": trip_type
        }
        
        if category == "created":
            formatted["bookings"] = current_bookings
        else:
            formatted["creator_name"] = trip["creator_name"]
        
        # Add personal car specific fields
        if trip_type == "personal_car":
            formatted.update({
                "car_model": trip.get("car_model"),
                "car_color": trip.get("car_color"),
                "license_plate": trip.get("license_plate"),
                "nearest_bus_stop": trip.get("nearest_bus_stop")
            })
        
        return formatted
    
    created_list = []
    for trip in created_taxi_trips:
        created_list.append(format_trip(trip, "taxi", "created"))
    
    for trip in created_personal_trips:
        created_list.append(format_trip(trip, "personal_car", "created"))
    
    booked_list = []
    for trip in booked_trips:
        booked_list.append(format_trip(trip, "taxi", "booked"))
    
    for trip in joined_personal_trips:
        booked_list.append(format_trip(trip, "personal_car", "booked"))
    
    # Sort by departure time
    created_list.sort(key=lambda x: x["departure_time"])
    booked_list.sort(key=lambda x: x["departure_time"])
    
    return {
        "created_trips": created_list,
        "booked_trips": booked_list
    }

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