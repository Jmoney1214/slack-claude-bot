#!/bin/bash

##############################################
# Quick Setup Script for Claude Slack Bot
##############################################

echo "🤖 Claude Slack Bot - Quick Setup"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: You need to edit .env with your credentials!"
    echo ""
    echo "   Required credentials:"
    echo "   1. SLACK_BOT_TOKEN (from Slack OAuth)"
    echo "   2. SLACK_SIGNING_SECRET (from Slack Basic Info)"
    echo "   3. SLACK_APP_TOKEN (from Slack Socket Mode)"
    echo "   4. ANTHROPIC_API_KEY (from Anthropic Console)"
    echo ""
    echo "   See SETUP-GUIDE.md for detailed instructions."
    echo ""
    read -p "Press Enter to open .env file for editing..."
    ${EDITOR:-nano} .env
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Make sure .env has all required credentials"
echo "  2. Run 'npm run dev' to test locally"
echo "  3. Deploy to Render for 24/7 operation"
echo ""
echo "📖 Read SETUP-GUIDE.md for complete instructions"
echo ""
