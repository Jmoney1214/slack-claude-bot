# 🤖 24/7 Claude-Powered Slack Bot - Setup Guide

This guide will walk you through setting up your AI-powered Slack bot that runs 24/7 in the cloud.

---

## 📋 Prerequisites

1. **Slack Workspace** - Admin access to create apps
2. **Anthropic API Key** - From https://console.anthropic.com/
3. **Render Account** - Free tier works! (or any Node.js hosting)
4. **GitHub Account** - For deploying to Render

---

## 🚀 Part 1: Create Slack App

### Step 1: Create New Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Name: `Claude AI Assistant` (or your preferred name)
5. Select your workspace
6. Click **"Create App"**

### Step 2: Enable Socket Mode

Socket Mode allows the bot to work without exposing a public URL (easier for deployment).

1. In your app settings, go to **"Socket Mode"** (in the left sidebar)
2. Toggle **"Enable Socket Mode"** to ON
3. Click **"Generate an app-level token"**
   - Token Name: `socket-connection`
   - Add scope: `connections:write`
   - Click **"Generate"**
4. **Copy the token** (starts with `xapp-`) - this is your `SLACK_APP_TOKEN`

### Step 3: Configure Bot Token

1. Go to **"OAuth & Permissions"** (left sidebar)
2. Scroll to **"Scopes"** → **"Bot Token Scopes"**
3. Add these scopes:
   ```
   app_mentions:read
   chat:write
   im:history
   im:read
   im:write
   channels:history
   channels:read
   commands
   ```
4. Scroll up and click **"Install to Workspace"**
5. Click **"Allow"**
6. **Copy the "Bot User OAuth Token"** (starts with `xoxb-`) - this is your `SLACK_BOT_TOKEN`

### Step 4: Get Signing Secret

1. Go to **"Basic Information"** (left sidebar)
2. Scroll to **"App Credentials"**
3. **Copy the "Signing Secret"** - this is your `SLACK_SIGNING_SECRET`

### Step 5: Enable Events

1. Go to **"Event Subscriptions"** (left sidebar)
2. Toggle **"Enable Events"** to ON
3. Under **"Subscribe to bot events"**, add:
   ```
   app_mention
   message.im
   ```
4. Click **"Save Changes"**

### Step 6: Enable App Home (Optional but Recommended)

1. Go to **"App Home"** (left sidebar)
2. Under **"Show Tabs"**:
   - Enable **"Messages Tab"**
   - Check **"Allow users to send Slash commands and messages from the messages tab"**

### Step 7: Add Slash Commands (Optional)

1. Go to **"Slash Commands"** (left sidebar)
2. Click **"Create New Command"**
3. Add these commands:

   **Command 1:**
   - Command: `/sales`
   - Short Description: `Get today's sales summary`
   - Usage Hint: (leave blank)

   **Command 2:**
   - Command: `/claude`
   - Short Description: `Ask Claude a question`
   - Usage Hint: `[your question]`

---

## 🔑 Part 2: Get Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to **"API Keys"** section
4. Click **"Create Key"**
5. Name it: `slack-bot`
6. **Copy the API key** (starts with `sk-ant-`) - this is your `ANTHROPIC_API_KEY`

⚠️ **Important:** Keep this key secret! Never commit it to git.

---

## ☁️ Part 3: Deploy to Render

### Option A: Deploy via GitHub (Recommended)

1. **Push your code to GitHub:**
   ```bash
   cd slack-claude-bot
   git init
   git add .
   git commit -m "Initial commit: Claude Slack bot"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/slack-claude-bot.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to https://dashboard.render.com/
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub account
   - Select the `slack-claude-bot` repository
   - Configure:
     - **Name:** `claude-slack-bot`
     - **Region:** Oregon (US West)
     - **Branch:** `main`
     - **Runtime:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Plan:** Starter ($7/month) or Free

3. **Add Environment Variables** (in Render dashboard):
   - Click **"Environment"** tab
   - Add these variables:
     ```
     SLACK_BOT_TOKEN=xoxb-your-token-here
     SLACK_SIGNING_SECRET=your-secret-here
     SLACK_APP_TOKEN=xapp-your-token-here
     ANTHROPIC_API_KEY=sk-ant-your-key-here
     NODE_ENV=production
     ```

4. **Deploy:**
   - Click **"Create Web Service"**
   - Wait for deployment (2-3 minutes)
   - Check logs for `⚡️ Slack bot is running!`

### Option B: Manual Deploy (Alternative)

If you don't want to use GitHub, you can deploy directly:

```bash
cd slack-claude-bot
npm install
# Create .env file with your keys
npm start
```

Then use a service like Railway, Fly.io, or Heroku.

---

## ✅ Part 4: Test Your Bot

### Test 1: Mention in Channel

1. Invite the bot to a channel: `/invite @Claude AI Assistant`
2. Mention it: `@Claude AI Assistant what are my sales today?`
3. Bot should respond with sales data!

### Test 2: Direct Message

1. Open DM with the bot
2. Send: `Hey! Can you help me analyze my business?`
3. Bot should respond!

### Test 3: Slash Commands

1. Type `/sales` in any channel
2. Should see today's sales summary

---

## 🔧 Part 5: Connect to Your Sales Data

The bot automatically connects to your Lightspeed POS if you have the config files in place.

**Required files:**
```
../config/bot-config.json
../config/lightspeed-token.txt
```

If these files exist in the parent directory, the bot will automatically fetch sales data.

**To add Lightspeed integration to Render:**

1. In Render dashboard, go to your web service
2. Click **"Environment"** → **"Environment Variables"**
3. Add the Lightspeed config as environment variables:
   ```
   LIGHTSPEED_ACCOUNT_ID=your-account-id
   LIGHTSPEED_SHOP_ID=your-shop-id
   LIGHTSPEED_TOKEN=your-token
   ```

4. Update `server.js` to read from environment variables instead of files (optional enhancement)

---

## 📊 Features Your Bot Can Do

Once running, your bot can:

✅ **Respond to mentions** - `@bot what's my revenue today?`
✅ **Answer DMs** - Private conversations with Claude
✅ **Fetch sales data** - Real-time Lightspeed integration
✅ **Business analysis** - Claude analyzes your data and provides insights
✅ **Slash commands** - Quick access to common queries
✅ **24/7 availability** - Always online, never sleeps

