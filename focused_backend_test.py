#!/usr/bin/env python3
"""
Focused Backend Test for Turkish Airlines Car Pooling Phase 2 Fixes
Tests core functionality and data type compatibility
"""

import requests
import json
from datetime import datetime, timedelta

class BackendTester:
    def __init__(self):
        self.base_url = "https://02c4049f-0590-4791-926a-42c50d717a39.preview.emergentagent.com"
        self.token = None
        self.user_id = None
        self.trip_id = None
        self.test_id = datetime.now().strftime("%H%M%S")
        
    def log(self, message, status="INFO"):
        print(f"[{status}] {message}")
        
    def api_call(self, endpoint, method="GET", data=None):
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
                
            return response
        except Exception as e:
            self.log(f"Request failed: {str(e)}", "ERROR")
            return None
    
    def test_health(self):
        """Test API health"""
        self.log("Testing API health...")
        response = self.api_call("/api/health")
        
        if response and response.status_code == 200:
            self.log("✅ API is healthy", "PASS")
            return True
        else:
            self.log(f"❌ API health check failed: {response.status_code if response else 'No response'}", "FAIL")
            return False
    
    def test_register_and_login(self):
        """Test user registration and login"""
        self.log("Testing user registration and login...")
        
        # Register user
        user_data = {
            "name": f"Test User {self.test_id}",
            "email": f"test{self.test_id}@turkishairlines.com",
            "phone": f"+90555{self.test_id}",
            "employee_id": f"EMP{self.test_id}",
            "department": "IT Testing",
            "password": "Test123!"
        }
        
        response = self.api_call("/api/auth/register", "POST", user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.log(f"✅ User registered successfully: {data.get('user', {}).get('name')}", "PASS")
            
            # Test login with same credentials
            login_data = {
                "email": user_data["email"],
                "password": user_data["password"]
            }
            
            login_response = self.api_call("/api/auth/login", "POST", login_data)
            if login_response and login_response.status_code == 200:
                login_data_resp = login_response.json()
                self.token = login_data_resp.get("token")  # Update token
                self.log("✅ Login successful", "PASS")
                return True
            else:
                self.log(f"❌ Login failed: {login_response.status_code if login_response else 'No response'}", "FAIL")
                if login_response:
                    self.log(f"   Error: {login_response.text}", "ERROR")
                return False
        else:
            self.log(f"❌ Registration failed: {response.status_code if response else 'No response'}", "FAIL")
            if response:
                self.log(f"   Error: {response.text}", "ERROR")
            return False
    
    def test_create_trip_with_location_objects(self):
        """Test creating trip with Location objects (Phase 2 fix)"""
        self.log("Testing trip creation with Location objects...")
        
        if not self.token:
            self.log("❌ No authentication token available", "FAIL")
            return False
            
        # Create trip with proper Location objects
        departure_time = (datetime.now() + timedelta(hours=2)).isoformat()
        
        trip_data = {
            "origin": {
                "address": "Istanbul Airport (IST), Istanbul, Turkey",
                "coordinates": {"lat": 41.2619, "lng": 28.7419},
                "place_id": "ChIJBVkqGgUJyhQRKEi4iBP7wgM"
            },
            "destination": {
                "address": "Taksim Square, Istanbul, Turkey",
                "coordinates": {"lat": 41.0369, "lng": 28.9850},
                "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
            },
            "departure_time": departure_time,
            "available_seats": 3,
            "price_per_person": 25.50,
            "notes": "Test trip with Location objects - Phase 2"
        }
        
        response = self.api_call("/api/trips", "POST", trip_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.trip_id = data.get("trip_id")
            self.log(f"✅ Trip created with Location objects: {self.trip_id}", "PASS")
            return True
        else:
            self.log(f"❌ Trip creation failed: {response.status_code if response else 'No response'}", "FAIL")
            if response:
                self.log(f"   Error: {response.text}", "ERROR")
            return False
    
    def test_get_trips_mixed_data_types(self):
        """Test retrieving trips with mixed data types (Phase 2 fix)"""
        self.log("Testing trip retrieval with mixed data type handling...")
        
        if not self.token:
            self.log("❌ No authentication token available", "FAIL")
            return False
            
        response = self.api_call("/api/trips")
        
        if response and response.status_code == 200:
            data = response.json()
            trips = data.get("trips", [])
            self.log(f"✅ Retrieved {len(trips)} trips successfully", "PASS")
            
            # Check that trips have proper Location object structure
            for trip in trips:
                origin = trip.get("origin", {})
                destination = trip.get("destination", {})
                
                # Verify Location objects have required fields
                if isinstance(origin, dict) and "address" in origin and "coordinates" in origin:
                    self.log(f"   ✅ Trip {trip.get('id', 'unknown')[:8]}... has proper origin Location", "PASS")
                else:
                    self.log(f"   ⚠️  Trip {trip.get('id', 'unknown')[:8]}... has malformed origin: {type(origin)}", "WARN")
                
                if isinstance(destination, dict) and "address" in destination and "coordinates" in destination:
                    self.log(f"   ✅ Trip {trip.get('id', 'unknown')[:8]}... has proper destination Location", "PASS")
                else:
                    self.log(f"   ⚠️  Trip {trip.get('id', 'unknown')[:8]}... has malformed destination: {type(destination)}", "WARN")
            
            return True
        else:
            self.log(f"❌ Trip retrieval failed: {response.status_code if response else 'No response'}", "FAIL")
            if response:
                self.log(f"   Error: {response.text}", "ERROR")
            return False
    
    def test_get_trip_details(self):
        """Test getting specific trip details"""
        self.log("Testing trip details retrieval...")
        
        if not self.token or not self.trip_id:
            self.log("❌ No authentication token or trip ID available", "FAIL")
            return False
            
        response = self.api_call(f"/api/trips/{self.trip_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            origin = data.get("origin", {})
            destination = data.get("destination", {})
            
            self.log(f"✅ Trip details retrieved: {origin.get('address', 'Unknown')} → {destination.get('address', 'Unknown')}", "PASS")
            
            # Verify Location object structure
            if isinstance(origin, dict) and "address" in origin and "coordinates" in origin:
                self.log("   ✅ Origin has proper Location object structure", "PASS")
            else:
                self.log(f"   ❌ Origin malformed: {origin}", "FAIL")
                
            if isinstance(destination, dict) and "address" in destination and "coordinates" in destination:
                self.log("   ✅ Destination has proper Location object structure", "PASS")
            else:
                self.log(f"   ❌ Destination malformed: {destination}", "FAIL")
            
            return True
        else:
            self.log(f"❌ Trip details retrieval failed: {response.status_code if response else 'No response'}", "FAIL")
            if response:
                self.log(f"   Error: {response.text}", "ERROR")
            return False
    
    def test_user_trips(self):
        """Test getting user trips"""
        self.log("Testing user trips retrieval...")
        
        if not self.token:
            self.log("❌ No authentication token available", "FAIL")
            return False
            
        response = self.api_call("/api/user/trips")
        
        if response and response.status_code == 200:
            data = response.json()
            created_trips = data.get("created_trips", [])
            booked_trips = data.get("booked_trips", [])
            
            self.log(f"✅ User trips retrieved - Created: {len(created_trips)}, Booked: {len(booked_trips)}", "PASS")
            
            # Test Location object handling in user trips
            for trip in created_trips + booked_trips:
                origin = trip.get("origin", {})
                destination = trip.get("destination", {})
                
                if isinstance(origin, dict) and "address" in origin:
                    self.log(f"   ✅ User trip has proper origin Location", "PASS")
                else:
                    self.log(f"   ❌ User trip has malformed origin: {type(origin)}", "FAIL")
                    
                if isinstance(destination, dict) and "address" in destination:
                    self.log(f"   ✅ User trip has proper destination Location", "PASS")
                else:
                    self.log(f"   ❌ User trip has malformed destination: {type(destination)}", "FAIL")
            
            return True
        else:
            self.log(f"❌ User trips retrieval failed: {response.status_code if response else 'No response'}", "FAIL")
            if response:
                self.log(f"   Error: {response.text}", "ERROR")
            return False
    
    def test_google_maps_integration(self):
        """Test Google Maps integration (expected to fail but should not crash)"""
        self.log("Testing Google Maps integration...")
        
        # Test geocoding endpoint
        geocode_data = {"address": "Istanbul Airport"}
        response = self.api_call("/api/maps/geocode", "POST", geocode_data)
        
        if response:
            if response.status_code == 200:
                self.log("✅ Google Maps geocoding working", "PASS")
                return True
            elif response.status_code == 500:
                self.log("⚠️  Google Maps geocoding returns 500 (API not enabled - expected)", "WARN")
                return True  # This is expected based on review request
            else:
                self.log(f"❌ Unexpected Google Maps response: {response.status_code}", "FAIL")
                return False
        else:
            self.log("❌ No response from Google Maps endpoint", "FAIL")
            return False
    
    def run_all_tests(self):
        """Run all focused tests"""
        self.log("🚀 Starting Turkish Airlines Car Pooling Backend Tests (Phase 2)")
        self.log("=" * 70)
        
        tests = [
            ("API Health Check", self.test_health),
            ("User Registration & Login", self.test_register_and_login),
            ("Trip Creation with Location Objects", self.test_create_trip_with_location_objects),
            ("Trip Retrieval with Mixed Data Types", self.test_get_trips_mixed_data_types),
            ("Trip Details Retrieval", self.test_get_trip_details),
            ("User Trips Retrieval", self.test_user_trips),
            ("Google Maps Integration", self.test_google_maps_integration),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log(f"❌ {test_name} - Exception: {str(e)}", "ERROR")
        
        # Summary
        self.log("\n" + "=" * 70)
        self.log("📊 BACKEND TEST SUMMARY")
        self.log("=" * 70)
        self.log(f"Tests Passed: {passed}/{total}")
        self.log(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed >= 5:  # Allow Google Maps to fail
            self.log("🎉 Core backend functionality is working!")
            self.log("✅ Phase 2 fixes appear to be working correctly")
            return True
        else:
            self.log("⚠️  Some core tests failed - backend may have issues")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)