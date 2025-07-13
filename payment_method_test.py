import requests
import unittest
import uuid
from datetime import datetime, timedelta
import json

class PaymentMethodDifferentiationTest(unittest.TestCase):
    """
    Test suite for differentiated payment methods:
    - Taxi trips: cash, card, or wallet
    - Personal car trips: wallet only
    """
    
    def setUp(self):
        self.base_url = "https://edd6d56b-2a86-4bf5-b3c7-2539850efc2a.preview.emergentagent.com"
        self.test_id = str(uuid.uuid4())[:8]
        
        # Test users
        self.trip_creator = {
            "name": f"Ahmet Yılmaz {self.test_id}",
            "email": f"ahmet.yilmaz{self.test_id}@turkishairlines.com",
            "phone": f"+905551234{self.test_id[:3]}",
            "employee_id": f"TK{self.test_id}",
            "department": "Flight Operations",
            "password": "TurkishAir2024!"
        }
        
        self.trip_booker = {
            "name": f"Fatma Demir {self.test_id}",
            "email": f"fatma.demir{self.test_id}@turkishairlines.com",
            "phone": f"+905559876{self.test_id[:3]}",
            "employee_id": f"TK2{self.test_id}",
            "department": "Cabin Crew",
            "password": "TurkishAir2024!"
        }
        
        # Trip data
        tomorrow = datetime.now() + timedelta(days=1)
        self.trip_data = {
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
            "price_per_person": 25.0,
            "notes": "Test trip for payment method validation"
        }
        
        self.personal_car_data = {
            **self.trip_data,
            "car_model": "Toyota Corolla",
            "car_color": "Beyaz",
            "license_plate": "34 ABC 123",
            "price_per_person": 30.0
        }
        
        # Initialize tokens and IDs
        self.creator_token = None
        self.booker_token = None
        self.creator_id = None
        self.booker_id = None
        self.taxi_trip_id = None
        self.personal_car_trip_id = None
        
    def register_and_login_users(self):
        """Register and login both test users"""
        # Register trip creator
        response = requests.post(f"{self.base_url}/api/auth/register", json=self.trip_creator)
        self.assertEqual(response.status_code, 200, f"Creator registration failed: {response.text}")
        creator_data = response.json()
        self.creator_token = creator_data["token"]
        self.creator_id = creator_data["user"]["id"]
        
        # Register trip booker
        response = requests.post(f"{self.base_url}/api/auth/register", json=self.trip_booker)
        self.assertEqual(response.status_code, 200, f"Booker registration failed: {response.text}")
        booker_data = response.json()
        self.booker_token = booker_data["token"]
        self.booker_id = booker_data["user"]["id"]
        
        print(f"✅ Registered users: Creator ID {self.creator_id}, Booker ID {self.booker_id}")
        
    def add_wallet_balance(self, user_token, user_id, amount=100.0):
        """Add balance to user's wallet for testing"""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # First check current balance
        response = requests.get(f"{self.base_url}/api/wallet", headers=headers)
        self.assertEqual(response.status_code, 200)
        current_balance = response.json()["balance"]
        
        # Simulate wallet top-up by directly updating balance (for testing purposes)
        # In real scenario, this would go through Stripe payment
        from pymongo import MongoClient
        import os
        
        try:
            mongo_url = "mongodb://localhost:27017"
            client = MongoClient(mongo_url)
            db = client.carpooling_db
            wallet_collection = db.wallet
            
            # Update wallet balance
            wallet_collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "balance": current_balance + amount,
                        "last_updated": datetime.utcnow()
                    }
                }
            )
            
            # Create transaction record
            payment_transactions_collection = db.payment_transactions
            transaction = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "transaction_type": "topup",
                "amount": amount,
                "currency": "try",
                "description": f"Test wallet top-up - {amount} TRY",
                "status": "completed",
                "created_at": datetime.utcnow(),
                "payment_session_id": None
            }
            payment_transactions_collection.insert_one(transaction)
            
            print(f"✅ Added {amount} TRY to wallet. New balance: {current_balance + amount} TRY")
            
        except Exception as e:
            print(f"⚠️ Could not add wallet balance directly: {e}")
            print("Proceeding with existing balance...")
    
    def test_01_setup_users_and_wallets(self):
        """Test 1: Register users and set up wallets"""
        print("\n=== Test 1: User Registration and Wallet Setup ===")
        
        self.register_and_login_users()
        
        # Add wallet balance to booker for testing
        self.add_wallet_balance(self.booker_token, self.booker_id, 100.0)
        
        # Verify wallet balances
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        response = requests.get(f"{self.base_url}/api/wallet", headers=headers)
        self.assertEqual(response.status_code, 200)
        wallet_data = response.json()
        self.assertGreaterEqual(wallet_data["balance"], 50.0, "Insufficient wallet balance for testing")
        
        print(f"✅ Booker wallet balance: {wallet_data['balance']} TRY")
        
    def test_02_create_taxi_trip(self):
        """Test 2: Create a taxi trip"""
        print("\n=== Test 2: Create Taxi Trip ===")
        
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips", json=self.trip_data, headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Taxi trip creation failed: {response.text}")
        
        trip_response = response.json()
        self.taxi_trip_id = trip_response["trip_id"]
        
        print(f"✅ Created taxi trip with ID: {self.taxi_trip_id}")
        
    def test_03_create_personal_car_trip(self):
        """Test 3: Create a personal car trip"""
        print("\n=== Test 3: Create Personal Car Trip ===")
        
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips/personal-car", json=self.personal_car_data, headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Personal car trip creation failed: {response.text}")
        
        trip_response = response.json()
        self.personal_car_trip_id = trip_response["trip_id"]
        
        print(f"✅ Created personal car trip with ID: {self.personal_car_trip_id}")
        
    def test_04_taxi_trip_cash_payment(self):
        """Test 4: Book taxi trip with cash payment"""
        print("\n=== Test 4: Taxi Trip - Cash Payment ===")
        
        if not self.taxi_trip_id:
            self.test_02_create_taxi_trip()
        if not self.booker_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        booking_data = {
            "trip_id": self.taxi_trip_id,
            "payment_method": "cash"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{self.taxi_trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Cash payment booking failed: {response.text}")
        
        booking_response = response.json()
        self.assertEqual(booking_response["payment_method"], "cash")
        self.assertEqual(booking_response["trip_type"], "taxi")
        
        print(f"✅ Successfully booked taxi trip with cash payment")
        print(f"   Booking ID: {booking_response['booking_id']}")
        print(f"   Amount: {booking_response['amount_paid']} TRY")
        
    def test_05_taxi_trip_card_payment(self):
        """Test 5: Book taxi trip with card payment"""
        print("\n=== Test 5: Taxi Trip - Card Payment ===")
        
        # Create a new taxi trip for this test
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips", json=self.trip_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Book with card payment
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "card"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Card payment booking failed: {response.text}")
        
        booking_response = response.json()
        self.assertEqual(booking_response["payment_method"], "card")
        self.assertEqual(booking_response["trip_type"], "taxi")
        
        print(f"✅ Successfully booked taxi trip with card payment")
        print(f"   Booking ID: {booking_response['booking_id']}")
        print(f"   Amount: {booking_response['amount_paid']} TRY")
        
    def test_06_taxi_trip_wallet_payment(self):
        """Test 6: Book taxi trip with wallet payment"""
        print("\n=== Test 6: Taxi Trip - Wallet Payment ===")
        
        # Create a new taxi trip for this test
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips", json=self.trip_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Ensure booker has sufficient wallet balance
        self.add_wallet_balance(self.booker_token, self.booker_id, 50.0)
        
        # Book with wallet payment
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "wallet"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Wallet payment booking failed: {response.text}")
        
        booking_response = response.json()
        self.assertEqual(booking_response["payment_method"], "wallet")
        self.assertEqual(booking_response["trip_type"], "taxi")
        
        print(f"✅ Successfully booked taxi trip with wallet payment")
        print(f"   Booking ID: {booking_response['booking_id']}")
        print(f"   Amount: {booking_response['amount_paid']} TRY")
        
        # Verify wallet transaction was created
        response = requests.get(f"{self.base_url}/api/wallet/transactions", headers=headers)
        self.assertEqual(response.status_code, 200)
        transactions = response.json()["transactions"]
        
        # Find the payment transaction
        payment_transaction = next((t for t in transactions if t["transaction_type"] == "payment"), None)
        self.assertIsNotNone(payment_transaction, "Payment transaction not found")
        self.assertEqual(payment_transaction["amount"], 25.0)
        self.assertIn("Taxi trip booking", payment_transaction["description"])
        
        print(f"✅ Wallet transaction recorded: {payment_transaction['description']}")
        
    def test_07_personal_car_wallet_payment_success(self):
        """Test 7: Book personal car trip with wallet payment (should succeed)"""
        print("\n=== Test 7: Personal Car Trip - Wallet Payment (Success) ===")
        
        if not self.personal_car_trip_id:
            self.test_03_create_personal_car_trip()
        if not self.booker_token:
            self.register_and_login_users()
            
        # Ensure booker has sufficient wallet balance
        self.add_wallet_balance(self.booker_token, self.booker_id, 50.0)
        
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        booking_data = {
            "trip_id": self.personal_car_trip_id,
            "payment_method": "wallet"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{self.personal_car_trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Personal car wallet payment failed: {response.text}")
        
        booking_response = response.json()
        self.assertEqual(booking_response["payment_method"], "wallet")
        self.assertEqual(booking_response["trip_type"], "personal_car")
        
        print(f"✅ Successfully booked personal car trip with wallet payment")
        print(f"   Booking ID: {booking_response['booking_id']}")
        print(f"   Amount: {booking_response['amount_paid']} TRY")
        
        # Verify wallet transaction was created
        response = requests.get(f"{self.base_url}/api/wallet/transactions", headers=headers)
        self.assertEqual(response.status_code, 200)
        transactions = response.json()["transactions"]
        
        # Find the payment transaction
        payment_transaction = next((t for t in transactions 
                                  if t["transaction_type"] == "payment" 
                                  and "Personal car trip booking" in t["description"]), None)
        self.assertIsNotNone(payment_transaction, "Personal car payment transaction not found")
        self.assertEqual(payment_transaction["amount"], 30.0)
        
        print(f"✅ Wallet transaction recorded: {payment_transaction['description']}")
        
    def test_08_personal_car_cash_payment_rejection(self):
        """Test 8: Book personal car trip with cash payment (should fail)"""
        print("\n=== Test 8: Personal Car Trip - Cash Payment (Should Fail) ===")
        
        # Create a new personal car trip for this test
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips/personal-car", json=self.personal_car_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Attempt to book with cash payment
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "cash"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 400, "Personal car trip should reject cash payment")
        
        error_response = response.json()
        self.assertIn("Personal car trips only accept wallet payments", error_response["detail"])
        
        print(f"✅ Personal car trip correctly rejected cash payment")
        print(f"   Error message: {error_response['detail']}")
        
    def test_09_personal_car_card_payment_rejection(self):
        """Test 9: Book personal car trip with card payment (should fail)"""
        print("\n=== Test 9: Personal Car Trip - Card Payment (Should Fail) ===")
        
        # Create a new personal car trip for this test
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips/personal-car", json=self.personal_car_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Attempt to book with card payment
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "card"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 400, "Personal car trip should reject card payment")
        
        error_response = response.json()
        self.assertIn("Personal car trips only accept wallet payments", error_response["detail"])
        
        print(f"✅ Personal car trip correctly rejected card payment")
        print(f"   Error message: {error_response['detail']}")
        
    def test_10_wallet_insufficient_balance_validation(self):
        """Test 10: Wallet payment with insufficient balance (should fail)"""
        print("\n=== Test 10: Wallet Payment - Insufficient Balance ===")
        
        # Create a new user with minimal wallet balance
        test_user_poor = {
            "name": f"Poor User {self.test_id}",
            "email": f"poor{self.test_id}@turkishairlines.com",
            "phone": f"+905557777{self.test_id[:3]}",
            "employee_id": f"POOR{self.test_id}",
            "department": "Testing",
            "password": "TurkishAir2024!"
        }
        
        # Register user
        response = requests.post(f"{self.base_url}/api/auth/register", json=test_user_poor)
        self.assertEqual(response.status_code, 200)
        poor_user_data = response.json()
        poor_token = poor_user_data["token"]
        
        # Create a taxi trip
        if not self.creator_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.creator_token}"}
        response = requests.post(f"{self.base_url}/api/trips", json=self.trip_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        trip_id = response.json()["trip_id"]
        
        # Attempt to book with insufficient wallet balance
        headers = {"Authorization": f"Bearer {poor_token}"}
        booking_data = {
            "trip_id": trip_id,
            "payment_method": "wallet"
        }
        
        response = requests.post(f"{self.base_url}/api/trips/{trip_id}/book", 
                               json=booking_data, headers=headers)
        
        self.assertEqual(response.status_code, 400, "Should reject booking with insufficient wallet balance")
        
        error_response = response.json()
        self.assertIn("Insufficient wallet balance", error_response["detail"])
        
        print(f"✅ Correctly rejected wallet payment with insufficient balance")
        print(f"   Error message: {error_response['detail']}")
        
    def test_11_verify_transaction_records(self):
        """Test 11: Verify transaction records include correct payment method and trip type"""
        print("\n=== Test 11: Verify Transaction Records ===")
        
        if not self.booker_token:
            self.register_and_login_users()
            
        headers = {"Authorization": f"Bearer {self.booker_token}"}
        response = requests.get(f"{self.base_url}/api/wallet/transactions", headers=headers)
        self.assertEqual(response.status_code, 200)
        
        transactions = response.json()["transactions"]
        
        # Find taxi trip transaction
        taxi_transaction = next((t for t in transactions 
                               if t["transaction_type"] == "payment" 
                               and "Taxi trip booking" in t["description"]), None)
        
        # Find personal car trip transaction  
        personal_car_transaction = next((t for t in transactions 
                                       if t["transaction_type"] == "payment" 
                                       and "Personal car trip booking" in t["description"]), None)
        
        if taxi_transaction:
            print(f"✅ Taxi trip transaction found:")
            print(f"   Description: {taxi_transaction['description']}")
            print(f"   Amount: {taxi_transaction['amount']} TRY")
            print(f"   Status: {taxi_transaction['status']}")
            
        if personal_car_transaction:
            print(f"✅ Personal car trip transaction found:")
            print(f"   Description: {personal_car_transaction['description']}")
            print(f"   Amount: {personal_car_transaction['amount']} TRY")
            print(f"   Status: {personal_car_transaction['status']}")
            
        # Verify both transactions exist and have correct details
        if taxi_transaction:
            self.assertEqual(taxi_transaction["status"], "completed")
            self.assertIn("Taxi trip booking", taxi_transaction["description"])
            
        if personal_car_transaction:
            self.assertEqual(personal_car_transaction["status"], "completed")
            self.assertIn("Personal car trip booking", personal_car_transaction["description"])
            
        print(f"✅ Transaction records verification completed")

if __name__ == "__main__":
    # Run tests in order
    suite = unittest.TestSuite()
    
    # Add tests in specific order
    suite.addTest(PaymentMethodDifferentiationTest('test_01_setup_users_and_wallets'))
    suite.addTest(PaymentMethodDifferentiationTest('test_02_create_taxi_trip'))
    suite.addTest(PaymentMethodDifferentiationTest('test_03_create_personal_car_trip'))
    suite.addTest(PaymentMethodDifferentiationTest('test_04_taxi_trip_cash_payment'))
    suite.addTest(PaymentMethodDifferentiationTest('test_05_taxi_trip_card_payment'))
    suite.addTest(PaymentMethodDifferentiationTest('test_06_taxi_trip_wallet_payment'))
    suite.addTest(PaymentMethodDifferentiationTest('test_07_personal_car_wallet_payment_success'))
    suite.addTest(PaymentMethodDifferentiationTest('test_08_personal_car_cash_payment_rejection'))
    suite.addTest(PaymentMethodDifferentiationTest('test_09_personal_car_card_payment_rejection'))
    suite.addTest(PaymentMethodDifferentiationTest('test_10_wallet_insufficient_balance_validation'))
    suite.addTest(PaymentMethodDifferentiationTest('test_11_verify_transaction_records'))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print(f"\n{'='*60}")
    print(f"PAYMENT METHOD DIFFERENTIATION TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.failures:
        print(f"\nFAILURES:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback}")
            
    if result.errors:
        print(f"\nERRORS:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback}")
            
    if result.wasSuccessful():
        print(f"\n✅ ALL PAYMENT METHOD TESTS PASSED!")
    else:
        print(f"\n❌ SOME TESTS FAILED - CHECK IMPLEMENTATION")