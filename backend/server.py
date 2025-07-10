from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import os
import uuid
import hashlib
import jwt
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
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URL)
db = client.carpooling_db

# Collections
users_collection = db.users
trips_collection = db.trips
bookings_collection = db.bookings

# JWT Secret
JWT_SECRET = "your-secret-key-here"

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

class TripCreate(BaseModel):
    origin: str
    destination: str
    departure_time: datetime
    available_seats: int = Field(default=3, le=3)
    price_per_person: float
    notes: Optional[str] = None

class Trip(BaseModel):
    id: str
    creator_id: str
    creator_name: str
    origin: str
    destination: str
    departure_time: datetime
    available_seats: int
    max_riders: int = 3
    price_per_person: float
    notes: Optional[str] = None
    status: str = "active"
    created_at: datetime
    bookings: List[dict] = []

class BookingCreate(BaseModel):
    trip_id: str

class Booking(BaseModel):
    id: str
    trip_id: str
    user_id: str
    user_name: str
    booking_time: datetime
    status: str = "confirmed"

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
    trip = {
        "id": trip_id,
        "creator_id": current_user["id"],
        "creator_name": current_user["name"],
        "origin": trip_data.origin,
        "destination": trip_data.destination,
        "departure_time": trip_data.departure_time,
        "available_seats": trip_data.available_seats,
        "max_riders": 3,
        "price_per_person": trip_data.price_per_person,
        "notes": trip_data.notes,
        "status": "active",
        "created_at": datetime.utcnow()
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
        
        trip_data = {
            "id": trip["id"],
            "creator_id": trip["creator_id"],
            "creator_name": trip["creator_name"],
            "origin": trip["origin"],
            "destination": trip["destination"],
            "departure_time": trip["departure_time"],
            "available_seats": trip["available_seats"] - len(bookings),
            "max_riders": trip["max_riders"],
            "price_per_person": trip["price_per_person"],
            "notes": trip.get("notes", ""),
            "status": trip["status"],
            "created_at": trip["created_at"],
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
        booking_details.append({
            "id": booking["id"],
            "user_name": user["name"] if user else "Unknown",
            "user_phone": user["phone"] if user else "",
            "booking_time": booking["booking_time"]
        })
    
    trip_data = {
        "id": trip["id"],
        "creator_id": trip["creator_id"],
        "creator_name": trip["creator_name"],
        "origin": trip["origin"],
        "destination": trip["destination"],
        "departure_time": trip["departure_time"],
        "available_seats": trip["available_seats"] - len(bookings),
        "max_riders": trip["max_riders"],
        "price_per_person": trip["price_per_person"],
        "notes": trip.get("notes", ""),
        "status": trip["status"],
        "created_at": trip["created_at"],
        "bookings": booking_details,
        "is_creator": trip["creator_id"] == current_user["id"]
    }
    
    return trip_data

@app.post("/api/trips/{trip_id}/book")
async def book_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
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
    
    # Create booking
    booking_id = str(uuid.uuid4())
    booking = {
        "id": booking_id,
        "trip_id": trip_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "booking_time": datetime.utcnow(),
        "status": "confirmed"
    }
    
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
        created_list.append({
            "id": trip["id"],
            "origin": trip["origin"],
            "destination": trip["destination"],
            "departure_time": trip["departure_time"],
            "available_seats": trip["available_seats"] - len(bookings),
            "price_per_person": trip["price_per_person"],
            "status": trip["status"],
            "bookings": len(bookings),
            "type": "created"
        })
    
    booked_list = []
    for trip in booked_trips:
        bookings = list(bookings_collection.find({"trip_id": trip["id"], "status": "confirmed"}))
        booked_list.append({
            "id": trip["id"],
            "creator_name": trip["creator_name"],
            "origin": trip["origin"],
            "destination": trip["destination"],
            "departure_time": trip["departure_time"],
            "price_per_person": trip["price_per_person"],
            "status": trip["status"],
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)