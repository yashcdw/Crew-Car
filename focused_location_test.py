import requests
import json
import uuid
from datetime import datetime, timedelta

def test_location_airport_features():
    """Comprehensive test for location and airport features"""
    base_url = "https://edd6d56b-2a86-4bf5-b3c7-2539850efc2a.preview.emergentagent.com"
    
    # Generate unique test data
    test_id = str(uuid.uuid4())[:8]
    
    # Istanbul coordinates for testing
    istanbul_home = {
        "address": "Levent, Beşiktaş/İstanbul, Turkey",
        "coordinates": {"lat": 41.0814, "lng": 29.0128},
        "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
    }
    
    # Test user with home address
    test_user = {
        "name": f"Ahmet Yılmaz {test_id}",
        "email": f"ahmet.yilmaz{test_id}@turkishairlines.com",
        "phone": f"+905551234{test_id[:3]}",
        "employee_id": f"TK{test_id}",
        "department": "Flight Operations",
        "password": "TurkishAir123!",
        "home_address": istanbul_home
    }
    
    # Second user without home address initially
    test_user2 = {
        "name": f"Fatma Demir {test_id}",
        "email": f"fatma.demir{test_id}@turkishairlines.com",
        "phone": f"+905559876{test_id[:3]}",
        "employee_id": f"TK2{test_id}",
        "department": "Cabin Crew",
        "password": "TurkishAir123!"
    }
    
    # Airport trip data
    tomorrow = datetime.now() + timedelta(days=1)
    airport_trip = {
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
        "price_per_person": 75.0,
        "notes": "Airport shuttle service"
    }
    
    # Regular trip (non-airport)
    regular_trip = {
        "origin": {
            "address": "Kadıköy, İstanbul, Turkey",
            "coordinates": {"lat": 40.9833, "lng": 29.0167},
            "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
        },
        "destination": {
            "address": "Beşiktaş, İstanbul, Turkey", 
            "coordinates": {"lat": 41.0422, "lng": 29.0061},
            "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
        },
        "departure_time": tomorrow.isoformat(),
        "available_seats": 2,
        "price_per_person": 25.0,
        "notes": "Regular city trip"
    }
    
    # Personal car airport trip
    personal_car_airport_trip = {
        "origin": {
            "address": "Sabiha Gökçen Airport (SAW), İstanbul, Turkey",
            "coordinates": {"lat": 40.8986, "lng": 29.3092},
            "place_id": "ChIJBVkqGgUJyhQRKEi4iBP7wgM"
        },
        "destination": {
            "address": "Ataşehir, İstanbul, Turkey", 
            "coordinates": {"lat": 40.9833, "lng": 29.1167},
            "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
        },
        "departure_time": tomorrow.isoformat(),
        "available_seats": 3,
        "price_per_person": 60.0,
        "notes": "Personal car from Sabiha Gökçen",
        "car_model": "Toyota Corolla",
        "car_color": "White",
        "license_plate": "34 ABC 123"
    }
    
    def api_call(endpoint, method="GET", data=None, token=None):
        url = f"{base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        return response
    
    results = []
    
    # Test 1: Register user with home address
    print("1. Testing user registration with home address...")
    try:
        response = api_call("/api/auth/register", method="POST", data=test_user)
        if response.status_code == 200:
            data = response.json()
            token = data["token"]
            user_id = data["user"]["id"]
            
            # Verify home address is included
            if data["user"]["home_address"] and data["user"]["home_address"]["address"] == istanbul_home["address"]:
                results.append("✅ User registration with home address: PASSED")
            else:
                results.append("❌ User registration with home address: FAILED - Home address not properly stored")
        else:
            results.append(f"❌ User registration with home address: FAILED - Status {response.status_code}")
            return results
    except Exception as e:
        results.append(f"❌ User registration with home address: ERROR - {str(e)}")
        return results
    
    # Test 2: Register user without home address
    print("2. Testing user registration without home address...")
    try:
        response = api_call("/api/auth/register", method="POST", data=test_user2)
        if response.status_code == 200:
            data = response.json()
            token2 = data["token"]
            user_id2 = data["user"]["id"]
            
            # Verify home address is None
            if data["user"]["home_address"] is None:
                results.append("✅ User registration without home address: PASSED")
            else:
                results.append("❌ User registration without home address: FAILED - Home address should be None")
        else:
            results.append(f"❌ User registration without home address: FAILED - Status {response.status_code}")
            return results
    except Exception as e:
        results.append(f"❌ User registration without home address: ERROR - {str(e)}")
        return results
    
    # Test 3: Get profile with home address
    print("3. Testing get user profile with home address...")
    try:
        response = api_call("/api/user/profile", token=token)
        if response.status_code == 200:
            data = response.json()
            if data["home_address"] and data["home_address"]["address"] == istanbul_home["address"]:
                results.append("✅ Get user profile with home address: PASSED")
            else:
                results.append("❌ Get user profile with home address: FAILED - Home address not returned")
        else:
            results.append(f"❌ Get user profile with home address: FAILED - Status {response.status_code}")
    except Exception as e:
        results.append(f"❌ Get user profile with home address: ERROR - {str(e)}")
    
    # Test 4: Update profile to add home address
    print("4. Testing update user profile to add home address...")
    try:
        new_home = {
            "address": "Üsküdar, İstanbul, Turkey",
            "coordinates": {"lat": 41.0214, "lng": 29.0161},
            "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
        }
        
        update_data = {
            "name": test_user2["name"],
            "email": test_user2["email"],
            "phone": test_user2["phone"],
            "employee_id": test_user2["employee_id"],
            "department": test_user2["department"],
            "home_address": new_home
        }
        
        response = api_call("/api/user/profile", method="PUT", data=update_data, token=token2)
        if response.status_code == 200:
            # Verify the update
            response = api_call("/api/user/profile", token=token2)
            if response.status_code == 200:
                data = response.json()
                if data["home_address"] and data["home_address"]["address"] == new_home["address"]:
                    results.append("✅ Update user profile to add home address: PASSED")
                else:
                    results.append("❌ Update user profile to add home address: FAILED - Home address not updated")
            else:
                results.append("❌ Update user profile to add home address: FAILED - Could not verify update")
        else:
            results.append(f"❌ Update user profile to add home address: FAILED - Status {response.status_code}")
    except Exception as e:
        results.append(f"❌ Update user profile to add home address: ERROR - {str(e)}")
    
    # Test 5: Create airport trip
    print("5. Testing airport trip creation...")
    try:
        response = api_call("/api/trips", method="POST", data=airport_trip, token=token)
        if response.status_code == 200:
            data = response.json()
            trip_id = data["trip_id"]
            results.append("✅ Airport trip creation: PASSED")
        else:
            results.append(f"❌ Airport trip creation: FAILED - Status {response.status_code}")
            trip_id = None
    except Exception as e:
        results.append(f"❌ Airport trip creation: ERROR - {str(e)}")
        trip_id = None
    
    # Test 6: Create regular trip
    print("6. Testing regular trip creation...")
    try:
        response = api_call("/api/trips", method="POST", data=regular_trip, token=token2)
        if response.status_code == 200:
            results.append("✅ Regular trip creation: PASSED")
        else:
            results.append(f"❌ Regular trip creation: FAILED - Status {response.status_code}")
    except Exception as e:
        results.append(f"❌ Regular trip creation: ERROR - {str(e)}")
    
    # Test 7: Create personal car airport trip
    print("7. Testing personal car airport trip creation...")
    try:
        response = api_call("/api/trips/personal-car", method="POST", data=personal_car_airport_trip, token=token)
        if response.status_code == 200:
            data = response.json()
            personal_car_trip_id = data["trip_id"]
            results.append("✅ Personal car airport trip creation: PASSED")
        else:
            results.append(f"❌ Personal car airport trip creation: FAILED - Status {response.status_code}")
            personal_car_trip_id = None
    except Exception as e:
        results.append(f"❌ Personal car airport trip creation: ERROR - {str(e)}")
        personal_car_trip_id = None
    
    # Test 8: Get airport trips with home address
    print("8. Testing get airport trips with home address...")
    try:
        response = api_call("/api/trips/airport", token=token)
        if response.status_code == 200:
            data = response.json()
            
            # Verify structure
            if "trips" in data and "user_home_address" in data and "total_found" in data:
                # Verify user home address is included
                if data["user_home_address"] is not None:
                    # Verify airport trips are returned
                    airport_trips_found = 0
                    for trip in data["trips"]:
                        trip_address = trip["origin"]["address"].lower() + " " + trip["destination"]["address"].lower()
                        if any(keyword in trip_address for keyword in ["airport", "havalimanı", "havaalanı", "ist", "saw"]):
                            airport_trips_found += 1
                    
                    if airport_trips_found > 0:
                        results.append(f"✅ Get airport trips with home address: PASSED - Found {airport_trips_found} airport trips")
                    else:
                        results.append("❌ Get airport trips with home address: FAILED - No airport trips found")
                else:
                    results.append("❌ Get airport trips with home address: FAILED - User home address not included")
            else:
                results.append("❌ Get airport trips with home address: FAILED - Invalid response structure")
        else:
            results.append(f"❌ Get airport trips with home address: FAILED - Status {response.status_code}")
    except Exception as e:
        results.append(f"❌ Get airport trips with home address: ERROR - {str(e)}")
    
    # Test 9: Verify airport trip filtering
    print("9. Testing airport trip filtering...")
    try:
        response = api_call("/api/trips/airport", token=token)
        if response.status_code == 200:
            data = response.json()
            
            # Verify all returned trips are airport-related
            all_airport_related = True
            for trip in data["trips"]:
                trip_address = trip["origin"]["address"].lower() + " " + trip["destination"]["address"].lower()
                is_airport_trip = any(keyword in trip_address for keyword in ["airport", "havalimanı", "havaalanı", "ist", "saw"])
                if not is_airport_trip:
                    all_airport_related = False
                    break
            
            if all_airport_related:
                results.append("✅ Airport trip filtering: PASSED - All returned trips are airport-related")
            else:
                results.append("❌ Airport trip filtering: FAILED - Non-airport trips found in results")
        else:
            results.append(f"❌ Airport trip filtering: FAILED - Status {response.status_code}")
    except Exception as e:
        results.append(f"❌ Airport trip filtering: ERROR - {str(e)}")
    
    # Test 10: Book trip with home pickup address
    print("10. Testing trip booking with home pickup address...")
    if trip_id:
        try:
            booking_data = {
                "trip_id": trip_id,
                "payment_method": "cash",  # Use cash to avoid wallet balance issues
                "home_address": {
                    "address": "Üsküdar, İstanbul, Turkey",
                    "coordinates": {"lat": 41.0214, "lng": 29.0161},
                    "place_id": "ChIJrTLr-GyuyhQRc4UqFAgKXA0"
                }
            }
            
            response = api_call(f"/api/trips/{trip_id}/book", method="POST", data=booking_data, token=token2)
            if response.status_code == 200:
                data = response.json()
                if "booking_id" in data and data["payment_method"] == "cash":
                    results.append("✅ Trip booking with home pickup address: PASSED")
                else:
                    results.append("❌ Trip booking with home pickup address: FAILED - Invalid response")
            else:
                results.append(f"❌ Trip booking with home pickup address: FAILED - Status {response.status_code}")
        except Exception as e:
            results.append(f"❌ Trip booking with home pickup address: ERROR - {str(e)}")
    else:
        results.append("❌ Trip booking with home pickup address: SKIPPED - No trip ID available")
    
    return results

if __name__ == "__main__":
    print("="*60)
    print("LOCATION & AIRPORT FEATURES TEST")
    print("="*60)
    
    results = test_location_airport_features()
    
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = 0
    failed = 0
    
    for result in results:
        print(result)
        if "✅" in result:
            passed += 1
        else:
            failed += 1
    
    print(f"\n📊 SUMMARY: {passed} passed, {failed} failed out of {len(results)} tests")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Location and airport features are working correctly.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review the issues above.")