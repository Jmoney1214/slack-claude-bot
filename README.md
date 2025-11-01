# 🤖 24/7 Claude-Powered Slack Bot

Your personal AI business assistant, available 24/7 via Slack, powered by Claude API.

## ⚡ Features

- **🎯 Always Available** - Hosted in the cloud, responds 24/7
- **💬 Natural Conversations** - Powered by Claude Sonnet 4.5
- **📊 Real-time Sales Data** - Integrates with Lightspeed POS
- **🔍 Business Intelligence** - Analyzes trends and provides insights
- **💡 Proactive Alerts** - Can notify you of important events
- **🔒 Secure** - Uses industry-standard authentication

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd slack-claude-bot
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-secret
SLACK_APP_TOKEN=xapp-your-token
ANTHROPIC_API_KEY=sk-ant-your-key
```

### 3. Run Locally (Testing)

```bash
npm run dev
```

### 4. Deploy to Production

See [SETUP-GUIDE.md](./SETUP-GUIDE.md) for complete deployment instructions.

Quick deploy to Render:
```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

Then deploy via Render dashboard.

## 📖 Documentation

- **[SETUP-GUIDE.md](./SETUP-GUIDE.md)** - Complete setup instructions
- **[server.js](./server.js)** - Main bot code (well-commented)

## 💬 Usage

### In Slack

**Mention the bot:**
```
@Claude what are my sales today?
@Claude how do I compare to last week?
```

**Direct message:**
```
Help me analyze my profit margins
What should I focus on today?
```

**Slash commands:**
```
/sales         - Quick sales summary
/claude [msg]  - Ask Claude anything
```

## 🛠️ Tech Stack

- **Node.js** - Runtime
- **@slack/bolt** - Slack API framework
- **Anthropic SDK** - Claude API integration
- **Express** - Health check endpoints
- **Axios** - HTTP requests to Lightspeed

## 📊 Architecture

```
┌─────────────┐
│   Slack     │
│  Workspace  │
└──────┬──────┘
       │ Socket Mode (WebSocket)
       │
┌──────▼──────┐
│   Bot App   │◄───── Environment Variables
│  (Node.js)  │
└──────┬──────┘
       │
       ├─────► Claude API (Anthropic)
       │
       └─────► Lightspeed API (Sales Data)
```

## 🔒 Security

- All secrets stored as environment variables
- Socket Mode (no public webhooks required)
- HTTPS only communication
- Token-based authentication
- `.env` files gitignored

## 💰 Cost Estimate

### Monthly Costs:
- **Render Starter Plan:** $7/month (or Free tier)
- **Claude API:** ~$5-20/month (depending on usage)
- **Total:** $12-27/month

### Free Tier Option:
- Use Render's free tier (limited hours)
- Monitor Claude API usage carefully
- **Total:** ~$5-10/month (Claude API only)

## 🎯 Roadmap

### Current Features:
- ✅ Respond to mentions
- ✅ Handle DMs
- ✅ Fetch sales data
- ✅ Slash commands
- ✅ Health monitoring

### Planned Features:
- 🔜 Scheduled daily reports
- 🔜 Proactive alerts (low sales, etc.)
- 🔜 Multi-store support
- 🔜 Customer insights
- 🔜 Inventory alerts
- 🔜 Advanced analytics

## 🐛 Troubleshooting

**Bot doesn't respond:**
- Check Render logs
- Verify Socket Mode is enabled
- Check environment variables

**Sales data not working:**
- Verify Lightspeed credentials
- Check token expiration
- Review API logs

**API errors:**
- Check Anthropic API key
- Verify rate limits
- Review error logs

## 📞 Support

For issues or questions:
1. Check [SETUP-GUIDE.md](./SETUP-GUIDE.md)
2. Review server logs
3. Test API keys independently

## 📄 License

MIT License - feel free to modify and use for your business!

## 🙏 Credits

Built with:
- [Slack Bolt](https://slack.dev/bolt-js/) for Slack integration
- [Anthropic Claude](https://www.anthropic.com/) for AI capabilities
- [Lightspeed Retail](https://www.lightspeedhq.com/) for POS data

---

**Made with ❤️ for small business owners who want AI-powered insights 24/7**
