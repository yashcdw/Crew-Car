#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class QuickDiagnosticTest:
    def __init__(self):
        self.base_url = "https://02c4049f-0590-4791-926a-42c50d717a39.preview.emergentagent.com"
        self.token = None
        
    def test_api_call(self, endpoint, method="GET", data=None, expected_status=200):
        """Make API call and return detailed results"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            
            try:
                result = response.json()
            except:
                result = {"raw_response": response.text}
            
            return {
                "success": response.status_code == expected_status,
                "status_code": response.status_code,
                "result": result,
                "expected": expected_status
            }
        except Exception as e:
            return {
                "success": False,
                "status_code": 0,
                "result": {"error": str(e)},
                "expected": expected_status
            }

    def run_diagnostic(self):
        print("🔍 TURKISH AIRLINES CAR POOLING - DIAGNOSTIC TEST")
        print("=" * 60)
        
        # 1. Health Check
        print("\n1. 🏥 Health Check")
        result = self.test_api_call("/api/health")
        print(f"   Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success']:
            print("   ✅ API is healthy")
        else:
            print(f"   ❌ Health check failed: {result['result']}")
        
        # 2. User Registration
        print("\n2. 👤 User Registration")
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@turkishairlines.com",
            "phone": "+905551234567",
            "employee_id": f"TK{timestamp}",
            "department": "IT",
            "password": "TestPass123!"
        }
        
        result = self.test_api_call("/api/auth/register", "POST", user_data)
        print(f"   Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success'] and 'token' in result['result']:
            self.token = result['result']['token']
            print(f"   ✅ Registration successful, token obtained")
        else:
            print(f"   ❌ Registration failed: {result['result']}")
            return
        
        # 3. Google Maps Tests
        print("\n3. 🗺️  Google Maps API Tests")
        
        # Geocoding
        print("\n   3a. Geocoding Test")
        result = self.test_api_call("/api/maps/geocode", "POST", {"address": "Istanbul Airport"})
        print(f"      Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success']:
            coords = result['result'].get('coordinates', {})
            print(f"      ✅ Geocoding works - Coords: {coords}")
        else:
            print(f"      ❌ Geocoding failed: {result['result']}")
        
        # Distance Matrix
        print("\n   3b. Distance Matrix Test")
        result = self.test_api_call("/api/maps/distance-matrix", "POST", {
            "origins": ["Istanbul Airport"],
            "destinations": ["Taksim Square, Istanbul"]
        })
        print(f"      Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success']:
            distances = result['result'].get('distances', [])
            print(f"      ✅ Distance Matrix works - Found {len(distances)} distances")
        else:
            print(f"      ❌ Distance Matrix failed: {result['result']}")
        
        # Directions
        print("\n   3c. Directions Test")
        result = self.test_api_call("/api/maps/directions", "POST", {
            "origin": "Istanbul Airport",
            "destination": "Taksim Square, Istanbul"
        })
        print(f"      Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success']:
            polyline = result['result'].get('polyline', '')
            print(f"      ✅ Directions works - Polyline length: {len(polyline)}")
        else:
            print(f"      ❌ Directions failed: {result['result']}")
        
        # Rider Matching
        print("\n   3d. Rider Matching Test")
        result = self.test_api_call("/api/maps/rider-matching", "POST", {
            "rider_location": "Levent, Istanbul",
            "trip_origin": "Istanbul Airport",
            "trip_destination": "Taksim Square, Istanbul",
            "max_detour_minutes": 10
        })
        print(f"      Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success']:
            compatible = result['result'].get('compatible', False)
            print(f"      ✅ Rider Matching works - Compatible: {compatible}")
        else:
            print(f"      ❌ Rider Matching failed: {result['result']}")
        
        # 4. Trip Creation with Maps
        print("\n4. 🚗 Trip Creation with Google Maps")
        departure_time = (datetime.now() + timedelta(hours=2)).isoformat()
        trip_data = {
            "origin": {
                "address": "Istanbul Airport (IST), Turkey",
                "coordinates": {"lat": 40.9769, "lng": 28.8146},
                "place_id": "ChIJ_R8J2DKvyhQRzCo9dCz7qAQ"
            },
            "destination": {
                "address": "Taksim Square, Istanbul, Turkey", 
                "coordinates": {"lat": 41.0370, "lng": 28.9857},
                "place_id": "ChIJaVCJhJG5yhQRzKbUZbUjJAQ"
            },
            "departure_time": departure_time,
            "available_seats": 2,
            "price_per_person": 50.0,
            "notes": "Test trip with Google Maps integration"
        }
        
        result = self.test_api_call("/api/trips", "POST", trip_data)
        print(f"   Status: {result['status_code']} (Expected: {result['expected']})")
        if result['success']:
            trip_id = result['result'].get('trip_id')
            print(f"   ✅ Trip creation successful - ID: {trip_id}")
            
            # 5. Get trips to verify Maps data
            print("\n5. 📋 Verify Trip has Maps Data")
            result = self.test_api_call("/api/trips")
            print(f"   Status: {result['status_code']} (Expected: {result['expected']})")
            if result['success']:
                trips = result['result'].get('trips', [])
                if trips:
                    trip = trips[0]
                    distance = trip.get('distance_km', 0)
                    duration = trip.get('duration_minutes', 0)
                    polyline = trip.get('route_polyline', '')
                    print(f"   ✅ Trip has Maps data - Distance: {distance}km, Duration: {duration}min, Polyline: {len(polyline)} chars")
                else:
                    print("   ⚠️  No trips found")
            else:
                print(f"   ❌ Failed to get trips: {result['result']}")
        else:
            print(f"   ❌ Trip creation failed: {result['result']}")
        
        print("\n" + "=" * 60)
        print("🏁 DIAGNOSTIC COMPLETE")

if __name__ == "__main__":
    tester = QuickDiagnosticTest()
    tester.run_diagnostic()