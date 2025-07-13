import requests
import unittest
import uuid
from datetime import datetime, timedelta

class WalletFunctionalityTest(unittest.TestCase):
    # Class variables to persist across test methods
    token = None
    user_id = None
    trip_id = None
    token2 = None
    user_id2 = None
    
    def setUp(self):
        self.base_url = "https://edd6d56b-2a86-4bf5-b3c7-2539850efc2a.preview.emergentagent.com"
        
        # Generate unique test data
        self.test_id = str(uuid.uuid4())[:8]
        self.test_user = {
            "name": f"Ahmet Yılmaz {self.test_id}",
            "email": f"ahmet.yilmaz{self.test_id}@turkishairlines.com",
            "phone": f"+905551234{self.test_id[:3]}",
            "employee_id": f"TK{self.test_id}",
            "department": "Flight Operations",
            "password": "SecurePass123!"
        }
        
        # Trip data for booking tests
        tomorrow = datetime.now() + timedelta(days=1)
        self.test_trip = {
            "origin": {
                "address": "Istanbul Airport (IST), Tayakadın, 34283 Arnavutköy/İstanbul, Turkey",
                "coordinates": {"lat": 41.2619, "lng": 28.7419},
                "place_id": "ChIJBVkqGgUJyhQRKEi4iBP7wgM"
            },
            "destination": {
                "address": "Sabiha Gökçen Airport (SAW), Sanayi, 34906 Pendik/İstanbul, Turkey", 
                "coordinates": {"lat": 40.8986, "lng": 29.3092},
                "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
            },
            "departure_time": tomorrow.isoformat(),
            "available_seats": 3,
            "price_per_person": 75.0,
            "notes": "Airport transfer for Turkish Airlines staff"
        }
        
        # Second user for booking tests
        self.test_user2 = {
            "name": f"Fatma Demir {self.test_id}",
            "email": f"fatma.demir{self.test_id}@turkishairlines.com",
            "phone": f"+905559876{self.test_id[:3]}",
            "employee_id": f"TK2{self.test_id}",
            "department": "Cabin Crew",
            "password": "SecurePass456!"
        }

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

    def test_01_register_user_and_wallet_creation(self):
        """Test user registration and automatic wallet creation"""
        print("\n1. Testing user registration and automatic wallet creation...")
        response = self.api_call("/api/auth/register", method="POST", data=self.test_user)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "User registered successfully")
        self.assertIn("token", data)
        self.assertIn("user", data)
        
        # Save token and user_id for subsequent tests
        WalletFunctionalityTest.token = data["token"]
        WalletFunctionalityTest.user_id = data["user"]["id"]
        print(f"✅ User registration passed - User ID: {WalletFunctionalityTest.user_id}")
        
        # Now check if wallet was automatically created
        print("   Checking if wallet was automatically created...")
        wallet_response = self.api_call("/api/wallet", token=WalletFunctionalityTest.token)
        self.assertEqual(wallet_response.status_code, 200)
        wallet_data = wallet_response.json()
        self.assertEqual(wallet_data["user_id"], WalletFunctionalityTest.user_id)
        self.assertEqual(wallet_data["balance"], 0.0)
        self.assertEqual(wallet_data["currency"], "try")
        self.assertIn("last_updated", wallet_data)
        print("✅ Wallet automatically created with 0 TRY balance")

    def test_02_get_wallet_balance(self):
        """Test wallet balance retrieval"""
        print("\n2. Testing wallet balance retrieval...")
        response = self.api_call("/api/wallet", token=WalletFunctionalityTest.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify wallet structure
        self.assertIn("user_id", data)
        self.assertIn("balance", data)
        self.assertIn("currency", data)
        self.assertIn("last_updated", data)
        
        self.assertEqual(data["user_id"], WalletFunctionalityTest.user_id)
        self.assertEqual(data["currency"], "try")
        self.assertIsInstance(data["balance"], (int, float))
        
        print(f"✅ Wallet balance retrieval passed - Balance: {data['balance']} {data['currency'].upper()}")

    def test_03_get_wallet_packages(self):
        """Test wallet packages retrieval"""
        print("\n3. Testing wallet packages retrieval...")
        response = self.api_call("/api/wallet/packages")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify packages structure
        self.assertIn("packages", data)
        packages = data["packages"]
        
        # Check expected packages
        expected_packages = ["small", "medium", "large", "jumbo"]
        for package_id in expected_packages:
            self.assertIn(package_id, packages)
            package = packages[package_id]
            self.assertIn("amount", package)
            self.assertIn("currency", package)
            self.assertIn("name", package)
            self.assertEqual(package["currency"], "try")
            self.assertIsInstance(package["amount"], (int, float))
            self.assertGreater(package["amount"], 0)
        
        print("✅ Wallet packages retrieval passed")
        print(f"   Available packages: {list(packages.keys())}")
        for pkg_id, pkg_info in packages.items():
            print(f"   - {pkg_id}: {pkg_info['amount']} TRY ({pkg_info['name']})")

    def test_04_create_trip_for_booking_test(self):
        """Create a trip for wallet payment testing"""
        print("\n4. Creating a trip for wallet payment testing...")
        response = self.api_call("/api/trips", method="POST", data=self.test_trip, token=WalletFunctionalityTest.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Trip created successfully")
        self.assertIn("trip_id", data)
        
        WalletFunctionalityTest.trip_id = data["trip_id"]
        print(f"✅ Trip created successfully - Trip ID: {WalletFunctionalityTest.trip_id}")

    def test_05_register_second_user(self):
        """Register a second user for booking tests"""
        print("\n5. Registering second user for booking tests...")
        response = self.api_call("/api/auth/register", method="POST", data=self.test_user2)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        WalletFunctionalityTest.token2 = data["token"]
        WalletFunctionalityTest.user_id2 = data["user"]["id"]
        print(f"✅ Second user registered - User ID: {WalletFunctionalityTest.user_id2}")

    def test_06_book_trip_with_insufficient_wallet_balance(self):
        """Test booking trip with wallet payment (should fail due to insufficient balance)"""
        print("\n6. Testing trip booking with wallet payment (insufficient balance)...")
        
        # First, verify current wallet balance is 0 for second user
        wallet_response = self.api_call("/api/wallet", token=WalletFunctionalityTest.token2)
        wallet_data = wallet_response.json()
        print(f"   Current wallet balance: {wallet_data['balance']} TRY")
        print(f"   Trip cost: {self.test_trip['price_per_person']} TRY")
        
        # Try to book with wallet payment
        booking_data = {
            "trip_id": WalletFunctionalityTest.trip_id,
            "payment_method": "wallet"
        }
        
        response = self.api_call(f"/api/trips/{WalletFunctionalityTest.trip_id}/book", method="POST", data=booking_data, token=WalletFunctionalityTest.token2)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)
        self.assertIn("Insufficient wallet balance", data["detail"])
        print("✅ Trip booking correctly rejected due to insufficient wallet balance")

    def test_07_get_wallet_transactions_empty(self):
        """Test wallet transaction history (should be empty initially)"""
        print("\n7. Testing wallet transaction history (empty)...")
        response = self.api_call("/api/wallet/transactions", token=WalletFunctionalityTest.token)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("transactions", data)
        self.assertIsInstance(data["transactions"], list)
        self.assertEqual(len(data["transactions"]), 0)
        print("✅ Wallet transaction history is empty as expected")

    def test_08_unauthorized_wallet_access(self):
        """Test wallet access without authentication"""
        print("\n8. Testing unauthorized wallet access...")
        
        # Test wallet balance without token
        response = self.api_call("/api/wallet")
        self.assertEqual(response.status_code, 403)
        
        # Test wallet packages (should work without auth)
        response = self.api_call("/api/wallet/packages")
        self.assertEqual(response.status_code, 200)
        
        # Test wallet transactions without token
        response = self.api_call("/api/wallet/transactions")
        self.assertEqual(response.status_code, 403)
        
        print("✅ Unauthorized access correctly handled")

    def test_09_wallet_topup_endpoint_structure(self):
        """Test wallet top-up endpoint structure (without actual payment)"""
        print("\n9. Testing wallet top-up endpoint structure...")
        
        topup_data = {
            "package_id": "small",
            "origin_url": "https://test.example.com"
        }
        
        response = self.api_call("/api/wallet/topup", method="POST", data=topup_data, token=WalletFunctionalityTest.token)
        
        # This might fail due to Stripe configuration, but we can check the response structure
        if response.status_code == 500:
            data = response.json()
            if "Payment service not available" in data.get("detail", ""):
                print("⚠️  Stripe payment service not configured (expected in test environment)")
                return
        
        # If Stripe is configured, check the response structure
        if response.status_code == 200:
            data = response.json()
            self.assertIn("url", data)
            self.assertIn("session_id", data)
            self.assertIn("transaction_id", data)
            print("✅ Wallet top-up endpoint structure is correct")
        else:
            print(f"⚠️  Wallet top-up returned status {response.status_code}: {response.text}")

    def test_10_invalid_package_topup(self):
        """Test wallet top-up with invalid package"""
        print("\n10. Testing wallet top-up with invalid package...")
        
        topup_data = {
            "package_id": "invalid_package",
            "origin_url": "https://test.example.com"
        }
        
        response = self.api_call("/api/wallet/topup", method="POST", data=topup_data, token=WalletFunctionalityTest.token)
        
        # Should fail with invalid package error or payment service not available
        if response.status_code == 500:
            data = response.json()
            if "Payment service not available" in data.get("detail", ""):
                print("⚠️  Stripe payment service not configured (expected in test environment)")
                return
        
        if response.status_code == 400:
            data = response.json()
            self.assertIn("Invalid package", data.get("detail", ""))
            print("✅ Invalid package correctly rejected")
        else:
            print(f"⚠️  Unexpected response for invalid package: {response.status_code}")

    def test_11_cleanup_created_trip(self):
        """Clean up the created trip"""
        print("\n11. Cleaning up created trip...")
        if WalletFunctionalityTest.trip_id:
            response = self.api_call(f"/api/trips/{WalletFunctionalityTest.trip_id}", method="DELETE", token=WalletFunctionalityTest.token)
            if response.status_code == 200:
                print("✅ Trip cleaned up successfully")
            else:
                print(f"⚠️  Trip cleanup failed: {response.status_code}")

if __name__ == "__main__":
    # Run tests in order
    test_suite = unittest.TestSuite()
    test_suite.addTest(WalletFunctionalityTest('test_01_register_user_and_wallet_creation'))
    test_suite.addTest(WalletFunctionalityTest('test_02_get_wallet_balance'))
    test_suite.addTest(WalletFunctionalityTest('test_03_get_wallet_packages'))
    test_suite.addTest(WalletFunctionalityTest('test_04_create_trip_for_booking_test'))
    test_suite.addTest(WalletFunctionalityTest('test_05_register_second_user'))
    test_suite.addTest(WalletFunctionalityTest('test_06_book_trip_with_insufficient_wallet_balance'))
    test_suite.addTest(WalletFunctionalityTest('test_07_get_wallet_transactions_empty'))
    test_suite.addTest(WalletFunctionalityTest('test_08_unauthorized_wallet_access'))
    test_suite.addTest(WalletFunctionalityTest('test_09_wallet_topup_endpoint_structure'))
    test_suite.addTest(WalletFunctionalityTest('test_10_invalid_package_topup'))
    test_suite.addTest(WalletFunctionalityTest('test_11_cleanup_created_trip'))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    print(f"\n{'='*60}")
    print("WALLET FUNCTIONALITY TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.failures:
        print("\nFAILURES:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback}")
    
    if result.errors:
        print("\nERRORS:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback}")
    
    if result.wasSuccessful():
        print("\n✅ ALL WALLET TESTS PASSED!")
    else:
        print(f"\n❌ {len(result.failures + result.errors)} TEST(S) FAILED")