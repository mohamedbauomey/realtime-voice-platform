#!/bin/bash

echo "🚀 Setting up Voice Platform for Local Development"
echo "=================================================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Please install it first."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required. Please install it first."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infrastructure
echo "🐳 Starting Docker services..."
npm run services:start

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️ Setting up database..."
npx prisma migrate dev --name init

# Seed database with test data
echo "🌱 Seeding database..."
npx prisma db seed

# Build project
echo "🔨 Building project..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "To start the platform:"
echo "  npm run dev"
echo ""
echo "Dashboard: http://localhost:8080"
echo "API Docs: http://localhost:8080/api/docs"