#!/usr/bin/env python3
"""
Quick Turkish Airlines Car Pooling API Test
"""

import requests
import sys
from datetime import datetime, timedelta

def test_api():
    base_url = "https://02c4049f-0590-4791-926a-42c50d717a39.preview.emergentagent.com"
    
    print("🚀 Testing Turkish Airlines Car Pooling API")
    print("=" * 50)
    
    # Test 1: Health Check
    try:
        response = requests.get(f"{base_url}/api/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health Check - API is running")
        else:
            print(f"❌ Health Check - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health Check - Error: {e}")
        return False
    
    # Test 2: User Registration
    timestamp = datetime.now().strftime("%H%M%S")
    user_data = {
        "name": f"Test User {timestamp}",
        "email": f"test{timestamp}@turkishairlines.com",
        "phone": "+90555123456",
        "employee_id": f"TK{timestamp}",
        "department": "IT",
        "password": "TestPass123!"
    }
    
    try:
        response = requests.post(f"{base_url}/api/auth/register", json=user_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            user_id = data.get('user', {}).get('id')
            print(f"✅ User Registration - User ID: {user_id}")
        else:
            print(f"❌ User Registration - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ User Registration - Error: {e}")
        return False
    
    # Test 3: Google Maps Directions API (should work)
    try:
        response = requests.post(f"{base_url}/api/maps/directions", 
                               json={"origin": "Istanbul Airport", "destination": "Taksim Square"},
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Directions API - Distance: {data.get('distance', 'N/A')}, Duration: {data.get('duration', 'N/A')}")
        else:
            print(f"❌ Directions API - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Directions API - Error: {e}")
    
    # Test 4: Trip Creation with Location Objects
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    trip_data = {
        "origin": {
            "address": "Istanbul Airport (IST), Istanbul, Turkey",
            "coordinates": {"lat": 41.2619, "lng": 28.7419},
            "place_id": "ChIJBVkqGgQU0xQRKwqFGYjKRQE"
        },
        "destination": {
            "address": "Taksim Square, Istanbul, Turkey", 
            "coordinates": {"lat": 41.0369, "lng": 28.9850},
            "place_id": "ChIJaVkqGgQU0xQRKwqFGYjKRQE"
        },
        "departure_time": (datetime.now() + timedelta(hours=2)).isoformat(),
        "available_seats": 3,
        "price_per_person": 25.50,
        "notes": "Test trip for API validation"
    }
    
    try:
        response = requests.post(f"{base_url}/api/trips", json=trip_data, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            trip_id = data.get('trip_id')
            print(f"✅ Trip Creation - Trip ID: {trip_id}")
        else:
            print(f"❌ Trip Creation - Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"❌ Trip Creation - Error: {e}")
    
    # Test 5: Get Available Trips (should show route polylines)
    try:
        response = requests.get(f"{base_url}/api/trips", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            trips = data.get('trips', [])
            trips_with_routes = [t for t in trips if t.get('route_polyline')]
            print(f"✅ Get Trips - Found {len(trips)} trips, {len(trips_with_routes)} with route polylines")
        else:
            print(f"❌ Get Trips - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Get Trips - Error: {e}")
    
    # Test 6: Geocoding API
    try:
        response = requests.post(f"{base_url}/api/maps/geocode", 
                               json={"address": "Istanbul Airport"},
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Geocoding API - Address: {data.get('address', 'N/A')}")
        else:
            print(f"❌ Geocoding API - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Geocoding API - Error: {e}")
    
    # Test 7: Distance Matrix API
    try:
        response = requests.post(f"{base_url}/api/maps/distance-matrix", 
                               json={
                                   "origins": ["Istanbul Airport"],
                                   "destinations": ["Taksim Square, Istanbul"]
                               },
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            distances = data.get('distances', [])
            print(f"✅ Distance Matrix API - Found {len(distances)} distance calculations")
        else:
            print(f"❌ Distance Matrix API - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Distance Matrix API - Error: {e}")
    
    print("\n🎉 Backend API testing completed!")
    return True

if __name__ == "__main__":
    success = test_api()
    sys.exit(0 if success else 1)