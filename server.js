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
const LightspeedIntelligence = require('./lightspeed-intelligence');

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
  // First check environment variables (for Render deployment)
  if (process.env.LIGHTSPEED_ACCOUNT_ID &&
      process.env.LIGHTSPEED_SHOP_ID &&
      process.env.LIGHTSPEED_TOKEN) {
    console.log('✅ Loading Lightspeed config from environment variables');
    return {
      account_id: process.env.LIGHTSPEED_ACCOUNT_ID,
      shop_id: process.env.LIGHTSPEED_SHOP_ID,
      token: process.env.LIGHTSPEED_TOKEN,
      base_url: 'https://api.lightspeedapp.com/API/Account'
    };
  }

  // Fallback to config files (for local development)
  try {
    const configPath = path.join(__dirname, '..', 'config', 'bot-config.json');
    const tokenPath = path.join(__dirname, '..', 'config', 'lightspeed-token.txt');

    if (fs.existsSync(configPath) && fs.existsSync(tokenPath)) {
      console.log('✅ Loading Lightspeed config from files');
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

// Initialize Lightspeed Intelligence Module
let lightspeedIntelligence = null;
if (LIGHTSPEED) {
  lightspeedIntelligence = new LightspeedIntelligence({
    account_id: LIGHTSPEED.account_id,
    shop_id: LIGHTSPEED.shop_id,
    token: LIGHTSPEED.token,
    base_url: LIGHTSPEED.base_url,
    timezone: CONFIG.timezone
  });
}

/**
 * Fetch today's sales summary
 */
async function getTodaysSalesSummary() {
  if (!lightspeedIntelligence) {
    return 'Sales data unavailable - Lightspeed not configured.';
  }

  try {
    const metrics = await lightspeedIntelligence.getSalesMetrics(0, 1);
    const now = new Date();
    const currentTime = now.toLocaleString('en-US', {
      timeZone: CONFIG.timezone,
      hour: '2-digit',
      minute: '2-digit'
    });

    return `📊 Today's Sales (as of ${currentTime}):\n` +
           `• Transactions: ${metrics.totalTransactions}\n` +
           `• Revenue: $${metrics.totalRevenue.toFixed(2)}\n` +
           `• Avg Sale: $${metrics.avgSale.toFixed(2)}\n` +
           `• Profit: $${metrics.profit.toFixed(2)} (${metrics.profitMargin.toFixed(1)}% margin)\n` +
           `• Items Sold: ${metrics.totalItems.toFixed(0)}\n` +
           `• Peak Hour: ${metrics.peakHour}:00`;

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

You have access to real-time business data from Lightspeed POS and can help with:
- Sales analysis and reporting (today, yesterday, this week, any date range)
- Product performance (top sellers, revenue by product)
- Customer insights and purchase patterns
- Channel analysis (In-Store vs UberEats, DoorDash, etc.)
- Profit margins and business metrics
- Comparative analysis (today vs yesterday, this week vs last week)
- Business intelligence queries

Current date/time: ${new Date().toLocaleString('en-US', { timeZone: CONFIG.timezone })}

When users ask about sales, products, customers, or any business metrics, you'll receive the relevant data.
Provide clear, actionable insights from the data.
Be concise in Slack - use bullet points and short paragraphs.
Use emojis appropriately to make responses engaging.

You can answer questions like:
- "How are sales doing today?"
- "What are my top selling products this week?"
- "Compare today to yesterday"
- "Show me all sales for [product name]"
- "What's my profit margin today?"
- "Which delivery channel is performing best?"`;
}

/**
 * Detect if query is business/Lightspeed related
 */
function isBusinessQuery(message) {
  const keywords = [
    'sales', 'revenue', 'profit', 'transaction', 'customer', 'product',
    'selling', 'today', 'yesterday', 'week', 'month', 'performance',
    'channel', 'delivery', 'ubereats', 'doordash', 'compare', 'top',
    'best', 'worst', 'average', 'total', 'margin', 'cost', 'price'
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Process user message with Claude
 */
async function processWithClaude(userMessage, includeContext = false) {
  try {
    let systemPrompt = buildSystemPrompt();
    let userPrompt = userMessage;

    // Check if this is a business/Lightspeed query
    if (lightspeedIntelligence && (includeContext || isBusinessQuery(userMessage))) {
      console.log('🔍 Detected business query, fetching comprehensive data...');

      try {
        // Fetch comprehensive business data for Claude to analyze
        const [todayMetrics, topProducts, comparison] = await Promise.all([
          lightspeedIntelligence.getSalesMetrics(0, 1).catch(e => null),
          lightspeedIntelligence.getTopProducts(0, 1, 10).catch(e => null),
          lightspeedIntelligence.getComparison('daily').catch(e => null)
        ]);

        // Build comprehensive data context
        let businessData = '';

        if (todayMetrics) {
          const now = new Date().toLocaleString('en-US', {
            timeZone: CONFIG.timezone,
            hour: '2-digit',
            minute: '2-digit'
          });

          businessData += `📊 TODAY'S PERFORMANCE (as of ${now}):\n`;
          businessData += `• Revenue: $${todayMetrics.totalRevenue.toFixed(2)}\n`;
          businessData += `• Transactions: ${todayMetrics.totalTransactions}\n`;
          businessData += `• Average Sale: $${todayMetrics.avgSale.toFixed(2)}\n`;
          businessData += `• Profit: $${todayMetrics.profit.toFixed(2)} (${todayMetrics.profitMargin.toFixed(1)}% margin)\n`;
          businessData += `• Items Sold: ${todayMetrics.totalItems.toFixed(0)}\n`;
          businessData += `• Avg Items/Sale: ${todayMetrics.avgItems.toFixed(1)}\n`;
          businessData += `• Peak Sales Hour: ${todayMetrics.peakHour}:00\n\n`;

          // Channel breakdown
          if (todayMetrics.channels && Object.keys(todayMetrics.channels).length > 0) {
            businessData += `🚚 CHANNEL BREAKDOWN:\n`;
            Object.entries(todayMetrics.channels)
              .sort((a, b) => b[1] - a[1])
              .forEach(([channel, count]) => {
                const percentage = (count / todayMetrics.totalTransactions * 100).toFixed(1);
                businessData += `• ${channel}: ${count} orders (${percentage}%)\n`;
              });
            businessData += '\n';
          }
        }

        if (comparison) {
          businessData += `📈 COMPARED TO YESTERDAY:\n`;
          businessData += `• Revenue Change: ${comparison.changes.revenue > 0 ? '+' : ''}${comparison.changes.revenue.toFixed(1)}%\n`;
          businessData += `• Transaction Change: ${comparison.changes.transactions > 0 ? '+' : ''}${comparison.changes.transactions.toFixed(1)}%\n`;
          businessData += `• Avg Sale Change: $${comparison.changes.avgSale > 0 ? '+' : ''}${comparison.changes.avgSale.toFixed(2)}\n\n`;
        }

        if (topProducts && topProducts.length > 0) {
          businessData += `🏆 TOP SELLING PRODUCTS TODAY:\n`;
          topProducts.slice(0, 5).forEach((p, i) => {
            businessData += `${i + 1}. ${p.description}: $${p.revenue.toFixed(2)} revenue (${p.quantity} units)\n`;
          });
          businessData += '\n';
        }

        if (businessData) {
          userPrompt = `LIVE BUSINESS DATA:\n${businessData}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nUSER QUESTION: "${userMessage}"\n\nPlease analyze the data above and answer the user's question. Provide insights, trends, and actionable recommendations based on the data. Be conversational and helpful.`;
        }
      } catch (dataError) {
        console.error('Error fetching business data:', dataError.message);
        userPrompt = `${userMessage}\n\n(Note: Could not fetch live data - ${dataError.message})`;
      }
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
