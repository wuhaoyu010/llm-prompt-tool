from app.main import app, LLMConfig

with app.app_context():
    config = LLMConfig.query.first()
    if config:
        print(f"API URL: {config.api_url}")
        print(f"Default model: {config.default_model}")
        print(f"API Key: {'*' * 10 if config.api_key else 'Not set'}")
    else:
        print("No LLM config found in database")
