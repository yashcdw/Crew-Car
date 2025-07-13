import requests
import unittest
import uuid
from datetime import datetime, timedelta

class TurkishAirlinesCarPoolingAPITest(unittest.TestCase):
    def setUp(self):
        self.base_url = "https://02c4049f-0590-4791-926a-42c50d717a39.preview.emergentagent.com"
        self.token = None
        self.user_id = None
        self.trip_id = None
        
        # Generate unique test data
        self.test_id = str(uuid.uuid4())[:8]
        self.test_user = {
            "name": f"Test User {self.test_id}",
            "email": f"test{self.test_id}@turkishairlines.com",
            "phone": f"+90555{self.test_id}",
            "employee_id": f"EMP{self.test_id}",
            "department": "IT Testing",
            "password": "Test123!"
        }
        
        # Enhanced trip data with Location objects for Phase 2
        tomorrow = datetime.now() + timedelta(days=1)
        self.test_trip = {
            "origin": {
                "address": "Istanbul Airport (IST), Tayakadın, 34283 Arnavutköy/İstanbul, Turkey",
                "coordinates": {"lat": 41.2619, "lng": 28.7419},
                "place_id": "ChIJBVkqGgUJyhQRKEi4iBP7wgM"
            },
            "destination": {
                "address": "Taksim Square, Gümüşsuyu, 34437 Beyoğlu/İstanbul, Turkey", 
                "coordinates": {"lat": 41.0369, "lng": 28.9850},
                "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
            },
            "departure_time": tomorrow.isoformat(),
            "available_seats": 3,
            "price_per_person": 50.0,
            "notes": "Test trip created by automated test"
        }
        
        # Second user for booking tests
        self.test_user2 = {
            "name": f"Test User 2 {self.test_id}",
            "email": f"test2{self.test_id}@turkishairlines.com",
            "phone": f"+90666{self.test_id}",
            "employee_id": f"EMP2{self.test_id}",
            "department": "IT Testing",
            "password": "Test123!"
        }
        self.token2 = None
        self.user_id2 = None

    def api_call(self, endpoint, method="GET", data=None, token=None):
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        return response

    def test_01_health_check(self):
        """Test API health check endpoint"""
        print("\n1. Testing API health check...")
        response = self.api_call("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        print("✅ API health check passed")

    def test_02_register_user(self):
        """Test user registration"""
        print("\n2. Testing user registration...")
        response = self.api_call("/api/auth/register", method="POST", data=self.test_user)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "User registered successfully")
        self.assertIn("token", data)
        self.assertIn("user", data)
        self.assertEqual(data["user"]["name"], self.test_user["name"])
        self.assertEqual(data["user"]["email"], self.test_user["email"])
        
        # Save token and user_id for subsequent tests
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        print(f"✅ User registration passed - User ID: {self.user_id}")

    def test_03_register_duplicate_user(self):
        """Test duplicate user registration (should fail)"""
        print("\n3. Testing duplicate user registration...")
        response = self.api_call("/api/auth/register", method="POST", data=self.test_user)
        self.assertEqual(response.status_code, 400)
        print("✅ Duplicate user registration correctly rejected")

    def test_04_login_user(self):
        """Test user login"""
        print("\n4. Testing user login...")
        login_data = {
            "email": self.test_user["email"],
            "password": self.test_user["password"]
        }
        response = self.api_call("/api/auth/login", method="POST", data=login_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Login successful")
        self.assertIn("token", data)
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], self.test_user["email"])
        
        # Update token
        self.token = data["token"]
        print("✅ User login passed")

    def test_05_get_profile(self):
        """Test getting user profile"""
        print("\n5. Testing get user profile...")
        response = self.api_call("/api/user/profile", token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["email"], self.test_user["email"])
        self.assertEqual(data["name"], self.test_user["name"])
        print("✅ Get user profile passed")

    def test_06_google_maps_geocode(self):
        """Test Google Maps geocoding API"""
        print("\n6. Testing Google Maps geocoding...")
        geocode_data = {"address": "Istanbul Airport"}
        response = self.api_call("/api/maps/geocode", method="POST", data=geocode_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("address", data)
        self.assertIn("coordinates", data)
        self.assertIn("place_id", data)
        self.assertIn("lat", data["coordinates"])
        self.assertIn("lng", data["coordinates"])
        print("✅ Google Maps geocoding passed")

    def test_07_google_maps_distance_matrix(self):
        """Test Google Maps distance matrix API"""
        print("\n7. Testing Google Maps distance matrix...")
        distance_data = {
            "origins": ["Istanbul Airport"],
            "destinations": ["Taksim Square, Istanbul"]
        }
        response = self.api_call("/api/maps/distance-matrix", method="POST", data=distance_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("distances", data)
        self.assertGreater(len(data["distances"]), 0)
        
        distance_info = data["distances"][0]
        self.assertIn("distance", distance_info)
        self.assertIn("duration", distance_info)
        self.assertIn("distance_value", distance_info)
        self.assertIn("duration_value", distance_info)
        print("✅ Google Maps distance matrix passed")

    def test_08_google_maps_directions(self):
        """Test Google Maps directions API"""
        print("\n8. Testing Google Maps directions...")
        directions_data = {
            "origin": "Istanbul Airport",
            "destination": "Taksim Square, Istanbul"
        }
        response = self.api_call("/api/maps/directions", method="POST", data=directions_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("summary", data)
        self.assertIn("distance", data)
        self.assertIn("duration", data)
        self.assertIn("polyline", data)
        self.assertIn("steps", data)
        print("✅ Google Maps directions passed")

    def test_09_google_maps_rider_matching(self):
        """Test Google Maps rider matching API"""
        print("\n9. Testing Google Maps rider matching...")
        rider_match_data = {
            "rider_location": "Levent, Istanbul",
            "trip_origin": "Istanbul Airport",
            "trip_destination": "Taksim Square, Istanbul",
            "max_detour_minutes": 10
        }
        response = self.api_call("/api/maps/rider-matching", method="POST", data=rider_match_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("compatible", data)
        self.assertIn("original_duration_minutes", data)
        self.assertIn("detour_duration_minutes", data)
        self.assertIn("additional_time_minutes", data)
        print("✅ Google Maps rider matching passed")

    def test_10_create_trip(self):
        """Test creating a trip"""
        print("\n6. Testing trip creation...")
        response = self.api_call("/api/trips", method="POST", data=self.test_trip, token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Trip created successfully")
        self.assertIn("trip_id", data)
        
        # Save trip_id for subsequent tests
        self.trip_id = data["trip_id"]
        print(f"✅ Trip creation passed - Trip ID: {self.trip_id}")

    def test_07_get_available_trips(self):
        """Test getting available trips"""
        print("\n7. Testing get available trips...")
        response = self.api_call("/api/trips", token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("trips", data)
        
        # Verify our created trip is in the list
        trip_found = False
        for trip in data["trips"]:
            if trip["id"] == self.trip_id:
                trip_found = True
                self.assertEqual(trip["origin"], self.test_trip["origin"])
                self.assertEqual(trip["destination"], self.test_trip["destination"])
                self.assertEqual(trip["available_seats"], self.test_trip["available_seats"])
                self.assertEqual(trip["price_per_person"], self.test_trip["price_per_person"])
                self.assertTrue(trip["is_creator"])
                break
        
        self.assertTrue(trip_found, "Created trip not found in available trips")
        print("✅ Get available trips passed")

    def test_08_get_trip_details(self):
        """Test getting trip details"""
        print("\n8. Testing get trip details...")
        response = self.api_call(f"/api/trips/{self.trip_id}", token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], self.trip_id)
        self.assertEqual(data["origin"], self.test_trip["origin"])
        self.assertEqual(data["destination"], self.test_trip["destination"])
        self.assertEqual(data["price_per_person"], self.test_trip["price_per_person"])
        self.assertTrue(data["is_creator"])
        print("✅ Get trip details passed")

    def test_09_register_second_user(self):
        """Register a second user for booking tests"""
        print("\n9. Registering second user for booking tests...")
        response = self.api_call("/api/auth/register", method="POST", data=self.test_user2)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.token2 = data["token"]
        self.user_id2 = data["user"]["id"]
        print(f"✅ Second user registered - User ID: {self.user_id2}")

    def test_10_book_own_trip(self):
        """Test booking own trip (should fail)"""
        print("\n10. Testing booking own trip (should fail)...")
        response = self.api_call(f"/api/trips/{self.trip_id}/book", method="POST", token=self.token)
        self.assertEqual(response.status_code, 400)
        print("✅ Booking own trip correctly rejected")

    def test_11_book_trip(self):
        """Test booking a trip as second user"""
        print("\n11. Testing booking a trip as second user...")
        response = self.api_call(f"/api/trips/{self.trip_id}/book", method="POST", token=self.token2)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Trip booked successfully")
        self.assertIn("booking_id", data)
        print("✅ Trip booking passed")

    def test_12_book_same_trip_again(self):
        """Test booking the same trip again (should fail)"""
        print("\n12. Testing booking the same trip again (should fail)...")
        response = self.api_call(f"/api/trips/{self.trip_id}/book", method="POST", token=self.token2)
        self.assertEqual(response.status_code, 400)
        print("✅ Duplicate booking correctly rejected")

    def test_13_get_user_trips(self):
        """Test getting user trips"""
        print("\n13. Testing get user trips...")
        
        # Check creator's trips
        response = self.api_call("/api/user/trips", token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("created_trips", data)
        self.assertIn("booked_trips", data)
        
        # Verify created trip is in the list
        trip_found = False
        for trip in data["created_trips"]:
            if trip["id"] == self.trip_id:
                trip_found = True
                self.assertEqual(trip["origin"], self.test_trip["origin"])
                self.assertEqual(trip["destination"], self.test_trip["destination"])
                self.assertEqual(trip["type"], "created")
                break
        
        self.assertTrue(trip_found, "Created trip not found in user's created trips")
        
        # Check booker's trips
        response = self.api_call("/api/user/trips", token=self.token2)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify booked trip is in the list
        trip_found = False
        for trip in data["booked_trips"]:
            if trip["id"] == self.trip_id:
                trip_found = True
                self.assertEqual(trip["origin"], self.test_trip["origin"])
                self.assertEqual(trip["destination"], self.test_trip["destination"])
                self.assertEqual(trip["type"], "booked")
                break
        
        self.assertTrue(trip_found, "Booked trip not found in user's booked trips")
        print("✅ Get user trips passed")

    def test_14_cancel_trip(self):
        """Test cancelling a trip"""
        print("\n14. Testing trip cancellation...")
        response = self.api_call(f"/api/trips/{self.trip_id}", method="DELETE", token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Trip cancelled successfully")
        print("✅ Trip cancellation passed")

    def test_15_verify_trip_cancelled(self):
        """Verify trip is marked as cancelled"""
        print("\n15. Verifying trip is marked as cancelled...")
        response = self.api_call(f"/api/trips/{self.trip_id}", token=self.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "cancelled")
        print("✅ Trip status correctly updated to cancelled")

if __name__ == "__main__":
    # Run tests in order
    test_suite = unittest.TestSuite()
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_01_health_check'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_02_register_user'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_03_register_duplicate_user'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_04_login_user'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_05_get_profile'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_06_create_trip'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_07_get_available_trips'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_08_get_trip_details'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_09_register_second_user'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_10_book_own_trip'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_11_book_trip'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_12_book_same_trip_again'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_13_get_user_trips'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_14_cancel_trip'))
    test_suite.addTest(TurkishAirlinesCarPoolingAPITest('test_15_verify_trip_cancelled'))
    
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(test_suite)