---

## 💡 Usage Examples

### Sales Queries
```
@Claude what are my sales today?
@Claude how does today compare to last week?
@Claude show me my best selling products
```

### Business Intelligence
```
@Claude analyze my profit margins
@Claude what should I focus on to increase revenue?
@Claude give me insights about my customer patterns
```

### General Questions
```
@Claude what's the weather like for business today?
@Claude help me write a promotion message
@Claude suggest ways to improve customer retention
```

---

## 🔒 Security Notes

1. **Never commit `.env` files** - They contain secrets
2. **Keep API keys private** - Don't share them
3. **Use environment variables** - For all sensitive data
4. **Rotate keys regularly** - Good security practice
5. **Monitor usage** - Check Anthropic dashboard for API usage

---

## 📈 Monitoring & Maintenance

### Check Bot Health

Your bot has a health endpoint at: `https://your-app.onrender.com/health`

Returns:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2025-11-01T12:00:00.000Z"
}
```

### View Logs (Render)

1. Go to your Render dashboard
2. Click on your web service
3. Click **"Logs"** tab
4. See real-time logs

### Monitor Costs

- **Render:** Free tier or $7/month (Starter)
- **Anthropic API:** ~$3 per million input tokens
  - Typical usage: $5-20/month for moderate use
  - Set spending limits in Anthropic console

---

## 🚨 Troubleshooting

### Bot doesn't respond

**Check:**
1. Is the bot online? (Check Render logs)
2. Is Socket Mode enabled in Slack?
3. Are environment variables set correctly?
4. Did you invite the bot to the channel?

### Sales data not working

**Check:**
1. Are Lightspeed credentials configured?
2. Is the token still valid? (Check `oauth-auto-refresh.js`)
3. Check logs for API errors

### API errors

**Check:**
1. Is Anthropic API key valid?
2. Have you exceeded rate limits?
3. Check Anthropic console for errors

---

## 🎯 Next Steps

### Enhancements You Can Add:

1. **Scheduled Reports** - Morning sales summary posted automatically
2. **Alerts** - Low inventory, slow day warnings
3. **Multi-channel** - Post to specific channels
4. **Custom Commands** - Add more slash commands
5. **Analytics Dashboard** - Link to web dashboards
6. **Customer Insights** - Analyze customer patterns

### Example: Add Morning Report

Add this to `server.js`:

```javascript
const cron = require('node-cron');

// Daily morning report at 9 AM
cron.schedule('0 9 * * *', async () => {
  const salesData = await getTodaysSalesSummary();
  await app.client.chat.postMessage({
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'YOUR-CHANNEL-ID',
    text: `🌅 Good morning! Here's yesterday's summary:\n${salesData}`
  });
});
```

---

## 💬 Support

If you run into issues:

1. Check the logs first (most errors are there)
2. Verify all environment variables are set
3. Test API keys independently
4. Review Slack app permissions

---

## 📝 Quick Reference

### Environment Variables
```bash
SLACK_BOT_TOKEN          # From Slack OAuth page
SLACK_SIGNING_SECRET     # From Slack Basic Info
SLACK_APP_TOKEN          # From Slack Socket Mode
ANTHROPIC_API_KEY        # From Anthropic console
PORT                     # 3000 (default)
NODE_ENV                 # production
```

### Key Files
```
server.js           # Main bot logic
package.json        # Dependencies
.env               # Environment variables (DO NOT COMMIT)
render.yaml        # Render deployment config
```

---

🎉 **Congratulations!** Your Claude-powered Slack bot is now running 24/7!

You can now chat with Claude anytime, anywhere via Slack. The bot has access to your business data and can provide intelligent insights on demand.

**Pro tip:** Start with simple questions to test, then gradually use it for more complex business analysis as you get comfortable with it.
