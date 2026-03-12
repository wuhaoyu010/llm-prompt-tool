import requests

# 测试 /api/models 接口
try:
    response = requests.get('http://localhost:5001/api/models', timeout=5)
    result = response.json()
    print("API Response:")
    print(f"  Models count: {len(result.get('models', []))}")
    print(f"  Default model: {result.get('default_model')}")
    if result.get('models'):
        print(f"  First model: {result['models'][0].get('id')}")
except Exception as e:
    print(f"Error: {e}")
    print("\nNote: Make sure the application is running on http://localhost:5001")
