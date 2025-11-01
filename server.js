#!/usr/bin/env node

/**
 * 24/7 Claude-Powered Slack Bot
 *
 * Features:
 * - Responds to mentions and DMs
 * - Uses Claude API (Sonnet) for intelligent responses
 * - Can query sales data from Lightspeed
 * - Proactive monitoring and alerts
 */

require('dotenv').config();
const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Slack App
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // Use Socket Mode for easier deployment
  appToken: process.env.SLACK_APP_TOKEN
});

// Initialize Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Configuration
const CONFIG = {
  claude_model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  business_name: 'Phyc Analyzer / Shop 6',
  timezone: 'America/New_York'
};

/**
 * Load Lightspeed configuration if available
 */
function loadLightspeedConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'bot-config.json');
    const tokenPath = path.join(__dirname, '..', 'config', 'lightspeed-token.txt');

    if (fs.existsSync(configPath) && fs.existsSync(tokenPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const token = fs.readFileSync(tokenPath, 'utf8').trim();

      return {
        account_id: config.shop_config.account_id,
        shop_id: config.shop_config.shop_id,
        token: token,
        base_url: 'https://api.lightspeedapp.com/API/Account'
      };
    }
  } catch (error) {
    console.log('⚠️  Lightspeed config not found, sales queries will be disabled');
  }
  return null;
}

const LIGHTSPEED = loadLightspeedConfig();

/**
 * Fetch today's sales summary
 */
async function getTodaysSalesSummary() {
  if (!LIGHTSPEED) {
    return 'Sales data unavailable - Lightspeed not configured.';
  }

  try {
    // Get today's date range
    const now = new Date();
    const estString = now.toLocaleString('en-US', { timeZone: CONFIG.timezone });
    const estDate = new Date(estString);

    const startOfDay = new Date(estDate);
    startOfDay.setHours(0, 0, 0, 0);

    const isDST = now.toLocaleString('en-US', { timeZone: CONFIG.timezone, timeZoneName: 'short' }).includes('EDT');
    const offset = isDST ? '-04:00' : '-05:00';

    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d}T${h}:${min}:${s}${offset}`;
    };

    const start = formatDate(startOfDay);
    const end = formatDate(estDate);

    // Fetch sales
    const url = `${LIGHTSPEED.base_url}/${LIGHTSPEED.account_id}/Sale.json?` +
      `completeTime=><,${start},${end}&` +
      `completed=true&` +
      `shopID=${LIGHTSPEED.shop_id}&` +
      `load_relations=["SaleLines"]`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${LIGHTSPEED.token}`,
        'Accept': 'application/json'
      }
    });

    const sales = Array.isArray(response.data.Sale) ? response.data.Sale : (response.data.Sale ? [response.data.Sale] : []);

    // Calculate metrics
    let totalRevenue = 0;
    let totalTransactions = 0;

    sales.forEach(sale => {
      if (sale.voided === 'true') return;
      const total = parseFloat(sale.calcTotal || 0);
      if (total > 0) {
        totalRevenue += parseFloat(sale.calcSubtotal || 0);
        totalTransactions++;
      }
    });

    const avgSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const currentTime = estDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `📊 Today's Sales (as of ${currentTime}):\n` +
           `• Transactions: ${totalTransactions}\n` +
           `• Revenue: $${totalRevenue.toFixed(2)}\n` +
           `• Avg Sale: $${avgSale.toFixed(2)}`;

  } catch (error) {
    console.error('Error fetching sales:', error.message);
    return 'Error fetching sales data. Please check Lightspeed connection.';
  }
}

/**
 * Build system prompt with business context
 */
