import requests
import unittest
import uuid
from datetime import datetime, timedelta

class PaymentMethodEdgeCaseTest(unittest.TestCase):
    """
    Additional edge case tests for payment method validation
    """
    
    def setUp(self):
        self.base_url = "https://edd6d56b-2a86-4bf5-b3c7-2539850efc2a.preview.emergentagent.com"
        self.test_id = str(uuid.uuid4())[:8]
        
        # Test users
        self.user1 = {
            "name": f"Edge Test User {self.test_id}",
            "email": f"edge{self.test_id}@turkishairlines.com",
            "phone": f"+905551111{self.test_id[:3]}",
            "employee_id": f"EDGE{self.test_id}",
            "department": "Testing",
            "password": "TurkishAir2024!"
        }
        
        self.user2 = {
            "name": f"Edge Test User 2 {self.test_id}",
            "email": f"edge2{self.test_id}@turkishairlines.com",
            "phone": f"+905552222{self.test_id[:3]}",
            "employee_id": f"EDGE2{self.test_id}",
            "department": "Testing",
            "password": "TurkishAir2024!"
        }
        
        # Trip data
        tomorrow = datetime.now() + timedelta(days=1)
        self.trip_data = {
            "origin": {
                "address": "Sabiha Gökçen Airport, İstanbul, Turkey",
                "coordinates": {"lat": 40.8986, "lng": 29.3092},
                "place_id": "ChIJBVkqGgUJyhQRKEi4iBP7wgM"
            },
            "destination": {
                "address": "Galata Tower, İstanbul, Turkey", 
                "coordinates": {"lat": 41.0256, "lng": 28.9744},
                "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
            },
            "departure_time": tomorrow.isoformat(),
            "available_seats": 2,
            "price_per_person": 40.0,
            "notes": "Edge case test trip"
        }
        
        self.personal_car_data = {
            **self.trip_data,
            "car_model": "BMW 3 Series",
            "car_color": "Siyah",
            "license_plate": "06 XYZ 789"
        }
        
        self.token1 = None
        self.token2 = None
        self.user1_id = None
        self.user2_id = None
        
    def register_users(self):
        """Register test users"""
        # Register user 1
        response = requests.post(f"{self.base_url}/api/auth/register", json=self.user1)
        self.assertEqual(response.status_code, 200)
        user1_data = response.json()
        self.token1 = user1_data["token"]
        self.user1_id = user1_data["user"]["id"]
        
        # Register user 2
        response = requests.post(f"{self.base_url}/api/auth/register", json=self.user2)
        self.assertEqual(response.status_code, 200)
        user2_data = response.json()
        self.token2 = user2_data["token"]
        self.user2_id = user2_data["user"]["id"]
        
    def test_invalid_payment_method_taxi(self):
        """Test invalid payment method for taxi trip"""
        print("\n=== Edge Case: Invalid Payment Method for Taxi Trip ===")
        
        self.register_users()
        
        # Create taxi trip
        headers = {"Authorization": f"Bearer {self.token1}"}
        response = requests.post(f"{self.base_url}/api/trips", json=self.trip_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Try to book with invalid payment method
        headers = {"Authorization": f"Bearer {self.token2}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "crypto"  # Invalid payment method
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 400)
        error_response = response.json()
        self.assertIn("Invalid payment method", error_response["detail"])
        
        print(f"✅ Correctly rejected invalid payment method 'crypto' for taxi trip")
        print(f"   Error: {error_response['detail']}")
        
    def test_invalid_payment_method_personal_car(self):
        """Test invalid payment method for personal car trip"""
        print("\n=== Edge Case: Invalid Payment Method for Personal Car Trip ===")
        
        if not self.token1:
            self.register_users()
            
        # Create personal car trip
        headers = {"Authorization": f"Bearer {self.token1}"}
        response = requests.post(f"{self.base_url}/api/trips/personal-car", json=self.personal_car_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Try to book with invalid payment method
        headers = {"Authorization": f"Bearer {self.token2}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "bitcoin"  # Invalid payment method
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 400)
        error_response = response.json()
        self.assertIn("Personal car trips only accept wallet payments", error_response["detail"])
        
        print(f"✅ Correctly rejected invalid payment method 'bitcoin' for personal car trip")
        print(f"   Error: {error_response['detail']}")
        
    def test_missing_payment_method(self):
        """Test booking without specifying payment method"""
        print("\n=== Edge Case: Missing Payment Method ===")
        
        if not self.token1:
            self.register_users()
            
        # Create taxi trip
        headers = {"Authorization": f"Bearer {self.token1}"}
        response = requests.post(f"{self.base_url}/api/trips", json=self.trip_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Try to book without payment method (should default to wallet)
        headers = {"Authorization": f"Bearer {self.token2}"}
        booking_data = {
            "trip_id": trip_id
            # No payment_method specified
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        # Should succeed with default wallet payment (if balance sufficient) or fail with insufficient balance
        if response.status_code == 200:
            booking_response = response.json()
            self.assertEqual(booking_response["payment_method"], "wallet")
            print(f"✅ Default payment method 'wallet' used successfully")
        elif response.status_code == 400:
            error_response = response.json()
            self.assertIn("Insufficient wallet balance", error_response["detail"])
            print(f"✅ Default payment method 'wallet' used but failed due to insufficient balance")
        else:
            self.fail(f"Unexpected response: {response.status_code} - {response.text}")

if __name__ == "__main__":
    unittest.main(verbosity=2)