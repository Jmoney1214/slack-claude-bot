/**
 * Lightspeed Intelligence Module
 *
 * Comprehensive query capabilities for Lightspeed Retail API
 */

const axios = require('axios');

class LightspeedIntelligence {
  constructor(config) {
    this.accountId = config.account_id;
    this.shopId = config.shop_id;
    this.token = config.token;
    this.baseUrl = config.base_url;
    this.timezone = config.timezone || 'America/New_York';
  }

  /**
   * Generic Lightspeed API query
   */
  async query(endpoint, params = {}) {
    const url = `${this.baseUrl}/${this.accountId}/${endpoint}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        },
        params: params
      });

      return response.data;
    } catch (error) {
      console.error(`Lightspeed API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Get date range for queries
   */
  getDateRange(daysAgo = 0, daysSpan = 1) {
    const now = new Date();
    const estString = now.toLocaleString('en-US', { timeZone: this.timezone });
    const estDate = new Date(estString);

    const startDate = new Date(estDate);
    startDate.setDate(startDate.getDate() - daysAgo);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysSpan);
    endDate.setHours(23, 59, 59, 999);

    const isDST = now.toLocaleString('en-US', { timeZone: this.timezone, timeZoneName: 'short' }).includes('EDT');
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

    return {
      start: formatDate(startDate),
      end: formatDate(endDate),
      dateStr: startDate.toLocaleDateString('en-US', { timeZone: this.timezone })
    };
  }

  /**
   * Get sales for date range
   */
  async getSales(daysAgo = 0, daysSpan = 1) {
    const dateRange = this.getDateRange(daysAgo, daysSpan);

    const data = await this.query('Sale.json', {
      completeTime: `><,${dateRange.start},${dateRange.end}`,
      completed: 'true',
      shopID: this.shopId,
      load_relations: JSON.stringify(['SaleLines', 'Customer'])
    });

    const sales = Array.isArray(data.Sale) ? data.Sale : (data.Sale ? [data.Sale] : []);

    return {
      sales,
      dateRange,
      count: sales.length
    };
  }

  /**
   * Get product information
   */
  async getProduct(query) {
    // Search by description or SKU
    const data = await this.query('Item.json', {
      description: `~${query}`,
      archived: 'false',
      limit: 10
    });

    const items = Array.isArray(data.Item) ? data.Item : (data.Item ? [data.Item] : []);
    return items;
  }

  /**
   * Get customer information
   */
  async getCustomer(query) {
    const data = await this.query('Customer.json', {
      or: `firstName=~${query},lastName=~${query}`,
      limit: 10
    });

    const customers = Array.isArray(data.Customer) ? data.Customer : (data.Customer ? [data.Customer] : []);
    return customers;
  }

