import requests
import os
import json

# 从环境变量或直接使用您提供的密钥
API_KEY = os.environ.get("SILICONFLOW_API_KEY", "sk-hfqxjiqrbisrhswnuremgmvlsoadasaclyjmzlnzhxdhnqqi")
API_URL = "https://api.siliconflow.cn/v1/chat/completions"

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}

data = {
    "model": "Pro/Qwen/Qwen2.5-VL-7B-Instruct",
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What's in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://sf-maas-uat-prod.oss-cn-shanghai.aliyuncs.com/suggestion/lbygavkzjykewmmpnzfutkvedlowunms.png"
                    }
                }
            ]
        }
    ],
    "temperature": 0.7,
    "max_tokens": 1000
}

print("--- Sending Request ---")
print(f"URL: {API_URL}")
print(f"Headers: {json.dumps(headers, indent=2)}")
print(f"Data: {json.dumps(data, indent=2)}")

try:
    response = requests.post(API_URL, headers=headers, json=data, timeout=30)
    
    print("\n--- Response --- ")
    print(f"Status Code: {response.status_code}")
    
    # 尝试解析JSON，如果失败则打印原始文本
    try:
        response_json = response.json()
        print("Response JSON:")
        print(json.dumps(response_json, indent=2, ensure_ascii=False))
    except json.JSONDecodeError:
        print("Response Text (Not JSON):")
        print(response.text)

except requests.exceptions.RequestException as e:
    print(f"\n--- An error occurred ---")
    print(e)
