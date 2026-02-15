#!/usr/bin/env python3

import json
import os
import requests
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://vrp-admin.preview.emergentagent.com"

class YACoreVRPAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.results = {
            "health_check": [],
            "auth_guards": [],
            "invalid_token": [],
            "not_found": [],
            "summary": {"total": 0, "passed": 0, "failed": 0}
        }

    def add_result(self, category: str, test_name: str, expected: str, actual: str, passed: bool, response_data: Dict[Any, Any] = None):
        result = {
            "test": test_name,
            "expected": expected,
            "actual": actual,
            "passed": passed,
            "response_data": response_data
        }
        self.results[category].append(result)
        self.results["summary"]["total"] += 1
        if passed:
            self.results["summary"]["passed"] += 1
        else:
            self.results["summary"]["failed"] += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            print(f"  Expected: {expected}")
            print(f"  Actual: {actual}")
        if response_data:
            print(f"  Response: {json.dumps(response_data, indent=2)}")
        print()

    def test_health_endpoints(self):
        """Test health check endpoints that don't require authentication"""
        print("=== Testing Health Check Endpoints ===")
        
        # Test GET /api/health
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            status = response.status_code
            try:
                data = response.json()
            except:
                data = {"response": response.text}
                
            expected_status = 200
            expected_data = {"status": "ok", "app": "YA Core VRP"}
            
            passed = (status == expected_status and 
                     data.get("status") == "ok" and 
                     data.get("app") == "YA Core VRP")
            
            self.add_result(
                "health_check", 
                "GET /api/health", 
                f"Status 200, {expected_data}",
                f"Status {status}, {data}",
                passed,
                data
            )
        except Exception as e:
            self.add_result(
                "health_check", 
                "GET /api/health", 
                "Status 200, health response",
                f"Exception: {str(e)}",
                False
            )

        # Test GET /api/ (root endpoint)
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            status = response.status_code
            try:
                data = response.json()
            except:
                data = {"response": response.text}
                
            expected_status = 200
            passed = (status == expected_status and 
                     data.get("status") == "ok" and 
                     data.get("app") == "YA Core VRP")
            
            self.add_result(
                "health_check", 
                "GET /api/", 
                f"Status 200, health response",
                f"Status {status}, {data}",
                passed,
                data
            )
        except Exception as e:
            self.add_result(
                "health_check", 
                "GET /api/", 
                "Status 200, health response",
                f"Exception: {str(e)}",
                False
            )

    def test_auth_guards(self):
        """Test that all admin endpoints return 401 without authentication"""
        print("=== Testing Auth Guards (No Token) ===")
        
        endpoints = [
            ("POST", "/api/profile/ensure", {}),
            ("POST", "/api/admin/set-role", {"target_user_id": "test", "role": "admin"}),
            ("GET", "/api/admin/volunteers", None),
            ("GET", "/api/admin/volunteer/test-id", None),
            ("POST", "/api/admin/sensitive/update", {"target_user_id": "test", "data": "test"}),
            ("GET", "/api/admin/stock", None),
            ("POST", "/api/admin/stock", {"name": "Test Item", "category": "General"}),
            ("POST", "/api/admin/stock/update", {"id": "1", "name": "Updated"}),
            ("POST", "/api/admin/stock/delete", {"id": "1"}),
            ("POST", "/api/admin/stock/issue", {"target_user_id": "test", "stock_item_id": "1", "quantity": 1}),
            ("GET", "/api/admin/stock/history", None),
            ("GET", "/api/admin/stock/search-volunteers?q=test", None)
        ]

        for method, endpoint, payload in endpoints:
            try:
                url = f"{self.base_url}{endpoint}"
                
                if method == "GET":
                    response = requests.get(url, timeout=10)
                elif method == "POST":
                    response = requests.post(url, json=payload, timeout=10)
                
                status = response.status_code
                try:
                    data = response.json()
                except:
                    data = {"response": response.text}
                
                passed = status == 401
                expected = "Status 401 (Unauthorized)"
                actual = f"Status {status}"
                
                if isinstance(data, dict) and data.get("error"):
                    actual += f", Error: {data['error']}"
                
                self.add_result(
                    "auth_guards", 
                    f"{method} {endpoint}", 
                    expected,
                    actual,
                    passed,
                    data if isinstance(data, dict) else {"response": str(data)}
                )
                
            except Exception as e:
                self.add_result(
                    "auth_guards", 
                    f"{method} {endpoint}", 
                    "Status 401 (Unauthorized)",
                    f"Exception: {str(e)}",
                    False
                )

    def test_invalid_token(self):
        """Test that endpoints return 401 with invalid Bearer token"""
        print("=== Testing Auth Guards (Invalid Token) ===")
        
        headers = {"Authorization": "Bearer invalid-token"}
        
        try:
            response = requests.get(f"{self.base_url}/api/admin/stock", headers=headers, timeout=10)
            status = response.status_code
            try:
                data = response.json()
            except:
                data = {"response": response.text}
            
            passed = status == 401
            expected = "Status 401 (Unauthorized)"
            actual = f"Status {status}"
            
            if isinstance(data, dict) and data.get("error"):
                actual += f", Error: {data['error']}"
            
            self.add_result(
                "invalid_token", 
                "GET /api/admin/stock (invalid token)", 
                expected,
                actual,
                passed,
                data if isinstance(data, dict) else {"response": str(data)}
            )
                
        except Exception as e:
            self.add_result(
                "invalid_token", 
                "GET /api/admin/stock (invalid token)", 
                "Status 401 (Unauthorized)",
                f"Exception: {str(e)}",
                False
            )

    def test_not_found(self):
        """Test 404 handling for non-existent routes"""
        print("=== Testing 404 Handling ===")
        
        try:
            response = requests.get(f"{self.base_url}/api/nonexistent", timeout=10)
            status = response.status_code
            try:
                data = response.json()
            except:
                data = {"response": response.text}
            
            passed = status == 404
            expected = "Status 404 (Not Found)"
            actual = f"Status {status}"
            
            if isinstance(data, dict) and data.get("error"):
                actual += f", Error: {data['error']}"
            
            self.add_result(
                "not_found", 
                "GET /api/nonexistent", 
                expected,
                actual,
                passed,
                data if isinstance(data, dict) else {"response": str(data)}
            )
                
        except Exception as e:
            self.add_result(
                "not_found", 
                "GET /api/nonexistent", 
                "Status 404 (Not Found)",
                f"Exception: {str(e)}",
                False
            )

    def run_all_tests(self):
        """Run all test suites"""
        print(f"Starting YA Core VRP API Tests against {self.base_url}\n")
        
        self.test_health_endpoints()
        self.test_auth_guards()
        self.test_invalid_token()
        self.test_not_found()
        
        # Print summary
        print("=" * 50)
        print("TEST SUMMARY")
        print("=" * 50)
        summary = self.results["summary"]
        print(f"Total Tests: {summary['total']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Success Rate: {(summary['passed']/summary['total']*100):.1f}%")
        
        if summary['failed'] > 0:
            print("\nFAILED TESTS:")
            for category, tests in self.results.items():
                if category != "summary" and isinstance(tests, list):
                    for test in tests:
                        if not test["passed"]:
                            print(f"- {test['test']}: {test['actual']}")
        
        return self.results

def main():
    """Main entry point"""
    tester = YACoreVRPAPITester()
    results = tester.run_all_tests()
    
    # Return results for further processing if needed
    return results

if __name__ == "__main__":
    main()