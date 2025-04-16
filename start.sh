#!/bin/bash

# Function to display usage
show_usage() {
    echo "Usage: ./start.sh [mode]"
    echo "Modes:"
    echo "  local   - Run in local mode (localhost only)"
    echo "  network - Run in network mode (accessible from other devices)"
    echo ""
    echo "Example: ./start.sh local"
}

# Check if mode is provided
if [ $# -ne 1 ]; then
    show_usage
    exit 1
fi

# Set mode
MODE=$1

# Validate mode
if [ "$MODE" != "local" ] && [ "$MODE" != "network" ]; then
    echo "Error: Invalid mode. Use 'local' or 'network'"
    show_usage
    exit 1
fi

# Set environment variables based on mode
if [ "$MODE" = "local" ]; then
    export DEPLOYMENT_MODE=local
    export SERVER_HOST=localhost
    echo "Starting in LOCAL mode..."
else
    export DEPLOYMENT_MODE=network
    export SERVER_HOST=0.0.0.0
    echo "Starting in NETWORK mode..."
    echo "Warning: Make sure your firewall allows incoming connections on the configured ports"
fi

# Stop any running containers
echo "Stopping existing containers..."
docker-compose down

# Start the application
echo "Starting containers..."
docker-compose up --build -d

# Show access information
echo ""
echo "Application started successfully!"
echo "Mode: $MODE"
echo ""
if [ "$MODE" = "local" ]; then
    echo "Access the application at: http://localhost"
    echo "Grafana dashboard at: http://localhost:3001"
    echo "Prometheus at: http://localhost:9090"
else
    echo "Access the application at: http://$(hostname -I | awk '{print $1}')"
    echo "Grafana dashboard at: http://$(hostname -I | awk '{print $1}'):3001"
    echo "Prometheus at: http://$(hostname -I | awk '{print $1}'):9090"
fi
echo ""
echo "To stop the application, run: docker-compose down" 