function buildSystemPrompt() {
  return `You are Claude, an AI assistant integrated into Slack for ${CONFIG.business_name}.

You have access to real-time business data and can help with:
- Sales analysis and reporting
- Business intelligence queries
- Data interpretation and insights
- General business questions

Current date/time: ${new Date().toLocaleString('en-US', { timeZone: CONFIG.timezone })}

When users ask about sales, performance, or business metrics, provide clear, actionable insights.
Be concise in Slack - use bullet points and short paragraphs.
Use emojis appropriately to make responses engaging.

If asked about sales data and you don't see it in the conversation, let the user know you'll fetch it.`;
}

/**
 * Process user message with Claude
 */
async function processWithClaude(userMessage, includeContext = false) {
  try {
    let systemPrompt = buildSystemPrompt();
    let userPrompt = userMessage;

    // If context needed, fetch sales data
    if (includeContext || userMessage.toLowerCase().includes('sales') ||
        userMessage.toLowerCase().includes('today') ||
        userMessage.toLowerCase().includes('performance')) {
      const salesData = await getTodaysSalesSummary();
      userPrompt = `${salesData}\n\nUser question: ${userMessage}`;
    }

    const response = await anthropic.messages.create({
      model: CONFIG.claude_model,
      max_tokens: CONFIG.max_tokens,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    return response.content[0].text;

  } catch (error) {
    console.error('Claude API Error:', error.message);
    return `❌ Error processing your request: ${error.message}`;
  }
}

/**
 * Handle mentions and DMs
 */
app.event('app_mention', async ({ event, say }) => {
  try {
    console.log(`📨 Mention from ${event.user} in ${event.channel}`);

    // Remove bot mention from text
    const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!userMessage) {
      await say('Hi! How can I help you today?');
      return;
    }

    // Show typing indicator
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: event.channel,
      text: '🤔 Thinking...'
    });

    // Process with Claude
    const response = await processWithClaude(userMessage, true);

    // Send response
    await say(response);

  } catch (error) {
    console.error('Error handling mention:', error);
    await say('❌ Sorry, I encountered an error processing your request.');
  }
});

/**
 * Handle DMs
 */
app.event('message', async ({ event, say }) => {
  // Ignore bot messages and threaded messages
  if (event.subtype || event.thread_ts) return;

  // Only respond to DMs (channel type is 'im')
  if (event.channel_type !== 'im') return;

  try {
    console.log(`💬 DM from ${event.user}: ${event.text}`);

    const response = await processWithClaude(event.text, true);
    await say(response);

  } catch (error) {
    console.error('Error handling DM:', error);
    await say('❌ Sorry, I encountered an error processing your message.');
  }
});

/**
 * Handle slash commands (optional)
 */
app.command('/sales', async ({ command, ack, respond }) => {
  await ack();

  try {
    const salesData = await getTodaysSalesSummary();
    await respond({
      text: salesData,
      response_type: 'in_channel'
    });
  } catch (error) {
    await respond('❌ Error fetching sales data.');
  }
});

app.command('/claude', async ({ command, ack, respond }) => {
  await ack();

  try {
    const response = await processWithClaude(command.text, true);
    await respond({
      text: response,
      response_type: 'ephemeral'
    });
  } catch (error) {
    await respond('❌ Error processing your request.');
  }
});

/**
 * Health check endpoint (for monitoring)
 */
const express = require('express');
const healthApp = express();

healthApp.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
healthApp.listen(PORT, () => {
  console.log(`🏥 Health check server running on port ${PORT}`);
});

/**
 * Start the Slack bot
 */
(async () => {
  try {
    await app.start();

    console.log('⚡️ Slack bot is running!');
    console.log(`🤖 Bot Name: ${CONFIG.business_name} Assistant`);
    console.log(`🌐 Timezone: ${CONFIG.timezone}`);
    console.log(`💬 Model: ${CONFIG.claude_model}`);

    if (LIGHTSPEED) {
      console.log('✅ Lightspeed integration: ENABLED');
    } else {
      console.log('⚠️  Lightspeed integration: DISABLED');
    }

    console.log('\n🎉 Bot is ready to receive messages!');

  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});
