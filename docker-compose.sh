#!/bin/bash

# Function to display usage
show_usage() {
    echo "Usage: ./docker-compose.sh [command]"
    echo "Commands:"
    echo "  up - Start containers"
    echo "  down - Stop containers"
    echo "  build - Build containers"
    echo "  restart - Restart containers"
    echo ""
    echo "Example: ./docker-compose.sh up"
}

# Check if command is provided
if [ $# -ne 1 ]; then
    show_usage
    exit 1
fi

# Set command
COMMAND=$1

# Validate command
if [ "$COMMAND" != "up" ] && [ "$COMMAND" != "down" ] && [ "$COMMAND" != "build" ] && [ "$COMMAND" != "restart" ]; then
    echo "Error: Invalid command. Use 'up', 'down', 'build', or 'restart'"
    show_usage
    exit 1
fi

# If command is up or restart, ask for mode
if [ "$COMMAND" = "up" ] || [ "$COMMAND" = "restart" ]; then
    echo "Select deployment mode:"
    echo "1) Local mode (localhost only)"
    echo "2) Network mode (accessible from other devices)"
    read -p "Enter your choice (1 or 2): " choice
    
    case $choice in
        1)
            export DEPLOYMENT_MODE=local
            export SERVER_HOST=localhost
            echo "Starting in LOCAL mode..."
            ;;
        2)
            export DEPLOYMENT_MODE=network
            # Get local IP address
            LOCAL_IP=$(ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
            export SERVER_HOST=$LOCAL_IP
            echo "Starting in NETWORK mode..."
            echo "Warning: Make sure your firewall allows incoming connections on the configured ports"
            ;;
        *)
            echo "Invalid choice. Exiting..."
            exit 1
            ;;
    esac
fi

# Execute docker-compose command
if [ "$COMMAND" = "up" ]; then
    docker-compose up --build -d
elif [ "$COMMAND" = "down" ]; then
    docker-compose down
elif [ "$COMMAND" = "build" ]; then
    docker-compose build
elif [ "$COMMAND" = "restart" ]; then
    docker-compose down
    docker-compose up --build -d
fi

# Show access information if starting containers
if [ "$COMMAND" = "up" ] || [ "$COMMAND" = "restart" ]; then
    echo ""
    echo "Application started successfully!"
    echo "Mode: $DEPLOYMENT_MODE"
    echo ""
    
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        echo "Access the application at: http://localhost"
        echo "Grafana dashboard at: http://localhost:3001"
        echo "Prometheus at: http://localhost:9090"
    else
        echo "Access the application at: http://${SERVER_HOST}"
        echo "Grafana dashboard at: http://${SERVER_HOST}:3001"
        echo "Prometheus at: http://${SERVER_HOST}:9090"
    fi
    
    echo ""
    echo "To stop the application, run: ./docker-compose.sh down"
fi