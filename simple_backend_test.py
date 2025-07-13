import requests
import sys
from datetime import datetime, timedelta
import uuid

class SimpleAPITester:
    def __init__(self, base_url="https://02c4049f-0590-4791-926a-42c50d717a39.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                return True, response.json() if response.content else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health(self):
        """Test API health"""
        return self.run_test("API Health", "GET", "api/health", 200)

    def test_register(self, user_data):
        """Test user registration"""
        success, response = self.run_test("User Registration", "POST", "api/auth/register", 200, data=user_data)
        if success and 'token' in response:
            self.token = response['token']
            return True, response
        return False, {}

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            return True, response
        return False, {}

    def test_google_maps_geocode(self, address):
        """Test Google Maps geocoding"""
        return self.run_test(
            "Google Maps Geocoding",
            "POST", 
            "api/maps/geocode",
            200,
            data={"address": address}
        )

    def test_google_maps_distance_matrix(self, origins, destinations):
        """Test Google Maps distance matrix"""
        return self.run_test(
            "Google Maps Distance Matrix",
            "POST",
            "api/maps/distance-matrix", 
            200,
            data={"origins": origins, "destinations": destinations}
        )

    def test_create_trip(self, trip_data):
        """Create a trip"""
        success, response = self.run_test(
            "Create Trip",
            "POST",
            "api/trips",
            200,
            data=trip_data
        )
        return response.get('trip_id') if success else None

    def test_get_trips(self):
        """Get available trips"""
        return self.run_test("Get Available Trips", "GET", "api/trips", 200)

def main():
    # Setup
    tester = SimpleAPITester()
    test_id = str(uuid.uuid4())[:8]
    
    test_user = {
        "name": f"Test User {test_id}",
        "email": f"test{test_id}@turkishairlines.com",
        "phone": f"+90555{test_id}",
        "employee_id": f"EMP{test_id}",
        "department": "IT Testing",
        "password": "Test123!"
    }

    # Enhanced trip data with Location objects for Phase 2
    tomorrow = datetime.now() + timedelta(days=1)
    test_trip = {
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

    print("🚀 Starting Turkish Airlines Car Pooling API Tests (Phase 2)")
    print("=" * 60)

    # Run tests
    if not tester.test_health()[0]:
        print("❌ Health check failed, stopping tests")
        return 1

    if not tester.test_register(test_user)[0]:
        print("❌ Registration failed, stopping tests")
        return 1

    # Test Google Maps APIs
    print("\n📍 Testing Google Maps Integration...")
    
    geocode_success, geocode_data = tester.test_google_maps_geocode("Istanbul Airport")
    if geocode_success:
        print(f"   Geocoded address: {geocode_data.get('address', 'N/A')}")
        print(f"   Coordinates: {geocode_data.get('coordinates', 'N/A')}")

    distance_success, distance_data = tester.test_google_maps_distance_matrix(
        ["Istanbul Airport"], 
        ["Taksim Square, Istanbul"]
    )
    if distance_success and 'distances' in distance_data and len(distance_data['distances']) > 0:
        dist_info = distance_data['distances'][0]
        print(f"   Distance: {dist_info.get('distance', 'N/A')}")
        print(f"   Duration: {dist_info.get('duration', 'N/A')}")

    # Test trip creation with enhanced location data
    trip_id = tester.test_create_trip(test_trip)
    if not trip_id:
        print("❌ Trip creation failed")
        return 1

    # Test getting trips with enhanced data
    trips_success, trips_data = tester.test_get_trips()
    if trips_success and 'trips' in trips_data:
        for trip in trips_data['trips']:
            if trip['id'] == trip_id:
                print(f"   Created trip found with distance: {trip.get('distance_km', 0)}km")
                print(f"   Duration: {trip.get('duration_minutes', 0)} minutes")
                break

    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print("=" * 60)
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Phase 2 Google Maps integration is working.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())