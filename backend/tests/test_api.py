from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_does_not_require_login():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'

def test_earnings_calculation_is_stateless_and_accurate():
    response = client.post('/api/earnings/calculate', json={
        'language': 'en', 'earned_rupees': 1200.50, 'expenses_rupees': 250.25
    })
    assert response.status_code == 200
    body = response.json()
    assert body['remaining_rupees'] == 950.25
    assert 'not stored' not in body

def test_earnings_reject_negative_values():
    response = client.post('/api/earnings/calculate', json={
        'language': 'en', 'earned_rupees': -1, 'expenses_rupees': 2
    })
    assert response.status_code == 422

def test_chat_validates_task_and_language():
    response = client.post('/api/chat', json={
        'message': 'Help me', 'language': 'fr', 'task': 'general'
    })
    assert response.status_code == 422

def test_chat_has_safe_fallback_without_provider_key(monkeypatch):
    import app.main as main
    monkeypatch.setattr(main, 'OPENAI_API_KEY', '')
    response = client.post('/api/chat', json={
        'message': 'What should I do?', 'language': 'en', 'task': 'safety'
    })
    assert response.status_code == 200
    assert 'safer place' in response.json()['reply']
