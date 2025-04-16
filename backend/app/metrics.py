from prometheus_client import Counter, Histogram, Gauge, REGISTRY
from prometheus_client.openmetrics.exposition import generate_latest
from fastapi import Response

# Define metrics
MESSAGE_COUNTER = Counter('rsa_messages_total', 'Total number of messages sent')
ENCRYPTION_COUNTER = Counter('rsa_encryption_operations_total', 'Total number of encryption operations')
DECRYPTION_COUNTER = Counter('rsa_decryption_operations_total', 'Total number of decryption operations')
ACTIVE_USERS = Gauge('rsa_active_users', 'Number of active users')
MESSAGE_LATENCY = Histogram('rsa_message_latency_seconds', 'Message processing latency in seconds')
WEBSOCKET_CONNECTIONS = Gauge('rsa_websocket_connections', 'Number of active WebSocket connections')

def get_metrics():
    return Response(generate_latest(REGISTRY), media_type="text/plain") 