  /**
   * Get top selling products for a period
   */
  async getTopProducts(daysAgo = 0, daysSpan = 1, limit = 10) {
    const { sales } = await this.getSales(daysAgo, daysSpan);

    const productSales = {};

    sales.forEach(sale => {
      if (sale.voided === 'true') return;

      if (sale.SaleLines && sale.SaleLines.SaleLine) {
        const lines = Array.isArray(sale.SaleLines.SaleLine)
          ? sale.SaleLines.SaleLine
          : [sale.SaleLines.SaleLine];

        lines.forEach(line => {
          const itemId = line.itemID;
          const qty = parseFloat(line.unitQuantity || 0);
          const revenue = parseFloat(line.calcSubtotal || 0);

          if (!productSales[itemId]) {
            productSales[itemId] = {
              itemId,
              description: line.Item?.description || 'Unknown',
              quantity: 0,
              revenue: 0
            };
          }

          productSales[itemId].quantity += qty;
          productSales[itemId].revenue += revenue;
        });
      }
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Get sales metrics summary
   */
  async getSalesMetrics(daysAgo = 0, daysSpan = 1) {
    const { sales, dateRange } = await this.getSales(daysAgo, daysSpan);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalTransactions = 0;
    let totalItems = 0;
    const channels = {};
    const hourly = Array(24).fill(0);

    sales.forEach(sale => {
      if (sale.voided === 'true') return;

      const total = parseFloat(sale.calcTotal || 0);
      if (total <= 0) return;

      totalTransactions++;

      // Channel classification
      const channel = this.classifyChannel(sale);
      channels[channel] = (channels[channel] || 0) + 1;

      // Hourly distribution
      const hour = new Date(sale.completeTime).getHours();
      hourly[hour]++;

      if (sale.SaleLines && sale.SaleLines.SaleLine) {
        const lines = Array.isArray(sale.SaleLines.SaleLine)
          ? sale.SaleLines.SaleLine
          : [sale.SaleLines.SaleLine];

        lines.forEach(line => {
          const qty = parseFloat(line.unitQuantity || 0);
          const revenue = parseFloat(line.calcSubtotal || 0);
          const cost = parseFloat(line.fifoCost || line.avgCost || 0) * qty;

          totalRevenue += revenue;
          totalCost += cost;
          totalItems += qty;
        });
      }
    });

    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const avgSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const avgItems = totalTransactions > 0 ? totalItems / totalTransactions : 0;

    return {
      dateRange: dateRange.dateStr,
      totalRevenue,
      totalCost,
      profit,
      profitMargin,
      totalTransactions,
      totalItems,
      avgSale,
      avgItems,
      channels,
      hourly,
      peakHour: hourly.indexOf(Math.max(...hourly))
    };
  }

  /**
   * Classify sales channel
   */
  classifyChannel(sale) {
    if (!sale.Customer) return 'In-Store';

    const firstName = (sale.Customer.firstName || '').toLowerCase();
    const lastName = (sale.Customer.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName.includes('ubereats') || fullName.includes('uber eats')) return 'UberEats';
    if (fullName.includes('doordash') || firstName === 'doordash') return 'DoorDash';
    if (fullName.includes('grubhub')) return 'GrubHub';
    if (fullName.includes('cityhive')) return 'CityHive';

    return 'In-Store';
  }

  /**
   * Search across sales data
   */
  async searchSales(searchTerm, daysAgo = 0, daysSpan = 7) {
    const { sales } = await this.getSales(daysAgo, daysSpan);
    const term = searchTerm.toLowerCase();

    return sales.filter(sale => {
      // Search in customer name
      if (sale.Customer) {
        const name = `${sale.Customer.firstName} ${sale.Customer.lastName}`.toLowerCase();
        if (name.includes(term)) return true;
      }

      // Search in product descriptions
      if (sale.SaleLines && sale.SaleLines.SaleLine) {
        const lines = Array.isArray(sale.SaleLines.SaleLine)
          ? sale.SaleLines.SaleLine
          : [sale.SaleLines.SaleLine];

        for (const line of lines) {
          if (line.Item && line.Item.description) {
            if (line.Item.description.toLowerCase().includes(term)) return true;
          }
        }
      }

      return false;
    });
  }

  /**
   * Get comparative metrics (today vs yesterday, this week vs last week, etc.)
   */
  async getComparison(period = 'daily') {
    let current, previous;

    if (period === 'daily') {
      current = await this.getSalesMetrics(0, 1);  // Today
      previous = await this.getSalesMetrics(1, 1); // Yesterday
    } else if (period === 'weekly') {
      current = await this.getSalesMetrics(0, 7);  // This week
      previous = await this.getSalesMetrics(7, 7); // Last week
    } else if (period === 'monthly') {
      current = await this.getSalesMetrics(0, 30);  // Last 30 days
      previous = await this.getSalesMetrics(30, 30); // Previous 30 days
    }

    const revenueChange = previous.totalRevenue > 0
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
      : 0;

    const transactionChange = previous.totalTransactions > 0
      ? ((current.totalTransactions - previous.totalTransactions) / previous.totalTransactions) * 100
      : 0;

    return {
      current,
      previous,
      changes: {
        revenue: revenueChange,
        transactions: transactionChange,
        avgSale: current.avgSale - previous.avgSale
      }
    };
  }

  /**
   * Generate intelligent summary based on query intent
   */
  async getIntelligentResponse(userQuestion) {
    const question = userQuestion.toLowerCase();

    // Determine what data to fetch based on question
    let data = '';

    if (question.includes('today')) {
      const metrics = await this.getSalesMetrics(0, 1);
      data += `📊 TODAY'S PERFORMANCE:\n`;
      data += `• Revenue: $${metrics.totalRevenue.toFixed(2)}\n`;
      data += `• Transactions: ${metrics.totalTransactions}\n`;
      data += `• Avg Sale: $${metrics.avgSale.toFixed(2)}\n`;
      data += `• Profit: $${metrics.profit.toFixed(2)} (${metrics.profitMargin.toFixed(1)}%)\n`;
      data += `• Peak Hour: ${metrics.peakHour}:00\n\n`;

      if (question.includes('compare') || question.includes('yesterday')) {
        const comparison = await this.getComparison('daily');
        data += `📈 VS YESTERDAY:\n`;
        data += `• Revenue: ${comparison.changes.revenue > 0 ? '+' : ''}${comparison.changes.revenue.toFixed(1)}%\n`;
        data += `• Transactions: ${comparison.changes.transactions > 0 ? '+' : ''}${comparison.changes.transactions.toFixed(1)}%\n\n`;
      }
    }

    if (question.includes('top') || question.includes('best') || question.includes('selling')) {
      const topProducts = await this.getTopProducts(0, 1, 5);
      data += `🏆 TOP PRODUCTS TODAY:\n`;
      topProducts.forEach((p, i) => {
        data += `${i + 1}. ${p.description}: $${p.revenue.toFixed(2)} (${p.quantity} units)\n`;
      });
      data += '\n';
    }

    if (question.includes('week')) {
      const metrics = await this.getSalesMetrics(0, 7);
      data += `📅 THIS WEEK:\n`;
      data += `• Revenue: $${metrics.totalRevenue.toFixed(2)}\n`;
      data += `• Transactions: ${metrics.totalTransactions}\n`;
      data += `• Profit: $${metrics.profit.toFixed(2)}\n\n`;
    }

    if (question.includes('channel') || question.includes('delivery')) {
      const metrics = await this.getSalesMetrics(0, 1);
      data += `🚚 CHANNEL BREAKDOWN:\n`;
      Object.entries(metrics.channels).forEach(([channel, count]) => {
        data += `• ${channel}: ${count} orders\n`;
      });
      data += '\n';
    }

    return data || 'I can fetch that data for you! Please specify what you\'d like to know.';
  }
}

module.exports = LightspeedIntelligence;
